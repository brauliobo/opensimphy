import { record, exactKeys, finiteNumber, boundedNumber, requireNonEmptyString, requireSafeIntegerBetween, throwIfAborted } from '../../../simphy/contract'
import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsAdapterCompatibilityV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

export type QmsolvePotentialKind = 'harmonic-oscillator'
export type QmsolveInitialStateKind = 'gaussian-wave-packet'

export interface QmsolveInput {
  potential: QmsolvePotentialKind
  initialState: QmsolveInitialStateKind
  gridSize: number
  domainHalfWidth: number
  timeStep: number
  steps: number
  oscillatorFrequency: number
  packetCenter: number
  packetWidth: number
  packetMomentum: number
  sampleCount: number
}

export interface QmsolveProbabilitySample {
  x: number
  potential: number
  probability: number
}

export interface QmsolveEnergySample {
  step: number
  time: number
  kinetic: number
  potential: number
  total: number
}

export interface QmsolveOutput {
  schemaVersion: 1
  method: 'central-finite-difference-crank-nicolson'
  unitSystem: 'dimensionless-harmonic-oscillator-units'
  input: QmsolveInput
  grid: {
    size: number
    spacing: number
    minimum: number
    maximum: number
  }
  probability: QmsolveProbabilitySample[]
  energy: QmsolveEnergySample[]
  normalization: {
    initial: number
    final: number
    maximumAbsoluteError: number
  }
  assumptions: string[]
  doesNotEstablish: string
  validatesTheory: false
}

export type QmsolveInputV1 = QmsolveInput
export type QmsolveOutputV1 = QmsolveOutput
export type QmsolveAdapter = AwesomePhysicsAdapterV1<QmsolveInput, QmsolveOutput>
export type QmsolveAdapterFactory = AwesomePhysicsAdapterFactoryV1<QmsolveInput, QmsolveOutput>

export const QMSOLVE_ADAPTER_ID = 'awesome-qmsolve-typescript'

export const QMSOLVE_BOUNDS = Object.freeze({
  gridSize: Object.freeze({ min: 33, max: 256 }),
  domainHalfWidth: Object.freeze({ min: 4, max: 20 }),
  timeStep: Object.freeze({ min: 1e-5, max: 0.05 }),
  steps: Object.freeze({ min: 1, max: 10_000 }),
  oscillatorFrequency: Object.freeze({ min: 0.1, max: 3 }),
  packetWidth: Object.freeze({ min: 0.25, max: 4 }),
  packetMomentum: Object.freeze({ min: -8, max: 8 }),
  sampleCount: Object.freeze({ min: 2, max: 65 }),
  maximumTotalTime: 40,
  maximumPhaseAdvance: 0.25,
} as const)

export const QMSOLVE_DEFAULT_INPUT: QmsolveInput = Object.freeze({
  potential: 'harmonic-oscillator',
  initialState: 'gaussian-wave-packet',
  gridSize: 65,
  domainHalfWidth: 8,
  timeStep: 0.002,
  steps: 240,
  oscillatorFrequency: 1,
  packetCenter: 0,
  packetWidth: 1,
  packetMomentum: 0,
  sampleCount: 13,
})

const HBAR = 1
const MASS = 1
const YIELD_INTERVAL = 32
const INPUT_KEYS = [
  'potential',
  'initialState',
  'gridSize',
  'domainHalfWidth',
  'timeStep',
  'steps',
  'oscillatorFrequency',
  'packetCenter',
  'packetWidth',
  'packetMomentum',
  'sampleCount',
] as const

interface ComplexState {
  real: Float64Array
  imaginary: Float64Array
}

interface EnergyValues {
  kinetic: number
  potential: number
  total: number
}

function requireSignalNotAborted(signal?: AbortSignal): void {
  throwIfAborted(signal, 'QMSolve educational adapter cancelled')
}

function validateInput(value: unknown): QmsolveInput {
  const object = record(value, 'QMSolve input')
  exactKeys(object, INPUT_KEYS, 'QMSolve input')
  if (object.potential !== 'harmonic-oscillator') throw new RangeError('QMSolve input supports only the harmonic-oscillator potential')
  if (object.initialState !== 'gaussian-wave-packet') throw new RangeError('QMSolve input supports only the gaussian-wave-packet initial state')
  const input: QmsolveInput = {
    potential:            'harmonic-oscillator',
    initialState:         'gaussian-wave-packet',
    gridSize:             requireSafeIntegerBetween(object.gridSize, 'gridSize', QMSOLVE_BOUNDS.gridSize.min, QMSOLVE_BOUNDS.gridSize.max),
    domainHalfWidth:      boundedNumber(object.domainHalfWidth, 'domainHalfWidth', QMSOLVE_BOUNDS.domainHalfWidth.min, QMSOLVE_BOUNDS.domainHalfWidth.max),
    timeStep:             boundedNumber(object.timeStep, 'timeStep', QMSOLVE_BOUNDS.timeStep.min, QMSOLVE_BOUNDS.timeStep.max),
    steps:                requireSafeIntegerBetween(object.steps, 'steps', QMSOLVE_BOUNDS.steps.min, QMSOLVE_BOUNDS.steps.max),
    oscillatorFrequency:  boundedNumber(object.oscillatorFrequency, 'oscillatorFrequency', QMSOLVE_BOUNDS.oscillatorFrequency.min, QMSOLVE_BOUNDS.oscillatorFrequency.max),
    packetCenter:         finiteNumber(object.packetCenter, 'packetCenter'),
    packetWidth:          boundedNumber(object.packetWidth, 'packetWidth', QMSOLVE_BOUNDS.packetWidth.min, QMSOLVE_BOUNDS.packetWidth.max),
    packetMomentum:       boundedNumber(object.packetMomentum, 'packetMomentum', QMSOLVE_BOUNDS.packetMomentum.min, QMSOLVE_BOUNDS.packetMomentum.max),
    sampleCount:          requireSafeIntegerBetween(object.sampleCount, 'sampleCount', QMSOLVE_BOUNDS.sampleCount.min, QMSOLVE_BOUNDS.sampleCount.max),
  }

  if (Math.abs(input.packetCenter) + 3 * input.packetWidth > input.domainHalfWidth) {
    throw new RangeError('packetCenter and packetWidth place too much of the packet outside the finite domain')
  }

  const spacing = 2 * input.domainHalfWidth / (input.gridSize - 1)
  if (spacing > input.packetWidth / 2) {
    throw new RangeError('gridSize is too small to resolve packetWidth')
  }

  const maximumPotential = 0.5 * input.oscillatorFrequency ** 2 * input.domainHalfWidth ** 2
  const maximumKinetic = 2 * HBAR ** 2 / (MASS * spacing ** 2)
  const maximumPhaseAdvance = input.timeStep * (maximumKinetic + maximumPotential) / HBAR
  if (!Number.isFinite(maximumPhaseAdvance) || maximumPhaseAdvance > QMSOLVE_BOUNDS.maximumPhaseAdvance) {
    throw new RangeError('timeStep is unstable or under-resolved for this grid')
  }
  if (input.timeStep * input.steps > QMSOLVE_BOUNDS.maximumTotalTime) {
    throw new RangeError(`timeStep * steps must be no greater than ${QMSOLVE_BOUNDS.maximumTotalTime}`)
  }

  return input
}

function gridValues(input: QmsolveInput): { coordinates: Float64Array; potential: Float64Array; spacing: number } {
  const spacing = 2 * input.domainHalfWidth / (input.gridSize - 1)
  const coordinates = new Float64Array(input.gridSize)
  const potential = new Float64Array(input.gridSize)
  for (let index = 0; index < input.gridSize; index += 1) {
    const x = -input.domainHalfWidth + spacing * index
    const value = 0.5 * input.oscillatorFrequency ** 2 * x ** 2
    if (!Number.isFinite(x) || !Number.isFinite(value)) throw new Error('QMSolve generated a non-finite grid or potential')
    coordinates[index] = x
    potential[index] = value
  }
  return { coordinates, potential, spacing }
}

function stateNorm(state: ComplexState, spacing: number): number {
  let sum = 0
  for (let index = 0; index < state.real.length; index += 1) {
    sum += state.real[index]! ** 2 + state.imaginary[index]! ** 2
  }
  return sum * spacing
}

function normalizeState(state: ComplexState, spacing: number): number {
  const norm = stateNorm(state, spacing)
  if (!Number.isFinite(norm) || norm <= 0) throw new Error('QMSolve state has a non-finite or zero norm')
  const factor = 1 / Math.sqrt(norm)
  for (let index = 0; index < state.real.length; index += 1) {
    state.real[index] = state.real[index]! * factor
    state.imaginary[index] = state.imaginary[index]! * factor
  }
  return stateNorm(state, spacing)
}

function initialState(input: QmsolveInput, coordinates: Float64Array, spacing: number): ComplexState {
  const state: ComplexState = {
    real: new Float64Array(input.gridSize),
    imaginary: new Float64Array(input.gridSize),
  }
  for (let index = 1; index < input.gridSize - 1; index += 1) {
    const displacement = coordinates[index]! - input.packetCenter
    const envelope = Math.exp(-(displacement ** 2) / (4 * input.packetWidth ** 2))
    const phase = input.packetMomentum * coordinates[index]! / HBAR
    state.real[index] = envelope * Math.cos(phase)
    state.imaginary[index] = envelope * Math.sin(phase)
  }
  normalizeState(state, spacing)
  return state
}

function energy(state: ComplexState, potential: Float64Array, spacing: number): EnergyValues {
  const inverseSpacingSquared = 1 / spacing ** 2
  let kinetic = 0
  let potentialEnergy = 0
  for (let index = 1; index < state.real.length - 1; index += 1) {
    const real = state.real[index]!
    const imaginary = state.imaginary[index]!
    const laplacianReal = (state.real[index + 1]! - 2 * real + state.real[index - 1]!) * inverseSpacingSquared
    const laplacianImaginary = (state.imaginary[index + 1]! - 2 * imaginary + state.imaginary[index - 1]!) * inverseSpacingSquared
    kinetic += -(HBAR ** 2) / (2 * MASS) * (real * laplacianReal + imaginary * laplacianImaginary)
    potentialEnergy += (real ** 2 + imaginary ** 2) * potential[index]!
  }
  const kineticEnergy = kinetic * spacing
  const expectedPotentialEnergy = potentialEnergy * spacing
  const total = kineticEnergy + expectedPotentialEnergy
  if (!Number.isFinite(kineticEnergy) || !Number.isFinite(expectedPotentialEnergy) || !Number.isFinite(total)) {
    throw new Error('QMSolve generated a non-finite energy')
  }
  return { kinetic: kineticEnergy, potential: expectedPotentialEnergy, total }
}

function crankNicolsonStep(
  state: ComplexState,
  potential: Float64Array,
  spacing: number,
  timeStep: number,
): ComplexState {
  const interiorSize = state.real.length - 2
  const coefficient = timeStep / (2 * HBAR)
  const diagonalImaginary = new Float64Array(interiorSize)
  const offDiagonalImaginary = coefficient * (-(HBAR ** 2) / (2 * MASS * spacing ** 2))
  const rightHandReal = new Float64Array(interiorSize)
  const rightHandImaginary = new Float64Array(interiorSize)
  const cPrimeReal = new Float64Array(interiorSize)
  const cPrimeImaginary = new Float64Array(interiorSize)
  const dPrimeReal = new Float64Array(interiorSize)
  const dPrimeImaginary = new Float64Array(interiorSize)

  for (let interior = 0; interior < interiorSize; interior += 1) {
    const index = interior + 1
    const diagonal = HBAR ** 2 / (MASS * spacing ** 2) + potential[index]!
    diagonalImaginary[interior] = coefficient * diagonal
    const hamiltonianReal = diagonal * state.real[index]!
      + (-0.5 * HBAR ** 2 / (MASS * spacing ** 2)) * (state.real[index - 1]! + state.real[index + 1]!)
    const hamiltonianImaginary = diagonal * state.imaginary[index]!
      + (-0.5 * HBAR ** 2 / (MASS * spacing ** 2)) * (state.imaginary[index - 1]! + state.imaginary[index + 1]!)
    rightHandReal[interior] = state.real[index]! + coefficient * hamiltonianImaginary
    rightHandImaginary[interior] = state.imaginary[index]! - coefficient * hamiltonianReal
  }

  for (let interior = 0; interior < interiorSize; interior += 1) {
    const previousCReal = interior === 0 ? 0 : cPrimeReal[interior - 1]!
    const previousCImaginary = interior === 0 ? 0 : cPrimeImaginary[interior - 1]!
    const denominatorReal = 1 + offDiagonalImaginary * previousCImaginary
    const denominatorImaginary = diagonalImaginary[interior]! - offDiagonalImaginary * previousCReal
    const denominatorSquared = denominatorReal ** 2 + denominatorImaginary ** 2
    if (!Number.isFinite(denominatorSquared) || denominatorSquared === 0) throw new Error('QMSolve tridiagonal system is singular')

    if (interior < interiorSize - 1) {
      cPrimeReal[interior] = offDiagonalImaginary * denominatorImaginary / denominatorSquared
      cPrimeImaginary[interior] = offDiagonalImaginary * denominatorReal / denominatorSquared
    }

    const previousDReal = interior === 0 ? 0 : dPrimeReal[interior - 1]!
    const previousDImaginary = interior === 0 ? 0 : dPrimeImaginary[interior - 1]!
    const numeratorReal = rightHandReal[interior]! + offDiagonalImaginary * previousDImaginary
    const numeratorImaginary = rightHandImaginary[interior]! - offDiagonalImaginary * previousDReal
    dPrimeReal[interior] = (numeratorReal * denominatorReal + numeratorImaginary * denominatorImaginary) / denominatorSquared
    dPrimeImaginary[interior] = (numeratorImaginary * denominatorReal - numeratorReal * denominatorImaginary) / denominatorSquared
  }

  const next: ComplexState = {
    real: new Float64Array(state.real.length),
    imaginary: new Float64Array(state.imaginary.length),
  }
  for (let interior = interiorSize - 1; interior >= 0; interior -= 1) {
    const nextReal = interior === interiorSize - 1 ? 0 : next.real[interior + 2]!
    const nextImaginary = interior === interiorSize - 1 ? 0 : next.imaginary[interior + 2]!
    const productReal = cPrimeReal[interior]! * nextReal - cPrimeImaginary[interior]! * nextImaginary
    const productImaginary = cPrimeReal[interior]! * nextImaginary + cPrimeImaginary[interior]! * nextReal
    next.real[interior + 1] = dPrimeReal[interior]! - productReal
    next.imaginary[interior + 1] = dPrimeImaginary[interior]! - productImaginary
  }
  return next
}

function sampleSteps(steps: number, sampleCount: number): number[] {
  return [...new Set(Array.from({ length: sampleCount }, (_, index) => Math.round(index * steps / (sampleCount - 1))))]
}

function finiteOutput(value: QmsolveOutput): QmsolveOutput {
  for (const point of value.probability) {
    if (![point.x, point.potential, point.probability].every(Number.isFinite)) throw new Error('QMSolve probability output is not JSON-safe')
  }
  for (const point of value.energy) {
    if (![point.step, point.time, point.kinetic, point.potential, point.total].every(Number.isFinite)) throw new Error('QMSolve energy output is not JSON-safe')
  }
  if (![value.grid.spacing, value.normalization.initial, value.normalization.final, value.normalization.maximumAbsoluteError].every(Number.isFinite)) {
    throw new Error('QMSolve diagnostic output is not JSON-safe')
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('QMSolve output could not be serialized as JSON')
  return value
}

function yieldToHost(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function evaluateQmsolve(value: QmsolveInput, signal?: AbortSignal): Promise<QmsolveOutput> {
  const input = validateInput(value)
  requireSignalNotAborted(signal)
  const { coordinates, potential, spacing } = gridValues(input)
  const state = initialState(input, coordinates, spacing)
  const initialNorm = stateNorm(state, spacing)
  const requestedEnergySteps = sampleSteps(input.steps, input.sampleCount)
  const requestedEnergyStepSet = new Set(requestedEnergySteps)
  const energySamples = new Map<number, QmsolveEnergySample>()
  let maximumAbsoluteError = Math.abs(initialNorm - 1)
  const initialEnergy = energy(state, potential, spacing)
  if (requestedEnergyStepSet.has(0)) {
    energySamples.set(0, { step: 0, time: 0, ...initialEnergy })
  }

  for (let step = 1; step <= input.steps; step += 1) {
    requireSignalNotAborted(signal)
    const next = crankNicolsonStep(state, potential, spacing, input.timeStep)
    state.real.set(next.real)
    state.imaginary.set(next.imaginary)
    const norm = normalizeState(state, spacing)
    maximumAbsoluteError = Math.max(maximumAbsoluteError, Math.abs(norm - 1))
    if (!Number.isFinite(norm) || !Number.isFinite(maximumAbsoluteError)) throw new Error('QMSolve state became non-finite')
    if (requestedEnergyStepSet.has(step)) {
      energySamples.set(step, { step, time: step * input.timeStep, ...energy(state, potential, spacing) })
    }
    if (step % YIELD_INTERVAL === 0) {
      await yieldToHost()
      requireSignalNotAborted(signal)
    }
  }

  const probability = Array.from({ length: input.gridSize }, (_, index) => ({
    x: coordinates[index]!,
    potential: potential[index]!,
    probability: state.real[index]! ** 2 + state.imaginary[index]! ** 2,
  }))
  const output: QmsolveOutput = {
    schemaVersion: 1,
    method: 'central-finite-difference-crank-nicolson',
    unitSystem: 'dimensionless-harmonic-oscillator-units',
    input,
    grid: {
      size: input.gridSize,
      spacing,
      minimum: -input.domainHalfWidth,
      maximum: input.domainHalfWidth,
    },
    probability,
    energy: requestedEnergySteps.map((step) => {
      const sample = energySamples.get(step)
      if (!sample) throw new Error(`QMSolve did not produce energy sample ${step}`)
      return sample
    }),
    normalization: {
      initial: initialNorm,
      final: stateNorm(state, spacing),
      maximumAbsoluteError,
    },
    assumptions: [
      'The calculation uses dimensionless harmonic-oscillator units with hbar = 1 and mass = 1.',
      'The potential is V(x) = 0.5 * oscillatorFrequency^2 * x^2 on a finite uniform grid.',
      'The wavefunction is zero at both domain boundaries and starts as a deterministic normalized Gaussian packet.',
      'The central second derivative is advanced by a directly implemented tridiagonal Crank-Nicolson solve; SciPy sparse and split-step implementations are not used or claimed equivalent.',
      'The displayed probability is a density sampled at grid nodes, and the displayed energy is a finite-difference expectation value.',
    ],
    doesNotEstablish: 'This educational finite-grid computation does not establish experimental agreement, continuum convergence beyond the selected grid, or scientific validation of a quantum theory.',
    validatesTheory: false,
  }
  return finiteOutput(output)
}

function descriptorString(value: unknown, label: string): string {
  return requireNonEmptyString(value, label)
}

function compatibilityFor(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): { adapterId: string; compatibility: AwesomePhysicsAdapterCompatibilityV1 } {
  requireSignalNotAborted(signal)
  if (descriptor.catalogItemId !== 'awesome-qmsolve' || descriptor.title !== 'QMsolve') {
    throw new TypeError('QMSolve adapter requires the QMSolve simulation descriptor')
  }
  if (descriptor.execution !== 'typescript') throw new TypeError('QMSolve adapter requires TypeScript execution')
  const revisions = [descriptor.contentRevision, descriptor.modelRevision, descriptor.implementationRevision, descriptor.outputRevision]
  if (revisions.some((revision) => typeof revision !== 'string' || revision.trim().length === 0)) {
    throw new TypeError('QMSolve descriptor revisions must be non-empty strings')
  }
  if (descriptor.adapterId !== undefined && (typeof descriptor.adapterId !== 'string' || descriptor.adapterId.trim().length === 0)) {
    throw new TypeError('QMSolve descriptor adapterId must be a non-empty string')
  }
  return {
    adapterId: descriptor.adapterId ?? QMSOLVE_ADAPTER_ID,
    compatibility: {
      contentRevision: descriptorString(descriptor.contentRevision, 'QMSolve descriptor.contentRevision'),
      modelRevision: descriptorString(descriptor.modelRevision, 'QMSolve descriptor.modelRevision'),
      implementationRevision: descriptorString(descriptor.implementationRevision, 'QMSolve descriptor.implementationRevision'),
      outputRevision: descriptorString(descriptor.outputRevision, 'QMSolve descriptor.outputRevision'),
    },
  }
}

export const createQmsolveAdapter: QmsolveAdapterFactory = (descriptor, signal) => {
  const { adapterId, compatibility } = compatibilityFor(descriptor, signal)
  return {
    adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility,
    run(input, runSignal) {
      requireSignalNotAborted(signal)
      requireSignalNotAborted(runSignal)
      return evaluateQmsolve(input, runSignal ?? signal)
    },
  }
}

export const qmsolveAdapterFactory: QmsolveAdapterFactory = createQmsolveAdapter
