<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import PlotlyPanel from '../components/PlotlyPanel.vue'
import WorkbenchCompare from '../components/workbench/WorkbenchCompare.vue'
import WorkbenchFinding from '../components/workbench/WorkbenchFinding.vue'
import WorkbenchShell from '../components/workbench/WorkbenchShell.vue'
import { useCoreRegistry } from '../registries/coreRegistry'
import { useSavedRunRegistry } from '../registries/savedRunRegistry'
import type {
  JsonObject,
  WorkbenchActionErrors,
  WorkbenchSnapshotCount,
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
  parseSafeIdQuery,
  type WorkbenchQuery,
  type WorkbenchQueryValue,
} from '../workbench/urlState'

const OWNED_QUERY_KEYS = ['case', 'projection', 'plot'] as const
const PROJECTIONS = ['2d', '3d'] as const
type Projection = typeof PROJECTIONS[number]

const coreRegistry = useCoreRegistry()
const savedRunRegistry = useSavedRunRegistry()
const route = useRoute()
const router = useRouter()
const releaseCoreRegistry = coreRegistry.acquire()
onUnmounted(releaseCoreRegistry)

const selectedId = ref('')
const projection = ref<Projection>('3d')
const selectedPlotId = ref('')
const saveError = ref('')
const saveResult = ref('')
const urlStateWarning = ref('')
const comparisonPair = ref<SnapshotPair>(createSnapshotPair())
let retainRejectedUrlWarning = false

if (!savedRunRegistry.hydrated.value) savedRunRegistry.hydrate()

const registryReady = computed(() => coreRegistry.ready.value
  && !coreRegistry.error.value
  && coreRegistry.coreCases.value.length > 0)
const registryError = computed(() => coreRegistry.error.value?.message
  ?? (coreRegistry.ready.value && !registryReady.value ? 'The generated core registry contains no cases.' : ''))
const selected = computed(() => coreRegistry.coreCases.value.find(({ id }) => id === selectedId.value)
  ?? coreRegistry.coreCases.value[0]
  ?? null)
const families = computed(() => [...new Set(coreRegistry.coreCases.value.map(({ family }) => family))])
const activeGraph = computed(() => {
  const record = selected.value
  if (!record) return null
  const explicit = record.graphs.find(({ id }) => id === selectedPlotId.value)
  if (explicit) return explicit
  const preferred = projection.value === '3d' ? '3d' : '2d'
  return record.graphs.find(({ id }) => id.includes(preferred)) ?? record.graphs[0] ?? null
})
const graphReady = computed(() => Boolean(selected.value?.graphReady && activeGraph.value))
const supports3d = computed(() => selected.value?.graphs.some(({ id }) => id.includes('3d')) ?? false)
const snapshotCount = computed(() => comparisonPair.value.length as WorkbenchSnapshotCount)
const actionErrors = computed<WorkbenchActionErrors>(() => {
  const storageError = savedRunRegistry.persistenceError.value
  const message = saveError.value || (storageError?.operation === 'hydrate'
    ? 'Browser storage could not load saved Core runs.'
    : '')
  return message ? { save: message } : {}
})

function workbenchQueryFromRoute(query: LocationQuery): WorkbenchQuery {
  const current: Record<string, WorkbenchQueryValue> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === null || typeof value === 'string') current[key] = value
    else if (value.every((item): item is string => typeof item === 'string')) current[key] = Object.freeze([...value])
  }
  return Object.freeze(current)
}

function locationQueryFromWorkbench(query: WorkbenchQuery): LocationQueryRaw {
  const next: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (typeof value === 'string' || value === null) next[key] = value
    else next[key] = [...value]
  }
  return next
}

function canonicalQuery(): WorkbenchQuery {
  const firstCase = coreRegistry.coreCases.value[0]
  return mergeOwnedQuery(
    workbenchQueryFromRoute(route.query),
    OWNED_QUERY_KEYS,
    {
      case: selectedId.value,
      projection: projection.value,
      plot: selectedPlotId.value || null,
    },
    {
      case: firstCase?.id,
      projection: supports3d.value ? '3d' : '2d',
      plot: null,
    },
  )
}

function queryMatchesRoute(next: WorkbenchQuery): boolean {
  const currentKeys = Object.keys(route.query).sort()
  const nextKeys = Object.keys(next).sort()
  return currentKeys.length === nextKeys.length
    && currentKeys.every((key, index) => key === nextKeys[index] && route.query[key] === next[key])
}

function replaceCanonicalQuery(): void {
  const next = canonicalQuery()
  if (!queryMatchesRoute(next)) void router.replace({ query: locationQueryFromWorkbench(next) })
}

function hydrateFromRoute(): void {
  const cases = coreRegistry.coreCases.value
  const firstCase = cases[0]
  if (!firstCase) return
  const requestedCase = parseSafeIdQuery(route.query.case)
  const nextCase = cases.find(({ id }) => id === requestedCase) ?? firstCase
  const nextSupports3d = nextCase.graphs.some(({ id }) => id.includes('3d'))
  const defaultProjection: Projection = nextSupports3d ? '3d' : '2d'
  const requestedProjection = parseEnumQuery(route.query.projection, nextSupports3d ? PROJECTIONS : ['2d'] as const)
  const requestedPlot = parseSafeIdQuery(route.query.plot)
  const nextPlot = nextCase.graphs.some(({ id }) => id === requestedPlot) ? requestedPlot! : ''
  const plotProjection: Projection | null = nextPlot ? (nextPlot.includes('3d') ? '3d' : '2d') : null
  const nextProjection = plotProjection ?? requestedProjection ?? defaultProjection
  const rejected = [
    route.query.case !== undefined && nextCase.id !== requestedCase ? 'case' : '',
    route.query.projection !== undefined && nextProjection !== route.query.projection ? 'projection' : '',
    route.query.plot !== undefined && nextPlot !== requestedPlot ? 'plot' : '',
  ].filter(Boolean)
  if (rejected.length) {
    urlStateWarning.value = `Requested Core URL state was rejected for ${rejected.join(', ')}. Canonical defaults were restored.`
    retainRejectedUrlWarning = true
  } else if (retainRejectedUrlWarning) {
    retainRejectedUrlWarning = false
  } else {
    urlStateWarning.value = ''
  }

  selectedId.value = nextCase.id
  projection.value = nextProjection
  selectedPlotId.value = nextPlot
  replaceCanonicalQuery()
}

watch([() => route.query, () => coreRegistry.coreCases.value], hydrateFromRoute, { immediate: true })

function selectCase(id: string): void {
  if (!coreRegistry.coreCases.value.some((item) => item.id === id)) return
  selectedId.value = id
  if (!coreRegistry.coreCases.value.find((item) => item.id === id)?.graphs.some(({ id: graphId }) => graphId.includes('3d'))) {
    projection.value = '2d'
  }
  selectedPlotId.value = ''
  saveError.value = ''
  saveResult.value = ''
  urlStateWarning.value = ''
  replaceCanonicalQuery()
}

function selectCaseEvent(event: Event): void {
  selectCase((event.target as HTMLSelectElement).value)
}

function selectProjection(value: Projection): void {
  if (value === '3d' && !supports3d.value) return
  projection.value = value
  selectedPlotId.value = ''
  saveError.value = ''
  saveResult.value = ''
  urlStateWarning.value = ''
  replaceCanonicalQuery()
}

function selectPlot(id: string): void {
  if (!selected.value?.graphs.some((graph) => graph.id === id)) return
  selectedPlotId.value = id
  projection.value = id.includes('3d') ? '3d' : '2d'
  saveError.value = ''
  saveResult.value = ''
  urlStateWarning.value = ''
  replaceCanonicalQuery()
}

function selectPlotEvent(event: Event): void {
  const id = (event.target as HTMLSelectElement).value
  if (id === '') {
    selectedPlotId.value = ''
    replaceCanonicalQuery()
    return
  }
  selectPlot(id)
}

function resetWorkbench(): void {
  const firstCase = coreRegistry.coreCases.value[0]
  if (!firstCase) return
  selectedId.value = firstCase.id
  projection.value = firstCase.graphs.some(({ id }) => id.includes('3d')) ? '3d' : '2d'
  selectedPlotId.value = ''
  comparisonPair.value = createSnapshotPair()
  saveError.value = ''
  saveResult.value = ''
  urlStateWarning.value = ''
  replaceCanonicalQuery()
}

function snapshotInput(): WorkbenchSnapshotInputV1 {
  const record = selected.value
  const graph = activeGraph.value
  if (!record || !graph || !record.graphReady) throw new Error('A graph-ready Core preset is required.')
  return {
    instrumentId: `core-${record.id}`,
    methodId: 'core-route-evaluation',
    inputs: {
      case: record.id,
      projection: projection.value,
      plot: graph.id,
    },
    outputs: {
      result: record.output,
      selectedGraphId: graph.id,
    },
    finding: cloneJsonValue(record.finding, `core.${record.id}.finding`) as JsonObject,
    provenance: cloneJsonValue(record.provenance, `core.${record.id}.provenance`) as JsonObject,
    sourceRevision: record.sourceRevision,
    implementationRevision: record.implementationRevision,
    compatibilityKey: record.compatibilityKey,
    label: `${record.title} / ${projection.value} / ${graph.label}`,
  }
}

function saveCoreRun(): void {
  saveError.value = ''
  saveResult.value = ''
  try {
    const saved = savedRunRegistry.save(snapshotInput())
    if (savedRunRegistry.persistenceError.value) {
      saveError.value = 'The Core run is available for this session, but browser storage could not save it.'
    } else {
      saveResult.value = `Saved Core run at ${saved.timestamp}.`
    }
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function freezeForComparison(): void {
  if (comparisonPair.value.length === 2) return
  saveError.value = ''
  try {
    const timestamp = new Date(Date.now() + comparisonPair.value.length).toISOString()
    const snapshot = createWorkbenchSnapshot(snapshotInput(), timestamp)
    comparisonPair.value = addSnapshot(comparisonPair.value, snapshot)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function snapshotInputs(snapshot: WorkbenchSnapshotV1): { case: string; projection: string; plot: string } {
  return snapshot.inputs as unknown as { case: string; projection: string; plot: string }
}

</script>

<template lang="pug">
.view.core-workbench(:data-testid="registryReady ? 'core-registry-ready' : undefined")
  .loading-plate(v-if="!coreRegistry.ready.value") Loading core registry…
  .empty-state(v-else-if="registryError" role="alert")
    strong Core registry unavailable
    p {{ registryError }}

  WorkbenchShell(
    v-else-if="selected"
    title="Core Lab"
    :identity="`Declared Core preset ${selected.id}`"
    :provenance="selected.provenance"
    conclusion="This graph-ready result establishes only a bounded local engine evaluation. It is not empirical evidence and does not validate a physical theory."
    execution-mode="route-evaluated"
    :status="graphReady ? 'completed' : 'failed'"
    :capabilities="{ save: true, compare: true }"
    :snapshot-count="snapshotCount"
    :has-result="graphReady"
    :action-errors="actionErrors"
    :state-warning="urlStateWarning"
    execution-message="The route-owned Core worker evaluated all 37 declared cases on route load; the selected graph-ready preset is complete."
    @reset="resetWorkbench"
    @save="saveCoreRun"
    @freeze="freezeForComparison"
    @clear-compare="comparisonPair = createSnapshotPair()"
  )
    template(#identity)
      p
        strong {{ selected.title }}
        br
        code {{ selected.id }}
        |  / declared preset {{ coreRegistry.coreCases.value.findIndex(({ id }) => id === selected.id) + 1 }} of 37

    template(#stage)
      section.core-stage
        header.stage-header
          div
            p.eyebrow {{ selected.family }} / {{ selected.id }}
            h2 {{ selected.title }}
            p {{ selected.description }}
          strong(:class="graphReady ? 'signal-ok' : 'signal-error'") {{ graphReady ? 'GRAPH READY' : 'GRAPH UNAVAILABLE' }}
        .plot-tabs(v-if="selected.graphs.length > 1" role="group" aria-label="Plots")
          button(
            v-for="graph in selected.graphs"
            :key="graph.id"
            type="button"
            :aria-pressed="graph.id === activeGraph?.id"
            :data-testid="`core-plot-${graph.id}`"
            @click="selectPlot(graph.id)"
          ) {{ graph.label }}
        PlotlyPanel(
          v-if="activeGraph && graphReady"
          :key="`${selected.id}-${activeGraph.id}-${projection}`"
          :figure="activeGraph.figure"
          :label="`${selected.title}: ${activeGraph.label}, ${projection}`"
        )
        .fail-closed-graph(v-else)
          strong CORE GRAPH NOT READY
          p This registry case has no engine figure. Coverage remains incomplete.
        .invariant-strip
          span Bounded local evaluation
          strong(:class="graphReady ? 'signal-ok' : 'signal-error'") {{ graphReady ? 'ENGINE REPORTED' : 'UNAVAILABLE' }}

    template(#essential-controls)
      .core-essential-controls
        label.field
          span Declared case preset
          select(
            :value="selected.id"
            data-testid="core-preset-select"
            @change="selectCaseEvent"
          )
            option(v-for="item in coreRegistry.coreCases.value" :key="item.id" :value="item.id") {{ item.title }} / {{ item.id }}
        fieldset.core-projection
          legend Projection
          .segmented-control
            button(type="button" :class="{ active: projection === '2d' }" :aria-pressed="projection === '2d'" data-testid="core-projection-2d" @click="selectProjection('2d')") 2D
            button(type="button" :class="{ active: projection === '3d' }" :aria-pressed="projection === '3d'" :disabled="!supports3d" data-testid="core-projection-3d" @click="selectProjection('3d')") 3D
        label.field
          span Plot presentation
          select(
            :value="selectedPlotId"
            data-testid="core-plot-select"
            @change="selectPlotEvent"
          )
            option(value="") Automatic for projection
            option(v-for="graph in selected.graphs" :key="graph.id" :value="graph.id") {{ graph.label }}

    template(#findings)
      WorkbenchFinding(:finding="selected.finding")
      WorkbenchCompare(v-if="comparisonPair.length" :pair="comparisonPair")
        template(#domain-comparison="{ snapshots }")
          p(data-testid="core-presentation-comparison")
            | Presentation changed from {{ snapshotInputs(snapshots[0]).projection }} / {{ snapshotInputs(snapshots[0]).plot }}
            |  to {{ snapshotInputs(snapshots[1]).projection }} / {{ snapshotInputs(snapshots[1]).plot }}.
            |  This describes presentation state only; no scientific residual is inferred.
      p(v-if="saveResult" role="status" data-testid="core-save-result") {{ saveResult }}

    template(#controls)
      p All 37 selections below are declared presets evaluated by the same route-owned worker.
      .core-family-key
        span(v-for="family in families" :key="family") {{ family }}
      .core-case-tabs(role="group" aria-label="Core case presets")
        button(
          v-for="item in coreRegistry.coreCases.value"
          :key="item.id"
          type="button"
          :aria-pressed="item.id === selected.id"
          :data-testid="`core-case-${item.id}`"
          @click="selectCase(item.id)"
        )
          span {{ item.family }}
          strong {{ item.title }}
          small(:class="item.graphReady ? 'signal-ok' : 'signal-error'") {{ item.graphReady ? 'graph ready' : 'missing graph' }}

    template(#method)
      dl.core-method-ledger
        div
          dt Declared formula
          dd
            code {{ selected.formula }}
        div
          dt Method
          dd One route-owned Core worker; float64 reproduction over the engine's finite case sweep.
        div
          dt Implementation revision
          dd {{ selected.implementationRevision }}
        div
          dt Output schema revision
          dd {{ selected.outputSchemaRevision }}

    template(#evidence)
      p The source locator identifies the declared preset source. It is not presented as empirical evidence or independent validation.
      dl.core-method-ledger
        div
          dt Source identity
          dd {{ selected.sourceIdentity.provenance }} / {{ selected.sourceIdentity.sourceUrl }}
        div
          dt External source revision
          dd
            code {{ selected.sourceRevision }} (not byte-pinned)
        div
          dt Compatibility key
          dd
            code {{ selected.compatibilityKey }}
      a.text-link(:href="selected.sourceUrl" target="_blank" rel="noreferrer") Open declared source (opens new tab)

    template(#raw)
      pre(data-testid="core-raw-output") {{ JSON.stringify(selected.output, null, 2) }}
</template>

<style scoped>
.core-stage,
.core-essential-controls {
  display: grid;
  gap: 1rem;
}

.core-projection {
  margin: 0;
  padding: 0;
  border: 0;
}

.core-case-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.5rem;
  max-height: 30rem;
  overflow: auto;
}

.core-case-tabs button {
  display: grid;
  gap: 0.25rem;
  text-align: left;
}

.core-method-ledger {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.core-method-ledger div {
  display: grid;
  gap: 0.25rem;
}

.core-method-ledger dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.core-workbench pre {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 42rem) {
  .core-case-tabs {
    grid-template-columns: 1fr;
    max-height: 24rem;
  }
}
</style>
