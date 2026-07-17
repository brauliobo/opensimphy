import type { AtlasSnapshot, CoreCase, FormulaRecord, PlotFigure, WallInput } from '../../src/composables/atlasEngine'

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
  }
}
