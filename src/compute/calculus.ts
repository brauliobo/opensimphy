export function finiteDifference(f: (x: number) => number, x: number, step = 1e-6): number {
  return (f(x + step) - f(x - step)) / (2 * step)
}

export function adaptiveSimpson(f: (x: number) => number, from: number, to: number, tolerance = 1e-10, depth = 20): number {
  const midpoint = (from + to) / 2
  const whole = simpson(f, from, to)
  const split = simpson(f, from, midpoint) + simpson(f, midpoint, to)
  if (depth <= 0 || Math.abs(split - whole) <= 15 * tolerance) return split + (split - whole) / 15
  return adaptiveSimpson(f, from, midpoint, tolerance / 2, depth - 1) + adaptiveSimpson(f, midpoint, to, tolerance / 2, depth - 1)
}

function simpson(f: (x: number) => number, from: number, to: number): number {
  const midpoint = (from + to) / 2
  return (to - from) / 6 * (f(from) + 4 * f(midpoint) + f(to))
}

export function newtonRoot(f: (x: number) => number, guess: number, steps = 40): number {
  let x = guess
  for (let index = 0; index < steps; index += 1) {
    const slope = finiteDifference(f, x)
    if (Math.abs(slope) < 1e-15) break
    const next = x - f(x) / slope
    if (!Number.isFinite(next) || Math.abs(next - x) < 1e-12) return next
    x = next
  }
  return x
}

export function sampleAxis(from: number, to: number, count: number): number[] {
  if (count < 2) throw new RangeError('sampleAxis requires at least two points')
  const span = to - from
  return Array.from({ length: count }, (_, index) => from + span * index / (count - 1))
}
