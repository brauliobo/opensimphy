<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const links = [
  { to: '/earth', code: '03/A', label: 'Overview', section: 'overview' },
  { to: '/earth/corpus', code: '03/B', label: 'Corpus · 63', section: 'corpus' },
  { to: '/earth/programs', code: '03/C', label: 'Programs · 130', section: 'programs' },
  { to: '/earth/datasets', code: '03/D', label: 'Data · 19', section: 'data' },
]

const activeSection = computed(() => {
  const name = String(route.name)
  if (name === 'earth') return 'overview'
  if (name === 'earth-corpus' || name === 'earth-document') return 'corpus'
  if (name === 'earth-simulations' || name === 'earth-simulation') return 'programs'
  if (name === 'earth-datasets') return 'data'

  if (route.path === '/earth') return 'overview'
  if (route.path.startsWith('/earth/programs') || route.path.startsWith('/earth/simulations')) return 'programs'
  if (route.path.startsWith('/earth/datasets')) return 'data'
  return 'corpus'
})
</script>

<template lang="pug">
nav.earth-local-nav(aria-label="EARTH dossier navigation")
  RouterLink.earth-local-link(
    v-for="link in links"
    :key="link.section"
    :to="link.to"
    :class="{ 'is-current': activeSection === link.section }"
    :aria-current="activeSection === link.section ? 'page' : undefined"
  )
    span {{ link.code }}
    strong {{ link.label }}
</template>
