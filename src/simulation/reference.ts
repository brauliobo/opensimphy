import type { ViewBlock } from './types'

export interface NumericReference {
  nodes: number
  elements: number
  scalar: { min: number; max: number; mean: number }
  vector: { minMagnitude: number; maxMagnitude: number; meanMagnitude: number }
  tolerance: { absolute: number; relative: number }
}

export function summarizeView(block: ViewBlock) {
  const components = block.components
  const samples = block.values.length / components
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  for (let sample = 0; sample < samples; sample++) {
    let value = block.values[sample * components] ?? 0
    if (components === 3) {
      const y = block.values[sample * components + 1] ?? 0
      const z = block.values[sample * components + 2] ?? 0
      value = Math.hypot(value, y, z)
    }
    min = Math.min(min, value)
    max = Math.max(max, value)
    sum += value
  }
  return { min, max, mean: sum / samples, samples }
}

export function withinTolerance(actual: number, expected: number, absolute: number, relative: number) {
  return Math.abs(actual - expected) <= absolute + relative * Math.abs(expected)
}
