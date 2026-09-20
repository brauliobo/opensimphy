<script setup lang="ts">
import { computed, ref } from 'vue'
import { evaluateHilbertBound, twoBitXorSupport } from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()
const width = ref(137)
const result = computed(() => evaluateHilbertBound(width.value))
const support = computed(() => twoBitXorSupport())
const xorZero = computed(() => support.value.filter((row) => row.xor === 0).reduce((sum, row) => sum + row.probability, 0))
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-hilbert-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 05 / Hilbert bound
    h3 Compare an 18-byte word with a refused 137-qubit vector
    p A complex128 state vector needs 16 × 2^n bytes. This lab allocates that analog only for n ≤ 8. Width 137 is reported, then refused. The 2-bit table is a toy whose support sits on XOR = 0.

  .quantum-controls.quantum-controls--one
    label
      span Width n
      input(v-model.number="width" type="range" min="1" max="137" step="1" data-testid="hilbert-width")
      output {{ width }}

  section.quantum-result(data-testid="hilbert-result")
    .quantum-readout-grid
      div
        dt Amplitudes 2^n
        dd {{ result.amplitudeCountText }}
      div
        dt Complex128 bytes
        dd {{ result.complex128BytesText }}
      div
        dt Register bytes
        dd {{ result.registerBytes }}
      div
        dt Hilbert analog
        dd {{ result.allocatesHilbert ? 'shown for n ≤ 8' : 'refused' }}
    table
      caption Two-bit toy support (not a 137-qubit state)
      thead
        tr
          th Basis
          th XOR of bits
          th Probability
      tbody
        tr(v-for="row in support" :key="row.label")
          th |{{ row.label }}⟩
          td {{ row.xor }}
          td {{ row.probability.toFixed(4) }}
    p.quantum-readout Technical depth {{ props.depth }}: P(XOR = 0) = {{ xorZero.toFixed(4) }}
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary Refusing a 2^137 amplitude vector is a representation bound. It does not prove that nature is a 137-bit register, and the two-bit table does not derive the Schrödinger equation.
</template>
