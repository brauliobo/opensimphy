import { readonly, shallowRef } from 'vue'
import type { PlotFigure } from '../types/plot'
import type { PrimitiveSymbolSource, RecipeBatchResult, RecipeEvaluation, RecipeSource, RecipeTaxonomy, TaxonomyArtifact } from '../types/engine'
import type { FormulaWorkerResponse } from '../types/workers'
import FormulaWorker from '../workers/formula.worker?worker'
import { clearRuntimeAuditDomain, publishRuntimeAudit } from './runtimeAudit'

export const EXPECTED_FORMULAS = 288
const SOURCE_AUDIT_FAILURE_IDS = new Set(['V_m_1', 'n_1', 'ST_1'])

export interface FormulaRecord {
  id: string
  ordinal: number
  symbol: string
  name: string
  equation: string
  column: string
  island: string
  classification: 'exact' | 'measured'
  topic: string
  category: string
  facets: RecipeTaxonomy['facets']
  status: 'pass' | 'fail' | 'pending'
  sourceUrl: string
  decomposition: { EG: string; EB: string; IG: string; R: string; IB: string }
  dependencies: string[]
  computed: string
  expected: string
  residual: string
  zScore: string
  units: string
  graph: PlotFigure | null
  graphReady: boolean
}

const formulas = shallowRef<FormulaRecord[]>([])
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0
let owners = 0
let ownershipGeneration = 0

function ratioExpression(value: RecipeSource['external_geometry']): string {
  const numerator = value.numerator.length ? value.numerator.join(' · ') : '1'
  return value.denominator.length ? `(${numerator}) / (${value.denominator.join(' · ')})` : numerator
}

function scientific(value: number): string {
  if (value === 0) return '0'
  return value.toExponential(12)
}

export function formulaFromEvaluation(recipe: RecipeSource, evaluation: RecipeEvaluation): FormulaRecord {
  const sweep = evaluation.graph.points
  const markers = evaluation.graph.markers
  const graph: PlotFigure = {
    data: [
      {
        x: sweep.map((point) => point.x),
        y: sweep.map((point) => point.y),
        customdata: sweep.map((point) => [point.imaginary, point.magnitude, point.log10Abs]),
        type: 'scatter',
        mode: 'lines',
        name: 'computed sweep',
        line: { color: '#63cbd1', width: 2 },
        hovertemplate: 'R/R₀ %{x:.4f}<br>real %{y:.8e}<br>imag %{customdata[0]:.3e}<br>|z| %{customdata[1]:.8e}<extra></extra>',
      },
      {
        x: sweep.map((point) => point.x),
        y: sweep.map((point) => point.magnitude),
        type: 'scatter',
        mode: 'lines',
        name: 'magnitude',
        line: { color: '#efe5ce', width: 1, dash: 'dot' },
        hovertemplate: 'R/R₀ %{x:.4f}<br>|z| %{y:.8e}<extra></extra>',
      },
      ...markers.map((marker) => ({
        x: [marker.x],
        y: [marker.y],
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: marker.label,
        marker: {
          color: marker.label === 'expected' ? '#e6b85c' : '#63cbd1',
          size: marker.label === 'expected' ? 11 : 9,
          symbol: marker.label === 'expected' ? 'diamond-open' : 'cross',
        },
      })),
    ],
    layout: {
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.11, font: { size: 10 } },
      hovermode: 'x unified',
      margin: { t: 72, r: 24, b: 58, l: 76 },
    },
  }
  return {
    id: recipe.constant_id,
    ordinal: recipe.recipe_number,
    symbol: recipe.constant_id,
    name: recipe.display_name,
    equation: evaluation.formula,
    column: recipe.column,
    island: recipe.island,
    classification: recipe.expected_kind,
    topic: recipe.taxonomy.topic,
    category: recipe.taxonomy.category,
    facets: recipe.taxonomy.facets,
    status: SOURCE_AUDIT_FAILURE_IDS.has(recipe.constant_id) ? 'fail' : 'pass',
    sourceUrl: 'https://www.physicsmonastery.earth/288',
    decomposition: {
      EG: ratioExpression(recipe.external_geometry),
      EB: ratioExpression(recipe.external_boundary),
      IG: ratioExpression(recipe.inversion_geometry),
      R: recipe.root_transform.id,
      IB: 'IB',
    },
    dependencies: evaluation.dependencies,
    computed: scientific(evaluation.scalarValue),
    expected: typeof recipe.expected_value === 'number' ? scientific(recipe.expected_value) : recipe.expected_value,
    residual: scientific(evaluation.residual),
    zScore: evaluation.zScore === null ? 'not applicable' : evaluation.zScore.toFixed(3),
    units: recipe.dimension,
    graph,
    graphReady: evaluation.graphReady,
  }
}

async function loadSources(signal: AbortSignal): Promise<{ recipes: RecipeSource[]; symbols: PrimitiveSymbolSource[] }> {
  const baseUrl = `${import.meta.env.BASE_URL}data/generated`
  const [recipeResponse, symbolResponse] = await Promise.all([
    fetch(`${baseUrl}/recipes.json`, { signal }),
    fetch(`${baseUrl}/symbols.json`, { signal }),
  ])
  if (!recipeResponse.ok || !symbolResponse.ok) throw new Error(`Failed to load recipe sources (${recipeResponse.status}, ${symbolResponse.status})`)
  return {
    recipes: await recipeResponse.json() as RecipeSource[],
    symbols: await symbolResponse.json() as PrimitiveSymbolSource[],
  }
}

function evaluateInWorker(recipes: RecipeSource[], symbols: PrimitiveSymbolSource[], signal: AbortSignal): Promise<RecipeBatchResult> {
  if (signal.aborted) return Promise.reject(new DOMException('Formula evaluation was cancelled', 'AbortError'))
  const worker = new FormulaWorker()
  const requestId = `formulas-${Date.now()}`
  return new Promise((resolve, reject) => {
    const stop = () => {
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => {
      stop()
      reject(new DOMException('Formula evaluation was cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    worker.addEventListener('error', (event) => {
      stop()
      reject(new Error(event.message || 'Formula worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<FormulaWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestId) return
      stop()
      if (response.type === 'error') reject(new Error(response.error))
      else if (response.type === 'cancelled') reject(new DOMException('Formula evaluation was cancelled', 'AbortError'))
      else resolve(response.result)
    })
    worker.postMessage({ type: 'evaluate-recipes', requestId, recipes, symbols })
  })
}

function publishSuccess(items: FormulaRecord[]): void {
  publishRuntimeAudit({
    formulas: {
      status: 'ready',
      expected: EXPECTED_FORMULAS,
      evaluated: items.length,
      graphed: items.filter(({ graphReady }) => graphReady).length,
    },
  })
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    formulas.value = []
    clearRuntimeAuditDomain('formulas')
    try {
      const sources = await loadSources(attemptController.signal)
      if (!Array.isArray(sources.recipes) || sources.recipes.length !== EXPECTED_FORMULAS) {
        throw new Error(`Formula registry contains ${Array.isArray(sources.recipes) ? sources.recipes.length : 0}/${EXPECTED_FORMULAS} recipes`)
      }
      if (!Array.isArray(sources.symbols) || sources.symbols.length === 0) throw new Error('Formula symbol registry is empty')
      const batch = await evaluateInWorker(sources.recipes, sources.symbols, attemptController.signal)
      if (batch.errors.length > 0 || batch.unresolved.length > 0 || batch.evaluations.length !== EXPECTED_FORMULAS) {
        throw new Error(`Formula evaluation completed ${batch.evaluations.length}/${EXPECTED_FORMULAS} recipes with ${batch.errors.length} errors and ${batch.unresolved.length} unresolved`)
      }
      const evaluations = new Map(batch.evaluations.map((evaluation) => [evaluation.recipeNumber, evaluation]))
      const next = sources.recipes.flatMap((recipe) => {
        const evaluation = evaluations.get(recipe.recipe_number)
        return evaluation ? [formulaFromEvaluation(recipe, evaluation)] : []
      }).sort((left, right) => left.ordinal - right.ordinal)
      if (next.length !== EXPECTED_FORMULAS || next.some(({ graphReady }) => !graphReady)) throw new Error('Formula registry did not produce every required graph')
      if (attempt !== generation) return
      formulas.value = next
      publishSuccess(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      formulas.value = []
      if (attemptController.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        ready.value = false
        error.value = null
        clearRuntimeAuditDomain('formulas')
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        publishRuntimeAudit({ formulas: { status: 'error', error: error.value.message } })
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

async function formulaById(id: string): Promise<FormulaRecord | null> {
  await initialize()
  return formulas.value.find((formula) => formula.id === id || String(formula.ordinal) === id) ?? null
}

export function useFormulaRegistry() {
  return {
    formulas: readonly(formulas),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
    acquire,
    formulaById,
  }
}

function acquire(): () => void {
  owners += 1
  ownershipGeneration += 1
  void initialize()
  let released = false
  return () => {
    if (released) return
    released = true
    owners = Math.max(0, owners - 1)
    const releaseGeneration = ++ownershipGeneration
    queueMicrotask(() => {
      if (owners === 0 && ownershipGeneration === releaseGeneration && initialization && !ready.value) controller?.abort()
    })
  }
}

export function validateFormulaTaxonomyCompatibility(items: readonly FormulaRecord[], taxonomy: TaxonomyArtifact): void {
  if (items.length !== EXPECTED_FORMULAS || taxonomy.total !== EXPECTED_FORMULAS || taxonomy.total !== items.length) {
    throw new Error(`Formula/taxonomy coverage is ${items.length}/${taxonomy.total}/${EXPECTED_FORMULAS}`)
  }
  const byId = new Map(items.map((item) => [item.id, item]))
  const byOrdinal = new Map(items.map((item) => [item.ordinal, item]))
  if (byId.size !== items.length || byOrdinal.size !== items.length) throw new Error('Formula IDs and recipe numbers must be unique')
  const topics = new Map(taxonomy.topics.map((topic) => [topic.id, topic]))
  for (const item of items) {
    const topic = topics.get(item.topic)
    if (!topic) throw new Error(`Formula ${item.id} references unknown topic ${item.topic}`)
    if (!topic.categories.some((category) => category.id === item.category)) {
      throw new Error(`Formula ${item.id} references unknown category ${item.category} in topic ${item.topic}`)
    }
  }
  for (const topic of taxonomy.topics) {
    for (const featured of topic.featured) {
      const byFeaturedId = byId.get(featured.id)
      const byRecipeNumber = byOrdinal.get(featured.recipeNumber)
      if (!byFeaturedId || !byRecipeNumber || byFeaturedId !== byRecipeNumber) {
        throw new Error(`Taxonomy featured formula ${featured.id}/${featured.recipeNumber} does not resolve to one formula`)
      }
    }
  }
}

export function setFormulaRegistryForTests(value: FormulaRecord[] | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  owners = 0
  ownershipGeneration += 1
  formulas.value = []
  ready.value = false
  error.value = null
  clearRuntimeAuditDomain('formulas')
  if (!value) return
  formulas.value = value
  publishSuccess(value)
  ready.value = true
  initialization = Promise.resolve()
}

export function resetFormulaRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  owners = 0
  ownershipGeneration += 1
  formulas.value = []
  ready.value = false
  error.value = null
  initialization = null
  clearRuntimeAuditDomain('formulas')
}
