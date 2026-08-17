import {
  boundedInteger,
  checkCancelled,
  finiteNumber,
  nonNegativeNumber,
  positiveNumber,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";

export type ExtendedEarthKernelId =
  | "EARTH-FND-006"
  | "EARTH-GEO-004"
  | "EARTH-FLD-006"
  | "EARTH-MAT-004"
  | "EARTH-MAT-006";

export type LabeledEarthKernelResult<Id extends ExtendedEarthKernelId, Output> = EarthKernelResult<Output> & {
  label: Id;
};

const COMPARISON_DIAGNOSTICS = {
  earthValidationClaim: false,
  physicalEquivalence: "blocked",
} as const;

type SubstitutionSymbol = "1" | "2" | "3";

const LITERAL_SUBSTITUTION = { "1": "12", "2": "13", "3": "21" } as const;
const SUBSTITUTION_IMAGES = new Set<string>(Object.values(LITERAL_SUBSTITUTION));

export interface FixedPointRecognizabilityInputs {
  iterations?: number;
  primitivityPowerLimit?: number;
}

export const DEFAULT_FIXED_POINT_RECOGNIZABILITY_INPUTS = Object.freeze({
  iterations: 12,
  primitivityPowerLimit: 12,
}) satisfies FixedPointRecognizabilityInputs;

function substituteLiteral(word: string, options: EarthRunOptions = {}): string {
  let result = "";
  let index = 0;
  for (const symbol of word) {
    if ((index & 4095) === 0) checkCancelled(options);
    result += LITERAL_SUBSTITUTION[symbol as SubstitutionSymbol];
    index += 1;
  }
  return result;
}

function multiplyMatrices(left: number[][], right: number[][]): number[][] {
  return left.map((row, rowIndex) => row.map((_, columnIndex) => {
    let value = 0;
    for (let inner = 0; inner < right.length; inner += 1) value += left[rowIndex]![inner]! * right[inner]![columnIndex]!;
    return value;
  }));
}

function substitutedSymbol(symbol: SubstitutionSymbol, power: number, options: EarthRunOptions): string {
  let word: string = symbol;
  for (let iteration = 0; iteration < power; iteration += 1) word = substituteLiteral(word, options);
  return word;
}

export function fixedPointRecognizabilityAudit(
  inputs: FixedPointRecognizabilityInputs = DEFAULT_FIXED_POINT_RECOGNIZABILITY_INPUTS,
  options: EarthRunOptions = {},
): LabeledEarthKernelResult<"EARTH-FND-006", {
  substitution: typeof LITERAL_SUBSTITUTION;
  oneSided: { seed: SubstitutionSymbol; prefix: string; exactPrefixFixed: boolean };
  twoSided: { fixedUnderSingleSubstitution: boolean; minimumSubstitutionPower: number | null; legalAnchors: string[] };
  primitivity: { incidenceMatrix: number[][]; primitive: boolean; minimumPositivePower: number | null };
  inverseParsing: Array<{ offset: number; testedBlocks: number; validBlocks: number; unique: boolean }>;
  theoremScope: string;
}> {
  const iterations = boundedInteger(inputs.iterations ?? 12, "iterations", 3, 18);
  const powerLimit = boundedInteger(inputs.primitivityPowerLimit ?? 12, "primitivityPowerLimit", 1, 32);
  checkCancelled(options);
  let prefix = "1";
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    checkCancelled(options);
    prefix = substituteLiteral(prefix, options);
  }

  const halfPrefix = prefix.slice(0, prefix.length / 2);
  const exactPrefixFixed = substituteLiteral(halfPrefix, options) === prefix;
  const legalPairs = new Set<string>();
  for (let index = 0; index + 1 < prefix.length; index += 1) {
    if ((index & 4095) === 0) checkCancelled(options);
    legalPairs.add(prefix.slice(index, index + 2));
  }

  let minimumSubstitutionPower: number | null = null;
  let legalAnchors: string[] = [];
  for (let power = 1; power <= powerLimit; power += 1) {
    checkCancelled(options);
    const anchors = [...legalPairs].filter((pair) => {
      const left = pair[0] as SubstitutionSymbol;
      const right = pair[1] as SubstitutionSymbol;
      return substitutedSymbol(left, power, options).endsWith(left) && substitutedSymbol(right, power, options).startsWith(right);
    });
    if (anchors.length > 0) {
      minimumSubstitutionPower = power;
      legalAnchors = anchors.sort();
      break;
    }
  }

  const incidenceMatrix = [[1, 1, 1], [1, 0, 1], [0, 1, 0]];
  let matrixPower = incidenceMatrix.map((row) => [...row]);
  let minimumPositivePower: number | null = null;
  for (let power = 1; power <= powerLimit; power += 1) {
    if (matrixPower.every((row) => row.every((value) => value > 0))) {
      minimumPositivePower = power;
      break;
    }
    matrixPower = multiplyMatrices(matrixPower, incidenceMatrix);
  }

  const inverseParsing = [0, 1].map((offset) => {
    let testedBlocks = 0;
    let validBlocks = 0;
    for (let index = offset; index + 1 < prefix.length; index += 2) {
      if ((index & 4095) === 0) checkCancelled(options);
      testedBlocks += 1;
      if (SUBSTITUTION_IMAGES.has(prefix.slice(index, index + 2))) validBlocks += 1;
    }
    return { offset, testedBlocks, validBlocks, unique: testedBlocks > 0 && validBlocks === testedBlocks };
  });

  return {
    label: "EARTH-FND-006",
    method: "Bounded exact iteration of the literal constant-length substitution, incidence powers, fixed anchors, and aligned inverse parses",
    diagnostics: {
      ...COMPARISON_DIAGNOSTICS,
      benchmarkLabel: "literal-substitution-audit",
      boundedPrefixLength: prefix.length,
      uniqueRecognizedOffset: inverseParsing.filter(({ unique }) => unique).length === 1,
      cyclicEquivalenceTested: false,
    },
    output: {
      substitution: LITERAL_SUBSTITUTION,
      oneSided: { seed: "1", prefix, exactPrefixFixed },
      twoSided: {
        fixedUnderSingleSubstitution: minimumSubstitutionPower === 1,
        minimumSubstitutionPower,
        legalAnchors,
      },
      primitivity: {
        incidenceMatrix,
        primitive: minimumPositivePower !== null,
        minimumPositivePower,
      },
      inverseParsing,
      theoremScope: "Finite literal words and symbolic substitution properties only; no physical-vacuum or cyclic equivalence is inferred.",
    },
  };
}

export interface TrefoilTubeInputs {
  samples?: number;
  scale?: number;
  tubeRadius?: number;
  bendingRigidity?: number;
}

export const DEFAULT_TREFOIL_TUBE_INPUTS = Object.freeze({
  samples: 1024,
  scale: 1,
  tubeRadius: 0.1,
  bendingRigidity: 1,
}) satisfies TrefoilTubeInputs;

type Vector3 = [number, number, number];

function trefoilSample(parameter: number, scale: number): { point: Vector3; first: Vector3; second: Vector3 } {
  const sin2 = Math.sin(2 * parameter);
  const cos2 = Math.cos(2 * parameter);
  const sin3 = Math.sin(3 * parameter);
  const cos3 = Math.cos(3 * parameter);
  const radial = 2 + cos3;
  return {
    point: [scale * radial * cos2, scale * radial * sin2, scale * sin3],
    first: [
      scale * (-3 * sin3 * cos2 - 2 * radial * sin2),
      scale * (-3 * sin3 * sin2 + 2 * radial * cos2),
      scale * 3 * cos3,
    ],
    second: [
      scale * (-9 * cos3 * cos2 + 12 * sin3 * sin2 - 4 * radial * cos2),
      scale * (-9 * cos3 * sin2 - 12 * sin3 * cos2 - 4 * radial * sin2),
      scale * -9 * sin3,
    ],
  };
}

function distance(left: Vector3, right: Vector3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function curvature(first: Vector3, second: Vector3): number {
  const cross: Vector3 = [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
  return Math.hypot(...cross) / Math.hypot(...first) ** 3;
}

export function trefoilTubeComparison(
  inputs: TrefoilTubeInputs = DEFAULT_TREFOIL_TUBE_INPUTS,
  options: EarthRunOptions = {},
): LabeledEarthKernelResult<"EARTH-GEO-004", {
  parameters: { samples: number; scale: number; tubeRadius: number; bendingRigidity: number };
  centerline: Vector3[];
  curvature: number[];
  polygonalLength: number;
  quadratureLength: number;
  bendingEnergy: number;
  tubeSurfaceArea: number;
  tubeVolume: number;
}> {
  const samples = boundedInteger(inputs.samples ?? 1024, "samples", 64, 16_384);
  const scale = positiveNumber(inputs.scale ?? 1, "scale");
  const tubeRadius = positiveNumber(inputs.tubeRadius ?? 0.1, "tubeRadius");
  const bendingRigidity = nonNegativeNumber(inputs.bendingRigidity ?? 1, "bendingRigidity");
  if (scale > 1e12 || tubeRadius > 1e12 || bendingRigidity > 1e18) throw new RangeError("trefoil parameters exceed the bounded numerical range");
  checkCancelled(options);

  const parameterStep = 2 * Math.PI / samples;
  const centerline: Vector3[] = [];
  const sampledCurvature: number[] = [];
  const speeds: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const sample = trefoilSample(index * parameterStep, scale);
    centerline.push(sample.point);
    sampledCurvature.push(curvature(sample.first, sample.second));
    speeds.push(Math.hypot(...sample.first));
  }

  const maximumCurvature = Math.max(...sampledCurvature);
  if (tubeRadius * maximumCurvature >= 1) {
    throw new RangeError("tubeRadius must be smaller than the sampled local radius of curvature");
  }
  let polygonalLength = 0;
  let quadratureLength = 0;
  let curvatureSquaredIntegral = 0;
  for (let index = 0; index < samples; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    polygonalLength += distance(centerline[index]!, centerline[(index + 1) % samples]!);
    quadratureLength += speeds[index]! * parameterStep;
    curvatureSquaredIntegral += sampledCurvature[index]! ** 2 * speeds[index]! * parameterStep;
  }

  return {
    label: "EARTH-GEO-004",
    method: "Uniform sampling and periodic quadrature of the standard elastic T(2,3) torus-knot centerline",
    diagnostics: {
      ...COMPARISON_DIAGNOSTICS,
      benchmarkLabel: "standard-elastic-trefoil-comparison",
      fieldRelaxationPerformed: false,
      topologyValidationClaim: false,
      maximumCurvature,
      localTubeRegular: true,
    },
    output: {
      parameters: { samples, scale, tubeRadius, bendingRigidity },
      centerline,
      curvature: sampledCurvature,
      polygonalLength,
      quadratureLength,
      bendingEnergy: 0.5 * bendingRigidity * curvatureSquaredIntegral,
      tubeSurfaceArea: 2 * Math.PI * tubeRadius * quadratureLength,
      tubeVolume: Math.PI * tubeRadius ** 2 * quadratureLength,
    },
  };
}

export interface ScalingParameter {
  reference: number;
  densityExponent: number;
  temperatureExponent: number;
}

export interface DecoherenceScalingInputs {
  densities?: number[];
  temperatures?: number[];
  referenceDensity?: number;
  referenceTemperature?: number;
  gridPoints?: number;
  length?: number;
  timeStep?: number;
  steps?: number;
  mode?: number;
  diffusion?: ScalingParameter;
  damping?: ScalingParameter;
  noise?: ScalingParameter;
  claimedVarianceExponents?: { density: number; temperature: number; tolerance?: number };
}

export const DEFAULT_DECOHERENCE_SCALING_INPUTS = Object.freeze({
  densities: [0.25, 0.5, 1, 2, 4],
  temperatures: [0.5, 0.75, 1, 1.5, 2],
  referenceDensity: 1,
  referenceTemperature: 1,
  gridPoints: 64,
  length: 1,
  timeStep: 0.002,
  steps: 1000,
  mode: 1,
  diffusion: { reference: 0.05, densityExponent: 0, temperatureExponent: 0 },
  damping: { reference: 1, densityExponent: 1, temperatureExponent: 0 },
  noise: { reference: 0.4, densityExponent: 0, temperatureExponent: 0.5 },
  claimedVarianceExponents: { density: -1, temperature: 1, tolerance: 0.08 },
}) satisfies DecoherenceScalingInputs;

function boundedPositiveArray(values: number[], name: string): number[] {
  if (!Array.isArray(values) || values.length < 3 || values.length > 64) throw new RangeError(`${name} must contain 3 to 64 values`);
  return values.map((value, index) => {
    const bounded = positiveNumber(value, `${name}[${index}]`);
    if (bounded > 1e100) throw new RangeError(`${name}[${index}] exceeds 1e100`);
    return bounded;
  });
}

function scalingValue(parameter: ScalingParameter, densityRatio: number, temperatureRatio: number, name: string): number {
  const reference = nonNegativeNumber(parameter.reference, `${name}.reference`);
  const densityExponent = finiteNumber(parameter.densityExponent, `${name}.densityExponent`);
  const temperatureExponent = finiteNumber(parameter.temperatureExponent, `${name}.temperatureExponent`);
  if (Math.abs(densityExponent) > 16 || Math.abs(temperatureExponent) > 16) throw new RangeError(`${name} exponents must be from -16 to 16`);
  const value = reference * densityRatio ** densityExponent * temperatureRatio ** temperatureExponent;
  if (!Number.isFinite(value)) throw new RangeError(`${name} scaling produced a non-finite value`);
  return value;
}

function logSlope(points: Array<{ x: number; y: number }>): number {
  const logPoints = points.map(({ x, y }) => ({ x: Math.log(x), y: Math.log(y) }));
  const meanX = logPoints.reduce((sum, point) => sum + point.x, 0) / logPoints.length;
  const meanY = logPoints.reduce((sum, point) => sum + point.y, 0) / logPoints.length;
  let covariance = 0;
  let variance = 0;
  for (const point of logPoints) {
    covariance += (point.x - meanX) * (point.y - meanY);
    variance += (point.x - meanX) ** 2;
  }
  if (variance === 0) throw new RangeError("sweep coordinates must contain distinct values");
  return covariance / variance;
}

function fld005ModeVariance(noise: number, timeStep: number, spacing: number, decayRate: number, steps: number): number {
  const gain = 1 / (1 + timeStep * decayRate);
  const innovationVariance = noise ** 2 * timeStep / spacing;
  const denominator = 1 - gain ** 2;
  return denominator === 0
    ? innovationVariance * steps
    : innovationVariance * gain ** 2 * (1 - gain ** (2 * steps)) / denominator;
}

export function decoherenceScalingSweep(
  inputs: DecoherenceScalingInputs = DEFAULT_DECOHERENCE_SCALING_INPUTS,
  options: EarthRunOptions = {},
): LabeledEarthKernelResult<"EARTH-FLD-006", {
  formula: string;
  points: Array<{ density: number; temperature: number; diffusion: number; damping: number; noise: number; modeDecayRate: number; variance: number }>;
  fittedVarianceExponents: { density: number; temperature: number };
  claimedVarianceExponents: { density: number; temperature: number; tolerance: number } | null;
  conflicts: Array<{ variable: "density" | "temperature"; claimed: number; fitted: number; difference: number }>;
}> {
  const densities = boundedPositiveArray(inputs.densities ?? [...DEFAULT_DECOHERENCE_SCALING_INPUTS.densities], "densities");
  const temperatures = boundedPositiveArray(inputs.temperatures ?? [...DEFAULT_DECOHERENCE_SCALING_INPUTS.temperatures], "temperatures");
  const referenceDensity = positiveNumber(inputs.referenceDensity ?? 1, "referenceDensity");
  const referenceTemperature = positiveNumber(inputs.referenceTemperature ?? 1, "referenceTemperature");
  const gridPoints = boundedInteger(inputs.gridPoints ?? 64, "gridPoints", 8, 512);
  const length = positiveNumber(inputs.length ?? 1, "length");
  const timeStep = positiveNumber(inputs.timeStep ?? 0.002, "timeStep");
  const steps = boundedInteger(inputs.steps ?? 1000, "steps", 1, 100_000);
  const mode = boundedInteger(inputs.mode ?? 1, "mode", 0, Math.floor(gridPoints / 2));
  if (timeStep * steps > 1e4) throw new RangeError("timeStep*steps must not exceed 1e4");
  const diffusionParameter = inputs.diffusion ?? DEFAULT_DECOHERENCE_SCALING_INPUTS.diffusion;
  const dampingParameter = inputs.damping ?? DEFAULT_DECOHERENCE_SCALING_INPUTS.damping;
  const noiseParameter = inputs.noise ?? DEFAULT_DECOHERENCE_SCALING_INPUTS.noise;
  checkCancelled(options);

  const spacing = length / gridPoints;
  const points: Array<{ density: number; temperature: number; diffusion: number; damping: number; noise: number; modeDecayRate: number; variance: number }> = [];
  for (const density of densities) {
    for (const temperature of temperatures) {
      if ((points.length & 63) === 0) checkCancelled(options);
      const densityRatio = density / referenceDensity;
      const temperatureRatio = temperature / referenceTemperature;
      const diffusion = scalingValue(diffusionParameter, densityRatio, temperatureRatio, "diffusion");
      const damping = scalingValue(dampingParameter, densityRatio, temperatureRatio, "damping");
      const noise = scalingValue(noiseParameter, densityRatio, temperatureRatio, "noise");
      const modeDecayRate = damping + 4 * diffusion * Math.sin(Math.PI * mode / gridPoints) ** 2 / spacing ** 2;
      const variance = fld005ModeVariance(noise, timeStep, spacing, modeDecayRate, steps);
      if (!(variance > 0) || !Number.isFinite(variance)) throw new RangeError("FLD-005 variance formula produced an invalid sweep value");
      points.push({ density, temperature, diffusion, damping, noise, modeDecayRate, variance });
    }
  }

  const densitySlice = densities.map((density) => {
    const densityRatio = density / referenceDensity;
    const diffusion = scalingValue(diffusionParameter, densityRatio, 1, "diffusion");
    const damping = scalingValue(dampingParameter, densityRatio, 1, "damping");
    const noise = scalingValue(noiseParameter, densityRatio, 1, "noise");
    const rate = damping + 4 * diffusion * Math.sin(Math.PI * mode / gridPoints) ** 2 / spacing ** 2;
    const variance = fld005ModeVariance(noise, timeStep, spacing, rate, steps);
    return { x: density, y: variance };
  });
  const temperatureSlice = temperatures.map((temperature) => {
    const temperatureRatio = temperature / referenceTemperature;
    const diffusion = scalingValue(diffusionParameter, 1, temperatureRatio, "diffusion");
    const damping = scalingValue(dampingParameter, 1, temperatureRatio, "damping");
    const noise = scalingValue(noiseParameter, 1, temperatureRatio, "noise");
    const rate = damping + 4 * diffusion * Math.sin(Math.PI * mode / gridPoints) ** 2 / spacing ** 2;
    const variance = fld005ModeVariance(noise, timeStep, spacing, rate, steps);
    return { x: temperature, y: variance };
  });
  const fittedVarianceExponents = { density: logSlope(densitySlice), temperature: logSlope(temperatureSlice) };
  const claimed = inputs.claimedVarianceExponents === undefined
    ? DEFAULT_DECOHERENCE_SCALING_INPUTS.claimedVarianceExponents
    : inputs.claimedVarianceExponents;
  const claimedVarianceExponents = claimed === null ? null : {
    density: finiteNumber(claimed.density, "claimedVarianceExponents.density"),
    temperature: finiteNumber(claimed.temperature, "claimedVarianceExponents.temperature"),
    tolerance: positiveNumber(claimed.tolerance ?? 0.08, "claimedVarianceExponents.tolerance"),
  };
  const conflicts: Array<{ variable: "density" | "temperature"; claimed: number; fitted: number; difference: number }> = [];
  if (claimedVarianceExponents) {
    for (const variable of ["density", "temperature"] as const) {
      const difference = fittedVarianceExponents[variable] - claimedVarianceExponents[variable];
      if (Math.abs(difference) > claimedVarianceExponents.tolerance) {
        conflicts.push({ variable, claimed: claimedVarianceExponents[variable], fitted: fittedVarianceExponents[variable], difference });
      }
    }
  }

  return {
    label: "EARTH-FLD-006",
    method: "Deterministic log-slope sweep of the explicit finite-step FLD-005 backward-Euler modal variance",
    diagnostics: {
      ...COMPARISON_DIAGNOSTICS,
      benchmarkLabel: "fld-005-parameter-scaling-audit",
      dimensionalCalibrationAvailable: false,
      pointCount: points.length,
      conflictCount: conflicts.length,
    },
    output: {
      formula: "V_m=N^2*dt/dx*g_m^2*(1-g_m^(2s))/(1-g_m^2), g_m=[1+dt*(nu+4*mu*sin^2(pi*m/M)/dx^2)]^-1",
      points,
      fittedVarianceExponents,
      claimedVarianceExponents,
      conflicts,
    },
  };
}

export interface SusceptibilitySpectrum {
  frequencies: number[];
  real: number[];
  imaginary: number[];
  highFrequencyLimit?: number;
}

export interface KramersKronigInputs {
  spectrum?: SusceptibilitySpectrum;
  lorentz?: { resonance?: number; damping?: number; strength?: number; highFrequencyLimit?: number; maximumFrequency?: number; samples?: number };
  edgeExclusion?: number;
}

export const DEFAULT_KRAMERS_KRONIG_INPUTS = Object.freeze({
  lorentz: { resonance: 2, damping: 0.4, strength: 1, highFrequencyLimit: 0.25, maximumFrequency: 20, samples: 1025 },
  edgeExclusion: 32,
}) satisfies KramersKronigInputs;

function validateSpectrum(spectrum: SusceptibilitySpectrum): SusceptibilitySpectrum {
  const { frequencies, real, imaginary } = spectrum;
  if (!Array.isArray(frequencies) || frequencies.length < 33 || frequencies.length > 2049) {
    throw new RangeError("spectrum frequencies must contain 33 to 2049 values");
  }
  if (real.length !== frequencies.length || imaginary.length !== frequencies.length) throw new RangeError("spectrum arrays must have equal lengths");
  const checkedFrequencies = frequencies.map((value, index) => nonNegativeNumber(value, `frequencies[${index}]`));
  for (let index = 1; index < checkedFrequencies.length; index += 1) {
    if (checkedFrequencies[index]! <= checkedFrequencies[index - 1]!) throw new RangeError("frequencies must be strictly increasing");
  }
  return {
    frequencies: checkedFrequencies,
    real: real.map((value, index) => finiteNumber(value, `real[${index}]`)),
    imaginary: imaginary.map((value, index) => finiteNumber(value, `imaginary[${index}]`)),
    highFrequencyLimit: finiteNumber(spectrum.highFrequencyLimit ?? 0, "highFrequencyLimit"),
  };
}

function lorentzSpectrum(inputs: NonNullable<KramersKronigInputs["lorentz"]>, options: EarthRunOptions): SusceptibilitySpectrum {
  const resonance = positiveNumber(inputs.resonance ?? 2, "lorentz.resonance");
  const damping = positiveNumber(inputs.damping ?? 0.4, "lorentz.damping");
  const strength = positiveNumber(inputs.strength ?? 1, "lorentz.strength");
  const highFrequencyLimit = finiteNumber(inputs.highFrequencyLimit ?? 0.25, "lorentz.highFrequencyLimit");
  const maximumFrequency = positiveNumber(inputs.maximumFrequency ?? 20, "lorentz.maximumFrequency");
  const samples = boundedInteger(inputs.samples ?? 1025, "lorentz.samples", 33, 2049);
  if (maximumFrequency <= resonance * 2) throw new RangeError("lorentz.maximumFrequency must exceed twice the resonance");
  const frequencies = Array.from({ length: samples }, (_, index) => maximumFrequency * index / (samples - 1));
  const real: number[] = [];
  const imaginary: number[] = [];
  for (let index = 0; index < frequencies.length; index += 1) {
    if ((index & 255) === 0) checkCancelled(options);
    const frequency = frequencies[index]!;
    const detuning = resonance ** 2 - frequency ** 2;
    const loss = damping * frequency;
    const denominator = detuning ** 2 + loss ** 2;
    real.push(highFrequencyLimit + strength * detuning / denominator);
    imaginary.push(strength * loss / denominator);
  }
  return { frequencies, real, imaginary, highFrequencyLimit };
}

function kkAtIndex(frequencies: number[], imaginary: number[], index: number, highFrequencyLimit: number): number {
  const target = frequencies[index]!;
  const weighted = frequencies.map((frequency, frequencyIndex) => frequency * imaginary[frequencyIndex]!);
  const derivative = (weighted[index + 1]! - weighted[index - 1]!) / (frequencies[index + 1]! - frequencies[index - 1]!);
  const quotient = frequencies.map((frequency, frequencyIndex) => frequencyIndex === index
    ? derivative / (2 * target)
    : (weighted[frequencyIndex]! - weighted[index]!) / (frequency ** 2 - target ** 2));
  let regularIntegral = 0;
  for (let sample = 0; sample + 1 < frequencies.length; sample += 1) {
    regularIntegral += 0.5 * (quotient[sample]! + quotient[sample + 1]!) * (frequencies[sample + 1]! - frequencies[sample]!);
  }
  const lower = frequencies[0]!;
  const upper = frequencies[frequencies.length - 1]!;
  const principalValue = weighted[index]! / (2 * target) * (
    Math.log(Math.abs((upper - target) / (upper + target)))
    - Math.log(Math.abs((lower - target) / (lower + target)))
  );
  return highFrequencyLimit + 2 / Math.PI * (regularIntegral + principalValue);
}

export function kramersKronigAudit(
  inputs: KramersKronigInputs = DEFAULT_KRAMERS_KRONIG_INPUTS,
  options: EarthRunOptions = {},
): LabeledEarthKernelResult<"EARTH-MAT-004", {
  source: "user-spectrum" | "lorentz-benchmark";
  spectrum: SusceptibilitySpectrum;
  samples: Array<{ index: number; frequency: number; suppliedReal: number; transformedReal: number; residual: number }>;
  maximumAbsoluteResidual: number;
  rmsResidual: number;
}> {
  if (inputs.spectrum && inputs.lorentz) throw new RangeError("provide either spectrum or lorentz parameters, not both");
  const source = inputs.spectrum ? "user-spectrum" : "lorentz-benchmark";
  checkCancelled(options);
  const spectrum = validateSpectrum(inputs.spectrum ?? lorentzSpectrum(inputs.lorentz ?? DEFAULT_KRAMERS_KRONIG_INPUTS.lorentz, options));
  const maximumExclusion = Math.floor((spectrum.frequencies.length - 3) / 2);
  const edgeExclusion = boundedInteger(inputs.edgeExclusion ?? Math.min(32, maximumExclusion), "edgeExclusion", 1, maximumExclusion);
  const samples: Array<{ index: number; frequency: number; suppliedReal: number; transformedReal: number; residual: number }> = [];
  for (let index = edgeExclusion; index < spectrum.frequencies.length - edgeExclusion; index += 1) {
    if ((index & 31) === 0) checkCancelled(options);
    const transformedReal = kkAtIndex(spectrum.frequencies, spectrum.imaginary, index, spectrum.highFrequencyLimit ?? 0);
    const residual = transformedReal - spectrum.real[index]!;
    samples.push({ index, frequency: spectrum.frequencies[index]!, suppliedReal: spectrum.real[index]!, transformedReal, residual });
  }
  const maximumAbsoluteResidual = Math.max(...samples.map(({ residual }) => Math.abs(residual)));
  const rmsResidual = Math.sqrt(samples.reduce((sum, { residual }) => sum + residual ** 2, 0) / samples.length);
  return {
    label: "EARTH-MAT-004",
    method: "Subtracted positive-frequency discrete principal-value Kramers-Kronig quadrature on a declared finite band",
    diagnostics: {
      ...COMPARISON_DIAGNOSTICS,
      benchmarkLabel: source,
      finiteBandExtrapolation: "constant-high-frequency-limit",
      evaluatedSamples: samples.length,
      causalModelValidationClaim: false,
    },
    output: { source, spectrum, samples, maximumAbsoluteResidual, rmsResidual },
  };
}

interface ComplexValue {
  re: number;
  im: number;
}

export interface FresnelInterfaceInputs {
  incidentIndex?: ComplexValue;
  transmittedIndex?: ComplexValue;
  incidenceAngleRadians?: number;
  polarization?: "s" | "p" | "both";
  energyTolerance?: number;
}

export const DEFAULT_FRESNEL_INTERFACE_INPUTS = Object.freeze({
  incidentIndex: { re: 1, im: 0 },
  transmittedIndex: { re: 1.5, im: 0 },
  incidenceAngleRadians: 0,
  polarization: "both",
  energyTolerance: 1e-12,
}) satisfies FresnelInterfaceInputs;

function checkedIndex(value: ComplexValue, name: string): ComplexValue {
  const checked = { re: positiveNumber(value.re, `${name}.re`), im: nonNegativeNumber(value.im, `${name}.im`) };
  if (checked.re > 1e6 || checked.im > 1e6) throw new RangeError(`${name} components must not exceed 1e6`);
  return checked;
}

function complexAdd(left: ComplexValue, right: ComplexValue): ComplexValue {
  return { re: left.re + right.re, im: left.im + right.im };
}

function complexSubtract(left: ComplexValue, right: ComplexValue): ComplexValue {
  return { re: left.re - right.re, im: left.im - right.im };
}

function complexMultiply(left: ComplexValue, right: ComplexValue): ComplexValue {
  return { re: left.re * right.re - left.im * right.im, im: left.re * right.im + left.im * right.re };
}

function complexDivide(left: ComplexValue, right: ComplexValue): ComplexValue {
  const denominator = right.re ** 2 + right.im ** 2;
  if (denominator === 0) throw new RangeError("Fresnel denominator is zero");
  return {
    re: (left.re * right.re + left.im * right.im) / denominator,
    im: (left.im * right.re - left.re * right.im) / denominator,
  };
}

function complexSquareRoot(value: ComplexValue): ComplexValue {
  const magnitude = Math.hypot(value.re, value.im);
  return {
    re: Math.sqrt(Math.max(0, (magnitude + value.re) / 2)),
    im: (value.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (magnitude - value.re) / 2)),
  };
}

function magnitudeSquared(value: ComplexValue): number {
  return value.re ** 2 + value.im ** 2;
}

function phase(value: ComplexValue): number {
  return Math.atan2(value.im, value.re);
}

export function fresnelInterfaceSolver(
  inputs: FresnelInterfaceInputs = DEFAULT_FRESNEL_INTERFACE_INPUTS,
): LabeledEarthKernelResult<"EARTH-MAT-006", {
  incidentIndex: ComplexValue;
  transmittedIndex: ComplexValue;
  incidenceAngleRadians: number;
  transmittedCosine: ComplexValue;
  polarizations: Array<{
    polarization: "s" | "p";
    reflectionAmplitude: ComplexValue;
    transmissionAmplitude: ComplexValue;
    reflectionPhase: number;
    transmissionPhase: number;
    reflectance: number;
    transmittance: number;
    energyBalance: number;
    energyBalanceResidual: number;
    energyBalanced: boolean;
  }>;
}> {
  const incidentIndex = checkedIndex(inputs.incidentIndex ?? DEFAULT_FRESNEL_INTERFACE_INPUTS.incidentIndex, "incidentIndex");
  const transmittedIndex = checkedIndex(inputs.transmittedIndex ?? DEFAULT_FRESNEL_INTERFACE_INPUTS.transmittedIndex, "transmittedIndex");
  const incidenceAngleRadians = finiteNumber(inputs.incidenceAngleRadians ?? 0, "incidenceAngleRadians");
  if (incidenceAngleRadians < 0 || incidenceAngleRadians >= Math.PI / 2) throw new RangeError("incidenceAngleRadians must be from 0 (inclusive) to pi/2 (exclusive)");
  const polarization = inputs.polarization ?? "both";
  if (polarization !== "s" && polarization !== "p" && polarization !== "both") throw new RangeError("polarization must be s, p, or both");
  const energyTolerance = positiveNumber(inputs.energyTolerance ?? 1e-12, "energyTolerance");
  if (energyTolerance < 1e-15 || energyTolerance > 1e-2) throw new RangeError("energyTolerance must be from 1e-15 to 1e-2");

  const cosineIncident = Math.cos(incidenceAngleRadians);
  const sineIncident = Math.sin(incidenceAngleRadians);
  const indexRatio = complexDivide(incidentIndex, transmittedIndex);
  const squaredSineTransmitted = complexMultiply(
    complexMultiply(indexRatio, indexRatio),
    { re: sineIncident ** 2, im: 0 },
  );
  let transmittedCosine = complexSquareRoot(complexSubtract({ re: 1, im: 0 }, squaredSineTransmitted));
  let normalWaveVector = complexMultiply(transmittedIndex, transmittedCosine);
  if (normalWaveVector.im < 0 || (normalWaveVector.im === 0 && normalWaveVector.re < 0)) {
    transmittedCosine = { re: -transmittedCosine.re, im: -transmittedCosine.im };
    normalWaveVector = complexMultiply(transmittedIndex, transmittedCosine);
  }

  const requested = polarization === "both" ? ["s", "p"] as const : [polarization] as const;
  const polarizations = requested.map((kind) => {
    const n1Cos1 = complexMultiply(incidentIndex, { re: cosineIncident, im: 0 });
    let reflectionAmplitude: ComplexValue;
    let transmissionAmplitude: ComplexValue;
    let transmittedFlux: number;
    if (kind === "s") {
      const denominator = complexAdd(n1Cos1, normalWaveVector);
      reflectionAmplitude = complexDivide(complexSubtract(n1Cos1, normalWaveVector), denominator);
      transmissionAmplitude = complexDivide(complexMultiply({ re: 2, im: 0 }, n1Cos1), denominator);
      transmittedFlux = normalWaveVector.re;
    } else {
      const n2Cos1 = complexMultiply(transmittedIndex, { re: cosineIncident, im: 0 });
      const n1Cos2 = complexMultiply(incidentIndex, transmittedCosine);
      const denominator = complexAdd(n2Cos1, n1Cos2);
      reflectionAmplitude = complexDivide(complexSubtract(n2Cos1, n1Cos2), denominator);
      transmissionAmplitude = complexDivide(complexMultiply({ re: 2, im: 0 }, n1Cos1), denominator);
      transmittedFlux = complexMultiply(transmittedIndex, { re: transmittedCosine.re, im: -transmittedCosine.im }).re;
    }
    const incidentFlux = incidentIndex.re * cosineIncident;
    const reflectance = magnitudeSquared(reflectionAmplitude);
    const transmittance = Math.max(0, transmittedFlux / incidentFlux * magnitudeSquared(transmissionAmplitude));
    const energyBalance = reflectance + transmittance;
    const energyBalanceResidual = Math.abs(energyBalance - 1);
    return {
      polarization: kind,
      reflectionAmplitude,
      transmissionAmplitude,
      reflectionPhase: phase(reflectionAmplitude),
      transmissionPhase: phase(transmissionAmplitude),
      reflectance,
      transmittance,
      energyBalance,
      energyBalanceResidual,
      energyBalanced: incidentIndex.im === 0 && energyBalanceResidual <= energyTolerance,
    };
  });

  return {
    label: "EARTH-MAT-006",
    method: "Standard complex-index isotropic Fresnel amplitudes with the passive transmitted branch and normal Poynting-flux balance",
    diagnostics: {
      ...COMPARISON_DIAGNOSTICS,
      benchmarkLabel: "standard-isotropic-fresnel-interface",
      anisotropicTensorSolved: false,
      incidentMediumLossless: incidentIndex.im === 0,
      allEnergyChecksPass: incidentIndex.im === 0 && polarizations.every(({ energyBalanced }) => energyBalanced),
    },
    output: { incidentIndex, transmittedIndex, incidenceAngleRadians, transmittedCosine, polarizations },
  };
}
