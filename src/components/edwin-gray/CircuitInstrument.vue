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

const motorId = ref<GrayMotorId>('gold')
const error = ref('')
const result = computed(() => {
  try {
    error.value = ''
    return evaluateGrayMotor(GRAY_PRESETS[motorId.value])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-circuit-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 02 / circuit
    h3 Pulse-charge, then follow the event schedule
    p The supply holds two capacitors. A commutator event charges a four-capacitor bank. A later scheduled event dumps that bank into the participating stator and rotor sectors.

  .quantum-controls.quantum-controls--one
    label
      span Prototype
      select(v-model="motorId" data-testid="gray-circuit-motor")
        option(v-for="id in GRAY_MOTOR_IDS" :key="id" :value="id") {{ GRAY_MOTORS[id].label }}

  p.quantum-boundary(v-if="error" role="alert") {{ error }}
  .quantum-result(v-else-if="result" data-testid="gray-circuit-result")
    p.gray-status(role="status" aria-live="polite") {{ result.eventSchedule.length }} scheduled events per revolution; {{ result.topology.simultaneousSectors }} sectors participate in each event. This is not an all-coil trigger.
    svg(viewBox="0 0 720 220" role="img" aria-label="Capacitor dump schematic")
      rect(x="20" y="70" width="90" height="80" fill="none" stroke="currentColor")
      text(x="32" y="116" fill="currentColor" font-size="13") HV supply
      rect(x="150" y="40" width="70" height="50" fill="none" stroke="currentColor")
      text(x="160" y="70" fill="currentColor" font-size="12") C hold
      rect(x="150" y="130" width="70" height="50" fill="none" stroke="currentColor")
      text(x="158" y="160" fill="currentColor" font-size="12") C bank
      rect(x="280" y="80" width="90" height="60" fill="none" stroke="currentColor")
      text(x="292" y="116" fill="currentColor" font-size="12") commutator
      rect(x="420" y="40" width="110" height="50" fill="none" stroke="currentColor")
      text(x="432" y="70" fill="currentColor" font-size="12") stator N={{ result.motor.statorPoles }}
      rect(x="420" y="130" width="110" height="50" fill="none" stroke="currentColor")
      text(x="432" y="160" fill="currentColor" font-size="12") rotor N={{ result.motor.rotorPoles }}
      rect(v-if="result.motor.hasRecovery" x="560" y="80" width="130" height="60" fill="none" stroke="currentColor")
      text(v-if="result.motor.hasRecovery" x="572" y="116" fill="currentColor" font-size="12") recovery C
      line(x1="110" y1="110" x2="150" y2="65" stroke="currentColor")
      line(x1="220" y1="65" x2="280" y2="110" stroke="currentColor")
      line(x1="220" y1="155" x2="280" y2="110" stroke="currentColor")
      line(x1="370" y1="110" x2="420" y2="65" stroke="currentColor")
      line(x1="370" y1="110" x2="420" y2="155" stroke="currentColor")
    .gray-table-scroll
      table
        caption Selected circuit model inputs and derived values
        tbody
          tr
            th(scope="row") Charge voltage
            td {{ result.input.chargeVoltageV }} V
          tr
            th(scope="row") Bank C
            td {{ (result.input.capacitanceF * 1e6).toFixed(3) }} uF
          tr
            th(scope="row") L_eq
            td {{ (result.inductanceH * 1e6).toFixed(1) }} uH
          tr
            th(scope="row") Dump energy
            td {{ result.ledger.capacitorJ.toFixed(3) }} J
    p.quantum-boundary Ignitrons and conversion tubes are ideal switches here. Tube drop, mercury plasma, and EMI are omitted.
</template>
