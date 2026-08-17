<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { OnelabClient } from '../simulation/client'
import { summarizeView } from '../simulation/reference'
import type { MicrostripResult } from '../simulation/types'
import { parameterChanged, parseOnelab, type OnelabParameter } from '../simulation/onelab-db'
import { ProjectSession } from '../simulation/project-session'
import SimulationSceneHost from '../components/SimulationSceneHost.vue'
import { matchSurfaceSignatures, summarizeScene, type SimulationScene, type SurfaceMatch } from '../simulation/scene'
import type { SceneSelection } from '../simulation/scene-host'
import { fieldCsv, fieldPos, probeScenePoint } from '../simulation/results'
import { MeshstepClient } from '../simulation/viewer-client'
import { projectCatalog } from '../simulation/project-catalog'
import { PhysicalGroupEditor } from '../simulation/physical-groups'
import { onelabLoopValues, onelabOutputs, type LoopHistoryPoint } from '../simulation/loops'
import { exportProjectArchive, importProjectArchive, loadPersistedProjectArchive, persistProjectArchive, projectPersistenceStatus } from '../simulation/project-archive'

const client = new OnelabClient()
const session = new ProjectSession()
const sessionVersion = ref(0)
const meshstep = new MeshstepClient()
const state = ref<'idle' | 'warming' | 'ready' | 'running' | 'complete' | 'stale' | 'cancelled' | 'error'>('idle')
const error = ref('')
const result = ref<MicrostripResult>()
const runs = ref(0)
const committedResultRevision = ref(-1)
const workerId = ref('')
const nativeOperation = ref('')
const activeRequestId = ref('')
const viewerState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const scene = ref<SimulationScene>()
const preview = ref<SimulationScene>()
const authoritative = ref<SimulationScene>()
const matches = ref<SurfaceMatch[]>()
const selectedPreviewKey = ref<number>()
const authoritativeSelection = ref<number>()
const authoritativeSelectionDimension = ref<2 | 3>(2)
const lastSelection = ref<SceneSelection>()
const viewerError = ref('')
let disposed = false
const solverProjects = projectCatalog.filter(({ kind }) => kind === 'solve')
const selectedProjectId = ref('microstrip')
const groupName = ref('selection')
const selectedGroupId = ref('')
const authoredGroups = ref<ReturnType<PhysicalGroupEditor['sidecar']>['groups']>([])
const loopHistory = ref<LoopHistoryPoint[]>([])
const loopProgress = ref(0)
const loopTotal = ref(0)
const loopRunning = ref(false)
let loopCancelled = false
const opfsStatus = ref<'available' | 'unsupported' | 'saved' | 'loaded' | 'error'>(projectPersistenceStatus())
let groupEditor = new PhysicalGroupEditor(selectedProjectId.value)
const parameters = computed(() => {
  sessionVersion.value
  return session.ready ? parseOnelab(session.database).onelab.parameters.filter(({ name }) => name.startsWith('Parameters/')) : []
})
const displayedResult = computed(() => {
  sessionVersion.value
  return committedResultRevision.value === session.revision ? session.lastResult : undefined
})
const mappedSummary = computed(() => displayedResult.value?.scene.fields.map((field) => ({
  id: field.id, name: field.name, association: field.association, components: field.components,
  samples: field.values.length / field.steps.length / field.components, steps: [...field.steps], times: [...field.times], ranges: [...field.ranges], globalRange: field.globalRange,
  provenance: field.provenance, complexPart: field.complexPart,
})))
const selectableEntities = computed(() => displayedResult.value?.scene.entities.filter(({ dimension }) => dimension >= 2) ?? [])
const spatialProbes = computed(() => {
  const solved = displayedResult.value?.scene
  if (!solved) return []
  const scalar = solved.fields.find((field) => field.name === 'v')
  const vector = solved.fields.find((field) => field.name === 'e')
  if (!scalar || !vector) return []
  return [['ground', 0.0004, 0.0002], ['substrate', 0.0013, 0.0007], ['air', 0.0032, 0.00055]].map(([key, x, y]) => {
    const point: [number, number, number] = [Number(x), Number(y), 0]
    const scalarProbe = probeScenePoint(solved, scalar, 0, point)
    const vectorProbe = probeScenePoint(solved, vector, 0, point)
    return { key, coordinate: point, scalar: scalarProbe.values[0], vector: vectorProbe.values, magnitude: vectorProbe.magnitude }
  })
})
const exportSummary = computed(() => {
  const solved = displayedResult.value?.scene
  if (!solved) return []
  return solved.fields.map((field) => {
    const csv = fieldCsv(solved, field), pos = fieldPos(solved, field)
    return { id: field.id, csvRows: csv.trim().split('\n').length, csvHeader: csv.split('\n')[0], posRecords: (pos.match(/\b[SVT][PTQLSHIY]\(/g) ?? []).length, hasTime: /TIME\{/.test(pos) }
  })
})
const removeNativeListener = client.onEnteredNative((event) => {
  if (event.detail.requestId !== activeRequestId.value) return
  workerId.value = event.detail.workerId
  nativeOperation.value = event.detail.operation
})

async function warm() {
  state.value = 'warming'
  error.value = ''
  try {
    if (!authoredGroups.value.length) restoreGroups(selectedProjectId.value)
    await navigator.serviceWorker?.ready
    await client.warm()
    if (!session.ready) {
      const project = await client.openProject(selectedProjectId.value)
      session.open(project.files, project.defaults, project.descriptor)
      sessionVersion.value++
    }
    state.value = 'ready'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  }
}

async function selectProject(event: Event) {
  selectedProjectId.value = (event.target as HTMLSelectElement).value
  state.value = 'warming'
  try {
    const project = await client.openProject(selectedProjectId.value)
    session.open(project.files, project.defaults, project.descriptor)
    committedResultRevision.value = -1
    result.value = undefined
    loopHistory.value = []
    loopProgress.value = 0
    loopTotal.value = 0
    authoritativeSelection.value = undefined
    restoreGroups(selectedProjectId.value)
    sessionVersion.value++
    state.value = 'ready'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  }
}

function restoreGroups(projectId: string) {
  const saved = localStorage.getItem(`opensimphy-physical-groups:${projectId}`)
  groupEditor = saved ? PhysicalGroupEditor.load(saved, projectId) : new PhysicalGroupEditor(projectId)
  authoredGroups.value = groupEditor.sidecar().groups
  selectedGroupId.value = authoredGroups.value[0]?.id ?? ''
}

function persistGroups() {
  const sidecar = groupEditor.sidecar()
  authoredGroups.value = sidecar.groups
  localStorage.setItem(`opensimphy-physical-groups:${sidecar.projectId}`, JSON.stringify(sidecar))
}

function addPhysicalGroup() {
  if (authoritativeSelection.value === undefined) return
  selectedGroupId.value = groupEditor.add(authoritativeSelectionDimension.value, groupName.value, [authoritativeSelection.value])
  persistGroups()
}

function renamePhysicalGroup() { if (selectedGroupId.value) { groupEditor.rename(selectedGroupId.value, groupName.value); persistGroups() } }
function replacePhysicalGroupMembership() { if (selectedGroupId.value && authoritativeSelection.value !== undefined) { groupEditor.setMembership(selectedGroupId.value, [authoritativeSelection.value]); persistGroups() } }
function selectAuthoritativeEntity(event: Event) {
  const [dimension, tag] = (event.target as HTMLSelectElement).value.split(':').map(Number)
  if ((dimension !== 2 && dimension !== 3) || !Number.isInteger(tag)) return
  authoritativeSelectionDimension.value = dimension
  authoritativeSelection.value = tag
}
function deletePhysicalGroup() { if (selectedGroupId.value) { groupEditor.delete(selectedGroupId.value); selectedGroupId.value = ''; persistGroups() } }
function resetPhysicalGroups() { groupEditor.reset(); selectedGroupId.value = ''; persistGroups() }

async function solve() {
  await execute('compute')
}

async function execute(action: 'check' | 'compute' | 'reset', loopIndex?: number) {
  if (!session.ready) await warm()
  if (!session.ready) return
  state.value = 'running'
  error.value = ''
  nativeOperation.value = ''
  const request = client.startProject({ ...session.envelope(action, groupEditor.sidecar()), ...(loopIndex === undefined ? {} : { loopIndex }) })
  activeRequestId.value = request.requestId
  try {
    const response = await request.promise
    if (activeRequestId.value !== request.requestId) return
    const outcome = session.commit(response)
    if (!outcome.committed) {
      error.value = `Ignored ${outcome.reason} response for project revision ${response.revision}`
      state.value = 'stale'
      return undefined
    }
    if (response.result) {
      result.value = response.result
      workerId.value = response.result.workerId
      committedResultRevision.value = session.revision
      runs.value++
    } else if (action === 'reset') {
      committedResultRevision.value = -1
      result.value = undefined
    }
    sessionVersion.value++
    state.value = 'complete'
    return response
  } catch (reason) {
    if (activeRequestId.value !== request.requestId || cancelledState()) return
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
    return undefined
  } finally {
    if (activeRequestId.value === request.requestId && state.value === 'running') state.value = 'ready'
  }
}

function cancelledState() {
  return state.value === 'cancelled'
}

function finiteLoopValues(database: string): Record<string, number> {
  const finite: Record<string, number> = {}
  for (const [name, value] of Object.entries(onelabLoopValues(database))) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`loop parameter ${name} has no finite scalar value`)
    finite[name] = value
  }
  return finite
}

async function runLoop() {
  if (!session.ready) await warm()
  if (!session.ready) return
  loopCancelled = false
  loopRunning.value = true
  try {
    if (!loopTotal.value || loopHistory.value.length === loopTotal.value) {
      state.value = 'running'
      const request = client.startLoopControl('initialize', session.envelope('check', groupEditor.sidecar()))
      activeRequestId.value = request.requestId
      const initialized = await request.promise
      session.restore(initialized.database)
      loopHistory.value = []
      loopProgress.value = 0
      loopTotal.value = initialized.total ?? 0
      if (!loopTotal.value) throw new Error('native ONELAB loop returned no points')
      sessionVersion.value++
    }
    for (let index = loopHistory.value.length; index < loopTotal.value; index++) {
      if (loopCancelled) break
      committedResultRevision.value = -1
      sessionVersion.value++
      const response = await execute('compute', index)
      if (!response?.result || loopCancelled) break
      loopHistory.value.push({ index, values: finiteLoopValues(session.database), database: session.database, outputs: onelabOutputs(session.database) })
      loopProgress.value = loopHistory.value.length
      if (loopHistory.value.length < loopTotal.value) {
        state.value = 'running'
        const request = client.startLoopControl('increment', session.envelope('check', groupEditor.sidecar()))
        activeRequestId.value = request.requestId
        const incremented = await request.promise
        if (!incremented.hasNext) throw new Error(`native ONELAB loop ended after ${loopHistory.value.length} of ${loopTotal.value} points`)
        session.restore(incremented.database)
        sessionVersion.value++
      }
    }
  } catch (reason) {
    if (!loopCancelled) {
      error.value = reason instanceof Error ? reason.message : String(reason)
      state.value = 'error'
    }
  } finally {
    loopRunning.value = false
    if (!loopCancelled && state.value === 'running') state.value = 'complete'
  }
}

function editParameter(parameter: OnelabParameter, raw: string) {
  if (state.value === 'running') return
  session.edit(parameter.name, parameter.type === 'number' ? Number(raw) : raw)
  committedResultRevision.value = -1
  sessionVersion.value++
}

function editFromEvent(parameter: OnelabParameter, event: Event) {
  editParameter(parameter, (event.target as HTMLInputElement | HTMLSelectElement).value)
}

function choiceLabel(parameter: Extract<OnelabParameter, { type: 'number' }>, value: number) {
  return Object.entries(parameter.valueLabels ?? {}).find(([, candidate]) => candidate === value)?.[0] ?? String(value)
}

function cancel() {
  loopCancelled = true
  if (client.cancel(activeRequestId.value)) state.value = 'cancelled'
}

async function exportArchive(includeHistory: boolean) {
  if (!session.ready || !session.descriptor) return
  const bytes = await exportProjectArchive(session.descriptor, session.files, session.database, session.defaults, groupEditor.sidecar(), includeHistory ? loopHistory.value : undefined)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.opensimphy.project+json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${session.descriptor.id}.opensimphy.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function applyImportedProject(archive: Awaited<ReturnType<typeof importProjectArchive>>) {
  selectedProjectId.value = archive.descriptor.id
  session.open(archive.files, archive.defaults, archive.descriptor, archive.current)
  groupEditor = PhysicalGroupEditor.load(JSON.stringify(archive.physicalGroups), archive.descriptor.id)
  authoredGroups.value = groupEditor.sidecar().groups
  loopHistory.value = archive.history
  loopProgress.value = archive.history.length
  loopTotal.value = archive.history.length
  committedResultRevision.value = -1
  result.value = undefined
  sessionVersion.value++
  state.value = 'ready'
}

async function importArchive(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  try {
    const archive = await importProjectArchive(new Uint8Array(await file.arrayBuffer()))
    applyImportedProject(archive)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    ;(event.target as HTMLInputElement).value = ''
  }
}

async function saveOpfs() {
  if (!session.ready || !session.descriptor || projectPersistenceStatus() === 'unsupported') return
  try {
    const bytes = await exportProjectArchive(session.descriptor, session.files, session.database, session.defaults, groupEditor.sidecar(), loopHistory.value)
    await persistProjectArchive(session.descriptor.id, bytes)
    opfsStatus.value = 'saved'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    opfsStatus.value = 'error'
  }
}

async function loadOpfs() {
  if (projectPersistenceStatus() === 'unsupported') return
  try {
    const { project } = await loadPersistedProjectArchive(selectedProjectId.value)
    applyImportedProject(project)
    opfsStatus.value = 'loaded'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    opfsStatus.value = 'error'
  }
}

async function loadViewer() {
  viewerState.value = 'loading'
  viewerError.value = ''
  try {
    const [nextPreview, nextAuthoritative] = await Promise.all([meshstep.convertCube(), client.getCubeScene()])
    if (disposed) return
    const nextMatches = matchSurfaceSignatures(nextPreview.surfaceSignatures, nextAuthoritative.surfaceSignatures)
    if (!nextMatches || nextMatches.length !== 6) throw new Error('preview-to-authoritative surface correspondence is incomplete or ambiguous')
    preview.value = nextPreview
    authoritative.value = nextAuthoritative
    matches.value = nextMatches
    scene.value = nextPreview
    viewerState.value = 'ready'
  } catch (reason) {
    if (disposed) return
    viewerError.value = reason instanceof Error ? reason.message : String(reason)
    viewerState.value = 'error'
  }
}

async function loadRenderingTruth() {
  viewerState.value = 'loading'
  viewerError.value = ''
  try {
    scene.value = await client.getRenderingScene()
    preview.value = undefined
    authoritative.value = scene.value
    matches.value = undefined
    viewerState.value = 'ready'
  } catch (reason) {
    viewerError.value = reason instanceof Error ? reason.message : String(reason)
    viewerState.value = 'error'
  }
}

function selectSurface(selection: SceneSelection) {
  lastSelection.value = selection
  if (scene.value?.source === 'meshstep-preview') {
    selectedPreviewKey.value = selection.sourceKey
    authoritativeSelection.value = undefined
  } else {
    authoritativeSelection.value = selection.sourceKey
    authoritativeSelectionDimension.value = selection.sourceDimension
  }
}

function handoffSelection() {
  const match = matches.value?.find(({ previewKey }) => previewKey === selectedPreviewKey.value)
  if (!match || !authoritative.value) return
  authoritativeSelection.value = match.authoritativeKey
  scene.value = authoritative.value
}

function showPreview() {
  if (preview.value) scene.value = preview.value
}

onBeforeUnmount(() => { disposed = true; removeNativeListener(); meshstep.dispose(); client.dispose() })
</script>

<template lang="pug">
section.onelab-lab.view
  header.section-heading
    p.eyebrow LAB / ONELAB PHASE 5
    h1 Browser ONELAB workbench
    p Parser-native Gmsh/GetDP parameters drive a reconstructible check, remesh, solve and post-process flow.
  .simulation-caveat(role="note")
    strong Arbitrary STEP projects are not yet wired to solver execution.
    span STEP remains a meshStep preview. Simulation-bound selections use the separately meshed authoritative Gmsh surface.
  section.viewer-workbench
    .viewer-heading
      div
        p.eyebrow PHASE 1 / ENGINEERING VIEWER
        h2 STEP preview / Gmsh authority
      .onelab-actions
        button.text-button(type="button" data-testid="viewer-load" @click="loadViewer" :disabled="viewerState === 'loading'") Load locked cube pair
        button.text-button(type="button" data-testid="rendering-truth-load" @click="loadRenderingTruth" :disabled="viewerState === 'loading'") Load Gmsh field/displacement truth
    p(data-testid="viewer-state" :data-state="viewerState") Viewer: {{ viewerState }}
    p.inline-error(v-if="viewerError" role="alert") {{ viewerError }}
    template(v-if="scene")
      .viewer-status
        span(data-testid="viewer-source") {{ scene.source }}
        span(data-testid="viewer-matches") {{ matches?.length ?? 0 }} unique surface matches
        span(data-testid="viewer-selection") Preview {{ selectedPreviewKey ?? 'none' }} / Gmsh {{ authoritativeSelection ?? 'none' }}
      output.sr-only(data-testid="viewer-preview-summary") {{ preview ? JSON.stringify(summarizeScene(preview)) : '' }}
      output.sr-only(data-testid="viewer-authoritative-summary") {{ authoritative ? JSON.stringify(summarizeScene(authoritative)) : '' }}
      output.sr-only(data-testid="viewer-correspondence") {{ JSON.stringify(matches?.map(match => ({ match, preview: preview?.surfaceSignatures.find(signature => signature.sourceKey === match.previewKey), authoritative: authoritative?.surfaceSignatures.find(signature => signature.sourceKey === match.authoritativeKey) }))) }}
      output.sr-only(data-testid="viewer-selection-detail") {{ JSON.stringify(lastSelection) }}
      SimulationSceneHost(:scene="scene" @select="selectSurface")
      .viewer-handoff
        button.text-button(type="button" data-testid="viewer-preview" @click="showPreview" :disabled="!preview") Show STEP preview
        button.text-button(type="button" data-testid="viewer-handoff" @click="handoffSelection" :disabled="selectedPreviewKey === undefined || !matches") Use selected Gmsh surface
  label.onelab-project
    span Project fixture
    select(data-testid="onelab-project" :value="selectedProjectId" @change="selectProject" :disabled="state === 'running' || state === 'warming'")
      option(v-for="project in solverProjects" :key="project.id" :value="project.id") {{ project.title }}
  .onelab-actions
    button(type="button" data-testid="onelab-warm" @click="warm" :disabled="state === 'warming' || state === 'running'") Warm simulation assets
    button(type="button" data-testid="onelab-check" @click="execute('check')" :disabled="state === 'warming' || state === 'running'") Check metadata
    button(type="button" data-testid="onelab-reset" @click="execute('reset')" :disabled="state === 'warming' || state === 'running'") Reset defaults
    button(type="button" data-testid="onelab-solve" @click="solve" :disabled="state === 'warming' || state === 'running'") Compute
    button(type="button" data-testid="onelab-loop" @click="runLoop" :disabled="state === 'warming' || state === 'running' || loopRunning") {{ loopHistory.length && loopHistory.length < loopTotal ? 'Resume loop' : 'Run bounded loop' }}
    button(type="button" data-testid="onelab-cancel" @click="cancel" :disabled="state !== 'running'") Cancel worker
    button(type="button" data-testid="project-export" @click="exportArchive(false)" :disabled="!session.ready") Export project
    button(type="button" data-testid="project-export-history" @click="exportArchive(true)" :disabled="!session.ready") Export with history
    label.text-button Project import
      input.sr-only(type="file" accept="application/json,.json" data-testid="project-import" @change="importArchive")
    button(type="button" data-testid="project-opfs-save" @click="saveOpfs" :disabled="!session.ready || opfsStatus === 'unsupported'") Save project in browser
    button(type="button" data-testid="project-opfs-load" @click="loadOpfs" :disabled="opfsStatus === 'unsupported'") Load browser project
    output(data-testid="project-opfs-status" :data-status="opfsStatus") OPFS: {{ opfsStatus }}
  section.onelab-loop-status(data-testid="onelab-loop-status" :data-running="loopRunning")
    progress(:max="loopTotal || 1" :value="loopProgress")
    span {{ loopProgress }} / {{ loopTotal }} committed points
    output.sr-only(data-testid="onelab-loop-history") {{ JSON.stringify(loopHistory) }}
  section.onelab-parameters(v-if="parameters.length" data-testid="onelab-parameters")
    label.onelab-parameter(
      v-for="parameter in parameters"
      v-show="parameter.visible"
      :key="parameter.name"
      :class="{ 'is-changed': parameterChanged(parameter) > 0, 'is-readonly': parameter.readOnly }"
      :data-testid="`parameter-${parameter.name.split('/').at(-1)?.toLowerCase().replaceAll(' ', '-')}`"
      :data-name="parameter.name"
      :data-changed="parameterChanged(parameter)"
    )
      span {{ parameter.label ?? parameter.name }}
      select(
        v-if="parameter.type === 'number' && parameter.choices?.length"
        :value="parameter.values[0]"
        :disabled="parameter.readOnly || state === 'running'"
        @change="editFromEvent(parameter, $event)"
      )
        option(v-for="choice in parameter.choices" :key="choice" :value="choice") {{ choiceLabel(parameter, choice) }}
      select(
        v-else-if="parameter.type === 'string' && parameter.choices?.length"
        :value="parameter.values[0]"
        :disabled="parameter.readOnly || state === 'running'"
        @change="editFromEvent(parameter, $event)"
      )
        option(v-for="choice in parameter.choices" :key="choice" :value="choice") {{ choice }}
      input(
        v-else-if="parameter.type === 'number'"
        type="number"
        :value="parameter.values[0]"
        :min="parameter.min"
        :max="parameter.max"
        :step="parameter.step || 'any'"
        :readonly="parameter.readOnly"
        :disabled="state === 'running'"
        @change="editFromEvent(parameter, $event)"
      )
      input(
        v-else
        type="text"
        :value="parameter.values[0]"
        :readonly="parameter.readOnly"
        :disabled="state === 'running'"
        @change="editFromEvent(parameter, $event)"
      )
      small(v-if="parameter.help") {{ parameter.help }}
  p(data-testid="onelab-state" :data-state="state") State: {{ state }}
  output.sr-only(data-testid="onelab-database") {{ session.database }}
  p(data-testid="onelab-worker" :data-worker-id="workerId" :data-request-id="activeRequestId" :data-native-operation="nativeOperation") Worker: {{ workerId }} / request {{ activeRequestId }} / {{ nativeOperation }}
  p.system-error(v-if="error" role="alert") {{ error }}
  section.viewer-workbench(v-if="displayedResult?.scene" data-testid="result-viewer")
    .viewer-heading
      div
        p.eyebrow PHASE 3 / MAPPED RESULTS
        h2 Potential / electric field
      span {{ displayedResult.scene.fields.length }} mapped fields
    SimulationSceneHost(:scene="displayedResult.scene" @select="selectSurface")
    .physical-group-editor(data-testid="physical-group-editor")
      output.sr-only(data-testid="physical-group-selection") {{ authoritativeSelection ?? '' }}
      select(data-testid="physical-group-entity" aria-label="Authoritative entity" @change="selectAuthoritativeEntity")
        option(value="") Select entity
        option(v-for="entity in selectableEntities" :key="`${entity.dimension}:${entity.tag}`" :value="`${entity.dimension}:${entity.tag}`") {{ entity.dimension }}D / {{ entity.tag }}
      input(v-model="groupName" data-testid="physical-group-name" aria-label="Physical group name")
      select(v-model="selectedGroupId" data-testid="physical-group-select" aria-label="Authored physical group")
        option(value="") Select group
        option(v-for="group in authoredGroups" :key="group.id" :value="group.id") {{ group.name }} / {{ group.entityTags.join(',') }}
      button(type="button" data-testid="physical-group-add" @click="addPhysicalGroup" :disabled="authoritativeSelection === undefined") Add
      button(type="button" data-testid="physical-group-rename" @click="renamePhysicalGroup" :disabled="!selectedGroupId") Rename
      button(type="button" data-testid="physical-group-membership" @click="replacePhysicalGroupMembership" :disabled="!selectedGroupId || authoritativeSelection === undefined") Replace membership
      button(type="button" data-testid="physical-group-delete" @click="deletePhysicalGroup" :disabled="!selectedGroupId") Delete
      button(type="button" data-testid="physical-group-reset" @click="resetPhysicalGroups") Reset
      output.sr-only(data-testid="physical-group-sidecar") {{ JSON.stringify(groupEditor.sidecar()) }}
    output.sr-only(data-testid="mapped-field-summary") {{ JSON.stringify(mappedSummary) }}
    output.sr-only(data-testid="mapped-scene-summary") {{ JSON.stringify(summarizeScene(displayedResult.scene)) }}
    output.sr-only(data-testid="mapped-spatial-probes") {{ JSON.stringify(spatialProbes) }}
    output.sr-only(data-testid="mapped-export-summary") {{ JSON.stringify(exportSummary) }}
    output.sr-only(data-testid="mapped-selection-detail") {{ JSON.stringify(lastSelection) }}
  dl.onelab-result(v-if="displayedResult" data-testid="onelab-result")
    dt Runs
    dd(data-testid="onelab-runs") {{ runs }}
    dt Mesh
    dd(data-testid="onelab-mesh") {{ displayedResult?.nodes }} nodes / {{ displayedResult?.elements }} elements / {{ displayedResult?.mshBytes }} bytes / {{ displayedResult?.meshSha256 }}
    dt MSH physical groups
    dd(data-testid="onelab-msh-groups") {{ JSON.stringify({ names: displayedResult?.meshPhysicalNames, tags: displayedResult?.meshPhysicalTags }) }}
    dt Degrees of freedom
    dd(data-testid="onelab-dofs") {{ displayedResult?.degreesOfFreedom }}
    dt Final PETSc residual
    dd(data-testid="onelab-residual") {{ displayedResult?.residual }}
    dt Initial PETSc residual
    dd(data-testid="onelab-initial-residual") {{ displayedResult?.initialResidual }}
    dt Structured convergence
    dd(data-testid="onelab-convergence") {{ JSON.stringify(displayedResult?.convergence) }}
    dt Dynamic outputs
    dd(data-testid="onelab-outputs") {{ JSON.stringify(displayedResult?.outputs) }}
    dt Resource footprint
    dd(data-testid="onelab-resources") {{ JSON.stringify({ memoryBytes: displayedResult?.memoryBytes, snapshotBytes: displayedResult?.snapshotBytes, loadedPartitions: displayedResult?.loadedPartitions, ...displayedResult?.resourceAudit, historyPoints: loopHistory.length, historyBytes: JSON.stringify(loopHistory).length }) }}
    dt Native view probes
    dd(data-testid="onelab-native-probes") {{ JSON.stringify(displayedResult?.nativeProbes) }}
    dt Complex representation probes
    dd(data-testid="onelab-complex-probes") {{ JSON.stringify(displayedResult?.complexProbes) }}
    dt Solver parameters
    dd(data-testid="onelab-solver-parameters") {{ JSON.stringify(displayedResult?.parameters) }}
    dt Deterministic samples
    dd(data-testid="onelab-samples") {{ JSON.stringify(displayedResult?.samples) }}
    dt Potential
    dd(data-testid="onelab-scalar") {{ displayedResult ? JSON.stringify(summarizeView(displayedResult.scalar)) : '' }}
    dt Electric field magnitude
    dd(data-testid="onelab-vector") {{ displayedResult ? JSON.stringify(summarizeView(displayedResult.vector)) : '' }}
</template>
