import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GRAY_PRODUCTION_LUT_BLOCKER,
  GRAY_PRODUCTION_LUT_RELATIVE_PATH,
  grayProductionLutBanner,
  grayProductionLutBlocked,
  grayProductionLutBlockReason,
  grayProductionLutIsBlocked,
  grayProductionLutStatusLabel,
} from '../../src/edwin-gray/edwinGrayProductionLut'
import { productionGrayFemLutPresent } from '../helpers/edwinGrayFemLookup'

const source = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/convergence/production-lut-blocker.json'), 'utf8'))
const published = JSON.parse(readFileSync(join(process.cwd(), 'public/data/generated/edwin-gray/production-lut-blocker.json'), 'utf8'))
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/cases/production-lut-blocker.json'), 'utf8'))
const lutPresent = productionGrayFemLutPresent()
const lutOnDisk = existsSync(join(process.cwd(), 'public', GRAY_PRODUCTION_LUT_RELATIVE_PATH))

describe('Edwin Gray production LUT publication gate', () => {
  it('mirrors the FEM blocker across source, public, and fixture copies', () => {
    expect(published).toEqual(source)
    expect(fixture).toEqual(source)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.contract).toBe('edwin-gray-production-lut-blocker')
    expect(lutOnDisk).toBe(lutPresent)
  })

  it.skipIf(lutPresent)('stays fail-closed when the production LUT file is absent', () => {
    expect(GRAY_PRODUCTION_LUT_BLOCKER.productionLutPublished).toBe(false)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.lutPath).toBeNull()
    expect(GRAY_PRODUCTION_LUT_BLOCKER.failClosed).toBe(true)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.status).toBe('blocked')
    expect(GRAY_PRODUCTION_LUT_BLOCKER.retainedEvidence).toMatchObject({
      presentSamples: 18,
      requiredSamples: 33,
      reportStatus: 'rejected',
    })
    expect(grayProductionLutBlocked()).toBe(true)
    expect(grayProductionLutStatusLabel()).toBe('blocked / not published')
    expect(grayProductionLutBanner()).toBe('Production LUT: blocked / not published. 18/33 retained samples.')
    expect(grayProductionLutBlockReason()).toContain('GetDP cannot honestly complete')
    expect(grayProductionLutIsBlocked({
      ...GRAY_PRODUCTION_LUT_BLOCKER,
      productionLutPublished: true,
      failClosed: false,
      status: 'published',
      lutPath: GRAY_PRODUCTION_LUT_RELATIVE_PATH,
    })).toBe(false)
  })

  it.skipIf(!lutPresent)('opens the publication gate only when a real LUT path is published', () => {
    expect(GRAY_PRODUCTION_LUT_BLOCKER.productionLutPublished).toBe(true)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.lutPath).toBe(GRAY_PRODUCTION_LUT_RELATIVE_PATH)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.failClosed).toBe(false)
    expect(GRAY_PRODUCTION_LUT_BLOCKER.status).toBe('published')
    expect(grayProductionLutBlocked()).toBe(false)
    expect(grayProductionLutStatusLabel()).toBe('published')
    expect(grayProductionLutBanner()).toBe(`Production LUT: published. ${GRAY_PRODUCTION_LUT_RELATIVE_PATH}.`)
    expect(grayProductionLutIsBlocked({
      ...GRAY_PRODUCTION_LUT_BLOCKER,
      productionLutPublished: false,
      failClosed: true,
      status: 'blocked',
      lutPath: null,
    })).toBe(true)
  })
})
