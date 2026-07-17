<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import CoverageStrip from './components/CoverageStrip.vue'
import { useAtlasEngine } from './composables/atlasEngine'

const atlas = useAtlasEngine()
const route = useRoute()
const fullCoverageRoutes = new Set(['labs', 'core', 'walls', 'sources'])
const compactCoverageRoutes = new Set(['atlas', 'formula'])
const showFullCoverage = computed(() => fullCoverageRoutes.has(String(route.name)))
const showCompactCoverage = computed(() => compactCoverageRoutes.has(String(route.name)))
onMounted(atlas.initialize)
</script>

<template lang="pug">
.app-shell(:data-testid="atlas.ready.value ? 'app-ready' : undefined")
  a.skip-link(href="#main-content") Skip to instrument
  AppNav
  CoverageStrip(v-if="showFullCoverage" :rows="atlas.coverage.value" :complete="atlas.complete.value")
  CoverageStrip(v-else-if="showCompactCoverage" :rows="atlas.coverage.value" :complete="atlas.complete.value" compact)
  p.system-error(v-if="atlas.error.value" role="alert")
    strong Registry load error:
    |  {{ atlas.error.value.message }}
  main#main-content
    RouterView
  footer.app-footer
    span OPENSIMPHY / browser instrument
    span Reproduction is not validation
    span No telemetry / no API
</template>
