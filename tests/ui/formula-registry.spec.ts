import recipesJson from '../../public/data/generated/recipes.json'
import registryJson from '../../public/data/generated/registry.json'
import symbolsJson from '../../public/data/generated/symbols.json'
import { evaluateRecipes } from '../../src/engine/recipes'
import {
  FORMULA_IMPLEMENTATION_REVISION,
  FORMULA_OUTPUT_SCHEMA_REVISION,
  formulaFromEvaluation,
  formulaSourceRevision,
  formulaRecordsFromEvaluations,
  parseAndValidateFormulaSourceArtifacts,
  parseFormulaRegistryArtifact,
  sha256,
} from '../../src/registries/formulaRegistry'
import type { FormulaRecord } from '../../src/types/formula'
import type { PrimitiveSymbolSource, RecipeEvaluation, RecipeSource } from '../../src/types/engine'

const recipes = recipesJson as RecipeSource[]
const symbols = symbolsJson as PrimitiveSymbolSource[]
const registry = parseFormulaRegistryArtifact(registryJson)
const recipesText = `${JSON.stringify(recipesJson, null, 2)}\n`
const symbolsText = `${JSON.stringify(symbolsJson, null, 2)}\n`
const registryText = `${JSON.stringify(registryJson, null, 2)}\n`
const batch = evaluateRecipes(recipes, symbols, { graphSteps: 3 })
const sources = { recipes, symbols, evaluations: batch.evaluations, registry }
const records = formulaRecordsFromEvaluations(sources)

function record(id: string): FormulaRecord {
  const result = records.find((item) => item.id === id)
  if (!result) throw new Error(`Missing generated formula ${id}`)
  return result
}

function evaluation(id: string): RecipeEvaluation {
  const result = batch.evaluations.find((item) => item.id === id)
  if (!result) throw new Error(`Missing generated evaluation ${id}`)
  return result
}

function recipe(id: string): RecipeSource {
  const result = recipes.find((item) => item.constant_id === id)
  if (!result) throw new Error(`Missing generated recipe ${id}`)
  return result
}

describe('formula registry data model', () => {
  it('uses the preserved exact assessments and measured source decisions', () => {
    expect(records.filter(({ sourceAudit }) => sourceAudit.basis === 'exact')).toHaveLength(70)
    expect(records.filter(({ sourceAudit }) => sourceAudit.basis === 'exact' && sourceAudit.met)).toHaveLength(68)
    expect(records.filter(({ sourceAudit }) => sourceAudit.basis === 'measured')).toHaveLength(218)
    expect(records.filter(({ sourceAudit }) => sourceAudit.basis === 'measured' && sourceAudit.met)).toHaveLength(217)
    const unmetExact = records
      .filter(({ sourceAudit }) => sourceAudit.basis === 'exact' && !sourceAudit.met)
      .map(({ id }) => id)
    const unmetMeasured = records
      .filter(({ sourceAudit }) => sourceAudit.basis === 'measured' && !sourceAudit.met)
      .map(({ id }) => id)

    expect(unmetExact).toEqual(['V_m_1', 'n_1'])
    expect(unmetMeasured).toEqual(['ST_1'])
    expect(record('V_m_1').sourceAudit).toEqual({
      basis: 'exact',
      comparisonScope: 'source-comparison',
      criterion: 'published-significant-digit-assessment',
      assessment: 'not a match',
      matchedDigits: 7,
      totalCompared: 10,
      met: false,
      validation: false,
    })
    expect(record('n_1').sourceAudit).toMatchObject({
      assessment: 'not a match',
      matchedDigits: 7,
      met: false,
    })
    expect(record('Delta_nu_Cs').sourceAudit).toMatchObject({ assessment: 'full match', matchedDigits: 10, totalCompared: 10, met: true })
    expect(record('G_0^-1').sourceAudit).toMatchObject({ assessment: 'almost-full match', matchedDigits: 9, totalCompared: 10, met: true })
    expect(record('ST_1').sourceAudit).toMatchObject({
      basis: 'measured',
      comparisonScope: 'source-comparison',
      criterion: 'published-5.2-sigma',
      zScore: -76.64,
      observed: 76.64,
      threshold: 5.2,
      met: false,
      validation: false,
    })
    expect(records.every((item) => !Object.hasOwn(item, 'status'))).toBe(true)
  })

  it('keeps the published measured audit separate from runtime standardized residuals', () => {
    const measuredRecipe = recipe('ST_1')
    const measuredEvaluation = evaluation('ST_1')
    const unavailable = formulaFromEvaluation(
      measuredRecipe,
      { ...measuredEvaluation, zScore: null },
      { ...sources, evaluations: batch.evaluations.map((item) => item.id === measuredEvaluation.id ? { ...item, zScore: null } : item) },
    )

    expect(unavailable.sourceAudit).toEqual(record('ST_1').sourceAudit)
    expect(unavailable.sourceAudit).toMatchObject({ zScore: -76.64, met: false })
    expect(unavailable.residualScale.standardized).toEqual({
      available: false,
      value: null,
      reason: 'z-score-unavailable',
    })
    expect(() => formulaFromEvaluation(
      { ...recipe('ST_1'), expected_kind: 'exact' },
      measuredEvaluation,
      sources,
    )).toThrow(/expected kind exact disagrees with published measured audit/)
  })

  it('retains raw values, residual scales, dimensions, graph points, and evaluator findings', () => {
    expect(records).toHaveLength(288)
    expect(records.filter(({ dimensionAudit }) => !dimensionAudit.matches)).toHaveLength(68)
    expect(records.every(({ sourceEvaluation, runtimeEvaluation, modelParity, graphReady }) => sourceEvaluation.buildPass >= 1 && runtimeEvaluation.buildPass >= 1 && modelParity && graphReady)).toBe(true)

    const measured = record('ST_1')
    expect(measured.rawValues).toEqual({
      expected: recipe('ST_1').expected_value,
      expectedNumeric: evaluation('ST_1').expectedValue,
      computed: evaluation('ST_1').scalarValue,
      model: recipe('ST_1').model_value,
      modelNumeric: evaluation('ST_1').modelValue,
      precision: 'float64-reproduction',
    })
    expect(measured.residualScale.signedAbsolute).toEqual({ value: evaluation('ST_1').residual, unit: '-' })
    expect(measured.residualScale.relative).toEqual({
      available: true,
      value: evaluation('ST_1').residual / evaluation('ST_1').expectedValue,
      denominator: 'expected-value',
    })
    expect(measured.residualScale.standardized).toEqual({
      available: true,
      value: evaluation('ST_1').zScore,
      scale: 'measured-sigma',
    })
    expect(measured.graphPoints).toEqual(evaluation('ST_1').graph.points)
    expect(measured.graphTable).toEqual(evaluation('ST_1').graph.points)
    expect(measured.sourceEvaluation).toEqual({
      buildPass: recipe('ST_1').published_result!.buildPass,
      computed: recipe('ST_1').published_result!.computed,
      computedDimension: recipe('ST_1').published_result!.computedDimension,
    })
    expect(measured.runtimeEvaluation).toEqual({
      buildPass: evaluation('ST_1').buildPass,
      computed: evaluation('ST_1').scalarValue,
      precision: 'float64-reproduction',
      modelParity: true,
    })

    const exactRecipe = { ...recipe('Delta_nu_Cs'), expected_value: 0, expected_digits: '0', model_value: '0' }
    const exactEvaluation = { ...evaluation('Delta_nu_Cs'), expectedValue: 0, expectedSigma: null, residual: 2, zScore: null }
    const zeroExpected = formulaFromEvaluation(exactRecipe, exactEvaluation, sources)
    expect(zeroExpected.residualScale.relative).toEqual({ available: false, value: null, reason: 'expected-value-is-zero' })
    expect(zeroExpected.residualScale.standardized).toEqual({ available: false, value: null, reason: 'exact-source-comparison' })
  })

  it('keeps deterministic source/runtime graphs, parent edges, and constructor literals separate', () => {
    const rebuilt = formulaRecordsFromEvaluations(sources)
    expect(rebuilt.map(({ sourceDependencies, runtimeDependencies }) => ({ sourceDependencies, runtimeDependencies })))
      .toEqual(records.map(({ sourceDependencies, runtimeDependencies }) => ({ sourceDependencies, runtimeDependencies })))

    const transitiveRecord = records.find(({ runtimeDependencies }) => runtimeDependencies.graph.some(({ role, depth }) => role === 'recipe' && depth === 1))
    expect(transitiveRecord).toBeDefined()
    expect(transitiveRecord!.runtimeDependencies.graph.some(({ depth }) => depth > 1)).toBe(true)
    expect(transitiveRecord!.runtimeDependencies.graph.some(({ token, role, parents }) => token === 'IB' && role === 'parameter' && parents.length > 1)).toBe(true)
    expect(transitiveRecord!.runtimeDependencies.graph.some(({ role }) => role === 'primitive')).toBe(true)
    expect(transitiveRecord!.constructorLiterals).toContain('1')
    const mismatches = records.filter(({ dependencyAgreement }) => !dependencyAgreement.matches)
    expect(records.filter(({ dependencyAgreement }) => dependencyAgreement.matches)).toHaveLength(262)
    expect(mismatches).toHaveLength(26)
    expect(mismatches.filter(({ dependencyAgreement }) => dependencyAgreement.missingFromRuntime.includes('zeta(2)'))).toHaveLength(15)
    expect(mismatches.filter(({ dependencyAgreement }) => dependencyAgreement.missingFromRuntime.includes('zeta(3)'))).toHaveLength(6)
    expect(mismatches.filter(({ dependencyAgreement }) => dependencyAgreement.extraInRuntime.includes('D_Do'))).toHaveLength(3)
    expect(mismatches.filter(({ dependencyAgreement }) => dependencyAgreement.missingFromRuntime.includes('P') && dependencyAgreement.extraInRuntime.includes('P*'))).toHaveLength(1)
    expect(mismatches.filter(({ dependencyAgreement }) => dependencyAgreement.missingFromRuntime.includes('\u0393(5)'))).toHaveLength(1)

    for (const item of records) {
      const source = recipe(item.id).published_result!.dependencies
      const runtime = evaluation(item.id).dependencies
      expect(item.sourceDependencies.direct).toEqual(source)
      expect(item.runtimeDependencies.direct).toEqual(runtime)
      const missingFromRuntime = [...new Set(source)].filter((token) => !new Set(runtime).has(token)).sort()
      const extraInRuntime = [...new Set(runtime)].filter((token) => !new Set(source).has(token)).sort()
      expect(item.dependencyAgreement).toEqual({
        missingFromRuntime,
        extraInRuntime,
        matches: missingFromRuntime.length === 0 && extraInRuntime.length === 0,
      })
      for (const graph of [item.sourceDependencies.graph, item.runtimeDependencies.graph]) {
        expect(new Set(graph.map(({ token }) => token)).size).toBe(graph.length)
        expect(graph).toEqual([...graph].sort((left, right) => left.depth - right.depth || (left.token < right.token ? -1 : left.token > right.token ? 1 : 0)))
        expect(graph.every(({ token }) => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))).toBe(true)
        expect(graph.every(({ depth, direct, parents }) => direct === (depth === 1) && parents.length > 0 && new Set(parents).size === parents.length)).toBe(true)
      }
      expect(item.constructorLiterals.every((token) => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))).toBe(true)
    }

    const cycleA = { ...recipe('Delta_nu_Cs'), published_result: { ...recipe('Delta_nu_Cs').published_result!, dependencies: ['G_0^-1'] } }
    const cycleB = { ...recipe('G_0^-1'), published_result: { ...recipe('G_0^-1').published_result!, dependencies: ['Delta_nu_Cs'] } }
    const runtimeA = { ...evaluation('Delta_nu_Cs'), dependencies: ['G_0^-1'] }
    const runtimeB = { ...evaluation('G_0^-1'), dependencies: ['Delta_nu_Cs'] }
    const cyclic = formulaFromEvaluation(cycleA, runtimeA, {
      ...sources,
      recipes: recipes.map((item) => item.constant_id === cycleA.constant_id ? cycleA : item.constant_id === cycleB.constant_id ? cycleB : item),
      evaluations: batch.evaluations.map((item) => item.id === runtimeA.id ? runtimeA : item.id === runtimeB.id ? runtimeB : item),
    })
    expect(cyclic.sourceDependencies.graph).toEqual([{
      token: 'G_0^-1',
      role: 'recipe',
      depth: 1,
      direct: true,
      parents: ['Delta_nu_Cs'],
    }])
    expect(cyclic.runtimeDependencies.graph).toEqual(cyclic.sourceDependencies.graph)
  })

  it('publishes meaning, equation, provenance, and revision boundaries with SHA-256 compatibility', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    const first = records[0]!
    const same = formulaRecordsFromEvaluations(sources)[0]!
    const second = records[1]!
    const changedSymbolRevision = '0'.repeat(64)
    const changedSymbols = formulaRecordsFromEvaluations({
      ...sources,
      registry: { ...registry, inputs: { ...registry.inputs, symbolsSha256: changedSymbolRevision } },
    })[0]!

    expect(first.meaning).toEqual({
      name: recipe(first.id).display_name,
      declaredQuantity: recipe(first.id).display_name,
      unit: recipe(first.id).dimension,
      sourceLabel: recipe(first.id).expected_digits_label,
      guidedDefinition: `The record represents the physical quantity or conventional value named "${recipe(first.id).display_name}" by the preserved source. Here its quantity value is written as a numerical value in ${recipe(first.id).dimension}. The browser reconstruction is compared with the source-labelled exact reference; that comparison is not an independent definition or measurement.`,
      caveats: ['The source label is preserved wording, not an authoritative physical definition.'],
      boundary: 'source-reproduction-not-independent-validation',
    })
    expect(record('eV⋮Hz').meaning.guidedDefinition).toContain('named conversion relationship "electron volt-hertz relationship"')
    expect(record('μ_n/μ_+').meaning.guidedDefinition).toContain('named comparison')
    expect(record('V_m_1').meaning.caveats).toContain('The source label says 100 kPa, while its p_1 dependency is 101325.003754773 Pa and expected value 0.02241396954 m^3/mol corresponds to about 101.325 kPa.')
    expect(() => formulaFromEvaluation(recipe('V_m_1'), evaluation('V_m_1'), {
      ...sources,
      symbols: symbols.map((symbol) => symbol.token === 'p_1' ? { ...symbol, value: '100000' } : symbol),
    })).toThrow(/V_m_1 source correction inputs/)
    expect(first.equationLadder.map(({ stage }) => stage)).toEqual([
      'external-geometry',
      'external-boundary',
      'dimensionless-inversion-correction',
      'root-transform',
      'complete-constructor',
    ])
    expect(first.provenance).toEqual({
      recipeSource: {
        artifactId: 'constants-yaml',
        preservedPath: 'sources/constants.yaml',
        constantId: first.id,
        recipeNumber: first.ordinal,
        publicSourceUrl: 'https://www.physicsmonastery.earth/288',
      },
      auditSource: {
        artifactId: 'published-output',
        preservedPath: 'sources/latest-output.txt',
        constantId: first.id,
        recipeNumber: first.ordinal,
        publicSourceUrl: 'https://www.physicsmonastery.earth/288',
      },
      recipeRevision: registry.inputs.recipesSha256,
      symbolRevision: registry.inputs.symbolsSha256,
      sourceRevision: formulaSourceRevision(registry.inputs.recipesSha256, registry.inputs.symbolsSha256),
      boundary: 'source-reproduction-not-independent-validation',
    })
    expect(first.recipeRevision).toBe(registry.inputs.recipesSha256)
    expect(first.symbolRevision).toBe(registry.inputs.symbolsSha256)
    expect(first.sourceRevision).toBe(formulaSourceRevision(first.recipeRevision, first.symbolRevision))
    expect(first.implementationRevision).toBe(FORMULA_IMPLEMENTATION_REVISION)
    expect(first.outputSchemaRevision).toBe(FORMULA_OUTPUT_SCHEMA_REVISION)
    expect(first.compatibility).toBe('same-formula-revisions-and-output-schema')
    expect(first.compatibilityKey).toMatch(/^[a-f0-9]{64}$/)
    expect(same.compatibilityKey).toBe(first.compatibilityKey)
    expect(second.compatibilityKey).not.toBe(first.compatibilityKey)
    expect(changedSymbols.recipeRevision).toBe(first.recipeRevision)
    expect(changedSymbols.symbolRevision).toBe(changedSymbolRevision)
    expect(changedSymbols.sourceRevision).not.toBe(first.sourceRevision)
    expect(changedSymbols.compatibilityKey).not.toBe(first.compatibilityKey)
    expect(JSON.stringify(first.provenance).toLowerCase()).not.toContain('pdf')
  })

  it('validates the generated registry fields required by formula provenance', () => {
    expect(registry.recipes.count).toBe(288)
    expect(registry.recipes.items).toHaveLength(288)
    expect(registry.inputs.recipesSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(() => parseFormulaRegistryArtifact({
      ...registryJson,
      inputs: { ...registryJson.inputs, recipesSha256: 'not-a-digest' },
    })).toThrow(/recipesSha256 must be a lowercase SHA-256 digest/)
  })

  it('hashes exact fetched artifact text before parsing or worker evaluation', () => {
    expect(sha256(recipesText)).toBe(registry.inputs.recipesSha256)
    expect(sha256(symbolsText)).toBe(registry.inputs.symbolsSha256)
    expect(parseAndValidateFormulaSourceArtifacts(recipesText, symbolsText, registryText)).toMatchObject({
      recipes: { length: 288 },
      symbols: { length: 80 },
    })
    expect(() => parseAndValidateFormulaSourceArtifacts(`${recipesText} `, symbolsText, registryText)).toThrow(/recipes\.json SHA-256.*does not match registry/)
    expect(() => parseAndValidateFormulaSourceArtifacts(recipesText, `${symbolsText} `, registryText)).toThrow(/symbols\.json SHA-256.*does not match registry/)
  })
})
