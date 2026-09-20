import type { ComplexValue, DimensionVector } from '../types/engine'
import { DIMENSIONLESS, isDimensionless } from '../engine/dimensions'

const AXIS_SI: Array<[keyof DimensionVector, string]> = [
  ['mass', 'kg'],
  ['length', 'm'],
  ['time', 's'],
  ['charge', 'C'],
  ['temperature', 'K'],
]

const AXIS_BASIC: Array<[keyof DimensionVector, string]> = [
  ['mass', 'mass'],
  ['length', 'length'],
  ['time', 'time'],
  ['charge', 'charge'],
  ['temperature', 'temperature'],
]

function formatAxis(value: DimensionVector, labels: Array<[keyof DimensionVector, string]>, style: 'si' | 'basic'): string | null {
  const terms = labels
    .filter(([axis]) => Math.abs(value[axis]) > 1e-12)
    .map(([axis, label]) => {
      const exponent = value[axis]
      if (Math.abs(exponent - 1) <= 1e-12) return style === 'basic' ? `[${label}]` : label
      if (style === 'basic') return `[${label}]^{${formatExponent(exponent)}}`
      return `${label}^${formatExponent(exponent)}`
    })
  return terms.length ? terms.join(style === 'basic' ? '' : ' ') : null
}

function formatExponent(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 1e12) / 1e12)
}

export function formatSiUnit(value: DimensionVector): string {
  if (isDimensionless(value)) return '1'
  return formatAxis(value, AXIS_SI, 'si') ?? '1'
}

export function formatBasicDimensions(value: DimensionVector = DIMENSIONLESS): string {
  if (isDimensionless(value)) return 'dimensionless'
  return formatAxis(value, AXIS_BASIC, 'basic') ?? 'dimensionless'
}

export function formatComplex(value: ComplexValue, digits = 8): string {
  const re = formatScalar(value.re, digits)
  if (Math.abs(value.im) <= 1e-15) return re
  const im = formatScalar(Math.abs(value.im), digits)
  const sign = value.im < 0 ? '-' : '+'
  if (Math.abs(value.re) <= 1e-15) return value.im < 0 ? `-${im} i` : `${im} i`
  return `${re} ${sign} ${im} i`
}

export function formatScalar(value: number, digits = 8): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e6 || abs < 1e-3) return value.toExponential(digits)
  const printed = value.toPrecision(digits)
  return printed.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
}
