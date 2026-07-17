<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PlotlyPanel from '../components/PlotlyPanel.vue'
import { useAtlasEngine, type FormulaRecord, type PlotFigure } from '../composables/atlasEngine'

const props = defineProps<{ id: string }>()
const atlas = useAtlasEngine()
const formula = ref<FormulaRecord | null>(null)
const loading = ref(true)
const scale = ref(1)
const loadError = ref('')

watch(() => props.id, async (id) => {
  loading.value = true
  loadError.value = ''
  formula.value = await atlas.formulaById(id)
  if (!formula.value) loadError.value = `Formula ${id} is absent from the generated registry.`
  loading.value = false
}, { immediate: true })

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
        RouterLink.text-link(to="/atlas") ← Formula atlas
        span {{ String(formula.ordinal).padStart(3, '0') }} / 288
      .detail-title
        p.eyebrow {{ formula.column }} / {{ formula.island }}
        h1 {{ formula.symbol }}
        p {{ formula.name }}
      .detail-status
        span.status-chip(:class="`is-${formula.status}`") {{ formula.status }}
        span {{ formula.classification }} basis

    section.equation-plate
      p.eyebrow Source expression
      code {{ formula.equation }}
      a.text-link(:href="formula.sourceUrl" target="_blank" rel="noreferrer") Open source page ↗

    section.signature-grid(aria-label="Equation decomposition")
      article(v-for="(value, key) in formula.decomposition" :key="key")
        span {{ key }}
        code {{ value }}

    .detail-columns
      section.audit-ledger
        .section-heading
          div
            p.eyebrow Numeric audit
            h2 Expected / computed
        dl.measurements
          div
            dt Expected
            dd {{ formula.expected }} #[small {{ formula.units }}]
          div
            dt Computed
            dd {{ formula.computed }} #[small {{ formula.units }}]
          div
            dt Residual
            dd {{ formula.residual }}
          div
            dt z-score
            dd {{ formula.zScore }}
        .dependency-block
          h3 Dependencies
          ul(v-if="formula.dependencies.length")
            li(v-for="dependency in formula.dependencies" :key="dependency") {{ dependency }}
          p(v-else) None reported by registry.
      section.graph-instrument
        .graph-controls
          label.field
            span Inversion scale R / R₀: {{ scale.toFixed(2) }}
            input(v-model.number="scale" type="range" min="0" max="2" step="0.03125")
          span Selected ○ / expected ◆ / computed +
        PlotlyPanel(
          v-if="figure && formula.graphReady"
          :figure="figure"
          :label="`${formula.name} inversion-scale sweep`"
          test-id="formula-graph-ready"
        )
        .fail-closed-graph(v-else data-testid="formula-graph-missing")
          strong GRAPH NOT READY
          p The engine did not provide graph data for this registry case. Static placeholders are prohibited.
</template>
