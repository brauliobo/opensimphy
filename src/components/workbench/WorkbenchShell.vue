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

<template lang="pug">
article.workbench-shell(
  :aria-busy="running"
  :data-execution-mode="executionMode"
  :data-execution-status="status"
)
  header.workbench-header
    .workbench-title-block
      p.eyebrow Shared workbench
      component.workbench-instrument-title(:is="headingLevel") {{ title }}
    section.workbench-identity(aria-label="Instrument identity")
      component.workbench-section-title(:is="sectionHeadingLevel") Identity
      slot(name="identity")
        p {{ identity || 'Identity not supplied.' }}
    section.workbench-provenance(aria-label="Provenance summary")
      component.workbench-section-title(:is="sectionHeadingLevel") Provenance
      slot(name="provenance" :provenance="provenance")
        dl(v-if="provenance")
          div
            dt Source revision
            dd {{ provenance.sourceRevision }}
          div
            dt Method relationship
            dd {{ provenance.methodRelationship }}
          div
            dt Result status
            dd {{ provenance.resultStatus }}
        p(v-else) Provenance not supplied.
    section.workbench-conclusion(aria-label="Conclusion boundary" data-testid="workbench-conclusion")
      component.workbench-section-title(:is="sectionHeadingLevel") Conclusion boundary
      slot(name="conclusion")
        p {{ conclusion || 'No scientific conclusion has been supplied.' }}

  p.workbench-state-warning.inline-error(
    v-if="stateWarning"
    role="alert"
    data-testid="workbench-url-state-warning"
  ) {{ stateWarning }}

  .workbench-grid
    section.workbench-region.workbench-region-stage(aria-label="Scientific stage")
      slot(name="stage")
        p.workbench-empty No scientific stage supplied.

    section.workbench-region.workbench-region-essential(aria-label="Essential controls")
      component.workbench-section-title(:is="sectionHeadingLevel") Essential controls
      slot(name="essential-controls")
        p.workbench-empty No essential controls supplied.

    section.workbench-region.workbench-region-actions(aria-label="Execution and snapshot actions")
      .workbench-execution-actions
        button.workbench-primary-action(
          v-if="executionMode === 'manual' && status !== 'running' && status !== 'unavailable'"
          type="button"
          data-testid="workbench-run"
          @click="emit('run')"
        ) {{ labels.run }}
        button(
          v-if="executionMode === 'manual' && status === 'running'"
          type="button"
          data-testid="workbench-cancel"
          @click="emit('cancel')"
        ) {{ labels.cancel }}
        p.workbench-mode-status(
          v-if="executionMode !== 'manual'"
          data-testid="workbench-mode-status"
        ) {{ executionStatus }}
        button(type="button" data-testid="workbench-reset" @click="emit('reset')") {{ labels.reset }}

      .workbench-snapshot-actions
        div
          button(
            type="button"
            data-testid="workbench-save"
            :disabled="saveDisabled"
            :aria-describedby="saveDisabled ? `${shellId}-save-reason` : undefined"
            @click="emit('save')"
          ) {{ labels.save }}
          small(v-if="saveDisabled" :id="`${shellId}-save-reason`") {{ saveDisabledReason }}
        div
          button(
            type="button"
            data-testid="workbench-freeze"
            :disabled="freezeDisabled"
            :aria-describedby="freezeDisabled ? `${shellId}-freeze-reason` : undefined"
            @click="emit('freeze')"
          ) {{ labels.freeze }}
          small(v-if="freezeDisabled" :id="`${shellId}-freeze-reason`") {{ freezeDisabledReason }}
        div
          button(
            type="button"
            data-testid="workbench-clear-compare"
            :disabled="clearCompareDisabled"
            :aria-describedby="clearCompareDisabled ? `${shellId}-clear-reason` : undefined"
            @click="emit('clear-compare')"
          ) {{ labels['clear-compare'] }}
          small(v-if="clearCompareDisabled" :id="`${shellId}-clear-reason`") {{ clearCompareDisabledReason }}

      .workbench-execution-state
        p.workbench-live-status(role="status" aria-live="polite" aria-atomic="true") {{ executionStatus }}
        .workbench-progress(
          v-if="running"
          role="progressbar"
          aria-label="Execution progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress"
        )
          i(:style="{ width: `${progress}%` }")

      .workbench-action-errors(
        v-if="Object.keys(actionErrors).length"
        role="alert"
        aria-live="assertive"
      )
        p(v-for="(error, action) in actionErrors" :key="action" :data-action-error="action") {{ error }}

    section.workbench-region.workbench-region-findings(aria-label="Findings")
      component.workbench-section-title(:is="sectionHeadingLevel") Findings
      slot(name="findings")
        p.workbench-empty No finding has been evaluated.

    section.workbench-region.workbench-region-controls(aria-label="Full controls and method")
      component.workbench-section-title(:is="sectionHeadingLevel") Full controls
      slot(name="controls")
        p.workbench-empty No additional controls supplied.
      details.workbench-disclosure.workbench-method-disclosure
        summary Method details
        .workbench-disclosure-body
          slot(name="method")
            p.workbench-empty No additional method detail supplied.

    section.workbench-region.workbench-region-evidence(aria-label="Evidence details")
      details.workbench-disclosure
        summary Evidence and data
        .workbench-disclosure-body
          slot(name="evidence")
            p.workbench-empty No additional evidence supplied.

    section.workbench-region.workbench-region-raw(aria-label="Raw result")
      details.workbench-disclosure
        summary Raw result
        .workbench-disclosure-body
          slot(name="raw")
            p.workbench-empty No raw result supplied.
</template>
