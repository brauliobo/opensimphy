<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ComputeDock from '../components/compute/ComputeDock.vue'
import { EMPTY_COMPUTE_CONTEXT } from '../compute/types'

const route = useRoute()
const initialQuery = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
</script>

<template lang="pug">
.view.compute-view(data-testid="compute-lab-ready")
  header.view-header
    div
      p.eyebrow Browser computer algebra
      h1 Compute lab
    p.lab-intro Local SI/Planck evaluation, dimensional interpretations, numerical calculus, and 2D/3D graphs. No server CAS. Quantity names that share a dimension are not a unique identity.
  ComputeDock(:context="EMPTY_COMPUTE_CONTEXT" :initial-query="initialQuery" examples)
</template>
