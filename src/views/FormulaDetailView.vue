<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlotlyPanel from '../components/PlotlyPanel.vue'
import { useAtlasEngine, type FormulaRecord, type PlotFigure } from '../composables/atlasEngine'

const props = defineProps<{ id: string }>()
const atlas = useAtlasEngine()
const route = useRoute()
const formula = ref<FormulaRecord | null>(null)
const loading = ref(true)
const scale = ref(1)
const graphOpen = ref(false)
const loadError = ref('')

watch(() => props.id, async (id) => {
  loading.value = true
  loadError.value = ''
  graphOpen.value = false
  formula.value = await atlas.formulaById(id)
  if (!formula.value) loadError.value = `Formula ${id} is absent from the generated registry.`
  loading.value = false
}, { immediate: true })

const selectedTopic = computed(() => atlas.taxonomy.value?.topics.find((item) => item.id === formula.value?.topic) ?? null)
const selectedCategory = computed(() => selectedTopic.value?.categories.find((item) => item.id === formula.value?.category) ?? null)
const backToAtlas = computed(() => ({
  path: '/atlas',
  query: {
    topic: typeof route.query.topic === 'string' ? route.query.topic : formula.value?.topic,
    ...(typeof route.query.category === 'string' ? { category: route.query.category } : {}),
  },
}))

const figure = computed<PlotFigure | null>(() => {
  if (!formula.value?.graph) return null
  const traces = [...formula.value.graph.data]
  const sweep = formula.value.graph.data[0]
  const xValues = Array.isArray(sweep?.x) ? sweep.x.map(Number) : []
  const yValues = Array.isArray(sweep?.y) ? sweep.y.map(Number) : []
  const selectedIndex = xValues.reduce((nearest, value, index) => (
    Math.abs(value - scale.value) < Math.abs((xValues[nearest] ?? 0) - scale.value) ? index : nearest
  ), 0)
  if (Number.isFinite(xValues[selectedIndex]) && Number.isFinite(yValues[selectedIndex])) {
    traces.push({
      x: [xValues[selectedIndex]],
      y: [yValues[selectedIndex]],
      type: 'scatter',
      mode: 'markers',
      name: 'selected sweep point',
      marker: { color: '#e6b85c', size: 10, symbol: 'circle-open' },
    })
  }
  return {
    ...formula.value.graph,
    data: traces,
    layout: {
      xaxis: { title: { text: 'inversion scale R / R₀' } },
      yaxis: { title: { text: formula.value.units } },
      ...formula.value.graph.layout,
    },
  }
})

function toggleGraph(event: Event): void {
  graphOpen.value = (event.currentTarget as HTMLDetailsElement).open
}
</script>

<template lang="pug">
.view.formula-detail
  .loading-plate(v-if="loading") Loading registry case…
  .empty-state(v-else-if="loadError" role="alert")
    strong Formula unavailable
    p {{ loadError }}
    RouterLink.text-link(to="/atlas") Return to atlas
  template(v-else-if="formula")
    header.detail-header
      .detail-index
        RouterLink.text-link(:to="backToAtlas") ← Formula atlas
        span {{ String(formula.ordinal).padStart(3, '0') }} / 288
      .detail-title
        p.eyebrow {{ selectedTopic?.shortTitle }} / {{ selectedCategory?.title }}
        h1 {{ formula.symbol }}
        p {{ formula.name }}
      .detail-status
        span.status-chip(:class="`is-${formula.status}`") {{ formula.status }}
        span {{ formula.classification }} basis
        RouterLink(v-if="selectedTopic" :to="`/topics/${selectedTopic.id}`") Topic guide →

    section.result-section
      p.eyebrow Numeric audit
      h2 Expected / computed
      .result-summary
        article
          span Expected
          strong {{ formula.expected }}
          small {{ formula.units }}
        article
          span Computed
          strong {{ formula.computed }}
          small {{ formula.units }}
        article
          span Residual
          strong {{ formula.residual }}
          small z-score {{ formula.zScore }}

    section.equation-plate
      p.eyebrow Reproduction expression
      code {{ formula.equation }}
      a.text-link(:href="formula.sourceUrl" target="_blank" rel="noreferrer") Open source page ↗

    details.detail-disclosure
      summary
        span
          strong Recipe anatomy
          small Geometry, boundary, root transform, and dependencies
        span.disclosure-action Open +
      .detail-disclosure-body
        section.signature-grid(aria-label="Equation decomposition")
          article(v-for="(value, key) in formula.decomposition" :key="key")
            span {{ key }}
            code {{ value }}
        section.dependency-block
          p.eyebrow Dependency ledger
          ul(v-if="formula.dependencies.length")
            li(v-for="dependency in formula.dependencies" :key="dependency") {{ dependency }}
          p(v-else) None reported by registry.

    details.detail-disclosure(data-testid="graph-disclosure" @toggle="toggleGraph")
      summary
        span
          strong Reproduction sweep
          small Vary the inversion-boundary scale and compare markers
        span.disclosure-action Open +
      .detail-disclosure-body
        .graph-controls
          label.field
            span Inversion scale R / R₀: {{ scale.toFixed(2) }}
            input(v-model.number="scale" type="range" min="0" max="2" step="0.03125")
          span Selected ○ / expected ◆ / computed +
        PlotlyPanel(
          v-if="graphOpen && figure && formula.graphReady"
          :figure="figure"
          :label="`${formula.name} inversion-scale sweep`"
          test-id="formula-graph-ready"
        )
        .fail-closed-graph(v-else-if="graphOpen" data-testid="formula-graph-missing")
          strong GRAPH NOT READY
          p The engine did not provide graph data for this registry case. Static placeholders are prohibited.
</template>
