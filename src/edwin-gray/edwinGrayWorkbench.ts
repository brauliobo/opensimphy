import {
  GRAY_PRESETS,
  type GrayFullMotorInput,
  type GrayFullMotorMachineMode,
  type GrayFullMotorMode,
  type GrayFullMotorResult,
  type GrayMagneticLookup,
  type GrayMotorId,
} from './edwinGrayEngine'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_PATENT_MACHINE_ID,
  type GrayMachineContractId,
} from './edwinGrayMachines'

export const GRAY_WORKBENCH_INPUT_REVISION = 1 as const
export const GRAY_WORKBENCH_SOURCE_REVISION = 'US3890548A-and-Motor-Edwin-Gray-transcript-v1'
export const GRAY_WORKBENCH_IMPLEMENTATION_REVISION = 'closed-form-event-map-v1'
export const GRAY_WORKBENCH_MODEL_REVISION = 'gray-full-motor-v1'
export const GRAY_WORKBENCH_COMPATIBILITY_KEY = '740be45305f25b10e90b0a4dbf0ca892cd924c2884d2d426b0676c04817a4fbf'

export type GrayMagneticModelSelection = 'illustrative-surrogate' | 'fem-lookup'

export interface GrayWorkbenchInputState {
  revision: typeof GRAY_WORKBENCH_INPUT_REVISION
  machineContractId: GrayMachineContractId
  mode: GrayFullMotorMode
  machineMode: GrayFullMotorMachineMode
  magneticModel: GrayMagneticModelSelection
  revolutions: number
  startRpm: number
  rotorInertiaKgM2: number
  loadTorqueNm: number
  chargeVoltageV: number
  capacitanceF: number
  turns: number
  quenchDeg: number
  dumpCapacitanceF: number
  recoveryCapacitanceF: number
  initialRecoveryVoltageV: number
  sourceResistanceOhm: number
}

export const GRAY_WORKBENCH_QUERY_KEYS = Object.freeze([
  'grayRevision',
  'grayMachine',
  'grayMode',
  'grayContact',
  'grayMagnetic',
  'grayRevolutions',
  'grayRpm',
  'grayInertia',
  'grayLoad',
  'grayVoltage',
  'grayCapacitance',
  'grayTurns',
  'grayQuench',
  'grayDumpCapacitance',
  'grayRecoveryCapacitance',
  'grayRecoveryVoltage',
  'graySourceResistance',
] as const)

type GrayWorkbenchQueryKey = typeof GRAY_WORKBENCH_QUERY_KEYS[number]
export type GrayWorkbenchQuery = Partial<Record<GrayWorkbenchQueryKey, string>>

function motorIdForContract(machineContractId: GrayMachineContractId): GrayMotorId {
  const contract = GRAY_MACHINE_CONTRACTS[machineContractId]
  if (!contract) throw new Error(`Unknown Gray machine contract: ${machineContractId}`)
  return contract.engineMotorId
}

export class GrayWorkbenchRevisionError extends RangeError {
  constructor(readonly receivedRevision: string) {
    super(`Unsupported Gray workbench input revision "${receivedRevision}"; this runtime supports revision ${GRAY_WORKBENCH_INPUT_REVISION}.`)
    this.name = 'GrayWorkbenchRevisionError'
  }
}

export function defaultGrayWorkbenchInput(
  machineContractId: GrayMachineContractId = 'edwin-gray-purple',
): GrayWorkbenchInputState {
  const contract = GRAY_MACHINE_CONTRACTS[machineContractId]
  const preset = GRAY_PRESETS[motorIdForContract(machineContractId)]
  const capacitanceF = preset.capacitanceF
  return {
    revision: GRAY_WORKBENCH_INPUT_REVISION,
    machineContractId,
    mode: 'dynamic',
    machineMode: 'original-500rpm-contact-v1',
    magneticModel: 'illustrative-surrogate',
    revolutions: 1,
    startRpm: preset.startRpm,
    rotorInertiaKgM2: 0.01,
    loadTorqueNm: 0.01,
    chargeVoltageV: preset.chargeVoltageV,
    capacitanceF,
    turns: contract.compatibleTurns,
    quenchDeg: preset.quenchDeg,
    dumpCapacitanceF: capacitanceF / 2,
    recoveryCapacitanceF: capacitanceF * 4,
    initialRecoveryVoltageV: 0,
    sourceResistanceOhm: 40,
  }
}

function one(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(one(value))
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(one(value))
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  const parsed = one(value)
  return parsed && values.includes(parsed as T) ? parsed as T : fallback
}

export function parseGrayWorkbenchQuery(query: Record<string, unknown>): GrayWorkbenchInputState {
  const revision = one(query.grayRevision)
  if (revision !== undefined && revision !== String(GRAY_WORKBENCH_INPUT_REVISION)) {
    throw new GrayWorkbenchRevisionError(revision)
  }
  const machineContractId = enumValue(
    query.grayMachine,
    Object.keys(GRAY_MACHINE_CONTRACTS) as GrayMachineContractId[],
    'edwin-gray-purple',
  )
  const defaults = defaultGrayWorkbenchInput(machineContractId)
  return {
    revision: GRAY_WORKBENCH_INPUT_REVISION,
    machineContractId,
    mode: enumValue(query.grayMode, ['prescribed-diagnostic', 'dynamic'], defaults.mode),
    machineMode: enumValue(
      query.grayContact,
      ['original-500rpm-contact-v1', 'modified-electronic-v1'],
      defaults.machineMode,
    ),
    magneticModel: enumValue(
      query.grayMagnetic,
      ['illustrative-surrogate', 'fem-lookup'],
      defaults.magneticModel,
    ),
    revolutions: integer(query.grayRevolutions, defaults.revolutions, 1, 100),
    startRpm: finiteNumber(query.grayRpm, defaults.startRpm, 0, 20_000),
    rotorInertiaKgM2: finiteNumber(query.grayInertia, defaults.rotorInertiaKgM2, 1e-12, 1_000),
    loadTorqueNm: finiteNumber(query.grayLoad, defaults.loadTorqueNm, 0, 1_000_000),
    chargeVoltageV: finiteNumber(query.grayVoltage, defaults.chargeVoltageV, 0, 200_000),
    capacitanceF: finiteNumber(query.grayCapacitance, defaults.capacitanceF, 1e-12, 1e-2),
    turns: finiteNumber(query.grayTurns, defaults.turns, 1, 2_000),
    quenchDeg: finiteNumber(query.grayQuench, defaults.quenchDeg, 0, 40),
    dumpCapacitanceF: finiteNumber(query.grayDumpCapacitance, defaults.dumpCapacitanceF, 1e-12, 1e-2),
    recoveryCapacitanceF: finiteNumber(query.grayRecoveryCapacitance, defaults.recoveryCapacitanceF, 1e-12, 1e-1),
    initialRecoveryVoltageV: finiteNumber(
      query.grayRecoveryVoltage,
      defaults.initialRecoveryVoltageV,
      0,
      finiteNumber(query.grayVoltage, defaults.chargeVoltageV, 0, 200_000) * 2,
    ),
    sourceResistanceOhm: finiteNumber(query.graySourceResistance, defaults.sourceResistanceOhm, 1e-6, 1e9),
  }
}

export function serializeGrayWorkbenchInput(input: GrayWorkbenchInputState): GrayWorkbenchQuery {
  return {
    grayRevision: String(input.revision),
    grayMachine: input.machineContractId,
    grayMode: input.mode,
    grayContact: input.machineMode,
    grayMagnetic: input.magneticModel,
    grayRevolutions: String(input.revolutions),
    grayRpm: String(input.startRpm),
    grayInertia: String(input.rotorInertiaKgM2),
    grayLoad: String(input.loadTorqueNm),
    grayVoltage: String(input.chargeVoltageV),
    grayCapacitance: String(input.capacitanceF),
    grayTurns: String(input.turns),
    grayQuench: String(input.quenchDeg),
    grayDumpCapacitance: String(input.dumpCapacitanceF),
    grayRecoveryCapacitance: String(input.recoveryCapacitanceF),
    grayRecoveryVoltage: String(input.initialRecoveryVoltageV),
    graySourceResistance: String(input.sourceResistanceOhm),
  }
}

export function grayFullMotorInput(
  input: GrayWorkbenchInputState,
  magneticLookup?: GrayMagneticLookup,
): GrayFullMotorInput {
  if (input.magneticModel === 'fem-lookup' && !magneticLookup) {
    throw new Error('A compatible ready FEM lookup is required when FEM magnetic mode is selected')
  }
  const incompatibility = magneticLookup ? grayFemCompatibilityReason(input, magneticLookup) : null
  if (incompatibility) throw new Error(incompatibility)
  return {
    motorId: motorIdForContract(input.machineContractId),
    machineContractId: input.machineContractId,
    revolutions: input.revolutions,
    chargeVoltageV: input.chargeVoltageV,
    capacitanceF: input.capacitanceF,
    startRpm: input.startRpm,
    quenchDeg: input.quenchDeg,
    turns: input.turns,
    mode: input.mode,
    machineMode: input.machineMode,
    rotorInertiaKgM2: input.rotorInertiaKgM2,
    loadTorqueNm: input.loadTorqueNm,
    dumpCapacitanceF: input.dumpCapacitanceF,
    recoveryCapacitanceF: input.recoveryCapacitanceF,
    initialRecoveryVoltageV: input.initialRecoveryVoltageV,
    sourceResistanceOhm: input.sourceResistanceOhm,
    ...(magneticLookup ? { magneticLookup } : {}),
  }
}

export function grayFemCompatibilityReason(
  input: GrayWorkbenchInputState,
  magneticLookup: GrayMagneticLookup,
): string | null {
  const contract = GRAY_MACHINE_CONTRACTS[input.machineContractId]
  const compatibility = magneticLookup.compatibility
  if (compatibility.machineContractId !== input.machineContractId) return 'FEM disabled: machine contract changed after lookup validation.'
  if (compatibility.machineRevision !== contract.machineRevision) return 'FEM disabled: machine revision does not match the lookup.'
  if (compatibility.modelRevision !== contract.modelRevision) return 'FEM disabled: model revision does not match the lookup.'
  if (compatibility.topologyIdentity !== contract.topologyIdentity) return 'FEM disabled: topology identity does not match the lookup.'
  if (compatibility.turns !== input.turns) return `FEM disabled: lookup requires exactly ${compatibility.turns} turns.`
  if (compatibility.excitation !== contract.compatibleExcitation) return 'FEM disabled: excitation contract does not match the lookup.'
  if (compatibility.modelInputHash !== contract.modelInputHash
    || magneticLookup.provenance.inputHash !== contract.modelInputHash) return 'FEM disabled: model input hash does not match the lookup.'
  return null
}

export interface GraySubmittedInput {
  readonly identity: string
  readonly workbenchInput: Readonly<GrayWorkbenchInputState>
  readonly engineInput: Readonly<GrayFullMotorInput>
}

export function graySubmittedInputIdentity(
  input: GrayWorkbenchInputState,
  magneticLookup?: GrayMagneticLookup,
): string {
  return JSON.stringify({
    contract: serializeGrayWorkbenchInput(input),
    lookup: magneticLookup
      ? {
          caseId: magneticLookup.caseId,
          compatibility: magneticLookup.compatibility,
          inputHash: magneticLookup.provenance.inputHash,
        }
      : null,
  })
}

export function createGraySubmittedInput(
  input: GrayWorkbenchInputState,
  magneticLookup?: GrayMagneticLookup,
): GraySubmittedInput {
  const workbenchInput = Object.freeze({ ...input })
  const engineInput = grayFullMotorInput(workbenchInput, magneticLookup)
  return Object.freeze({
    identity: graySubmittedInputIdentity(workbenchInput, magneticLookup),
    workbenchInput,
    engineInput: Object.freeze(engineInput),
  })
}

export function grayFemCanBeRequested(input: GrayWorkbenchInputState): boolean {
  return input.machineContractId === GRAY_PATENT_MACHINE_ID
}

export function freezeGrayValue<T>(result: T): Readonly<T> {
  const seen = new WeakSet<object>()
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  freeze(result)
  return result
}

export function freezeGrayFullMotorResult(result: GrayFullMotorResult): Readonly<GrayFullMotorResult> {
  return freezeGrayValue(result)
}
