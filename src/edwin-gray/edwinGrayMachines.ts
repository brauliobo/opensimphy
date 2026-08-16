import type { GrayMotorId } from './edwinGrayEngine'
import { GRAY_MACHINE_ARTIFACT } from './generated/grayMachines.generated'

export const GRAY_PATENT_MODEL_INPUT_HASH = GRAY_MACHINE_ARTIFACT.patentModelInputHash

export const GRAY_PATENT_MACHINE_ID = GRAY_MACHINE_ARTIFACT.patentMachineId
export const GRAY_MACHINE_REVISION = GRAY_MACHINE_ARTIFACT.metadata.revisions.machine
export const GRAY_MODEL_REVISION = GRAY_MACHINE_ARTIFACT.metadata.revisions.model
export type GrayPrototypeMotorId = typeof GRAY_MACHINE_ARTIFACT.prototypeMotorIds[number]
export type GrayMachineContractId = `edwin-gray-${GrayPrototypeMotorId}` | typeof GRAY_PATENT_MACHINE_ID
export type GrayClaimStatus = 'source-described-prototype' | 'patent-described-illustrative-model'
export type GrayEvidenceAvailability = 'descriptive-only' | 'patent-and-model-inputs'
export type GrayFemStatus = 'blocked' | 'not-run'

export interface GrayMachineContract {
  machineContractId: GrayMachineContractId
  machineRevision: typeof GRAY_MACHINE_REVISION
  modelRevision: typeof GRAY_MODEL_REVISION
  engineMotorId: GrayMotorId
  label: string
  claimStatus: GrayClaimStatus
  evidenceAvailability: GrayEvidenceAvailability
  topologyIdentity: string
  compatibleTurns: number
  compatibleExcitation: string
  modelInputHash: string | null
  femStatus: GrayFemStatus
  femBlocker: string
  runtimeClassification: {
    kind: 'source-described-prototype' | 'patent-described-illustrative-model'
    sourceStatus: 'descriptive' | 'patent-illustrative'
    surrogateStatus: 'illustrative-not-fem-calibrated' | 'patent-illustrative-runtime-not-replica'
  }
}

export const GRAY_MACHINE_CONTRACTS = Object.freeze(
  GRAY_MACHINE_ARTIFACT.machineContracts,
) as unknown as Readonly<Record<GrayMachineContractId, GrayMachineContract>>

export const GRAY_MACHINE_IDS = Object.freeze(
  GRAY_MACHINE_ARTIFACT.machineIds,
) as readonly GrayMachineContractId[]

export function grayMachineContract(machineContractId: GrayMachineContractId): GrayMachineContract {
  return GRAY_MACHINE_CONTRACTS[machineContractId]
}
