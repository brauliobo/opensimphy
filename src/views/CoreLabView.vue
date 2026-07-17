<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PlotlyPanel from '../components/PlotlyPanel.vue'
import { useAtlasEngine } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const selectedId = ref('')
const plotIndex = ref(0)
const camera = ref<'2d' | '3d'>('3d')

watch(() => atlas.coreCases.value, (cases) => {
  if (!selectedId.value && cases[0]) selectedId.value = cases[0].id
}, { immediate: true })
const selected = computed(() => atlas.coreCases.value.find((item) => item.id === selectedId.value) ?? atlas.coreCases.value[0] ?? null)
const activeGraph = computed(() => selected.value?.graphs[plotIndex.value] ?? selected.value?.graphs[0] ?? null)
const families = computed(() => [...new Set(atlas.coreCases.value.map((item) => item.family))])

watch([camera, selected], ([projection, current]) => {
  plotIndex.value = projection === '3d' && (current?.graphs.length ?? 0) > 1 ? 1 : 0
}, { immediate: true })
</script>

<template lang="pug">
.view
  header.view-header
    div
      p.eyebrow Instrument 02 / core registry
      h1 Core Lab
    .header-stat
      strong {{ atlas.coreCases.value.filter((item) => item.graphReady).length }} / {{ atlas.coreCases.value.length }}
      span graph-ready cases

  .core-family-key
    span(v-for="family in families" :key="family") {{ family }}

  .core-layout(v-if="selected")
    aside.core-case-tabs(aria-label="Core cases")
      button(
        v-for="item in atlas.coreCases.value"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="item.id === selected.id"
        :data-testid="`core-case-${item.id}`"
        @click="selectedId = item.id"
      )
        span {{ item.family }}
        strong {{ item.title }}
        small(:class="item.graphReady ? 'signal-ok' : 'signal-error'") {{ item.graphReady ? 'graph ready' : 'missing graph' }}
    section.core-stage
      header.stage-header
        div
          p.eyebrow {{ selected.family }} / {{ selected.id }}
          h2 {{ selected.title }}
          p {{ selected.description }}
        .segmented-control(aria-label="Projection")
          button(type="button" :class="{ active: camera === '2d' }" @click="camera = '2d'") 2D
          button(type="button" :class="{ active: camera === '3d' }" @click="camera = '3d'") 3D
      .plot-tabs(v-if="selected.graphs.length > 1" role="tablist" aria-label="Plots")
        button(
          v-for="(graph, index) in selected.graphs"
          :key="graph.id"
          type="button"
          role="tab"
          :aria-selected="index === plotIndex"
          @click="plotIndex = index"
        ) {{ graph.label }}
      PlotlyPanel(
        v-if="activeGraph && selected.graphReady"
        :key="`${selected.id}-${activeGraph.id}-${camera}`"
        :figure="activeGraph.figure"
        :label="`${selected.title}: ${activeGraph.label}, ${camera}`"
      )
      .fail-closed-graph(v-else)
        strong CORE GRAPH NOT READY
        p This registry case has no engine figure. Coverage remains incomplete.
      .invariant-strip
        span Invariant checks
        strong(:class="selected.graphReady ? 'signal-ok' : 'signal-error'") {{ selected.graphReady ? 'ENGINE REPORTED' : 'UNAVAILABLE' }}
        span residual {{ selected.residual ?? 'unreported' }}
      .core-result-ledger
        code {{ selected.formula }}
        span {{ selected.provenance }}
        a.text-link(v-if="selected.sourceUrl" :href="selected.sourceUrl" target="_blank" rel="noreferrer") Source ↗
  .empty-state(v-else)
    strong Core registry unavailable
    p Planck surfaces, quartic roots, invariant checks, companion dynamics, manifold/dilogarithm, transform-space, constructor transforms, and coherent units must all arrive from the engine registry.
</template>
