import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  RAYSECT_ADAPTER_ID,
  RAYSECT_CATALOG_ITEM_ID,
  RAYSECT_SOURCE_CAVEATS,
  createRaysectAdapter,
  parseRaysectInput,
  raysectAdapterFactory,
  type RaysectInputV1,
} from '../../src/awesomePhysics/adapters/typescript/raysect'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === RAYSECT_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing raysect descriptor')
  return { ...source, adapterId: RAYSECT_ADAPTER_ID, availability: 'available', runnable: true }
}

function prismInput(overrides: Partial<RaysectInputV1> = {}): RaysectInputV1 {
  return {
    operation: 'prism-trace',
    apexAngleDeg: 60,
    incidenceAngleDeg: 48,
    wavelengthNm: 550,
    cauchyA: 1.5046,
    cauchyB: 0.0042,
    ...overrides,
  }
}

describe('Awesome Physics raysect TypeScript adapter', () => {
  it('traces a Cauchy prism with Snell deviation and a four-point polyline', async () => {
    const adapter = createRaysectAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(prismInput())
    const wavelengthUm = 0.55
    const n = 1.5046 + 0.0042 / (wavelengthUm * wavelengthUm)
    const apex = 60 * Math.PI / 180
    const incidence = 48 * Math.PI / 180
    const r1 = Math.asin(Math.sin(incidence) / n)
    const i2 = Math.asin(n * Math.sin(apex - r1))
    const deviationDeg = (incidence + i2 - apex) * 180 / Math.PI
    expect(result.refractiveIndex).toBeCloseTo(n, 12)
    expect(result.deviationDeg).toBeCloseTo(deviationDeg, 10)
    expect(result.transmitted).toBe(true)
    expect(result.polyline).toHaveLength(4)
    const incoming = result.incoming
    const outgoing = result.outgoing
    const incomingNorm = Math.hypot(incoming.x, incoming.y)
    const outgoingNorm = Math.hypot(outgoing.x, outgoing.y)
    const cosDelta = (incoming.x * outgoing.x + incoming.y * outgoing.y) / (incomingNorm * outgoingNorm)
    expect((Math.acos(Math.min(1, Math.max(-1, cosDelta))) * 180) / Math.PI).toBeCloseTo(result.deviationDeg, 8)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(RAYSECT_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('deflects blue light more than red for positive Cauchy B', async () => {
    const adapter = raysectAdapterFactory(descriptor(), new AbortController().signal)
    const red = await adapter.run(prismInput({ wavelengthNm: 650 }))
    const blue = await adapter.run(prismInput({ wavelengthNm: 450 }))
    expect(blue.refractiveIndex).toBeGreaterThan(red.refractiveIndex)
    expect(blue.deviationDeg).toBeGreaterThan(red.deviationDeg)
  })

  it('rejects total internal reflection and unsafe bounds', () => {
    expect(() => parseRaysectInput({ ...prismInput(), apexAngleDeg: 91 })).toThrow(/apexAngleDeg/)
    const adapter = createRaysectAdapter(descriptor(), new AbortController().signal)
    expect(() => adapter.run(prismInput({ apexAngleDeg: 80, incidenceAngleDeg: 10, cauchyA: 2.2, cauchyB: 0 }))).toThrow(/total internal reflection/)
  })
})
