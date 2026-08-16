<script setup lang="ts">
import { computed } from 'vue'
import type { GrayFullMotorResult } from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{
  depth: ReadingDepth
  result: Readonly<GrayFullMotorResult>
  activeEventIndex: number
}>()
const event = computed(() => props.result.events[props.activeEventIndex] ?? props.result.events[0])
const formatJ = (value: number): string => value.toExponential(3)
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-circuit-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 02 / circuit
    h3 Follow the same event through charge, dump, coil, and recovery
    p The circuit state below is the before/after state stored on the active full-run event.
  .quantum-result(v-if="event" data-testid="gray-circuit-result")
    p.gray-status(role="status" aria-live="polite") {{ event.before.switchState }} → {{ event.after.switchState }} / arc {{ event.after.arcState }} / contact rule {{ event.contactRuleSatisfied ? 'satisfied' : 'not satisfied' }}.
    svg(viewBox="0 0 720 220" role="img" aria-label="Active event capacitor dump circuit")
      rect(x="20" y="70" width="90" height="80" fill="none" stroke="currentColor")
      text(x="32" y="116" fill="currentColor" font-size="13") source
      rect(x="150" y="40" width="90" height="50" fill="none" stroke="currentColor")
      text(x="160" y="70" fill="currentColor" font-size="12") holding C
      rect(x="150" y="130" width="90" height="50" fill="none" stroke="currentColor")
      text(x="160" y="160" fill="currentColor" font-size="12") dump bank
      rect(x="290" y="80" width="100" height="60" fill="none" stroke="currentColor")
      text(x="302" y="116" fill="currentColor" font-size="12") {{ event.after.switchState }}
      rect(x="440" y="80" width="100" height="60" fill="none" stroke="currentColor")
      text(x="452" y="116" fill="currentColor" font-size="12") active coil
      rect(x="590" y="80" width="100" height="60" fill="none" stroke="currentColor")
      text(x="602" y="116" fill="currentColor" font-size="12") recovery
      line(x1="110" y1="110" x2="150" y2="65" stroke="currentColor")
      line(x1="240" y1="65" x2="290" y2="110" stroke="currentColor")
      line(x1="240" y1="155" x2="290" y2="110" stroke="currentColor")
      line(x1="390" y1="110" x2="440" y2="110" stroke="currentColor")
      line(x1="540" y1="110" x2="590" y2="110" stroke="currentColor")
    .gray-table-scroll.gray-table-scroll--wide
      table(data-testid="gray-circuit-table")
        caption Raw active-event circuit state and transfer ledger, joules
        thead
          tr
            th(scope="col") State
            th(scope="col") Holding
            th(scope="col") Dump
            th(scope="col") Coil
            th(scope="col") Recovery
            th(scope="col") Current A
        tbody
          tr
            th(scope="row") Before
            td {{ formatJ(event.before.holdingCapacitorJ) }}
            td {{ formatJ(event.before.dumpBankJ) }}
            td {{ formatJ(event.before.activeCoilMagneticJ) }}
            td {{ formatJ(event.before.recoveryStorageJ) }}
            td {{ event.before.activeCoilCurrentA.toExponential(3) }}
          tr
            th(scope="row") After
            td {{ formatJ(event.after.holdingCapacitorJ) }}
            td {{ formatJ(event.after.dumpBankJ) }}
            td {{ formatJ(event.after.activeCoilMagneticJ) }}
            td {{ formatJ(event.after.recoveryStorageJ) }}
            td {{ event.after.activeCoilCurrentA.toExponential(3) }}
    details.gray-technical(v-if="depth === 'technical'" open)
      summary Technical circuit disclosure
      p Recovery branch: {{ event.recoveryBranch.topology }}. Transferred {{ formatJ(event.recoveryBranch.transferredJ) }} J from {{ formatJ(event.recoveryBranch.availableMagneticJ) }} J available magnetic energy.
</template>
