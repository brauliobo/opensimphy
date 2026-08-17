// Published copy of fem/edwin-gray/convergence/production-lut-blocker.json. Do not invent LUT values.
import blockerJson from '../../public/data/generated/edwin-gray/production-lut-blocker.json'

export interface GrayProductionLutBlockerV1 {
  contract: 'edwin-gray-production-lut-blocker'
  contractVersion: number
  lutPath: string | null
  productionLutPublished: boolean
  status: 'blocked'
  failClosed: boolean
  reason: string
  retainedEvidence: {
    presentSamples: number
    requiredSamples: number
    reportStatus: string
  }
}

export const GRAY_PRODUCTION_LUT_BLOCKER = Object.freeze(blockerJson) as GrayProductionLutBlockerV1

export function grayProductionLutBlocked(): boolean {
  return GRAY_PRODUCTION_LUT_BLOCKER.failClosed
    || GRAY_PRODUCTION_LUT_BLOCKER.productionLutPublished !== true
    || GRAY_PRODUCTION_LUT_BLOCKER.status === 'blocked'
    || GRAY_PRODUCTION_LUT_BLOCKER.lutPath === null
}

export function grayProductionLutBlockReason(): string {
  return GRAY_PRODUCTION_LUT_BLOCKER.reason
}
