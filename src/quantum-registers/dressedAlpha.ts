import { boundedInteger } from '../simphy/numbers'
import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'
import { grainCoupling } from './grainCoupling'

export const BARE_ODD_GRAIN = 137
export const PAIR_GRAIN = 2 * BARE_ODD_GRAIN

export interface DressedAlphaResult {
  bare: number
  solvedAlpha: number
  solvedInverse: number
  dressing: number
  windingArg: number
  iterations: number
  codataAlpha: number
  codataInverse: number
  identityResidual: number
  solvedRelativeError: number
  jumpRate: number
  jumpInverse: number
  jumpRelativeError: number
  finding: string
}

export type DressingKind = 'bare' | 'small-angle' | 'half-turn' | 'full'

export function windingArg(alpha: number, kind: DressingKind = 'full'): number {
  const halfTurn = Math.PI * alpha / 2
  if (kind === 'bare' || kind === 'small-angle') return 0
  if (kind === 'half-turn') return halfTurn
  return halfTurn * (1 - 2 * alpha * alpha / (Math.PI * Math.PI))
}

export function dressingFactor(alpha: number, kind: DressingKind = 'full', zp = 1): number {
  if (kind === 'bare') return zp
  if (kind === 'small-angle') return zp + Math.PI * Math.PI * alpha * alpha / 2
  const sine = Math.sin(windingArg(alpha, kind))
  return zp + 2 * sine * sine
}

export function dressedInverse(alpha: number, bare = BARE_ODD_GRAIN, kind: DressingKind = 'full', zp = 1): number {
  return boundedInteger(bare, 'bare', 2, 10_000) * dressingFactor(alpha, kind, zp)
}

export function solveDressedAlpha(
  bare = BARE_ODD_GRAIN,
  kind: DressingKind = 'full',
  zp = 1,
): { alpha: number, inverse: number, dressing: number, arg: number, iterations: number } {
  const n = boundedInteger(bare, 'bare', 2, 10_000)
  if (kind === 'bare') {
    return { alpha: zp / n, inverse: n / zp, dressing: zp, arg: 0, iterations: 0 }
  }
  let alpha = 1 / n
  let iterations = 0
  for (; iterations < 80; iterations++) {
    const next = 1 / dressedInverse(alpha, n, kind, zp)
    if (Math.abs(next - alpha) <= 1e-18 * Math.max(1, Math.abs(alpha))) {
      alpha = next
      break
    }
    alpha = next
  }
  return {
    alpha,
    inverse: 1 / alpha,
    dressing: dressingFactor(alpha, kind, zp),
    arg: windingArg(alpha, kind),
    iterations: iterations + 1,
  }
}

export function evaluateDressedAlpha(bare = BARE_ODD_GRAIN): DressedAlphaResult {
  const n       = boundedInteger(bare, 'bare', 2, 10_000)
  const solved  = solveDressedAlpha(n)
  const codata  = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  const identityResidual = Math.abs(dressedInverse(codata, n) - 1 / codata)
  const jumpRate = grainCoupling(2 * n)
  return {
    bare: n,
    solvedAlpha: solved.alpha,
    solvedInverse: solved.inverse,
    dressing: solved.dressing,
    windingArg: solved.arg,
    iterations: solved.iterations,
    codataAlpha: codata,
    codataInverse: 1 / codata,
    identityResidual,
    solvedRelativeError: Math.abs(solved.alpha - codata) / codata,
    jumpRate,
    jumpInverse: 1 / jumpRate,
    jumpRelativeError: Math.abs(jumpRate - codata) / codata,
    finding: `Bare ${n} dressed by zp+1 winding α⁻¹=${n}(1+2sin²((πα/2)(1-2α²/π²))) solves to ${solved.inverse.toFixed(9)} vs CODATA ${ (1 / codata).toFixed(9)} (rel ${ (Math.abs(solved.alpha - codata) / codata).toExponential(2) }). Completeness jump at grain ${2 * n} is w′=${jumpRate.toExponential(6)} (rel ${ (Math.abs(jumpRate - codata) / codata).toExponential(2) }). 137 is the bare odd grain; measured α is the dressed value, not 1/137.`,
  }
}
