import {
  CODATA_2022_MEASURED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from '../tour/physicsConstants'

export type SpectralElement = 'hydrogen' | 'sodium' | 'calcium'
export type OperatorWaveKind = 'pure' | 'packet'
export type OrbitalMode = '1s' | '2p' | 'bands'

export interface PlotPoint {
  x: number
  y: number
}

export interface SpectrumInput {
  element: SpectralElement
  upperLevel: number
  lowerLevel: number
  catalogIndex?: number
}

export interface SpectrumLine {
  label: string
  wavelengthNm: number
  frequencyHz: number
  energyEv: number
  color: string
}

export interface SpectrumResult {
  element: SpectralElement
  upperLevel: number
  lowerLevel: number
  selected: SpectrumLine
  lines: SpectrumLine[]
  levels: Array<{ n: number; energyEv: number }>
  finding: string
}

export interface StandingWaveInput {
  amplitude: number
  modeNumber: number
  period: number
  time: number
}

export interface StandingWaveResult {
  amplitude: number
  wavelength: number
  period: number
  time: number
  waveNumber: number
  angularFrequency: number
  points: PlotPoint[]
  envelope: PlotPoint[]
  nodes: number[]
  antinodes: number[]
  domainLength: number
  modeNumber: number
}

export interface OperatorInput {
  kind: OperatorWaveKind
  wavelength: number
  packetWidth: number
}

export interface OperatorPoint {
  x: number
  wave: number
  firstDerivative: number
  curvature: number
  kineticOperatorActionJ: number
}

export interface OperatorResult {
  kind: OperatorWaveKind
  waveNumber: number
  momentumMagnitude: number
  pureWaveKineticEigenvalueJ: number
  points: OperatorPoint[]
  table: OperatorPoint[]
  finding: string
}

export interface FourierInput {
  componentCount: number
}

export interface FourierComponent {
  harmonic: number
  coefficient: number
  points: PlotPoint[]
}

export interface FourierPoint {
  x: number
  target: number
  sum: number
}

export interface FourierResult {
  componentCount: number
  highestHarmonic: number
  points: FourierPoint[]
  components: FourierComponent[]
  rmse: number
  finding: string
}

export interface ComplexWaveInput {
  mode: 'complex' | 'real'
  time: number
  waveNumber: number
  growthRate: number
}

export interface ComplexWavePoint {
  x: number
  real: number
  imaginary: number
  magnitude: number
  probability: number
}

export interface ComplexWaveResult {
  mode: ComplexWaveInput['mode']
  time: number
  vector: { real: number; imaginary: number; magnitude: number; angle: number }
  path: PlotPoint[]
  wave: ComplexWavePoint[]
  magnitudeRange: { minimum: number; maximum: number }
  finding: string
}

export interface ProbabilityInput {
  wavelength: number
  slitSeparation: number
  screenDistance: number
  shots: number
  coherent: boolean
}

export interface ProbabilitySample {
  y: number
  amplitudeReal: number
  amplitudeImaginary: number
  probability: number
  counts: number
}

export interface ProbabilityResult {
  wavelength: number
  slitSeparation: number
  screenDistance: number
  shots: number
  coherent: boolean
  screen: ProbabilitySample[]
  table: ProbabilitySample[]
  totalProbability: number
  realAxisTotalRange: { minimum: number; maximum: number }
  finding: string
}

export interface OrbitalPoint {
  x: number
  y: number
  probability: number
}

export interface HydrogenMaterialsInput {
  mode: OrbitalMode
  bandGapEv: number
}

export interface HydrogenMaterialsResult {
  mode: OrbitalMode
  bandGapEv: number
  orbital: OrbitalPoint[]
  potential: PlotPoint[]
  bands: Array<{ label: string; y: number; height: number; kind: 'valence' | 'gap' | 'conduction' }>
  finding: string
}

const TWO_PI = 2 * Math.PI
const SPEED_OF_LIGHT = SI_EXACT_CONSTANTS.speedOfLight.value
const PLANCK_CONSTANT = SI_EXACT_CONSTANTS.planckConstant.value
const HBAR = SI_EXACT_CONSTANTS.reducedPlanckConstant.value
const ELECTRON_MASS = CODATA_2022_MEASURED_CONSTANTS.electronMass.value
const RYDBERG = CODATA_2022_MEASURED_CONSTANTS.rydbergConstant.value
const ELECTRON_VOLT = SI_EXACT_CONSTANTS.elementaryCharge.value

export const QUANTUM_WAVE_BOUNDS = Object.freeze({
  spectrum: Object.freeze({ upperLevel: { min: 2, max: 8 }, lowerLevel: { min: 1, max: 7 }, catalogIndex: { min: 0, max: 2 } }),
  standingWave: Object.freeze({ amplitude: { min: 0.2, max: 1.5 }, modeNumber: { min: 1, max: 5 }, period: { min: 0.5, max: 4 }, time: { min: 0, max: 4 } }),
  operator: Object.freeze({ wavelength: { min: 1.5, max: 8 }, packetWidth: { min: 0.6, max: 3 } }),
  fourier: Object.freeze({ componentCount: { min: 1, max: 9 } }),
  complex: Object.freeze({ time: { min: 0, max: TWO_PI }, waveNumber: { min: 0.4, max: 2 }, growthRate: { min: -0.35, max: 0.35 } }),
  probability: Object.freeze({ wavelength: { min: 0.4, max: 2 }, slitSeparation: { min: 0.5, max: 2.5 }, screenDistance: { min: 4, max: 12 }, shots: { min: 50, max: 500 } }),
  hydrogenMaterials: Object.freeze({ bandGapEv: { min: 0.1, max: 3 } }),
} as const)

const SPECTRAL_CATALOG: Readonly<Record<Exclude<SpectralElement, 'hydrogen'>, readonly SpectrumLine[]>> = Object.freeze({
  sodium: Object.freeze([
    { label: 'D2', wavelengthNm: 588.995, frequencyHz: SPEED_OF_LIGHT / (588.995e-9), energyEv: PLANCK_CONSTANT * SPEED_OF_LIGHT / (588.995e-9) / ELECTRON_VOLT, color: '#e6b85c' },
    { label: 'D1', wavelengthNm: 589.592, frequencyHz: SPEED_OF_LIGHT / (589.592e-9), energyEv: PLANCK_CONSTANT * SPEED_OF_LIGHT / (589.592e-9) / ELECTRON_VOLT, color: '#e6b85c' },
  ]),
  calcium: Object.freeze([
    { label: 'K', wavelengthNm: 393.366, frequencyHz: SPEED_OF_LIGHT / (393.366e-9), energyEv: PLANCK_CONSTANT * SPEED_OF_LIGHT / (393.366e-9) / ELECTRON_VOLT, color: '#8eafff' },
    { label: 'H', wavelengthNm: 396.847, frequencyHz: SPEED_OF_LIGHT / (396.847e-9), energyEv: PLANCK_CONSTANT * SPEED_OF_LIGHT / (396.847e-9) / ELECTRON_VOLT, color: '#8eafff' },
    { label: 'g', wavelengthNm: 422.673, frequencyHz: SPEED_OF_LIGHT / (422.673e-9), energyEv: PLANCK_CONSTANT * SPEED_OF_LIGHT / (422.673e-9) / ELECTRON_VOLT, color: '#cbb4ff' },
  ]),
})

export const SPECTRAL_REFERENCE_LINE_COUNTS = Object.freeze({ sodium: 2, calcium: 3 } as const)

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

function assertRange(value: number, label: string, minimum: number, maximum: number): void {
  assertFinite(value, label)
  if (value < minimum || value > maximum) throw new RangeError(`${label} must be within [${minimum}, ${maximum}]`)
}

function assertIntegerRange(value: number, label: string, minimum: number, maximum: number): void {
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be an integer`)
  assertRange(value, label, minimum, maximum)
}

function grid(minimum: number, maximum: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => minimum + (maximum - minimum) * index / (count - 1))
}

function sampledRows<T>(values: readonly T[], rowCount: number): T[] {
  if (values.length <= rowCount) return [...values]
  return Array.from({ length: rowCount }, (_, index) => values[Math.round(index * (values.length - 1) / (rowCount - 1))]!)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function hydrogenLine(upperLevel: number, lowerLevel: number): SpectrumLine {
  const wavenumber = RYDBERG * (1 / lowerLevel ** 2 - 1 / upperLevel ** 2)
  const wavelengthNm = 1e9 / wavenumber
  const frequencyHz = SPEED_OF_LIGHT * wavenumber
  return {
    label: `n=${upperLevel} to n=${lowerLevel}`,
    wavelengthNm,
    frequencyHz,
    energyEv: PLANCK_CONSTANT * frequencyHz / ELECTRON_VOLT,
    color: wavelengthNm >= 620 ? '#ef755f' : wavelengthNm >= 450 ? '#63cbd1' : '#bca5ff',
  }
}

export function evaluateSpectrum(input: SpectrumInput): SpectrumResult {
  if (!Object.hasOwn(SPECTRAL_CATALOG, input.element) && input.element !== 'hydrogen') {
    throw new Error(`Unknown spectral element: ${input.element}`)
  }
  assertIntegerRange(input.upperLevel, 'upperLevel', QUANTUM_WAVE_BOUNDS.spectrum.upperLevel.min, QUANTUM_WAVE_BOUNDS.spectrum.upperLevel.max)
  assertIntegerRange(input.lowerLevel, 'lowerLevel', QUANTUM_WAVE_BOUNDS.spectrum.lowerLevel.min, QUANTUM_WAVE_BOUNDS.spectrum.lowerLevel.max)
  if (input.element === 'hydrogen' && input.lowerLevel >= input.upperLevel) throw new RangeError('Hydrogen lowerLevel must be below upperLevel')

  const lines = input.element === 'hydrogen'
    ? [...new Set([
        input.upperLevel,
        ...Array.from({ length: 8 }, (_, index) => input.lowerLevel + index + 1),
      ])]
      .filter((level) => level > input.lowerLevel)
      .slice(0, 5)
      .map((level) => hydrogenLine(level, input.lowerLevel))
    : [...SPECTRAL_CATALOG[input.element]]
  const selected = input.element === 'hydrogen'
    ? hydrogenLine(input.upperLevel, input.lowerLevel)
    : (() => {
        const catalogIndex = input.catalogIndex ?? 0
        assertIntegerRange(catalogIndex, 'catalogIndex', 0, lines.length - 1)
        return lines[catalogIndex]!
      })()
  const levels = Array.from({ length: 8 }, (_, index) => {
    const n = index + 1
    return { n, energyEv: -13.6 / n ** 2 }
  })

  return {
    element: input.element,
    upperLevel: input.upperLevel,
    lowerLevel: input.lowerLevel,
    selected,
    lines,
    levels,
    finding: input.element === 'hydrogen'
      ? `The selected energy-level difference corresponds to ${selected.wavelengthNm.toFixed(2)} nm in the hydrogen-like model.`
      : `${input.element[0]!.toUpperCase()}${input.element.slice(1)} contributes a recognizable line signature; the catalog is a compact reference, not a full atomic model.`,
  }
}

export function evaluateStandingWave(input: StandingWaveInput): StandingWaveResult {
  assertRange(input.amplitude, 'amplitude', QUANTUM_WAVE_BOUNDS.standingWave.amplitude.min, QUANTUM_WAVE_BOUNDS.standingWave.amplitude.max)
  assertIntegerRange(input.modeNumber, 'standing-wave modeNumber', QUANTUM_WAVE_BOUNDS.standingWave.modeNumber.min, QUANTUM_WAVE_BOUNDS.standingWave.modeNumber.max)
  assertRange(input.period, 'period', QUANTUM_WAVE_BOUNDS.standingWave.period.min, QUANTUM_WAVE_BOUNDS.standingWave.period.max)
  assertRange(input.time, 'time', QUANTUM_WAVE_BOUNDS.standingWave.time.min, QUANTUM_WAVE_BOUNDS.standingWave.time.max)
  const domainLength = 8
  const wavelength = 2 * domainLength / input.modeNumber
  const waveNumber = input.modeNumber * Math.PI / domainLength
  const angularFrequency = TWO_PI / input.period
  const points = grid(0, domainLength, 161).map((x) => ({
    x,
    y: input.amplitude * Math.sin(waveNumber * x) * Math.cos(angularFrequency * input.time),
  }))
  const envelope = grid(0, domainLength, 25).map((x) => ({ x, y: input.amplitude * Math.sin(waveNumber * x) }))
  const nodes = Array.from({ length: input.modeNumber + 1 }, (_, index) => index * domainLength / input.modeNumber)
  const antinodes = Array.from({ length: input.modeNumber }, (_, index) => (index + 0.5) * domainLength / input.modeNumber)
  return { ...input, wavelength, waveNumber, angularFrequency, points, envelope, nodes, antinodes, domainLength, modeNumber: input.modeNumber }
}

function operatorWave(x: number, input: OperatorInput, waveNumber: number): number {
  const carrier = Math.sin(waveNumber * x)
  if (input.kind === 'pure') return carrier
  return Math.exp(-(x ** 2) / (2 * input.packetWidth ** 2)) * carrier
}

export function evaluateOperator(input: OperatorInput): OperatorResult {
  if (!['pure', 'packet'].includes(input.kind)) throw new Error(`Unknown operator wave kind: ${input.kind}`)
  assertRange(input.wavelength, 'operator wavelength', QUANTUM_WAVE_BOUNDS.operator.wavelength.min, QUANTUM_WAVE_BOUNDS.operator.wavelength.max)
  assertRange(input.packetWidth, 'packet width', QUANTUM_WAVE_BOUNDS.operator.packetWidth.min, QUANTUM_WAVE_BOUNDS.operator.packetWidth.max)
  const waveNumber = TWO_PI / input.wavelength
  const sampleStep = 0.04
  const points = grid(-8, 8, 241).map((x) => {
    const wave = operatorWave(x, input, waveNumber)
    const firstDerivative = (operatorWave(x + sampleStep, input, waveNumber) - operatorWave(x - sampleStep, input, waveNumber)) / (2 * sampleStep)
    const curvature = (operatorWave(x + sampleStep, input, waveNumber) - 2 * wave + operatorWave(x - sampleStep, input, waveNumber)) / sampleStep ** 2
    const kineticOperatorActionJ = -(HBAR ** 2) / (2 * ELECTRON_MASS) * curvature
    return { x, wave, firstDerivative, curvature, kineticOperatorActionJ }
  })
  const pureWaveKineticEigenvalueJ = HBAR ** 2 * waveNumber ** 2 / (2 * ELECTRON_MASS)
  return {
    kind: input.kind,
    waveNumber,
    momentumMagnitude: HBAR * waveNumber,
    pureWaveKineticEigenvalueJ,
    points,
    table: sampledRows(points,  nineRows()),
    finding: input.kind === 'pure'
      ? 'The second derivative returns the same sine shape with a minus sign, so curvature can be turned into a kinetic-energy operator for this component.'
      : 'A packet contains many spatial frequencies. The operator still acts locally, but its kinetic-energy readout varies across the packet instead of being one single eigenvalue.',
  }
}

function nineRows(): number {
  return 9
}

export function evaluateFourier(input: FourierInput): FourierResult {
  assertIntegerRange(input.componentCount, 'Fourier componentCount', QUANTUM_WAVE_BOUNDS.fourier.componentCount.min, QUANTUM_WAVE_BOUNDS.fourier.componentCount.max)
  const highestHarmonic = 2 * input.componentCount - 1
  const xValues = grid(-Math.PI, Math.PI, 161)
  const components = Array.from({ length: input.componentCount }, (_, index) => {
    const harmonic = 2 * index + 1
    const coefficient = 4 / (Math.PI * harmonic)
    return {
      harmonic,
      coefficient,
      points: xValues.map((x) => ({ x, y: coefficient * Math.sin(harmonic * x) })),
    }
  })
  const points = xValues.map((x) => {
    const target = Math.sin(x) >= 0 ? 1 : -1
    const sum = components.reduce((total, component) => total + component.coefficient * Math.sin(component.harmonic * x), 0)
    return { x, target, sum }
  })
  const rmse = Math.sqrt(points.reduce((total, point) => total + (point.sum - point.target) ** 2, 0) / points.length)
  return {
    componentCount: input.componentCount,
    highestHarmonic,
    points,
    components,
    rmse,
    finding: `${input.componentCount} odd sine components reproduce a bounded approximation to a square wave. Each component can be differentiated separately because differentiation is linear; the finite sum is still an approximation at the sharp edges.`,
  }
}

export function evaluateComplexWave(input: ComplexWaveInput): ComplexWaveResult {
  if (!['complex', 'real'].includes(input.mode)) throw new Error(`Unknown wave mode: ${input.mode}`)
  assertRange(input.time, 'complex-wave time', QUANTUM_WAVE_BOUNDS.complex.time.min, QUANTUM_WAVE_BOUNDS.complex.time.max)
  assertRange(input.waveNumber, 'complex-wave number', QUANTUM_WAVE_BOUNDS.complex.waveNumber.min, QUANTUM_WAVE_BOUNDS.complex.waveNumber.max)
  assertRange(input.growthRate, 'growth rate', QUANTUM_WAVE_BOUNDS.complex.growthRate.min, QUANTUM_WAVE_BOUNDS.complex.growthRate.max)
  const angle = -(input.waveNumber * input.time)
  const radius = input.mode === 'complex' ? 1 : Math.exp(input.growthRate * input.time)
  const vector = input.mode === 'complex'
    ? { real: Math.cos(angle), imaginary: Math.sin(angle), magnitude: 1, angle }
    : { real: radius, imaginary: 0, magnitude: radius, angle: 0 }
  const path = grid(0, input.time, 65).map((time) => {
    const pathAngle = -(input.waveNumber * time)
    const pathRadius = input.mode === 'complex' ? 1 : Math.exp(input.growthRate * time)
    return input.mode === 'complex'
      ? { x: pathRadius * Math.cos(pathAngle), y: pathRadius * Math.sin(pathAngle) }
      : { x: pathRadius, y: 0 }
  })
  const wave = grid(-Math.PI * 2, Math.PI * 2, 129).map((x) => {
    const phase = input.waveNumber * x - input.waveNumber * input.time
    if (input.mode === 'complex') {
      const real = Math.cos(phase)
      const imaginary = Math.sin(phase)
      return { x, real, imaginary, magnitude: 1, probability: 1 }
    }
    const real = Math.exp(input.growthRate * input.time) * Math.cos(phase)
    return { x, real, imaginary: 0, magnitude: Math.abs(real), probability: real ** 2 }
  })
  const magnitudes = wave.map(({ magnitude }) => magnitude)
  return {
    mode: input.mode,
    time: input.time,
    vector,
    path,
    wave,
    magnitudeRange: { minimum: Math.min(...magnitudes), maximum: Math.max(...magnitudes) },
    finding: input.mode === 'complex'
      ? 'Multiplication by i turns the derivative direction sideways. The complex exponential rotates on a circle, keeping |psi| fixed while its phase changes.'
      : 'A real exponential can reproduce itself under differentiation, but it grows or decays. Its squared amplitude is therefore not a stable probability density.',
  }
}

function probabilityRows(points: readonly ProbabilitySample[], rowCount = 11): ProbabilitySample[] {
  return sampledRows(points, rowCount)
}

export function evaluateProbability(input: ProbabilityInput): ProbabilityResult {
  assertRange(input.wavelength, 'probability wavelength', QUANTUM_WAVE_BOUNDS.probability.wavelength.min, QUANTUM_WAVE_BOUNDS.probability.wavelength.max)
  assertRange(input.slitSeparation, 'slit separation', QUANTUM_WAVE_BOUNDS.probability.slitSeparation.min, QUANTUM_WAVE_BOUNDS.probability.slitSeparation.max)
  assertRange(input.screenDistance, 'screen distance', QUANTUM_WAVE_BOUNDS.probability.screenDistance.min, QUANTUM_WAVE_BOUNDS.probability.screenDistance.max)
  assertIntegerRange(input.shots, 'detector shots', QUANTUM_WAVE_BOUNDS.probability.shots.min, QUANTUM_WAVE_BOUNDS.probability.shots.max)
  const raw = grid(-4, 4, 161).map((y) => {
    const envelope = Math.exp(-(y ** 2) / 7)
    const phase = Math.PI * input.slitSeparation * y / (input.wavelength * input.screenDistance)
    const slitA = { real: envelope * Math.cos(phase), imaginary: envelope * Math.sin(phase) }
    const slitB = { real: envelope * Math.cos(-phase), imaginary: envelope * Math.sin(-phase) }
    const amplitudeReal = input.coherent ? slitA.real + slitB.real : slitA.real
    const amplitudeImaginary = input.coherent ? slitA.imaginary + slitB.imaginary : slitA.imaginary
    const intensity = input.coherent
      ? amplitudeReal ** 2 + amplitudeImaginary ** 2
      : (slitA.real ** 2 + slitA.imaginary ** 2 + slitB.real ** 2 + slitB.imaginary ** 2) / 2
    return { y, amplitudeReal, amplitudeImaginary, intensity }
  })
  const rawTotal = raw.reduce((total, point) => total + point.intensity, 0)
  const normalized = raw.map(({ y, amplitudeReal, amplitudeImaginary, intensity }) => ({
    y,
    amplitudeReal,
    amplitudeImaginary,
    probability: intensity / rawTotal,
  }))
  const counts = normalized.map(({ probability }) => Math.floor(probability * input.shots))
  let remainingShots = input.shots - counts.reduce((total, count) => total + count, 0)
  const largestRemainders = normalized
    .map(({ probability }, index) => ({ index, remainder: probability * input.shots - counts[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (const { index } of largestRemainders) {
    if (remainingShots <= 0) break
    counts[index]! += 1
    remainingShots -= 1
  }
  const screen = normalized.map((point, index) => ({ ...point, counts: counts[index]! }))
  const realTotals = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((phaseOffset) => raw.reduce((total, point) => {
    const envelope = Math.exp(-(point.y ** 2) / 7)
    const phase = Math.PI * input.slitSeparation * point.y / (input.wavelength * input.screenDistance) + phaseOffset
    return total + (envelope * Math.cos(phase)) ** 2
  }, 0))
  const complexTotal = screen.reduce((total, point) => total + point.probability, 0)
  return {
    wavelength: input.wavelength,
    slitSeparation: input.slitSeparation,
    screenDistance: input.screenDistance,
    shots: input.shots,
    coherent: input.coherent,
    screen,
    table: probabilityRows(screen),
    totalProbability: complexTotal,
    realAxisTotalRange: { minimum: Math.min(...realTotals), maximum: Math.max(...realTotals) },
    finding: input.coherent
      ? 'The two slit amplitudes add before squaring. Bright and dark bands appear, while the normalized total probability remains one in this bounded display.'
      : 'With coherence turned off, the cross-term is removed. The two single-slit contributions add without a stable interference fringe.',
  }
}

export function evaluateHydrogenMaterials(input: HydrogenMaterialsInput): HydrogenMaterialsResult {
  if (!['1s', '2p', 'bands'].includes(input.mode)) throw new Error(`Unknown hydrogen/materials mode: ${input.mode}`)
  assertRange(input.bandGapEv, 'band gap', QUANTUM_WAVE_BOUNDS.hydrogenMaterials.bandGapEv.min, QUANTUM_WAVE_BOUNDS.hydrogenMaterials.bandGapEv.max)
  const coordinates = grid(-2, 2, 25)
  const orbital = coordinates.flatMap((x) => coordinates.map((y) => {
    const radius = Math.sqrt(x ** 2 + y ** 2)
    const base = input.mode === '2p' ? Math.exp(-radius) : Math.exp(-2 * radius)
    const probability = input.mode === '2p' ? base * x ** 2 : input.mode === '1s' ? base : 0
    return { x, y, probability }
  }))
  const maximum = Math.max(...orbital.map(({ probability }) => probability), 1e-12)
  orbital.forEach((point) => { point.probability /= maximum })
  const potential = grid(-3, 3, 81).map((x) => ({ x, y: -1 / Math.max(Math.abs(x), 0.25) }))
  const valenceY = 0.28
  const valenceHeight = 0.16
  const gapHeight = Math.min(0.28, input.bandGapEv / 8)
  const gapY = valenceY + gapHeight + 0.08
  const conductionHeight = 0.16
  const conductionY = gapY + 0.08 + conductionHeight
  const bands = [
    { label: 'valence band', y: valenceY, height: valenceHeight, kind: 'valence' as const },
    { label: `gap ${input.bandGapEv.toFixed(2)} eV`, y: gapY, height: gapHeight, kind: 'gap' as const },
    { label: 'conduction band', y: conductionY, height: conductionHeight, kind: 'conduction' as const },
  ]
  return {
    mode: input.mode,
    bandGapEv: input.bandGapEv,
    orbital,
    potential,
    bands,
    finding: input.mode === 'bands'
      ? `A band gap of ${input.bandGapEv.toFixed(2)} eV separates filled and available states in this schematic semiconductor switch.`
      : `The ${input.mode} map is a 2-D probability-density slice of a hydrogen-like orbital, not a literal electron trajectory.`,
  }
}
