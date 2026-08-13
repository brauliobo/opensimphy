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
import { MeshstepClient } from '../simulation/viewer-client'

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
const viewerError = ref('')
let disposed = false
const parameters = computed(() => {
  sessionVersion.value
  return session.ready ? parseOnelab(session.database).onelab.parameters.filter(({ name }) => name.startsWith('Parameters/')) : []
})
const displayedResult = computed(() => committedResultRevision.value === session.revision ? session.lastResult : undefined)
const removeNativeListener = client.onEnteredNative((event) => {
  if (event.detail.requestId !== activeRequestId.value) return
  workerId.value = event.detail.workerId
  nativeOperation.value = event.detail.operation
})

async function warm() {
  state.value = 'warming'
  error.value = ''
  try {
    await navigator.serviceWorker?.ready
    await client.warm()
    if (!session.ready) {
      const project = await client.openMicrostrip()
      session.open(project.files, project.defaults)
      sessionVersion.value++
    }
    state.value = 'ready'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  }
}

async function solve() {
  await execute('compute')
}

async function execute(action: 'check' | 'compute' | 'reset') {
  if (!session.ready) await warm()
  if (!session.ready) return
  state.value = 'running'
  error.value = ''
  nativeOperation.value = ''
  const request = client.startProject(session.envelope(action))
  activeRequestId.value = request.requestId
  try {
    const response = await request.promise
    if (activeRequestId.value !== request.requestId) return
    const outcome = session.commit(response)
    if (!outcome.committed) {
      error.value = `Ignored ${outcome.reason} response for project revision ${response.revision}`
      state.value = 'stale'
      return
    }
    sessionVersion.value++
    if (response.result) {
      result.value = response.result
      workerId.value = response.result.workerId
      committedResultRevision.value = session.revision
      runs.value++
    } else if (action === 'reset') {
      committedResultRevision.value = -1
      result.value = undefined
    }
    state.value = 'complete'
  } catch (reason) {
    if (activeRequestId.value !== request.requestId || state.value === 'cancelled') return
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  } finally {
    if (activeRequestId.value === request.requestId && state.value === 'running') state.value = 'ready'
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
  if (client.cancel(activeRequestId.value)) state.value = 'cancelled'
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

function selectSurface(selection: SceneSelection) {
  if (scene.value?.source === 'meshstep-preview') {
    selectedPreviewKey.value = selection.sourceKey
    authoritativeSelection.value = undefined
  } else {
    authoritativeSelection.value = selection.sourceKey
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
    p.eyebrow LAB / ONELAB PHASE 2
    h1 Browser ONELAB workbench
    p Parser-native Gmsh/GetDP parameters drive a reconstructible check, remesh, solve and post-process flow.
  .simulation-caveat(role="note")
    strong Arbitrary STEP simulation unavailable until OCC.
    span STEP is a meshStep preview only. Simulation-bound selections always switch to the authoritative built-in-kernel Gmsh surface.
  section.viewer-workbench
    .viewer-heading
      div
        p.eyebrow PHASE 1 / ENGINEERING VIEWER
        h2 STEP preview / Gmsh authority
      button.text-button(type="button" data-testid="viewer-load" @click="loadViewer" :disabled="viewerState === 'loading'") Load locked cube pair
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
      SimulationSceneHost(:scene="scene" @select="selectSurface")
      .viewer-handoff
        button.text-button(type="button" data-testid="viewer-preview" @click="showPreview" :disabled="!preview") Show STEP preview
        button.text-button(type="button" data-testid="viewer-handoff" @click="handoffSelection" :disabled="selectedPreviewKey === undefined || !matches") Use selected Gmsh surface
  .onelab-actions
    button(type="button" data-testid="onelab-warm" @click="warm" :disabled="state === 'warming' || state === 'running'") Warm simulation assets
    button(type="button" data-testid="onelab-check" @click="execute('check')" :disabled="state === 'warming' || state === 'running'") Check metadata
    button(type="button" data-testid="onelab-reset" @click="execute('reset')" :disabled="state === 'warming' || state === 'running'") Reset defaults
    button(type="button" data-testid="onelab-solve" @click="solve" :disabled="state === 'warming' || state === 'running'") Compute
    button(type="button" data-testid="onelab-cancel" @click="cancel" :disabled="state !== 'running'") Cancel worker
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
  p(data-testid="onelab-worker" :data-worker-id="workerId" :data-request-id="activeRequestId" :data-native-operation="nativeOperation") Worker: {{ workerId }} / request {{ activeRequestId }} / {{ nativeOperation }}
  p.system-error(v-if="error" role="alert") {{ error }}
  dl.onelab-result(v-if="displayedResult" data-testid="onelab-result")
    dt Runs
    dd(data-testid="onelab-runs") {{ runs }}
    dt Mesh
    dd(data-testid="onelab-mesh") {{ displayedResult?.nodes }} nodes / {{ displayedResult?.elements }} elements / {{ displayedResult?.mshBytes }} bytes / {{ displayedResult?.meshSha256 }}
    dt Degrees of freedom
    dd(data-testid="onelab-dofs") {{ displayedResult?.degreesOfFreedom }}
    dt Final PETSc residual
    dd(data-testid="onelab-residual") {{ displayedResult?.residual }}
    dt Initial PETSc residual
    dd(data-testid="onelab-initial-residual") {{ displayedResult?.initialResidual }}
    dt Deterministic samples
    dd(data-testid="onelab-samples") {{ JSON.stringify(displayedResult?.samples) }}
    dt Potential
    dd(data-testid="onelab-scalar") {{ displayedResult ? JSON.stringify(summarizeView(displayedResult.scalar)) : '' }}
    dt Electric field magnitude
    dd(data-testid="onelab-vector") {{ displayedResult ? JSON.stringify(summarizeView(displayedResult.vector)) : '' }}
</template>
