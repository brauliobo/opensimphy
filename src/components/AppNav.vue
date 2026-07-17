<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const open = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => { open.value = false })

const links = [
  { to: '/', label: 'Overview', code: '00' },
  { to: '/atlas', label: 'Formula atlas', code: '01' },
  { to: '/core', label: 'Core lab', code: '02' },
  { to: '/walls', label: 'Number walls', code: '03' },
  { to: '/sources', label: 'Sources', code: '04' },
]
</script>

<template lang="pug">
header.app-header
  RouterLink.brand(to="/" aria-label="OpenSimPhy overview")
    span.brand-mark(aria-hidden="true") O/SP
    span.brand-copy
      strong OpenSimPhy Atlas
      small Static scientific instrument
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
    RouterLink.nav-link(v-for="link in links" :key="link.to" :to="link.to" @click="open = false")
      span.nav-code {{ link.code }}
      span {{ link.label }}
</template>
