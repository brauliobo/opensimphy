<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  evaluateGrayMotor,
  GRAY_MOTOR_IDS,
  GRAY_MOTORS,
  GRAY_PRESETS,
  type GrayMotorId,
} from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth }>()

const motorId = ref<GrayMotorId>('ema4')
const chargeVoltageV = ref(1500)
const capacitanceF = ref(2.3e-6)
const error = ref('')

const result = computed(() => {
  try {
    error.value = ''
    const preset = GRAY_PRESETS[motorId.value]
    return evaluateGrayMotor({
      ...preset,
      chargeVoltageV: chargeVoltageV.value,
      capacitanceF: capacitanceF.value,
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

function applyPreset(): void {
  const preset = GRAY_PRESETS[motorId.value]
  chargeVoltageV.value = preset.chargeVoltageV
  capacitanceF.value = preset.capacitanceF
}

function formatJ(value: number): string {
  return `${value.toExponential(3)} J`
}
</script>

<template>
  <article class="quantum-instrument" data-testid="gray-energy-instrument">
    <header class="quantum-instrument__header">
      <p class="quantum-kicker">Instrument 04 / energy</p>
      <h3>Account for the dump without a radiant extra term</h3>
      <p>
        Classical COP uses mechanical work plus recovery transfer over capacitor energy. EMA4 still shows the talk’s COP 300 as a source-claim beside that number.
      </p>
    </header>

    <div class="quantum-controls quantum-controls--three">
      <label>
        <span>Prototype</span>
        <select v-model="motorId" data-testid="gray-energy-motor" @change="applyPreset">
          <option v-for="id in GRAY_MOTOR_IDS" :key="id" :value="id">{{ GRAY_MOTORS[id].label }}</option>
        </select>
      </label>
      <label>
        <span>Charge voltage</span>
        <input v-model.number="chargeVoltageV" type="range" min="100" max="20000" step="100" data-testid="gray-energy-voltage">
        <output>{{ chargeVoltageV }} V</output>
      </label>
      <label>
        <span>Bank capacitance</span>
        <input v-model.number="capacitanceF" type="range" min="1e-8" max="1e-5" step="1e-8" data-testid="gray-energy-cap">
        <output>{{ (capacitanceF * 1e6).toFixed(3) }} μF</output>
      </label>
    </div>

    <p v-if="error" class="quantum-boundary" role="alert">{{ error }}</p>
    <div v-else-if="result" class="quantum-result" data-testid="gray-energy-result">
      <p class="gray-status" role="status" aria-live="polite">Model status: {{ result.modelStatus }}. Classical COP is scoped to the pulse stage; the historical claim remains separate.</p>
      <div class="gray-table-scroll">
        <table>
          <caption>Classical pulse-stage energy ledger; historical claim shown separately</caption>
          <tbody>
            <tr><th scope="row">Capacitor energy</th><td>{{ formatJ(result.ledger.capacitorJ) }}</td></tr>
            <tr><th scope="row">Ohmic</th><td>{{ formatJ(result.ledger.ohmicJ) }}</td></tr>
            <tr><th scope="row">Spark at quench</th><td>{{ formatJ(result.ledger.sparkJ) }}</td></tr>
            <tr><th scope="row">Torque work (integral)</th><td>{{ formatJ(result.ledger.mechanicalJ) }}</td></tr>
            <tr><th scope="row">Recovered</th><td>{{ formatJ(result.ledger.recoveredJ) }}</td></tr>
            <tr><th scope="row">Energy balance residual</th><td>{{ formatJ(result.ledger.residualJ) }}</td></tr>
            <tr><th scope="row">Classical COP</th><td data-testid="gray-classical-cop">{{ (result.ledger.classicalCop * 100).toFixed(3) }}%</td></tr>
            <tr><th scope="row">Claimed COP</th><td data-testid="gray-claimed-cop">{{ result.ledger.claimedCop ?? 'none in this source row' }}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="quantum-boundary">{{ result.finding }} Reproduction is not validation. validatesTheory remains false.</p>
    </div>
  </article>
</template>
