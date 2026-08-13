<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { OnelabClient } from '../simulation/client'
import { summarizeView } from '../simulation/reference'
import type { MicrostripResult } from '../simulation/types'
import SimulationSceneHost from '../components/SimulationSceneHost.vue'
import { matchSurfaceSignatures, summarizeScene, type SimulationScene, type SurfaceMatch } from '../simulation/scene'
import type { SceneSelection } from '../simulation/scene-host'
import { MeshstepClient } from '../simulation/viewer-client'

const client = new OnelabClient()
const meshstep = new MeshstepClient()
const state = ref<'idle' | 'warming' | 'ready' | 'running' | 'complete' | 'cancelled' | 'error'>('idle')
const error = ref('')
const result = ref<MicrostripResult>()
const runs = ref(0)
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
    state.value = 'ready'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  }
}

async function solve() {
  state.value = 'running'
  error.value = ''
  nativeOperation.value = ''
  const request = client.startMicrostrip()
  activeRequestId.value = request.requestId
  try {
    result.value = await request.promise
    if (activeRequestId.value !== request.requestId) return
    workerId.value = result.value.workerId
    runs.value++
    state.value = 'complete'
  } catch (reason) {
    if (activeRequestId.value !== request.requestId || state.value === 'cancelled') return
    error.value = reason instanceof Error ? reason.message : String(reason)
    state.value = 'error'
  }
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
    p.eyebrow LAB / ONELAB PHASE 0
    h1 Browser microstrip proof
    p Serial Gmsh meshes the pinned upstream geometry; real-double GetDP/PETSc solves it and Gmsh extracts scalar and vector views.
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
      output.sr-only(data-testid="viewer-preview-summary") {{ JSON.stringify(summarizeScene(preview!)) }}
      output.sr-only(data-testid="viewer-authoritative-summary") {{ JSON.stringify(summarizeScene(authoritative!)) }}
      output.sr-only(data-testid="viewer-correspondence") {{ JSON.stringify(matches?.map(match => ({ match, preview: preview?.surfaceSignatures.find(signature => signature.sourceKey === match.previewKey), authoritative: authoritative?.surfaceSignatures.find(signature => signature.sourceKey === match.authoritativeKey) }))) }}
      SimulationSceneHost(:scene="scene" @select="selectSurface")
      .viewer-handoff
        button.text-button(type="button" data-testid="viewer-preview" @click="showPreview" :disabled="!preview") Show STEP preview
        button.text-button(type="button" data-testid="viewer-handoff" @click="handoffSelection" :disabled="selectedPreviewKey === undefined || !matches") Use selected Gmsh surface
  .onelab-actions
    button(type="button" data-testid="onelab-warm" @click="warm" :disabled="state === 'warming' || state === 'running'") Warm simulation assets
    button(type="button" data-testid="onelab-solve" @click="solve" :disabled="state === 'warming' || state === 'running'") Mesh + solve + post-process
    button(type="button" data-testid="onelab-cancel" @click="cancel" :disabled="state !== 'running'") Cancel worker
  p(data-testid="onelab-state" :data-state="state") State: {{ state }}
  p(data-testid="onelab-worker" :data-worker-id="workerId" :data-request-id="activeRequestId" :data-native-operation="nativeOperation") Worker: {{ workerId }} / request {{ activeRequestId }} / {{ nativeOperation }}
  p.system-error(v-if="error" role="alert") {{ error }}
  dl.onelab-result(v-if="result" data-testid="onelab-result")
    dt Runs
    dd(data-testid="onelab-runs") {{ runs }}
    dt Mesh
    dd(data-testid="onelab-mesh") {{ result.nodes }} nodes / {{ result.elements }} elements / {{ result.mshBytes }} bytes
    dt Final PETSc residual
    dd(data-testid="onelab-residual") {{ result.residual }}
    dt Initial PETSc residual
    dd(data-testid="onelab-initial-residual") {{ result.initialResidual }}
    dt Deterministic samples
    dd(data-testid="onelab-samples") {{ JSON.stringify(result.samples) }}
    dt Potential
    dd(data-testid="onelab-scalar") {{ JSON.stringify(summarizeView(result.scalar)) }}
    dt Electric field magnitude
    dd(data-testid="onelab-vector") {{ JSON.stringify(summarizeView(result.vector)) }}
</template>
