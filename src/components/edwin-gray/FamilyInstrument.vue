<script setup lang="ts">
import { GRAY_MOTOR_IDS, GRAY_MOTORS, type GrayFullMotorResult } from '../../edwin-gray/edwinGrayEngine'
import { grayEvidenceRecord } from '../../edwin-gray/edwinGrayEvidence'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth; result: Readonly<GrayFullMotorResult> }>()
const recoveryEvidence = grayEvidenceRecord('gray-caption-purple-recovery-coils')
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-family-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 05 / family and evidence
    h3 Keep machine identity and evidence scope attached
    p The family table is catalog evidence, not six fresh simulations. Only the selected row carries the unified worker result.
  .quantum-result(data-testid="gray-family-result")
    p.gray-status(role="status" aria-live="polite") Worker result belongs to {{ result.motor.label }} only. Other rows remain descriptive.
    .gray-table-scroll.gray-table-scroll--wide
      table
        caption Gray prototype family evidence; selected result identified explicitly
        thead
          tr
            th(scope="col") Machine
            th(scope="col") Year
            th(scope="col") Designer
            th(scope="col") Recovery evidence
            th(scope="col") Result scope
        tbody
          tr(v-for="id in GRAY_MOTOR_IDS" :key="id" :data-motor="id")
            td {{ GRAY_MOTORS[id].label }}
            td {{ GRAY_MOTORS[id].year }}
            td {{ GRAY_MOTORS[id].designer }}
            td {{ GRAY_MOTORS[id].hasRecovery ? 'source-described path' : 'none in catalog row' }}
            td {{ result.input.machineContractId === `edwin-gray-${id}` ? `${result.completedEventCount} worker events` : 'not evaluated' }}
    section.gray-findings(data-testid="gray-structured-findings")
      h4 Structured findings
      dl
        div(v-for="finding in result.findings" :key="finding.code")
          dt {{ finding.code }}
          dd {{ finding.statement }}
        div
          dt validatesTheory
          dd validatesTheory: {{ result.validatesTheory }}
    details.gray-technical(v-if="depth === 'technical'" open)
      summary Technical provenance disclosure
      p {{ result.provenance.eventSchedule }}
      p {{ result.provenance.originalContactRule }}
      p Evidence boundary: {{ recoveryEvidence.text }} {{ recoveryEvidence.implications[1] }}
</template>
