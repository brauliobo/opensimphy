<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { awesomePhysicsDefaultInput } from '../../awesomePhysics/defaultInputs'
import { isAwesomePhysicsJsonValue, type AwesomePhysicsJsonValue } from '../../awesomePhysics/workers/protocol'
import type { AwesomePhysicsSimulationDescriptorV1 } from '../../types/awesomePhysics'

const props = defineProps<{
  descriptor: AwesomePhysicsSimulationDescriptorV1
}>()

type RunStatus = 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed'

const inputText = ref('')
const status = ref<RunStatus>('idle')
const progress = ref(0)
const error = ref('')
const resultText = ref('')
const activeController = ref<AbortController | null>(null)
const requestSequence = ref(0)
let runGeneration = 0

const defaultInput = computed(() => awesomePhysicsDefaultInput(props.descriptor.adapterId ?? ''))
const hasDefaultInput = computed(() => defaultInput.value !== null)
const canRunDescriptor = computed(() => Boolean(
  props.descriptor.availability === 'available'
  && props.descriptor.runnable
  && props.descriptor.adapterId
  && props.descriptor.capability !== 'archive-reference'
  && props.descriptor.execution !== 'artifact'
  && props.descriptor.execution !== 'reference'
  && !props.descriptor.executionOptions.includes('wasm-candidate'),
))
const canRun = computed(() => canRunDescriptor.value && hasDefaultInput.value)
const isRunning = computed(() => activeController.value !== null)
const statusLabel = computed(() => status.value.replaceAll('-', ' '))

function resetInputText(): void {
  inputText.value = defaultInput.value === null ? '' : JSON.stringify(defaultInput.value, null, 2)
}

function resetRunState(): void {
  inputText.value = defaultInput.value === null ? '' : JSON.stringify(defaultInput.value, null, 2)
  status.value = 'idle'
  progress.value = 0
  error.value = ''
  resultText.value = ''
}

function abortActiveRun(): void {
  runGeneration += 1
  activeController.value?.abort()
  activeController.value = null
}

function reset(): void {
  abortActiveRun()
  resetRunState()
}

function cancel(): void {
  if (!activeController.value) return
  abortActiveRun()
  status.value = 'cancelled'
  progress.value = 0
  error.value = ''
}

function isAbortReason(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError'
    || reason instanceof Error && reason.name === 'AbortError'
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function parseInput(): AwesomePhysicsJsonValue | null {
  try {
    const parsed: unknown = JSON.parse(inputText.value)
    if (!isAwesomePhysicsJsonValue(parsed)) throw new TypeError('Input JSON is not safe to send to the worker.')
    return parsed
  } catch (reason) {
    error.value = reasonMessage(reason)
    status.value = 'failed'
    return null
  }
}

function requestId(): string {
  requestSequence.value += 1
  return `awesome-run-${requestSequence.value}`
}

async function run(): Promise<void> {
  if (isRunning.value) return
  error.value = ''
  resultText.value = ''
  progress.value = 0
  if (!canRunDescriptor.value) {
    error.value = 'This descriptor is not eligible for a Run control.'
    status.value = 'failed'
    return
  }
  if (!canRun.value || !props.descriptor.adapterId) {
    error.value = 'No typed default input is registered for this available adapter.'
    status.value = 'failed'
    return
  }

  const input = parseInput()
  if (input === null) return

  const controller = new AbortController()
  const generation = ++runGeneration
  activeController.value = controller
  status.value = 'starting'

  try {
    // The runner import is the boundary that can create the Awesome Physics worker.
    const { runAwesomePhysicsInWorker } = await import('../../awesomePhysics/workers/runInWorker')
    if (generation !== runGeneration || controller.signal.aborted) return

    const result = await runAwesomePhysicsInWorker<AwesomePhysicsJsonValue, AwesomePhysicsJsonValue>({
      type: 'run',
      requestId: requestId(),
      adapterId: props.descriptor.adapterId,
      descriptor: structuredClone(toRaw(props.descriptor)),
      input,
    }, {
      signal: controller.signal,
      timeoutMs: props.descriptor.limits.maxWorkerTimeMs,
      onProgress(value) {
        if (generation !== runGeneration) return
        progress.value = value
        status.value = value >= 100 ? 'completed' : value > 0 ? 'running' : 'starting'
      },
    })
    if (generation !== runGeneration) return
    resultText.value = JSON.stringify(result, null, 2)
    progress.value = 100
    status.value = 'completed'
  } catch (reason) {
    if (generation !== runGeneration) return
    if (controller.signal.aborted || isAbortReason(reason)) {
      status.value = 'cancelled'
      progress.value = 0
      error.value = ''
    } else {
      status.value = 'failed'
      error.value = reasonMessage(reason)
    }
  } finally {
    if (generation === runGeneration) activeController.value = null
  }
}

watch(() => props.descriptor.id, () => {
  abortActiveRun()
  resetRunState()
}, { immediate: true })

onBeforeUnmount(abortActiveRun)
</script>

<template lang="pug">
section.awesome-run-panel(aria-labelledby="awesome-run-panel-title" data-testid="awesome-physics-run-panel")
  header.awesome-run-heading
    div
      p.eyebrow Bounded worker dispatch
      h2#awesome-run-panel-title Run this adapter
    span.status-chip(:class="status === 'completed' ? 'is-pass' : status === 'failed' ? 'is-fail' : 'is-pending'") {{ statusLabel }}

  p.awesome-run-boundary
    | This invokes the registered adapter through the Awesome Physics worker boundary with the selected JSON input. It is a bounded execution record, not theory validation or empirical evidence.

  p.awesome-run-default-error(v-if="!canRunDescriptor" role="alert" data-testid="awesome-physics-run-gate")
    | {{ descriptor.availabilityReason }} Run is not exposed for this descriptor.
  p.awesome-run-default-error(v-else-if="!hasDefaultInput" role="alert" data-testid="awesome-physics-default-error")
    | No typed default input is registered for adapter #[code {{ descriptor.adapterId ?? 'missing adapter ID' }}]. Run is disabled.

  label.field.awesome-run-input(for="awesome-physics-inputs")
    span Complete input JSON
    textarea#awesome-physics-inputs(
      v-model="inputText"
      data-testid="awesome-physics-inputs"
      rows="15"
      spellcheck="false"
      :disabled="isRunning || !canRun"
      aria-describedby="awesome-run-input-note"
    )
  p#awesome-run-input-note.awesome-run-input-note Defaults are typed per enabled adapter. Edit only JSON values accepted by the descriptor's input contract.

  .awesome-run-actions
    button.awesome-primary-action(
      v-if="canRunDescriptor"
      type="button"
      data-testid="awesome-physics-run"
      :disabled="isRunning || !canRun"
      @click="run"
    ) Run bounded adapter
    button.awesome-secondary-action(
      v-if="isRunning"
      type="button"
      data-testid="awesome-physics-cancel"
      @click="cancel"
    ) Cancel
    button.awesome-secondary-action(
      type="button"
      data-testid="awesome-physics-reset"
      :disabled="isRunning"
      @click="reset"
    ) Reset

  .awesome-run-status(aria-live="polite" data-testid="awesome-physics-status")
    span Dispatch status
    strong {{ statusLabel }}
    span {{ progress }} / 100
  .awesome-run-progress(
    role="progressbar"
    aria-label="Awesome Physics worker progress"
    :aria-valuenow="progress"
    aria-valuemin="0"
    aria-valuemax="100"
    data-testid="awesome-physics-progress"
  )
    i(:style="{ width: `${progress}%` }")

  p.inline-error(v-if="error" role="alert" data-testid="awesome-physics-error") {{ error }}

  section.awesome-run-result(v-if="resultText" aria-labelledby="awesome-result-title" data-testid="awesome-physics-result")
    p.eyebrow Worker result / JSON-safe
    h3#awesome-result-title Result payload
    pre
      code {{ resultText }}
</template>
