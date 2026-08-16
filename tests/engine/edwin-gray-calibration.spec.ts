import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildGrayCalibrationMagneticLookup,
  GRAY_CALIBRATION_TRANSFER_PROXY,
  parseGrayCalibrationPack,
  requireCompatibleGrayCalibration,
} from '../../src/edwin-gray/edwinGrayCalibration'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_PATENT_MACHINE_ID,
} from '../../src/edwin-gray/edwinGrayMachines'
import { evaluateGrayFullMotor } from '../../src/edwin-gray/edwinGrayEngine'
import {
  createGraySubmittedInput,
  defaultGrayWorkbenchInput,
} from '../../src/edwin-gray/edwinGrayWorkbench'

const patent = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
const publicCalibrationPack = JSON.parse(readFileSync(resolve(
  'public/data/generated/edwin-gray/motor-fem-calibration-pack-v1.json',
), 'utf8')) as unknown

function calibrationPack() {
  return {
    contract: 'edwin-gray-motor-fem-calibration-pack',
    contractVersion: 1,
    profileId: 'fast-limited-calibration-v1',
    status: 'limited-not-validated',
    productionEligible: false,
    fullConvergenceClaim: false,
    optIn: true,
    defaultEnabled: false,
    configuration: {
      eventClasses: [0, 1, 2],
      meshSizeM: 0.025,
      driveCurrentA: 10,
      solverProfile: 'direct-mumps-publication-v1',
      resources: { memoryGiB: 24, memorySwapGiB: 24, cpus: 2, threads: 2, serial: true },
      hardDeadlineSeconds: 1720,
    },
    evidence: {
      modelInputHash: patent.modelInputHash,
      environmentIdentityHash: 'a'.repeat(64),
      pilotReportSha256: 'b'.repeat(64),
      symmetryProofSha256: 'c'.repeat(64),
      coarseFineDrift: { measured: GRAY_CALIBRATION_TRANSFER_PROXY, maximum: 0.02, status: 'passed' },
    },
    classes: [0, 1, 2].map((eventClass) => ({
      eventClass,
      eventIndex: eventClass,
      rotorAngleDeg: eventClass * 40 / 3,
      jobInputHash: String(eventClass + 1).repeat(64),
      checkpointSha256: String(eventClass + 4).repeat(64),
      resultSha256: String(eventClass + 7).repeat(64),
      observables: {
        magneticEnergyJ: { value: 0.25 + eventClass * 0.01, unit: 'J' },
        coEnergyJ: { value: 0.25125 + eventClass * 0.01, unit: 'J' },
        inductanceH: { value: 0.005 + eventClass * 0.0001, unit: 'H' },
      },
      uncertaintyBasis: eventClass === 0 ? 'measured' : 'transfer-assumed',
    })),
    uncertainty: {
      relativeBound: 0.02,
      quantities: ['L', 'W', "W'"],
      classBasis: { '0': 'measured', '1': 'transfer-assumed', '2': 'transfer-assumed' },
    },
    torque: {
      bounded: false,
      reason: 'No torque-derivative convergence evidence is included in this limited calibration pack.',
    },
    limitations: [
      'Limited coarse calibration evidence only; not a production FEM lookup table.',
      'Class 0 coarse/fine uncertainty is measured; classes 1 and 2 use an explicit transfer assumption.',
    ],
  }
}

describe('limited Edwin Gray FEM calibration contract', () => {
  it('loads the real public pack as compatible and ready without changing its opt-in boundary', () => {
    const parsed = parseGrayCalibrationPack(publicCalibrationPack)
    const lookup = buildGrayCalibrationMagneticLookup(parsed)

    expect(parsed).toMatchObject({
      status: 'limited-not-validated',
      productionEligible: false,
      fullConvergenceClaim: false,
      optIn: true,
      defaultEnabled: false,
    })
    expect(requireCompatibleGrayCalibration(parsed, GRAY_PATENT_MACHINE_ID)).toBe(patent)
    expect(lookup.inductanceH.slice(0, 3)).toEqual([
      0.005452776863618732,
      0.006393174744381888,
      0.005048067456746148,
    ])
    expect(lookup.calibration).toMatchObject({
      status: 'limited-not-validated',
      productionEligible: false,
      fullConvergenceClaim: false,
      torqueBounded: false,
    })
  })

  it('strictly parses the non-production evidence and uncertainty boundary', () => {
    const parsed = parseGrayCalibrationPack(calibrationPack())

    expect(parsed).toMatchObject({
      status: 'limited-not-validated',
      productionEligible: false,
      fullConvergenceClaim: false,
      defaultEnabled: false,
      evidence: {
        modelInputHash: patent.modelInputHash,
        symmetryProofSha256: 'c'.repeat(64),
      },
      torque: { bounded: false },
    })
    expect(parsed.classes.map(({ eventClass }) => eventClass)).toEqual([0, 1, 2])
    expect(parsed.uncertainty.classBasis).toEqual({
      '0': 'measured',
      '1': 'transfer-assumed',
      '2': 'transfer-assumed',
    })
  })

  it.each([
    ['production eligibility', (pack: ReturnType<typeof calibrationPack>) => { pack.productionEligible = true }],
    ['full convergence', (pack: ReturnType<typeof calibrationPack>) => { pack.fullConvergenceClaim = true }],
    ['default enabled', (pack: ReturnType<typeof calibrationPack>) => { pack.defaultEnabled = true }],
    ['model hash', (pack: ReturnType<typeof calibrationPack>) => { pack.evidence.modelInputHash = 'd'.repeat(64) }],
    ['symmetry proof hash', (pack: ReturnType<typeof calibrationPack>) => { pack.evidence.symmetryProofSha256 = 'invalid' }],
    ['class coverage', (pack: ReturnType<typeof calibrationPack>) => { pack.classes.pop() }],
    ['unknown field', (pack: ReturnType<typeof calibrationPack>) => { Object.assign(pack, { unexpected: true }) }],
  ])('rejects contract drift in %s', (_label, mutate) => {
    const pack = calibrationPack()
    mutate(pack)
    expect(() => parseGrayCalibrationPack(pack)).toThrow()
  })

  it('requires the exact patent machine topology, turns, excitation, and model hash', () => {
    const parsed = parseGrayCalibrationPack(calibrationPack())
    expect(requireCompatibleGrayCalibration(parsed, GRAY_PATENT_MACHINE_ID)).toMatchObject({
      machineContractId: GRAY_PATENT_MACHINE_ID,
      topologyIdentity: 'us3890548a-nine-stator-three-rotor-pair-topology',
      compatibleTurns: 100,
      compatibleExcitation: 'impressed-current-magnetostatic',
      modelInputHash: patent.modelInputHash,
    })
    expect(() => requireCompatibleGrayCalibration(parsed, 'edwin-gray-purple')).toThrow(/patent illustrative machine mismatch/)
  })

  it('expands three classes to 27 ordered L/W/W-prime points with retained evidence', () => {
    const lookup = buildGrayCalibrationMagneticLookup(calibrationPack())

    expect(lookup.source).toBe('limited-fem-calibration')
    expect(lookup.anglesDeg).toHaveLength(27)
    expect(lookup.inductanceH).toHaveLength(27)
    expect(lookup.magneticEnergyJ).toHaveLength(27)
    expect(lookup.coEnergyJ).toHaveLength(27)
    expect(lookup.anglesDeg[26]).toBeCloseTo(26 * 40 / 3)
    expect(lookup.inductanceH.slice(0, 6)).toEqual([0.005, 0.0051, 0.0052, 0.005, 0.0051, 0.0052])
    expect(lookup.calibration).toEqual(expect.objectContaining({
      transferProxyRelative: GRAY_CALIBRATION_TRANSFER_PROXY,
      classBasis: ['measured', 'transfer-assumed', 'transfer-assumed'],
      torqueBounded: false,
      symmetryProofSha256: 'c'.repeat(64),
    }))
    expect(structuredClone(lookup)).toEqual(lookup)
  })

  it('preserves source identity and worker-cloneable full-motor input', () => {
    const lookup = buildGrayCalibrationMagneticLookup(calibrationPack())
    const input = {
      ...defaultGrayWorkbenchInput(GRAY_PATENT_MACHINE_ID),
      magneticModel: 'limited-fem-calibration' as const,
    }
    const submitted = createGraySubmittedInput(input, lookup)

    expect(submitted.identity).toContain('limited-fem-calibration')
    expect(structuredClone(submitted.engineInput)).toEqual(submitted.engineInput)
    const result = evaluateGrayFullMotor(submitted.engineInput)
    expect(result.magneticScope).toBe('limited-fem-calibration-magnetic-lumped-circuit')
    expect(result.findings.find(({ code }) => code === 'magnetic-scope')?.statement).toContain('exploratory, unbounded')
  })
})
