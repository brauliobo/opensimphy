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

<template lang="pug">
article.quantum-instrument(data-testid="gray-energy-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 04 / energy
    h3 Account for the dump without a radiant extra term
    p Classical COP uses mechanical work plus recovery transfer over capacitor energy. EMA4 still shows the talk’s COP 300 as a source-claim beside that number.

  .quantum-controls.quantum-controls--three
    label
      span Prototype
      select(v-model="motorId" data-testid="gray-energy-motor" @change="applyPreset")
        option(v-for="id in GRAY_MOTOR_IDS" :key="id" :value="id") {{ GRAY_MOTORS[id].label }}
    label
      span Charge voltage
      input(v-model.number="chargeVoltageV" type="range" min="100" max="20000" step="100" data-testid="gray-energy-voltage")
      output {{ chargeVoltageV }} V
    label
      span Bank capacitance
      input(v-model.number="capacitanceF" type="range" min="1e-8" max="1e-5" step="1e-8" data-testid="gray-energy-cap")
      output {{ (capacitanceF * 1e6).toFixed(3) }} μF

  p.quantum-boundary(v-if="error" role="alert") {{ error }}
  .quantum-result(v-else-if="result" data-testid="gray-energy-result")
    p.gray-status(role="status" aria-live="polite") Model status: {{ result.modelStatus }}. Classical COP is scoped to the pulse stage; the historical claim remains separate.
    .gray-table-scroll
      table
        caption Classical pulse-stage energy ledger; historical claim shown separately
        tbody
          tr
            th(scope="row") Capacitor energy
            td {{ formatJ(result.ledger.capacitorJ) }}
          tr
            th(scope="row") Ohmic
            td {{ formatJ(result.ledger.ohmicJ) }}
          tr
            th(scope="row") Spark at quench
            td {{ formatJ(result.ledger.sparkJ) }}
          tr
            th(scope="row") Torque work (integral)
            td {{ formatJ(result.ledger.mechanicalJ) }}
          tr
            th(scope="row") Recovered
            td {{ formatJ(result.ledger.recoveredJ) }}
          tr
            th(scope="row") Energy balance residual
            td {{ formatJ(result.ledger.residualJ) }}
          tr
            th(scope="row") Classical COP
            td(data-testid="gray-classical-cop") {{ (result.ledger.classicalCop * 100).toFixed(3) }}%
          tr
            th(scope="row") Claimed COP
            td(data-testid="gray-claimed-cop") {{ result.ledger.claimedCop ?? 'none in this source row' }}
    p.quantum-boundary {{ result.finding }} Reproduction is not validation. validatesTheory remains false.
</template>
