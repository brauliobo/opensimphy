<script setup lang="ts">
import type { PlotPanelStatus } from '../types/plot'

withDefaults(defineProps<{
  label: string
  status?: PlotPanelStatus
  errorMessage?: string
}>(), {
  status:       'ready',
  errorMessage: 'Interactive plot failed to initialize.',
})
</script>

<template lang="pug">
.plot-panel(:aria-busy="status === 'loading'")
  .plot-header
    span {{ label }}
    span.plot-state(:class="`is-${status}`") {{ status }}
  slot
  p.inline-error(v-if="status === 'error'") {{ errorMessage }}
  slot(name="caption")
</template>
