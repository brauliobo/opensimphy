<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import WallCanvas from '../components/WallCanvas.vue'
import { useWallRegistry, type WallMode, type WallResult } from '../registries/wallRegistry'

const wallRegistry = useWallRegistry()
void wallRegistry.initialize()

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
let runGeneration = 0

onUnmounted(() => {
  runGeneration += 1
  controller?.abort()
  controller = null
})

const registryReady = computed(() => wallRegistry.ready.value
  && !wallRegistry.error.value
  && wallRegistry.walls.value.length > 0)
const registryError = computed(() => wallRegistry.error.value?.message
  ?? (wallRegistry.ready.value && !registryReady.value ? 'The generated number-wall index contains no inputs.' : ''))
const categories = computed(() => [...new Set(wallRegistry.walls.value.map((item) => item.category))].sort())
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return wallRegistry.walls.value.filter((item) => (category.value === 'all' || item.category === category.value)
    && (!search || `${item.title} ${item.id} ${item.description}`.toLocaleLowerCase().includes(search)))
})
const selected = computed(() => wallRegistry.walls.value.find((item) => item.id === selectedId.value) ?? filtered.value[0] ?? null)

watch(() => wallRegistry.walls.value, (items) => {
  if (!selectedId.value && items[0]) selectedId.value = items[0].id
}, { immediate: true })
watch(filtered, (items) => {
  if (items.length && !items.some((item) => item.id === selectedId.value)) selectedId.value = items[0]?.id ?? ''
})

async function simulate(): Promise<void> {
  if (!selected.value) return
  controller?.abort()
  const attempt = ++runGeneration
  const attemptController = new AbortController()
  controller = attemptController
  running.value = true
  progress.value = 0
  result.value = null
  simulationError.value = ''
  try {
    const next = await wallRegistry.runWall(selected.value, {
      depth: depth.value,
      width: width.value,
      mode: mode.value,
      modulus: modulus.value,
    }, attemptController.signal, (value) => {
      if (attempt === runGeneration && !attemptController.signal.aborted) progress.value = value
    })
    if (attempt !== runGeneration || attemptController.signal.aborted) return
    result.value = next
    progress.value = 100
  } catch (reason) {
    if (attempt === runGeneration && !attemptController.signal.aborted) simulationError.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (attempt === runGeneration) {
      running.value = false
      if (controller === attemptController) controller = null
    }
  }
}

function cancel(): void {
  runGeneration += 1
  controller?.abort()
  controller = null
  running.value = false
  simulationError.value = 'Simulation cancelled.'
}
</script>

<template lang="pug">
.view(:data-testid="registryReady ? 'wall-registry-ready' : undefined")
  header.view-header
    div
      p.eyebrow Instrument 03 / determinant arrays
      h1 Number Walls
    .header-stat(v-if="registryReady")
      strong {{ wallRegistry.walls.value.length }} / 351
      span preserved source inputs

  .loading-plate(v-if="!wallRegistry.ready.value") Loading number-wall index…
  .empty-state(v-else-if="registryError" role="alert")
    strong Number-wall registry unavailable
    p {{ registryError }}

  .wall-layout(v-else-if="registryReady")
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
