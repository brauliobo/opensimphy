import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'
import { grainCoupling } from './grainCoupling'
import {
  BARE_ODD_GRAIN,
  type DressingKind,
  solveDressedAlpha,
} from './dressedAlpha'

export const PDG_SIN2_THETA_W_MSBAR = 0.23122
export const PDG_ALPHA_S_MZ = 0.1180

export interface AblationRow {
  kind: DressingKind
  zp: number
  inverse: number
  relativeError: number
}

export interface GrainMatch {
  name: string
  target: number
  grainM: number
  rate: number
  relativeError: number
}

export function ablationTable(bare = BARE_ODD_GRAIN): AblationRow[] {
  const codata = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  const kinds: DressingKind[] = ['bare', 'small-angle', 'half-turn', 'full']
  return kinds.map((kind) => {
    const solved = solveDressedAlpha(bare, kind, 1)
    return {
      kind,
      zp: 1,
      inverse: solved.inverse,
      relativeError: Math.abs(solved.alpha - codata) / codata,
    }
  })
}

export function zpTable(bare = BARE_ODD_GRAIN): AblationRow[] {
  const codata = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  return [1, 2, 3].map((zp) => {
    const solved = solveDressedAlpha(bare, 'full', zp)
    return {
      kind: 'full',
      zp,
      inverse: solved.inverse,
      relativeError: Math.abs(solved.alpha - codata) / codata,
    }
  })
}

export function expansionInverse(bare = BARE_ODD_GRAIN): { integer: number, pi2: number, sum: number, relativeError: number } {
  const n = bare
  const integer = n
  const pi2 = Math.PI * Math.PI / (2 * n)
  const sum = integer + pi2
  const codataInv = 1 / CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  return {
    integer,
    pi2,
    sum,
    relativeError: Math.abs(1 / sum - 1 / codataInv) / (1 / codataInv),
  }
}

export function nearestGrainMatches(): GrainMatch[] {
  const { electronMass, protonMass, fineStructureConstant } = CODATA_2022_MEASURED_CONSTANTS
  const targets = [
    { name: 'α',           value: fineStructureConstant.value },
    { name: '1/137',       value: 1 / 137 },
    { name: 'α/π',         value: fineStructureConstant.value / Math.PI },
    { name: 'sin²θ_W',     value: PDG_SIN2_THETA_W_MSBAR },
    { name: 'α_s(M_Z)',    value: PDG_ALPHA_S_MZ },
    { name: 'm_e/m_p',     value: electronMass.value / protonMass.value },
  ]
  return targets.map((target) => {
    let bestM = 2, bestErr = Infinity, bestRate = grainCoupling(2)
    for (let m = 2; m <= 400; m++) {
      const rate = grainCoupling(m)
      const err  = Math.abs(rate - target.value) / target.value
      if (err < bestErr) {
        bestM = m
        bestErr = err
        bestRate = rate
      }
    }
    return { name: target.name, target: target.value, grainM: bestM, rate: bestRate, relativeError: bestErr }
  })
}
