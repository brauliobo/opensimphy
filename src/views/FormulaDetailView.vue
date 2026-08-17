<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PlotlyPanel from '../components/PlotlyPanel.vue'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import { useFormulaRegistry, validateFormulaTaxonomyCompatibility, type FormulaRecord } from '../registries/formulaRegistry'
import { useSavedRunRegistry } from '../registries/savedRunRegistry'
import { useTaxonomyRegistry } from '../registries/taxonomyRegistry'
import { useTourProgress } from '../registries/tourProgress'
import type { TaxonomyArtifact } from '../types/engine'
import type { FormulaDependencyLedger, FormulaDependencyNode, FormulaGraphTableRow } from '../types/formula'
import type { PlotFigure } from '../types/plot'
import type { JsonObject, WorkbenchSnapshotInputV1, WorkbenchSnapshotV1 } from '../types/workbench'
import {
  addSnapshot,
  compareSnapshotPair,
  createSnapshotPair,
  createWorkbenchSnapshot,
  removeSnapshot,
  type SnapshotPair,
} from '../workbench/snapshots'

const props = defineProps<{ id: string }>()
const formulaRegistry = useFormulaRegistry()
const taxonomyRegistry = useTaxonomyRegistry()
const savedRunRegistry = useSavedRunRegistry()
const tourProgress = useTourProgress()
const route = useRoute()
const formula = ref<FormulaRecord | null>(null)
const loading = ref(true)
const scale = ref(1)
const graphOpen = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveResult = ref('')
const saveLabel = ref('')
const revealedSteps = ref(1)
const comparisonPair = ref<SnapshotPair>(createSnapshotPair())
const constructorTokenDefinitions = [
  { token: 'EG', definition: 'External geometry: the source recipe ratio applied outside the correction term.' },
  { token: 'EB', definition: 'External boundary: the source recipe boundary ratio applied outside the correction term.' },
  { token: 'IG', definition: 'Inversion geometry: the source recipe ratio inside the dimensionless correction.' },
  { token: 'R', definition: 'Root transform: the source recipe expression multiplied inside the correction.' },
  { token: 'IB', definition: 'Inversion-boundary scale: the synthetic sensitivity parameter; its nominal source-comparison value is 1.' },
] as const
const releaseFormulaRegistry = formulaRegistry.acquire()
let loadGeneration = 0
let titleOwned: string | null = null

if (!tourProgress.hydrated.value) tourProgress.hydrate()
if (!savedRunRegistry.hydrated.value) savedRunRegistry.hydrate()

function routeDocumentTitle(): string {
  const title = typeof route.meta.title === 'string' ? route.meta.title : 'Formula Record'
  return `${title} | OpenSimPhy Atlas`
}

function resetDocumentTitle(): void {
  if (typeof document !== 'undefined' && titleOwned && document.title === titleOwned) document.title = routeDocumentTitle()
  titleOwned = null
}

function setFormulaDocumentTitle(record: FormulaRecord): void {
  if (typeof document === 'undefined') return
  titleOwned = `${record.symbol}: ${record.name} | OpenSimPhy Atlas`
  document.title = titleOwned
}

onUnmounted(() => {
  loadGeneration += 1
  resetDocumentTitle()
  releaseFormulaRegistry()
})

watch(() => props.id, async (id) => {
  const attempt = ++loadGeneration
  resetDocumentTitle()
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  saveResult.value = ''
  graphOpen.value = false
  formula.value = null
  revealedSteps.value = 1
  comparisonPair.value = createSnapshotPair()
  await Promise.all([formulaRegistry.initialize(), taxonomyRegistry.initialize()])
  if (attempt !== loadGeneration) return
  if (formulaRegistry.error.value) loadError.value = formulaRegistry.error.value.message
  else if (taxonomyRegistry.error.value) loadError.value = taxonomyRegistry.error.value.message
  else if (!taxonomyRegistry.taxonomy.value) loadError.value = 'The generated formula taxonomy is unavailable.'
  else {
    try {
      validateFormulaTaxonomyCompatibility(formulaRegistry.formulas.value as readonly FormulaRecord[], taxonomyRegistry.taxonomy.value as TaxonomyArtifact)
    } catch (reason) {
      loadError.value = reason instanceof Error ? reason.message : String(reason)
    }
    if (!loadError.value) formula.value = await formulaRegistry.formulaById(id)
    if (attempt !== loadGeneration) return
    if (!loadError.value && !formula.value) loadError.value = `Formula ${id} is absent from the generated registry.`
  }
  loading.value = false
  if (formula.value) {
    scale.value = nearestScale(formula.value.graphTable, 1)
    setFormulaDocumentTitle(formula.value)
  }
}, { immediate: true })

const recordReady = computed(() => !loading.value
  && loadError.value === ''
  && formula.value !== null
  && taxonomyRegistry.taxonomy.value !== null)
const technical = computed(() => tourProgress.depth.value === 'technical')
const classificationLabel = computed(() => `source-labelled ${formula.value?.classification ?? ''} reference`)
const selectedTopic = computed(() => taxonomyRegistry.taxonomy.value?.topics.find((item) => item.id === formula.value?.topic) ?? null)
const selectedCategory = computed(() => selectedTopic.value?.categories.find((item) => item.id === formula.value?.category) ?? null)
const atlasQueryKeys = ['q', 'topic', 'category', 'basis', 'column', 'island', 'sourceCriterion', 'dimensionAudit', 'constructor', 'representation', 'page'] as const
const backToAtlas = computed(() => ({
  path: '/atlas',
  query: Object.fromEntries(atlasQueryKeys.flatMap((key) => typeof route.query[key] === 'string' ? [[key, route.query[key]]] : [])),
}))
const safeTourReturn = computed(() => {
  const value = route.query.returnTo
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/.test(value)) return null
  const safeSegment = '[A-Za-z0-9][A-Za-z0-9._-]{0,127}'
  const safeAnchor = '[A-Za-z0-9][A-Za-z0-9._:-]{0,255}'
  return new RegExp(`^/tour/${safeSegment}/${safeSegment}(?:\\?path=quick)?(?:#${safeAnchor})?$`).test(value) ? value : null
})
const visibleEquationSteps = computed(() => formula.value?.equationLadder.slice(0, revealedSteps.value) ?? [])
const sourceCriterionName = computed(() => formula.value?.sourceAudit.basis === 'exact'
  ? 'source digit criterion'
  : 'source 5.2 sigma criterion')
const sourceCriterionState = computed(() => {
  const audit = formula.value?.sourceAudit
  if (!audit) return ''
  return audit.met ? 'criterion met' : 'criterion not met'
})
const sourceCriterionExplanation = computed(() => {
  const audit = formula.value?.sourceAudit
  if (!audit) return ''
  if (audit.basis === 'exact') {
    return `The preserved source reports ${audit.assessment}: ${audit.matchedDigits} of ${audit.totalCompared} significant digits.`
  }
  return `The preserved source reports a signed standardized residual of ${formatNumber(audit.zScore)}; its absolute value ${formatNumber(audit.observed)} is compared with the published threshold ${audit.threshold}.`
})
const scaleMinimum = computed(() => Math.min(...(formula.value?.graphTable.map(({ x }) => x) ?? [0])))
const scaleMaximum = computed(() => Math.max(...(formula.value?.graphTable.map(({ x }) => x) ?? [2])))
const scaleStep = computed(() => {
  const points = formula.value?.graphTable ?? []
  if (points.length < 2) return 0.03125
  return Math.min(...points.slice(1).map((point, index) => Math.abs(point.x - points[index]!.x)).filter((value) => value > 0))
})
const selectedSweepPoint = computed(() => nearestPoint(formula.value?.graphTable ?? [], scale.value))
const selectedFinding = computed(() => {
  const point = selectedSweepPoint.value
  if (!point) return 'No synthetic sweep point is available.'
  return `At inversion-boundary scale ${formatNumber(point.x)}, the float64 reproduction has real value ${formatNumber(point.y)}, imaginary value ${formatNumber(point.imaginary)}, magnitude ${formatNumber(point.magnitude)}, sign ${point.sign}, and is ${point.finite ? 'finite' : 'not finite'}.`
})
function groupDependencies(ledger: FormulaDependencyLedger | undefined) {
  const groups = new Map<number, Map<FormulaDependencyNode['role'], FormulaDependencyNode[]>>()
  for (const node of ledger?.graph ?? []) {
    const roles = groups.get(node.depth) ?? new Map<FormulaDependencyNode['role'], FormulaDependencyNode[]>()
    const nodes = roles.get(node.role) ?? []
    nodes.push(node)
    roles.set(node.role, nodes)
    groups.set(node.depth, roles)
  }
  return [...groups].map(([depth, roles]) => ({
    depth,
    direct: depth === 1,
    roles: [...roles].map(([role, nodes]) => ({ role, nodes })),
  }))
}
const sourceDependencyGroups = computed(() => groupDependencies(formula.value?.sourceDependencies))
const runtimeDependencyGroups = computed(() => groupDependencies(formula.value?.runtimeDependencies))
const comparison = computed(() => comparisonPair.value.length === 2 ? compareSnapshotPair(comparisonPair.value) : null)
const selectedRealDelta = computed(() => {
  if (!comparison.value?.compatible) return null
  const [left, right] = comparison.value.snapshots
  return formulaSnapshotOutputs(right).selectedSweepPoint.real - formulaSnapshotOutputs(left).selectedSweepPoint.real
})

const figure = computed<PlotFigure | null>(() => {
  if (!formula.value?.graph) return null
  const point = selectedSweepPoint.value
  const traces = [...formula.value.graph.data]
  if (point) {
    traces.push({
      x: [point.x],
      y: [point.y],
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
      xaxis: { title: { text: 'inversion-boundary scale' } },
      yaxis: { title: { text: formula.value.meaning.unit } },
      ...formula.value.graph.layout,
    },
  }
})

function nearestPoint(points: readonly FormulaGraphTableRow[], target: number): FormulaGraphTableRow | null {
  return points.reduce<FormulaGraphTableRow | null>((nearest, point) => (
    nearest === null || Math.abs(point.x - target) < Math.abs(nearest.x - target) ? point : nearest
  ), null)
}

function nearestScale(points: readonly FormulaGraphTableRow[], target: number): number {
  return nearestPoint(points, target)?.x ?? target
}

function formatNumber(value: number): string {
  if (value === 0) return '0'
  return Math.abs(value) >= 1e4 || Math.abs(value) < 1e-4 ? value.toExponential(8) : value.toPrecision(9)
}

function formatVector(vector: FormulaRecord['dimensionAudit']['computedVector'] | null): string {
  if (!vector) return 'unavailable'
  return `T^${vector.time} L^${vector.length} Q^${vector.charge} Θ^${vector.temperature} M^${vector.mass}`
}

function revealNextStep(): void {
  revealedSteps.value = Math.min(revealedSteps.value + 1, formula.value?.equationLadder.length ?? 1)
}

function revealAllSteps(): void {
  revealedSteps.value = formula.value?.equationLadder.length ?? 1
}

function toggleGraph(event: Event): void {
  graphOpen.value = (event.currentTarget as HTMLDetailsElement).open
}

interface FormulaSnapshotOutputs {
  selectedSweepPoint: {
    scale: number
    real: number
    imaginary: number
    magnitude: number
    sign: number
    finite: boolean
  }
  nominalScaleOneReproduction: {
    expected: number | string
    expectedNumeric: number
    computed: number
    signedResidual: number
    unit: string
  }
}

function formulaSnapshotOutputs(snapshot: WorkbenchSnapshotV1): FormulaSnapshotOutputs {
  return snapshot.outputs as unknown as FormulaSnapshotOutputs
}

function snapshotInput(): WorkbenchSnapshotInputV1 {
  const record = formula.value
  const point = selectedSweepPoint.value
  if (!record || !point) throw new Error('A formula and selected sweep point are required.')
  const finding = {
    kind: 'synthetic-inversion-boundary-sensitivity',
    selectedOutput: {
      scope: 'synthetic-selected-scale-output',
      text: selectedFinding.value,
      scale: point.x,
    },
    nominalScaleOneSourceComparison: {
      scope: 'nominal-scale-one-source-comparison',
      name: sourceCriterionName.value,
      state: sourceCriterionState.value,
      audit: record.sourceAudit,
      scientificValidation: false,
    },
  } satisfies JsonObject
  const provenance = {
    formulaId: record.id,
    formulaOrdinal: record.ordinal,
    source: record.provenance,
    sourceUrl: record.sourceUrl,
    outputSchemaRevision: record.outputSchemaRevision,
  } satisfies JsonObject
  return {
    instrumentId: `formula-${record.ordinal}`,
    methodId: 'float64-source-reproduction',
    inputs: { selectedScale: point.x },
    outputs: {
      selectedSweepPoint: {
        scale: point.x,
        real: point.y,
        imaginary: point.imaginary,
        magnitude: point.magnitude,
        sign: point.sign,
        finite: point.finite,
      },
      nominalScaleOneReproduction: {
        expected: record.rawValues.expected,
        expectedNumeric: record.rawValues.expectedNumeric,
        computed: record.rawValues.computed,
        signedResidual: record.residualScale.signedAbsolute.value,
        unit: record.residualScale.signedAbsolute.unit,
      },
    },
    finding,
    provenance,
    sourceRevision: record.sourceRevision,
    implementationRevision: record.implementationRevision,
    compatibilityKey: record.compatibilityKey,
    ...(saveLabel.value.trim() ? { label: saveLabel.value.trim() } : {}),
  }
}

function saveFormulaRun(): void {
  saveError.value = ''
  saveResult.value = ''
  try {
    const saved = savedRunRegistry.save(snapshotInput())
    if (savedRunRegistry.persistenceError.value) saveError.value = 'The run is available for this session, but browser storage could not save it.'
    else saveResult.value = `Saved formula run at ${saved.timestamp}.`
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function freezeForComparison(): void {
  if (comparisonPair.value.length >= 2) return
  saveError.value = ''
  try {
    const snapshot = createWorkbenchSnapshot(snapshotInput(), new Date(Date.now() + comparisonPair.value.length).toISOString())
    comparisonPair.value = addSnapshot(comparisonPair.value, snapshot)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function removeComparisonSnapshot(index: number): void {
  comparisonPair.value = removeSnapshot(comparisonPair.value, index as 0 | 1)
}

function resetComparison(): void {
  comparisonPair.value = createSnapshotPair()
}
</script>

<template lang="pug">
.view.formula-detail(:data-testid="recordReady ? 'formula-record-ready' : undefined")
  .loading-plate(v-if="loading") Loading registry case…
  .empty-state(v-else-if="loadError" role="alert")
    h1 Formula unavailable
    p {{ loadError }}
    RouterLink.text-link(to="/atlas") Return to atlas
  template(v-else-if="formula")
    nav.formula-return-context(aria-label="Formula return context")
      RouterLink.text-link(v-if="safeTourReturn" :to="safeTourReturn" data-testid="tour-return") Return to Tour lesson
      RouterLink.text-link(:to="backToAtlas" data-testid="atlas-return") ← Formula atlas

    header.detail-header.formula-record-identity(data-testid="formula-record-identity")
      .detail-index
        span Actual registry record
        strong {{ String(formula.ordinal).padStart(3, '0') }} / 288
        small {{ formula.id }}
      .detail-title
        p.eyebrow {{ selectedTopic?.shortTitle }} / {{ selectedCategory?.title }}
        h1 {{ formula.symbol }}
        p {{ formula.name }}
      .detail-status
        span {{ classificationLabel }}
        strong {{ sourceCriterionName }}: {{ sourceCriterionState }}
        span not scientific validation
        RouterLink(v-if="selectedTopic" :to="`/topics/${selectedTopic.id}`") Topic guide →

    section.formula-meaning(data-testid="formula-meaning" aria-labelledby="formula-meaning-title")
      .section-heading
        div
          p.eyebrow Meaning before constructor
          h2#formula-meaning-title What this quantity means
        TourDepthControl.formula-depth-control
      dl.meaning-grid
        div
          dt Name
          dd {{ formula.meaning.name }}
        div
          dt Preserved source target
          dd {{ formula.meaning.declaredQuantity }}
        div
          dt Declared unit
          dd {{ formula.meaning.unit }}
        div
          dt Preserved source label
          dd {{ formula.meaning.sourceLabel }}
      .guided-meaning(data-testid="guided-meaning")
        strong Named target: {{ formula.meaning.declaredQuantity }}
        p {{ formula.meaning.guidedDefinition }}
        p Taxonomy context: {{ selectedTopic?.title ?? formula.topic }} / {{ selectedCategory?.title ?? formula.category }}.
      .meaning-context
        article
          h3 {{ selectedTopic?.title ?? formula.topic }}
          p {{ selectedTopic?.description }}
        article
          h3 {{ selectedCategory?.title ?? formula.category }}
          p {{ selectedCategory?.description }}
      aside.meaning-caveats(data-testid="meaning-caveats" aria-label="Preserved source-label caveats")
        h3 Preserved-label caveats
        ul
          li(v-for="caveat in formula.meaning.caveats" :key="caveat") {{ caveat }}
      p.boundary-note This record reproduces a preserved source recipe. It does not independently validate the quantity, theory, evidence, covariance model, or source selection.

    section.result-section(data-testid="residual-scales" aria-labelledby="residual-title")
      p.eyebrow Source reproduction values
      h2#residual-title Expected, computed, and residual scale
      .result-summary
        article
          span Expected
          strong {{ formula.expected }}
          small {{ formula.meaning.unit }}
        article
          span Computed
          strong {{ formula.computed }}
          small {{ formula.meaning.unit }}
        article
          span Signed absolute residual
          strong {{ formatNumber(formula.residualScale.signedAbsolute.value) }}
          small {{ formula.residualScale.signedAbsolute.unit }}
        article(v-if="formula.residualScale.relative.available")
          span Relative residual
          strong {{ formatNumber(formula.residualScale.relative.value) }}
          small residual / expected value
        article(v-if="formula.residualScale.standardized.available" data-testid="standardized-residual")
          span Standardized residual
          strong {{ formatNumber(formula.residualScale.standardized.value) }}
          small measured sigma scale
      .source-criterion-finding(:class="`is-${sourceCriterionState.replaceAll(' ', '-')}`" data-testid="source-criterion-finding")
        strong {{ sourceCriterionName }}: {{ sourceCriterionState }}
        p {{ sourceCriterionExplanation }}
        p This source criterion is a reproduction comparison, not scientific validation. It is distinct from independent evidence, covariance treatment, and selection analysis.

    section.equation-ladder(data-testid="equation-ladder" aria-labelledby="equation-ladder-title")
      p.eyebrow Progressive reproduction equation
      h2#equation-ladder-title Equation ladder
      dl.constructor-token-key(data-testid="constructor-token-key")
        div(v-for="item in constructorTokenDefinitions" :key="item.token")
          dt {{ item.token }}
          dd {{ item.definition }}
      ol
        li(v-for="(step, index) in visibleEquationSteps" :key="step.stage")
          .equation-step-index {{ String(index + 1).padStart(2, '0') }} / {{ formula.equationLadder.length }}
          div
            h3 {{ step.stage.replaceAll('-', ' ') }} / {{ step.token }}
            code {{ step.expression }}
            p {{ step.explanation }}
      .equation-ladder-controls
        button.button-link(
          v-if="revealedSteps < formula.equationLadder.length"
          type="button"
          data-testid="reveal-equation-step"
          @click="revealNextStep"
        ) Reveal next step
        button.text-link(
          v-if="technical && revealedSteps < formula.equationLadder.length"
          type="button"
          data-testid="reveal-all-equation-steps"
          @click="revealAllSteps"
        ) Inspect all typed steps
        span(v-if="revealedSteps === formula.equationLadder.length") Complete constructor reached

    section.technical-audit(v-if="technical" data-testid="technical-audit" aria-labelledby="technical-audit-title")
      p.eyebrow Additive Technical reading
      h2#technical-audit-title Technical dependency and dimension audit
      .technical-build-ledger
        p
          span Preserved source build pass
          strong {{ formula.sourceEvaluation.buildPass }}
        p
          span Runtime build pass
          strong {{ formula.runtimeEvaluation.buildPass }}
        p
          span Runtime model parity
          strong {{ formula.runtimeEvaluation.modelParity ? 'matches preserved model value' : 'does not match preserved model value' }}
      .evaluation-ledger(data-testid="evaluation-ledger")
        article
          h3 Preserved source evaluation
          p Build pass: {{ formula.sourceEvaluation.buildPass }}
          p Computed: {{ formula.sourceEvaluation.computed ?? 'not reported' }}
          p Computed dimension: {{ formula.sourceEvaluation.computedDimension ?? 'not reported' }}
        article
          h3 Current runtime evaluation
          p Build pass: {{ formula.runtimeEvaluation.buildPass }}
          p Computed: {{ formatNumber(formula.runtimeEvaluation.computed) }}
          p Precision: {{ formula.runtimeEvaluation.precision }}
          p Model parity: {{ formula.runtimeEvaluation.modelParity ? 'yes' : 'no' }}
      .dimension-ledger
        article
          h3 Declared dimension / historical five-axis audit
          code {{ formula.dimensionAudit.declared }}
          p {{ formatVector(formula.dimensionAudit.declaredVector) }}
        article
          h3 Runtime-computed dimension / historical five-axis audit
          code {{ formatVector(formula.dimensionAudit.computedVector) }}
          p {{ formula.dimensionAudit.matches ? 'Declared and computed dimension vectors match.' : 'Declared and computed dimension vectors conflict.' }}
        p.dimension-basis-note(data-testid="dimension-basis-note") This historical five-axis basis covers T, L, Q, temperature, and mass. It treats mol as dimensionless, cannot audit amount-of-substance semantics, and never repairs preserved source dimensions.
        p.dimension-finding(data-testid="dimension-finding") {{ formula.dimensionAudit.finding ?? 'No dimension-audit finding was reported.' }}
      .dependency-agreement(data-testid="dependency-agreement" :class="formula.dependencyAgreement.matches ? 'is-match' : 'is-drift'")
        h3 Source/runtime direct dependency agreement
        strong {{ formula.dependencyAgreement.matches ? 'Direct ledgers agree.' : 'Direct ledgers differ.' }}
        p(v-if="!formula.dependencyAgreement.matches") This record is one of the v7 registry's 26 qualified direct-trace differences. The two ledgers remain separate below.
        dl
          div
            dt Missing from runtime
            dd {{ formula.dependencyAgreement.missingFromRuntime.length ? formula.dependencyAgreement.missingFromRuntime.join(', ') : 'none' }}
          div
            dt Extra in runtime
            dd {{ formula.dependencyAgreement.extraInRuntime.length ? formula.dependencyAgreement.extraInRuntime.join(', ') : 'none' }}
      .dependency-ledgers
        section.dependency-trace(data-testid="source-dependency-trace")
          h3 Preserved source dependency ledger
          p Direct tokens: {{ formula.sourceDependencies.direct.length ? formula.sourceDependencies.direct.join(', ') : 'none' }}
          p(v-if="sourceDependencyGroups.length === 0") No preserved source dependency nodes are reported.
          section(v-for="group in sourceDependencyGroups" :key="group.depth")
            h4 Depth {{ group.depth }} / {{ group.direct ? 'direct dependency' : 'transitive dependency' }}
            div(v-for="roleGroup in group.roles" :key="roleGroup.role")
              strong {{ roleGroup.role.replaceAll('-', ' ') }}
              ul
                li(v-for="node in roleGroup.nodes" :key="`${node.depth}-${node.role}-${node.token}`")
                  code {{ node.token }}
                  span {{ node.direct ? 'direct' : 'transitive' }} / parent{{ node.parents.length === 1 ? '' : 's' }} {{ node.parents.join(', ') }}
        section.dependency-trace(data-testid="runtime-dependency-trace")
          h3 Current runtime dependency ledger
          p Direct tokens: {{ formula.runtimeDependencies.direct.length ? formula.runtimeDependencies.direct.join(', ') : 'none' }}
          p(v-if="runtimeDependencyGroups.length === 0") No runtime dependency nodes are reported.
          section(v-for="group in runtimeDependencyGroups" :key="group.depth")
            h4 Depth {{ group.depth }} / {{ group.direct ? 'direct dependency' : 'transitive dependency' }}
            div(v-for="roleGroup in group.roles" :key="roleGroup.role")
              strong {{ roleGroup.role.replaceAll('-', ' ') }}
              ul
                li(v-for="node in roleGroup.nodes" :key="`${node.depth}-${node.role}-${node.token}`")
                  code {{ node.token }}
                  span {{ node.direct ? 'direct' : 'transitive' }} / parent{{ node.parents.length === 1 ? '' : 's' }} {{ node.parents.join(', ') }}
      .constructor-literals(data-testid="constructor-literals")
        h3 Constructor literals
        p These numeric tokens belong to the constructor and are not dependency nodes.
        ul
          li(v-for="literal in formula.constructorLiterals" :key="literal")
            code {{ literal }}
      .provenance-ledger
        h3 Provenance
        dl
          div
            dt Recipe source locator
            dd {{ formula.provenance.recipeSource.artifactId }} / {{ formula.provenance.recipeSource.preservedPath }} / recipe {{ formula.provenance.recipeSource.recipeNumber }} / {{ formula.provenance.recipeSource.constantId }}
          div
            dt Audit source locator
            dd {{ formula.provenance.auditSource.artifactId }} / {{ formula.provenance.auditSource.preservedPath }} / recipe {{ formula.provenance.auditSource.recipeNumber }} / {{ formula.provenance.auditSource.constantId }}
          div
            dt Recipe revision
            dd {{ formula.recipeRevision }}
          div
            dt Symbol revision
            dd {{ formula.symbolRevision }}
          div
            dt Composite source revision
            dd {{ formula.sourceRevision }}
          div
            dt Implementation revision
            dd {{ formula.implementationRevision }}
          div
            dt Output schema revision
            dd {{ formula.outputSchemaRevision }}

    section.formula-sweep(data-testid="formula-sweep" aria-labelledby="formula-sweep-title")
      p.eyebrow Synthetic sensitivity analysis
      h2#formula-sweep-title Reproduction sweep
      p This synthetic sweep varies only the inversion-boundary scale. It is not uncertainty propagation, not a physical trajectory, not independent evidence, and not scientific validation.
      .graph-controls
        label.field
          span Inversion-boundary scale: {{ formatNumber(selectedSweepPoint?.x ?? scale) }}
          input(
            v-model.number="scale"
            data-testid="sweep-scale"
            type="range"
            :min="scaleMinimum"
            :max="scaleMaximum"
            :step="scaleStep"
          )
        span Selected ○ / expected ◆ / computed +
      p.sweep-finding(data-testid="sweep-finding" role="status" aria-live="polite") {{ selectedFinding }}
      .table-scroll
        table.sweep-table(data-testid="sweep-table")
          caption All synthetic inversion-boundary sensitivity points from the source-reproduction evaluator.
          thead
            tr
              th(scope="col") Scale
              th(scope="col") Real
              th(scope="col") Imaginary
              th(scope="col") Magnitude
              th(scope="col") Sign
              th(scope="col") Finite
          tbody
            tr(v-for="point in formula.graphTable" :key="point.x" :class="{ 'is-selected': point.x === selectedSweepPoint?.x }")
              th(scope="row") {{ formatNumber(point.x) }}
              td {{ formatNumber(point.y) }}
              td {{ formatNumber(point.imaginary) }}
              td {{ formatNumber(point.magnitude) }}
              td {{ point.sign }}
              td {{ point.finite ? 'yes' : 'no' }}
      details.detail-disclosure(data-testid="graph-disclosure" @toggle="toggleGraph")
        summary
          span
            strong Interactive sweep plot
            small Lazy view of the same tabled synthetic points
          span.disclosure-action Open +
        .detail-disclosure-body
          PlotlyPanel(
            v-if="graphOpen && figure && formula.graphReady"
            :figure="figure"
            :label="`${formula.name} synthetic inversion-boundary sensitivity sweep`"
            test-id="formula-graph-ready"
          )
          .fail-closed-graph(v-else-if="graphOpen" data-testid="formula-graph-missing")
            strong GRAPH NOT READY
            p The textual finding and complete point table remain available above.

    section.formula-workbench(data-testid="formula-workbench" aria-labelledby="formula-workbench-title")
      p.eyebrow Explicit local capture
      h2#formula-workbench-title Save and compare selected scale states
      p Saving and comparison freeze the currently selected synthetic sweep point. Changing the scale does not save automatically.
      .formula-save-controls
        label.field
          span Optional saved-run label
          input(v-model="saveLabel" data-testid="save-label" type="text" maxlength="256")
        button.button-link(type="button" data-testid="save-formula-run" @click="saveFormulaRun") Save formula run
        button.button-link(
          type="button"
          data-testid="freeze-comparison"
          :disabled="comparisonPair.length >= 2"
          @click="freezeForComparison"
        ) Freeze for comparison
      p.inline-error(v-if="saveError" data-testid="formula-storage-error" role="alert") {{ saveError }}
      p.save-result(v-if="saveResult" role="status") {{ saveResult }}
      .comparison-tray(data-testid="comparison-tray")
        header
          strong In-session comparison / {{ comparisonPair.length }} of 2 states
          button.text-link(v-if="comparisonPair.length" type="button" data-testid="reset-comparison" @click="resetComparison") Reset
        p(v-if="comparisonPair.length === 0") Freeze up to two selected scale states. A third state is disabled until one is removed.
        article(v-for="(snapshot, index) in comparisonPair" :key="`${snapshot.timestamp}-${index}`")
          div
            span State {{ index + 1 }}
            strong Scale {{ formatNumber(formulaSnapshotOutputs(snapshot).selectedSweepPoint.scale) }}
            small Real {{ formatNumber(formulaSnapshotOutputs(snapshot).selectedSweepPoint.real) }}
          button.text-link(type="button" :data-testid="`remove-comparison-${index}`" @click="removeComparisonSnapshot(index)") Remove
        .comparison-finding(v-if="comparison?.compatible" data-testid="compatible-comparison")
          strong Compatible formula snapshots
          p Domain-specific residual / selected-real delta (state 2 − state 1): {{ formatNumber(selectedRealDelta ?? 0) }} {{ formula.meaning.unit }}
        .comparison-finding(v-else-if="comparison" data-testid="incompatible-comparison")
          strong Incompatible formula snapshots
          p No residual is computed. The findings are shown in parallel because the formula compatibility keys differ.
          p {{ JSON.stringify(comparison.findings[0]) }}
          p {{ JSON.stringify(comparison.findings[1]) }}

    details.detail-disclosure.raw-anatomy(data-testid="raw-anatomy")
      summary
        span
          strong Full raw constructor and source anatomy
          small Preserved components, scalar values, source locator, and revisions
        span.disclosure-action Open +
      .detail-disclosure-body
        section.equation-plate
          p.eyebrow Complete source-reproduction constructor
          code {{ formula.equation }}
          a.text-link(:href="formula.sourceUrl" target="_blank" rel="noreferrer") Open source page ↗
        section.signature-grid(aria-label="Raw equation decomposition")
          article(v-for="(value, key) in formula.decomposition" :key="key")
            span {{ key }}
            code {{ value }}
        dl.raw-value-ledger
          div
            dt Expected raw
            dd {{ formula.rawValues.expected }}
          div
            dt Expected numeric
            dd {{ formula.rawValues.expectedNumeric }}
          div
            dt Computed raw
            dd {{ formula.rawValues.computed }}
          div
            dt Preserved model
            dd {{ formula.rawValues.model }}
          div
            dt Precision
            dd {{ formula.rawValues.precision }}
          div
            dt Source locator
            dd {{ formula.provenance.recipeSource.artifactId }} / {{ formula.provenance.recipeSource.preservedPath }} / recipe {{ formula.provenance.recipeSource.recipeNumber }} / {{ formula.provenance.recipeSource.constantId }}
          div
            dt Audit locator
            dd {{ formula.provenance.auditSource.artifactId }} / {{ formula.provenance.auditSource.preservedPath }} / recipe {{ formula.provenance.auditSource.recipeNumber }} / {{ formula.provenance.auditSource.constantId }}
</template>
