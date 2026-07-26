import {
  boundedInteger,
  finiteNumber,
  type EarthKernelResult,
} from "./common.js";

export type ChemistryComparatorId =
  | "EARTH-CHEM-003"
  | "EARTH-CHEM-005"
  | "EARTH-CHEM-006"
  | "EARTH-CHEM-008"
  | "EARTH-CHEM-009"
  | "EARTH-SPEC-002"
  | "EARTH-SPEC-003"
  | "EARTH-SPEC-004"
  | "EARTH-SPEC-005"
  | "EARTH-SPEC-006"
  | "EARTH-MAT-001"
  | "EARTH-MAT-002"
  | "EARTH-MAT-003"
  | "EARTH-MAT-005"
  | "EARTH-MAT-007"
  | "EARTH-MAT-008"
  | "EARTH-MAT-009"
  | "EARTH-THERM-002"
  | "EARTH-THERM-004"
  | "EARTH-THERM-005"
  | "EARTH-THERM-008"
  | "EARTH-THERM-009"
  | "EARTH-THERM-010";

export type LabeledChemistryComparatorResult<Id extends ChemistryComparatorId, Output> = EarthKernelResult<Output> & {
  label: Id;
};

type Vector3 = [number, number, number];
type ComplexValue = { re: number; im: number };

const PLANCK_CONSTANT = 6.626_070_15e-34;
const BOLTZMANN_CONSTANT = 1.380_649e-23;
const SPEED_OF_LIGHT = 299_792_458;
const VACUUM_PERMITTIVITY = 8.854_187_812_8e-12;

const BLOCKERS: Record<ChemistryComparatorId, string> = {
  "EARTH-CHEM-003": "Independent bond dataset and frozen EARTH bond predictions are absent.",
  "EARTH-CHEM-005": "An open molecular-geometry dataset and EARTH geometry predictions are absent.",
  "EARTH-CHEM-006": "EARTH does not specify independently fitted lone-pair and ligand weights.",
  "EARTH-CHEM-008": "The EARTH shell Hamiltonian and pinning potential are absent.",
  "EARTH-CHEM-009": "The EARTH molecular potential-energy surface is absent.",
  "EARTH-SPEC-002": "The EARTH force-constant matrix or Hessian is absent.",
  "EARTH-SPEC-003": "The EARTH dipole and polarizability response derivatives are absent.",
  "EARTH-SPEC-004": "The EARTH electronic Hamiltonian and transition operator are absent.",
  "EARTH-SPEC-005": "The EARTH magnetic shielding and spin-coupling model is absent.",
  "EARTH-SPEC-006": "The EARTH core-level Hamiltonian and transition matrix elements are absent.",
  "EARTH-MAT-001": "Material masses and force constants are absent.",
  "EARTH-MAT-002": "An EARTH elastic tensor and density prediction are absent.",
  "EARTH-MAT-003": "The EARTH microscopic dielectric response is absent.",
  "EARTH-MAT-005": "The EARTH dielectric and magnetic material laws are absent.",
  "EARTH-MAT-007": "The EARTH anisotropic response tensor is absent.",
  "EARTH-MAT-008": "The EARTH nonlinear susceptibility is absent.",
  "EARTH-MAT-009": "The EARTH micromagnetic energy and material constants are absent.",
  "EARTH-THERM-002": "An independent assignment rule and open transition-temperature data are absent.",
  "EARTH-THERM-004": "Authenticated IAPWS-95 or Span-Wagner source coefficients are absent.",
  "EARTH-THERM-005": "The EARTH free energy and chemical potential are absent.",
  "EARTH-THERM-008": "An EARTH mode spectrum and volume dependence are absent.",
  "EARTH-THERM-009": "The EARTH matter-radiation coupling and damped mode spectrum are absent.",
  "EARTH-THERM-010": "The EARTH microscopic currents or mode lifetimes are absent.",
};

function kernel<Id extends ChemistryComparatorId, Output>(
  label: Id,
  method: string,
  usedDefaultBenchmark: boolean,
  output: Output,
): LabeledChemistryComparatorResult<Id, Output> {
  return {
    label,
    method,
    diagnostics: {
      provenanceKind: "comparison",
      benchmarkLabel: usedDefaultBenchmark ? "conventional-normalized-benchmark" : "user-input",
      blockerRetained: true,
      blocker: BLOCKERS[label],
      sourceContractAvailable: false,
      earthMaterialLawUsed: false,
      earthValidationClaim: false,
      validatesTheory: false,
      validationClaim: "none",
      deterministic: true,
    },
    output,
  };
}

function bounded(value: number, name: string, minimum: number, maximum: number): number {
  finiteNumber(value, name);
  if (value < minimum || value > maximum) throw new RangeError(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

function positive(value: number, name: string, maximum = 1e100): number {
  return bounded(value, name, Number.MIN_VALUE, maximum);
}

function checkedArray<T>(values: readonly T[], name: string, minimum = 1, maximum = 256): readonly T[] {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return values;
}

function checkedLabel(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 128) {
    throw new RangeError(`${name} must contain 1 to 128 characters`);
  }
  return value.trim();
}

function normalizeVector(vector: readonly number[], name: string): number[] {
  if (vector.length !== 3) throw new RangeError(`${name} must contain 3 components`);
  const checked = vector.map((value, index) => bounded(value, `${name}[${index}]`, -1e100, 1e100));
  const norm = Math.hypot(...checked);
  if (!(norm > 1e-15) || !Number.isFinite(norm)) throw new RangeError(`${name} must have finite non-zero norm`);
  return checked.map((value) => value / norm);
}

function checkedSymmetricMatrix(matrix: readonly (readonly number[])[], name: string, maximumSize = 32): number[][] {
  checkedArray(matrix, name, 1, maximumSize);
  const size = matrix.length;
  const checked = matrix.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== size) throw new RangeError(`${name} must be square`);
    return row.map((value, columnIndex) => bounded(value, `${name}[${rowIndex}][${columnIndex}]`, -1e100, 1e100));
  });
  for (let row = 0; row < size; row += 1) {
    for (let column = row + 1; column < size; column += 1) {
      const scale = Math.max(1, Math.abs(checked[row]![column]!), Math.abs(checked[column]![row]!));
      if (Math.abs(checked[row]![column]! - checked[column]![row]!) > 1e-12 * scale) {
        throw new RangeError(`${name} must be symmetric`);
      }
      const average = (checked[row]![column]! + checked[column]![row]!) / 2;
      checked[row]![column] = average;
      checked[column]![row] = average;
    }
  }
  return checked;
}

function symmetricEigenproblem(matrix: readonly (readonly number[])[]): { eigenvalues: number[]; eigenvectors: number[][]; maximumResidual: number } {
  const size = matrix.length;
  const original = matrix.map((row) => [...row]);
  const diagonalized = matrix.map((row) => [...row]);
  const vectors: number[][] = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? 1 : 0));
  const scale = Math.max(1, ...diagonalized.flat().map(Math.abs));
  const tolerance = 1e-14 * scale;
  for (let iteration = 0; iteration < 64 * size * size; iteration += 1) {
    let pivotRow = 0;
    let pivotColumn = Math.min(1, size - 1);
    let largest = 0;
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const magnitude = Math.abs(diagonalized[row]![column]!);
        if (magnitude > largest) {
          largest = magnitude;
          pivotRow = row;
          pivotColumn = column;
        }
      }
    }
    if (largest <= tolerance || size === 1) break;
    const app = diagonalized[pivotRow]![pivotRow]!;
    const aqq = diagonalized[pivotColumn]![pivotColumn]!;
    const apq = diagonalized[pivotRow]![pivotColumn]!;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < size; index += 1) {
      if (index === pivotRow || index === pivotColumn) continue;
      const aip = diagonalized[index]![pivotRow]!;
      const aiq = diagonalized[index]![pivotColumn]!;
      diagonalized[index]![pivotRow] = cosine * aip - sine * aiq;
      diagonalized[pivotRow]![index] = diagonalized[index]![pivotRow]!;
      diagonalized[index]![pivotColumn] = sine * aip + cosine * aiq;
      diagonalized[pivotColumn]![index] = diagonalized[index]![pivotColumn]!;
    }
    diagonalized[pivotRow]![pivotRow] = cosine ** 2 * app - 2 * sine * cosine * apq + sine ** 2 * aqq;
    diagonalized[pivotColumn]![pivotColumn] = sine ** 2 * app + 2 * sine * cosine * apq + cosine ** 2 * aqq;
    diagonalized[pivotRow]![pivotColumn] = 0;
    diagonalized[pivotColumn]![pivotRow] = 0;
    for (let row = 0; row < size; row += 1) {
      const vip = vectors[row]![pivotRow]!;
      const viq = vectors[row]![pivotColumn]!;
      vectors[row]![pivotRow] = cosine * vip - sine * viq;
      vectors[row]![pivotColumn] = sine * vip + cosine * viq;
    }
  }
  const order = Array.from({ length: size }, (_, index) => index)
    .sort((left, right) => diagonalized[left]![left]! - diagonalized[right]![right]!);
  const eigenvalues = order.map((index) => diagonalized[index]![index]!);
  const eigenvectors = order.map((column) => vectors.map((row) => row[column]!));
  let maximumResidual = 0;
  for (let mode = 0; mode < size; mode += 1) {
    const vector = eigenvectors[mode]!;
    const eigenvalue = eigenvalues[mode]!;
    for (let row = 0; row < size; row += 1) {
      const product = original[row]!.reduce((sum, value, column) => sum + value * vector[column]!, 0);
      maximumResidual = Math.max(maximumResidual, Math.abs(product - eigenvalue * vector[row]!));
    }
  }
  return { eigenvalues, eigenvectors, maximumResidual };
}

export interface BondResidualRow {
  id: string;
  observedLength: number;
  predictedLength: number;
  observedEnergy?: number;
  predictedEnergy?: number;
}

export interface BondResidualInputs { rows?: readonly BondResidualRow[] }

export const DEFAULT_BOND_RESIDUAL_INPUTS: BondResidualInputs = Object.freeze({
  rows: [{ id: "normalized-single-bond", observedLength: 1, predictedLength: 1.02, observedEnergy: 1, predictedEnergy: 0.95 }],
});

export function bondResidualComparator(inputs?: BondResidualInputs) {
  const rows = checkedArray(inputs?.rows ?? DEFAULT_BOND_RESIDUAL_INPUTS.rows!, "rows", 1, 512).map((row, index) => {
    const id = checkedLabel(row.id, `rows[${index}].id`);
    const observedLength = positive(row.observedLength, `rows[${index}].observedLength`, 1e12);
    const predictedLength = positive(row.predictedLength, `rows[${index}].predictedLength`, 1e12);
    const lengthResidual = predictedLength - observedLength;
    if ((row.observedEnergy === undefined) !== (row.predictedEnergy === undefined)) {
      throw new RangeError(`rows[${index}] must provide both observedEnergy and predictedEnergy`);
    }
    const observedEnergy = row.observedEnergy === undefined ? null : positive(row.observedEnergy, `rows[${index}].observedEnergy`);
    const predictedEnergy = row.predictedEnergy === undefined ? null : positive(row.predictedEnergy, `rows[${index}].predictedEnergy`);
    return {
      id,
      observedLength,
      predictedLength,
      lengthResidual,
      lengthRelativeResidual: lengthResidual / observedLength,
      observedEnergy,
      predictedEnergy,
      energyResidual: observedEnergy === null || predictedEnergy === null ? null : predictedEnergy - observedEnergy,
    };
  });
  const rmsLengthResidual = Math.sqrt(rows.reduce((sum, row) => sum + row.lengthResidual ** 2, 0) / rows.length);
  return kernel("EARTH-CHEM-003", "User-supplied bond length and optional energy residual table", inputs === undefined, { rows, rmsLengthResidual });
}

export interface GeometryResidualRow { id: string; observedAnglesDegrees: readonly number[]; predictedAnglesDegrees: readonly number[] }
export interface GeometryResidualInputs { rows?: readonly GeometryResidualRow[] }
export const DEFAULT_GEOMETRY_RESIDUAL_INPUTS: GeometryResidualInputs = Object.freeze({
  rows: [{ id: "normalized-tetrahedral", observedAnglesDegrees: [109.5, 109.5], predictedAnglesDegrees: [109.471220634, 109.471220634] }],
});

export function geometryResidualComparator(inputs?: GeometryResidualInputs) {
  const rows = checkedArray(inputs?.rows ?? DEFAULT_GEOMETRY_RESIDUAL_INPUTS.rows!, "rows", 1, 256).map((row, rowIndex) => {
    checkedArray(row.observedAnglesDegrees, `rows[${rowIndex}].observedAnglesDegrees`, 1, 128);
    if (row.predictedAnglesDegrees.length !== row.observedAnglesDegrees.length) throw new RangeError(`rows[${rowIndex}] angle arrays must have equal lengths`);
    const residualsDegrees = row.observedAnglesDegrees.map((observed, angleIndex) => {
      const checkedObserved = bounded(observed, `rows[${rowIndex}].observedAnglesDegrees[${angleIndex}]`, 0, 180);
      const predicted = bounded(row.predictedAnglesDegrees[angleIndex]!, `rows[${rowIndex}].predictedAnglesDegrees[${angleIndex}]`, 0, 180);
      return predicted - checkedObserved;
    });
    return {
      id: checkedLabel(row.id, `rows[${rowIndex}].id`),
      residualsDegrees,
      meanAbsoluteResidualDegrees: residualsDegrees.reduce((sum, value) => sum + Math.abs(value), 0) / residualsDegrees.length,
      maximumAbsoluteResidualDegrees: Math.max(...residualsDegrees.map(Math.abs)),
    };
  });
  const residuals = rows.flatMap(({ residualsDegrees }) => residualsDegrees);
  return kernel("EARTH-CHEM-005", "Direct angle residuals for user-supplied molecular geometries", inputs === undefined, {
    rows,
    rmsAngleResidualDegrees: Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length),
  });
}

export interface WeightedSphericalInputs { vectors?: readonly (readonly number[])[]; weights?: readonly number[] }
export const DEFAULT_WEIGHTED_SPHERICAL_INPUTS: WeightedSphericalInputs = Object.freeze({
  vectors: [[1, 0, 0], [-1, 0, 0], [0, 1, 0]],
  weights: [1, 1, 1],
});

export function weightedSphericalObjective(inputs?: WeightedSphericalInputs) {
  const rawVectors = inputs?.vectors ?? DEFAULT_WEIGHTED_SPHERICAL_INPUTS.vectors!;
  checkedArray(rawVectors, "vectors", 2, 64);
  const vectors = rawVectors.map((vector, index) => normalizeVector(vector, `vectors[${index}]`) as Vector3);
  const rawWeights = inputs?.weights ?? Array.from({ length: vectors.length }, () => 1);
  if (rawWeights.length !== vectors.length) throw new RangeError("weights and vectors must have equal lengths");
  const weights = rawWeights.map((weight, index) => positive(weight, `weights[${index}]`, 1e12));
  const pairs: Array<{ left: number; right: number; cosine: number; angleRadians: number; contribution: number }> = [];
  for (let left = 0; left < vectors.length; left += 1) {
    for (let right = left + 1; right < vectors.length; right += 1) {
      const cosine = Math.max(-1, Math.min(1, vectors[left]!.reduce((sum, value, coordinate) => sum + value * vectors[right]![coordinate]!, 0)));
      const denominator = 1 - cosine;
      if (denominator < 1e-12) throw new RangeError("vectors must not contain coincident directions");
      pairs.push({ left, right, cosine, angleRadians: Math.acos(cosine), contribution: 2 * weights[left]! * weights[right]! / denominator });
    }
  }
  return kernel("EARTH-CHEM-006", "Bounded evaluation of sum w_i*w_j/sin^2(theta_ij/2) on supplied unit directions", inputs === undefined, {
    vectors,
    weights,
    pairs,
    objective: pairs.reduce((sum, pair) => sum + pair.contribution, 0),
  });
}

export interface ShellHamiltonianInputs { matrix?: readonly (readonly number[])[] }
export const DEFAULT_SHELL_HAMILTONIAN_INPUTS: ShellHamiltonianInputs = Object.freeze({ matrix: [[0, -1, 0], [-1, 0, -1], [0, -1, 0]] });

export function shellHamiltonianEigenvalues(inputs?: ShellHamiltonianInputs) {
  const matrix = checkedSymmetricMatrix(inputs?.matrix ?? DEFAULT_SHELL_HAMILTONIAN_INPUTS.matrix!, "matrix", 32);
  const spectrum = symmetricEigenproblem(matrix);
  return kernel("EARTH-CHEM-008", "Small symmetric Jacobi eigensolver for a user-supplied finite shell Hamiltonian", inputs === undefined, { matrix, ...spectrum });
}

export interface PesStationaryInputs { coordinates?: readonly number[]; energies?: readonly number[] }
export const DEFAULT_PES_STATIONARY_INPUTS: PesStationaryInputs = Object.freeze({ coordinates: [-2, -1, 0, 1, 2], energies: [9, 0, 1, 0, 9] });

export function pesStationaryBarrierAudit(inputs?: PesStationaryInputs) {
  const coordinates = [...(inputs?.coordinates ?? DEFAULT_PES_STATIONARY_INPUTS.coordinates!)];
  const energies = [...(inputs?.energies ?? DEFAULT_PES_STATIONARY_INPUTS.energies!)];
  checkedArray(coordinates, "coordinates", 3, 4096);
  if (energies.length !== coordinates.length) throw new RangeError("coordinates and energies must have equal lengths");
  coordinates.forEach((value, index) => bounded(value, `coordinates[${index}]`, -1e12, 1e12));
  energies.forEach((value, index) => bounded(value, `energies[${index}]`, -1e100, 1e100));
  for (let index = 1; index < coordinates.length; index += 1) {
    if (coordinates[index]! <= coordinates[index - 1]!) throw new RangeError("coordinates must be strictly increasing");
  }
  const stationary: Array<{ index: number; coordinate: number; energy: number; kind: "minimum" | "maximum"; leftSlope: number; rightSlope: number }> = [];
  for (let index = 1; index + 1 < coordinates.length; index += 1) {
    const leftSlope = (energies[index]! - energies[index - 1]!) / (coordinates[index]! - coordinates[index - 1]!);
    const rightSlope = (energies[index + 1]! - energies[index]!) / (coordinates[index + 1]! - coordinates[index]!);
    if (leftSlope <= 0 && rightSlope >= 0) stationary.push({ index, coordinate: coordinates[index]!, energy: energies[index]!, kind: "minimum", leftSlope, rightSlope });
    else if (leftSlope >= 0 && rightSlope <= 0) stationary.push({ index, coordinate: coordinates[index]!, energy: energies[index]!, kind: "maximum", leftSlope, rightSlope });
  }
  const barriers = stationary.filter(({ kind }) => kind === "maximum").flatMap((maximum) => {
    const left = stationary.filter((point) => point.kind === "minimum" && point.index < maximum.index).at(-1);
    const right = stationary.find((point) => point.kind === "minimum" && point.index > maximum.index);
    return left && right ? [{ maximumIndex: maximum.index, leftMinimumIndex: left.index, rightMinimumIndex: right.index, forwardBarrier: maximum.energy - left.energy, reverseBarrier: maximum.energy - right.energy }] : [];
  });
  return kernel("EARTH-CHEM-009", "Finite-difference stationary-point and barrier audit on a supplied one-dimensional PES", inputs === undefined, { coordinates, energies, stationary, barriers });
}

export interface MassWeightedHessianInputs { hessian?: readonly (readonly number[])[]; masses?: readonly number[]; zeroTolerance?: number }
export const DEFAULT_MASS_WEIGHTED_HESSIAN_INPUTS: MassWeightedHessianInputs = Object.freeze({ hessian: [[1, -1], [-1, 1]], masses: [1, 1], zeroTolerance: 1e-10 });

export function massWeightedHessianModes(inputs?: MassWeightedHessianInputs) {
  const hessian = checkedSymmetricMatrix(inputs?.hessian ?? DEFAULT_MASS_WEIGHTED_HESSIAN_INPUTS.hessian!, "hessian", 32);
  const rawMasses = inputs?.masses ?? DEFAULT_MASS_WEIGHTED_HESSIAN_INPUTS.masses!;
  if (rawMasses.length !== hessian.length) throw new RangeError("masses length must equal Hessian dimension");
  const masses = rawMasses.map((mass, index) => positive(mass, `masses[${index}]`, 1e12));
  const zeroTolerance = bounded(inputs?.zeroTolerance ?? 1e-10, "zeroTolerance", 1e-15, 1e-2);
  const massWeightedHessian = hessian.map((row, rowIndex) => row.map((value, columnIndex) => value / Math.sqrt(masses[rowIndex]! * masses[columnIndex]!)));
  const spectrum = symmetricEigenproblem(massWeightedHessian);
  const modes = spectrum.eigenvalues.map((eigenvalue, index) => ({
    eigenvalue,
    eigenvector: spectrum.eigenvectors[index]!,
    angularFrequency: Math.sqrt(Math.abs(eigenvalue)),
    character: Math.abs(eigenvalue) <= zeroTolerance ? "zero" as const : eigenvalue < 0 ? "imaginary" as const : "vibrational" as const,
  }));
  return kernel("EARTH-SPEC-002", "Generalized vibrational eigenproblem via a mass-weighted symmetric Hessian and small Jacobi solver", inputs === undefined, { hessian, masses, massWeightedHessian, modes, maximumEigenResidual: spectrum.maximumResidual });
}

export interface SpectralDerivativeMode { id: string; frequency: number; dipoleDerivative: readonly number[]; polarizabilityDerivative: readonly number[] }
export interface SpectralDerivativeInputs { modes?: readonly SpectralDerivativeMode[] }
export const DEFAULT_SPECTRAL_DERIVATIVE_INPUTS: SpectralDerivativeInputs = Object.freeze({ modes: [{ id: "normalized-mode", frequency: 1, dipoleDerivative: [1, 0, 0], polarizabilityDerivative: [1, 1, 1, 0, 0, 0] }] });

export function spectralDerivativeIntensities(inputs?: SpectralDerivativeInputs) {
  const modes = checkedArray(inputs?.modes ?? DEFAULT_SPECTRAL_DERIVATIVE_INPUTS.modes!, "modes", 1, 512).map((mode, modeIndex) => {
    if (mode.dipoleDerivative.length !== 3) throw new RangeError(`modes[${modeIndex}].dipoleDerivative must contain 3 components`);
    if (mode.polarizabilityDerivative.length !== 6) throw new RangeError(`modes[${modeIndex}].polarizabilityDerivative must contain 6 Voigt components`);
    const dipoleDerivative = mode.dipoleDerivative.map((value, index) => bounded(value, `modes[${modeIndex}].dipoleDerivative[${index}]`, -1e50, 1e50));
    const polarizabilityDerivative = mode.polarizabilityDerivative.map((value, index) => bounded(value, `modes[${modeIndex}].polarizabilityDerivative[${index}]`, -1e50, 1e50));
    const [xx, yy, zz, xy, xz, yz] = polarizabilityDerivative as [number, number, number, number, number, number];
    const isotropic = (xx + yy + zz) / 3;
    const anisotropySquared = 0.5 * ((xx - yy) ** 2 + (yy - zz) ** 2 + (zz - xx) ** 2 + 6 * (xy ** 2 + xz ** 2 + yz ** 2));
    const depolarizationDenominator = 45 * isotropic ** 2 + 4 * anisotropySquared;
    return {
      id: checkedLabel(mode.id, `modes[${modeIndex}].id`),
      frequency: positive(mode.frequency, `modes[${modeIndex}].frequency`, 1e20),
      dipoleDerivative,
      polarizabilityDerivative,
      infraredIntensity: dipoleDerivative.reduce((sum, value) => sum + value ** 2, 0),
      ramanActivity: 45 * isotropic ** 2 + 7 * anisotropySquared,
      depolarizationRatio: depolarizationDenominator === 0 ? 0 : 3 * anisotropySquared / depolarizationDenominator,
    };
  });
  return kernel("EARTH-SPEC-003", "Standard double-harmonic intensities from user-supplied dipole and polarizability derivatives", inputs === undefined, { modes });
}

export interface TwoLevelSpectrumInputs { groundEnergy?: number; excitedEnergy?: number; transitionDipole?: number; linewidth?: number; samples?: number }
export const DEFAULT_TWO_LEVEL_SPECTRUM_INPUTS: TwoLevelSpectrumInputs = Object.freeze({ groundEnergy: 0, excitedEnergy: 1, transitionDipole: 1, linewidth: 0.05, samples: 65 });

export function twoLevelElectronicSpectrum(inputs?: TwoLevelSpectrumInputs) {
  const groundEnergy = bounded(inputs?.groundEnergy ?? 0, "groundEnergy", -1e12, 1e12);
  const excitedEnergy = bounded(inputs?.excitedEnergy ?? 1, "excitedEnergy", -1e12, 1e12);
  if (excitedEnergy <= groundEnergy) throw new RangeError("excitedEnergy must be greater than groundEnergy");
  const transitionDipole = bounded(inputs?.transitionDipole ?? 1, "transitionDipole", 0, 1e12);
  const linewidth = positive(inputs?.linewidth ?? 0.05, "linewidth", 1e6);
  const samples = boundedInteger(inputs?.samples ?? 65, "samples", 9, 4097);
  const excitationEnergy = excitedEnergy - groundEnergy;
  const oscillatorStrength = 2 / 3 * excitationEnergy * transitionDipole ** 2;
  const spectrum = Array.from({ length: samples }, (_, index) => {
    const energy = Math.max(0, excitationEnergy - 8 * linewidth) + (16 * linewidth) * index / (samples - 1);
    const absorption = oscillatorStrength * linewidth / Math.PI / ((energy - excitationEnergy) ** 2 + linewidth ** 2);
    return { energy, absorption };
  });
  return kernel("EARTH-SPEC-004", "Conventional two-level transition with a normalized Lorentzian line shape", inputs === undefined, { groundEnergy, excitedEnergy, excitationEnergy, transitionDipole, oscillatorStrength, linewidth, spectrum });
}

export interface TwoSpinNmrInputs { frequencyA?: number; frequencyB?: number; scalarCoupling?: number }
export const DEFAULT_TWO_SPIN_NMR_INPUTS: TwoSpinNmrInputs = Object.freeze({ frequencyA: 100, frequencyB: 120, scalarCoupling: 10 });

export function twoSpinNmrSpectrum(inputs?: TwoSpinNmrInputs) {
  const frequencyA = positive(inputs?.frequencyA ?? 100, "frequencyA", 1e12);
  const frequencyB = positive(inputs?.frequencyB ?? 120, "frequencyB", 1e12);
  const scalarCoupling = bounded(inputs?.scalarCoupling ?? 10, "scalarCoupling", -1e9, 1e9);
  const halfCoupling = scalarCoupling / 2;
  const lines = [
    { spin: "A" as const, frequency: frequencyA - halfCoupling, relativeIntensity: 0.5 },
    { spin: "A" as const, frequency: frequencyA + halfCoupling, relativeIntensity: 0.5 },
    { spin: "B" as const, frequency: frequencyB - halfCoupling, relativeIntensity: 0.5 },
    { spin: "B" as const, frequency: frequencyB + halfCoupling, relativeIntensity: 0.5 },
  ].sort((left, right) => left.frequency - right.frequency);
  if (lines[0]!.frequency < 0) throw new RangeError("scalarCoupling produces a negative transition frequency");
  return kernel("EARTH-SPEC-005", "First-order two-spin-1/2 scalar-coupling comparator", inputs === undefined, { frequencyA, frequencyB, scalarCoupling, weakCouplingRatio: scalarCoupling === 0 ? null : Math.abs(frequencyA - frequencyB) / Math.abs(scalarCoupling), lines });
}

export interface CoreLevelTransition { id: string; coreEnergy: number; finalEnergy: number; matrixElement: number }
export interface CoreLevelInputs { transitions?: readonly CoreLevelTransition[] }
export const DEFAULT_CORE_LEVEL_INPUTS: CoreLevelInputs = Object.freeze({ transitions: [{ id: "normalized-edge", coreEnergy: -1, finalEnergy: 0, matrixElement: 1 }] });

export function coreLevelTransitionSpectrum(inputs?: CoreLevelInputs) {
  const transitions = checkedArray(inputs?.transitions ?? DEFAULT_CORE_LEVEL_INPUTS.transitions!, "transitions", 1, 512).map((transition, index) => {
    const coreEnergy = bounded(transition.coreEnergy, `transitions[${index}].coreEnergy`, -1e12, 1e12);
    const finalEnergy = bounded(transition.finalEnergy, `transitions[${index}].finalEnergy`, -1e12, 1e12);
    const energy = finalEnergy - coreEnergy;
    if (!(energy > 0)) throw new RangeError(`transitions[${index}] finalEnergy must exceed coreEnergy`);
    const matrixElement = bounded(transition.matrixElement, `transitions[${index}].matrixElement`, 0, 1e12);
    return { id: checkedLabel(transition.id, `transitions[${index}].id`), coreEnergy, finalEnergy, energy, matrixElement, relativeIntensity: energy * matrixElement ** 2 };
  });
  return kernel("EARTH-SPEC-006", "Independent-particle core-to-final transition energies and supplied matrix-element strengths", inputs === undefined, { transitions });
}

export interface CrystalPhononInputs { mass?: number; springConstant?: number; latticeSpacing?: number; waveVectorSamples?: number }
export const DEFAULT_CRYSTAL_PHONON_INPUTS: CrystalPhononInputs = Object.freeze({ mass: 1, springConstant: 1, latticeSpacing: 1, waveVectorSamples: 65 });

export function crystalPhonon1d(inputs?: CrystalPhononInputs) {
  const mass = positive(inputs?.mass ?? 1, "mass", 1e50);
  const springConstant = positive(inputs?.springConstant ?? 1, "springConstant", 1e50);
  const latticeSpacing = positive(inputs?.latticeSpacing ?? 1, "latticeSpacing", 1e12);
  const waveVectorSamples = boundedInteger(inputs?.waveVectorSamples ?? 65, "waveVectorSamples", 3, 4097);
  const maximumWaveVector = Math.PI / latticeSpacing;
  const dispersion = Array.from({ length: waveVectorSamples }, (_, index) => {
    const waveVector = -maximumWaveVector + 2 * maximumWaveVector * index / (waveVectorSamples - 1);
    return { waveVector, angularFrequency: 2 * Math.sqrt(springConstant / mass) * Math.abs(Math.sin(waveVector * latticeSpacing / 2)) };
  });
  return kernel("EARTH-MAT-001", "Monatomic nearest-neighbor one-dimensional crystal-chain phonon benchmark", inputs === undefined, {
    mass,
    springConstant,
    latticeSpacing,
    acousticVelocity: latticeSpacing * Math.sqrt(springConstant / mass),
    dispersion,
  });
}

export interface ChristoffelInputs { density?: number; direction?: readonly number[]; lambda?: number; shearModulus?: number; tensor?: readonly (readonly (readonly (readonly number[])[])[])[] }
export const DEFAULT_CHRISTOFFEL_INPUTS: ChristoffelInputs = Object.freeze({ density: 1, direction: [1, 0, 0], lambda: 1, shearModulus: 1 });

function isotropicTensor(lambda: number, shearModulus: number): number[][][][] {
  return Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => Array.from({ length: 3 }, (_, k) => Array.from({ length: 3 }, (_, l) =>
    lambda * Number(i === j) * Number(k === l) + shearModulus * (Number(i === k) * Number(j === l) + Number(i === l) * Number(j === k)),
  ))));
}

function checkedElasticTensor(raw: readonly (readonly (readonly (readonly number[])[])[])[]): number[][][][] {
  if (raw.length !== 3) throw new RangeError("tensor must have dimensions 3x3x3x3");
  const tensor = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => Array.from({ length: 3 }, (_, k) => Array.from({ length: 3 }, (_, l) => {
    const value = raw[i]?.[j]?.[k]?.[l];
    if (value === undefined) throw new RangeError("tensor must have dimensions 3x3x3x3");
    return bounded(value, `tensor[${i}][${j}][${k}][${l}]`, -1e30, 1e30);
  }))));
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) for (let k = 0; k < 3; k += 1) for (let l = 0; l < 3; l += 1) {
    const value = tensor[i]![j]![k]![l]!;
    const equivalents = [tensor[j]![i]![k]![l]!, tensor[i]![j]![l]![k]!, tensor[k]![l]![i]![j]!];
    if (equivalents.some((candidate) => Math.abs(candidate - value) > 1e-10 * Math.max(1, Math.abs(value), Math.abs(candidate)))) {
      throw new RangeError("tensor must satisfy minor and major elastic symmetries");
    }
  }
  return tensor;
}

export function christoffelWaveSolver(inputs?: ChristoffelInputs) {
  const density = positive(inputs?.density ?? 1, "density", 1e30);
  const direction = normalizeVector(inputs?.direction ?? [1, 0, 0], "direction") as Vector3;
  if (inputs?.tensor && (inputs.lambda !== undefined || inputs.shearModulus !== undefined)) throw new RangeError("provide tensor or isotropic lambda/shearModulus, not both");
  const model = inputs?.tensor ? "user-tensor" as const : "isotropic-standard-comparison" as const;
  const lambda = inputs?.tensor ? null : bounded(inputs?.lambda ?? 1, "lambda", -1e30, 1e30);
  const shearModulus = inputs?.tensor ? null : positive(inputs?.shearModulus ?? 1, "shearModulus", 1e30);
  if (lambda !== null && shearModulus !== null && lambda + 2 * shearModulus <= 0) throw new RangeError("lambda + 2*shearModulus must be positive");
  const tensor = inputs?.tensor ? checkedElasticTensor(inputs.tensor) : isotropicTensor(lambda!, shearModulus!);
  const christoffel = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, k) => {
    let value = 0;
    for (let j = 0; j < 3; j += 1) for (let l = 0; l < 3; l += 1) value += tensor[i]![j]![k]![l]! * direction[j]! * direction[l]! / density;
    return value;
  }));
  const spectrum = symmetricEigenproblem(checkedSymmetricMatrix(christoffel, "Christoffel matrix", 3));
  if (spectrum.eigenvalues.some((value) => value < -1e-12)) throw new RangeError("Christoffel matrix has a negative wave-speed eigenvalue");
  const modes = spectrum.eigenvalues.map((value, index) => ({ speed: Math.sqrt(Math.max(0, value)), polarization: spectrum.eigenvectors[index]! }));
  return kernel("EARTH-MAT-002", "Bounded Christoffel eigenproblem for an isotropic comparator or supplied elastic tensor", inputs === undefined, { model, density, direction, lambda, shearModulus, christoffel, modes, maximumEigenResidual: spectrum.maximumResidual });
}

export interface LorentzOscillator { resonance: number; strength: number; damping: number }
export interface LorentzDielectricInputs { frequencies?: readonly number[]; epsilonInfinity?: number; oscillators?: readonly LorentzOscillator[] }
export const DEFAULT_LORENTZ_DIELECTRIC_INPUTS: LorentzDielectricInputs = Object.freeze({ frequencies: [0, 0.5, 1, 2], epsilonInfinity: 1, oscillators: [{ resonance: 1, strength: 1, damping: 0.1 }] });

export function lorentzDielectricResponse(inputs?: LorentzDielectricInputs) {
  const frequencies = checkedArray(inputs?.frequencies ?? DEFAULT_LORENTZ_DIELECTRIC_INPUTS.frequencies!, "frequencies", 1, 4097).map((value, index) => bounded(value, `frequencies[${index}]`, 0, 1e20));
  const epsilonInfinity = bounded(inputs?.epsilonInfinity ?? 1, "epsilonInfinity", -1e12, 1e12);
  const oscillators = checkedArray(inputs?.oscillators ?? DEFAULT_LORENTZ_DIELECTRIC_INPUTS.oscillators!, "oscillators", 1, 128).map((oscillator, index) => ({
    resonance: positive(oscillator.resonance, `oscillators[${index}].resonance`, 1e20),
    strength: positive(oscillator.strength, `oscillators[${index}].strength`, 1e40),
    damping: positive(oscillator.damping, `oscillators[${index}].damping`, 1e20),
  }));
  const response = frequencies.map((frequency) => {
    let re = epsilonInfinity;
    let im = 0;
    for (const oscillator of oscillators) {
      const detuning = oscillator.resonance ** 2 - frequency ** 2;
      const loss = oscillator.damping * frequency;
      const denominator = detuning ** 2 + loss ** 2;
      re += oscillator.strength * detuning / denominator;
      im += oscillator.strength * loss / denominator;
    }
    return { frequency, epsilon: { re, im } };
  });
  return kernel("EARTH-MAT-003", "Causal Lorentz-oscillator dielectric standard comparison", inputs === undefined, { epsilonInfinity, oscillators, response });
}

export interface DielectricSample { frequency: number; epsilon: ComplexValue }
export interface RefractiveTransformInputs { samples?: readonly DielectricSample[]; speedOfLight?: number }
export const DEFAULT_REFRACTIVE_TRANSFORM_INPUTS: RefractiveTransformInputs = Object.freeze({ samples: [{ frequency: 1, epsilon: { re: 2.25, im: 0 } }], speedOfLight: SPEED_OF_LIGHT });

export function refractiveIndexTransform(inputs?: RefractiveTransformInputs) {
  const speedOfLight = positive(inputs?.speedOfLight ?? SPEED_OF_LIGHT, "speedOfLight", 1e12);
  const samples = checkedArray(inputs?.samples ?? DEFAULT_REFRACTIVE_TRANSFORM_INPUTS.samples!, "samples", 1, 4097).map((sample, index) => {
    const frequency = bounded(sample.frequency, `samples[${index}].frequency`, 0, 1e20);
    const re = bounded(sample.epsilon.re, `samples[${index}].epsilon.re`, -1e100, 1e100);
    const im = bounded(sample.epsilon.im, `samples[${index}].epsilon.im`, -1e100, 1e100);
    const magnitude = Math.hypot(re, im);
    const refractiveIndex = Math.sqrt(Math.max(0, (magnitude + re) / 2));
    const extinctionCoefficient = Math.sign(im || 1) * Math.sqrt(Math.max(0, (magnitude - re) / 2));
    return { frequency, epsilon: { re, im }, refractiveIndex, extinctionCoefficient, absorptionCoefficient: 2 * frequency * extinctionCoefficient / speedOfLight };
  });
  return kernel("EARTH-MAT-005", "Principal complex square-root transform from supplied dielectric response to n+i*kappa", inputs === undefined, { speedOfLight, samples });
}

export interface JonesMalusInputs { inputAngleRadians?: number; analyzerAngleRadians?: number; opticAxisRadians?: number; retardanceRadians?: number; inputIntensity?: number }
export const DEFAULT_JONES_MALUS_INPUTS: JonesMalusInputs = Object.freeze({ inputAngleRadians: 0, analyzerAngleRadians: Math.PI / 4, opticAxisRadians: 0, retardanceRadians: 0, inputIntensity: 1 });

function complexAdd(left: ComplexValue, right: ComplexValue): ComplexValue { return { re: left.re + right.re, im: left.im + right.im }; }
function complexScale(value: ComplexValue, scalar: number): ComplexValue { return { re: value.re * scalar, im: value.im * scalar }; }
function complexMagnitudeSquared(value: ComplexValue): number { return value.re ** 2 + value.im ** 2; }

export function jonesMalusComparator(inputs?: JonesMalusInputs) {
  const inputAngleRadians = bounded(inputs?.inputAngleRadians ?? 0, "inputAngleRadians", -2 * Math.PI, 2 * Math.PI);
  const analyzerAngleRadians = bounded(inputs?.analyzerAngleRadians ?? Math.PI / 4, "analyzerAngleRadians", -2 * Math.PI, 2 * Math.PI);
  const opticAxisRadians = bounded(inputs?.opticAxisRadians ?? 0, "opticAxisRadians", -2 * Math.PI, 2 * Math.PI);
  const retardanceRadians = bounded(inputs?.retardanceRadians ?? 0, "retardanceRadians", -64 * Math.PI, 64 * Math.PI);
  const inputIntensity = positive(inputs?.inputIntensity ?? 1, "inputIntensity", 1e100);
  const input = [Math.cos(inputAngleRadians), Math.sin(inputAngleRadians)];
  const axis = [Math.cos(opticAxisRadians), Math.sin(opticAxisRadians)];
  const perpendicular = [-axis[1]!, axis[0]!];
  const parallelProjection = input[0]! * axis[0]! + input[1]! * axis[1]!;
  const perpendicularProjection = input[0]! * perpendicular[0]! + input[1]! * perpendicular[1]!;
  const phaseFactor = { re: Math.cos(retardanceRadians), im: Math.sin(retardanceRadians) };
  const field: [ComplexValue, ComplexValue] = [0, 1].map((coordinate) => complexAdd(
    { re: parallelProjection * axis[coordinate]!, im: 0 },
    complexScale(phaseFactor, perpendicularProjection * perpendicular[coordinate]!),
  )) as [ComplexValue, ComplexValue];
  const analyzer = [Math.cos(analyzerAngleRadians), Math.sin(analyzerAngleRadians)];
  const transmittedAmplitude = complexAdd(complexScale(field[0], analyzer[0]!), complexScale(field[1], analyzer[1]!));
  const transmittedIntensity = inputIntensity * complexMagnitudeSquared(transmittedAmplitude);
  const malusIntensityWithoutRetarder = inputIntensity * Math.cos(analyzerAngleRadians - inputAngleRadians) ** 2;
  return kernel("EARTH-MAT-007", "Jones-vector retarder and linear-analyzer calculation beside the zero-retardance Malus comparator", inputs === undefined, { inputIntensity, field, transmittedAmplitude, transmittedIntensity, malusIntensityWithoutRetarder });
}

export interface NonlinearEstimateInputs { wavelength?: number; effectiveCoefficient?: number; length?: number; pumpIntensity?: number; fundamentalIndex?: number; harmonicIndex?: number; phaseMismatch?: number }
export const DEFAULT_NONLINEAR_ESTIMATE_INPUTS: NonlinearEstimateInputs = Object.freeze({ wavelength: 1.064e-6, effectiveCoefficient: 1e-12, length: 1e-3, pumpIntensity: 1e6, fundamentalIndex: 1.5, harmonicIndex: 1.6, phaseMismatch: 0 });

function sinc(value: number): number { return Math.abs(value) < 1e-8 ? 1 - value ** 2 / 6 : Math.sin(value) / value; }

export function undepletedPumpNonlinearEstimate(inputs?: NonlinearEstimateInputs) {
  const wavelength = positive(inputs?.wavelength ?? 1.064e-6, "wavelength", 1e3);
  const effectiveCoefficient = bounded(inputs?.effectiveCoefficient ?? 1e-12, "effectiveCoefficient", 0, 1);
  const length = positive(inputs?.length ?? 1e-3, "length", 1e6);
  const pumpIntensity = positive(inputs?.pumpIntensity ?? 1e6, "pumpIntensity", 1e30);
  const fundamentalIndex = positive(inputs?.fundamentalIndex ?? 1.5, "fundamentalIndex", 1e6);
  const harmonicIndex = positive(inputs?.harmonicIndex ?? 1.6, "harmonicIndex", 1e6);
  const phaseMismatch = bounded(inputs?.phaseMismatch ?? 0, "phaseMismatch", -1e15, 1e15);
  const angularFrequency = 2 * Math.PI * SPEED_OF_LIGHT / wavelength;
  const phaseMatchingFactor = sinc(phaseMismatch * length / 2) ** 2;
  const conversionEfficiency = 2 * angularFrequency ** 2 * effectiveCoefficient ** 2 * length ** 2 * pumpIntensity
    / (VACUUM_PERMITTIVITY * SPEED_OF_LIGHT ** 3 * fundamentalIndex ** 2 * harmonicIndex) * phaseMatchingFactor;
  return kernel("EARTH-MAT-008", "Plane-wave undepleted-pump second-harmonic estimate with supplied chi(2), indices, and phase mismatch", inputs === undefined, { angularFrequency, phaseMatchingFactor, conversionEfficiency, harmonicIntensity: conversionEfficiency * pumpIntensity, approximation: "undepleted-pump" });
}

export interface HopfTextureInputs { gridPoints?: number; extent?: number }
export const DEFAULT_HOPF_TEXTURE_INPUTS: HopfTextureInputs = Object.freeze({ gridPoints: 7, extent: 3 });

export function canonicalHopfTextureDiagnostic(inputs?: HopfTextureInputs) {
  const gridPoints = boundedInteger(inputs?.gridPoints ?? 7, "gridPoints", 3, 33);
  const extent = positive(inputs?.extent ?? 3, "extent", 1e3);
  const samples: Array<{ position: Vector3; magnetization: Vector3; normResidual: number }> = [];
  let maximumNormResidual = 0;
  for (let ix = 0; ix < gridPoints; ix += 1) for (let iy = 0; iy < gridPoints; iy += 1) for (let iz = 0; iz < gridPoints; iz += 1) {
    const x = -extent + 2 * extent * ix / (gridPoints - 1);
    const y = -extent + 2 * extent * iy / (gridPoints - 1);
    const z = -extent + 2 * extent * iz / (gridPoints - 1);
    const radiusSquared = x ** 2 + y ** 2 + z ** 2;
    const denominator = radiusSquared + 1;
    const z1 = { re: 2 * x / denominator, im: 2 * y / denominator };
    const z2 = { re: 2 * z / denominator, im: (radiusSquared - 1) / denominator };
    const product = { re: z1.re * z2.re + z1.im * z2.im, im: z1.im * z2.re - z1.re * z2.im };
    const magnetization: Vector3 = [2 * product.re, 2 * product.im, complexMagnitudeSquared(z1) - complexMagnitudeSquared(z2)];
    const normResidual = Math.abs(Math.hypot(...magnetization) - 1);
    maximumNormResidual = Math.max(maximumNormResidual, normResidual);
    samples.push({ position: [x, y, z], magnetization, normResidual });
  }
  return kernel("EARTH-MAT-009", "Canonical stereographic Hopf-map texture sampled only as an analytic normalization diagnostic", inputs === undefined, { gridPoints, extent, samples, maximumNormResidual, canonicalAnalyticHopfIndex: 1, relaxedMicromagneticState: false, stabilityTested: false });
}

export interface TransitionTemperatureRow { id: string; observedTemperature: number; predictedTemperature: number; assignmentFrozen?: boolean }
export interface TransitionTemperatureInputs { rows?: readonly TransitionTemperatureRow[] }
export const DEFAULT_TRANSITION_TEMPERATURE_INPUTS: TransitionTemperatureInputs = Object.freeze({ rows: [{ id: "normalized-transition", observedTemperature: 1, predictedTemperature: 1.05, assignmentFrozen: true }] });

export function transitionTemperatureResidualComparator(inputs?: TransitionTemperatureInputs) {
  const rows = checkedArray(inputs?.rows ?? DEFAULT_TRANSITION_TEMPERATURE_INPUTS.rows!, "rows", 1, 1024).map((row, index) => {
    const observedTemperature = positive(row.observedTemperature, `rows[${index}].observedTemperature`, 1e12);
    const predictedTemperature = positive(row.predictedTemperature, `rows[${index}].predictedTemperature`, 1e12);
    const residual = predictedTemperature - observedTemperature;
    return { id: checkedLabel(row.id, `rows[${index}].id`), observedTemperature, predictedTemperature, residual, relativeResidual: residual / observedTemperature, assignmentFrozen: row.assignmentFrozen ?? false };
  });
  return kernel("EARTH-THERM-002", "User-supplied transition-temperature residual table with explicit assignment-freeze flags", inputs === undefined, { rows, allAssignmentsFrozen: rows.every(({ assignmentFrozen }) => assignmentFrozen), rmsResidual: Math.sqrt(rows.reduce((sum, row) => sum + row.residual ** 2, 0) / rows.length) });
}

export interface EosComparisonInputs { temperature?: number; volume?: number; particles?: number; gasConstant?: number; attraction?: number; excludedVolume?: number }
export const DEFAULT_EOS_COMPARISON_INPUTS: EosComparisonInputs = Object.freeze({ temperature: 1, volume: 3, particles: 1, gasConstant: 1, attraction: 1, excludedVolume: 0.1 });

export function eosStandardComparison(inputs?: EosComparisonInputs) {
  const temperature = positive(inputs?.temperature ?? 1, "temperature", 1e12);
  const volume = positive(inputs?.volume ?? 3, "volume", 1e12);
  const particles = positive(inputs?.particles ?? 1, "particles", 1e12);
  const gasConstant = positive(inputs?.gasConstant ?? 1, "gasConstant", 1e12);
  const attraction = bounded(inputs?.attraction ?? 1, "attraction", 0, 1e24);
  const excludedVolume = bounded(inputs?.excludedVolume ?? 0.1, "excludedVolume", 0, 1e12);
  if (volume <= particles * excludedVolume) throw new RangeError("volume must exceed particles*excludedVolume");
  const idealPressure = particles * gasConstant * temperature / volume;
  const vanDerWaalsPressure = particles * gasConstant * temperature / (volume - particles * excludedVolume) - attraction * particles ** 2 / volume ** 2;
  return kernel("EARTH-THERM-004", "Clearly labeled ideal-gas and van der Waals EOS comparison; not IAPWS-95 or Span-Wagner", inputs === undefined, {
    modelLabels: { ideal: "ideal-gas-standard-comparison", nonIdeal: "van-der-Waals-standard-comparison" },
    temperature,
    volume,
    particles,
    idealPressure,
    vanDerWaalsPressure,
    pressureDifference: vanDerWaalsPressure - idealPressure,
    authenticatedWaterOrCo2Eos: false,
  });
}

export interface VanDerWaalsCoexistenceInputs { reducedTemperature?: number }
export const DEFAULT_VAN_DER_WAALS_COEXISTENCE_INPUTS: VanDerWaalsCoexistenceInputs = Object.freeze({ reducedTemperature: 0.85 });

function reducedPressure(temperature: number, volume: number): number { return 8 * temperature / (3 * volume - 1) - 3 / volume ** 2; }

function bisectRoot(functionValue: (value: number) => number, lower: number, upper: number): number {
  let lowerValue = functionValue(lower);
  let upperValue = functionValue(upper);
  if (lowerValue === 0) return lower;
  if (upperValue === 0) return upper;
  if (lowerValue * upperValue > 0) throw new RangeError("bounded root is not bracketed");
  for (let iteration = 0; iteration < 128; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    const midpointValue = functionValue(midpoint);
    if (lowerValue * midpointValue <= 0) {
      upper = midpoint;
      upperValue = midpointValue;
    } else {
      lower = midpoint;
      lowerValue = midpointValue;
    }
  }
  return (lower + upper) / 2;
}

function spinodalVolumes(temperature: number): [number, number] {
  const derivative = (volume: number) => -24 * temperature / (3 * volume - 1) ** 2 + 6 / volume ** 3;
  const roots: number[] = [];
  let previousVolume = 1 / 3 + 1e-6;
  let previousValue = derivative(previousVolume);
  for (let index = 1; index <= 20_000 && roots.length < 2; index += 1) {
    const volume = 1 / 3 + 1e-6 + (20 - 1 / 3 - 1e-6) * index / 20_000;
    const value = derivative(volume);
    if (value * previousValue < 0) roots.push(bisectRoot(derivative, previousVolume, volume));
    previousVolume = volume;
    previousValue = value;
  }
  if (roots.length !== 2) throw new RangeError("reducedTemperature did not produce two bounded spinodal roots");
  return [roots[0]!, roots[1]!];
}

function coexistenceVolumes(temperature: number, pressure: number, spinodals: [number, number]): [number, number, number] {
  const residual = (volume: number) => reducedPressure(temperature, volume) - pressure;
  let gasUpper = Math.max(4, 2 * spinodals[1], 16 * temperature / (3 * pressure));
  while (residual(gasUpper) > 0 && gasUpper < 1e100) gasUpper *= 2;
  return [
    bisectRoot(residual, 1 / 3 + 1e-10, spinodals[0]),
    bisectRoot(residual, spinodals[0], spinodals[1]),
    bisectRoot(residual, spinodals[1], gasUpper),
  ];
}

export function vanDerWaalsCoexistenceComparator(inputs?: VanDerWaalsCoexistenceInputs) {
  const reducedTemperature = bounded(inputs?.reducedTemperature ?? 0.85, "reducedTemperature", 0.5, 0.999);
  const spinodals = spinodalVolumes(reducedTemperature);
  const lowerPressure = Math.max(1e-12, reducedPressure(reducedTemperature, spinodals[0]));
  const upperPressure = reducedPressure(reducedTemperature, spinodals[1]);
  const area = (pressure: number) => {
    const [liquidVolume, , vaporVolume] = coexistenceVolumes(reducedTemperature, pressure, spinodals);
    return 8 * reducedTemperature / 3 * Math.log((3 * vaporVolume - 1) / (3 * liquidVolume - 1))
      + 3 / vaporVolume - 3 / liquidVolume - pressure * (vaporVolume - liquidVolume);
  };
  const saturationPressure = bisectRoot(area, lowerPressure, upperPressure);
  const [liquidVolume, unstableVolume, vaporVolume] = coexistenceVolumes(reducedTemperature, saturationPressure, spinodals);
  return kernel("EARTH-THERM-005", "Reduced van der Waals Maxwell equal-area coexistence comparator", inputs === undefined, {
    modelLabel: "van-der-Waals-standard-comparison-not-EARTH-derived",
    reducedTemperature,
    saturationPressure,
    liquidVolume,
    unstableVolume,
    vaporVolume,
    spinodalVolumes: spinodals,
    equalAreaResidual: area(saturationPressure),
    earthChemicalPotentialUsed: false,
  });
}

export interface OscillatorMode { frequencyHz: number; degeneracy?: number }
export interface OscillatorThermodynamicsInputs { temperature?: number; modes?: readonly OscillatorMode[] }
export const DEFAULT_OSCILLATOR_THERMODYNAMICS_INPUTS: OscillatorThermodynamicsInputs = Object.freeze({ temperature: 300, modes: [{ frequencyHz: 1e12, degeneracy: 1 }] });

export function oscillatorThermodynamics(inputs?: OscillatorThermodynamicsInputs) {
  const temperature = positive(inputs?.temperature ?? 300, "temperature", 1e9);
  const modes = checkedArray(inputs?.modes ?? DEFAULT_OSCILLATOR_THERMODYNAMICS_INPUTS.modes!, "modes", 1, 1024).map((mode, index) => {
    const frequencyHz = bounded(mode.frequencyHz, `modes[${index}].frequencyHz`, 1e-12, 1e20);
    const degeneracy = boundedInteger(mode.degeneracy ?? 1, `modes[${index}].degeneracy`, 1, 1_000_000);
    const x = PLANCK_CONSTANT * frequencyHz / (BOLTZMANN_CONSTANT * temperature);
    const thermalFactor = Math.exp(-x);
    const oneMinusThermalFactor = -Math.expm1(-x);
    const logPartitionFunction = degeneracy * (-x / 2 - Math.log(oneMinusThermalFactor));
    const meanEnergy = degeneracy * PLANCK_CONSTANT * frequencyHz * (0.5 + thermalFactor / oneMinusThermalFactor);
    const heatCapacity = degeneracy * BOLTZMANN_CONSTANT * x ** 2 * thermalFactor / oneMinusThermalFactor ** 2;
    return { frequencyHz, degeneracy, x, logPartitionFunction, partitionFunction: Math.exp(logPartitionFunction), meanEnergy, heatCapacity };
  });
  const logPartitionFunction = modes.reduce((sum, mode) => sum + mode.logPartitionFunction, 0);
  return kernel("EARTH-THERM-008", "Canonical independent quantum-harmonic-oscillator partition and constant-volume heat-capacity comparator", inputs === undefined, { temperature, modes, logPartitionFunction, partitionFunction: Math.exp(logPartitionFunction), helmholtzFreeEnergy: -BOLTZMANN_CONSTANT * temperature * logPartitionFunction, meanEnergy: modes.reduce((sum, mode) => sum + mode.meanEnergy, 0), heatCapacity: modes.reduce((sum, mode) => sum + mode.heatCapacity, 0), constantPressureHeatCapacityAvailable: false, latentHeatAvailable: false });
}

export interface PlanckSpectrumInputs { temperature?: number; frequencies?: readonly number[] }
export const DEFAULT_PLANCK_SPECTRUM_INPUTS: PlanckSpectrumInputs = Object.freeze({ temperature: 300, frequencies: [1e11, 1e12, 1e13, 1e14] });

export function planckSpectrumComparator(inputs?: PlanckSpectrumInputs) {
  const temperature = positive(inputs?.temperature ?? 300, "temperature", 1e9);
  const frequencies = checkedArray(inputs?.frequencies ?? DEFAULT_PLANCK_SPECTRUM_INPUTS.frequencies!, "frequencies", 1, 4097).map((frequency, index) => bounded(frequency, `frequencies[${index}]`, 1e-12, 1e20));
  const spectrum = frequencies.map((frequency) => {
    const exponent = PLANCK_CONSTANT * frequency / (BOLTZMANN_CONSTANT * temperature);
    const denominator = Math.expm1(exponent);
    return { frequency, exponent, occupation: denominator === Infinity ? 0 : 1 / denominator, spectralRadiance: denominator === Infinity ? 0 : 2 * PLANCK_CONSTANT * frequency ** 3 / SPEED_OF_LIGHT ** 2 / denominator };
  });
  return kernel("EARTH-THERM-009", "Planck blackbody frequency spectrum used only as a standard radiative comparator", inputs === undefined, { temperature, spectrum, frequencyPeakHz: 2.821_439_372_122_078_7 * BOLTZMANN_CONSTANT * temperature / PLANCK_CONSTANT, integratedExitance: 5.670_374_419e-8 * temperature ** 4, emissivityModel: "blackbody-limit" });
}

export interface ConductivityMode { id: string; volumetricHeatCapacity: number; groupVelocity: number; meanFreePath: number; weight?: number }
export interface KineticConductivityInputs { modes?: readonly ConductivityMode[]; dimensions?: 1 | 2 | 3 }
export const DEFAULT_KINETIC_CONDUCTIVITY_INPUTS: KineticConductivityInputs = Object.freeze({ modes: [{ id: "normalized-mode", volumetricHeatCapacity: 1, groupVelocity: 1, meanFreePath: 1, weight: 1 }], dimensions: 3 });

export function kineticConductivityComparator(inputs?: KineticConductivityInputs) {
  const dimensions = boundedInteger(inputs?.dimensions ?? 3, "dimensions", 1, 3) as 1 | 2 | 3;
  const modes = checkedArray(inputs?.modes ?? DEFAULT_KINETIC_CONDUCTIVITY_INPUTS.modes!, "modes", 1, 4096).map((mode, index) => {
    const volumetricHeatCapacity = bounded(mode.volumetricHeatCapacity, `modes[${index}].volumetricHeatCapacity`, 0, 1e30);
    const groupVelocity = bounded(mode.groupVelocity, `modes[${index}].groupVelocity`, 0, 1e12);
    const meanFreePath = bounded(mode.meanFreePath, `modes[${index}].meanFreePath`, 0, 1e12);
    const weight = bounded(mode.weight ?? 1, `modes[${index}].weight`, 0, 1e12);
    return { id: checkedLabel(mode.id, `modes[${index}].id`), volumetricHeatCapacity, groupVelocity, meanFreePath, weight, contribution: weight * volumetricHeatCapacity * groupVelocity * meanFreePath / dimensions };
  });
  return kernel("EARTH-THERM-010", "Relaxation-time kinetic conductivity sum k=(1/d) sum C*v*ell with supplied mode data", inputs === undefined, { dimensions, modes, conductivity: modes.reduce((sum, mode) => sum + mode.contribution, 0), uncertaintyAvailable: false });
}

export const earthChem003Comparator = bondResidualComparator;
export const earthChem005Comparator = geometryResidualComparator;
export const earthChem006Comparator = weightedSphericalObjective;
export const earthChem008Comparator = shellHamiltonianEigenvalues;
export const earthChem009Comparator = pesStationaryBarrierAudit;
export const earthSpec002Comparator = massWeightedHessianModes;
export const earthSpec003Comparator = spectralDerivativeIntensities;
export const earthSpec004Comparator = twoLevelElectronicSpectrum;
export const earthSpec005Comparator = twoSpinNmrSpectrum;
export const earthSpec006Comparator = coreLevelTransitionSpectrum;
export const earthMat001Comparator = crystalPhonon1d;
export const earthMat002Comparator = christoffelWaveSolver;
export const earthMat003Comparator = lorentzDielectricResponse;
export const earthMat005Comparator = refractiveIndexTransform;
export const earthMat007Comparator = jonesMalusComparator;
export const earthMat008Comparator = undepletedPumpNonlinearEstimate;
export const earthMat009Comparator = canonicalHopfTextureDiagnostic;
export const earthTherm002Comparator = transitionTemperatureResidualComparator;
export const earthTherm004Comparator = eosStandardComparison;
export const earthTherm005Comparator = vanDerWaalsCoexistenceComparator;
export const earthTherm008Comparator = oscillatorThermodynamics;
export const earthTherm009Comparator = planckSpectrumComparator;
export const earthTherm010Comparator = kineticConductivityComparator;

export const CHEMISTRY_COMPARATOR_KERNELS = Object.freeze({
  "EARTH-CHEM-003": earthChem003Comparator,
  "EARTH-CHEM-005": earthChem005Comparator,
  "EARTH-CHEM-006": earthChem006Comparator,
  "EARTH-CHEM-008": earthChem008Comparator,
  "EARTH-CHEM-009": earthChem009Comparator,
  "EARTH-SPEC-002": earthSpec002Comparator,
  "EARTH-SPEC-003": earthSpec003Comparator,
  "EARTH-SPEC-004": earthSpec004Comparator,
  "EARTH-SPEC-005": earthSpec005Comparator,
  "EARTH-SPEC-006": earthSpec006Comparator,
  "EARTH-MAT-001": earthMat001Comparator,
  "EARTH-MAT-002": earthMat002Comparator,
  "EARTH-MAT-003": earthMat003Comparator,
  "EARTH-MAT-005": earthMat005Comparator,
  "EARTH-MAT-007": earthMat007Comparator,
  "EARTH-MAT-008": earthMat008Comparator,
  "EARTH-MAT-009": earthMat009Comparator,
  "EARTH-THERM-002": earthTherm002Comparator,
  "EARTH-THERM-004": earthTherm004Comparator,
  "EARTH-THERM-005": earthTherm005Comparator,
  "EARTH-THERM-008": earthTherm008Comparator,
  "EARTH-THERM-009": earthTherm009Comparator,
  "EARTH-THERM-010": earthTherm010Comparator,
});
