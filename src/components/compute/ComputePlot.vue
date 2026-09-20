<script setup lang="ts">
import PlotlyPanel from '../PlotlyPanel.vue'
import type { PlotFigure } from '../../types/plot'

defineProps<{
  figure: PlotFigure
}>()
</script>

<template lang="pug">
PlotlyPanel(:figure="figure" label="Compute graph" test-id="compute-plot")
</template>
