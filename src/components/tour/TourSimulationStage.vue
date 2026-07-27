<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, inject, type Component } from 'vue'
import type { ReadingDepth, TourGeneratedSimulation } from '../../types/tour'

type SimulationModule = { default: Component }
type SimulationLoader = () => Promise<Component | SimulationModule>

const simulationLoading = defineComponent({
  name: 'TourSimulationLoading',
  setup: () => () => h('p', {
    role: 'status',
    'aria-live': 'polite',
    'data-testid': 'tour-simulation-loading',
  }, 'Loading interactive simulation...'),
})

const simulationLoadError = defineComponent({
  name: 'TourSimulationLoadError',
  props: {
    error: Error,
  },
  setup: () => () => h('div', {
    role: 'alert',
    'data-testid': 'tour-simulation-load-error',
  }, [
    h('p', 'The interactive simulation could not be loaded.'),
    h('p', 'Reload this lesson to retry. If the problem continues, check the network connection and try again.'),
  ]),
})

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
const simulationComponents: Readonly<Record<string, Component>> = Object.freeze(Object.fromEntries(
  Object.entries(simulationLoaders).map(([id, loader]) => [id, defineAsyncComponent({
    loader,
    loadingComponent: simulationLoading,
    errorComponent: simulationLoadError,
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

<template>
  <component
    :is="simulationComponent"
    v-if="simulationComponent"
    :key="simulationInstanceKey"
    :simulation="simulation"
    :depth="depth"
    :initial-preset-id="initialPresetId"
    @evaluated="emit('evaluated', $event)"
  />
  <div v-else role="alert" data-testid="tour-simulation-unknown">
    <p>The requested interactive simulation is unavailable.</p>
    <p>Simulation ID: <code>{{ simulation.id }}</code></p>
  </div>
</template>
