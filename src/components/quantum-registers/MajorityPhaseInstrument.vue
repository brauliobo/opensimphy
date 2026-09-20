<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from '../quantum/QuantumTooltip.vue'
import {
  evaluateMajorityWalk,
  type MajorityMode,
} from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const mode = ref<MajorityMode>('coins')
const width = ref(137)
const matchP = ref(0.6)
const seed = ref(137)
const steps = ref(80)
const error = ref('')

const result = computed(() => {
  try {
    error.value = ''
    return evaluateMajorityWalk({
      width:  width.value,
      seed:   seed.value,
      steps:  steps.value,
      matchP: matchP.value,
      mode:   mode.value,
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

const voteCounts = computed(() => {
  const current = result.value
  if (!current) return { ones: 0, zeros: 0, label: 'ones / zeros' }
  if (current.lastAlignment) {
    return { ones: current.lastAlignment.aligned, zeros: current.lastAlignment.disagreed, label: 'aligned / disagreed' }
  }
  return { ones: current.lastVote.ones, zeros: current.lastVote.zeros, label: 'ones / zeros' }
})

const maxAbs = computed(() => Math.max(1, ...(result.value?.path.map((point) => Math.abs(point.position)) ?? [1])))

function mapX(t: number, count: number): number {
  return 36 + (count <= 1 ? 0 : (t - 1) / (count - 1) * 688)
}

function mapY(position: number): number {
  return 110 - position / maxAbs.value * 88
}

function bitClass(bit: number): string {
  return bit === 1 ? 'is-on' : ''
}

function formatP(value: number): string {
  return value.toFixed(4)
}
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-majority-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 01 / majority phase
    h3 Flip 137 coins; majority phase is the next step
    p
      | Each tick is 137 coin flips. Because 137 is odd, the
      |
      QuantumTooltip(
        term="majority phase"
        plain="The side that won more than half of the 137 flips."
        technical="sign(2 popcount − 137). Ties are impossible for odd width, so a step is always defined."
        :depth="props.depth"
      )
      |  is always defined. In align mode a second 137-bit receiver must match on a majority of phases before that step commits.

  .quantum-controls.quantum-controls--four
    label
      span Mode
      select(v-model="mode" data-testid="majority-mode")
        option(value="coins") 137 coin flips
        option(value="align") Majority alignment
    label
      span Width
      input(v-model.number="width" type="range" min="3" max="137" step="1" data-testid="majority-width")
      output {{ width }}{{ width % 2 === 1 ? ' (odd, no tie)' : ' (even, ties)' }}
    label
      span Per-bit agreement
      input(v-model.number="matchP" type="range" min="0.5" max="0.8" step="0.01" :disabled="mode === 'coins'" data-testid="majority-match")
      output {{ formatP(matchP) }}
    label
      span Steps / seed
      input(v-model.number="steps" type="range" min="8" max="120" step="1" data-testid="majority-steps")
      output {{ steps }} ticks, seed
  .quantum-controls.quantum-controls--one
    label
      span Seed
      input(v-model.number="seed" type="number" min="1" max="2147483646" data-testid="majority-seed")

  p.quantum-error(v-if="error" data-testid="majority-error") {{ error }}
  section.quantum-result(v-else-if="result" data-testid="majority-result")
    .quantum-readout-grid
      div
        dt Threshold
        dd {{ result.threshold }} / {{ result.width }}
      div
        dt Last {{ voteCounts.label }}
        dd {{ voteCounts.ones }} / {{ voteCounts.zeros }}
      div
        dt Last majority
        dd {{ result.lastVote.tie ? 'tie, no step' : `${result.lastVote.majority} → step ${result.lastVote.step > 0 ? '+' : ''}${result.lastVote.step}` }}
      div
        dt Commits
        dd {{ result.commits }} / {{ result.path.length }}
      div
        dt Empirical commit P
        dd {{ formatP(result.empiricalCommitRate) }}
      div
        dt Binomial commit P
        dd {{ formatP(result.binomialCommitP) }}
      div
        dt P(step = +1), fair
        dd {{ formatP(result.fairStepP) }}
      div
        dt Walk position
        dd {{ result.position }}
    .majority-bar(role="img" :aria-label="`${voteCounts.label} ${voteCounts.ones}, ${voteCounts.zeros}`")
      span.majority-bar__ones(:style="{ flex: voteCounts.ones }") {{ voteCounts.label.split(' / ')[0] }} {{ voteCounts.ones }}
      span.majority-bar__zeros(:style="{ flex: Math.max(voteCounts.zeros, 0.0001) }") {{ voteCounts.label.split(' / ')[1] }} {{ voteCounts.zeros }}
    figure.register-bitboards
      figcaption Last {{ result.width }} coin flips. Cyan is heads / phase 1. LSB on the right.
      .bit-board
        span Coins
        .bit-grid
          span.bit-cell(
            v-for="(bit, index) in [...result.lastBits].reverse()"
            :key="`coin-${index}`"
            :class="bitClass(bit)"
          )
      .bit-board(v-if="result.lastAlignedBits")
        span Match
        .bit-grid
          span.bit-cell(
            v-for="(bit, index) in [...result.lastAlignedBits].reverse()"
            :key="`align-${index}`"
            :class="bitClass(bit)"
          )
    figure
      svg(viewBox="0 0 760 220" role="img" aria-labelledby="majority-walk-title")
        title#majority-walk-title Majority-phase walk
        line(x1="36" y1="110" x2="724" y2="110" stroke="currentColor" opacity="0.35")
        polyline(
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :points="result.path.map((point) => `${mapX(point.t, result.path.length)},${mapY(point.position)}`).join(' ')"
        )
      figcaption Position versus tick. A step is taken only when majority phase is defined (coin mode) or when a majority of phases match (align mode).
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary Fair 137-coin majority is a ±1 random walk. Alignment at 137 bits can lock a weak per-bit agreement into an almost-sure tick. Neither computation is a law of physics or a derivation of α.
</template>
