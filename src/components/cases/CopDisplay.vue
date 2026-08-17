<script setup lang="ts">
import type { CopClaimRow } from '../../cases/types'

withDefaults(defineProps<{
  observed: number | null
  observedLabel?: string
  scope: string
  note: string
  claims?: readonly CopClaimRow[]
}>(), {
  observedLabel: 'Whole-system COP',
  claims:        () => [],
})
</script>

<template lang="pug">
section.cop-display(data-testid="case-cop" aria-labelledby="case-cop-title")
  p.eyebrow Source claim versus classical ledger
  h2#case-cop-title Coefficient of performance
  dl
    div(:data-tone="observed === null ? 'warn' : 'ok'")
      dt {{ observedLabel }}
      dd(data-testid="case-cop-observed") {{ observed === null ? 'not computed' : observed.toFixed(6) }}
    div
      dt Ledger scope
      dd {{ scope }}
    div(v-for="claim in claims" :key="claim.label" data-tone="claim")
      dt {{ claim.label }}
      dd {{ claim.value }} / {{ claim.status }}
  p.cop-display__note {{ note }}
</template>

<style src="../../styles/cases.css"></style>
