<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { OnelabClient } from '../simulation/client'
import { summarizeView } from '../simulation/reference'
import type { MicrostripResult } from '../simulation/types'

const client = new OnelabClient()
const state = ref<'idle' | 'warming' | 'ready' | 'running' | 'complete' | 'cancelled' | 'error'>('idle')
const error = ref('')
const result = ref<MicrostripResult>()
const runs = ref(0)
const workerId = ref('')
const nativeOperation = ref('')
const activeRequestId = ref('')
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

onBeforeUnmount(() => { removeNativeListener(); client.dispose() })
</script>

<template lang="pug">
section.onelab-lab
  header.section-heading
    p.eyebrow LAB / ONELAB PHASE 0
    h1 Browser microstrip proof
    p Serial Gmsh meshes the pinned upstream geometry; real-double GetDP/PETSc solves it and Gmsh extracts scalar and vector views.
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
