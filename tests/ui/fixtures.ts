import type { AtlasSnapshot, CoreCase, FormulaRecord, PlotFigure, WallInput } from '../../src/composables/atlasEngine'
import type { TaxonomyArtifact } from '../../src/types/engine'

export const figure: PlotFigure = {
  data: [{ x: [0, 1, 2], y: [1, 2, 3], type: 'scatter', mode: 'lines' }],
}

export function formula(ordinal: number, overrides: Partial<FormulaRecord> = {}): FormulaRecord {
  return {
    id: `formula-${ordinal}`,
    ordinal,
    symbol: `F_${ordinal}`,
    name: `Formula ${ordinal}`,
    equation: '(EG * EB) * (1 + IG * R * IB)',
    column: ordinal % 2 ? 'alpha' : 'beta',
    island: ordinal % 2 ? 'one' : 'two',
    classification: ordinal % 2 ? 'exact' : 'measured',
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
    status: ordinal === 2 ? 'fail' : 'pass',
    sourceUrl: 'https://example.test/source',
    decomposition: { EG: 'a', EB: 'b', IG: 'c', R: 'r', IB: 'i' },
    dependencies: ['a', 'b'],
    computed: '1.000000e+0',
    expected: '1.000000e+0',
    residual: '0',
    zScore: 'not applicable',
    units: 'm',
    graph: figure,
    graphReady: true,
    ...overrides,
  }
}

export const coreCase: CoreCase = {
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

export function snapshot(complete = true): AtlasSnapshot {
  return {
    formulas: [formula(1), formula(2), formula(3)],
    coreCases: [coreCase],
    walls: [wall],
    coverage: [
      { key: 'recipes', label: 'Formula recipes', expected: 3, implemented: complete ? 3 : 2, evaluated: 3, graphed: 3, simulatable: 0 },
      { key: 'core', label: 'Core cases', expected: 1, implemented: 1, evaluated: 1, graphed: 1, simulatable: 1 },
      { key: 'walls', label: 'Number-wall inputs', expected: 1, implemented: 1, evaluated: 0, graphed: 0, simulatable: 1 },
    ],
    taxonomy,
  }
}
