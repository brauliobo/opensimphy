import type { CoreRecord } from '../../src/registries/coreRegistry'
import type { CoverageRow } from '../../src/registries/completionRegistry'
import type { FormulaRecord } from '../../src/registries/formulaRegistry'
import type { WallInput } from '../../src/registries/wallRegistry'
import type { TaxonomyArtifact } from '../../src/types/engine'
import type { PlotFigure } from '../../src/types/plot'

export const figure: PlotFigure = {
  data: [{ x: [0, 1, 2], y: [1, 2, 3], type: 'scatter', mode: 'lines' }],
}

export function formula(ordinal: number, overrides: Partial<FormulaRecord> = {}): FormulaRecord {
  const exact = ordinal % 2 === 1
  const recordId = `formula-${ordinal}`
  const dependencyDrift = ordinal <= 26
  const sourceAudit: FormulaRecord['sourceAudit'] = exact
    ? {
        basis: 'exact',
        comparisonScope: 'source-comparison',
        criterion: 'published-significant-digit-assessment',
        assessment: ordinal === 3 ? 'not a match' : 'full match',
        matchedDigits: ordinal === 3 ? 0 : 9,
        totalCompared: 9,
        met: ordinal !== 3,
        validation: false,
      }
    : {
        basis: 'measured',
        comparisonScope: 'source-comparison',
        criterion: 'published-5.2-sigma',
        zScore: ordinal === 2 ? -6.1 : 0.25,
        observed: ordinal === 2 ? 6.1 : 0.25,
        threshold: 5.2,
        met: ordinal !== 2,
        validation: false,
      }
  const graphPoints = [
    { x: 0.5, y: 0.8, imaginary: 0.01, magnitude: 0.8000625, sign: 1 as const, log10Abs: -0.096876, finite: true },
    { x: 1, y: 1, imaginary: 0, magnitude: 1, sign: 1 as const, log10Abs: 0, finite: true },
    { x: 1.5, y: 1.25, imaginary: -0.02, magnitude: 1.25016, sign: 1 as const, log10Abs: 0.096966, finite: true },
  ]
  const dimensionMatches = ordinal > 68
  return {
    id: recordId,
    ordinal,
    symbol: `F_${ordinal}`,
    name: `Formula ${ordinal}`,
    meaning: {
      name: `Formula ${ordinal}`,
      declaredQuantity: `Fixture quantity ${ordinal}`,
      unit: 'm',
      sourceLabel: exact ? 'fixture source exact label' : 'fixture source measured label',
      guidedDefinition: `The record represents the physical quantity named "Formula ${ordinal}" by the preserved source. Here its quantity value is written as a numerical value in m. The browser reconstruction is compared with the source-labelled ${exact ? 'exact' : 'measured'} reference; that comparison is not an independent definition or measurement.`,
      caveats: [
        'The source label is preserved wording, not an authoritative physical definition.',
        ...(ordinal === 120
          ? ['The source label says 100 kPa, while its p_1 dependency is 101325.003754773 Pa and expected value 0.02241396954 m^3/mol corresponds to about 101.325 kPa.']
          : []),
      ],
      boundary: 'source-reproduction-not-independent-validation',
    },
    equation: '(EG * EB) * (1 + IG * R * IB)',
    equationLadder: [
      { stage: 'external-geometry', token: 'EG', expression: 'a', explanation: 'Preserved external geometry.' },
      { stage: 'external-boundary', token: 'EB', expression: 'b', explanation: 'Preserved external boundary.' },
      { stage: 'dimensionless-inversion-correction', token: 'IG-R-IB', expression: '1 + c * r * i', explanation: 'Dimensionless inversion correction.' },
      { stage: 'root-transform', token: 'R', expression: 'r', explanation: 'Preserved root transform.' },
      { stage: 'complete-constructor', token: 'formula', expression: '(a * b) * (1 + c * r * i)', explanation: 'Complete source-reproduction constructor.' },
    ],
    column: ordinal % 2 ? 'alpha' : 'beta',
    island: ordinal % 2 ? 'one' : 'two',
    classification: exact ? 'exact' : 'measured',
    topic: ordinal % 2 ? 'foundations' : 'magnetism',
    category: ordinal % 2 ? 'si-observational-anchors' : 'moments-field-standards',
    facets: {
      basis: ordinal % 2 ? 'exact' : 'measured',
      constructor: 'multiplication',
      buildPass: 'pass-1',
      sourceUnitFamily: 'spatial',
      representation: 'primary-form',
      entities: [],
      sourceColumn: ordinal % 2 ? 'alpha' : 'beta',
      sourceIsland: ordinal % 2 ? 'one' : 'two',
    },
    sourceAudit,
    sourceUrl: 'https://example.test/source',
    provenance: {
      recipeSource: {
        artifactId: 'constants-yaml',
        preservedPath: 'sources/constants.yaml',
        constantId: recordId,
        recipeNumber: ordinal,
        publicSourceUrl: 'https://www.physicsmonastery.earth/288',
      },
      auditSource: {
        artifactId: 'published-output',
        preservedPath: 'sources/latest-output.txt',
        constantId: recordId,
        recipeNumber: ordinal,
        publicSourceUrl: 'https://www.physicsmonastery.earth/288',
      },
      recipeRevision: 'fixture-recipes-sha256-v1',
      symbolRevision: 'fixture-symbols-sha256-v1',
      sourceRevision: 'fixture-composite-source-v1',
      boundary: 'source-reproduction-not-independent-validation',
    },
    recipeRevision: 'fixture-recipes-sha256-v1',
    symbolRevision: 'fixture-symbols-sha256-v1',
    sourceRevision: 'fixture-composite-source-v1',
    implementationRevision: 'fixture-formula-evaluator-v1',
    outputSchemaRevision: 'formula-record-v7',
    compatibility: 'same-formula-revisions-and-output-schema',
    compatibilityKey: ordinal.toString(16).padStart(64, '0'),
    decomposition: { EG: 'a', EB: 'b', IG: 'c', R: 'r', IB: 'i' },
    sourceDependencies: {
      direct: ['a', `source-direct-${ordinal}`],
      graph: [
        { token: 'a', role: 'primitive', depth: 1, direct: true, parents: [recordId] },
        { token: `source-direct-${ordinal}`, role: 'recipe', depth: 1, direct: true, parents: [recordId] },
        { token: `source-parent-${ordinal}`, role: 'source-symbol', depth: 2, direct: false, parents: [`source-direct-${ordinal}`] },
      ],
    },
    runtimeDependencies: {
      direct: ['a', dependencyDrift ? `runtime-direct-${ordinal}` : `source-direct-${ordinal}`],
      graph: [
        { token: 'a', role: 'primitive', depth: 1, direct: true, parents: [recordId] },
        {
          token: dependencyDrift ? `runtime-direct-${ordinal}` : `source-direct-${ordinal}`,
          role: 'recipe',
          depth: 1,
          direct: true,
          parents: [recordId],
        },
        {
          token: dependencyDrift ? `runtime-parent-${ordinal}` : `source-parent-${ordinal}`,
          role: 'source-symbol',
          depth: 2,
          direct: false,
          parents: [dependencyDrift ? `runtime-direct-${ordinal}` : `source-direct-${ordinal}`],
        },
      ],
    },
    constructorLiterals: ['1', '6'],
    dependencyAgreement: {
      missingFromRuntime: dependencyDrift ? [`source-direct-${ordinal}`] : [],
      extraInRuntime: dependencyDrift ? [`runtime-direct-${ordinal}`] : [],
      matches: !dependencyDrift,
    },
    sourceEvaluation: {
      buildPass: 1,
      computed: '1.0000000000000',
      computedDimension: 'm',
    },
    runtimeEvaluation: {
      buildPass: 2,
      computed: 1,
      precision: 'float64-reproduction',
      modelParity: true,
    },
    rawValues: {
      expected: '1.000000000',
      expectedNumeric: 1,
      computed: 1,
      model: '1.000000000',
      modelNumeric: 1,
      precision: 'float64-reproduction',
    },
    residualScale: {
      signedAbsolute: { value: ordinal === 2 ? 0.061 : 0, unit: 'm' },
      relative: { available: true, value: ordinal === 2 ? 0.061 : 0, denominator: 'expected-value' },
      standardized: exact
        ? { available: false, value: null, reason: 'exact-source-comparison' }
        : ordinal === 4
          ? { available: false, value: null, reason: 'z-score-unavailable' }
          : { available: true, value: ordinal === 2 ? 6.1 : 0.25, scale: 'measured-sigma' },
    },
    dimensionAudit: {
      declared: 'm',
      declaredVector: { time: 0, length: 1, charge: 0, temperature: 0, mass: 0 },
      computedVector: { time: 0, length: dimensionMatches ? 1 : 2, charge: 0, temperature: 0, mass: 0 },
      matches: dimensionMatches,
      finding: dimensionMatches ? null : 'Declared length and computed area vectors conflict; the record is not repaired.',
    },
    modelParity: true,
    computed: '1.000000e+0',
    expected: '1.000000e+0',
    residual: ordinal === 2 ? '6.100000e-2' : '0',
    zScore: exact ? 'not applicable' : ordinal === 4 ? 'not applicable' : ordinal === 2 ? '6.100' : '0.250',
    units: 'm',
    simulationGraph: {
      parameter: 'inversion-boundary-scale',
      precision: 'float64-reproduction',
      points: graphPoints,
      markers: [{ x: 1, y: 1, label: 'computed' }],
      graphReady: true,
    },
    graphPoints,
    graphTable: graphPoints,
    graph: figure,
    graphReady: true,
    ...overrides,
  }
}

export const coreCase: CoreRecord = {
  id: 'planck-surface',
  title: 'Planck complex surface',
  family: 'planck-complex',
  description: 'Fixture surface',
  graphs: [{ id: 'surface', label: 'Surface', figure }],
  graphReady: true,
}

export const wall: WallInput = {
  id: 'catalan',
  title: 'Catalan Numbers',
  category: 'famous-sequences',
  kind: 'terms',
  description: 'Catalan sequence',
  filename: 'catalan.json',
}

export const taxonomy: TaxonomyArtifact = {
  schemaVersion: 1,
  generatedAt: '2026-07-17',
  total: 3,
  narrativeOrder: ['foundations', 'magnetism'],
  topics: [
    {
      id: 'foundations',
      order: 1,
      title: 'Fundamental anchors & natural scales',
      shortTitle: 'Anchors & scales',
      eyebrow: 'Define the stage',
      description: 'Reference quantities.',
      narrative: 'Start with the anchors.',
      count: 2,
      exactCount: 2,
      measuredCount: 0,
      categories: [{ id: 'si-observational-anchors', title: 'SI anchors', description: 'Reference anchors.', count: 2 }],
      featured: [{ recipeNumber: 1, id: 'formula-1', name: 'Formula 1' }],
    },
    {
      id: 'magnetism',
      order: 2,
      title: 'Spin, moments & magnetic response',
      shortTitle: 'Spin & magnetism',
      eyebrow: 'Resolve the spin',
      description: 'Magnetic quantities.',
      narrative: 'Compare moments.',
      count: 1,
      exactCount: 0,
      measuredCount: 1,
      categories: [{ id: 'moments-field-standards', title: 'Moments', description: 'Magnetic moments.', count: 1 }],
      featured: [{ recipeNumber: 2, id: 'formula-2', name: 'Formula 2' }],
    },
  ],
  facets: {
    basis: [{ id: 'exact', count: 2 }, { id: 'measured', count: 1 }],
    constructor: [{ id: 'multiplication', count: 3 }],
    buildPass: [{ id: 'pass-1', count: 3 }],
    sourceUnitFamily: [{ id: 'spatial', count: 3 }],
    representation: [{ id: 'primary-form', count: 3 }],
    entities: [],
  },
}

export function coverage(complete = true): CoverageRow[] {
  return [
    { key: 'recipes', label: 'Formula recipes', expected: 3, implemented: complete ? 3 : 2, evaluated: 3, graphed: 3, simulatable: 0 },
    { key: 'core', label: 'Core cases', expected: 1, implemented: 1, evaluated: 1, graphed: 1, simulatable: 1 },
    { key: 'walls', label: 'Number-wall inputs', expected: 1, implemented: 1, evaluated: 0, graphed: 0, simulatable: 1 },
  ]
}
