<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNav from './components/AppNav.vue'
import { publishRuntimeAudit } from './registries/runtimeAudit'

const route = useRoute()
const router = useRouter()
const shellReady = ref(false)
const navigationOpen = ref(false)
let headingObserver: MutationObserver | undefined
let focusRequest = 0
let routeFocusEnabled = false

function publishAppAudit(): void {
  publishRuntimeAudit({
    app: {
      status: 'ready',
      shell: true,
      route: route.fullPath,
    },
  })
}

function handleMenuStateChange(open: boolean): void {
  navigationOpen.value = open
}

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

watch(() => route.fullPath, () => {
  if (!routeFocusEnabled) return
  publishAppAudit()
}, { flush: 'post' })
watch(() => route.path, () => {
  if (!routeFocusEnabled) return
  void focusRouteHeading()
}, { flush: 'post' })
onMounted(async () => {
  await router.isReady()
  await nextTick()
  shellReady.value = true
  publishAppAudit()
  routeFocusEnabled = true
})
onBeforeUnmount(() => headingObserver?.disconnect())
</script>

<template lang="pug">
.app-shell(:data-testid="shellReady ? 'app-ready' : undefined")
  a.skip-link(href="#main-content") Skip to instrument
  AppNav(@menu-state-change="handleMenuStateChange")
  main#main-content(
    :inert="navigationOpen ? '' : undefined"
    :aria-hidden="navigationOpen ? 'true' : undefined"
  )
    RouterView
  footer.app-footer(
    :inert="navigationOpen ? '' : undefined"
    :aria-hidden="navigationOpen ? 'true' : undefined"
  )
    span OPENSIMPHY / browser instrument
    span Reproduction is not validation
    span No telemetry / no API
</template>
