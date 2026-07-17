<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import WallCanvas from '../components/WallCanvas.vue'
import { useAtlasEngine, type WallMode, type WallResult } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const query = ref('')
const category = ref('all')
const selectedId = ref('')
const depth = ref(16)
const width = ref(32)
const modulus = ref(7)
const mode = ref<WallMode>('signed_log')
const progress = ref(0)
const running = ref(false)
const result = ref<WallResult | null>(null)
const simulationError = ref('')
let controller: AbortController | null = null

const categories = computed(() => [...new Set(atlas.walls.value.map((item) => item.category))].sort())
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return atlas.walls.value.filter((item) => (category.value === 'all' || item.category === category.value)
    && (!search || `${item.title} ${item.id} ${item.description}`.toLocaleLowerCase().includes(search)))
})
const selected = computed(() => atlas.walls.value.find((item) => item.id === selectedId.value) ?? filtered.value[0] ?? null)

watch(() => atlas.walls.value, (items) => {
  if (!selectedId.value && items[0]) selectedId.value = items[0].id
}, { immediate: true })
watch(filtered, (items) => {
  if (items.length && !items.some((item) => item.id === selectedId.value)) selectedId.value = items[0]?.id ?? ''
})

async function simulate(): Promise<void> {
  if (!selected.value) return
  controller?.abort()
  controller = new AbortController()
  running.value = true
  progress.value = 0
  result.value = null
  simulationError.value = ''
  try {
    result.value = await atlas.runWall(selected.value, {
      depth: depth.value,
      width: width.value,
      mode: mode.value,
      modulus: modulus.value,
    }, controller.signal, (value) => { progress.value = value })
    progress.value = 100
  } catch (reason) {
    if (!controller.signal.aborted) simulationError.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    running.value = false
  }
}

function cancel(): void {
  controller?.abort()
  running.value = false
  simulationError.value = 'Simulation cancelled.'
}
</script>

<template lang="pug">
.view
  header.view-header
    div
      p.eyebrow Instrument 03 / determinant arrays
      h1 Number Walls
    .header-stat
      strong {{ atlas.walls.value.length }} / 351
      span preserved source inputs

  .wall-layout
    aside.wall-browser
      .wall-search
        label.field
          span Search inputs
          input(v-model="query" data-testid="wall-search" type="search" placeholder="Catalan, Planck, atomic…")
        label.field
          span Category
          select(v-model="category" data-testid="wall-category")
            option(value="all") all categories
            option(v-for="item in categories" :key="item" :value="item") {{ item }}
      .wall-list(role="listbox" aria-label="Source inputs")
        button(
          v-for="item in filtered"
          :key="item.id"
          type="button"
          role="option"
          :aria-selected="selected?.id === item.id"
          @click="selectedId = item.id"
        )
          strong {{ item.title }}
          small {{ item.category }} / {{ item.kind }}
      p.list-count {{ filtered.length }} inputs shown

    section.wall-stage(v-if="selected")
      header.stage-header
        div
          p.eyebrow {{ selected.category }} / {{ selected.id }}
          h2 {{ selected.title }}
          p {{ selected.description }}
      form.wall-controls(@submit.prevent="simulate")
        label.field
          span Depth
          input(v-model.number="depth" type="number" min="2" max="50")
        label.field
          span Width
          input(v-model.number="width" type="number" min="4" max="100")
        label.field
          span Render mode
          select(v-model="mode" data-testid="wall-mode")
            option(value="mod") modulo
            option(value="valuation") valuation
            option(value="signed_log") signed log
            option(value="row_signed_log") row signed log
            option(value="small_values") small values
            option(value="zero_windows") zero windows
        label.field(v-if="mode === 'mod'")
          span Modulus
          input(v-model.number="modulus" type="number" min="2" max="997")
        button.button-link(type="submit" :disabled="running" data-testid="wall-run") {{ running ? 'Computing…' : 'Run wall' }}
        button.text-button(v-if="running" type="button" @click="cancel") Cancel
      .worker-progress(:aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" role="progressbar")
        i(:style="{ width: `${progress}%` }")
        span Worker {{ progress }}%
      p.inline-error(v-if="simulationError" role="alert") {{ simulationError }}
      .wall-result(v-if="result?.graphReady" data-testid="wall-simulation-ready")
        WallCanvas(:result="result")
      .wall-empty(v-else-if="!running && !simulationError")
        span WALL / WAITING
        p Set depth, width, modulus, and one of six modes. Computation runs in the browser worker and can be cancelled.
</template>
