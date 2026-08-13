<script setup lang="ts">
import { computed } from 'vue'
import { useAtlasEngine } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const core = computed(() => atlas.coverage.value.find((row) => row.key === 'core'))
const walls = computed(() => atlas.coverage.value.find((row) => row.key === 'walls'))
const onelabEnabled = import.meta.env.VITE_ONELAB_ENABLED === 'true'
</script>

<template lang="pug">
.view.labs-view
  header.view-header
    div
      p.eyebrow Browser laboratories
      h1 Choose an instrument
    p.lab-intro The laboratories are separate from the constants tour. Enter only when you want to inspect transform cases or simulate preserved number-wall inputs.
  .lab-choice-grid
    RouterLink(to="/labs/core")
      span 01 / TRANSFORM CASES
      strong Core lab
      p Complex surfaces, root loci, invariant checks, constructor transforms, and typed-unit cases.
      small {{ core?.graphed ?? 0 }} graph-ready cases →
    RouterLink(to="/labs/walls")
      span 02 / NUMBER WALLS
      strong Number walls
      p Exact source sequences rendered through six local simulation modes in a cancellable worker.
      small {{ walls?.simulatable ?? 0 }} simulatable inputs →
    RouterLink(v-if="onelabEnabled" to="/labs/onelab" data-testid="onelab-nav")
      span 03 / FIELD SOLVER
      strong Browser ONELAB
      p Serial Gmsh mesh generation and real-double GetDP/PETSc solving with native-reference checks.
      small Open the microstrip proof →
</template>
