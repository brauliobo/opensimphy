import { readonly, shallowRef } from 'vue'
import type { FormulaDependencyNode, FormulaRecord, FormulaRegistryArtifact, FormulaResidualScale, FormulaSourceAudit } from '../types/formula'
import type { PlotFigure } from '../types/plot'
import type { PrimitiveSymbolSource, RecipeBatchResult, RecipeEvaluation, RecipeSource, TaxonomyArtifact } from '../types/engine'
import type { FormulaWorkerResponse } from '../types/workers'
import { sha256 } from '../workbench/sha256'
import FormulaWorker from '../workers/formula.worker?worker'
import { clearRuntimeAuditDomain, publishRuntimeAudit } from './runtimeAudit'

export const EXPECTED_FORMULAS = 288
export const FORMULA_IMPLEMENTATION_REVISION = 'formula-evaluator-contract-v1'
export const FORMULA_OUTPUT_SCHEMA_REVISION = 'formula-record-v7'
const FORMULA_SOURCE_URL = 'https://www.physicsmonastery.earth/288' as const
const V_M_1_SOURCE_CAVEAT = 'The source label says 100 kPa, while its p_1 dependency is 101325.003754773 Pa and expected value 0.02241396954 m^3/mol corresponds to about 101.325 kPa.'

export type { FormulaRecord } from '../types/formula'
export { sha256 } from '../workbench/sha256'

const formulas = shallowRef<FormulaRecord[]>([])
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0
let owners = 0
let ownershipGeneration = 0

export function formulaSourceRevision(recipeRevision: string, symbolRevision: string): string {
  return sha256(JSON.stringify({ recipeRevision, symbolRevision }))
}

export function formulaCompatibilityKey(id: string, recipeRevision: string, symbolRevision: string): string {
  return sha256(JSON.stringify({
    formulaId: id,
    recipeRevision,
    symbolRevision,
    implementationRevision: FORMULA_IMPLEMENTATION_REVISION,
    outputSchemaRevision: FORMULA_OUTPUT_SCHEMA_REVISION,
  }))
}

export function sourceAudit(recipe: RecipeSource): FormulaSourceAudit {
  const published = recipe.published_result?.sourceAudit
  if (!published) throw new Error(`Formula ${recipe.constant_id} has no preserved source audit`)
  if (published.kind !== recipe.expected_kind) {
    throw new Error(`Formula ${recipe.constant_id} expected kind ${recipe.expected_kind} disagrees with published ${published.kind} audit`)
  }
  if (published.kind === 'exact') {
    const assessments = ['full match', 'almost-full match', 'not a match'] as const
    if (!assessments.includes(published.assessment)
      || !Number.isSafeInteger(published.matchedDigits)
      || !Number.isSafeInteger(published.totalCompared)
      || published.matchedDigits < 0
      || published.totalCompared < 1
      || published.matchedDigits > published.totalCompared
      || published.met !== (published.assessment !== 'not a match')) {
      throw new Error(`Formula ${recipe.constant_id} has a malformed published exact audit`)
    }
    return {
      basis: 'exact',
      comparisonScope: 'source-comparison',
      criterion: 'published-significant-digit-assessment',
      assessment: published.assessment,
      matchedDigits: published.matchedDigits,
      totalCompared: published.totalCompared,
      met: published.met,
      validation: false,
    }
  }
  if (!Number.isFinite(published.zScore)
    || published.threshold !== 5.2
    || published.met !== (Math.abs(published.zScore) <= published.threshold)) {
    throw new Error(`Formula ${recipe.constant_id} has a malformed published measured audit`)
  }
  return {
    basis: 'measured',
    comparisonScope: 'source-comparison',
    criterion: 'published-5.2-sigma',
    zScore: published.zScore,
    observed: Math.abs(published.zScore),
    threshold: published.threshold,
    met: published.met,
    validation: false,
  }
}

function residualScale(recipe: RecipeSource, evaluation: RecipeEvaluation): FormulaResidualScale {
  const relative: FormulaResidualScale['relative'] = evaluation.expectedValue === 0
    ? { available: false, value: null, reason: 'expected-value-is-zero' }
    : { available: true, value: evaluation.residual / evaluation.expectedValue, denominator: 'expected-value' }
  let standardized: FormulaResidualScale['standardized']
  if (recipe.expected_kind === 'exact') standardized = { available: false, value: null, reason: 'exact-source-comparison' }
  else if (evaluation.expectedSigma === null) standardized = { available: false, value: null, reason: 'measured-sigma-unavailable' }
  else if (evaluation.zScore === null || !Number.isFinite(evaluation.zScore)) standardized = { available: false, value: null, reason: 'z-score-unavailable' }
  else standardized = { available: true, value: evaluation.zScore, scale: 'measured-sigma' }
  return {
    signedAbsolute: { value: evaluation.residual, unit: recipe.dimension },
    relative,
    standardized,
  }
}

function registryObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`)
  return value as Record<string, unknown>
}

function registryString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be a non-empty string`)
  return value
}

function registryInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${path} must be an integer`)
  return value as number
}

function registrySha256(value: unknown, path: string): string {
  const digest = registryString(value, path)
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${path} must be a lowercase SHA-256 digest`)
  return digest
}

export function parseFormulaRegistryArtifact(value: unknown): FormulaRegistryArtifact {
  const registry = registryObject(value, 'formula registry')
  if (registry.schemaVersion !== 1) throw new Error('formula registry.schemaVersion must be 1')
  const generatedAt = registryString(registry.generatedAt, 'formula registry.generatedAt')
  const inputs = registryObject(registry.inputs, 'formula registry.inputs')
  const recipes = registryObject(registry.recipes, 'formula registry.recipes')
  const count = registryInteger(recipes.count, 'formula registry.recipes.count')
  const dataUrl = registryString(recipes.dataUrl, 'formula registry.recipes.dataUrl')
  if (count !== EXPECTED_FORMULAS) throw new Error(`formula registry.recipes.count must be ${EXPECTED_FORMULAS}`)
  if (dataUrl !== '/data/generated/recipes.json') throw new Error('formula registry.recipes.dataUrl must identify recipes.json')
  if (!Array.isArray(recipes.items) || recipes.items.length !== EXPECTED_FORMULAS) {
    throw new Error(`formula registry.recipes.items must contain ${EXPECTED_FORMULAS} records`)
  }
  const items = recipes.items.map((rawItem, index) => {
    const item = registryObject(rawItem, `formula registry.recipes.items[${index}]`)
    return {
      recipeNumber: registryInteger(item.recipeNumber, `formula registry.recipes.items[${index}].recipeNumber`),
      id: registryString(item.id, `formula registry.recipes.items[${index}].id`),
      name: registryString(item.name, `formula registry.recipes.items[${index}].name`),
      wallId: registryString(item.wallId, `formula registry.recipes.items[${index}].wallId`),
    }
  })
  if (new Set(items.map(({ recipeNumber }) => recipeNumber)).size !== items.length || new Set(items.map(({ id }) => id)).size !== items.length) {
    throw new Error('formula registry recipe numbers and IDs must be unique')
  }
  return {
    schemaVersion: 1,
    generatedAt,
    inputs: {
      recipesSha256: registrySha256(inputs.recipesSha256, 'formula registry.inputs.recipesSha256'),
      symbolsSha256: registrySha256(inputs.symbolsSha256, 'formula registry.inputs.symbolsSha256'),
    },
    recipes: { count, dataUrl, items },
  }
}

function parseJsonText(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch (reason) {
    throw new Error(`${label} is not valid JSON`, { cause: reason })
  }
}

export function parseAndValidateFormulaSourceArtifacts(
  recipesText: string,
  symbolsText: string,
  registryText: string,
): { recipes: RecipeSource[]; symbols: PrimitiveSymbolSource[]; registry: FormulaRegistryArtifact } {
  const registry = parseFormulaRegistryArtifact(parseJsonText(registryText, 'formula registry.json'))
  const recipeRevision = sha256(recipesText)
  const symbolRevision = sha256(symbolsText)
  if (recipeRevision !== registry.inputs.recipesSha256) {
    throw new Error(`Formula recipes.json SHA-256 ${recipeRevision} does not match registry ${registry.inputs.recipesSha256}`)
  }
  if (symbolRevision !== registry.inputs.symbolsSha256) {
    throw new Error(`Formula symbols.json SHA-256 ${symbolRevision} does not match registry ${registry.inputs.symbolsSha256}`)
  }
  const recipes = parseJsonText(recipesText, 'formula recipes.json')
  const symbols = parseJsonText(symbolsText, 'formula symbols.json')
  if (!Array.isArray(recipes)) throw new Error('formula recipes.json must contain an array')
  if (!Array.isArray(symbols)) throw new Error('formula symbols.json must contain an array')
  return { recipes: recipes as RecipeSource[], symbols: symbols as PrimitiveSymbolSource[], registry }
}

function validateRegistryRecipes(recipes: RecipeSource[], registry: FormulaRegistryArtifact): void {
  const sourceByNumber = new Map(recipes.map((recipe) => [recipe.recipe_number, recipe]))
  for (const item of registry.recipes.items) {
    const recipe = sourceByNumber.get(item.recipeNumber)
    if (!recipe || recipe.constant_id !== item.id || recipe.display_name !== item.name || recipe.wall_id !== item.wallId) {
      throw new Error(`Formula source ${item.recipeNumber}/${item.id} does not match registry.json`)
    }
  }
}

function recipeExpressions(recipe: RecipeSource): string[] {
  return [
    ...recipe.external_geometry.numerator,
    ...recipe.external_geometry.denominator,
    ...recipe.external_boundary.numerator,
    ...recipe.external_boundary.denominator,
    ...recipe.inversion_geometry.numerator,
    ...recipe.inversion_geometry.denominator,
    recipe.root_transform.id,
  ]
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function constructorLiterals(recipe: RecipeSource, dependencies: readonly string[]): string[] {
  const tokens = new Set<string>(['1'])
  const dependencyOrder = [...dependencies].sort((left, right) => right.length - left.length || compareText(left, right))
  for (const expression of recipeExpressions(recipe)) {
    let remainder = expression
    for (const dependency of dependencyOrder) remainder = remainder.replace(new RegExp(escapeRegularExpression(dependency), 'gu'), ' ')
    for (const match of remainder.matchAll(/(^|[^\p{L}\p{M}\p{N}_])([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/gu)) {
      if (match[2]) tokens.add(match[2])
    }
  }
  return [...tokens].sort(compareText)
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

interface FormulaBuildIndex {
  recipesById: Map<string, RecipeSource>
  primitiveIds: Set<string>
  symbolsById: Map<string, PrimitiveSymbolSource>
  evaluationsById: Map<string, RecipeEvaluation>
}

function dependencyRole(token: string, index: FormulaBuildIndex): FormulaDependencyNode['role'] {
  if (token === 'IB') return 'parameter'
  if (index.recipesById.has(token)) return 'recipe'
  if (index.primitiveIds.has(token)) return 'primitive'
  return 'source-symbol'
}

function dependencyList(recipeId: string, kind: 'source' | 'runtime', index: FormulaBuildIndex): string[] {
  if (kind === 'source') {
    const recipe = index.recipesById.get(recipeId)
    if (!recipe?.published_result) throw new Error(`Formula ${recipeId} has no published dependency record`)
    return [...recipe.published_result.dependencies]
  }
  const evaluation = index.evaluationsById.get(recipeId)
  if (!evaluation) throw new Error(`Formula ${recipeId} has no runtime dependency record`)
  return [...evaluation.dependencies]
}

function buildDependencyLedger(recipe: RecipeSource, kind: 'source' | 'runtime', index: FormulaBuildIndex): FormulaRecord['sourceDependencies'] {
  const direct = dependencyList(recipe.constant_id, kind, index)
  const nodes = new Map<string, Omit<FormulaDependencyNode, 'parents'> & { parents: Set<string> }>()
  const queue: Array<{ recipeId: string; depth: number }> = [{ recipeId: recipe.constant_id, depth: 0 }]
  const expanded = new Set<string>()
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const parent = queue[cursor]!
    if (expanded.has(parent.recipeId)) continue
    expanded.add(parent.recipeId)
    for (const token of dependencyList(parent.recipeId, kind, index)) {
      if (token === recipe.constant_id) continue
      const depth = parent.depth + 1
      const current = nodes.get(token)
      if (current) {
        current.depth = Math.min(current.depth, depth)
        current.direct = current.depth === 1
        current.parents.add(parent.recipeId)
      } else {
        nodes.set(token, {
          token,
          role: dependencyRole(token, index),
          depth,
          direct: depth === 1,
          parents: new Set([parent.recipeId]),
        })
      }
      if (index.recipesById.has(token) && !expanded.has(token)) queue.push({ recipeId: token, depth })
    }
  }
  const graph = [...nodes.values()]
    .map((node) => ({ ...node, parents: [...node.parents].sort(compareText) }))
    .sort((left, right) => left.depth - right.depth || compareText(left.token, right.token))
  return { direct, graph }
}

function dependencyAgreement(source: readonly string[], runtime: readonly string[]): FormulaRecord['dependencyAgreement'] {
  const sourceSet = new Set(source)
  const runtimeSet = new Set(runtime)
  const missingFromRuntime = [...sourceSet].filter((token) => !runtimeSet.has(token)).sort(compareText)
  const extraInRuntime = [...runtimeSet].filter((token) => !sourceSet.has(token)).sort(compareText)
  return { missingFromRuntime, extraInRuntime, matches: missingFromRuntime.length === 0 && extraInRuntime.length === 0 }
}

function ratioExpression(value: RecipeSource['external_geometry']): string {
  const numerator = value.numerator.length ? value.numerator.join(' * ') : '1'
  return value.denominator.length ? `(${numerator}) / (${value.denominator.join(' * ')})` : numerator
}

function scientific(value: number): string {
  if (value === 0) return '0'
  return value.toExponential(12)
}

export interface FormulaBuildSources {
  recipes: RecipeSource[]
  symbols: PrimitiveSymbolSource[]
  evaluations: RecipeEvaluation[]
  registry: FormulaRegistryArtifact
}

function createBuildIndex(sources: FormulaBuildSources): FormulaBuildIndex {
  return {
    recipesById: new Map(sources.recipes.map((recipe) => [recipe.constant_id, recipe])),
    primitiveIds: new Set(sources.symbols.map(({ token }) => token)),
    symbolsById: new Map(sources.symbols.map((symbol) => [symbol.token, symbol])),
    evaluationsById: new Map(sources.evaluations.map((evaluation) => [evaluation.id, evaluation])),
  }
}

interface FormulaRevisions {
  recipeRevision: string
  symbolRevision: string
  sourceRevision: string
}

function meaningCaveats(recipe: RecipeSource, index: FormulaBuildIndex): string[] {
  const generated = recipe.source_caveats ?? []
  if (generated.some((caveat) => typeof caveat !== 'string' || caveat.trim() === '')) {
    throw new Error(`Formula ${recipe.constant_id} has a malformed generated source caveat`)
  }
  if (recipe.constant_id === 'V_m_1') {
    const p0 = index.symbolsById.get('p_0')
    const p1 = index.symbolsById.get('p_1')
    const reference = index.recipesById.get('V_m_0')
    const impliedPressure = Number(p0?.value) * Number(reference?.expected_value) / Number(recipe.expected_value)
    if (recipe.recipe_number !== 120
      || recipe.display_name !== 'molar volume of ideal gas (273.15 K, 100kPa)'
      || recipe.expected_value !== 0.02241396954
      || !recipe.published_result?.dependencies.includes('p_1')
      || p0?.value !== '1e5'
      || p0.dimension !== 'pascal'
      || p1?.value !== '101325.003754773'
      || p1.dimension !== 'pascal'
      || reference?.expected_value !== 0.02271095464
      || !Number.isFinite(impliedPressure)
      || Math.abs(impliedPressure - Number(p1.value)) >= 0.01
      || generated.length !== 1
      || generated[0] !== V_M_1_SOURCE_CAVEAT) {
      throw new Error('Formula V_m_1 source correction inputs do not match the generated caveat')
    }
  }
  return [
    'The source label is preserved wording, not an authoritative physical definition.',
    ...generated,
  ]
}

function guidedMeaning(recipe: RecipeSource): string {
  const name = recipe.display_name
  const coordinate = recipe.dimension === '-'
    ? 'a dimensionless numerical coordinate'
    : `a numerical value in ${recipe.dimension}`
  let meaning: string
  if (/\brelationship$/i.test(name)) {
    meaning = `The record represents the named conversion relationship "${name}", which links the two quantity representations named in the source label.`
  } else if (/\b(?:ratio|quotient)$/i.test(name)) {
    meaning = `The record represents the named comparison "${name}", formed from the numerator and denominator quantities identified by the source label.`
  } else if (/\bin\b/i.test(name)) {
    meaning = `The record represents "${name}": the named physical quantity expressed in the unit or coordinate system stated by the source label.`
  } else {
    meaning = `The record represents the physical quantity or conventional value named "${name}" by the preserved source.`
  }
  return `${meaning} Here its quantity value is written as ${coordinate}. The browser reconstruction is compared with the source-labelled ${recipe.expected_kind} reference; that comparison is not an independent definition or measurement.`
}

function adaptFormula(recipe: RecipeSource, evaluation: RecipeEvaluation, index: FormulaBuildIndex, revisions: FormulaRevisions): FormulaRecord {
  const sweep = evaluation.graph.points
  const markers = evaluation.graph.markers
  const published = recipe.published_result
  if (!published) throw new Error(`Formula ${recipe.constant_id} has no published source result`)
  const decomposition = {
    EG: ratioExpression(recipe.external_geometry),
    EB: ratioExpression(recipe.external_boundary),
    IG: ratioExpression(recipe.inversion_geometry),
    R: recipe.root_transform.id,
    IB: 'IB',
  }
  const sourceDependencies = buildDependencyLedger(recipe, 'source', index)
  const runtimeDependencies = buildDependencyLedger(recipe, 'runtime', index)
  const literals = constructorLiterals(recipe, [...sourceDependencies.direct, ...runtimeDependencies.direct])
  const agreement = dependencyAgreement(sourceDependencies.direct, runtimeDependencies.direct)
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
    meaning: {
      name: recipe.display_name,
      declaredQuantity: recipe.display_name,
      unit: recipe.dimension,
      sourceLabel: recipe.expected_digits_label,
      guidedDefinition: guidedMeaning(recipe),
      caveats: meaningCaveats(recipe, index),
      boundary: 'source-reproduction-not-independent-validation',
    },
    equation: evaluation.formula,
    equationLadder: [
      {
        stage: 'external-geometry',
        token: 'EG',
        expression: decomposition.EG,
        explanation: 'Preserved external-geometry factors from the source recipe.',
      },
      {
        stage: 'external-boundary',
        token: 'EB',
        expression: decomposition.EB,
        explanation: 'Preserved external-boundary factors from the source recipe.',
      },
      {
        stage: 'dimensionless-inversion-correction',
        token: 'IG-R-IB',
        expression: `1 + (${decomposition.IG}) * (${decomposition.R}) * IB`,
        explanation: 'The evaluator requires the inversion geometry, root transform, and IB parameter product to be dimensionless.',
      },
      {
        stage: 'root-transform',
        token: 'R',
        expression: decomposition.R,
        explanation: 'Preserved root-transform expression from the source recipe.',
      },
      {
        stage: 'complete-constructor',
        token: 'formula',
        expression: evaluation.formula,
        explanation: 'The evaluator constructor combines EG, EB, and the inversion correction without asserting scientific validation.',
      },
    ],
    column: recipe.column,
    island: recipe.island,
    classification: recipe.expected_kind,
    topic: recipe.taxonomy.topic,
    category: recipe.taxonomy.category,
    facets: recipe.taxonomy.facets,
    sourceAudit: sourceAudit(recipe),
    sourceUrl: FORMULA_SOURCE_URL,
    provenance: {
      recipeSource: {
        artifactId: 'constants-yaml',
        preservedPath: 'sources/constants.yaml',
        constantId: recipe.constant_id,
        recipeNumber: recipe.recipe_number,
        publicSourceUrl: FORMULA_SOURCE_URL,
      },
      auditSource: {
        artifactId: 'published-output',
        preservedPath: 'sources/latest-output.txt',
        constantId: recipe.constant_id,
        recipeNumber: recipe.recipe_number,
        publicSourceUrl: FORMULA_SOURCE_URL,
      },
      recipeRevision: revisions.recipeRevision,
      symbolRevision: revisions.symbolRevision,
      sourceRevision: revisions.sourceRevision,
      boundary: 'source-reproduction-not-independent-validation',
    },
    recipeRevision: revisions.recipeRevision,
    symbolRevision: revisions.symbolRevision,
    sourceRevision: revisions.sourceRevision,
    implementationRevision: FORMULA_IMPLEMENTATION_REVISION,
    outputSchemaRevision: FORMULA_OUTPUT_SCHEMA_REVISION,
    compatibility: 'same-formula-revisions-and-output-schema',
    compatibilityKey: formulaCompatibilityKey(recipe.constant_id, revisions.recipeRevision, revisions.symbolRevision),
    decomposition,
    sourceDependencies,
    runtimeDependencies,
    constructorLiterals: literals,
    dependencyAgreement: agreement,
    sourceEvaluation: {
      buildPass: published.buildPass,
      computed: published.computed,
      computedDimension: published.computedDimension,
    },
    runtimeEvaluation: {
      buildPass: evaluation.buildPass,
      computed: evaluation.scalarValue,
      precision: evaluation.precision,
      modelParity: evaluation.modelParity,
    },
    rawValues: {
      expected: recipe.expected_value,
      expectedNumeric: evaluation.expectedValue,
      computed: evaluation.scalarValue,
      model: recipe.model_value,
      modelNumeric: evaluation.modelValue,
      precision: evaluation.precision,
    },
    residualScale: residualScale(recipe, evaluation),
    dimensionAudit: evaluation.dimensionAudit,
    modelParity: evaluation.modelParity,
    computed: scientific(evaluation.scalarValue),
    expected: typeof recipe.expected_value === 'number' ? scientific(recipe.expected_value) : recipe.expected_value,
    residual: scientific(evaluation.residual),
    zScore: evaluation.zScore === null ? 'not applicable' : evaluation.zScore.toFixed(3),
    units: recipe.dimension,
    simulationGraph: evaluation.graph,
    graphPoints: evaluation.graph.points,
    graphTable: evaluation.graph.points.map((point) => ({ ...point })),
    graph,
    graphReady: evaluation.graphReady,
  }
}

export function formulaFromEvaluation(recipe: RecipeSource, evaluation: RecipeEvaluation, sources: FormulaBuildSources): FormulaRecord {
  const recipeRevision = sources.registry.inputs.recipesSha256
  const symbolRevision = sources.registry.inputs.symbolsSha256
  return adaptFormula(recipe, evaluation, createBuildIndex(sources), {
    recipeRevision,
    symbolRevision,
    sourceRevision: formulaSourceRevision(recipeRevision, symbolRevision),
  })
}

export function formulaRecordsFromEvaluations(sources: FormulaBuildSources): FormulaRecord[] {
  validateRegistryRecipes(sources.recipes, sources.registry)
  const evaluations = new Map(sources.evaluations.map((evaluation) => [evaluation.recipeNumber, evaluation]))
  const index = createBuildIndex(sources)
  const recipeRevision = sources.registry.inputs.recipesSha256
  const symbolRevision = sources.registry.inputs.symbolsSha256
  const revisions = { recipeRevision, symbolRevision, sourceRevision: formulaSourceRevision(recipeRevision, symbolRevision) }
  return sources.recipes.flatMap((recipe) => {
    const evaluation = evaluations.get(recipe.recipe_number)
    return evaluation ? [adaptFormula(recipe, evaluation, index, revisions)] : []
  }).sort((left, right) => left.ordinal - right.ordinal)
}

async function loadSources(signal: AbortSignal): Promise<{ recipes: RecipeSource[]; symbols: PrimitiveSymbolSource[]; registry: FormulaRegistryArtifact }> {
  const baseUrl = `${import.meta.env.BASE_URL}data/generated`
  const [recipeResponse, symbolResponse, registryResponse] = await Promise.all([
    fetch(`${baseUrl}/recipes.json`, { signal }),
    fetch(`${baseUrl}/symbols.json`, { signal }),
    fetch(`${baseUrl}/registry.json`, { signal }),
  ])
  if (!recipeResponse.ok || !symbolResponse.ok || !registryResponse.ok) {
    throw new Error(`Failed to load formula sources (${recipeResponse.status}, ${symbolResponse.status}, ${registryResponse.status})`)
  }
  const [recipesText, symbolsText, registryText] = await Promise.all([
    recipeResponse.text(),
    symbolResponse.text(),
    registryResponse.text(),
  ])
  if (signal.aborted) throw new DOMException('Formula source loading was cancelled', 'AbortError')
  return parseAndValidateFormulaSourceArtifacts(recipesText, symbolsText, registryText)
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
      validateRegistryRecipes(sources.recipes, sources.registry)
      const batch = await evaluateInWorker(sources.recipes, sources.symbols, attemptController.signal)
      if (batch.errors.length > 0 || batch.unresolved.length > 0 || batch.evaluations.length !== EXPECTED_FORMULAS) {
        throw new Error(`Formula evaluation completed ${batch.evaluations.length}/${EXPECTED_FORMULAS} recipes with ${batch.errors.length} errors and ${batch.unresolved.length} unresolved`)
      }
      const next = formulaRecordsFromEvaluations({ ...sources, evaluations: batch.evaluations })
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
