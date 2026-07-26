<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNav from './components/AppNav.vue'
import CoverageStrip from './components/CoverageStrip.vue'
import { useAtlasEngine } from './composables/atlasEngine'

const atlas = useAtlasEngine()
const route = useRoute()
const router = useRouter()
const fullCoverageRoutes = new Set(['labs', 'core', 'walls', 'sources'])
const compactCoverageRoutes = new Set(['atlas', 'formula'])
const showFullCoverage = computed(() => fullCoverageRoutes.has(String(route.name)))
const showCompactCoverage = computed(() => compactCoverageRoutes.has(String(route.name)))
let headingObserver: MutationObserver | undefined
let focusRequest = 0
let routeFocusEnabled = false

async function focusRouteHeading(): Promise<void> {
  const request = ++focusRequest
  headingObserver?.disconnect()
  await nextTick()
  if (request !== focusRequest) return

  const main = document.getElementById('main-content')
  if (!main) return

  const focusHeading = (): boolean => {
    const heading = main.querySelector<HTMLHeadingElement>('h1')
    if (!heading) return false
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    return true
  }

  if (focusHeading()) return
  headingObserver = new MutationObserver(() => {
    if (!focusHeading()) return
    headingObserver?.disconnect()
    headingObserver = undefined
  })
  headingObserver.observe(main, { childList: true, subtree: true })
}

watch(() => route.path, () => {
  if (routeFocusEnabled) void focusRouteHeading()
}, { flush: 'post' })
onMounted(async () => {
  atlas.initialize()
  await router.isReady()
  await nextTick()
  routeFocusEnabled = true
})
onBeforeUnmount(() => headingObserver?.disconnect())
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
