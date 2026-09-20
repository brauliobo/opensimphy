import type { DimensionVector } from '../types/engine'
import {
  addDimensions,
  dimensionsEqual,
  SI_ACTION,
  SI_CHARGE,
  SI_CURRENT,
  SI_ENERGY,
  SI_FORCE,
  SI_FREQUENCY,
  SI_LENGTH,
  SI_MASS,
  SI_POWER,
  SI_PRESSURE,
  SI_TEMPERATURE,
  SI_TIME,
  SI_VOLTAGE,
  scaleDimension,
  subtractDimensions,
} from '../engine/dimensions'
import type { QuantityInterpretation } from './types'

interface QuantityKind {
  name: string
  kind: string
  dimension: DimensionVector
}

function kinds(kind: string, dimension: DimensionVector, names: readonly string[]): QuantityKind[] {
  return names.map((name) => ({ name, kind, dimension }))
}

const SPRING = addDimensions(SI_MASS, scaleDimension(SI_TIME, -2))
const SPEED = subtractDimensions(SI_LENGTH, SI_TIME)
const ACCELERATION = addDimensions(SI_LENGTH, scaleDimension(SI_TIME, -2))
const MOMENTUM = addDimensions(SI_MASS, addDimensions(SI_LENGTH, scaleDimension(SI_TIME, -1)))
const RESISTANCE = subtractDimensions(SI_VOLTAGE, SI_CURRENT)
const CAPACITANCE = subtractDimensions(SI_CHARGE, SI_VOLTAGE)
const INDUCTANCE = addDimensions(RESISTANCE, SI_TIME)
const MAGNETIC_FLUX = addDimensions(SI_VOLTAGE, SI_TIME)
const MAGNETIC_FLUX_DENSITY = subtractDimensions(SI_FORCE, addDimensions(SI_CURRENT, SI_LENGTH))
const ENTROPY = subtractDimensions(SI_ENERGY, SI_TEMPERATURE)

const QUANTITY_KINDS: readonly QuantityKind[] = Object.freeze([
  ...kinds('base', SI_MASS, ['mass']),
  ...kinds('base', SI_LENGTH, ['length']),
  ...kinds('base', SI_TIME, ['time']),
  ...kinds('base', SI_CHARGE, ['electric charge']),
  ...kinds('base', SI_TEMPERATURE, ['temperature']),
  ...kinds('derived', SI_FREQUENCY, ['frequency']),
  ...kinds('derived', SPEED, ['speed']),
  ...kinds('derived', ACCELERATION, ['acceleration']),
  ...kinds('derived', subtractDimensions(SI_MASS, SI_LENGTH), ['linear mass density']),
  ...kinds('derived', subtractDimensions(SI_MASS, scaleDimension(SI_LENGTH, 2)), ['area density']),
  ...kinds('derived', subtractDimensions(SI_MASS, scaleDimension(SI_LENGTH, 3)), ['mass density']),
  ...kinds('derived', SI_FORCE, ['force', 'weight']),
  ...kinds('derived', SPRING, [
    'spring constant',
    'force gradient',
    'linear force density',
    'stiffness',
    'surface tension',
    'tear strength',
    'Graves tear strength',
    'peel strength',
    'spectral radiant energy density (with respect to wavenumber)',
    'cleavage',
  ]),
  ...kinds('derived', SI_ENERGY, ['energy', 'work', 'torque', 'moment of force']),
  ...kinds('derived', SI_PRESSURE, ['pressure', 'stress', 'energy density']),
  ...kinds('derived', SI_POWER, ['power', 'radiant flux']),
  ...kinds('derived', MOMENTUM, ['momentum', 'impulse']),
  ...kinds('derived', SI_ACTION, ['action', 'angular momentum']),
  ...kinds('derived', SI_CURRENT, ['electric current']),
  ...kinds('derived', SI_VOLTAGE, ['voltage', 'electric potential']),
  ...kinds('derived', RESISTANCE, ['electric resistance']),
  ...kinds('derived', CAPACITANCE, ['electric capacitance']),
  ...kinds('derived', INDUCTANCE, ['inductance']),
  ...kinds('derived', MAGNETIC_FLUX, ['magnetic flux']),
  ...kinds('derived', MAGNETIC_FLUX_DENSITY, ['magnetic flux density']),
  ...kinds('derived', ENTROPY, ['entropy', 'heat capacity']),
  ...kinds('derived', scaleDimension(SI_LENGTH, 2), ['area']),
  ...kinds('derived', scaleDimension(SI_LENGTH, 3), ['volume']),
  ...kinds('derived', scaleDimension(SI_LENGTH, -1), ['wavenumber']),
])

export const QUANTITY_KIND_CAVEAT = 'These names share this dimension. Dimension equality is necessary but not quantity-kind identity (energy and torque are the standard counterexample).'

export function interpretDimension(dimension: DimensionVector): QuantityInterpretation[] {
  return QUANTITY_KINDS
    .filter((entry) => dimensionsEqual(entry.dimension, dimension))
    .map((entry) => ({ name: entry.name, kind: entry.kind }))
}
