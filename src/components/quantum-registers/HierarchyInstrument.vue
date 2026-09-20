<script setup lang="ts">
import { computed } from 'vue'
import QuantumTooltip from '../quantum/QuantumTooltip.vue'
import { evaluateHierarchy, formatRegister } from '../../quantum-registers/quantumRegisterEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()
const result = computed(() => evaluateHierarchy())

function formatCoupling(value: number): string {
  return value.toExponential(6)
}
</script>

<template lang="pug">
article.quantum-instrument.register-instrument(data-testid="register-hierarchy-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 03 / combinatorial count
    h3 Close three XOR levels and stop before 2^127
    p
      | A
      |
      QuantumTooltip(
        term="DCS"
        plain="Every pair XORs to another string already in the set."
        technical="The 2^n − 1 nonzero vectors of an n-dimensional GF(2) subspace."
        :depth="props.depth"
      )
      |  count is 2^n − 1. Summing the first three closed counts gives 137. 1/137 is a channel-count label compared with measured α, not a QED output.

  section.quantum-result(data-testid="hierarchy-result")
    .quantum-readout-grid
      div
        dt Closure count
        dd {{ result.closureCount }}
      div
        dt 2^7 + 2^3 + 1
        dd {{ result.binary137.toString() }} {{ result.binary137Match ? '= 137' : 'mismatch' }}
      div
        dt Apparent 1/137
        dd {{ formatCoupling(result.apparentCoupling) }}
      div
        dt CODATA 2022 α
        dd {{ formatCoupling(result.codataAlpha) }}
      div
        dt Relative |1/137 − α| / α
        dd {{ result.couplingRelativeError.toExponential(3) }}
      div
        dt Level-2 rank
        dd {{ result.level2Rank }} / 3
    table
      caption Combinatorial hierarchy levels
      thead
        tr
          th Level
          th Independent strings
          th DCS count
          th Mapping width
          th Status
      tbody
        tr(v-for="row in result.levels" :key="row.level")
          th {{ row.level }}
          td {{ row.independent }}
          td {{ row.dcsCount === null ? '2^127 − 1' : row.dcsCount }}
          td {{ row.width }}
          td {{ row.enumerable ? 'enumerated' : 'refused' }}
    table
      caption Parker-Rhodes 4-bit basis DCS (published analog, not a Moog source)
      thead
        tr
          th Index
          th Word
          th Decimal
      tbody
        tr(v-for="(word, index) in result.level2Dcs" :key="word.toString()")
          th {{ index }}
          td {{ formatRegister(word, 4) }}
          td {{ word.toString() }}
    p.quantum-finding {{ result.finding }}
    p.quantum-boundary {{ result.nextLevelRefused }} The nearness of 1/137 to α is a known numerical coincidence unless an independent derivation exists. This instrument does not supply one.
</template>
