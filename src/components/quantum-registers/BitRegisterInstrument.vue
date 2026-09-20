<script setup lang="ts">
import { computed, ref } from 'vue'
import QuantumTooltip from '../quantum/QuantumTooltip.vue'
import {
  REGISTER_WIDTH_MAX,
  evaluateRegisterPair,
  formatRegister,
  parseRegister,
} from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const width = ref(REGISTER_WIDTH_MAX)
const aText = ref(`0x${((1n << 136n) | 1n).toString(16)}`)
const bText = ref('0x89')
const error = ref('')

const result = computed(() => {
  try {
    error.value = ''
    const a = parseRegister(aText.value, width.value)
    const b = parseRegister(bText.value, width.value)
    return evaluateRegisterPair({ width: width.value, a, b })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
    return null
  }
})

function bitClass(bit: number): string {
  return bit === 1 ? 'is-on' : ''
}
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-bit-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 02 / bit register
    h3 XOR two words without allocating amplitudes
    p
      | Each control is a
      |
      QuantumTooltip(
        term="register"
        plain="A fixed-width string of bits."
        technical="An element of GF(2)^w as a BigInt masked to w ≤ 137."
        :depth="props.depth"
      )
      |  . Width 137 has 2^137 configurations of one word. The involution a ⊕ b ⊕ (a ⊕ b) = 0 is the whole-system conservation.

  .quantum-controls.quantum-controls--three
    label
      span Width (bits)
      input(v-model.number="width" type="range" min="8" max="137" step="1" data-testid="register-width")
      output {{ width }}
    label
      span Register A
      input(v-model="aText" type="text" spellcheck="false" data-testid="register-a")
      small decimal, 0b, or 0x
    label
      span Register B
      input(v-model="bText" type="text" spellcheck="false" data-testid="register-b")
      small 0x89 is 137

  p.quantum-error(v-if="error" data-testid="register-error") {{ error }}
  section.quantum-result(v-else-if="result" data-testid="register-result")
    .quantum-readout-grid
      div
        dt Configurations
        dd {{ result.configurationCountText }}
      div
        dt Stored bytes
        dd {{ result.registerBytes }}
      div
        dt Hamming(A,B)
        dd {{ result.hamming }}
      div
        dt gcd / coprime
        dd {{ result.gcd.toString() }} / {{ result.coprime ? 'yes' : 'no' }}
      div
        dt A ⊕ B
        dd {{ formatRegister(result.xor, result.width) }}
      div
        dt A ∧ B
        dd {{ formatRegister(result.and, result.width) }}
      div
        dt popcount A, B, XOR
        dd {{ result.popA }}, {{ result.popB }}, {{ result.popXor }}
      div
        dt Involution
        dd {{ result.involutionZero ? 'a ⊕ b ⊕ (a ⊕ b) = 0' : 'failed' }}
    figure.register-bitboards
      figcaption Bits, LSB on the right of each row. Cyan is 1.
      .bit-board(v-for="row in [{ label: 'A', bits: result.bitsA }, { label: 'B', bits: result.bitsB }, { label: 'A ⊕ B', bits: result.bitsXor }]" :key="row.label")
        span {{ row.label }}
        .bit-grid(:style="{ '--bit-count': result.width }")
          span.bit-cell(
            v-for="(bit, index) in [...row.bits].reverse()"
            :key="`${row.label}-${index}`"
            :class="bitClass(bit)"
            :title="`bit ${result.width - 1 - index} = ${bit}`"
          )
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary This run does not derive Maxwell, Dirac, or a fine-structure constant. It only executes bounded GF(2) operations on a word of declared width.
</template>
