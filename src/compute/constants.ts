import type { EvaluationSymbol } from '../types/engine'
import {
  BOLTZMANN_CONSTANT_J_PER_K,
  CODATA_2022_ALPHA,
  CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2,
  ELEMENTARY_CHARGE_C,
  PLANCK_CONSTANT_J_S,
  REDUCED_PLANCK_CONSTANT_J_S,
  SPEED_OF_LIGHT_M_PER_S,
  VACUUM_MAGNETIC_PERMEABILITY_H_PER_M,
} from '../simphy/constants'
import { complex } from '../engine/complex'
import {
  DIMENSIONLESS,
  UNIT_SYMBOLS,
  addDimensions,
  dimension,
  scaleDimension,
  subtractDimensions,
} from '../engine/dimensions'
import { defaultExpressionSymbols, evaluateExpression } from '../engine/expression'

const TIME = dimension(1)
const LENGTH = dimension(0, 1)
const CHARGE = dimension(0, 0, 1)
const TEMPERATURE = dimension(0, 0, 0, 1)
const MASS = dimension(0, 0, 0, 0, 1)
const ACTION = addDimensions(MASS, addDimensions(scaleDimension(LENGTH, 2), scaleDimension(TIME, -1)))
const ENERGY = addDimensions(MASS, addDimensions(scaleDimension(LENGTH, 2), scaleDimension(TIME, -2)))

function symbol(value: number, dim: ReturnType<typeof dimension>): EvaluationSymbol {
  return { value: complex(value), dimension: dim, source: 'primitive' }
}

function derived(expression: string, symbols: Record<string, EvaluationSymbol>): EvaluationSymbol {
  const evaluated = evaluateExpression(expression, symbols)
  return { value: evaluated.value, dimension: evaluated.dimension, source: 'primitive' }
}

export function computeBaseSymbols(): Record<string, EvaluationSymbol> {
  const symbols: Record<string, EvaluationSymbol> = {
    ...defaultExpressionSymbols(),
    ...UNIT_SYMBOLS,
    c:     symbol(SPEED_OF_LIGHT_M_PER_S, subtractDimensions(LENGTH, TIME)),
    h:     symbol(PLANCK_CONSTANT_J_S, ACTION),
    hbar:  symbol(REDUCED_PLANCK_CONSTANT_J_S, ACTION),
    ℏ:     symbol(REDUCED_PLANCK_CONSTANT_J_S, ACTION),
    G:     symbol(CODATA_2022_GRAVITATIONAL_CONSTANT_M3_PER_KG_S2, subtractDimensions(addDimensions(scaleDimension(LENGTH, 3), scaleDimension(TIME, -2)), MASS)),
    k_B:   symbol(BOLTZMANN_CONSTANT_J_PER_K, subtractDimensions(ENERGY, TEMPERATURE)),
    kB:    symbol(BOLTZMANN_CONSTANT_J_PER_K, subtractDimensions(ENERGY, TEMPERATURE)),
    q_e:   symbol(ELEMENTARY_CHARGE_C, CHARGE),
    alpha: symbol(CODATA_2022_ALPHA, DIMENSIONLESS),
    α:     symbol(CODATA_2022_ALPHA, DIMENSIONLESS),
    mu0:   symbol(VACUUM_MAGNETIC_PERMEABILITY_H_PER_M, addDimensions(addDimensions(MASS, LENGTH), scaleDimension(CHARGE, -2))),
    μ0:    symbol(VACUUM_MAGNETIC_PERMEABILITY_H_PER_M, addDimensions(addDimensions(MASS, LENGTH), scaleDimension(CHARGE, -2))),
  }
  symbols.ε0 = derived('1/(mu0 * c^2)', symbols)
  symbols.eps0 = symbols.ε0
  symbols.l_P = derived('sqrt(hbar * G / c^3)', symbols)
  symbols.t_P = derived('sqrt(hbar * G / c^5)', symbols)
  symbols.m_P = derived('sqrt(hbar * c / G)', symbols)
  symbols.T_P = derived('sqrt(hbar * c^5 / G) / k_B', symbols)
  symbols.E_P = derived('m_P * c^2', symbols)
  symbols.q_P = derived('sqrt(4 * pi * ε0 * hbar * c)', symbols)
  return symbols
}

export const COMPUTE_PHRASE_ALIASES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['reduced planck constant', 'hbar'],
  ['planck\'s constant', 'h'],
  ['planck constant', 'h'],
  ['planck mass', 'm_P'],
  ['planck length', 'l_P'],
  ['planck time', 't_P'],
  ['planck temperature', 'T_P'],
  ['planck energy', 'E_P'],
  ['planck charge', 'q_P'],
  ['speed of light', 'c'],
  ['gravitational constant', 'G'],
  ['newtonian constant', 'G'],
  ['boltzmann constant', 'k_B'],
  ['elementary charge', 'q_e'],
  ['vacuum permeability', 'mu0'],
  ['vacuum permittivity', 'eps0'],
  ['fine structure constant', 'alpha'],
  ['fine-structure constant', 'alpha'],
])
