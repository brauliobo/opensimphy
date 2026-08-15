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

<template>
  <article class="quantum-instrument" data-testid="gray-family-instrument">
    <header class="quantum-instrument__header">
      <p class="quantum-kicker">Instrument 05 / family</p>
      <h3>Compare later colored prototype evidence rows</h3>
      <p>
        Hold voltage, capacitance, speed, and turns fixed while comparing the source-described prototype rows. Recovery energy appears only on EMA4 and purple in this illustrative model; the comparison does not establish a universal Gray motor.
      </p>
    </header>

    <div class="quantum-controls quantum-controls--two">
      <label>
        <span>Shared charge voltage</span>
        <input v-model.number="chargeVoltageV" type="range" min="500" max="10000" step="100" data-testid="gray-family-voltage">
        <output>{{ chargeVoltageV }} V</output>
      </label>
      <label>
        <span>Shared speed</span>
        <input v-model.number="startRpm" type="range" min="0" max="2000" step="10" data-testid="gray-family-rpm">
        <output>{{ startRpm }} rpm</output>
      </label>
    </div>

    <p v-if="error" class="quantum-boundary" role="alert">{{ error }}</p>
    <div v-else class="quantum-result" data-testid="gray-family-result">
      <p class="gray-status" role="status" aria-live="polite">Six later-prototype rows compared with shared inputs. Patent topology is not being redefined by these colors.</p>
      <div class="gray-table-scroll gray-table-scroll--wide">
        <table>
          <caption>Later colored prototype evidence comparison; values are illustrative model outputs</caption>
          <thead>
            <tr>
              <th scope="col">Machine</th>
              <th scope="col">Stator pole sets</th>
              <th scope="col">Recovery J</th>
              <th scope="col">Mech J</th>
              <th scope="col">COP %</th>
              <th scope="col">Quenched</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.motor.id" :data-motor="row.motor.id">
              <td>{{ row.motor.label }}</td>
              <td>{{ row.motor.statorPoles }}</td>
              <td>{{ row.ledger.recoveredJ.toExponential(2) }}</td>
              <td>{{ row.ledger.mechanicalJ.toExponential(2) }}</td>
              <td>{{ (row.ledger.classicalCop * 100).toFixed(3) }}</td>
              <td>{{ row.arcQuenched ? 'yes' : 'no' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="quantum-boundary">Do not merge these rows into one Gray motor. Each prototype row contains source claims and illustrative assumptions, not validation.</p>
    </div>
  </article>
</template>
