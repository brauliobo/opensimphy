import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_MACHINE_IDS,
  GRAY_PATENT_MACHINE_ID,
  GRAY_PATENT_MODEL_INPUT_HASH,
} from '../../src/edwin-gray/edwinGrayMachines'
import {
  parseGrayFemLookupDocument,
  requireCompatibleGrayFemLookup,
} from '../../src/edwin-gray/edwinGrayFem'

const artifactHash = 'a'.repeat(64)

function patentLookup() {
  const contract = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
  return {
    contract: 'edwin-gray-browser-result',
    contractVersion: 1,
    lutContract: 'motor-fem-lut-v1',
    caseId: GRAY_PATENT_MACHINE_ID,
    status: 'complete',
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
      status: 'complete',
      parameters: { rotorAngleDeg, meshSizeM: 0.025, driveCurrentA: 1 },
      observables: {
        magneticEnergyJ: { value: 0.1, unit: 'J' },
        coEnergyJ: { value: 0.1, unit: 'J' },
        inductanceH: { value: 0.2, unit: 'H' },
      },
      provenance: {
        synthetic: false,
        sourceFormat: 'getdp-table',
        solver: 'getdp',
        backend: 'host',
        modelInputHash: GRAY_PATENT_MODEL_INPUT_HASH,
        jobInputHash: (index === 0 ? 'b' : 'c').repeat(64),
        symmetryApplied: false,
        artifacts: [{ path: `result-${index}.dat`, sha256: artifactHash }],
      },
    })),
    provenance: {
      synthetic: false,
      limitations: ['Illustrative patent topology, not a prototype replica.'],
      source: 'checkpoint-attested test fixture',
    },
  }
}

describe('Edwin Gray machine contracts', () => {
  it('keeps every engine prototype and the patent topology distinct', () => {
    expect(GRAY_MACHINE_IDS).toHaveLength(7)
    expect(new Set(GRAY_MACHINE_IDS).size).toBe(7)
    expect(new Set(GRAY_MACHINE_IDS.map((id) => GRAY_MACHINE_CONTRACTS[id].topologyIdentity)).size).toBe(7)
    expect(GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]).toMatchObject({
      machineRevision: 1,
      modelRevision: 1,
      femStatus: 'not-run',
    })
  })

  it('rejects patent FEM for an engine prototype contract', () => {
    const lookup = parseGrayFemLookupDocument(patentLookup())
    expect(() => requireCompatibleGrayFemLookup(lookup, 'edwin-gray-purple')).toThrow(/machine contract ID mismatch/)
  })

  it('accepts an exact patent machine and model match', () => {
    const lookup = parseGrayFemLookupDocument(patentLookup())
    expect(requireCompatibleGrayFemLookup(lookup, GRAY_PATENT_MACHINE_ID)).toBe(lookup)
  })

  it.each([
    ['turns', 101, /turns mismatch/],
    ['topologyIdentity', 'different-topology', /topology identity mismatch/],
    ['excitation', 'different-excitation', /excitation mismatch/],
    ['machineRevision', 2, /machine revision mismatch/],
  ] as const)('rejects a %s mismatch', (field, value, message) => {
    const input = patentLookup()
    Object.assign(input.compatibility, { [field]: value })
    const lookup = parseGrayFemLookupDocument(input)
    expect(() => requireCompatibleGrayFemLookup(lookup, GRAY_PATENT_MACHINE_ID)).toThrow(message)
  })

  it('fails closed when parsed legacy FEM metadata has no compatibility declaration', () => {
    const input = patentLookup()
    const { compatibility: _, ...legacy } = input
    const lookup = parseGrayFemLookupDocument(legacy)
    expect(() => requireCompatibleGrayFemLookup(lookup, GRAY_PATENT_MACHINE_ID)).toThrow(/compatibility metadata is required/)
  })
})
