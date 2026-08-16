import { GRAY_CALIBRATION_TRANSFER_PROXY } from '../../src/edwin-gray/edwinGrayCalibration'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_PATENT_MACHINE_ID,
} from '../../src/edwin-gray/edwinGrayMachines'

export function compatibleGrayCalibrationPack() {
  const patent = GRAY_MACHINE_CONTRACTS[GRAY_PATENT_MACHINE_ID]
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
      'No full mesh, outer-domain, or torque convergence claim is made.',
    ],
  }
}
