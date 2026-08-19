import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildGrayMagneticLookup,
  parseGrayFemLookupDocument,
} from '../../src/edwin-gray/edwinGrayFem'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_PATENT_MACHINE_ID,
  GRAY_PATENT_MODEL_INPUT_HASH,
} from '../../src/edwin-gray/edwinGrayMachines'

export const GRAY_PRODUCTION_LUT_FILE = join(
  process.cwd(),
  'public/data/generated/edwin-gray/motor-fem-lut-v1.json',
)

export function productionGrayFemLutPresent(): boolean {
  return existsSync(GRAY_PRODUCTION_LUT_FILE)
}

export function readProductionGrayFemLutDocument(): unknown {
  return JSON.parse(readFileSync(GRAY_PRODUCTION_LUT_FILE, 'utf8'))
}

export function productionGrayMagneticLookup() {
  return buildGrayMagneticLookup(parseGrayFemLookupDocument(readProductionGrayFemLutDocument()))
}

export function compatibleGrayFemLookupDocument() {
  const contract = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
  return {
    contract: 'edwin-gray-browser-result' as const,
    contractVersion: 1 as const,
    lutContract: 'motor-fem-lut-v1' as const,
    caseId: GRAY_PATENT_MACHINE_ID,
    status: 'complete' as const,
    expectedAnglesDeg: [0, 13.3333333333],
    compatibility: {
      machineContractId: contract.machineContractId,
      machineRevision: contract.machineRevision,
      modelRevision: contract.modelRevision,
      topologyIdentity: contract.topologyIdentity,
      turns: contract.compatibleTurns,
      excitation: contract.compatibleExcitation,
      modelInputHash: contract.modelInputHash,
    },
    entries: [0, 13.3333333333].map((rotorAngleDeg, index) => ({
      entryId: `entry-${index}`,
      status: 'complete' as const,
      parameters: {
        rotorAngleDeg,
        eventIndex: index,
        excitationContract: 'edwin-gray-fem-excitation-event-map/v1',
        meshSizeM: 0.025,
        driveCurrentA: 1,
      },
      observables: {
        magneticEnergyJ: { value: 0.1, unit: 'J' },
        coEnergyJ:     { value: 0.1, unit: 'J' },
        inductanceH:   { value: 0.2, unit: 'H' },
      },
      provenance: {
        synthetic: false as const,
        sourceFormat: 'getdp-table' as const,
        solver: 'getdp',
        backend: 'host',
        modelInputHash: GRAY_PATENT_MODEL_INPUT_HASH,
        jobInputHash: (index === 0 ? 'b' : 'c').repeat(64),
        symmetryApplied: false,
        artifacts: [{ path: `result-${index}.dat`, sha256: 'a'.repeat(64) }],
      },
    })),
    provenance: {
      synthetic: false as const,
      limitations: ['Illustrative patent topology, not a prototype replica.'],
      source: 'checkpoint-attested test fixture',
    },
  }
}

export function compatibleGrayMagneticLookup() {
  return buildGrayMagneticLookup(compatibleGrayFemLookupDocument())
}
