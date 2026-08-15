<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  evaluateGrayMotor,
  GRAY_MOTOR_IDS,
  GRAY_MOTORS,
  GRAY_PRESETS,
  poleAngles,
  type GrayMotorId,
} from '../../edwin-gray/edwinGrayEngine'
import type { GrayEvent } from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth }>()

const motorId = ref<GrayMotorId>('purple')
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

const stator = computed(() => poleAngles(result.value?.motor.statorPoles ?? 3))
const rotor = computed(() => poleAngles(result.value?.motor.rotorPoles ?? 3).map((deg) => deg + 8))

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function polePath(deg: number, inner: number, outer: number, halfWidth: number): string {
  const left = polar(360, 160, inner, deg - halfWidth)
  const right = polar(360, 160, inner, deg + halfWidth)
  const farRight = polar(360, 160, outer, deg + halfWidth)
  const farLeft = polar(360, 160, outer, deg - halfWidth)
  return `M ${left.x} ${left.y} L ${right.x} ${right.y} L ${farRight.x} ${farRight.y} L ${farLeft.x} ${farLeft.y} Z`
}

function eventSummary(event: GrayEvent): string {
  return event.sectors.map((sector) => `S${sector.statorPairStation + 1}/R${sector.rotorPairStation + 1}`).join(', ')
}
</script>

<template>
  <article class="quantum-instrument" data-testid="gray-geometry-instrument">
    <header class="quantum-instrument__header">
      <p class="quantum-kicker">Instrument 01 / geometry</p>
      <h3>Patent topology and selected prototype cross-section</h3>
      <p>
        The patent contract is shown first: 9 stator pair stations, 3 rotor pair stations, and 27 scheduled events per revolution.
        The colored prototype drawing is a separate illustrative comparison, not a CAD teardown.
      </p>
    </header>

    <div class="quantum-controls quantum-controls--one">
      <label>
        <span>Prototype</span>
        <select v-model="motorId" data-testid="gray-geometry-motor">
          <option v-for="id in GRAY_MOTOR_IDS" :key="id" :value="id">{{ GRAY_MOTORS[id].label }} ({{ GRAY_MOTORS[id].year }})</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="quantum-boundary" role="alert">{{ error }}</p>
    <div v-else-if="result" class="quantum-result" data-testid="gray-geometry-result">
      <p class="gray-status" role="status" aria-live="polite" data-testid="gray-geometry-status">
        Selected prototype row: {{ result.motor.label }}, {{ result.motor.statorPoles }} stator / {{ result.motor.rotorPoles }} rotor pole sets.
      </p>
      <svg viewBox="0 0 720 320" role="img" :aria-label="`${result.motor.label} cross-section`">
        <circle cx="360" cy="160" r="148" fill="none" stroke="currentColor" :stroke-dasharray="result.motor.housing === 'plastic' ? '6 4' : undefined" />
        <circle cx="360" cy="160" r="78" fill="none" stroke="currentColor" opacity="0.45" />
        <path v-for="deg in stator" :key="`s${deg}`" :d="polePath(deg, 118, 148, 14)" class="gray-stator" />
        <template v-if="result.motor.hasRecovery">
          <path v-for="deg in stator" :key="`r${deg}`" :d="polePath(deg, 148, 168, 18)" class="gray-recovery" />
        </template>
        <path v-for="deg in rotor" :key="`o${deg}`" :d="polePath(deg, 52, 78, 12)" class="gray-rotor" />
        <rect v-if="result.motor.observationWindow" x="502" y="132" width="36" height="56" fill="none" stroke="currentColor" />
        <text x="24" y="28" fill="currentColor" font-size="14">{{ result.motor.label }}</text>
        <text x="24" y="50" fill="currentColor" font-size="12">{{ result.motor.statorPoles }} stator / {{ result.motor.rotorPoles }} rotor</text>
      </svg>
      <div class="gray-table-scroll">
        <table>
          <caption>Selected prototype comparison row</caption>
          <tbody>
            <tr><th scope="row">Designer</th><td>{{ result.motor.designer }}</td></tr>
            <tr><th scope="row">Housing</th><td>{{ result.motor.housing }}</td></tr>
            <tr><th scope="row">Recovery</th><td>{{ result.motor.hasRecovery ? 'outer coils present' : 'none' }}</td></tr>
            <tr><th scope="row">Window</th><td>{{ result.motor.observationWindow ? '2 by 3 in viewing port' : 'closed end bell' }}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="quantum-boundary">{{ result.motor.notes }}</p>

      <section class="gray-topology-panel" data-testid="gray-patent-topology" aria-labelledby="gray-patent-topology-title">
        <h4 id="gray-patent-topology-title">Patent-described topology contract</h4>
        <p class="gray-status" role="status" aria-live="polite">
          {{ result.topology.statorPairStations }} stator pair stations / {{ result.topology.rotorPairStations }} rotor pair stations / {{ result.topology.dischargesPerRevolution }} events per revolution / {{ result.topology.simultaneousSectors }} participating sectors per event.
        </p>
        <div class="gray-table-scroll gray-table-scroll--wide">
          <table data-testid="gray-event-schedule">
            <caption>Patent-described and patent-derived 27-event schedule</caption>
            <thead>
              <tr><th scope="col">Event</th><th scope="col">Angle / deg</th><th scope="col">Step / deg</th><th scope="col">Participating stator/rotor stations</th></tr>
            </thead>
            <tbody>
              <tr v-for="event in result.eventSchedule" :key="event.stepIndex">
                <th scope="row">{{ event.stepIndex + 1 }}</th>
                <td>{{ event.angleDeg.toFixed(2) }}</td>
                <td>{{ event.stepDeg.toFixed(2) }}</td>
                <td>{{ eventSummary(event) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="quantum-boundary">The topology schedule is distinct from the later colored prototype comparison above. Dimensions, materials, and coil parameters remain illustrative assumptions.</p>
      </section>
    </div>
  </article>
</template>
