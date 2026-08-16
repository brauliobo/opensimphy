import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildGrayCalibrationMagneticLookup,
  GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
  GRAY_CALIBRATION_TRANSFER_PROXY,
  loadGrayCalibrationMagneticLookup,
  parseGrayCalibrationPack,
} from '../../src/edwin-gray/edwinGrayCalibration'
import { GRAY_PATENT_MACHINE_ID } from '../../src/edwin-gray/edwinGrayMachines'

const publicCalibrationPack = JSON.parse(readFileSync(resolve(
  'public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json',
), 'utf8')) as Record<string, unknown>

describe('unavailable Edwin Gray FEM calibration contract', () => {
  it('rejects the production pack because pilot provenance does not match the class runs', () => {
    expect(publicCalibrationPack).toMatchObject({
      contractVersion: 2,
      status: 'unavailable-provenance-mismatch',
      runtimeAvailable: false,
      uncertainty: {
        established: false,
        relativeBound: null,
        passTolerance: GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
      },
    })
    expect(publicCalibrationPack.evidence).toMatchObject({
      coarseFineDrift: {
        observed: GRAY_CALIBRATION_TRANSFER_PROXY,
        passTolerance: GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD,
        status: 'legacy-pilot-only',
      },
    })
    expect(() => parseGrayCalibrationPack(publicCalibrationPack)).toThrow(/provenance mismatch.*not uncertainty bounds.*assumption-only/)
    expect(() => buildGrayCalibrationMagneticLookup(publicCalibrationPack)).toThrow(/provenance mismatch/)
  })

  it('rejects a stale cached v1 pack after the provenance mismatch became known', () => {
    expect(() => parseGrayCalibrationPack({
      contract: 'edwin-gray-motor-fem-calibration-pack',
      contractVersion: 1,
    })).toThrow(/cached contract v1.*provenance mismatch.*uncertainty bound/)
  })

  it.each([
    ['available status', (pack: Record<string, unknown>) => { pack.status = 'limited-not-validated' }],
    ['runtime availability', (pack: Record<string, unknown>) => { pack.runtimeAvailable = true }],
    ['matching model provenance', (pack: Record<string, unknown>) => {
      const evidence = pack.evidence as Record<string, unknown>
      evidence.pilotModelInputHash = evidence.modelInputHash
    }],
    ['uncertainty bound', (pack: Record<string, unknown>) => {
      const uncertainty = pack.uncertainty as Record<string, unknown>
      uncertainty.established = true
      uncertainty.relativeBound = GRAY_CALIBRATION_ACCEPTANCE_THRESHOLD
    }],
  ])('rejects v2 drift that claims %s', (_label, mutate) => {
    const pack = structuredClone(publicCalibrationPack)
    mutate(pack)
    expect(() => parseGrayCalibrationPack(pack)).toThrow()
  })

  it('loads only through the same fail-closed parser', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(publicCalibrationPack), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch

    await expect(loadGrayCalibrationMagneticLookup(GRAY_PATENT_MACHINE_ID, fetcher))
      .rejects.toThrow(/provenance mismatch.*not uncertainty bounds/)
  })
})
