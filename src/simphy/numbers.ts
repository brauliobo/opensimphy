export function finiteNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`)
  return value
}

export function boundedInteger(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

export function positiveNumber(value: number, name: string): number {
  finiteNumber(value, name)
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`)
  return value
}

export function nonNegativeNumber(value: number, name: string): number {
  finiteNumber(value, name)
  if (value < 0) throw new RangeError(`${name} must be non-negative`)
  return value
}

export function requireInteger(value: number, name: string): number {
  finiteNumber(value, name)
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`)
  return value
}

export function boundedNumber(value: number, name: string, minimum: number, maximum: number, unit?: string): number {
  finiteNumber(value, name)
  if (value < minimum || value > maximum) {
    throw new RangeError(`${name} must be within [${minimum}, ${maximum}]${unit === undefined ? '' : ` ${unit}`}`)
  }
  return value
}

export function boundedPositive(value: number, name: string, minimum: number, maximum: number): number {
  positiveNumber(value, name)
  return boundedNumber(value, name, minimum, maximum)
}

export function logarithmicSamples(minimum: number, maximum: number, count: number): number[] {
  if (count === 1) return [minimum]
  const logarithmicMinimum = Math.log(minimum)
  const span = Math.log(maximum) - logarithmicMinimum
  return Array.from({ length: count }, (_, index) => Math.exp(logarithmicMinimum + span * index / (count - 1)))
}

export function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected)
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

export function gaussian(random: () => number): number {
  const first = Math.max(random(), Number.MIN_VALUE)
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random())
}
