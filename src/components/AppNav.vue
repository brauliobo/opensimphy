<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const open = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => { open.value = false })

const links = [
  { to: '/', label: 'Tour', code: '00', routes: ['overview', 'topic'] },
  { to: '/atlas', label: 'Formula atlas', code: '01', routes: ['atlas', 'formula'] },
  { to: '/labs', label: 'Labs', code: '02', routes: import.meta.env.VITE_ONELAB_ENABLED === 'true' ? ['labs', 'core', 'walls', 'onelab'] : ['labs', 'core', 'walls'] },
  { to: '/sources', label: 'Sources', code: '03', routes: ['sources'] },
]
</script>

<template lang="pug">
header.app-header
  RouterLink.brand(to="/" aria-label="OpenSimPhy overview")
    span.brand-mark(aria-hidden="true") O/SP
    span.brand-copy
      strong OpenSimPhy Atlas
      small Constants, one context at a time
  button.nav-toggle(
    type="button"
    data-testid="nav-toggle"
    :aria-expanded="open"
    aria-controls="primary-navigation"
    @click="open = !open"
  )
    span.sr-only Toggle navigation
    span.nav-toggle-lines(aria-hidden="true")
  nav#primary-navigation.primary-nav(:class="{ 'is-open': open }" aria-label="Primary navigation")
    RouterLink.nav-link(
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :class="{ 'router-link-active': link.routes.includes(String(route.name)) }"
      @click="open = false"
    )
      span.nav-code {{ link.code }}
      span {{ link.label }}
</template>
