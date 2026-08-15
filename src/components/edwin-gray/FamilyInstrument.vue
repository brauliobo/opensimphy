<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  evaluateGrayFamily,
  GRAY_PRESETS,
} from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth }>()

const chargeVoltageV = ref(5000)
const startRpm = ref(500)
const error = ref('')

const rows = computed(() => {
  try {
    error.value = ''
    const gold = GRAY_PRESETS.gold
    return evaluateGrayFamily({
      chargeVoltageV: chargeVoltageV.value,
      capacitanceF: gold.capacitanceF,
      startRpm: startRpm.value,
      quenchDeg: gold.quenchDeg,
      turns: gold.turns,
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return []
  }
})
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-family-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 05 / family
    h3 Compare later colored prototype evidence rows
    p Hold voltage, capacitance, speed, and turns fixed while comparing the source-described prototype rows. Recovery energy appears only on EMA4 and purple in this illustrative model; the comparison does not establish a universal Gray motor.

  .quantum-controls.quantum-controls--two
    label
      span Shared charge voltage
      input(v-model.number="chargeVoltageV" type="range" min="500" max="10000" step="100" data-testid="gray-family-voltage")
      output {{ chargeVoltageV }} V
    label
      span Shared speed
      input(v-model.number="startRpm" type="range" min="0" max="2000" step="10" data-testid="gray-family-rpm")
      output {{ startRpm }} rpm

  p.quantum-boundary(v-if="error" role="alert") {{ error }}
  .quantum-result(v-else data-testid="gray-family-result")
    p.gray-status(role="status" aria-live="polite") Six later-prototype rows compared with shared inputs. Patent topology is not being redefined by these colors.
    .gray-table-scroll.gray-table-scroll--wide
      table
        caption Later colored prototype evidence comparison; values are illustrative model outputs
        thead
          tr
            th(scope="col") Machine
            th(scope="col") Stator pole sets
            th(scope="col") Recovery J
            th(scope="col") Mech J
            th(scope="col") COP %
            th(scope="col") Quenched
        tbody
          tr(v-for="row in rows" :key="row.motor.id" :data-motor="row.motor.id")
            td {{ row.motor.label }}
            td {{ row.motor.statorPoles }}
            td {{ row.ledger.recoveredJ.toExponential(2) }}
            td {{ row.ledger.mechanicalJ.toExponential(2) }}
            td {{ (row.ledger.classicalCop * 100).toFixed(3) }}
            td {{ row.arcQuenched ? 'yes' : 'no' }}
    p.quantum-boundary Do not merge these rows into one Gray motor. Each prototype row contains source claims and illustrative assumptions, not validation.
</template>
