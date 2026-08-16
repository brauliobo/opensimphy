import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import { awesomePhysicsAdapterFactoryMap } from '../../src/awesomePhysics/adapterFactories'
import {
  calculateThermopyNasa9Properties,
  createThermopyAdapter,
  THERMOPY_ADAPTER_ID,
  THERMOPY_BOUNDS,
  THERMOPY_SOURCE_CAVEATS,
} from '../../src/awesomePhysics/adapters/typescript/thermopy'
import type {
  ThermopyNasa9InputV1,
  ThermopyNasa9IntervalV1,
} from '../../src/awesomePhysics/adapters/typescript/thermopy'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const knownCoefficients = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const knownIntervals: readonly ThermopyNasa9IntervalV1[] = [
  {
    lowerTemperatureK: 1,
    upperTemperatureK: 6000,
    coefficients: knownCoefficients,
  },
]

function descriptorForThermopy(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === 'awesome-thermopy')
  if (!source) throw new Error('Missing thermopy descriptor')
  return {
    ...source,
    adapterId: THERMOPY_ADAPTER_ID,
    availability: 'available',
    runnable: true,
  }
}

function expectFiniteJson(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true)
    expect(Math.abs(value)).toBeLessThanOrEqual(THERMOPY_BOUNDS.maximumOutputMagnitude)
    return
  }
  if (Array.isArray(value)) {
    value.forEach(expectFiniteJson)
    return
  }
  if (value !== null && typeof value === 'object') Object.values(value).forEach(expectFiniteJson)
  expect(JSON.stringify(value)).not.toBeUndefined()
}

describe('Awesome Physics thermopy educational adapter', () => {
  it('evaluates a known NASA9 coefficient fixture with explicit SI units and ratios', () => {
    const temperatureK = 2
    const [a1, a2, a3, a4, a5, a6, a7, a8, a9] = knownCoefficients
    const expectedCpOverR = a1 / temperatureK ** 2
      + a2 / temperatureK
      + a3
      + a4 * temperatureK
      + a5 * temperatureK ** 2
      + a6 * temperatureK ** 3
      + a7 * temperatureK ** 4
    const expectedEnthalpyOverRT = -a1 / temperatureK ** 2
      + a2 * Math.log(temperatureK) / temperatureK
      + a3
      + a4 * temperatureK / 2
      + a5 * temperatureK ** 2 / 3
      + a6 * temperatureK ** 3 / 4
      + a7 * temperatureK ** 4 / 5
      + a8 / temperatureK
    const expectedEntropyOverR = -a1 / (2 * temperatureK ** 2)
      - a2 / temperatureK
      + a3 * Math.log(temperatureK)
      + a4 * temperatureK
      + a5 * temperatureK ** 2 / 2
      + a6 * temperatureK ** 3 / 3
      + a7 * temperatureK ** 4 / 4
      + a9

    const properties = calculateThermopyNasa9Properties(temperatureK, knownIntervals)
    expect(properties.interval).toEqual({ lowerTemperatureK: 1, upperTemperatureK: 6000 })
    expect(properties.cpOverR).toBeCloseTo(expectedCpOverR, 12)
    expect(properties.enthalpyOverRT).toBeCloseTo(expectedEnthalpyOverRT, 12)
    expect(properties.entropyOverR).toBeCloseTo(expectedEntropyOverR, 12)
    expect(properties.cpJPerMolK).toBeCloseTo(8.31446261815324 * expectedCpOverR, 12)
    expect(properties.enthalpyJPerMol).toBeCloseTo(8.31446261815324 * temperatureK * expectedEnthalpyOverRT, 12)
    expect(properties.entropyJPerMolK).toBeCloseTo(8.31446261815324 * expectedEntropyOverR, 12)
    expect(properties.standardStatePressurePa).toBe(100000)

    const adapter = createThermopyAdapter(descriptorForThermopy(), new AbortController().signal)
    const output = adapter.run({ operation: 'nasa9-ideal-gas', temperatureK, intervals: knownIntervals })
    expect(output).toMatchObject({
      operation: 'nasa9-ideal-gas',
      cpOverR: properties.cpOverR,
      enthalpyOverRT: properties.enthalpyOverRT,
      entropyOverR: properties.entropyOverR,
      units: {
        temperature: 'K',
        cp: 'J/(mol*K)',
        enthalpy: 'J/mol',
        entropy: 'J/(mol*K)',
        cpOverR: '1',
        enthalpyOverRT: '1',
        entropyOverR: '1',
        standardStatePressure: 'Pa',
      },
    })
    expect(output.assumptions.join(' ')).toContain('NASA9')
    expect(output.doesNotEstablish).toContain('does not establish')
  })

  it('selects sorted piecewise intervals and rejects invalid coefficients or domains', () => {
    const piecewiseIntervals: readonly ThermopyNasa9IntervalV1[] = [
      { lowerTemperatureK: 100, upperTemperatureK: 300, coefficients: [0, 0, 2, 0, 0, 0, 0, 0, 0] },
      { lowerTemperatureK: 300, upperTemperatureK: 1000, coefficients: [0, 0, 4, 0, 0, 0, 0, 0, 0] },
    ]
    const adapter = createThermopyAdapter(descriptorForThermopy(), new AbortController().signal)
    expect(adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 250, intervals: piecewiseIntervals }).cpOverR).toBe(2)
    expect(adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: piecewiseIntervals }).cpOverR).toBe(2)
    expect(adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 301, intervals: piecewiseIntervals }).cpOverR).toBe(4)

    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: [{ ...piecewiseIntervals[0], coefficients: [0, 0, 1] }] })).toThrow(/exactly 9 coefficients/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: [{ ...piecewiseIntervals[0], coefficients: [0, 0, Number.NaN, 0, 0, 0, 0, 0, 0] }] })).toThrow(/finite/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: [{ ...piecewiseIntervals[0], lowerTemperatureK: 300 }] })).toThrow(/below upperTemperatureK/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: [piecewiseIntervals[1], piecewiseIntervals[0]] })).toThrow(/sorted/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 50, intervals: piecewiseIntervals })).toThrow(/outside all supplied/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 0, intervals: piecewiseIntervals })).toThrow(/between 1 and 6000/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: Number.POSITIVE_INFINITY, intervals: piecewiseIntervals })).toThrow(/finite/)
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: piecewiseIntervals, extra: true } as never)).toThrow(/unknown properties/)
  })

  it('enforces coefficient and interval bounds, deterministic JSON output, and finite results', () => {
    const input: ThermopyNasa9InputV1 = {
      operation: 'nasa9-ideal-gas',
      temperatureK: 400,
      intervals: [{ lowerTemperatureK: 200, upperTemperatureK: 1000, coefficients: knownCoefficients }],
    }
    const adapter = createThermopyAdapter(descriptorForThermopy(), new AbortController().signal)
    const first = adapter.run(input)
    const second = adapter.run(JSON.parse(JSON.stringify(input)))
    expect(first).toEqual(second)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expectFiniteJson(first)
    expect(JSON.stringify(first).length).toBeLessThanOrEqual(THERMOPY_BOUNDS.maximumOutputBytes)

    const tooManyIntervals = Array.from({ length: THERMOPY_BOUNDS.intervalCount.max + 1 }, (_, index) => ({
      lowerTemperatureK: 1 + index * 10,
      upperTemperatureK: 2 + index * 10,
      coefficients: knownCoefficients,
    }))
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 2, intervals: tooManyIntervals })).toThrow(/between 1 and 16 intervals/)
    expect(() => adapter.run({
      operation: 'nasa9-ideal-gas',
      temperatureK: 300,
      intervals: [{ lowerTemperatureK: 200, upperTemperatureK: 1000, coefficients: [THERMOPY_BOUNDS.coefficientAbsoluteValue * 2, ...knownCoefficients.slice(1)] }],
    })).toThrow(/between -1000000000000 and 1000000000000/)
  })

  it('honors factory and run cancellation', () => {
    const descriptor = descriptorForThermopy()
    const factoryController = new AbortController()
    factoryController.abort()
    expect(() => createThermopyAdapter(descriptor, factoryController.signal)).toThrow(/aborted/i)

    const adapter = createThermopyAdapter(descriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    expect(() => adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: knownIntervals }, runController.signal)).toThrow(/aborted/i)
  })

  it('matches the descriptor contract while remaining unavailable and unregistered', () => {
    const source = simulations.items.find((item) => item.catalogItemId === 'awesome-thermopy')
    if (!source) throw new Error('Missing thermopy descriptor')
    expect(source.availability).toBe('unavailable')
    expect(source.runnable).toBe(false)
    expect(source.licenseGate).toBe('review')
    expect(awesomePhysicsAdapterFactoryMap.has(THERMOPY_ADAPTER_ID)).toBe(false)

    const descriptor = descriptorForThermopy()
    const adapter = createThermopyAdapter(descriptor, new AbortController().signal)
    expect(adapter).toMatchObject({
      adapterId: THERMOPY_ADAPTER_ID,
      protocol: 'awesome-physics-adapter-v1',
      compatibility: {
        contentRevision: descriptor.contentRevision,
        modelRevision: descriptor.modelRevision,
        implementationRevision: descriptor.implementationRevision,
        outputRevision: descriptor.outputRevision,
      },
    })

    const output = adapter.run({ operation: 'nasa9-ideal-gas', temperatureK: 300, intervals: knownIntervals })
    expect(output.availability).toBe('unavailable')
    expect(output.integrationStatus).toBe('provisional-adapter-not-registered')
    expect(output.licenseGate).toBe('review')
    expect(THERMOPY_SOURCE_CAVEATS.license).toContain('GPL-3-or-later')
    expect(THERMOPY_SOURCE_CAVEATS.data).toContain('No thermopy XML')
  })
})
