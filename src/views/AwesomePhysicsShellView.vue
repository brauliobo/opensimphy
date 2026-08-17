<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CaseNav from '../components/cases/CaseNav.vue'
import { AWESOME_CATALOG_CASE, CASE_HUB, collectCaseRecords } from '../cases/caseRegistry'
import { useBenchmarkRegistry } from '../cases/benchmarkRegistry'
import { registerAwesomePhysicsAdapters } from '../awesomePhysics/registerAdapters'
import { useAwesomePhysicsRegistry } from '../registries/awesomePhysicsRegistry'

const route = useRoute()
const registry = useAwesomePhysicsRegistry()
registerAwesomePhysicsAdapters()
void registry.initialize()
void useBenchmarkRegistry().initialize()

const currentId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.length > 0 ? id : AWESOME_CATALOG_CASE.id
})

const caseRecords = computed(() => {
  const catalog = registry.catalog.value
  const simulations = registry.simulations.value
  const awesome = catalog && simulations
    ? collectCaseRecords(catalog.items, catalog.organizations, simulations.items)
    : []
  return [CASE_HUB, AWESOME_CATALOG_CASE, ...awesome]
})
</script>

<template lang="pug">
.view.awesome-physics-view(data-testid="awesome-physics-shell")
  CaseNav(:cases="caseRecords" :current-id="currentId" hub-to="/labs/cases")
  RouterView
</template>

<style src="../styles/awesome-physics.css"></style>
