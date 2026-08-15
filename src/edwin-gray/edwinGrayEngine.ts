import {
  CODATA_2022_MEASURED_CONSTANTS,
  SI_EXACT_CONSTANTS,
} from '../tour/physicsConstants'

export const GRAY_MOTOR_IDS = Object.freeze(['ema4', 'ema6', 'purple', 'gold', 'white', 'black'] as const)
export type GrayMotorId = typeof GRAY_MOTOR_IDS[number]

export type GraySpeedMode = 'prescribed-speed' | 'prescribed' | 'dynamic'
export type GrayResolvedSpeedMode = 'prescribed-speed' | 'dynamic'
export type GrayModelStatus = 'bounded-classical-lumped-surrogate'

export interface GrayTopologyContract {
  statorPairStations: 9
  rotorPairStations: 3
  statorAngularPitchDeg: 40
  rotorAngularPitchDeg: 120
  majorMinorPerStation: 2
  majorMinorOffsetDeg: number
  frontBackPlanes: 2
  simultaneousSectors: 3
  dischargeStepDeg: number
  dischargesPerRevolution: 27
  sourceStatus: 'patent-described' | 'patent-derived'
}

export interface GrayEventSector {
  sectorIndex: number
  angleDeg: number
  statorPairStation: number
  rotorPairStation: number
  majorAngleDeg: number
  minorAngleDeg: number
  /** Zero-based three-phase position within the 40 degree stator station. */
  phase: GrayPhase
  phaseIndex: GrayPhase
  phaseLabel: 'A' | 'B' | 'C'
  /** Selected element for this scheduled event; both element angles remain exposed above. */
  majorMinor: 'major' | 'minor'
  activeElement: 'major' | 'minor'
  element: 'major' | 'minor'
}

export interface GrayEvent {
  stepIndex: number
  revolution: number
  angleDeg: number
  endAngleDeg: number
  stepDeg: number
  sectorCount: 3
  sectors: readonly GrayEventSector[]
  simultaneousSectors: readonly GrayEventSector[]
  majorMinorOffsetDeg: number
  phase: GrayPhase
  phaseIndex: GrayPhase
  phaseLabel: 'A' | 'B' | 'C'
  majorMinor: 'major' | 'minor'
}

export interface GrayQuenchTiming {
  angleDeg: number
  omegaRadPerSecond: number
  timeSeconds: number
  status: 'presenter-reported'
  universal: false
  referenceMinimumRpm: 500
  reachable: boolean
}

export type GrayPhase = 0 | 1 | 2
export type GrayMajorMinorElement = 'major' | 'minor'

export interface GrayModelProvenance {
  modelStatus: GrayModelStatus
  topologySource: 'US3890548A'
  topologyStatus: 'patent-described illustrative topology'
  eventScheduleStatus: 'patent-described / patent-derived'
  quenchStatus: 'presenter-reported, not universal'
  quenchSource: 'Motor Edwin Gray.txt presenter statement'
  geometryStatus: 'illustrative assumptions'
  energyModel: 'angle-dependent co-energy and inductance surrogate'
  excludedTerms: readonly ['radiant-event force', 'free-energy source', 'non-classical force']
}

export interface GrayMagneticLookup {
  source: 'fem-lookup'
  caseId: string
  referenceCurrentA: number
  anglesDeg: readonly number[]
  inductanceH: readonly number[]
  coEnergyJ: readonly number[]
  provenance: {
    solver: string
    backend: string
    inputHash: string
  }
}

export interface GrayMotorCatalogEntry {
  id: GrayMotorId
  label: string
  year: number
  designer: string
  statorPoles: number
  rotorPoles: number
  hasRecovery: boolean
  housing: 'aluminum' | 'plastic' | 'prototype'
  leakageCoupling: number
  recoveryCoupling: number
  observationWindow: boolean
  notes: string
  topology: GrayTopologyContract
  provenance: GrayModelProvenance
}

export interface GrayMotorInput {
  motorId: GrayMotorId
  chargeVoltageV: number
  capacitanceF: number
  startRpm: number
  quenchDeg: number
  turns: number
  speedMode?: GraySpeedMode
  rotorInertiaKgM2?: number
  loadTorqueNm?: number
  initialAngleDeg?: number
  magneticLookup?: GrayMagneticLookup
}

export type GrayMotorPreset = Pick<
  GrayMotorInput,
  'motorId' | 'chargeVoltageV' | 'capacitanceF' | 'startRpm' | 'quenchDeg' | 'turns'
>

export interface GrayResolvedMotorInput {
  motorId: GrayMotorId
  chargeVoltageV: number
  capacitanceF: number
  startRpm: number
  quenchDeg: number
  turns: number
  speedMode: GrayResolvedSpeedMode
  rotorInertiaKgM2: number
  loadTorqueNm: number
  initialAngleDeg: number
}

export interface GrayPulseSample {
  timeSeconds: number
  currentA: number
  capacitorVoltageV: number
  torqueNm: number
  angleDeg: number
  arcLengthM: number
  inductanceH: number
  coEnergyJ: number
  omegaRadPerSecond: number
}

export interface GrayStageLedger {
  charge: {
    sourceCapacitorJ: number
  }
  fire: {
    capacitorDeliveredJ: number
    electricalDeliveredJ: number
  }
  arc: {
    inductorAtEventJ: number
    sparkLossJ: number
    residualInductorJ: number
  }
  recovery: {
    availableJ: number
    capJ: number
    recoveredJ: number
  }
}

export interface GrayEnergyLedger {
  /** Compatibility field: energy initially stored in the source capacitor. */
  capacitorJ: number
  /** Compatibility field: copper/series resistance loss. */
  ohmicJ: number
  /** Compatibility field: arc loss after bounded recovery transfer. */
  sparkJ: number
  /** Compatibility alias for the integrated torque-work term. */
  mechanicalJ: number
  /** Compatibility field: energy transferred to the recovery path. */
  recoveredJ: number
  residualCapacitorJ: number
  residualInductorJ: number
  accountedJ: number
  residualJ: number
  /** Compatibility alias. This is not a system COP. */
  classicalCop: number
  pulseStageCop: number
  classicalCopScope: 'pulse-stage'
  systemCop: null
  claimedCop: number | null
  claimedInputW: number | null
  sourceCapacitorJ: number
  /** Independent integrated electromagnetic torque work; shaftWorkJ is the legacy alias. */
  shaftWorkJ: number
  /** Independent integrated electromagnetic torque work used by the ledger. */
  torqueWorkJ: number
  /** Compatibility alias for the independent integrated torque work. */
  electromagneticTorqueWorkJ: number
  /** Independent midpoint integral of electromagnetic torque work. */
  integratedTorqueWorkJ: number
  loadWorkJ: number
  kineticEnergyChangeJ: number
  mechanicalBalanceResidualJ: number
  recoveryJ: number
  lossesJ: number
  normalizedResidual: number
  chargeJ: number
  fireJ: number
  arcJ: number
  electricalDeliveredJ: number
  inductorAtQuenchJ: number
  stage: GrayStageLedger
}

export interface GrayEnergyBalanceInput {
  sourceCapacitorJ: number
  /** Canonical signed work term. */
  torqueWorkJ?: number
  /** Compatibility alias for torqueWorkJ. */
  shaftWorkJ?: number
  recoveredJ: number
  lossesJ: number
  residualCapacitorJ: number
  residualInductorJ: number
}

export interface GrayEnergyBalance {
  sourceCapacitorJ: number
  torqueWorkJ: number
  /** Compatibility alias for torqueWorkJ. */
  shaftWorkJ: number
  accountedJ: number
  residualJ: number
  normalizedResidual: number
}

export type GrayCopClaimSource = 'user-provided-diagram' | 'retained-transcript'

export interface GrayCopClaimScenario {
  id: string
  label: string
  source: GrayCopClaimSource
  attributedInputPowerW: number
  attributedOutputPowerW: number | null
  attributedOutputPowerRangeW: readonly [number, number] | null
  displayedCop: number | null
  sourceNote: string
}

export interface GrayCopClaimAccounting {
  explicitExternalInputPowerW?: number
  storedEnergyDepletionPowerW?: number
}

export interface GrayCopConservationCase {
  outputPowerW: number
  totalDeclaredInputPowerW: number
  requiredUnaccountedPowerW: number
  conservationResidualPowerW: number
  boundaryClosed: boolean
  copAfterDeclaredInputs: number
  closedSystemCop: number | null
}

export interface GrayCopClaimFinding {
  code:
    | 'arithmetic-cop'
    | 'displayed-cop-mismatch'
    | 'observed-output-deficit'
    | 'target-cop-deficit'
    | 'ambiguous-output'
    | 'incomplete-output'
    | 'conservation-closed'
  statement: string
}

export interface GrayCopClaimEvaluation {
  claim: {
    classification: 'attributed-boundary-claim'
    scenarioId: string
    label: string
    source: GrayCopClaimSource
    sourceNote: string
    attributedInputPowerW: number
    attributedOutputPowerW: number | null
    attributedOutputPowerRangeW: readonly [number, number] | null
    displayedCop: number | null
    arithmeticCop: number | null
    arithmeticCopRange: readonly [number, number] | null
    displayedCopMismatch: number | null
    outputPowerNeededForDisplayedCopW: number | null
  }
  status:
    | 'arithmetic-mismatch-boundary-open'
    | 'arithmetic-mismatch-boundary-closed'
    | 'arithmetic-match-boundary-open'
    | 'arithmetic-match-boundary-closed'
    | 'ambiguous-source-values'
    | 'incomplete-source-values'
  findings: readonly GrayCopClaimFinding[]
  validatesTheory: false
  conservationClosure: {
    attributedInputPowerW: number
    explicitExternalInputPowerW: number
    storedEnergyDepletionPowerW: number
    totalDeclaredInputPowerW: number
    observedOutput: GrayCopConservationCase | null
    displayedCopTarget: GrayCopConservationCase | null
  }
}

export interface GrayMotorResult {
  motor: GrayMotorCatalogEntry
  input: GrayResolvedMotorInput
  modelStatus: GrayModelStatus
  magneticModel: 'fem-lookup' | 'illustrative-surrogate'
  provenance: GrayModelProvenance
  topology: GrayTopologyContract
  eventSchedule: readonly GrayEvent[]
  quenchTiming: GrayQuenchTiming
  speedMode: GrayResolvedSpeedMode
  rotorInertiaKgM2: number
  loadTorqueNm: number
  inductanceH: number
  resistanceOhm: number
  peakCurrentA: number
  quenchTimeSeconds: number
  /** Actual integrated crossing of the configured quench angle. */
  quenchEventReached: boolean
  quenchEventTimeSeconds: number | null
  quenchEventAngleDeg: number | null
  quenchEventOmegaRadPerSecond: number | null
  quenchEventRpm: number | null
  simulatedDurationSeconds: number
  /** Existing rate fields are normalized using the configured start speed. */
  pulseRateHz: number
  nominalPulseRateHz: number
  powerRateBasis: 'nominal-start-speed'
  electricalInputW: number
  mechanicalPowerW: number
  recoveredPowerW: number
  finalAngleDeg: number
  finalRpm: number
  rotorKineticInitialJ: number
  rotorKineticFinalJ: number
  rotorKineticDeltaJ: number
  /** Independent integrated electromagnetic torque work; shaftWorkJ is the compatibility alias. */
  torqueWorkJ: number
  shaftWorkJ: number
  /** Compatibility alias for the independent integrated torque work. */
  electromagneticTorqueWorkJ: number
  /** Independent midpoint integral of electromagnetic torque work. */
  integratedTorqueWorkJ: number
  loadWorkJ: number
  kineticEnergyChangeJ: number
  mechanicalBalanceResidualJ: number
  mechanicalModel: 'kinematic-prescribed' | 'dynamic-inertial'
  stalled: boolean
  stallTimeSeconds: number | null
  electricalDeliveredJ: number
  arcQuenched: boolean
  samples: GrayPulseSample[]
  table: GrayPulseSample[]
  ledger: GrayEnergyLedger
  finding: string
}

const { planckConstant, elementaryCharge, speedOfLight } = SI_EXACT_CONSTANTS
const { fineStructureConstant } = CODATA_2022_MEASURED_CONSTANTS

/** CODATA-derived mu0 used by the illustrative open-core inductance scale. */
export const VACUUM_PERMEABILITY = 2 * fineStructureConstant.value * planckConstant.value
  / (elementaryCharge.value ** 2 * speedOfLight.value)

const POLE_AREA_M2 = 0.002
const CORE_LENGTH_M = 0.08
const RADIUS_M = 0.1524
const SAMPLE_COUNT = 121
const TABLE_COUNT = 11
const PROFILE_POINT_COUNT = 720
const INTEGRATION_SUBSTEPS = 24
const MAX_PULSE_DURATION_SECONDS = 0.02
const DEFAULT_ROTOR_INERTIA_KG_M2 = 0.01
const DEFAULT_INITIAL_ANGLE_DEG = -40 / 3
const QUENCH_ANGLE_TOLERANCE_DEG = 1e-9
const CLAIMED_COP = 300
const CROSBY_INPUT_W = 26

export const GRAY_COP_CLAIM_SCENARIOS = Object.freeze({
  diagramCop282: Object.freeze({
    id: 'diagram-cop-282',
    label: 'User-provided COP 282 diagram values',
    source: 'user-provided-diagram',
    attributedInputPowerW: 26.8,
    attributedOutputPowerW: 7_460,
    attributedOutputPowerRangeW: null,
    displayedCop: 282,
    sourceNote: 'The diagram attributes 26.8 W input, 7,460 W output, and a displayed COP of 282.',
  } satisfies GrayCopClaimScenario),
  transcriptCop300: Object.freeze({
    id: 'transcript-cop-300',
    label: 'Retained transcript COP 300 alternative',
    source: 'retained-transcript',
    attributedInputPowerW: 26,
    attributedOutputPowerW: null,
    attributedOutputPowerRangeW: null,
    displayedCop: 300,
    sourceNote: 'The retained transcript alternative states COP 300 at 26 W without a paired output value.',
  } satisfies GrayCopClaimScenario),
  transcriptAmbiguousOutput: Object.freeze({
    id: 'transcript-ambiguous-7-12-kw',
    label: 'Retained transcript ambiguous 7.12 kW alternative',
    source: 'retained-transcript',
    attributedInputPowerW: 26.8,
    attributedOutputPowerW: null,
    attributedOutputPowerRangeW: Object.freeze([7_120, 7_460] as const),
    displayedCop: null,
    sourceNote: 'The ambiguous 7.12 kW reading is retained as a range through the 7.46 kW diagram value; no endpoint is selected.',
  } satisfies GrayCopClaimScenario),
})

export const GRAY_TOPOLOGY: GrayTopologyContract = Object.freeze({
  statorPairStations: 9,
  rotorPairStations: 3,
  statorAngularPitchDeg: 40,
  rotorAngularPitchDeg: 120,
  majorMinorPerStation: 2,
  majorMinorOffsetDeg: 40 / 3,
  frontBackPlanes: 2,
  simultaneousSectors: 3,
  dischargeStepDeg: 360 / 27,
  dischargesPerRevolution: 27,
  sourceStatus: 'patent-described',
})

export const GRAY_QUENCH_REFERENCE = Object.freeze({
  minimumRpm: 500,
  status: 'presenter-reported' as const,
  universal: false as const,
  source: 'Motor Edwin Gray.txt presenter statement',
})

export const GRAY_MODEL_STATUS: GrayModelStatus = 'bounded-classical-lumped-surrogate'

export const GRAY_MODEL_PROVENANCE: GrayModelProvenance = Object.freeze({
  modelStatus: GRAY_MODEL_STATUS,
  topologySource: 'US3890548A',
  topologyStatus: 'patent-described illustrative topology',
  eventScheduleStatus: 'patent-described / patent-derived',
  quenchStatus: 'presenter-reported, not universal',
  quenchSource: 'Motor Edwin Gray.txt presenter statement',
  geometryStatus: 'illustrative assumptions',
  energyModel: 'angle-dependent co-energy and inductance surrogate',
  excludedTerms: Object.freeze(['radiant-event force', 'free-energy source', 'non-classical force'] as const),
})

export const GRAY_MOTORS: Readonly<Record<GrayMotorId, GrayMotorCatalogEntry>> = Object.freeze({
  ema4: {
    id: 'ema4',
    label: 'EMA4',
    year: 1971,
    designer: 'Marvin Cole',
    statorPoles: 3,
    rotorPoles: 3,
    hasRecovery: true,
    housing: 'prototype',
    leakageCoupling: 0.08,
    recoveryCoupling: 0.12,
    observationWindow: false,
    notes: 'Cole machine with outer recovery cage; Crosby/JPL source-claim COP 300 at 26 W input.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
  ema6: {
    id: 'ema6',
    label: 'EMA6',
    year: 1976,
    designer: 'Richard Hackenberger',
    statorPoles: 3,
    rotorPoles: 3,
    hasRecovery: false,
    housing: 'aluminum',
    leakageCoupling: 0.06,
    recoveryCoupling: 0,
    observationWindow: false,
    notes: 'Conversion tubes removed; mechanical commutator. First demo about 2 hp.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
  purple: {
    id: 'purple',
    label: 'Purple 1979',
    year: 1979,
    designer: 'Hackenberger / Gray',
    statorPoles: 3,
    rotorPoles: 3,
    hasRecovery: true,
    housing: 'aluminum',
    leakageCoupling: 0.05,
    recoveryCoupling: 0.18,
    observationWindow: false,
    notes: 'Full 1979 prototype with independent outer recovery coils and energy-recovery path.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
  gold: {
    id: 'gold',
    label: 'Gold 1979',
    year: 1979,
    designer: 'Hackenberger / Gray',
    statorPoles: 3,
    rotorPoles: 3,
    hasRecovery: false,
    housing: 'aluminum',
    leakageCoupling: 0.05,
    recoveryCoupling: 0,
    observationWindow: false,
    notes: 'Sister of purple without the recovery system. Al Franor drawings.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
  white: {
    id: 'white',
    label: 'White 1979',
    year: 1979,
    designer: 'Hackenberger / Gray',
    statorPoles: 3,
    rotorPoles: 3,
    hasRecovery: false,
    housing: 'plastic',
    leakageCoupling: 0.012,
    recoveryCoupling: 0,
    observationWindow: false,
    notes: 'All-plastic housing. Weaker magnetic return than the aluminum machines.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
  black: {
    id: 'black',
    label: 'Black 1979',
    year: 1979,
    designer: 'Hackenberger / Gray',
    statorPoles: 1,
    rotorPoles: 1,
    hasRecovery: false,
    housing: 'aluminum',
    leakageCoupling: 0.05,
    recoveryCoupling: 0,
    observationWindow: true,
    notes: 'Single pole set and a side window for watching commutation and the pole-face arc.',
    topology: GRAY_TOPOLOGY,
    provenance: GRAY_MODEL_PROVENANCE,
  },
})

export const GRAY_PRESETS: Readonly<Record<GrayMotorId, GrayMotorPreset>> = Object.freeze({
  ema4:   { motorId: 'ema4',   chargeVoltageV: 1500, capacitanceF: 2.3e-6, startRpm: 500, quenchDeg: 6, turns: 180 },
  ema6:   { motorId: 'ema6',   chargeVoltageV: 3000, capacitanceF: 1.2e-6, startRpm: 500, quenchDeg: 6, turns: 160 },
  purple: { motorId: 'purple', chargeVoltageV: 5000, capacitanceF: 8.3e-8, startRpm: 500, quenchDeg: 3, turns: 140 },
  gold:   { motorId: 'gold',   chargeVoltageV: 5000, capacitanceF: 8.3e-8, startRpm: 500, quenchDeg: 3, turns: 140 },
  white:  { motorId: 'white',  chargeVoltageV: 5000, capacitanceF: 8.3e-8, startRpm: 500, quenchDeg: 3, turns: 140 },
  black:  { motorId: 'black',  chargeVoltageV: 5000, capacitanceF: 8.3e-8, startRpm: 500, quenchDeg: 9, turns: 140 },
})

function finiteInRange(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be in [${min}, ${max}]`)
  }
  return value
}

function resolveSpeedMode(speedMode: GraySpeedMode | undefined): GrayResolvedSpeedMode {
  if (speedMode === undefined || speedMode === 'prescribed-speed' || speedMode === 'prescribed') {
    return 'prescribed-speed'
  }
  if (speedMode === 'dynamic') return 'dynamic'
  throw new Error(`speedMode must be one of prescribed-speed, prescribed, or dynamic; received ${String(speedMode)}`)
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
  return value
}

function normalizeAngleDeg(angleDeg: number): number {
  const wrapped = angleDeg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export function poleAngles(count: number): number[] {
  positiveInteger(count, 'count')
  if (count === 0) return []
  return Array.from({ length: count }, (_, index) => index * 360 / count)
}

function tableInterval(angleDeg: number, anglesDeg: readonly number[]): { index: number; fraction: number } {
  const first = anglesDeg[0]!
  const lastIndex = anglesDeg.length - 1
  const wrapped = first + ((angleDeg - first) % 360 + 360) % 360
  if (wrapped >= anglesDeg[lastIndex]!) {
    const span = first + 360 - anglesDeg[lastIndex]!
    return { index: lastIndex, fraction: span === 0 ? 0 : (wrapped - anglesDeg[lastIndex]!) / span }
  }
  for (let index = 0; index < lastIndex; index += 1) {
    const start = anglesDeg[index]!
    const end = anglesDeg[index + 1]!
    if (wrapped >= start && wrapped < end) {
      return { index, fraction: (wrapped - start) / (end - start) }
    }
  }
  return { index: 0, fraction: 0 }
}

/** Periodic piecewise-linear interpolation in degrees. */
export function interpolateAngle(
  angleDeg: number,
  anglesDeg: readonly number[],
  values: readonly number[],
): number {
  if (!Number.isFinite(angleDeg)) throw new Error('angleDeg must be finite')
  if (anglesDeg.length !== values.length || anglesDeg.length === 0) {
    throw new Error('anglesDeg and values must have the same non-zero length')
  }
  for (let index = 0; index < anglesDeg.length; index += 1) {
    if (!Number.isFinite(anglesDeg[index]!) || !Number.isFinite(values[index]!)) {
      throw new Error('angle interpolation tables must be finite')
    }
    if (index > 0 && anglesDeg[index]! <= anglesDeg[index - 1]!) {
      throw new Error('anglesDeg must be strictly increasing')
    }
  }
  if (anglesDeg.length === 1) return values[0]!
  const { index, fraction } = tableInterval(angleDeg, anglesDeg)
  const nextIndex = (index + 1) % values.length
  return values[index]! + (values[nextIndex]! - values[index]!) * fraction
}

export const angleInterpolation = interpolateAngle
export const interpolatePeriodicAngle = interpolateAngle

function topologyInductanceFactor(angleDeg: number): number {
  const angleRad = angleDeg * Math.PI / 180
  const offsetRad = GRAY_TOPOLOGY.majorMinorOffsetDeg * Math.PI / 180 / 2
  let major = 0
  let minor = 0
  let rotor = 0
  for (const sectorAngleDeg of [0, 120, 240]) {
    const sectorRad = sectorAngleDeg * Math.PI / 180
    major += Math.cos(9 * (angleRad - sectorRad + offsetRad))
    minor += Math.cos(9 * (angleRad - sectorRad - offsetRad))
    rotor += Math.cos(3 * (angleRad - sectorRad))
  }
  const factor = 1 + 0.16 * major / 3 + 0.16 * minor / 3 + 0.06 * rotor / 3
  return Math.max(0.7, factor)
}

const INDUCTANCE_PROFILE_ANGLES_DEG = Object.freeze(
  Array.from({ length: PROFILE_POINT_COUNT }, (_, index) => index * 360 / PROFILE_POINT_COUNT),
)
const INDUCTANCE_PROFILE_VALUES = Object.freeze(
  INDUCTANCE_PROFILE_ANGLES_DEG.map((angleDeg) => topologyInductanceFactor(angleDeg)),
)

function coilInductanceScale(turns: number, coupling: number, sectorCount: number): number {
  return VACUUM_PERMEABILITY * turns * turns * POLE_AREA_M2 / CORE_LENGTH_M * coupling / sectorCount
}

export function grayInductanceAtAngle(
  angleDeg: number,
  turns: number,
  coupling: number,
  sectorCount = GRAY_TOPOLOGY.simultaneousSectors,
): number {
  finiteInRange(turns, 'turns', Number.MIN_VALUE, 2_000)
  finiteInRange(coupling, 'coupling', 0, 1)
  finiteInRange(sectorCount, 'sectorCount', 1, GRAY_TOPOLOGY.simultaneousSectors)
  return coilInductanceScale(turns, coupling, sectorCount)
    * interpolateAngle(angleDeg, INDUCTANCE_PROFILE_ANGLES_DEG, INDUCTANCE_PROFILE_VALUES)
}

export const inductanceAtAngle = grayInductanceAtAngle

export function validateGrayMagneticLookup(lookup: GrayMagneticLookup): void {
  if (lookup.source !== 'fem-lookup') throw new Error('magneticLookup.source must be fem-lookup')
  if (!lookup.caseId || !lookup.provenance?.solver || !lookup.provenance.backend) {
    throw new Error('magneticLookup provenance is incomplete')
  }
  if (!/^[a-f0-9]{64}$/.test(lookup.provenance.inputHash)) {
    throw new Error('magneticLookup provenance inputHash must be a SHA-256 hash')
  }
  finiteInRange(lookup.referenceCurrentA, 'magneticLookup.referenceCurrentA', Number.MIN_VALUE, 1e9)
  if (lookup.anglesDeg.length < 2
    || lookup.anglesDeg.length !== lookup.inductanceH.length
    || lookup.anglesDeg.length !== lookup.coEnergyJ.length) {
    throw new Error('magneticLookup arrays must have the same length of at least two')
  }
  lookup.anglesDeg.forEach((angleDeg, index) => {
    if (!Number.isFinite(angleDeg) || (index > 0 && angleDeg <= lookup.anglesDeg[index - 1]!)) {
      throw new Error('magneticLookup.anglesDeg must be finite and strictly increasing')
    }
    if (!Number.isFinite(lookup.inductanceH[index]!) || lookup.inductanceH[index]! <= 0) {
      throw new Error('magneticLookup.inductanceH must be finite and positive')
    }
    if (!Number.isFinite(lookup.coEnergyJ[index]!) || lookup.coEnergyJ[index]! < 0) {
      throw new Error('magneticLookup.coEnergyJ must be finite and non-negative')
    }
  })
}

export function grayLookupInductanceAtAngle(lookup: GrayMagneticLookup, angleDeg: number, currentA = lookup.referenceCurrentA): number {
  validateGrayMagneticLookup(lookup)
  finiteInRange(currentA, 'currentA', -1e9, 1e9)
  return interpolateAngle(angleDeg, lookup.anglesDeg, lookup.inductanceH)
}

export const femInductanceAtAngle = grayLookupInductanceAtAngle

function grayLookupInductanceSlopePerRadian(lookup: GrayMagneticLookup, angleDeg: number): number {
  const deltaDeg = 1e-3
  const deltaRad = deltaDeg * Math.PI / 180
  return (grayLookupInductanceAtAngle(lookup, angleDeg + deltaDeg)
    - grayLookupInductanceAtAngle(lookup, angleDeg - deltaDeg)) / (2 * deltaRad)
}

function grayInductanceSlopePerRadian(
  angleDeg: number,
  turns: number,
  coupling: number,
  sectorCount: number,
): number {
  if (coupling === 0) return 0
  if (Math.abs(normalizeAngleDeg(angleDeg)) < 1e-12) return 0
  const deltaDeg = 1e-3
  const deltaRad = deltaDeg * Math.PI / 180
  return (grayInductanceAtAngle(angleDeg + deltaDeg, turns, coupling, sectorCount)
    - grayInductanceAtAngle(angleDeg - deltaDeg, turns, coupling, sectorCount)) / (2 * deltaRad)
}

export function grayCoEnergyAtAngle(
  currentA: number,
  angleDeg: number,
  turns: number,
  coupling: number,
  sectorCount = GRAY_TOPOLOGY.simultaneousSectors,
): number {
  finiteInRange(currentA, 'currentA', -1e9, 1e9)
  return 0.5 * grayInductanceAtAngle(angleDeg, turns, coupling, sectorCount) * currentA * currentA
}

export const coEnergyAtAngle = grayCoEnergyAtAngle

/** Torque is the fixed-current derivative of the same co-energy used by the circuit. */
export function grayTorqueAtAngle(
  currentA: number,
  angleDeg: number,
  turns: number,
  coupling: number,
  sectorCount = GRAY_TOPOLOGY.simultaneousSectors,
): number {
  finiteInRange(currentA, 'currentA', -1e9, 1e9)
  if (currentA === 0 || coupling === 0) return 0
  return 0.5 * currentA * currentA * grayInductanceSlopePerRadian(angleDeg, turns, coupling, sectorCount)
}

export const torqueFromCoEnergy = grayTorqueAtAngle

/** The presenter-reported angle/omega relationship; zero speed means no reachable event. */
export function quenchTimeSeconds(quenchDeg: number, rpm: number): number {
  finiteInRange(quenchDeg, 'quenchDeg', 0, 360)
  finiteInRange(rpm, 'rpm', 0, 1e9)
  if (rpm === 0) return 0
  return quenchDeg * Math.PI / 180 / (rpm * 2 * Math.PI / 60)
}

export const quenchTime = quenchTimeSeconds
export const calculateQuenchTime = quenchTimeSeconds

export function grayQuenchTiming(quenchDeg: number, rpm: number): GrayQuenchTiming {
  const omegaRadPerSecond = rpm * 2 * Math.PI / 60
  return {
    angleDeg: quenchDeg,
    omegaRadPerSecond,
    timeSeconds: quenchTimeSeconds(quenchDeg, rpm),
    status: GRAY_QUENCH_REFERENCE.status,
    universal: GRAY_QUENCH_REFERENCE.universal,
    referenceMinimumRpm: GRAY_QUENCH_REFERENCE.minimumRpm,
    reachable: rpm > 0,
  }
}

export interface GrayEventScheduleOptions {
  revolutions?: number
}

export function buildGrayEventSchedule(revolutions = 1): GrayEvent[] {
  positiveInteger(revolutions, 'revolutions')
  const events: GrayEvent[] = []
  for (let index = 0; index < revolutions * GRAY_TOPOLOGY.dischargesPerRevolution; index += 1) {
    const stepInRevolution = index % GRAY_TOPOLOGY.dischargesPerRevolution
    const revolution = Math.floor(index / GRAY_TOPOLOGY.dischargesPerRevolution)
    const angleDeg = index * GRAY_TOPOLOGY.dischargeStepDeg
    const sectors = Array.from({ length: GRAY_TOPOLOGY.simultaneousSectors }, (_, sectorIndex) => {
      const sectorAngleDeg = angleDeg + sectorIndex * GRAY_TOPOLOGY.rotorAngularPitchDeg
      const statorStationUnwrapped = Math.floor(
        sectorAngleDeg / GRAY_TOPOLOGY.statorAngularPitchDeg,
      )
      const rotorStationUnwrapped = Math.floor(
        sectorAngleDeg / GRAY_TOPOLOGY.rotorAngularPitchDeg,
      )
      const statorPairStation = ((statorStationUnwrapped % GRAY_TOPOLOGY.statorPairStations)
        + GRAY_TOPOLOGY.statorPairStations) % GRAY_TOPOLOGY.statorPairStations
      const rotorPairStation = ((rotorStationUnwrapped % GRAY_TOPOLOGY.rotorPairStations)
        + GRAY_TOPOLOGY.rotorPairStations) % GRAY_TOPOLOGY.rotorPairStations
      const phaseIndex = sectorIndex as GrayPhase
      const phaseLabel = (['A', 'B', 'C'] as const)[phaseIndex]
      const phase = phaseIndex
      const majorAngleDeg = sectorAngleDeg
      const minorAngleDeg = sectorAngleDeg + GRAY_TOPOLOGY.majorMinorOffsetDeg
      const majorMinor: GrayMajorMinorElement = stepInRevolution % 3 === 1 ? 'major' : 'minor'
      return Object.freeze({
        sectorIndex,
        angleDeg: sectorAngleDeg,
        statorPairStation,
        rotorPairStation,
        majorAngleDeg,
        minorAngleDeg,
        phase,
        phaseIndex,
        phaseLabel,
        majorMinor,
        activeElement: majorMinor,
        element: majorMinor,
      })
    })
    const frozenSectors = Object.freeze(sectors)
    const phaseIndex = (stepInRevolution % 3) as GrayPhase
    const phaseLabel = (['A', 'B', 'C'] as const)[phaseIndex]
    const phase = phaseIndex
    const majorMinor: GrayMajorMinorElement = stepInRevolution % 3 === 1 ? 'major' : 'minor'
    events.push(Object.freeze({
      stepIndex: index,
      revolution,
      angleDeg,
      endAngleDeg: angleDeg + GRAY_TOPOLOGY.dischargeStepDeg,
      stepDeg: GRAY_TOPOLOGY.dischargeStepDeg,
      sectorCount: GRAY_TOPOLOGY.simultaneousSectors,
      sectors: frozenSectors,
      simultaneousSectors: frozenSectors,
      majorMinorOffsetDeg: GRAY_TOPOLOGY.majorMinorOffsetDeg,
      phase,
      phaseIndex,
      phaseLabel,
      majorMinor,
    }))
  }
  return events
}

export const grayEventSchedule = buildGrayEventSchedule
export const eventSchedule = buildGrayEventSchedule
export const GRAY_EVENT_SCHEDULE: readonly GrayEvent[] = Object.freeze(buildGrayEventSchedule())

export function calculateEnergyBalance(input: GrayEnergyBalanceInput): GrayEnergyBalance {
  const nonNegativeValues: Array<[string, number]> = [
    ['sourceCapacitorJ', input.sourceCapacitorJ],
    ['recoveredJ', input.recoveredJ],
    ['lossesJ', input.lossesJ],
    ['residualCapacitorJ', input.residualCapacitorJ],
    ['residualInductorJ', input.residualInductorJ],
  ]
  for (const [label, value] of nonNegativeValues) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`)
  }
  if (input.torqueWorkJ !== undefined && !Number.isFinite(input.torqueWorkJ)) {
    throw new Error('torqueWorkJ must be finite')
  }
  if (input.shaftWorkJ !== undefined && !Number.isFinite(input.shaftWorkJ)) {
    throw new Error('shaftWorkJ must be finite')
  }
  if (input.torqueWorkJ !== undefined && input.shaftWorkJ !== undefined
    && input.torqueWorkJ !== input.shaftWorkJ) {
    throw new Error('torqueWorkJ and shaftWorkJ must match when both are supplied')
  }
  const torqueWorkJ = input.torqueWorkJ ?? input.shaftWorkJ
  if (torqueWorkJ === undefined) throw new Error('torqueWorkJ or shaftWorkJ is required')
  const accountedJ = torqueWorkJ + input.recoveredJ + input.lossesJ
    + input.residualCapacitorJ + input.residualInductorJ
  const residualJ = input.sourceCapacitorJ - accountedJ
  const scale = Math.abs(input.sourceCapacitorJ)
  return {
    sourceCapacitorJ: input.sourceCapacitorJ,
    torqueWorkJ,
    shaftWorkJ: torqueWorkJ,
    accountedJ,
    residualJ,
    normalizedResidual: scale === 0 ? residualJ : residualJ / scale,
  }
}

export const energyBalance = calculateEnergyBalance

function nonNegativeClaimPower(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`)
  return value
}

function evaluateGrayCopConservationCase(
  outputPowerW: number,
  totalDeclaredInputPowerW: number,
): GrayCopConservationCase {
  const deficitPowerW = outputPowerW - totalDeclaredInputPowerW
  const boundaryClosed = deficitPowerW <= 0
  const requiredUnaccountedPowerW = boundaryClosed ? 0 : deficitPowerW
  const copAfterDeclaredInputs = outputPowerW / totalDeclaredInputPowerW
  return {
    outputPowerW,
    totalDeclaredInputPowerW,
    requiredUnaccountedPowerW,
    conservationResidualPowerW: totalDeclaredInputPowerW - outputPowerW,
    boundaryClosed,
    copAfterDeclaredInputs,
    closedSystemCop: boundaryClosed ? copAfterDeclaredInputs : null,
  }
}

/** Audits attributed source values; it does not call or alter the motor simulation. */
export function evaluateGrayCopClaim(
  scenario: GrayCopClaimScenario,
  accounting: GrayCopClaimAccounting = {},
): GrayCopClaimEvaluation {
  const attributedInputPowerW = nonNegativeClaimPower(
    scenario.attributedInputPowerW,
    'attributedInputPowerW',
  )
  if (attributedInputPowerW === 0) throw new Error('attributedInputPowerW must be positive')
  const attributedOutputPowerW = scenario.attributedOutputPowerW === null
    ? null
    : nonNegativeClaimPower(scenario.attributedOutputPowerW, 'attributedOutputPowerW')
  const attributedOutputPowerRangeW = scenario.attributedOutputPowerRangeW === null
    ? null
    : [
        nonNegativeClaimPower(scenario.attributedOutputPowerRangeW[0], 'attributedOutputPowerRangeW[0]'),
        nonNegativeClaimPower(scenario.attributedOutputPowerRangeW[1], 'attributedOutputPowerRangeW[1]'),
      ] as const
  if (attributedOutputPowerRangeW
    && attributedOutputPowerRangeW[0] > attributedOutputPowerRangeW[1]) {
    throw new Error('attributedOutputPowerRangeW must be ordered')
  }
  const displayedCop = scenario.displayedCop === null
    ? null
    : nonNegativeClaimPower(scenario.displayedCop, 'displayedCop')
  const explicitExternalInputPowerW = nonNegativeClaimPower(
    accounting.explicitExternalInputPowerW ?? 0,
    'explicitExternalInputPowerW',
  )
  const storedEnergyDepletionPowerW = nonNegativeClaimPower(
    accounting.storedEnergyDepletionPowerW ?? 0,
    'storedEnergyDepletionPowerW',
  )
  const totalDeclaredInputPowerW = attributedInputPowerW
    + explicitExternalInputPowerW
    + storedEnergyDepletionPowerW
  const arithmeticCop = attributedOutputPowerW === null
    ? null
    : attributedOutputPowerW / attributedInputPowerW
  const arithmeticCopRange = attributedOutputPowerRangeW === null
    ? null
    : [
        attributedOutputPowerRangeW[0] / attributedInputPowerW,
        attributedOutputPowerRangeW[1] / attributedInputPowerW,
      ] as const
  const displayedCopMismatch = arithmeticCop === null || displayedCop === null
    ? null
    : displayedCop - arithmeticCop
  const outputPowerNeededForDisplayedCopW = displayedCop === null
    ? null
    : displayedCop * attributedInputPowerW
  const observedOutput = attributedOutputPowerW === null
    ? null
    : evaluateGrayCopConservationCase(attributedOutputPowerW, totalDeclaredInputPowerW)
  const displayedCopTarget = outputPowerNeededForDisplayedCopW === null
    ? null
    : evaluateGrayCopConservationCase(outputPowerNeededForDisplayedCopW, totalDeclaredInputPowerW)
  const findings: GrayCopClaimFinding[] = []

  if (arithmeticCop !== null) {
    findings.push({
      code: 'arithmetic-cop',
      statement: `The attributed output/input arithmetic gives COP ${arithmeticCop}.`,
    })
  }
  if (displayedCopMismatch !== null && Math.abs(displayedCopMismatch) > 1e-12) {
    findings.push({
      code: 'displayed-cop-mismatch',
      statement: `The displayed COP differs from the output/input arithmetic by ${displayedCopMismatch}.`,
    })
  }
  if (observedOutput?.requiredUnaccountedPowerW) {
    findings.push({
      code: 'observed-output-deficit',
      statement: `${observedOutput.requiredUnaccountedPowerW} W remains unaccounted for at the attributed output.`,
    })
  } else if (observedOutput?.boundaryClosed) {
    findings.push({
      code: 'conservation-closed',
      statement: 'Declared external and stored-energy inputs close the attributed-output boundary.',
    })
  }
  if (displayedCopTarget?.requiredUnaccountedPowerW) {
    findings.push({
      code: 'target-cop-deficit',
      statement: `${displayedCopTarget.requiredUnaccountedPowerW} W remains unaccounted for at the displayed-COP target.`,
    })
  }
  if (attributedOutputPowerRangeW) {
    findings.push({
      code: 'ambiguous-output',
      statement: 'The retained output is a source range; no single output value is selected.',
    })
  } else if (attributedOutputPowerW === null) {
    findings.push({
      code: 'incomplete-output',
      statement: 'This source scenario does not pair the attributed input with one output value.',
    })
  }

  let status: GrayCopClaimEvaluation['status']
  if (attributedOutputPowerRangeW) {
    status = 'ambiguous-source-values'
  } else if (attributedOutputPowerW === null) {
    status = 'incomplete-source-values'
  } else {
    const arithmeticMismatch = displayedCopMismatch !== null && Math.abs(displayedCopMismatch) > 1e-12
    status = arithmeticMismatch
      ? (observedOutput?.boundaryClosed
          ? 'arithmetic-mismatch-boundary-closed'
          : 'arithmetic-mismatch-boundary-open')
      : (observedOutput?.boundaryClosed
          ? 'arithmetic-match-boundary-closed'
          : 'arithmetic-match-boundary-open')
  }

  return {
    claim: {
      classification: 'attributed-boundary-claim',
      scenarioId: scenario.id,
      label: scenario.label,
      source: scenario.source,
      sourceNote: scenario.sourceNote,
      attributedInputPowerW,
      attributedOutputPowerW,
      attributedOutputPowerRangeW,
      displayedCop,
      arithmeticCop,
      arithmeticCopRange,
      displayedCopMismatch,
      outputPowerNeededForDisplayedCopW,
    },
    status,
    findings,
    validatesTheory: false,
    conservationClosure: {
      attributedInputPowerW,
      explicitExternalInputPowerW,
      storedEnergyDepletionPowerW,
      totalDeclaredInputPowerW,
      observedOutput,
      displayedCopTarget,
    },
  }
}

interface GraySimulationState {
  currentA: number
  capacitorVoltageV: number
  angleDeg: number
  omegaRadPerSecond: number
}

interface GraySimulationTotals {
  ohmicJ: number
  torqueWorkJ: number
  integratedTorqueWorkJ: number
  electricalDeliveredJ: number
  loadWorkJ: number
}

interface GraySimulationContext {
  capacitanceF: number
  resistanceOhm: number
  turns: number
  coupling: number
  sectorCount: number
  speedMode: GrayResolvedSpeedMode
  rotorInertiaKgM2: number
  loadTorqueNm: number
  magneticLookup?: GrayMagneticLookup
}

function simulationInductanceAtAngle(
  angleDeg: number,
  context: GraySimulationContext,
): number {
  return context.magneticLookup
    ? grayLookupInductanceAtAngle(context.magneticLookup, angleDeg)
    : grayInductanceAtAngle(angleDeg, context.turns, context.coupling, context.sectorCount)
}

function simulationInductanceSlopePerRadian(
  angleDeg: number,
  context: GraySimulationContext,
): number {
  return context.magneticLookup
    ? grayLookupInductanceSlopePerRadian(context.magneticLookup, angleDeg)
    : grayInductanceSlopePerRadian(angleDeg, context.turns, context.coupling, context.sectorCount)
}

function simulationCoEnergyAtAngle(
  currentA: number,
  angleDeg: number,
  context: GraySimulationContext,
): number {
  const inductanceH = simulationInductanceAtAngle(angleDeg, context)
  return 0.5 * inductanceH * currentA * currentA
}

function simulationTorqueAtAngle(
  currentA: number,
  angleDeg: number,
  context: GraySimulationContext,
): number {
  if (currentA === 0) return 0
  return 0.5 * currentA * currentA * simulationInductanceSlopePerRadian(angleDeg, context)
}

function midpointElectricalStep(
  state: GraySimulationState,
  stepSeconds: number,
  angleDeg: number,
  omegaRadPerSecond: number,
  context: GraySimulationContext,
): { currentA: number; capacitorVoltageV: number } {
  const inductanceH = simulationInductanceAtAngle(angleDeg, context)
  const inductanceSlopeHPerRad = simulationInductanceSlopePerRadian(angleDeg, context)
  const a12 = -1 / context.capacitanceF
  const a21 = 1 / inductanceH
  const a22 = -(context.resistanceOhm + inductanceSlopeHPerRad * omegaRadPerSecond) / inductanceH
  const halfStep = stepSeconds / 2
  const m11 = 1
  const m12 = -halfStep * a12
  const m21 = -halfStep * a21
  const m22 = 1 - halfStep * a22
  const rhsVoltage = state.capacitorVoltageV + halfStep * a12 * state.currentA
  const rhsCurrent = halfStep * a21 * state.capacitorVoltageV + (1 + halfStep * a22) * state.currentA
  const determinant = m11 * m22 - m12 * m21
  const capacitorVoltageV = (rhsVoltage * m22 - m12 * rhsCurrent) / determinant
  const currentA = (m11 * rhsCurrent - m21 * rhsVoltage) / determinant
  return { currentA, capacitorVoltageV }
}

function accumulateMidpoint(
  state: GraySimulationState,
  next: { currentA: number; capacitorVoltageV: number },
  startAngleDeg: number,
  endAngleDeg: number,
  angleDeg: number,
  omegaRadPerSecond: number,
  stepSeconds: number,
  context: GraySimulationContext,
  totals: GraySimulationTotals,
): number {
  const currentA = (state.currentA + next.currentA) / 2
  const torqueNm = simulationTorqueAtAngle(currentA, angleDeg, context)
  const ohmicJ = currentA * currentA * context.resistanceOhm * stepSeconds
  const startStoredJ = 0.5 * context.capacitanceF * state.capacitorVoltageV ** 2
    + simulationCoEnergyAtAngle(state.currentA, startAngleDeg, context)
  const endStoredJ = 0.5 * context.capacitanceF * next.capacitorVoltageV ** 2
    + simulationCoEnergyAtAngle(next.currentA, endAngleDeg, context)
  totals.ohmicJ += ohmicJ
  totals.torqueWorkJ += startStoredJ - endStoredJ - ohmicJ
  totals.integratedTorqueWorkJ += torqueNm * omegaRadPerSecond * stepSeconds
  totals.electricalDeliveredJ += 0.5 * context.capacitanceF
    * (state.capacitorVoltageV ** 2 - next.capacitorVoltageV ** 2)
  if (context.speedMode === 'dynamic') {
    totals.loadWorkJ += context.loadTorqueNm * omegaRadPerSecond * stepSeconds
  }
  return torqueNm
}

function advancePrescribed(
  state: GraySimulationState,
  stepSeconds: number,
  context: GraySimulationContext,
  totals: GraySimulationTotals,
): void {
  const omegaRadPerSecond = state.omegaRadPerSecond
  const startAngleDeg = state.angleDeg
  const angleMidDeg = state.angleDeg + omegaRadPerSecond * stepSeconds * 30 / Math.PI
  const endAngleDeg = state.angleDeg + omegaRadPerSecond * stepSeconds * 180 / Math.PI
  const next = midpointElectricalStep(state, stepSeconds, angleMidDeg, omegaRadPerSecond, context)
  accumulateMidpoint(
    state,
    next,
    startAngleDeg,
    endAngleDeg,
    angleMidDeg,
    omegaRadPerSecond,
    stepSeconds,
    context,
    totals,
  )
  state.currentA = next.currentA
  state.capacitorVoltageV = next.capacitorVoltageV
  state.angleDeg += omegaRadPerSecond * stepSeconds * 180 / Math.PI
}

function advanceDynamic(
  state: GraySimulationState,
  stepSeconds: number,
  context: GraySimulationContext,
  totals: GraySimulationTotals,
): boolean {
  const initialOmega = state.omegaRadPerSecond
  let omegaMid = initialOmega
  let angleMidDeg = state.angleDeg + omegaMid * stepSeconds * 30 / Math.PI
  let next = { currentA: state.currentA, capacitorVoltageV: state.capacitorVoltageV }
  let torqueNm = 0
  let finalOmega = initialOmega
  let unconstrainedFinalOmega = initialOmega

  for (let iteration = 0; iteration < 3; iteration += 1) {
    next = midpointElectricalStep(state, stepSeconds, angleMidDeg, omegaMid, context)
    const currentMid = (state.currentA + next.currentA) / 2
    torqueNm = simulationTorqueAtAngle(currentMid, angleMidDeg, context)
    unconstrainedFinalOmega = initialOmega
      + (torqueNm - context.loadTorqueNm) / context.rotorInertiaKgM2 * stepSeconds
    finalOmega = Math.max(0, unconstrainedFinalOmega)
    omegaMid = (initialOmega + finalOmega) / 2
    angleMidDeg = state.angleDeg + omegaMid * stepSeconds * 30 / Math.PI
  }

  next = midpointElectricalStep(state, stepSeconds, angleMidDeg, omegaMid, context)
  const currentMid = (state.currentA + next.currentA) / 2
  torqueNm = simulationTorqueAtAngle(currentMid, angleMidDeg, context)
  unconstrainedFinalOmega = initialOmega
    + (torqueNm - context.loadTorqueNm) / context.rotorInertiaKgM2 * stepSeconds
  finalOmega = Math.max(0, unconstrainedFinalOmega)
  omegaMid = (initialOmega + finalOmega) / 2
  accumulateMidpoint(
    state,
    next,
    state.angleDeg,
    state.angleDeg + omegaMid * stepSeconds * 180 / Math.PI,
    angleMidDeg,
    omegaMid,
    stepSeconds,
    context,
    totals,
  )
  state.currentA = next.currentA
  state.capacitorVoltageV = next.capacitorVoltageV
  state.angleDeg += omegaMid * stepSeconds * 180 / Math.PI
  state.omegaRadPerSecond = finalOmega
  return finalOmega === 0 && unconstrainedFinalOmega <= 0
    && (initialOmega > 0 || context.loadTorqueNm > 0)
}

interface GraySimulationTrajectoryPoint {
  timeSeconds: number
  state: GraySimulationState
}

function copySimulationState(state: GraySimulationState): GraySimulationState {
  return { ...state }
}

function interpolateSimulationState(
  start: GraySimulationState,
  end: GraySimulationState,
  fraction: number,
): GraySimulationState {
  return {
    currentA: start.currentA + (end.currentA - start.currentA) * fraction,
    capacitorVoltageV: start.capacitorVoltageV
      + (end.capacitorVoltageV - start.capacitorVoltageV) * fraction,
    angleDeg: start.angleDeg + (end.angleDeg - start.angleDeg) * fraction,
    omegaRadPerSecond: start.omegaRadPerSecond
      + (end.omegaRadPerSecond - start.omegaRadPerSecond) * fraction,
  }
}

function interpolateSimulationTotals(
  start: GraySimulationTotals,
  end: GraySimulationTotals,
  fraction: number,
): GraySimulationTotals {
  return {
      ohmicJ: start.ohmicJ + (end.ohmicJ - start.ohmicJ) * fraction,
      torqueWorkJ: start.torqueWorkJ + (end.torqueWorkJ - start.torqueWorkJ) * fraction,
      integratedTorqueWorkJ: start.integratedTorqueWorkJ
        + (end.integratedTorqueWorkJ - start.integratedTorqueWorkJ) * fraction,
      electricalDeliveredJ: start.electricalDeliveredJ
      + (end.electricalDeliveredJ - start.electricalDeliveredJ) * fraction,
    loadWorkJ: start.loadWorkJ + (end.loadWorkJ - start.loadWorkJ) * fraction,
  }
}

function stateAtTrajectoryTime(
  timeSeconds: number,
  trajectory: readonly GraySimulationTrajectoryPoint[],
): GraySimulationState {
  const first = trajectory[0]!
  if (timeSeconds <= first.timeSeconds) return copySimulationState(first.state)
  const last = trajectory[trajectory.length - 1]!
  if (timeSeconds >= last.timeSeconds) return copySimulationState(last.state)
  for (let index = 1; index < trajectory.length; index += 1) {
    const end = trajectory[index]!
    if (timeSeconds <= end.timeSeconds) {
      const start = trajectory[index - 1]!
      const span = end.timeSeconds - start.timeSeconds
      const fraction = span === 0 ? 0 : (timeSeconds - start.timeSeconds) / span
      return interpolateSimulationState(start.state, end.state, fraction)
    }
  }
  return copySimulationState(last.state)
}

function finiteResultValues(result: GrayMotorResult): void {
  const values = [
    result.inductanceH,
    result.resistanceOhm,
    result.peakCurrentA,
    result.quenchTimeSeconds,
    result.simulatedDurationSeconds,
    result.pulseRateHz,
    result.electricalInputW,
    result.mechanicalPowerW,
    result.recoveredPowerW,
    result.finalAngleDeg,
    result.finalRpm,
    result.rotorKineticInitialJ,
    result.rotorKineticFinalJ,
    result.rotorKineticDeltaJ,
    result.loadWorkJ,
    result.electricalDeliveredJ,
    result.ledger.capacitorJ,
    result.ledger.ohmicJ,
    result.ledger.sparkJ,
    result.ledger.mechanicalJ,
    result.ledger.recoveredJ,
    result.ledger.residualCapacitorJ,
    result.ledger.residualInductorJ,
    result.ledger.accountedJ,
    result.ledger.residualJ,
    result.ledger.classicalCop,
    result.ledger.pulseStageCop,
    result.ledger.normalizedResidual,
    result.ledger.torqueWorkJ,
    result.ledger.electromagneticTorqueWorkJ,
    result.ledger.integratedTorqueWorkJ,
    result.ledger.loadWorkJ,
    result.ledger.kineticEnergyChangeJ,
    result.ledger.mechanicalBalanceResidualJ,
    result.electromagneticTorqueWorkJ,
    result.integratedTorqueWorkJ,
    result.kineticEnergyChangeJ,
    result.mechanicalBalanceResidualJ,
  ]
  if (values.some((value) => !Number.isFinite(value))) throw new Error('Gray motor model produced a non-finite value')
}

export function evaluateGrayMotor(input: GrayMotorInput): GrayMotorResult {
  const motor = GRAY_MOTORS[input.motorId]
  if (!motor) throw new Error(`Unknown Gray motor: ${String(input.motorId)}`)
  const chargeVoltageV = finiteInRange(input.chargeVoltageV, 'chargeVoltageV', 0, 2e5)
  const capacitanceF = finiteInRange(input.capacitanceF, 'capacitanceF', 1e-12, 1e-2)
  const startRpm = finiteInRange(input.startRpm, 'startRpm', 0, 2e4)
  const quenchDeg = finiteInRange(input.quenchDeg, 'quenchDeg', 0, 40)
  const turns = finiteInRange(input.turns, 'turns', 1, 2e3)
  const speedMode = resolveSpeedMode(input.speedMode)
  if (input.magneticLookup) validateGrayMagneticLookup(input.magneticLookup)
  const rotorInertiaKgM2 = finiteInRange(
    input.rotorInertiaKgM2 ?? DEFAULT_ROTOR_INERTIA_KG_M2,
    'rotorInertiaKgM2',
    1e-12,
    1e3,
  )
  const loadTorqueNm = finiteInRange(input.loadTorqueNm ?? 0, 'loadTorqueNm', 0, 1e6)
  const initialAngleDeg = finiteInRange(input.initialAngleDeg ?? DEFAULT_INITIAL_ANGLE_DEG, 'initialAngleDeg', -1e9, 1e9)
  const sectorCount = Math.max(1, Math.min(GRAY_TOPOLOGY.simultaneousSectors, motor.statorPoles))
  const resolved: GrayResolvedMotorInput = {
    motorId: motor.id,
    chargeVoltageV,
    capacitanceF,
    startRpm,
    quenchDeg,
    turns,
    speedMode,
    rotorInertiaKgM2,
    loadTorqueNm,
    initialAngleDeg,
  }

  const omega0 = startRpm * 2 * Math.PI / 60
  const magneticLookup = input.magneticLookup
  const inductanceH = magneticLookup
    ? grayLookupInductanceAtAngle(magneticLookup, initialAngleDeg)
    : grayInductanceAtAngle(initialAngleDeg, turns, motor.leakageCoupling, sectorCount)
  const resistanceOhm = 0.12 * turns / 140 / sectorCount + 0.01
  const nominalQuenchTime = quenchTimeSeconds(quenchDeg, startRpm)
  const electricalWindow = Math.max(8 * Math.sqrt(inductanceH * capacitanceF), 1e-3)
  const simulationLimitSeconds = Math.min(
    MAX_PULSE_DURATION_SECONDS,
    nominalQuenchTime > 0 ? Math.max(nominalQuenchTime, electricalWindow) : electricalWindow,
  )
  const capacitorJ = 0.5 * capacitanceF * chargeVoltageV * chargeVoltageV
  const context: GraySimulationContext = {
    capacitanceF,
    resistanceOhm,
    turns,
    coupling: motor.leakageCoupling,
    sectorCount,
    speedMode,
    rotorInertiaKgM2,
    loadTorqueNm,
    magneticLookup,
  }
  const state: GraySimulationState = {
    currentA: 0,
    capacitorVoltageV: chargeVoltageV,
    angleDeg: initialAngleDeg,
    omegaRadPerSecond: omega0,
  }
  const totals: GraySimulationTotals = {
    ohmicJ: 0,
    torqueWorkJ: 0,
    integratedTorqueWorkJ: 0,
    electricalDeliveredJ: 0,
    loadWorkJ: 0,
  }
  const trajectory: GraySimulationTrajectoryPoint[] = [{
    timeSeconds: 0,
    state: copySimulationState(state),
  }]
  let simulationTimeSeconds = 0
  let quenchEventReached = quenchDeg === 0 && startRpm > 0
  let quenchEventTimeSeconds: number | null = quenchEventReached ? 0 : null
  let quenchEventState: GraySimulationState | null = quenchEventReached
    ? copySimulationState(state)
    : null
  let quenchEventTotals: GraySimulationTotals | null = quenchEventReached
    ? { ...totals }
    : null
  let stalled = false
  let stallTimeSeconds: number | null = null
  let peakCurrentA = 0
  const appendIntegratedStep = (stepSeconds: number): boolean => {
    const startState = copySimulationState(state)
    const startTotals = { ...totals }
    const startTimeSeconds = simulationTimeSeconds
    const didStall = speedMode === 'dynamic'
      ? advanceDynamic(state, stepSeconds, context, totals)
      : (advancePrescribed(state, stepSeconds, context, totals), false)
    if (didStall && !stalled) {
      stalled = true
      stallTimeSeconds = startTimeSeconds + stepSeconds
    }
    simulationTimeSeconds += stepSeconds
    const sweptStartDeg = startState.angleDeg - initialAngleDeg
    const sweptEndDeg = state.angleDeg - initialAngleDeg
    const angleToleranceDeg = QUENCH_ANGLE_TOLERANCE_DEG * Math.max(1, Math.abs(quenchDeg))
    const crossedQuench = !quenchEventReached
      && quenchDeg > 0
      && sweptStartDeg < quenchDeg
      && sweptEndDeg + angleToleranceDeg >= quenchDeg
    if (crossedQuench) {
      const sweptSpanDeg = sweptEndDeg - sweptStartDeg
      const fraction = sweptSpanDeg <= 0
        ? 0
        : Math.max(0, Math.min(1, (quenchDeg - sweptStartDeg) / sweptSpanDeg))
      quenchEventReached = true
      quenchEventTimeSeconds = startTimeSeconds + stepSeconds * fraction
      quenchEventState = interpolateSimulationState(startState, state, fraction)
      if (Math.abs(quenchEventState.angleDeg - (initialAngleDeg + quenchDeg)) <= angleToleranceDeg) {
        quenchEventState.angleDeg = initialAngleDeg + quenchDeg
      }
      quenchEventTotals = interpolateSimulationTotals(startTotals, totals, fraction)
      state.currentA = quenchEventState.currentA
      state.capacitorVoltageV = quenchEventState.capacitorVoltageV
      state.angleDeg = quenchEventState.angleDeg
      state.omegaRadPerSecond = quenchEventState.omegaRadPerSecond
      totals.ohmicJ = quenchEventTotals.ohmicJ
      totals.torqueWorkJ = quenchEventTotals.torqueWorkJ
      totals.integratedTorqueWorkJ = quenchEventTotals.integratedTorqueWorkJ
      totals.electricalDeliveredJ = quenchEventTotals.electricalDeliveredJ
      totals.loadWorkJ = quenchEventTotals.loadWorkJ
      simulationTimeSeconds = quenchEventTimeSeconds
      trajectory.push({
        timeSeconds: simulationTimeSeconds,
        state: copySimulationState(state),
      })
      if (stallTimeSeconds !== null && stallTimeSeconds > simulationTimeSeconds) {
        stalled = false
        stallTimeSeconds = null
      }
      return true
    }
    trajectory.push({
      timeSeconds: simulationTimeSeconds,
      state: copySimulationState(state),
    })
    return false
  }

  if (!quenchEventReached) {
    const outputStep = simulationLimitSeconds / (SAMPLE_COUNT - 1)
    const substep = outputStep / INTEGRATION_SUBSTEPS
    outer: for (let sampleIndex = 1; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
      for (let substepIndex = 0; substepIndex < INTEGRATION_SUBSTEPS; substepIndex += 1) {
        if (appendIntegratedStep(substep)) break outer
      }
    }
  }

  const simulatedDurationSeconds = simulationTimeSeconds
  const eventOrTerminalState = quenchEventState ?? state
  const eventOrTerminalInductanceH = simulationInductanceAtAngle(eventOrTerminalState.angleDeg, context)
  const eventOrTerminalInductorJ = 0.5 * eventOrTerminalInductanceH
    * eventOrTerminalState.currentA * eventOrTerminalState.currentA
  const actualEventOmegaRadPerSecond = quenchEventState?.omegaRadPerSecond ?? null
  const actualEventRpm = actualEventOmegaRadPerSecond === null
    ? null
    : actualEventOmegaRadPerSecond * 60 / (2 * Math.PI)
  const arcQuenched = quenchEventReached
    && (actualEventRpm ?? 0) + 1e-9 >= GRAY_QUENCH_REFERENCE.minimumRpm
    && quenchDeg > 0
  const sampleAt = (timeSeconds: number, sampleState: GraySimulationState): GrayPulseSample => {
    const currentA = sampleState.currentA
    const angleDeg = sampleState.angleDeg
    const sampleInductanceH = simulationInductanceAtAngle(angleDeg, context)
    const sampleCoEnergyJ = 0.5 * sampleInductanceH * currentA * currentA
    const torqueNm = simulationTorqueAtAngle(currentA, angleDeg, context)
    peakCurrentA = Math.max(peakCurrentA, Math.abs(currentA))
    const sweptAngleDeg = Math.max(0, Math.min(quenchDeg, angleDeg - initialAngleDeg))
    return {
      timeSeconds,
      currentA,
      capacitorVoltageV: sampleState.capacitorVoltageV,
      torqueNm,
      angleDeg,
      arcLengthM: RADIUS_M * sweptAngleDeg * Math.PI / 180,
      inductanceH: sampleInductanceH,
      coEnergyJ: sampleCoEnergyJ,
      omegaRadPerSecond: sampleState.omegaRadPerSecond,
    }
  }

  const samples: GrayPulseSample[] = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const targetTime = simulatedDurationSeconds * index / (SAMPLE_COUNT - 1)
    return sampleAt(targetTime, stateAtTrajectoryTime(targetTime, trajectory))
  })
  const residualCapacitorJ = 0.5 * capacitanceF * eventOrTerminalState.capacitorVoltageV
    * eventOrTerminalState.capacitorVoltageV
  const inductorAtQuenchJ = eventOrTerminalInductorJ
  const recoveryCapJ = inductorAtQuenchJ
  const recoveredJ = arcQuenched && motor.hasRecovery
    ? Math.min(Math.max(0, motor.recoveryCoupling) * inductorAtQuenchJ, recoveryCapJ)
    : 0
  const sparkJ = arcQuenched ? inductorAtQuenchJ - recoveredJ : 0
  const residualInductorJ = arcQuenched ? 0 : inductorAtQuenchJ
  const integratedTorqueWorkJ = totals.integratedTorqueWorkJ
  const torqueWorkJ = integratedTorqueWorkJ
  const electromagneticTorqueWorkJ = integratedTorqueWorkJ
  const balance = calculateEnergyBalance({
    sourceCapacitorJ: capacitorJ,
    torqueWorkJ,
    recoveredJ,
    lossesJ: totals.ohmicJ + sparkJ,
    residualCapacitorJ,
    residualInductorJ,
  })
  const pulseStageCop = capacitorJ === 0 ? 0 : (torqueWorkJ + recoveredJ) / capacitorJ
  const finalRpm = eventOrTerminalState.omegaRadPerSecond * 60 / (2 * Math.PI)
  const rotorKineticInitialJ = 0.5 * rotorInertiaKgM2 * omega0 * omega0
  const rotorKineticFinalJ = 0.5 * rotorInertiaKgM2
    * eventOrTerminalState.omegaRadPerSecond * eventOrTerminalState.omegaRadPerSecond
  const rotorKineticDeltaJ = rotorKineticFinalJ - rotorKineticInitialJ
  const mechanicalBalanceResidualJ = speedMode === 'dynamic'
    ? integratedTorqueWorkJ - totals.loadWorkJ - rotorKineticDeltaJ
    : 0
  const stage: GrayStageLedger = {
    charge: { sourceCapacitorJ: capacitorJ },
    fire: {
      capacitorDeliveredJ: capacitorJ - residualCapacitorJ,
      electricalDeliveredJ: capacitorJ - residualCapacitorJ,
    },
    arc: {
      inductorAtEventJ: inductorAtQuenchJ,
      sparkLossJ: sparkJ,
      residualInductorJ,
    },
    recovery: {
      availableJ: inductorAtQuenchJ,
      capJ: recoveryCapJ,
      recoveredJ,
    },
  }
  const ledger: GrayEnergyLedger = {
    capacitorJ,
    ohmicJ: totals.ohmicJ,
    sparkJ,
    mechanicalJ: torqueWorkJ,
    recoveredJ,
    residualCapacitorJ,
    residualInductorJ,
    accountedJ: balance.accountedJ,
    residualJ: balance.residualJ,
    classicalCop: pulseStageCop,
    pulseStageCop,
    classicalCopScope: 'pulse-stage',
    systemCop: null,
    claimedCop: motor.id === 'ema4' ? CLAIMED_COP : null,
    claimedInputW: motor.id === 'ema4' ? CROSBY_INPUT_W : null,
    sourceCapacitorJ: capacitorJ,
    shaftWorkJ: torqueWorkJ,
    torqueWorkJ,
    electromagneticTorqueWorkJ,
    integratedTorqueWorkJ,
    loadWorkJ: totals.loadWorkJ,
    kineticEnergyChangeJ: rotorKineticDeltaJ,
    mechanicalBalanceResidualJ,
    recoveryJ: recoveredJ,
    lossesJ: totals.ohmicJ + sparkJ,
    normalizedResidual: balance.normalizedResidual,
    chargeJ: capacitorJ,
    fireJ: capacitorJ - residualCapacitorJ,
    arcJ: sparkJ,
    electricalDeliveredJ: capacitorJ - residualCapacitorJ,
    inductorAtQuenchJ,
    stage,
  }
  const quenchTiming = grayQuenchTiming(quenchDeg, startRpm)
  const finding = arcQuenched
    ? `${motor.label}: bounded classical pulse-stage model with ${GRAY_TOPOLOGY.dischargesPerRevolution} scheduled steps/rev and three simultaneous sectors. The ${GRAY_QUENCH_REFERENCE.minimumRpm} rpm quench condition is presenter-reported, not universal; quench timing is theta/omega. No radiant or free-energy force term is included.`
    : `${motor.label}: the scheduled dump remains unquenched in this run. The ${GRAY_QUENCH_REFERENCE.minimumRpm} rpm condition is presenter-reported, not a universal threshold; residual inductor energy remains in the ledger. No radiant or free-energy force term is included.`
  const result: GrayMotorResult = {
    motor,
    input: resolved,
    modelStatus: GRAY_MODEL_STATUS,
    magneticModel: magneticLookup ? 'fem-lookup' : 'illustrative-surrogate',
    provenance: GRAY_MODEL_PROVENANCE,
    topology: GRAY_TOPOLOGY,
    eventSchedule: GRAY_EVENT_SCHEDULE,
    quenchTiming,
    speedMode,
    rotorInertiaKgM2,
    loadTorqueNm,
    inductanceH,
    resistanceOhm,
    peakCurrentA,
    quenchTimeSeconds: nominalQuenchTime,
    quenchEventReached,
    quenchEventTimeSeconds,
    quenchEventAngleDeg: quenchEventState?.angleDeg ?? null,
    quenchEventOmegaRadPerSecond: actualEventOmegaRadPerSecond,
    quenchEventRpm: actualEventRpm,
    simulatedDurationSeconds,
    pulseRateHz: GRAY_TOPOLOGY.dischargesPerRevolution * startRpm / 60,
    nominalPulseRateHz: GRAY_TOPOLOGY.dischargesPerRevolution * startRpm / 60,
    powerRateBasis: 'nominal-start-speed',
    electricalInputW: capacitorJ * GRAY_TOPOLOGY.dischargesPerRevolution * startRpm / 60,
    mechanicalPowerW: torqueWorkJ * GRAY_TOPOLOGY.dischargesPerRevolution * startRpm / 60,
    recoveredPowerW: recoveredJ * GRAY_TOPOLOGY.dischargesPerRevolution * startRpm / 60,
    finalAngleDeg: eventOrTerminalState.angleDeg,
    finalRpm,
    rotorKineticInitialJ,
    rotorKineticFinalJ,
    rotorKineticDeltaJ,
    torqueWorkJ,
    shaftWorkJ: torqueWorkJ,
    electromagneticTorqueWorkJ,
    integratedTorqueWorkJ,
    loadWorkJ: totals.loadWorkJ,
    kineticEnergyChangeJ: rotorKineticDeltaJ,
    mechanicalBalanceResidualJ,
    mechanicalModel: speedMode === 'dynamic' ? 'dynamic-inertial' : 'kinematic-prescribed',
    stalled,
    stallTimeSeconds,
    electricalDeliveredJ: totals.electricalDeliveredJ,
    arcQuenched,
    samples,
    table: Array.from({ length: TABLE_COUNT }, (_, index) => samples[Math.round(index * (SAMPLE_COUNT - 1) / (TABLE_COUNT - 1))]!),
    ledger,
    finding,
  }
  finiteResultValues(result)
  return result
}

export function evaluateGrayFamily(shared: Omit<GrayMotorInput, 'motorId'>): GrayMotorResult[] {
  return GRAY_MOTOR_IDS.map((motorId) => evaluateGrayMotor({ ...shared, motorId }))
}
