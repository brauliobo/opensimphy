import {
  GRAY_ENGINE_PROFILES,
  GRAY_MOTORS,
  GRAY_PATENT_MODEL_INPUT_HASH,
  GRAY_PROTOTYPE_MOTOR_IDS,
  type GrayMotorId,
} from './edwinGrayEngine'

export { GRAY_PATENT_MODEL_INPUT_HASH } from './edwinGrayEngine'

export const GRAY_PATENT_MACHINE_ID = 'patent-3890548-illustrative' as const
export const GRAY_MACHINE_REVISION = 1 as const
export const GRAY_MODEL_REVISION = 1 as const
export type GrayPrototypeMotorId = typeof GRAY_PROTOTYPE_MOTOR_IDS[number]
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
}

const PROTOTYPE_FEM_BLOCKER = 'No prototype-specific geometry, winding, excitation, or solver model is available.'

const prototypeContracts = Object.fromEntries(GRAY_PROTOTYPE_MOTOR_IDS.map((engineMotorId) => {
  const machineContractId: GrayMachineContractId = `edwin-gray-${engineMotorId}`
  const profile = GRAY_ENGINE_PROFILES[machineContractId]!
  const contract: GrayMachineContract = Object.freeze({
    machineContractId,
    machineRevision: GRAY_MACHINE_REVISION,
    modelRevision: GRAY_MODEL_REVISION,
    engineMotorId,
    label: `${GRAY_MOTORS[engineMotorId].label} illustrative surrogate scenario`,
    claimStatus: 'source-described-prototype',
    evidenceAvailability: 'descriptive-only',
    topologyIdentity: profile.topologyIdentity,
    compatibleTurns: profile.compatibleTurns,
    compatibleExcitation: profile.compatibleExcitation,
    modelInputHash: null,
    femStatus: 'blocked',
    femBlocker: PROTOTYPE_FEM_BLOCKER,
  })
  return [machineContractId, contract]
})) as Record<`edwin-gray-${GrayPrototypeMotorId}`, GrayMachineContract>

const patentContract: GrayMachineContract = Object.freeze({
  machineContractId: GRAY_PATENT_MACHINE_ID,
  machineRevision: GRAY_MACHINE_REVISION,
  modelRevision: GRAY_MODEL_REVISION,
  engineMotorId: GRAY_ENGINE_PROFILES[GRAY_PATENT_MACHINE_ID]!.motorId,
  label: 'US3890548A illustrative patent topology',
  claimStatus: 'patent-described-illustrative-model',
  evidenceAvailability: 'patent-and-model-inputs',
  topologyIdentity: 'us3890548a-nine-stator-three-rotor-pair-topology',
  compatibleTurns: 100,
  compatibleExcitation: 'impressed-current-magnetostatic',
  modelInputHash: GRAY_PATENT_MODEL_INPUT_HASH,
  femStatus: 'not-run',
  femBlocker: 'No complete checkpoint-attested FEM lookup is bundled with the browser application.',
})

export const GRAY_MACHINE_CONTRACTS: Readonly<Record<GrayMachineContractId, GrayMachineContract>> = Object.freeze({
  ...prototypeContracts,
  [GRAY_PATENT_MACHINE_ID]: patentContract,
})

export const GRAY_MACHINE_IDS = Object.freeze(Object.keys(GRAY_MACHINE_CONTRACTS) as GrayMachineContractId[])

export function grayMachineContract(machineContractId: GrayMachineContractId): GrayMachineContract {
  return GRAY_MACHINE_CONTRACTS[machineContractId]
}
