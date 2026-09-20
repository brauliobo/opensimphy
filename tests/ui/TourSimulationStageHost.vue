<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TourSimulationStage from '../../src/components/tour/TourSimulationStage.vue'
import type { ReadingDepth, TourGeneratedSimulation } from '../../src/types/tour'

defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

defineEmits<{
  evaluated: [output: unknown]
}>()

const ready = ref(false)
onMounted(() => {
  ready.value = true
})
</script>

<template lang="pug">
TourSimulationStage(
  v-if="ready"
  :simulation="simulation"
  :depth="depth"
  :initial-preset-id="initialPresetId"
  @evaluated="$emit('evaluated', $event)"
)
</template>
