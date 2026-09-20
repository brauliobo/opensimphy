import { CODATA_2022_MEASURED_CONSTANTS } from '../tour/physicsConstants'
import { BARE_ODD_GRAIN, PAIR_GRAIN } from './dressedAlpha'

export interface WindingRecipe {
  family: string
  id: string
  bare: number
  dress: (alpha: number) => number
}

export interface WindingHit {
  family: string
  id: string
  bare: number
  inverse: number
  dressing: number
  relativeError: number
  iterations: number
}

function hansTheta(alpha: number): number {
  return (Math.PI * alpha / 2) * (1 - 2 * alpha * alpha / (Math.PI * Math.PI))
}

function twoSin2(angle: number): number {
  const sine = Math.sin(angle)
  return 2 * sine * sine
}

function blochChord(phase: number): number {
  return twoSin2(phase / 2)
}

export function solveWinding(recipe: WindingRecipe): WindingHit | null {
  const codata = CODATA_2022_MEASURED_CONSTANTS.fineStructureConstant.value
  let alpha = 1 / recipe.bare
  let iterations = 0
  for (; iterations < 80; iterations++) {
    const dressing = recipe.dress(alpha)
    if (!Number.isFinite(dressing) || dressing <= 0) return null
    const next = 1 / (recipe.bare * dressing)
    if (!Number.isFinite(next) || next <= 0) return null
    if (Math.abs(next - alpha) <= 1e-18 * Math.max(1, Math.abs(alpha))) {
      alpha = next
      break
    }
    alpha = next
  }
  const dressing = recipe.dress(alpha)
  if (!Number.isFinite(dressing) || dressing <= 0) return null
  const inverse = recipe.bare * dressing
  return {
    family: recipe.family,
    id: recipe.id,
    bare: recipe.bare,
    inverse,
    dressing,
    relativeError: Math.abs(1 / inverse - codata) / codata,
    iterations: iterations + 1,
  }
}

export function windingRecipes(): WindingRecipe[] {
  const recipes: WindingRecipe[] = []
  const n = BARE_ODD_GRAIN
  const push = (family: string, id: string, dress: (alpha: number) => number, bare = n) => {
    recipes.push({ family, id, bare, dress })
  }

  push('hans', 'zp1+2sin²(θ)', (alpha) => 1 + twoSin2(hansTheta(alpha)))

  for (const cover of [2, 3, 4, 5, 6, 8]) {
    push('n-cover', `2sin²(${cover}θ)`, (alpha) => 1 + twoSin2(cover * hansTheta(alpha)))
  }
  for (const sub of [2, 3, 4]) {
    push('subcover', `2sin²(θ/${sub})`, (alpha) => 1 + twoSin2(hansTheta(alpha) / sub))
  }
  for (const zp of [2, 3, 4]) {
    push('zp-integer', `zp${zp}+2sin²(θ)`, (alpha) => zp + twoSin2(hansTheta(alpha)))
  }
  for (const amp of [1, 3, 4]) {
    push('amplitude', `1+${amp}sin²(θ)`, (alpha) => 1 + amp * Math.sin(hansTheta(alpha)) ** 2)
  }
  for (const phase of [1, 4]) {
    push('bloch', `|1-e^{i${phase}θ}|²/2`, (alpha) => 1 + blochChord(phase * hansTheta(alpha)))
  }
  for (const turns of [1, 2, 3, 4]) {
    push('full-turn', `2sin²(${turns}πα ε)`, (alpha) => {
      const eps = 1 - 2 * alpha * alpha / (Math.PI * Math.PI)
      return 1 + twoSin2(turns * Math.PI * alpha * eps)
    })
  }
  for (const half of [3, 4, 8]) {
    push('half-turn-k', `2sin²(${half}·πα/2 ε)`, (alpha) => 1 + twoSin2(half * hansTheta(alpha)))
  }
  push('pair-angle', '2sin²(πα/274)', (alpha) => 1 + twoSin2(Math.PI * alpha / PAIR_GRAIN))
  push('pair-angle', '2sin²(πα/137)', (alpha) => 1 + twoSin2(Math.PI * alpha / n))
  push('pair-angle', '2sin²(2πα/274)', (alpha) => 1 + twoSin2(2 * Math.PI * alpha / PAIR_GRAIN))
  for (const dir of [2, 3, 4]) {
    push('dirichlet', `sinc²(${dir}θ)`, (alpha) => {
      const theta = hansTheta(alpha)
      const denom = dir * Math.sin(theta)
      if (Math.abs(denom) < 1e-18) return 1
      return (Math.sin(dir * theta) / denom) ** 2
    })
  }
  push('cos', '2-cos(θ)', (alpha) => 2 - Math.cos(hansTheta(alpha)))
  push('cos', '2-cos(4θ)', (alpha) => 2 - Math.cos(4 * hansTheta(alpha)))
  for (const bare of [3, 7, 15, 69, 127, 274]) {
    push('hierarchy-bare', `bare${bare}·hans`, (alpha) => 1 + twoSin2(hansTheta(alpha)), bare)
  }
  return recipes
}

export function rankWindings(): WindingHit[] {
  return windingRecipes()
    .map(solveWinding)
    .filter((hit): hit is WindingHit => hit !== null)
    .sort((left, right) => left.relativeError - right.relativeError)
}

export function bestPerFamily(): WindingHit[] {
  const best = new Map<string, WindingHit>()
  for (const hit of rankWindings()) {
    const current = best.get(hit.family)
    if (!current || hit.relativeError < current.relativeError) best.set(hit.family, hit)
  }
  return [...best.values()].sort((left, right) => left.relativeError - right.relativeError)
}
