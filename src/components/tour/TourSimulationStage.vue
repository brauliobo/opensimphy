<script setup lang="ts">
import { computed, defineVaporAsyncComponent, inject, type Component, type VaporComponent } from 'vue'
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
const simulationComponents: Readonly<Record<string, VaporComponent>> = Object.freeze(Object.fromEntries(
  Object.entries(simulationLoaders).map(([id, loader]) => [id, defineVaporAsyncComponent({
    loader: loader as () => Promise<VaporComponent>,
    loadingComponent: TourSimulationLoading as VaporComponent,
    errorComponent: TourSimulationLoadError as VaporComponent,
    delay: 0,
    timeout: 15_000,
  })]),
))

const simulationComponent = computed(() => simulationComponents[props.simulation.id] ?? null)
const simulationInstanceKey = computed(() => [
  props.simulation.id,
  props.simulation.comparison.compatibilityKey,
  props.initialPresetId ?? 'default',
].join(':'))
</script>

<template lang="pug">
component(
  :is="simulationComponent"
  v-if="simulationComponent"
  :key="simulationInstanceKey"
  :simulation="simulation"
  :depth="depth"
  :initial-preset-id="initialPresetId"
  @evaluated="emit('evaluated', $event)"
)
div(v-else role="alert" data-testid="tour-simulation-unknown")
  p The requested interactive simulation is unavailable.
  p Simulation ID: #[code {{ simulation.id }}]
</template>
