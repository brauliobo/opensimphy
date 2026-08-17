import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  ASTROPY_ADAPTER_ID,
  ASTROPY_CATALOG_ITEM_ID,
  ASTROPY_SOURCE_CAVEATS,
  createAstropyAdapter,
  parseAstropyInput,
  astropyAdapterFactory,
  type AstropyInputV1,
} from '../../src/awesomePhysics/adapters/typescript/astropy'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const AU_M = 149597870700
const PARSEC_M = AU_M * 648000 / Math.PI

function descriptor(): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === ASTROPY_CATALOG_ITEM_ID)
  if (!source) throw new Error('Missing astropy descriptor')
  return { ...source, adapterId: ASTROPY_ADAPTER_ID, availability: 'available', runnable: true }
}

function unitInput(overrides: Partial<Extract<AstropyInputV1, { operation: 'unit-convert' }>> = {}): AstropyInputV1 {
  return {
    operation: 'unit-convert',
    value: 1,
    from: 'pc',
    to: 'm',
    ...overrides,
  }
}

describe('Awesome Physics astropy TypeScript adapter', () => {
  it('converts one parsec through the IAU astronomical unit', async () => {
    const adapter = createAstropyAdapter(descriptor(), new AbortController().signal)
    const result = await adapter.run(unitInput())
    if (result.operation !== 'unit-convert') throw new Error('expected unit output')
    expect(result.dimension).toBe('length')
    expect(result.value).toBeCloseTo(PARSEC_M, 6)
    expect(result.validatesTheory).toBe(false)
    expect(result.doesNotEstablish).toContain('does not establish')
    expect(result.licenseCaveat).toBe(ASTROPY_SOURCE_CAVEATS.license)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('maps the ICRS north galactic pole to b = 90 deg', async () => {
    const adapter = astropyAdapterFactory(descriptor(), new AbortController().signal)
    const result = await adapter.run({
      operation: 'icrs-to-galactic',
      raDeg: 192.85948,
      decDeg: 27.12825,
    })
    if (result.operation !== 'icrs-to-galactic') throw new Error('expected galactic output')
    expect(result.bDeg).toBeCloseTo(90, 6)
  })

  it('rejects cross-dimension conversion and unsafe bounds', () => {
    expect(() => parseAstropyInput({ ...unitInput(), to: 's' })).toThrow(/same dimension/)
    expect(() => parseAstropyInput({ operation: 'icrs-to-galactic', raDeg: 361, decDeg: 0 })).toThrow(/raDeg/)
  })
})
