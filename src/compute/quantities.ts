import type { DimensionVector } from '../types/engine'
import { dimensionsEqual } from '../engine/dimensions'
import type { QuantityInterpretation } from './types'

interface QuantityKind {
  name: string
  kind: string
  dimension: DimensionVector
}

function dim(mass = 0, length = 0, time = 0, charge = 0, temperature = 0): DimensionVector {
  return { mass, length, time, charge, temperature }
}

const FORCE = dim(1, 1, -2)
const ENERGY = dim(1, 2, -2)
const PRESSURE = dim(1, -1, -2)
const POWER = dim(1, 2, -3)
const VOLTAGE = dim(1, 2, -2, -1)
const CURRENT = dim(0, 0, -1, 1)

const QUANTITY_KINDS: readonly QuantityKind[] = Object.freeze([
  { name: 'mass', kind: 'base', dimension: dim(1) },
  { name: 'length', kind: 'base', dimension: dim(0, 1) },
  { name: 'time', kind: 'base', dimension: dim(0, 0, 1) },
  { name: 'electric charge', kind: 'base', dimension: dim(0, 0, 0, 1) },
  { name: 'temperature', kind: 'base', dimension: dim(0, 0, 0, 0, 1) },
  { name: 'frequency', kind: 'derived', dimension: dim(0, 0, -1) },
  { name: 'speed', kind: 'derived', dimension: dim(0, 1, -1) },
  { name: 'acceleration', kind: 'derived', dimension: dim(0, 1, -2) },
  { name: 'linear mass density', kind: 'derived', dimension: dim(1, -1) },
  { name: 'area density', kind: 'derived', dimension: dim(1, -2) },
  { name: 'mass density', kind: 'derived', dimension: dim(1, -3) },
  { name: 'force', kind: 'derived', dimension: FORCE },
  { name: 'weight', kind: 'derived', dimension: FORCE },
  { name: 'spring constant', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'force gradient', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'linear force density', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'stiffness', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'surface tension', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'tear strength', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'Graves tear strength', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'peel strength', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'spectral radiant energy density (with respect to wavenumber)', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'cleavage', kind: 'derived', dimension: dim(1, 0, -2) },
  { name: 'energy', kind: 'derived', dimension: ENERGY },
  { name: 'work', kind: 'derived', dimension: ENERGY },
  { name: 'torque', kind: 'derived', dimension: ENERGY },
  { name: 'moment of force', kind: 'derived', dimension: ENERGY },
  { name: 'pressure', kind: 'derived', dimension: PRESSURE },
  { name: 'stress', kind: 'derived', dimension: PRESSURE },
  { name: 'energy density', kind: 'derived', dimension: PRESSURE },
  { name: 'power', kind: 'derived', dimension: POWER },
  { name: 'radiant flux', kind: 'derived', dimension: POWER },
  { name: 'momentum', kind: 'derived', dimension: dim(1, 1, -1) },
  { name: 'impulse', kind: 'derived', dimension: dim(1, 1, -1) },
  { name: 'action', kind: 'derived', dimension: dim(1, 2, -1) },
  { name: 'angular momentum', kind: 'derived', dimension: dim(1, 2, -1) },
  { name: 'electric current', kind: 'derived', dimension: CURRENT },
  { name: 'voltage', kind: 'derived', dimension: VOLTAGE },
  { name: 'electric potential', kind: 'derived', dimension: VOLTAGE },
  { name: 'electric resistance', kind: 'derived', dimension: dim(1, 2, -1, -2) },
  { name: 'electric capacitance', kind: 'derived', dimension: dim(-1, -2, 2, 2) },
  { name: 'inductance', kind: 'derived', dimension: dim(1, 2, 0, -2) },
  { name: 'magnetic flux', kind: 'derived', dimension: dim(1, 2, -1, -1) },
  { name: 'magnetic flux density', kind: 'derived', dimension: dim(1, 0, -1, -1) },
  { name: 'entropy', kind: 'derived', dimension: dim(1, 2, -2, 0, -1) },
  { name: 'heat capacity', kind: 'derived', dimension: dim(1, 2, -2, 0, -1) },
  { name: 'area', kind: 'derived', dimension: dim(0, 2) },
  { name: 'volume', kind: 'derived', dimension: dim(0, 3) },
  { name: 'wavenumber', kind: 'derived', dimension: dim(0, -1) },
])

export const QUANTITY_KIND_CAVEAT = 'These names share this dimension. Dimension equality is necessary but not quantity-kind identity (energy and torque are the standard counterexample).'

export function interpretDimension(dimension: DimensionVector): QuantityInterpretation[] {
  return QUANTITY_KINDS
    .filter((entry) => dimensionsEqual(entry.dimension, dimension))
    .map((entry) => ({ name: entry.name, kind: entry.kind }))
}
