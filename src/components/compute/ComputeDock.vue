<script setup lang="ts">
import ComputePlot from './ComputePlot.vue'
import ComputePrompt from './ComputePrompt.vue'
import type { ComputeContext } from '../../compute/types'
import type { PlotFigure } from '../../types/plot'

withDefaults(defineProps<{
  context: ComputeContext
  initialQuery?: string
  examples?: boolean
}>(), {
  examples: false,
})

function asPlotFigure(value: unknown): PlotFigure {
  return value as PlotFigure
}
</script>

<template lang="pug">
ComputePrompt(:context="context" :initial-query="initialQuery" :examples="examples")
  template(#plot="{ figure }")
    ComputePlot(v-if="figure" :figure="asPlotFigure(figure)")
</template>
