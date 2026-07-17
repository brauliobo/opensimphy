<script setup lang="ts">
import { onMounted } from 'vue'
import AppNav from './components/AppNav.vue'
import CoverageStrip from './components/CoverageStrip.vue'
import { useAtlasEngine } from './composables/atlasEngine'

const atlas = useAtlasEngine()
onMounted(atlas.initialize)
</script>

<template lang="pug">
.app-shell(:data-testid="atlas.ready.value ? 'app-ready' : undefined")
  a.skip-link(href="#main-content") Skip to instrument
  AppNav
  CoverageStrip(:rows="atlas.coverage.value" :complete="atlas.complete.value")
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
