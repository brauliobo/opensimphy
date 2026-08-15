<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  evaluateGrayMotor,
  GRAY_MOTOR_IDS,
  GRAY_MOTORS,
  GRAY_PRESETS,
  type GrayMotorId,
} from '../../edwin-gray/edwinGrayEngine'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth: ReadingDepth }>()

const motorId = ref<GrayMotorId>('purple')
const startRpm = ref(500)
const quenchDeg = ref(3)
const playing = ref(false)
const motionNotice = ref('')
const error = ref('')
let animationFrame = 0
let previousTime = 0

const result = computed(() => {
  try {
    error.value = ''
    const preset = GRAY_PRESETS[motorId.value]
    return evaluateGrayMotor({ ...preset, startRpm: startRpm.value, quenchDeg: quenchDeg.value })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

const currentPath = computed(() => {
  if (!result.value) return ''
  const peak = Math.max(...result.value.samples.map((sample) => Math.abs(sample.currentA)), 1)
  return result.value.samples.map((sample, index) => {
    const x = 40 + index / (result.value!.samples.length - 1) * 640
    const y = 150 - sample.currentA / peak * 110
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
})

const pulseStatus = computed(() => {
  if (!result.value) return ''
  return result.value.arcQuenched
    ? `arc quenched; ${result.value.quenchTiming.referenceMinimumRpm} rpm is a presenter-reported reference, not a universal threshold`
    : 'unquenched dump; the presenter-reported reference condition is not reached'
})

function stop(): void {
  playing.value = false
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function tick(now: number): void {
  if (!playing.value) return
  if (prefersReducedMotion()) {
    stop()
    motionNotice.value = 'Spin-up animation is disabled because reduced motion is preferred.'
    return
  }
  if (!previousTime) previousTime = now
  const elapsed = Math.min(80, now - previousTime)
  previousTime = now
  startRpm.value = Math.min(4000, startRpm.value + elapsed * 0.4)
  animationFrame = requestAnimationFrame(tick)
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function togglePlaying(): void {
  if (!playing.value && prefersReducedMotion()) {
    stop()
    motionNotice.value = 'Spin-up animation is disabled because reduced motion is preferred.'
    return
  }
  motionNotice.value = ''
  playing.value = !playing.value
  if (playing.value) {
    previousTime = 0
    animationFrame = requestAnimationFrame(tick)
  } else stop()
}

function reset(): void {
  stop()
  motionNotice.value = ''
  startRpm.value = GRAY_PRESETS[motorId.value].startRpm
  quenchDeg.value = GRAY_PRESETS[motorId.value].quenchDeg
}

onBeforeUnmount(stop)
</script>

<template lang="pug">
article.quantum-instrument(data-testid="gray-pulse-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 03 / pulse
    h3 Stretch the arc until the current breaks
    p The presenter reports 500 rpm for one described setup. This model labels that reference condition without treating it as universal; raise speed and the quench time shortens with the 3 degree marks on the end bell.

  .quantum-controls.quantum-controls--three
    label
      span Prototype
      select(v-model="motorId" data-testid="gray-pulse-motor")
        option(v-for="id in GRAY_MOTOR_IDS" :key="id" :value="id") {{ GRAY_MOTORS[id].label }}
    label
      span Start speed
      input(v-model.number="startRpm" type="range" min="0" max="4000" step="10" data-testid="gray-pulse-rpm")
      output {{ startRpm }} rpm
    label
      span Quench angle
      input(v-model.number="quenchDeg" type="range" min="1" max="18" step="1" data-testid="gray-pulse-quench")
      output {{ quenchDeg }}°
  .quantum-actions
    button(type="button" data-testid="gray-pulse-play" @click="togglePlaying") {{ playing ? 'Pause spin-up' : 'Spin up' }}
    button(type="button" @click="reset") Reset
    span.quantum-readout(role="status" aria-live="polite" data-testid="gray-pulse-status") {{ pulseStatus }}
  p.quantum-stale(v-if="motionNotice" role="status" aria-live="polite" data-testid="gray-pulse-motion-notice") {{ motionNotice }}

  p.quantum-boundary(v-if="error" role="alert") {{ error }}
  .quantum-result(v-else-if="result" data-testid="gray-pulse-result")
    svg(viewBox="0 0 720 200" role="img" aria-label="Dump current versus time")
      path(:d="currentPath" fill="none" stroke="currentColor" stroke-width="2")
      text(x="40" y="24" fill="currentColor" font-size="13") I(t) to quench at {{ (result.quenchTimeSeconds * 1e3).toFixed(2) }} ms
    .gray-table-scroll.gray-table-scroll--wide
      table
        caption Classical pulse samples through the modeled quench window
        thead
          tr
            th(scope="col") t / ms
            th(scope="col") I / A
            th(scope="col") angle / deg
            th(scope="col") arc / mm
        tbody
          tr(v-for="row in result.table" :key="row.timeSeconds")
            td {{ (row.timeSeconds * 1e3).toFixed(2) }}
            td {{ row.currentA.toFixed(1) }}
            td {{ row.angleDeg.toFixed(2) }}
            td {{ (row.arcLengthM * 1e3).toFixed(1) }}
    p.quantum-boundary {{ result.finding }}
</template>
