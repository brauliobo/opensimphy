// Published copy of fem/edwin-gray/convergence/production-lut-blocker.json. Do not invent LUT values.
import blockerJson from '../../public/data/generated/edwin-gray/production-lut-blocker.json'

export const GRAY_PRODUCTION_LUT_RELATIVE_PATH = 'data/generated/edwin-gray/motor-fem-lut-v1.json'

export interface GrayProductionLutBlockerV1 {
  contract: 'edwin-gray-production-lut-blocker'
  contractVersion: number
  lutPath: string | null
  productionLutPublished: boolean
  status: 'blocked' | 'published'
  failClosed: boolean
  reason: string
  retainedEvidence: {
    presentSamples: number
    requiredSamples: number
    reportStatus: string
  }
}

export const GRAY_PRODUCTION_LUT_BLOCKER = Object.freeze(blockerJson) as GrayProductionLutBlockerV1

export function grayProductionLutIsBlocked(blocker: GrayProductionLutBlockerV1 = GRAY_PRODUCTION_LUT_BLOCKER): boolean {
  return blocker.failClosed
    || blocker.productionLutPublished !== true
    || blocker.status !== 'published'
    || typeof blocker.lutPath !== 'string'
    || blocker.lutPath.length === 0
}

export function grayProductionLutBlocked(): boolean {
  return grayProductionLutIsBlocked(GRAY_PRODUCTION_LUT_BLOCKER)
}

export function grayProductionLutBlockReason(): string {
  return GRAY_PRODUCTION_LUT_BLOCKER.reason
}

export function grayProductionLutBanner(blocker: GrayProductionLutBlockerV1 = GRAY_PRODUCTION_LUT_BLOCKER): string {
  if (grayProductionLutIsBlocked(blocker)) {
    const { presentSamples, requiredSamples } = blocker.retainedEvidence
    return `Production LUT: blocked / not published. ${presentSamples}/${requiredSamples} retained samples.`
  }
  return `Production LUT: published. ${blocker.lutPath}.`
}

export function grayProductionLutStatusLabel(blocker: GrayProductionLutBlockerV1 = GRAY_PRODUCTION_LUT_BLOCKER): string {
  return grayProductionLutIsBlocked(blocker) ? 'blocked / not published' : 'published'
}
