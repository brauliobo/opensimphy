import { addScaled } from './vec'

export type Derivative<TState> = (state: TState) => TState

export function rk4Step(state: readonly number[], timeStep: number, derivative: (state: readonly number[]) => readonly number[]): number[] {
  const first = derivative(state)
  const second = derivative(addScaled(state, first, 0.5 * timeStep))
  const third = derivative(addScaled(state, second, 0.5 * timeStep))
  const fourth = derivative(addScaled(state, third, timeStep))
  return state.map((value, index) => (
    value + (timeStep / 6) * ((first[index] ?? 0) + 2 * (second[index] ?? 0) + 2 * (third[index] ?? 0) + (fourth[index] ?? 0))
  ))
}

export function leapfrogStep(
  position: readonly number[],
  velocity: readonly number[],
  timeStep: number,
  acceleration: (position: readonly number[]) => readonly number[],
): { position: number[], velocity: number[] } {
  const half = velocity.map((value, index) => value + 0.5 * timeStep * (acceleration(position)[index] ?? 0))
  const nextPosition = position.map((value, index) => value + timeStep * (half[index] ?? 0))
  const nextAcceleration = acceleration(nextPosition)
  const nextVelocity = half.map((value, index) => value + 0.5 * timeStep * (nextAcceleration[index] ?? 0))
  return { position: nextPosition, velocity: nextVelocity }
}

export function eulerStep(state: readonly number[], timeStep: number, derivative: (state: readonly number[]) => readonly number[]): number[] {
  return addScaled(state, derivative(state), timeStep)
}
