<script setup lang="ts">
import { computed, useId } from 'vue'
import type {
  WorkbenchActionErrors,
  WorkbenchActionLabels,
  WorkbenchCapabilities,
  WorkbenchExecutionMode,
  WorkbenchExecutionStatus,
  WorkbenchProgress,
  WorkbenchProvenanceSummary,
  WorkbenchSnapshotCount,
} from '../../types/workbench'

const DEFAULT_LABELS: WorkbenchActionLabels = {
  run:             'Run',
  cancel:          'Cancel',
  reset:           'Reset',
  save:            'Save result',
  freeze:          'Freeze for compare',
  'clear-compare': 'Clear comparison',
}

const props = withDefaults(defineProps<{
  title: string
  identity?: string
  provenance?: WorkbenchProvenanceSummary
  conclusion?: string
  executionMode: WorkbenchExecutionMode
  status: WorkbenchExecutionStatus
  progress?: WorkbenchProgress
  capabilities?: WorkbenchCapabilities
  snapshotCount?: WorkbenchSnapshotCount
  hasResult?: boolean
  actionLabels?: Partial<WorkbenchActionLabels>
  actionErrors?: WorkbenchActionErrors
  executionMessage?: string
  unavailableReason?: string
  stateWarning?: string
  headingLevel?: 'h1' | 'h2' | 'h3'
}>(), {
  identity:          '',
  conclusion:        '',
  progress:          0,
  capabilities:      () => ({ save: false, compare: false }),
  snapshotCount:     0,
  actionLabels:      () => ({}),
  actionErrors:      () => ({}),
  executionMessage:  '',
  unavailableReason: '',
  stateWarning:      '',
  headingLevel:      'h1',
})

const emit = defineEmits<{
  run: []
  cancel: []
  reset: []
  save: []
  freeze: []
  'clear-compare': []
}>()

const shellId = useId()
const labels = computed(() => ({ ...DEFAULT_LABELS, ...props.actionLabels }))
const sectionHeadingLevel = computed(() => props.headingLevel === 'h1' ? 'h2' : props.headingLevel === 'h2' ? 'h3' : 'h4')
const progress = computed(() => Math.min(100, Math.max(0, Number.isFinite(props.progress) ? props.progress : 0)))
const resultAvailable = computed(() => props.hasResult ?? props.status === 'completed')
const running = computed(() => props.status === 'running')
const saveDisabled = computed(() => running.value || !props.capabilities.save || !resultAvailable.value)
const freezeDisabled = computed(() => (
  running.value || !props.capabilities.compare || !resultAvailable.value || props.snapshotCount === 2
))
const clearCompareDisabled = computed(() => !props.capabilities.compare || props.snapshotCount === 0)

const executionStatus = computed(() => {
  if (props.executionMessage) return props.executionMessage
  if (props.executionMode === 'unavailable') {
    return props.unavailableReason || 'Execution is unavailable for this workbench.'
  }
  if (props.executionMode === 'route-evaluated' && props.status === 'idle') {
    return 'This route evaluates the result from its current inputs.'
  }
  const statusText: Record<WorkbenchExecutionStatus, string> = {
    idle:        'Ready.',
    running:     `Running, ${progress.value}% complete.`,
    completed:   'Execution completed.',
    cancelled:   'Execution cancelled.',
    failed:      'Execution failed.',
    unavailable: props.unavailableReason || 'Execution is unavailable.',
  }
  return statusText[props.status]
})

const saveDisabledReason = computed(() => {
  if (!props.capabilities.save) return 'Saving is not available for this instrument.'
  if (!resultAvailable.value) return 'Run or evaluate the instrument before saving.'
  if (running.value) return 'Wait for execution to finish before saving.'
  return ''
})

const freezeDisabledReason = computed(() => {
  if (!props.capabilities.compare) return 'Comparison is not available for this instrument.'
  if (props.snapshotCount === 2) return 'The comparison pair already contains two snapshots.'
  if (!resultAvailable.value) return 'Run or evaluate the instrument before freezing a snapshot.'
  if (running.value) return 'Wait for execution to finish before freezing a snapshot.'
  return ''
})

const clearCompareDisabledReason = computed(() => {
  if (!props.capabilities.compare) return 'Comparison is not available for this instrument.'
  if (props.snapshotCount === 0) return 'There are no comparison snapshots to clear.'
  return ''
})
</script>

<template>
  <article
    class="workbench-shell"
    :aria-busy="running"
    :data-execution-mode="executionMode"
    :data-execution-status="status"
  >
    <header class="workbench-header">
      <div class="workbench-title-block">
        <p class="eyebrow">Shared workbench</p>
        <component :is="headingLevel" class="workbench-instrument-title">{{ title }}</component>
      </div>
      <section class="workbench-identity" aria-label="Instrument identity">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Identity</component>
        <slot name="identity">
          <p>{{ identity || 'Identity not supplied.' }}</p>
        </slot>
      </section>
      <section class="workbench-provenance" aria-label="Provenance summary">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Provenance</component>
        <slot name="provenance" :provenance="provenance">
          <dl v-if="provenance">
            <div>
              <dt>Source revision</dt>
              <dd>{{ provenance.sourceRevision }}</dd>
            </div>
            <div>
              <dt>Method relationship</dt>
              <dd>{{ provenance.methodRelationship }}</dd>
            </div>
            <div>
              <dt>Result status</dt>
              <dd>{{ provenance.resultStatus }}</dd>
            </div>
          </dl>
          <p v-else>Provenance not supplied.</p>
        </slot>
      </section>
      <section class="workbench-conclusion" aria-label="Conclusion boundary" data-testid="workbench-conclusion">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Conclusion boundary</component>
        <slot name="conclusion">
          <p>{{ conclusion || 'No scientific conclusion has been supplied.' }}</p>
        </slot>
      </section>
    </header>

    <p
      v-if="stateWarning"
      class="workbench-state-warning inline-error"
      role="alert"
      data-testid="workbench-url-state-warning"
    >
      {{ stateWarning }}
    </p>

    <div class="workbench-grid">
      <section class="workbench-region workbench-region-stage" aria-label="Scientific stage">
        <slot name="stage">
          <p class="workbench-empty">No scientific stage supplied.</p>
        </slot>
      </section>

      <section class="workbench-region workbench-region-essential" aria-label="Essential controls">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Essential controls</component>
        <slot name="essential-controls">
          <p class="workbench-empty">No essential controls supplied.</p>
        </slot>
      </section>

      <section class="workbench-region workbench-region-actions" aria-label="Execution and snapshot actions">
        <div class="workbench-execution-actions">
          <button
            v-if="executionMode === 'manual' && status !== 'running' && status !== 'unavailable'"
            class="workbench-primary-action"
            type="button"
            data-testid="workbench-run"
            @click="emit('run')"
          >
            {{ labels.run }}
          </button>
          <button
            v-if="executionMode === 'manual' && status === 'running'"
            type="button"
            data-testid="workbench-cancel"
            @click="emit('cancel')"
          >
            {{ labels.cancel }}
          </button>
          <p
            v-if="executionMode !== 'manual'"
            class="workbench-mode-status"
            data-testid="workbench-mode-status"
          >
            {{ executionStatus }}
          </p>
          <button type="button" data-testid="workbench-reset" @click="emit('reset')">
            {{ labels.reset }}
          </button>
        </div>

        <div class="workbench-snapshot-actions">
          <div>
            <button
              type="button"
              data-testid="workbench-save"
              :disabled="saveDisabled"
              :aria-describedby="saveDisabled ? `${shellId}-save-reason` : undefined"
              @click="emit('save')"
            >
              {{ labels.save }}
            </button>
            <small v-if="saveDisabled" :id="`${shellId}-save-reason`">{{ saveDisabledReason }}</small>
          </div>
          <div>
            <button
              type="button"
              data-testid="workbench-freeze"
              :disabled="freezeDisabled"
              :aria-describedby="freezeDisabled ? `${shellId}-freeze-reason` : undefined"
              @click="emit('freeze')"
            >
              {{ labels.freeze }}
            </button>
            <small v-if="freezeDisabled" :id="`${shellId}-freeze-reason`">{{ freezeDisabledReason }}</small>
          </div>
          <div>
            <button
              type="button"
              data-testid="workbench-clear-compare"
              :disabled="clearCompareDisabled"
              :aria-describedby="clearCompareDisabled ? `${shellId}-clear-reason` : undefined"
              @click="emit('clear-compare')"
            >
              {{ labels['clear-compare'] }}
            </button>
            <small v-if="clearCompareDisabled" :id="`${shellId}-clear-reason`">
              {{ clearCompareDisabledReason }}
            </small>
          </div>
        </div>

        <div class="workbench-execution-state">
          <p class="workbench-live-status" role="status" aria-live="polite" aria-atomic="true">
            {{ executionStatus }}
          </p>
          <div
            v-if="running"
            class="workbench-progress"
            role="progressbar"
            aria-label="Execution progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="progress"
          >
            <i :style="{ width: `${progress}%` }" />
          </div>
        </div>

        <div
          v-if="Object.keys(actionErrors).length"
          class="workbench-action-errors"
          role="alert"
          aria-live="assertive"
        >
          <p v-for="(error, action) in actionErrors" :key="action" :data-action-error="action">
            {{ error }}
          </p>
        </div>
      </section>

      <section class="workbench-region workbench-region-findings" aria-label="Findings">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Findings</component>
        <slot name="findings">
          <p class="workbench-empty">No finding has been evaluated.</p>
        </slot>
      </section>

      <section class="workbench-region workbench-region-controls" aria-label="Full controls and method">
        <component :is="sectionHeadingLevel" class="workbench-section-title">Full controls</component>
        <slot name="controls">
          <p class="workbench-empty">No additional controls supplied.</p>
        </slot>
        <details class="workbench-disclosure workbench-method-disclosure">
          <summary>Method details</summary>
          <div class="workbench-disclosure-body">
            <slot name="method">
              <p class="workbench-empty">No additional method detail supplied.</p>
            </slot>
          </div>
        </details>
      </section>

      <section class="workbench-region workbench-region-evidence" aria-label="Evidence details">
        <details class="workbench-disclosure">
          <summary>Evidence and data</summary>
          <div class="workbench-disclosure-body">
            <slot name="evidence">
              <p class="workbench-empty">No additional evidence supplied.</p>
            </slot>
          </div>
        </details>
      </section>

      <section class="workbench-region workbench-region-raw" aria-label="Raw result">
        <details class="workbench-disclosure">
          <summary>Raw result</summary>
          <div class="workbench-disclosure-body">
            <slot name="raw">
              <p class="workbench-empty">No raw result supplied.</p>
            </slot>
          </div>
        </details>
      </section>
    </div>
  </article>
</template>
