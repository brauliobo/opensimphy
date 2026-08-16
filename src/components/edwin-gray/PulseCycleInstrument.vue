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
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-pulse-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 03 / event timeline
    h3 Inspect the canonical schedule without recomputing it
    p Every row belongs to the same completed run. Select or animate an event in the shared timeline above to move all instruments together.
  .quantum-result(data-testid="gray-pulse-result")
    p.gray-status(role="status" aria-live="polite" data-testid="gray-pulse-status") Event {{ (event?.eventIndex ?? 0) + 1 }}: {{ event?.quenchSucceeded ? 'arc quenched' : 'no successful quench' }} / phase {{ event?.phaseLabel }} / {{ event?.majorMinor }}.
    .gray-table-scroll.gray-table-scroll--wide
      table(data-testid="gray-event-timeline")
        caption Raw full-run event timeline
        thead
          tr
            th(scope="col") Event
            th(scope="col") Rev
            th(scope="col") Angle deg
            th(scope="col") Time ms
            th(scope="col") RPM before
            th(scope="col") Rule
            th(scope="col") Arc
        tbody
          tr(v-for="row in result.events" :key="row.eventIndex" :class="{ 'is-active': row.eventIndex === event?.eventIndex }")
            th(scope="row") {{ row.eventIndex + 1 }}
            td {{ row.revolution + 1 }}
            td {{ row.scheduledAbsoluteAngleDeg.toFixed(2) }}
            td {{ (row.timeSeconds * 1e3).toFixed(3) }}
            td {{ row.before.rpm.toFixed(2) }}
            td {{ row.contactRuleSatisfied ? 'pass' : 'blocked' }}
            td {{ row.after.arcState }}
    .gray-table-scroll
      table(data-testid="gray-mechanical-table")
        caption Raw run mechanical state
        tbody
          tr
            th(scope="row") Initial RPM
            td {{ result.initialState.rpm.toFixed(3) }}
          tr
            th(scope="row") Final RPM
            td {{ result.finalRpm.toFixed(3) }}
          tr
            th(scope="row") Final angle
            td {{ result.finalAngleDeg.toFixed(3) }} deg
          tr
            th(scope="row") Load work
            td {{ result.ledger.loadWorkJ.toExponential(4) }} J
          tr
            th(scope="row") Kinetic delta
            td {{ result.ledger.kineticEnergyChangeJ.toExponential(4) }} J
    details.gray-technical(v-if="depth === 'technical'" open)
      summary Technical event disclosure
      p Numerical method {{ result.numericalMethod }}; completed {{ result.completedEventCount }} of {{ result.scheduledEventCount }} scheduled events in {{ result.simulatedDurationSeconds.toExponential(4) }} s.
</template>
