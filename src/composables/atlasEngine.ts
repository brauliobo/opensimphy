import { computed, readonly, ref } from 'vue'
import type { Config, Data, Layout } from 'plotly.js'
import { parseCompletionReport } from '../engine/completion'
import type { CoreEvaluation } from '../engine/core'
import { loadWallPayload } from '../engine/numberWall'
import { loadRecipeSources } from '../engine/recipes'
import type { CompletionReport, PrimitiveSymbolSource, RecipeBatchResult, RecipeEvaluation, RecipeSource } from '../types/engine'
import type { SimulationWorkerResponse, WallWorkerResponse } from '../types/workers'
import NumberWallWorker from '../workers/numberWall.worker?worker'
import SimulationWorker from '../workers/simulation.worker?worker'

export const EXPECTED_RECIPES = 288
export const EXPECTED_WALLS = 351
const SOURCE_AUDIT_FAILURE_IDS = new Set(['V_m_1', 'n_1', 'ST_1'])

export interface PlotFigure {
  data: Data[]
  layout?: Partial<Layout>
  config?: Partial<Config>
}

export interface FormulaRecord {
  id: string
  ordinal: number
  symbol: string
  name: string
  equation: string
  column: string
  island: string
  classification: 'exact' | 'measured'
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

export interface CoreCase {
  id: string
  title: string
  family: string
  description: string
  graphs: Array<{ id: string; label: string; figure: PlotFigure }>
  graphReady: boolean
  formula?: string
  result?: string
  residual?: string
  sourceUrl?: string
  provenance?: string
}

export interface WallInput {
  id: string
  title: string
  category: string
  kind: string
  description: string
  filename: string
  dimension?: string
}

export type WallMode = 'mod' | 'valuation' | 'signed_log' | 'row_signed_log' | 'small_values' | 'zero_windows'

export interface WallResult {
  id: string
  width: number
  depth: number
  mode: WallMode
  values: Array<Array<string | number | null>>
  min: number
  max: number
  zeroCount: number
  graphReady: boolean
}

export interface CoverageRow {
  key: 'recipes' | 'core' | 'walls'
  label: string
  expected: number
  implemented: number
  evaluated: number
  graphed: number
  simulatable: number
}

export interface AtlasSnapshot {
  formulas: FormulaRecord[]
  coreCases: CoreCase[]
  walls: WallInput[]
  coverage: CoverageRow[]
  generatedAt?: string
}

type UnknownRecord = Record<string, unknown>
const formulas = ref<FormulaRecord[]>([])
const coreCases = ref<CoreCase[]>([])
const walls = ref<WallInput[]>([])
const coverage = ref<CoverageRow[]>(closedCoverage())
const ready = ref(false)
const error = ref<Error | null>(null)
const completionVerified = ref(false)
let initialization: Promise<void> | null = null

function closedCoverage(): CoverageRow[] {
  return [
    { key: 'recipes', label: 'Formula recipes', expected: EXPECTED_RECIPES, implemented: 0, evaluated: 0, graphed: 0, simulatable: 0 },
    { key: 'core', label: 'Core cases', expected: 1, implemented: 0, evaluated: 0, graphed: 0, simulatable: 0 },
    { key: 'walls', label: 'Number-wall inputs', expected: EXPECTED_WALLS, implemented: 0, evaluated: 0, graphed: 0, simulatable: 0 },
  ]
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(record: UnknownRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return fallback
}

function ratioExpression(value: RecipeSource['external_geometry']): string {
  const numerator = value.numerator.length ? value.numerator.join(' · ') : '1'
  return value.denominator.length ? `(${numerator}) / (${value.denominator.join(' · ')})` : numerator
}

function scientific(value: number): string {
  if (value === 0) return '0'
  return value.toExponential(12)
}

function formulaFromEvaluation(recipe: RecipeSource, evaluation: RecipeEvaluation): FormulaRecord {
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

function coreFromEvaluation(evaluation: CoreEvaluation): CoreCase {
  const sweep: PlotFigure = {
    data: [{
      x: evaluation.graph.map((point) => point.x),
      y: evaluation.graph.map((point) => point.y),
      customdata: evaluation.graph.map((point) => [point.magnitude, point.log10Abs]),
      type: 'scatter',
      mode: 'lines+markers',
      name: evaluation.title,
      line: { color: '#63cbd1', width: 2 },
      marker: { color: '#e6b85c', size: 4 },
      hovertemplate: 'parameter %{x:.4f}<br>metric %{y:.8e}<br>|metric| %{customdata[0]:.8e}<extra></extra>',
    }],
    layout: {
      xaxis: { title: { text: 'case parameter / scale' } },
      yaxis: { title: { text: 'engine metric' } },
    },
  }
  const graphs: CoreCase['graphs'] = [{ id: 'sweep-2d', label: '2D parameter sweep', figure: sweep }]
  if (evaluation.surface.length > 0) {
    const isPlanckSurface = evaluation.id.startsWith('planck-')
    graphs.push({
      id: 'complex-surface-3d',
      label: isPlanckSurface ? '3D complex magnitude' : '3D root locus',
      figure: {
        data: [{
          x: evaluation.surface.map((point) => point.x),
          y: evaluation.surface.map((point) => isPlanckSurface ? point.y : point.real),
          z: evaluation.surface.map((point) => isPlanckSurface ? point.magnitude : point.imaginary),
          type: 'mesh3d',
          intensity: evaluation.surface.map((point) => point.magnitude),
          colorscale: [[0, '#213c42'], [0.5, '#63cbd1'], [1, '#e6b85c']],
          showscale: true,
          name: evaluation.title,
          hovertemplate: isPlanckSurface
            ? 'Re(z) %{x:.3f}<br>Im(z) %{y:.3f}<br>|S(z)| %{z:.6e}<extra></extra>'
            : 'parameter %{x:.3f}<br>Re(root) %{y:.6f}<br>Im(root) %{z:.6f}<extra></extra>',
        }],
        layout: {
          scene: {
            xaxis: { title: { text: isPlanckSurface ? 'Re(z)' : 'parameter' } },
            yaxis: { title: { text: isPlanckSurface ? 'Im(z)' : 'Re(root)' } },
            zaxis: { title: { text: isPlanckSurface ? '|S(z)|' : 'Im(root)' } },
          },
        },
      },
    })
  }
  return {
    id: evaluation.id,
    title: evaluation.title,
    family: evaluation.category,
    description: `${evaluation.formula} [${evaluation.provenance}]`,
    graphs,
    graphReady: evaluation.graphReady && graphs.length > 0,
    formula: evaluation.formula,
    result: JSON.stringify(evaluation.result),
    residual: evaluation.residual === null ? 'not applicable' : scientific(evaluation.residual),
    sourceUrl: evaluation.sourceUrl,
    provenance: evaluation.provenance,
  }
}

function wallFrom(record: UnknownRecord): WallInput {
  return {
    id: text(record, ['id', 'slug']),
    title: text(record, ['title', 'name']),
    category: text(record, ['category'], 'unclassified'),
    kind: text(record, ['kind'], 'terms'),
    description: text(record, ['description']),
    filename: text(record, ['filename'], `${text(record, ['id'])}.json`),
    dimension: text(record, ['dimension']),
  }
}

function coverageNumber(record: UnknownRecord | undefined, key: string, fallback: number): number {
  if (!record) return fallback
  const value = Number(record[key])
  return Number.isFinite(value) ? value : fallback
}

function expectedCoverage(record: UnknownRecord | undefined, fallback: number): number {
  return coverageNumber(record, 'expected', coverageNumber(record, 'source', fallback))
}

function normalizeCoverage(completion: UnknownRecord | null, formulaItems: FormulaRecord[], coreItems: CoreCase[], wallItems: WallInput[]): CoverageRow[] {
  const root = completion && isRecord(completion.coverage) ? completion.coverage : completion
  const domains: Array<[CoverageRow['key'], string, number, number]> = [
    ['recipes', 'Formula recipes', EXPECTED_RECIPES, formulaItems.length],
    ['core', 'Core cases', coreItems.length || 1, coreItems.length],
    ['walls', 'Number-wall inputs', EXPECTED_WALLS, wallItems.length],
  ]
  return domains.map(([key, label, hardExpected, discovered]) => {
    const aliases = key === 'recipes' ? ['recipes', 'formulas'] : key === 'walls' ? ['walls', 'numberWalls', 'number_walls'] : ['core', 'coreCases', 'core_cases']
    let supplied: UnknownRecord | undefined
    if (root) {
      for (const alias of aliases) {
        if (isRecord(root[alias])) supplied = root[alias]
      }
    }
    const expected = expectedCoverage(supplied, hardExpected)
    const implemented = coverageNumber(supplied, 'implemented', discovered)
    const evaluatedFallback = key === 'recipes' ? formulaItems.filter((item) => item.computed !== 'unreported').length : key === 'core' ? coreItems.length : 0
    const graphedFallback = key === 'recipes' ? formulaItems.filter((item) => item.graphReady).length : key === 'core' ? coreItems.filter((item) => item.graphReady).length : 0
    return {
      key,
      label,
      expected,
      implemented,
      evaluated: coverageNumber(supplied, 'evaluated', evaluatedFallback),
      graphed: coverageNumber(supplied, 'graphed', graphedFallback),
      simulatable: coverageNumber(supplied, 'simulatable', key === 'core' ? graphedFallback : 0),
    }
  })
}

async function readWallIndex(): Promise<WallInput[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/generated/walls.json`)
  if (!response.ok) throw new Error(`Number-wall registry failed to load (${response.status})`)
  const value: unknown = await response.json()
  if (!Array.isArray(value)) throw new Error('Number-wall registry is not an array')
  return value.filter(isRecord).map(wallFrom)
}

async function readCompletion(): Promise<CompletionReport> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/generated/completion.json`)
  if (!response.ok) throw new Error(`Completion report failed to load (${response.status})`)
  return parseCompletionReport(await response.json())
}

function evaluateRecipesInWorker(recipes: RecipeSource[], symbols: PrimitiveSymbolSource[]): Promise<RecipeBatchResult> {
  const worker = new SimulationWorker()
  const requestId = `recipes-${Date.now()}`
  return new Promise((resolve, reject) => {
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Recipe simulation worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<SimulationWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestId) return
      worker.terminate()
      if (response.type === 'error') reject(new Error(response.error))
      else if (response.type === 'cancelled') reject(new Error('Recipe evaluation was cancelled'))
      else if (Array.isArray(response.result)) reject(new Error('Recipe worker returned core evaluations'))
      else resolve(response.result)
    })
    worker.postMessage({ type: 'evaluate-recipes', requestId, recipes, symbols })
  })
}

function evaluateCoreInWorker(): Promise<CoreEvaluation[]> {
  const worker = new SimulationWorker()
  const requestId = `core-${Date.now()}`
  return new Promise((resolve, reject) => {
    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message || 'Core simulation worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<SimulationWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestId) return
      worker.terminate()
      if (response.type === 'error') reject(new Error(response.error))
      else if (response.type === 'cancelled') reject(new Error('Core evaluation was cancelled'))
      else if (!Array.isArray(response.result)) reject(new Error('Core worker returned recipe evaluations'))
      else resolve(response.result)
    })
    worker.postMessage({ type: 'evaluate-core', requestId })
  })
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  initialization = (async () => {
    ready.value = false
    error.value = null
    completionVerified.value = false
    try {
      const [sources, wallItems, completion] = await Promise.all([
        loadRecipeSources(`${import.meta.env.BASE_URL}data/generated`),
        readWallIndex(),
        readCompletion(),
      ])
      const [batch, coreEvaluations] = await Promise.all([
        evaluateRecipesInWorker(sources.recipes, sources.symbols),
        evaluateCoreInWorker(),
      ])
      const evaluations = new Map(batch.evaluations.map((evaluation) => [evaluation.recipeNumber, evaluation]))
      formulas.value = sources.recipes.flatMap((recipe) => {
        const evaluation = evaluations.get(recipe.recipe_number)
        return evaluation ? [formulaFromEvaluation(recipe, evaluation)] : []
      }).sort((a, b) => a.ordinal - b.ordinal)
      coreCases.value = coreEvaluations.map(coreFromEvaluation)
      walls.value = wallItems
      coverage.value = normalizeCoverage(completion as unknown as UnknownRecord, formulas.value, coreCases.value, walls.value)
      completionVerified.value = completion.complete && completion.errors.length === 0 && completion.unresolved.length === 0
      window.__OPENSIMPHY_AUDIT__ = {
        coverage: coverage.value,
        formulas: formulas.value.map(({ id, ordinal, graphReady }) => ({ id, ordinal, graphReady })),
        core: coreCases.value.map(({ id, graphReady }) => ({ id, graphReady })),
        walls: walls.value.map(({ id }) => id),
      }
    } catch (reason) {
      error.value = reason instanceof Error ? reason : new Error(String(reason))
      formulas.value = []
      coreCases.value = []
      walls.value = []
      coverage.value = closedCoverage()
    } finally {
      ready.value = true
    }
  })()
  return initialization
}

async function formulaById(id: string): Promise<FormulaRecord | null> {
  await initialize()
  const existing = formulas.value.find((formula) => formula.id === id || String(formula.ordinal) === id)
  return existing ?? null
}

async function coreCaseById(id: string): Promise<CoreCase | null> {
  await initialize()
  return coreCases.value.find((item) => item.id === id) ?? null
}

async function runWall(input: WallInput, options: { depth: number; width: number; mode: WallMode; modulus: number }, signal?: AbortSignal, onProgress?: (value: number) => void): Promise<WallResult> {
  await initialize()
  onProgress?.(5)
  const payload = await loadWallPayload(input.filename, `${import.meta.env.BASE_URL}data/number-walls`)
  if (signal?.aborted) throw new DOMException('Simulation cancelled', 'AbortError')
  onProgress?.(15)
  const worker = new NumberWallWorker()
  const requestId = `${input.id}-${Date.now()}`
  return new Promise<WallResult>((resolve, reject) => {
    const stop = () => {
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      worker.postMessage({ type: 'cancel', requestId })
      stop()
      reject(new DOMException('Simulation cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    worker.addEventListener('error', (event) => {
      stop()
      reject(new Error(event.message || 'Number-wall worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<WallWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestId) return
      if (response.type === 'error') {
        stop()
        reject(new Error(response.error))
        return
      }
      if (response.type === 'cancelled') {
        stop()
        reject(new DOMException('Simulation cancelled', 'AbortError'))
        return
      }
      const simulation = response.result
      const rows = Array.from({ length: simulation.depth + 2 }, () => Array<string | number | null>(simulation.terms).fill(null))
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      let zeroCount = 0
      for (const cell of simulation.cells) {
        const row = rows[cell.row + 1]
        if (!row || cell.column < 0 || cell.column >= row.length) continue
        const signedValue = (simulation.mode === 'signed_log' || simulation.mode === 'row_signed_log') && typeof cell.value === 'number'
          ? cell.value * (cell.sign ?? 0)
          : cell.value
        row[cell.column] = cell.exact ?? signedValue
        const numeric = typeof signedValue === 'number' ? signedValue : Number(signedValue)
        if (Number.isFinite(numeric)) {
          min = Math.min(min, numeric)
          max = Math.max(max, numeric)
          if ((simulation.mode === 'zero_windows' && numeric === 1) || (simulation.mode !== 'zero_windows' && numeric === 0)) zeroCount += 1
        }
      }
      stop()
      onProgress?.(100)
      resolve({
        id: simulation.id,
        width: simulation.terms,
        depth: simulation.depth + 2,
        mode: simulation.mode,
        values: rows,
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 0,
        zeroCount,
        graphReady: simulation.cells.length > 0,
      })
    })
    onProgress?.(25)
    worker.postMessage({
      type: 'simulate-wall',
      requestId,
      payload,
      options: {
        terms: Math.min(options.width, payload.sequence.length),
        depth: options.depth,
        mode: options.mode,
        modulus: options.modulus,
        valuationPrime: options.modulus,
      },
    })
  })
}

const complete = computed(() => coverage.value.every((row) => {
  if (row.key === 'recipes') return row.implemented === row.expected && row.evaluated === row.expected && row.graphed === row.expected
  if (row.key === 'walls') return row.implemented === row.expected && row.simulatable === row.expected
  return row.expected > 0 && row.implemented === row.expected && row.graphed === row.expected && row.simulatable === row.expected
})
  && completionVerified.value
  && formulas.value.length === EXPECTED_RECIPES
  && formulas.value.every((item) => item.graphReady)
  && walls.value.length === EXPECTED_WALLS
  && coreCases.value.length > 0
  && coreCases.value.every((item) => item.graphReady))

export function useAtlasEngine() {
  return {
    formulas: readonly(formulas),
    coreCases: readonly(coreCases),
    walls: readonly(walls),
    coverage: readonly(coverage),
    ready: readonly(ready),
    error: readonly(error),
    complete,
    initialize,
    formulaById,
    coreCaseById,
    runWall,
  }
}

export function setAtlasSnapshotForTests(snapshot: AtlasSnapshot | null): void {
  formulas.value = snapshot?.formulas ?? []
  coreCases.value = snapshot?.coreCases ?? []
  walls.value = snapshot?.walls ?? []
  coverage.value = snapshot?.coverage ?? closedCoverage()
  ready.value = true
  error.value = null
  completionVerified.value = snapshot !== null
  initialization = Promise.resolve()
}

export function resetAtlasForTests(): void {
  formulas.value = []
  coreCases.value = []
  walls.value = []
  coverage.value = closedCoverage()
  ready.value = false
  error.value = null
  completionVerified.value = false
  initialization = null
}
