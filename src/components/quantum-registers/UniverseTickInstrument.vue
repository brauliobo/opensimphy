<script setup lang="ts">
import { ref } from 'vue'
import QuantumTooltip from '../quantum/QuantumTooltip.vue'
import {
  evaluateUniverse,
  formatRegister,
  type UniversePreset,
  type UniverseResult,
} from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const preset = ref<UniversePreset>('random')
const startWidth = ref(8)
const startCount = ref(8)
const seed = ref(5)
const maxSteps = ref(80)
const maxWidth = ref(137)
const maxSize = ref(32)
const error = ref('')
const result = ref<UniverseResult | null>(evaluateUniverse({
  preset:     'random',
  startWidth: 8,
  startCount: 8,
  seed:       5,
  maxSteps:   80,
  maxWidth:   137,
  maxSize:    32,
}))

function runUniverse(): void {
  try {
    error.value  = ''
    result.value = evaluateUniverse({
      preset:     preset.value,
      startWidth: startWidth.value,
      startCount: startCount.value,
      seed:       seed.value,
      maxSteps:   maxSteps.value,
      maxWidth:   maxWidth.value,
      maxSize:    maxSize.value,
    })
  } catch (reason) {
    error.value  = reason instanceof Error ? reason.message : String(reason)
    result.value = null
  }
}
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-universe-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 06 / bounded universe
    h3 Tick width only on null XOR, never invent a field
    p
      | Pick two stored strings. If their XOR is new, adjoin it. If it is already present, count a closed hit. If it is zero,
      |
      QuantumTooltip(
        term="whole-system XOR"
        plain="Pairing two registers never creates a leftover bit."
        technical="a ⊕ b ⊕ (a ⊕ b) = 0 is an identity of GF(2)."
        :depth="props.depth"
      )
      |  still holds and the width may grow by one bit. Reaching 137 is a stop condition.

  .quantum-controls.quantum-controls--four
    label
      span Preset
      select(v-model="preset" data-testid="universe-preset")
        option(value="random") Random start
        option(value="dcs-7") Closed 7-string DCS
    label
      span Start width
      input(v-model.number="startWidth" type="range" min="4" max="32" step="1" :disabled="preset === 'dcs-7'" data-testid="universe-start-width")
      output {{ preset === 'dcs-7' ? 4 : startWidth }}
    label
      span Start count
      input(v-model.number="startCount" type="range" min="4" max="32" step="1" :disabled="preset === 'dcs-7'" data-testid="universe-start-count")
      output {{ startCount }}
    label
      span Steps
      input(v-model.number="maxSteps" type="range" min="8" max="400" step="8" data-testid="universe-steps")
      output {{ maxSteps }}

  .quantum-controls.quantum-controls--three
    label
      span Seed
      input(v-model.number="seed" type="number" min="1" max="2147483646" data-testid="universe-seed")
    label
      span Max width
      input(v-model.number="maxWidth" type="range" min="8" max="137" step="1" data-testid="universe-max-width")
      output {{ maxWidth }}
    label
      span Max stored words
      input(v-model.number="maxSize" type="range" min="8" max="64" step="1" data-testid="universe-max-size")
      output {{ maxSize }}

  .quantum-actions
    button(type="button" data-testid="universe-run" @click="runUniverse") Run bounded ticks

  p.quantum-error(v-if="error" data-testid="universe-error") {{ error }}
  section.quantum-result(v-else-if="result" data-testid="universe-result")
    .quantum-readout-grid
      div
        dt Width
        dd {{ result.width }}
      div
        dt Stored words
        dd {{ result.size }}
      div
        dt Closed XOR hits
        dd {{ result.xorClosedHits }}
      div
        dt Ticks / adjoined
        dd {{ result.ticks }} / {{ result.adjoined }}
      div
        dt Reached 137
        dd {{ result.reached137 ? 'yes' : 'no' }}
      div
        dt Last XOR
        dd {{ result.lastXor === null ? 'none' : formatRegister(result.lastXor, result.width) }}
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary A width-137 checkpoint still stores at most 64 words. It does not emit particle content, spacetime, or a coupling constant. No claim energy is injected.
</template>
