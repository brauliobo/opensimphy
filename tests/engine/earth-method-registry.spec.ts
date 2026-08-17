import {
  DEFAULT_EARTH_METHOD_INPUTS,
  EARTH_PROGRAM_DEFINITIONS,
  SUPPORTED_EARTH_SIMULATION_IDS,
  getDefaultEarthMethodId,
  getEarthMethodDefaultInputs,
  getEarthMethodDefinition,
  listEarthMethods,
  runEarthMethod,
} from '../../src/engine/earth'

function expectFiniteJson(value: unknown, path = 'value'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectFiniteJson(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => expectFiniteJson(item, `${path}.${key}`))
  }
}

const PILOT_DEFAULTS = {
  'EARTH-THERM-006': 'earth-source-reproduction-v1',
  'EARTH-COS-006': 'traditional-analytic-baseline-v1',
  'EARTH-PLAN-008': 'traditional-analytic-baseline-v1',
  'EARTH-PLAN-012': 'traditional-analytic-baseline-v1',
} as const

const PILOT_OUTPUT_KEYS = {
  'EARTH-THERM-006': {
    'earth-source-reproduction-v1': ['boltzmannFactor', 'claimedKsp', 'claimedRelativeResidual', 'coherenceRatioPower', 'ksp', 'printedExpression'],
    'traditional-analytic-baseline-v1': ['anionActivity', 'cationActivity', 'formula', 'ionActivityProduct', 'standardConcentrationMolPerL'],
  },
  'EARTH-COS-006': {
    'earth-source-reproduction-v1': ['printedEntropiesPerBoltzmann', 'printedLengths'],
    'traditional-analytic-baseline-v1': ['bekensteinHawkingFormula', 'entropyPerBoltzmann', 'planckLengthFormula', 'planckLengthMetres'],
  },
  'EARTH-PLAN-008': {
    'earth-source-reproduction-v1': ['coherenceMetres', 'formula', 'numberDensityPerCubicMetre', 'series'],
    'traditional-analytic-baseline-v1': ['assumptions', 'formula', 'scaleHeightMetres'],
  },
  'EARTH-PLAN-012': {
    'earth-source-reproduction-v1': ['binding', 'seismic'],
    'traditional-analytic-baseline-v1': ['assumptions', 'bindingEnergyJoules', 'formula'],
  },
} as const

describe('EARTH method registry', () => {
  it('defines 134 methods with exactly two per pilot and one per other program', () => {
    expect(Object.keys(EARTH_PROGRAM_DEFINITIONS)).toEqual([...SUPPORTED_EARTH_SIMULATION_IDS])
    expect(Object.keys(EARTH_PROGRAM_DEFINITIONS)).toHaveLength(130)
    expect(SUPPORTED_EARTH_SIMULATION_IDS.flatMap((programId) => listEarthMethods(programId))).toHaveLength(134)

    for (const programId of SUPPORTED_EARTH_SIMULATION_IDS) {
      const methods = listEarthMethods(programId)
      const pilotDefault = PILOT_DEFAULTS[programId as keyof typeof PILOT_DEFAULTS]
      expect(methods, programId).toHaveLength(pilotDefault ? 2 : 1)
      expect(getDefaultEarthMethodId(programId)).toBe(pilotDefault ?? methods[0]?.id)
      for (const method of methods) expect(getEarthMethodDefinition(programId, method.id)).toBe(method)
    }
  })

  it('publishes clone-safe, JSON-safe, finite, runnable defaults for all 134 methods', () => {
    const clonedRegistry = structuredClone(DEFAULT_EARTH_METHOD_INPUTS)
    expect(JSON.parse(JSON.stringify(clonedRegistry))).toEqual(DEFAULT_EARTH_METHOD_INPUTS)
    expectFiniteJson(DEFAULT_EARTH_METHOD_INPUTS)

    const untypedDefaultInputs = getEarthMethodDefaultInputs as (programId: string, methodId: string) => unknown
    const untypedRun = runEarthMethod as (programId: string, methodId: string, inputs: unknown) => {
      status: string
      validatesEarthTheory: false
      predictions: Array<{ claimId: string }>
    }
    for (const programId of SUPPORTED_EARTH_SIMULATION_IDS) {
      for (const { id: methodId } of listEarthMethods(programId)) {
        const first = untypedDefaultInputs(programId, methodId)
        const second = untypedDefaultInputs(programId, methodId)
        expect(first).toEqual(second)
        expect(first).not.toBe(second)
        const result = untypedRun(programId, methodId, first)
        expect(result.status, `${programId}/${methodId} must complete`).toBe('completed')
        expect(result.validatesEarthTheory, `${programId}/${methodId}`).toBe(false)
        if (programId === 'EARTH-NUC-001' && methodId === 'earth-source-reproduction-v1') {
          expect(result.predictions.map(({ claimId }) => claimId), `${programId}/${methodId}`).toEqual([
            'NUC-001-P', 'NUC-001-HE', 'NUC-001-C', 'NUC-002-AME',
          ])
        } else if (programId === 'EARTH-FLD-010') {
          expect(result.predictions.map(({ claimId }) => claimId), `${programId}/${methodId}`).toEqual([
            'FLD-010-SG', 'FLD-010-FD',
          ])
        } else if (programId === 'EARTH-FLD-005') {
          expect(result.predictions.map(({ claimId }) => claimId), `${programId}/${methodId}`).toEqual(['FLD-005-VAR'])
        } else {
          expect(result.predictions, `${programId}/${methodId}`).toEqual([])
        }
        expectFiniteJson(result, `${programId}/${methodId}`)
        expect(() => JSON.parse(JSON.stringify(result))).not.toThrow()
      }
    }
  }, 30_000)

  it('uses explicit truthful provenance combinations', () => {
    const methods = SUPPORTED_EARTH_SIMULATION_IDS.flatMap((programId) => listEarthMethods(programId))
    const reproductions = methods.filter(({ relationship }) => relationship === 'earth-source-reproduction')
    expect(reproductions).toHaveLength(37)

    for (const method of methods) {
      if (method.relationship === 'earth-source-reproduction') {
        expect(method).toMatchObject({ kind: 'reproduction', modelOrigin: 'earth-corpus', earthDerived: true })
      } else if (method.relationship === 'source-contract-validator') {
        expect(method).toMatchObject({ kind: 'comparison', modelOrigin: 'engine-audit', earthDerived: false })
      } else {
        expect(method).toMatchObject({ kind: 'comparison', modelOrigin: 'standard-physics', earthDerived: false })
      }
      expect(method.model.length).toBeGreaterThan(0)
      expect(method.title.length).toBeGreaterThan(0)
      expect(method.runtime).toBe('browser-worker')
      expect(method.validatesEarthTheory).toBe(false)
      expect(method.precision).toBe('float64')
    }
  })

  it('returns independent pilot outputs without mixed source and traditional fields', () => {
    const untypedDefaultInputs = getEarthMethodDefaultInputs as (programId: string, methodId: string) => unknown
    const untypedRun = runEarthMethod as (programId: string, methodId: string, inputs: unknown) => {
      output: Record<string, unknown>
      relationship: string
      modelOrigin: string
      earthDerived: boolean
      provenance: { relationship: string; modelOrigin: string; earthDerived: boolean }
    }

    for (const [programId, methodKeys] of Object.entries(PILOT_OUTPUT_KEYS)) {
      const methods = listEarthMethods(programId as keyof typeof PILOT_OUTPUT_KEYS)
      expect(methods.map(({ id }) => id)).toEqual([
        'earth-source-reproduction-v1',
        'traditional-analytic-baseline-v1',
      ])
      for (const method of methods) {
        const result = untypedRun(programId, method.id, untypedDefaultInputs(programId, method.id))
        expect(Object.keys(result.output).sort(), `${programId}/${method.id}`).toEqual(
          [...methodKeys[method.id as keyof typeof methodKeys]].sort(),
        )
        const source = method.id === 'earth-source-reproduction-v1'
        expect(result).toMatchObject(source
          ? { relationship: 'earth-source-reproduction', modelOrigin: 'earth-corpus', earthDerived: true }
          : { relationship: 'traditional-analytic-baseline', modelOrigin: 'standard-physics', earthDerived: false })
        expect(result.provenance).toMatchObject({
          relationship: result.relationship,
          modelOrigin: result.modelOrigin,
          earthDerived: result.earthDerived,
        })
      }
    }

    const thermSource = untypedRun('EARTH-THERM-006', 'earth-source-reproduction-v1', untypedDefaultInputs('EARTH-THERM-006', 'earth-source-reproduction-v1')).output
    const thermBaseline = untypedRun('EARTH-THERM-006', 'traditional-analytic-baseline-v1', untypedDefaultInputs('EARTH-THERM-006', 'traditional-analytic-baseline-v1')).output
    expect(thermSource).not.toHaveProperty('ionActivityProduct')
    expect(thermBaseline).not.toHaveProperty('printedExpression')

    const cosmologySource = untypedRun('EARTH-COS-006', 'earth-source-reproduction-v1', untypedDefaultInputs('EARTH-COS-006', 'earth-source-reproduction-v1')).output
    const cosmologyBaseline = untypedRun('EARTH-COS-006', 'traditional-analytic-baseline-v1', untypedDefaultInputs('EARTH-COS-006', 'traditional-analytic-baseline-v1')).output
    expect(cosmologySource).not.toHaveProperty('planckLengthMetres')
    expect(cosmologyBaseline).not.toHaveProperty('printedLengths')

    const atmosphereSource = untypedRun('EARTH-PLAN-008', 'earth-source-reproduction-v1', untypedDefaultInputs('EARTH-PLAN-008', 'earth-source-reproduction-v1')).output
    const atmosphereBaseline = untypedRun('EARTH-PLAN-008', 'traditional-analytic-baseline-v1', untypedDefaultInputs('EARTH-PLAN-008', 'traditional-analytic-baseline-v1')).output
    expect(atmosphereSource).not.toHaveProperty('scaleHeightMetres')
    expect(atmosphereBaseline).not.toHaveProperty('coherenceMetres')

    const bindingSource = untypedRun('EARTH-PLAN-012', 'earth-source-reproduction-v1', untypedDefaultInputs('EARTH-PLAN-012', 'earth-source-reproduction-v1')).output
    const bindingBaseline = untypedRun('EARTH-PLAN-012', 'traditional-analytic-baseline-v1', untypedDefaultInputs('EARTH-PLAN-012', 'traditional-analytic-baseline-v1')).output
    expect(bindingSource).not.toHaveProperty('bindingEnergyJoules')
    expect(bindingBaseline).not.toHaveProperty('seismic')
  })

  it('rejects unsupported method IDs', () => {
    expect(() => getEarthMethodDefinition('EARTH-FND-001', 'unsupported-method')).toThrow(RangeError)
    expect(() => runEarthMethod('EARTH-FND-001', 'unsupported-method', {})).toThrow(
      'Unsupported EARTH method ID unsupported-method for program EARTH-FND-001',
    )
  })

  it('keeps the registry envelope authoritative over kernel identity fields', () => {
    const programId = 'EARTH-FND-009'
    const methodId = getDefaultEarthMethodId(programId)
    const inputs = getEarthMethodDefaultInputs(programId, methodId)
    const kernel = getEarthMethodDefinition(programId, methodId).execute(inputs, {}) as { id: string }
    expect(kernel.id).toBe(programId)

    const result = runEarthMethod(programId, methodId, inputs)
    expect(result).toMatchObject({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: 'completed',
      id: programId,
      status: 'completed',
      validatesEarthTheory: false,
      predictions: [],
    })
    expect(result.provenance).toMatchObject({
      relationship: result.relationship,
      modelOrigin: result.modelOrigin,
      earthDerived: result.earthDerived,
      validatesEarthTheory: false,
      precision: 'float64',
    })
  })
})
