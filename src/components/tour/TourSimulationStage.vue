<script setup lang="ts">
import { computed, inject, shallowRef, watch, type Component } from 'vue'
import type { ReadingDepth, TourGeneratedSimulation } from '../../types/tour'
import TourSimulationLoadError from './TourSimulationLoadError.vue'
import TourSimulationLoading from './TourSimulationLoading.vue'

type SimulationModule = { default: Component }
type SimulationLoader = () => Promise<Component | SimulationModule>

const defaultSimulationLoaders = Object.freeze({
  'dimensional-equation-builder': () => import('./DimensionBuilder.vue'),
  'physical-scale-ruler': () => import('./ScaleRuler.vue'),
  'photon-scale-converter': () => import('./PhotonBridge.vue'),
  'electrical-standards-network': () => import('./ElectricalStandardsNetwork.vue'),
  'hydrogen-spectrum-explorer': () => import('./AtomicSpectrumExplorer.vue'),
  'particle-scale-comparator': () => import('./ParticleScaleComparator.vue'),
  'spin-precession-visualizer': () => import('./SpinPrecessionVisualizer.vue'),
  'blackbody-spectrum': () => import('./BlackbodySpectrum.vue'),
  'particle-to-mole-scaler': () => import('./MolarMatterScaler.vue'),
}) satisfies Readonly<Record<string, SimulationLoader>>

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: unknown]
}>()

const simulationLoaders = inject<Readonly<Record<string, SimulationLoader>>>('tourSimulationLoaders', defaultSimulationLoaders)
const resolvedComponent = shallowRef<Component | null>(null)
const loadError = shallowRef<Error | null>(null)
const loading = shallowRef(true)

function moduleComponent(value: Component | SimulationModule): Component {
  if (value && typeof value === 'object' && 'default' in value && value.default) return value.default
  return value as Component
}

watch(() => props.simulation.id, async (id) => {
  const loader = simulationLoaders[id]
  if (!loader) {
    resolvedComponent.value = null
    loadError.value = null
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = null
  resolvedComponent.value = null
  try {
    const loaded = await loader()
    if (id !== props.simulation.id) return
    resolvedComponent.value = moduleComponent(loaded)
  } catch (reason) {
    if (id !== props.simulation.id) return
    const error = reason instanceof Error ? reason : new Error(String(reason))
    loadError.value = error
    throw error
  } finally {
    if (id === props.simulation.id) loading.value = false
  }
}, { immediate: true })

const simulationInstanceKey = computed(() => [
  props.simulation.id,
  props.simulation.comparison.compatibilityKey,
  props.initialPresetId ?? 'default',
].join(':'))
</script>

<template lang="pug">
component(
  :is="resolvedComponent"
  v-if="resolvedComponent"
  :key="simulationInstanceKey"
  :simulation="simulation"
  :depth="depth"
  :initial-preset-id="initialPresetId"
  @evaluated="emit('evaluated', $event)"
)
TourSimulationLoading(v-else-if="loading")
TourSimulationLoadError(v-else-if="loadError")
div(v-else role="alert" data-testid="tour-simulation-unknown")
  p The requested interactive simulation is unavailable.
  p Simulation ID: #[code {{ simulation.id }}]
</template>
