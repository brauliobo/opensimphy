<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import WallCanvas from '../components/WallCanvas.vue'
import WorkbenchCompare from '../components/workbench/WorkbenchCompare.vue'
import WorkbenchFinding from '../components/workbench/WorkbenchFinding.vue'
import WorkbenchShell from '../components/workbench/WorkbenchShell.vue'
import { isPrimeInteger } from '../math/integer'
import { useSavedRunRegistry } from '../registries/savedRunRegistry'
import { useWallRegistry, type WallMode, type WallResult, type WallRunOptions } from '../registries/wallRegistry'
import type {
  JsonObject,
  WorkbenchAction,
  WorkbenchActionErrors,
  WorkbenchExecutionStatus,
  WorkbenchFindingV1,
  WorkbenchSnapshotInputV1,
  WorkbenchSnapshotV1,
} from '../types/workbench'
import {
  addSnapshot,
  cloneJsonValue,
  createSnapshotPair,
  createWorkbenchSnapshot,
  type SnapshotPair,
} from '../workbench/snapshots'
import {
  mergeOwnedQuery,
  parseEnumQuery,
  parseIntegerQuery,
  parseQueryScalar,
  type WorkbenchQuery,
} from '../workbench/urlState'

const WALL_MODES = ['mod', 'valuation', 'signed_log', 'row_signed_log', 'small_values', 'zero_windows'] as const
const OWNED_QUERY_KEYS = ['wall', 'depth', 'width', 'mode', 'modulus', 'q', 'category'] as const
const DEFAULT_OPTIONS: WallRunOptions = { depth: 16, width: 32, mode: 'signed_log', modulus: 7 }
const PRESETS = [
  { id: 'default', label: 'Default signed-log', options: DEFAULT_OPTIONS },
  { id: 'compact', label: 'Compact signed-log (bounded)', options: { depth: 8, width: 16, mode: 'signed_log', modulus: 7 } },
  { id: 'modular-seven', label: 'Modular seven', options: { depth: 16, width: 32, mode: 'mod', modulus: 7 } },
] as const

const wallRegistry = useWallRegistry()
const savedRunRegistry = useSavedRunRegistry()
const route = useRoute()
const router = useRouter()
void wallRegistry.initialize()
if (!savedRunRegistry.hydrated.value) savedRunRegistry.hydrate()

const query = ref('')
const category = ref('all')
const selectedId = ref('')
const depth = ref(DEFAULT_OPTIONS.depth)
const width = ref(DEFAULT_OPTIONS.width)
const modulus = ref(DEFAULT_OPTIONS.modulus)
const mode = ref<WallMode>(DEFAULT_OPTIONS.mode)
const presetId = ref('default')
const progress = ref(0)
const status = ref<WorkbenchExecutionStatus>('idle')
const result = ref<WallResult | null>(null)
const simulationError = ref('')
const actionErrors = ref<WorkbenchActionErrors>({})
const actionResult = ref('')
const urlStateWarning = ref('')
const comparisonPair = ref<SnapshotPair>(createSnapshotPair())
const routeHydrated = ref(false)
let controller: AbortController | null = null
let runGeneration = 0
let freezeSequence = 0
let retainRejectedUrlWarning = false

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
const selected = computed(() => wallRegistry.walls.value.find((item) => item.id === selectedId.value) ?? null)
const running = computed(() => status.value === 'running')
const stale = computed(() => Boolean(result.value) && (
  result.value?.input.id !== selectedId.value
  || result.value.options.depth !== depth.value
  || result.value.options.width !== width.value
  || result.value.options.mode !== mode.value
  || result.value.options.modulus !== modulus.value
))
const finding = computed(() => result.value ? findingFor(result.value) : null)
const executionMessage = computed(() => stale.value
  ? 'The displayed result is stale. Its finding, save, and comparison actions remain tied to the dispatched inputs.'
  : '')
const comparisonDeltas = computed(() => {
  if (comparisonPair.value.length !== 2) return null
  const [left, right] = comparisonPair.value
  if (left.compatibilityKey !== right.compatibilityKey) return null
  const leftSummary = snapshotSummary(left)
  const rightSummary = snapshotSummary(right)
  return {
    min:       rightSummary.min === null || leftSummary.min === null ? null : rightSummary.min - leftSummary.min,
    max:       rightSummary.max === null || leftSummary.max === null ? null : rightSummary.max - leftSummary.max,
    zeroCount: rightSummary.zeroCount - leftSummary.zeroCount,
  }
})

watch([registryReady, () => route.fullPath], () => {
  if (registryReady.value) hydrateRouteState()
}, { immediate: true })

onUnmounted(() => {
  runGeneration += 1
  controller?.abort()
  controller = null
})

function currentOptions(): WallRunOptions {
  return { depth: depth.value, width: width.value, mode: mode.value, modulus: modulus.value }
}

function sameQuery(left: WorkbenchQuery, right: WorkbenchQuery): boolean {
  const normalize = (value: WorkbenchQuery) => Object.keys(value).sort().map((key) => [key, value[key]])
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

function canonicalQuery(): WorkbenchQuery {
  const firstWall = wallRegistry.walls.value[0]?.id ?? ''
  return mergeOwnedQuery(
    route.query as WorkbenchQuery,
    OWNED_QUERY_KEYS,
    {
      wall:     selectedId.value,
      depth:    depth.value,
      width:    width.value,
      mode:     mode.value,
      modulus:  modulus.value,
      q:        query.value,
      category: category.value,
    },
    {
      wall:     firstWall,
      depth:    DEFAULT_OPTIONS.depth,
      width:    DEFAULT_OPTIONS.width,
      mode:     DEFAULT_OPTIONS.mode,
      modulus:  DEFAULT_OPTIONS.modulus,
      q:        '',
      category: 'all',
    },
  )
}

function navigateState(replace = false): void {
  if (!routeHydrated.value) return
  const next = canonicalQuery()
  if (sameQuery(route.query as WorkbenchQuery, next)) return
  const location = { query: next as LocationQueryRaw }
  void (replace ? router.replace(location) : router.push(location))
}

function hydrateRouteState(): void {
  const firstWall = wallRegistry.walls.value[0]
  if (!firstWall) return
  const wallIds = wallRegistry.walls.value.map(({ id }) => id)
  const categoryIds = ['all', ...categories.value]
  const requestedWall = parseEnumQuery(route.query.wall, wallIds)
  const requestedDepth = parseIntegerQuery(route.query.depth, { min: 2, max: 50 })
  const requestedWidth = parseIntegerQuery(route.query.width, { min: 4, max: 100 })
  const requestedMode = parseEnumQuery(route.query.mode, WALL_MODES)
  const parsedModulus = parseIntegerQuery(route.query.modulus, { min: 2, max: 997 })
  const requestedModulus = requestedMode === 'valuation' && parsedModulus !== null && !isPrimeInteger(parsedModulus)
    ? null
    : parsedModulus
  selectedId.value = requestedWall ?? firstWall.id
  depth.value = requestedDepth ?? DEFAULT_OPTIONS.depth
  width.value = requestedWidth ?? DEFAULT_OPTIONS.width
  mode.value = requestedMode ?? DEFAULT_OPTIONS.mode
  modulus.value = requestedModulus ?? DEFAULT_OPTIONS.modulus
  const requestedQuery = parseQueryScalar(route.query.q)
  query.value = requestedQuery !== null && requestedQuery.length <= 200 && !/[\u0000-\u001f\u007f]/.test(requestedQuery)
    ? requestedQuery
    : ''
  category.value = parseEnumQuery(route.query.category, categoryIds) ?? 'all'
  const rejected = [
    route.query.wall !== undefined && requestedWall === null ? 'wall' : '',
    route.query.depth !== undefined && requestedDepth === null ? 'depth' : '',
    route.query.width !== undefined && requestedWidth === null ? 'width' : '',
    route.query.mode !== undefined && requestedMode === null ? 'mode' : '',
    route.query.modulus !== undefined && requestedModulus === null ? 'modulus' : '',
    route.query.q !== undefined && query.value !== route.query.q ? 'q' : '',
    route.query.category !== undefined && category.value !== route.query.category ? 'category' : '',
  ].filter(Boolean)
  if (rejected.length) {
    urlStateWarning.value = `Requested Number Walls URL state was rejected for ${rejected.join(', ')}. Canonical defaults were restored.`
    retainRejectedUrlWarning = true
  } else if (retainRejectedUrlWarning) {
    retainRejectedUrlWarning = false
  } else {
    urlStateWarning.value = ''
  }
  presetId.value = matchingPresetId()
  routeHydrated.value = true
  navigateState(true)
}

function matchingPresetId(): string {
  const options = currentOptions()
  return PRESETS.find((preset) => preset.options.depth === options.depth
    && preset.options.width === options.width
    && preset.options.mode === options.mode
    && preset.options.modulus === options.modulus)?.id ?? ''
}

function normalizeControls(): void {
  if (!Number.isSafeInteger(depth.value) || depth.value < 2 || depth.value > 50) depth.value = DEFAULT_OPTIONS.depth
  if (!Number.isSafeInteger(width.value) || width.value < 4 || width.value > 100) width.value = DEFAULT_OPTIONS.width
  if (!Number.isSafeInteger(modulus.value) || modulus.value < 2 || modulus.value > 997) modulus.value = DEFAULT_OPTIONS.modulus
  if (mode.value === 'valuation' && !isPrimeInteger(modulus.value)) modulus.value = DEFAULT_OPTIONS.modulus
}

function commitControls(): void {
  normalizeControls()
  urlStateWarning.value = ''
  presetId.value = matchingPresetId()
  navigateState()
}

function selectSource(id: string): void {
  urlStateWarning.value = ''
  selectedId.value = id
  navigateState()
}

function applyPreset(): void {
  const preset = PRESETS.find(({ id }) => id === presetId.value)
  if (!preset) return
  depth.value = preset.options.depth
  width.value = preset.options.width
  mode.value = preset.options.mode
  modulus.value = preset.options.modulus
  urlStateWarning.value = ''
  navigateState()
}

function clearAction(action: WorkbenchAction): void {
  const { [action]: _removed, ...remaining } = actionErrors.value
  actionErrors.value = remaining
  actionResult.value = ''
  urlStateWarning.value = ''
}

function failAction(action: WorkbenchAction, reason: unknown): void {
  actionErrors.value = {
    ...actionErrors.value,
    [action]: reason instanceof Error ? reason.message : String(reason),
  }
}

async function simulate(): Promise<void> {
  const wall = selected.value
  if (!wall) return
  controller?.abort()
  const attempt = ++runGeneration
  const attemptController = new AbortController()
  controller = attemptController
  status.value = 'running'
  progress.value = 0
  result.value = null
  simulationError.value = ''
  clearAction('run')
  try {
    const next = await wallRegistry.runWall(wall, currentOptions(), attemptController.signal, (value) => {
      if (attempt === runGeneration && !attemptController.signal.aborted) progress.value = value
    })
    if (attempt !== runGeneration || attemptController.signal.aborted) return
    result.value = next
    progress.value = 100
    status.value = 'completed'
  } catch (reason) {
    if (attempt !== runGeneration || attemptController.signal.aborted) return
    simulationError.value = reason instanceof Error ? reason.message : String(reason)
    status.value = 'failed'
    failAction('run', reason)
  } finally {
    if (attempt === runGeneration && controller === attemptController) controller = null
  }
}

function stopActiveRun(): void {
  runGeneration += 1
  controller?.abort()
  controller = null
}

function cancel(): void {
  if (!running.value) return
  stopActiveRun()
  status.value = 'cancelled'
  simulationError.value = 'Simulation cancelled.'
}

function reset(): void {
  stopActiveRun()
  retainRejectedUrlWarning = false
  const firstWall = wallRegistry.walls.value[0]
  selectedId.value = firstWall?.id ?? ''
  depth.value = DEFAULT_OPTIONS.depth
  width.value = DEFAULT_OPTIONS.width
  mode.value = DEFAULT_OPTIONS.mode
  modulus.value = DEFAULT_OPTIONS.modulus
  query.value = ''
  category.value = 'all'
  presetId.value = 'default'
  progress.value = 0
  status.value = 'idle'
  result.value = null
  simulationError.value = ''
  actionErrors.value = {}
  actionResult.value = ''
  urlStateWarning.value = ''
  comparisonPair.value = createSnapshotPair()
  navigateState()
}

function findingFor(completed: WallResult): WorkbenchFindingV1 {
  const options = completed.options
  const source = completed.sourceProvenance
  return {
    schemaVersion: 1,
    changed: `The bounded matrix transform produced ${completed.min === null ? 'no finite display extrema' : `display minimum ${completed.min} and display maximum ${completed.max}`}, with ${completed.zeroCount} exact zero cells.`,
    cause: `The selected ${completed.input.title} recurrence (${completed.input.id}) was evaluated in ${options.mode} mode at width ${options.width}, depth ${options.depth}, and modulus/prime ${options.modulus}.`,
    equation: 'W(r,c) = det(a[c-i+j]) for 0 <= i,j <= r; display transform is selected by mode.',
    assumptions: [
      'The fetched integer sequence and registry identity are the complete inputs to this bounded run.',
      'Bareiss exact determinant recurrence is evaluated only over the requested finite width and depth.',
      'Display modes transform computed cells; they do not add observational measurements.',
    ],
    establishes: 'A local bounded matrix transform of the selected recurrence under the exact dispatched options.',
    doesNotEstablish: 'Physical evidence, pattern significance, a null model, or scientific validation of a theory.',
    provenance: {
      claimClass:         'bounded-computational-transform',
      evidenceRefs:       [source.url],
      sourceRevision:     completed.sourceRevision,
      sourceLocator:      `${source.url} / ${source.filename} / SHA-256 ${source.sha256}`,
      methodRelationship: 'local-number-wall-determinant-transform',
      modelOrigin:        'selected-recurrence-payload',
      resultStatus:       'computed',
      caveats: [
        'The matrix is bounded by the dispatched width and depth.',
        'No physical evidence, pattern-significance test, or null model is evaluated.',
      ],
      implementationRevision: completed.implementationRevision,
      outputSchemaRevision:   completed.outputSchemaRevision,
    },
    validatesTheory: false,
  }
}

function snapshotInput(completed: WallResult): WorkbenchSnapshotInputV1 {
  const completedFinding = findingFor(completed)
  return {
    instrumentId: 'number-walls',
    methodId:     'bareiss-determinant-wall',
    inputs: cloneJsonValue({
      wall:    completed.input,
      payload: completed.payload,
      options: completed.options,
    }, 'number-walls.inputs'),
    outputs: {
      matrix:     completed.values,
      exactZeroMask: completed.exactZeroMask,
      min:        completed.min,
      max:        completed.max,
      zeroCount:  completed.zeroCount,
      width:      completed.width,
      depth:      completed.depth,
      mode:       completed.mode,
      graphReady: completed.graphReady,
    },
    finding: completedFinding as unknown as JsonObject,
    provenance: {
      sourceUrl:           completed.sourceProvenance.url,
      filename:            completed.sourceProvenance.filename,
      sha256:              completed.sourceProvenance.sha256,
      outputSchemaRevision: completed.outputSchemaRevision,
    },
    sourceRevision:         completed.sourceRevision,
    implementationRevision: completed.implementationRevision,
    compatibilityKey:       completed.compatibilityKey,
    label:                  `${completed.input.title} / ${completed.options.mode}`,
  }
}

function save(): void {
  const completed = result.value
  if (!completed) return
  clearAction('save')
  try {
    const saved = savedRunRegistry.save(snapshotInput(completed))
    if (savedRunRegistry.persistenceError.value) {
      failAction('save', 'The run is available for this session, but browser storage could not save it.')
    } else {
      actionResult.value = `Saved number-wall run at ${saved.timestamp}.`
    }
  } catch (reason) {
    failAction('save', reason)
  }
}

function freeze(): void {
  const completed = result.value
  if (!completed || comparisonPair.value.length >= 2) return
  clearAction('freeze')
  try {
    freezeSequence += 1
    const timestamp = new Date(Date.now() + freezeSequence).toISOString()
    const snapshot = createWorkbenchSnapshot(snapshotInput(completed), timestamp)
    comparisonPair.value = addSnapshot(comparisonPair.value, snapshot)
  } catch (reason) {
    failAction('freeze', reason)
  }
}

function clearComparison(): void {
  comparisonPair.value = createSnapshotPair()
  clearAction('clear-compare')
}

function snapshotSummary(snapshot: WorkbenchSnapshotV1): { min: number | null; max: number | null; zeroCount: number } {
  const outputs = snapshot.outputs as unknown as { min: number | null; max: number | null; zeroCount: number }
  return { min: outputs.min, max: outputs.max, zeroCount: outputs.zeroCount }
}
</script>

<template lang="pug">
.view.number-walls(:data-testid="registryReady ? 'wall-registry-ready' : undefined")
  .loading-plate(v-if="!wallRegistry.ready.value") Loading number-wall index…
  .empty-state(v-else-if="registryError" role="alert")
    strong Number-wall registry unavailable
    p {{ registryError }}

  WorkbenchShell(
    v-else-if="registryReady && selected"
    title="Number Walls"
    :identity="`${selected.title} / ${selected.id}`"
    :provenance="finding?.provenance"
    conclusion="This instrument establishes only a bounded local matrix transform; it does not establish physical evidence or pattern significance."
    execution-mode="manual"
    :status="status"
    :progress="progress"
    :capabilities="{ save: true, compare: true }"
    :snapshot-count="comparisonPair.length"
    :has-result="Boolean(result)"
    :execution-message="executionMessage"
    :action-errors="actionErrors"
    :state-warning="urlStateWarning"
    :action-labels="{ run: 'Run wall' }"
    @run="simulate"
    @cancel="cancel"
    @reset="reset"
    @save="save"
    @freeze="freeze"
    @clear-compare="clearComparison"
  )
    template(#stage)
      .wall-stage
        header.stage-header
          div
            p.eyebrow {{ selected.category }} / {{ selected.id }}
            h2 {{ selected.title }}
            p {{ selected.description }}
          span.stale-badge(v-if="stale" data-testid="wall-result-stale") stale result
        p.inline-error(v-if="simulationError" role="alert") {{ simulationError }}
        .wall-result(v-if="result?.graphReady" data-testid="wall-simulation-ready")
          WallCanvas(:result="result")
        .wall-empty(v-else)
          span {{ running ? 'WALL / COMPUTING' : 'WALL / WAITING' }}
          p(v-if="running") The selected payload is being evaluated in a fresh browser worker.
          p(v-else) Choose a source and bounded options, then run the local determinant transform.

    template(#essential-controls)
      .essential-grid
        label.field
          span Source recurrence
          select(v-model="selectedId" data-testid="wall-source" @change="commitControls")
            option(v-for="item in wallRegistry.walls.value" :key="item.id" :value="item.id") {{ item.title }}
        label.field
          span Render mode
          select(v-model="mode" data-testid="wall-mode" @change="commitControls")
            option(value="mod") modulo
            option(value="valuation") valuation
            option(value="signed_log") signed log
            option(value="row_signed_log") row signed log
            option(value="small_values") small values
            option(value="zero_windows") zero windows
        label.field
          span Named preset
          select(v-model="presetId" data-testid="wall-preset" @change="applyPreset")
            option(value="" disabled) custom bounded state
            option(v-for="preset in PRESETS" :key="preset.id" :value="preset.id") {{ preset.label }}
    template(#findings)
      WorkbenchFinding(v-if="finding" :finding="finding")
      p(v-else) Run the selected recurrence to produce a structured bounded-transform finding.
      p.action-result(v-if="actionResult" role="status") {{ actionResult }}
      WorkbenchCompare(:pair="comparisonPair")
        template(#domain-comparison)
          dl.wall-deltas(v-if="comparisonDeltas" data-testid="wall-compatible-deltas")
            div
              dt Display-minimum delta
              dd {{ comparisonDeltas.min ?? 'not available' }}
            div
              dt Display-maximum delta
              dd {{ comparisonDeltas.max ?? 'not available' }}
            div
              dt Exact-zero-count delta
              dd {{ comparisonDeltas.zeroCount }}

    template(#controls)
      .full-controls
        label.field
          span Depth
          input(v-model.number="depth" data-testid="wall-depth" type="number" min="2" max="50" @change="commitControls")
        label.field
          span Width
          input(v-model.number="width" data-testid="wall-width" type="number" min="4" max="100" @change="commitControls")
        label.field
          span {{ mode === 'valuation' ? 'Valuation prime' : mode === 'mod' ? 'Modulus' : 'Display parameter (unused in this mode)' }}
          input(v-model.number="modulus" data-testid="wall-modulus" type="number" min="2" max="997" @change="commitControls")
        label.field.wall-filter
          span Filter sources
          input(v-model="query" data-testid="wall-search" type="search" maxlength="200" placeholder="Catalan, Planck, atomic…" @input="navigateState()")
        label.field
          span Category
          select(v-model="category" data-testid="wall-category" @change="navigateState()")
            option(value="all") all categories
            option(v-for="item in categories" :key="item" :value="item") {{ item }}
      .wall-list(role="group" aria-label="Source inputs")
        button(
          v-for="item in filtered"
          :key="item.id"
          type="button"
          :aria-pressed="selected.id === item.id"
          @click="selectSource(item.id)"
        )
          strong {{ item.title }}
          small {{ item.category }} / {{ item.kind }}
      p.list-count {{ filtered.length }} inputs shown

    template(#method)
      p Each cell uses the exact Bareiss determinant recurrence #[code W(r,c) = det(a[c-i+j])]. The worker computes a finite matrix and applies only the selected display transform.
      p The compatibility contract includes wall ID, exact payload hash, mode, width, depth, implementation revision, and output schema revision. Modular and valuation comparisons additionally require the same modulus or prime; modes that do not use this parameter omit it.

    template(#evidence)
      dl.source-ledger(v-if="result")
        div
          dt Source URL
          dd {{ result.sourceProvenance.url }}
        div
          dt Filename
          dd {{ result.sourceProvenance.filename }}
        div
          dt SHA-256
          dd {{ result.sourceProvenance.sha256 }}
        div
          dt Implementation revision
          dd {{ result.implementationRevision }}
        div
          dt Output schema revision
          dd {{ result.outputSchemaRevision }}
      p(v-else) Source payload text, hash, and worker revisions are recorded only when Run is dispatched.

    template(#raw)
      pre(v-if="result") {{ JSON.stringify({ id: result.id, options: result.options, width: result.width, depth: result.depth, mode: result.mode, displayMin: result.min, displayMax: result.max, exactZeroCount: result.zeroCount, compatibilityKey: result.compatibilityKey }, null, 2) }}
      p(v-else) No matrix result has been produced.
</template>

<style scoped>
.number-walls {
  min-width: 0;
}

.wall-stage,
.essential-grid,
.full-controls,
.source-ledger,
.wall-deltas {
  display: grid;
  gap: 0.85rem;
}

.stage-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stage-header h2,
.stage-header p {
  margin: 0;
}

.stale-badge {
  border: 1px solid currentColor;
  padding: 0.25rem 0.45rem;
  color: #d89b5c;
  font: 700 0.68rem/1 monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wall-empty {
  display: grid;
  min-height: 18rem;
  place-content: center;
  padding: 2rem;
  border: 1px dashed rgb(255 255 255 / 22%);
  text-align: center;
}

.wall-empty span {
  font: 700 0.78rem/1 monospace;
  letter-spacing: 0.14em;
}

.full-controls {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.wall-filter {
  grid-column: span 2;
}

.wall-list {
  display: grid;
  max-height: 24rem;
  margin-top: 1rem;
  overflow: auto;
  border-block: 1px solid rgb(255 255 255 / 15%);
}

.wall-list button {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem;
  border: 0;
  border-bottom: 1px solid rgb(255 255 255 / 10%);
  background: transparent;
  color: inherit;
  text-align: left;
}

.wall-list button[aria-pressed='true'] {
  background: rgb(99 203 209 / 13%);
  color: #8de0e4;
}

.source-ledger div,
.wall-deltas div {
  display: grid;
  grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr);
  gap: 0.75rem;
}

.source-ledger dd,
.wall-deltas dd {
  margin: 0;
  overflow-wrap: anywhere;
}

pre {
  overflow: auto;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .full-controls {
    grid-template-columns: 1fr;
  }

  .wall-filter {
    grid-column: auto;
  }

  .stage-header,
  .wall-list button {
    align-items: start;
    flex-direction: column;
  }
}
</style>
