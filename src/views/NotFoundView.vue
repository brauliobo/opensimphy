<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const requestedPath = computed(() => route.name === 'not-found' && typeof route.query.from === 'string'
  ? route.query.from
  : route.fullPath)
</script>

<template lang="pug">
.view.not-found-view
  header.view-header
    div
      p.eyebrow Navigation recovery
      h1 Page not found
      p The requested path is not part of this build.
      code(data-testid="requested-path") {{ requestedPath }}
  nav.not-found-links(aria-label="Recovery links")
    RouterLink.button-link(to="/tour") Tour
    RouterLink.text-link(to="/atlas") Atlas
    RouterLink.text-link(to="/labs") Workbench
    RouterLink.text-link(to="/evidence") Evidence
</template>

<style src="../styles/tour.css"></style>
