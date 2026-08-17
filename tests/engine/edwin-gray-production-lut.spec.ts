import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GRAY_PRODUCTION_LUT_BLOCKER,
  grayProductionLutBlocked,
  grayProductionLutBlockReason,
} from '../../src/edwin-gray/edwinGrayProductionLut'

const source = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/convergence/production-lut-blocker.json'), 'utf8'))
const published = JSON.parse(readFileSync(join(process.cwd(), 'public/data/generated/edwin-gray/production-lut-blocker.json'), 'utf8'))
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/cases/production-lut-blocker.json'), 'utf8'))

describe('Edwin Gray production LUT fail-closed', () => {
  it('mirrors the FEM blocker without publishing a LUT path or counts', () => {
    expect(published).toEqual(source)
    expect(fixture).toEqual(source)
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
    expect(grayProductionLutBlockReason()).toContain('GetDP cannot honestly complete')
  })
})
