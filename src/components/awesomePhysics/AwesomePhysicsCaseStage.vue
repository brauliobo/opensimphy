<script setup lang="ts">
import { computed } from 'vue'
import ScikitBeamCase from './ScikitBeamCase.vue'
import RaysectCase from './RaysectCase.vue'
import QuantumOpticsJlCase from './QuantumOpticsJlCase.vue'
import AstropyCase from './AstropyCase.vue'
import PymunkCase from './PymunkCase.vue'
import GalpyCase from './GalpyCase.vue'
import PhysxCase from './PhysxCase.vue'
import NewtonDynamicsCase from './NewtonDynamicsCase.vue'
import NcollideCase from './NcollideCase.vue'
import FluidEngineDevCase from './FluidEngineDevCase.vue'
import CanteraCase from './CanteraCase.vue'
import { awesomePhysicsCasePage } from '../../awesomePhysics/casePages'

const props = defineProps<{
  catalogItemId: string
  result: unknown
}>()

const page = computed(() => awesomePhysicsCasePage(props.catalogItemId))
</script>

<template lang="pug">
section.awesome-case-page(v-if="page" :data-testid="`awesome-case-page-${page.catalogItemId}`" aria-labelledby="awesome-case-page-title")
  p.eyebrow Lesson figure
  h2#awesome-case-page-title {{ page.title }}
  p.awesome-case-lesson {{ page.lesson }}
  p.awesome-case-idle(v-if="result === null" data-testid="awesome-case-idle") Run the bounded adapter to fill this figure. The JSON payload remains the worker contract.
  ScikitBeamCase(v-else-if="page.catalogItemId === 'awesome-scikit-beam'" :result="result")
  RaysectCase(v-else-if="page.catalogItemId === 'awesome-raysect'" :result="result")
  QuantumOpticsJlCase(v-else-if="page.catalogItemId === 'awesome-quantumoptics-jl'" :result="result")
  AstropyCase(v-else-if="page.catalogItemId === 'awesome-astropy'" :result="result")
  PymunkCase(v-else-if="page.catalogItemId === 'awesome-pymunk'" :result="result")
  GalpyCase(v-else-if="page.catalogItemId === 'awesome-galpy'" :result="result")
  PhysxCase(v-else-if="page.catalogItemId === 'awesome-physx-3-4'" :result="result")
  NewtonDynamicsCase(v-else-if="page.catalogItemId === 'awesome-newton-dynamics'" :result="result")
  NcollideCase(v-else-if="page.catalogItemId === 'awesome-ncollide'" :result="result")
  FluidEngineDevCase(v-else-if="page.catalogItemId === 'awesome-fluid-engine-dev'" :result="result")
  CanteraCase(v-else-if="page.catalogItemId === 'awesome-cantera'" :result="result")
</template>
