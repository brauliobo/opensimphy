<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from '../quantum/QuantumTooltip.vue'
import {
  evaluateHandshake,
  formatRegister,
  type HandshakeRule,
  type UniversePreset,
} from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const preset = ref<UniversePreset>('dcs-7')
const rule = ref<HandshakeRule>('xor-closed')
const width = ref(137)
const size = ref(16)
const seed = ref(7)
const emitterIndex = ref(0)
const minOverlap = ref(1)
const error = ref('')

const safeEmitter = computed(() => {
  const last = preset.value === 'dcs-7' ? 6 : Math.max(size.value - 1, 0)
  return Math.min(Math.max(emitterIndex.value, 0), last)
})

const result = computed(() => {
  try {
    error.value = ''
    return evaluateHandshake({
      preset:       preset.value,
      width:        width.value,
      size:         size.value,
      seed:         seed.value,
      emitterIndex: safeEmitter.value,
      rule:         rule.value,
      minOverlap:   minOverlap.value,
    })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-handshake-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 04 / handshake
    h3 Select one compatible receiver from competing offers
    p
      | A
      |
      QuantumTooltip(
        term="handshake"
        plain="An offer that succeeds when a second register meets a named rule."
        technical="Selection over competing receivers; a collapse analog, not a detector click."
        :depth="props.depth"
      )
      |  uses one named rule. Closed XOR sets always complete. Sparse 137-bit random sets almost never do under XOR-closure.

  .quantum-controls.quantum-controls--four
    label
      span Universe
      select(v-model="preset" data-testid="handshake-preset")
        option(value="dcs-7") Closed 7-string DCS
        option(value="random") Random registers
    label
      span Rule
      select(v-model="rule" data-testid="handshake-rule")
        option(value="majority-phase") Majority phase alignment
        option(value="xor-closed") XOR already in the set
        option(value="coprime") Coprime integers
        option(value="and-overlap") AND overlap
        option(value="hamming-least") Least Hamming
    label
      span Width
      input(v-model.number="width" type="range" min="8" max="137" step="1" :disabled="preset === 'dcs-7'" data-testid="handshake-width")
      output {{ preset === 'dcs-7' ? 4 : width }}
    label
      span Size / seed / emitter
      input(v-model.number="size" type="range" min="4" max="32" step="1" :disabled="preset === 'dcs-7'" data-testid="handshake-size")
      output {{ result ? `${result.universe.length} words, seed ${seed}, emitter ${emitterIndex}` : 'unavailable' }}

  .quantum-controls.quantum-controls--three
    label
      span Seed
      input(v-model.number="seed" type="number" min="1" max="2147483646" step="1" data-testid="handshake-seed")
    label
      span Emitter index
      input(v-model.number="emitterIndex" type="number" min="0" :max="Math.max((result?.universe.length ?? 1) - 1, 0)" step="1" data-testid="handshake-emitter")
    label
      span Min AND overlap
      input(v-model.number="minOverlap" type="range" min="0" max="8" step="1" :disabled="rule !== 'and-overlap'" data-testid="handshake-overlap")
      output {{ minOverlap }}

  p.quantum-error(v-if="error" data-testid="handshake-error") {{ error }}
  section.quantum-result(v-else-if="result" data-testid="handshake-result")
    .quantum-readout-grid
      div
        dt Compatible
        dd {{ result.compatibleCount }} / {{ result.candidates.length }}
      div
        dt Apparent P
        dd {{ result.apparentProbability.toFixed(4) }}
      div
        dt Selected
        dd {{ result.selected === null ? 'none' : formatRegister(result.selected, result.width) }}
      div
        dt XOR involution
        dd {{ result.involutionZero ? 'conserved' : 'failed' }}
    table
      caption Competing receivers
      thead
        tr
          th Index
          th Word
          th Compatible
          th Hamming
          th gcd
      tbody
        tr(
          v-for="row in result.candidates"
          :key="row.index"
          :data-selected="row.index === result.selectedIndex ? 'true' : 'false'"
        )
          th {{ row.index }}
          td {{ formatRegister(row.value, result.width) }}
          td {{ row.compatible ? 'yes' : 'no' }}
          td {{ row.hamming }}
          td {{ row.gcd.toString() }}
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary Apparent probability is a ratio of named candidates. It is not a measured cross section and does not validate a transactional interpretation of quantum mechanics.
</template>
