import {
  boundedInteger,
  checkCancelled,
  finiteNumber,
  relativeError,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";

const G = 6.674_30e-11;
const C = 299_792_458;
const K_B = 1.380_649e-23;
const PROTON_MASS = 1.672_621_925_95e-27;
const PARSEC = 3.085_677_581_491_367e16;
const MEGAPARSEC = 1e6 * PARSEC;
const SOLAR_MASS = 1.988_47e30;
const YEAR = 31_557_600;

export type AstroComparatorId =
  | "EARTH-GRV-003" | "EARTH-GRV-004" | "EARTH-GRV-005" | "EARTH-GRV-006"
  | "EARTH-COS-002" | "EARTH-COS-003" | "EARTH-COS-004" | "EARTH-COS-005"
  | "EARTH-PLAN-001" | "EARTH-PLAN-002" | "EARTH-PLAN-003" | "EARTH-PLAN-004"
  | "EARTH-PLAN-006" | "EARTH-PLAN-007" | "EARTH-PLAN-011"
  | "EARTH-STAR-001" | "EARTH-STAR-002" | "EARTH-STAR-004" | "EARTH-STAR-005"
  | "EARTH-STAR-006" | "EARTH-STAR-007"
  | "EARTH-GAL-001" | "EARTH-GAL-002" | "EARTH-GAL-003" | "EARTH-GAL-006" | "EARTH-GAL-007";

export type AstroComparatorResult<Id extends AstroComparatorId, Output> = EarthKernelResult<Output> & { label: Id };

export type AstroComparatorKind = "standard-comparison" | "source-contract-audit";

const SOURCE_BLOCKERS: Record<AstroComparatorId, string> = {
  "EARTH-GRV-003": "BX: ansatz is not a solved equation and topology is invalid.",
  "EARTH-GRV-004": "Missing; hard gate for all gravity predictions.",
  "EARTH-GRV-005": "Depends on GRV-004.",
  "EARTH-GRV-006": "BX: scalar amplitude does not produce TT spin-2 modes.",
  "EARTH-COS-002": "BX for EARTH; standard LambdaCDM comparator available.",
  "EARTH-COS-003": "BX.",
  "EARTH-COS-004": "BX: \"twisted harmonics\" are unspecified.",
  "EARTH-COS-005": "BX.",
  "EARTH-PLAN-001": "Prediction BX: source density and shell count use the observed target radius.",
  "EARTH-PLAN-002": "Data-blocked; printed Earth ratio already fails literal arithmetic.",
  "EARTH-PLAN-003": "Standard comparator; no complete EARTH EOS.",
  "EARTH-PLAN-004": "BX: projection factor, tensor, viscosity, and forcing absent.",
  "EARTH-PLAN-006": "Standard benchmark possible; no EARTH MHD derivation.",
  "EARTH-PLAN-007": "Needs preregistration; current choices are post-selected.",
  "EARTH-PLAN-011": "BX as prediction until criterion and authenticated profiles are fixed.",
  "EARTH-STAR-001": "BX until projection is defined.",
  "EARTH-STAR-002": "Standard comparator; no complete EARTH equations.",
  "EARTH-STAR-004": "Needs real catalog; source arrays are absent/mock.",
  "EARTH-STAR-005": "Data-blocked; source arithmetic fails.",
  "EARTH-STAR-006": "BX for EARTH stiffness; standard GYRE-like comparator possible.",
  "EARTH-STAR-007": "BX; far beyond supplied equations.",
  "EARTH-GAL-001": "Data-blocked; source density/unit conversions fail.",
  "EARTH-GAL-002": "BX: no governing disk equations.",
  "EARTH-GAL-003": "BX until shell-suppression force is explicit.",
  "EARTH-GAL-006": "BX: no catalog of thousands of confirmed biosignature planets exists, and the monotonic source equation does not produce two boundaries.",
  "EARTH-GAL-007": "BX until an explicit stress/force law exists.",
};

const SOURCE_CONTRACT_IDS = new Set<AstroComparatorId>(["EARTH-STAR-007", "EARTH-GAL-007"]);

function bounded(value: number, name: string, minimum: number, maximum: number): number {
  finiteNumber(value, name);
  if (value < minimum || value > maximum) throw new RangeError(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

function boundedValues(values: readonly number[], name: string, minimumLength: number, maximumLength: number, minimum: number, maximum: number): number[] {
  if (!Array.isArray(values) || values.length < minimumLength || values.length > maximumLength) {
    throw new RangeError(`${name} must contain ${minimumLength} to ${maximumLength} values`);
  }
  return values.map((value, index) => bounded(value, `${name}[${index}]`, minimum, maximum));
}

function text(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  if (value.length > 128) throw new RangeError(`${name} must contain at most 128 characters`);
  return value;
}

function flag(value: boolean, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
  return value;
}

function comparison<Id extends AstroComparatorId, Output>(
  label: Id,
  method: string,
  output: Output,
  diagnostics: Record<string, boolean | number | string | null> = {},
): AstroComparatorResult<Id, Output> {
  const kernelKind: AstroComparatorKind = SOURCE_CONTRACT_IDS.has(label) ? "source-contract-audit" : "standard-comparison";
  return {
    label,
    method,
    diagnostics: {
      kernelKind,
      provenanceKind: "comparison",
      benchmarkLabel: `${kernelKind}-not-EARTH-derived`,
      sourceBlocker: SOURCE_BLOCKERS[label],
      sourceBlockerRetained: true,
      earthModelStatus: "blocked",
      earthValidationClaim: false,
      validatesEarthTheory: false,
      physicalEquivalence: "blocked",
      deterministic: true,
      ...diagnostics,
    },
    output,
  };
}

function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function linearSamples(minimum: number, maximum: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => minimum + (maximum - minimum) * index / (count - 1));
}

export interface RadialScalarProfileInputs {
  radii?: readonly number[];
  profile?: readonly number[];
  scaleRadius?: number;
}

export const DEFAULT_RADIAL_SCALAR_PROFILE_INPUTS = Object.freeze({
  radii: [0, 0.5, 1, 2, 4],
  profile: [0, Math.tanh(0.5), Math.tanh(1), Math.tanh(2), Math.tanh(4)],
  scaleRadius: 1,
}) satisfies RadialScalarProfileInputs;

export function radialScalarProfileResidual(
  inputs: RadialScalarProfileInputs = DEFAULT_RADIAL_SCALAR_PROFILE_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-GRV-003", {
  reference: "f(r)=tanh(r/r0)";
  rmsResidual: number;
  maximumAbsoluteResidual: number;
  series: Array<{ radius: number; supplied: number; reference: number; residual: number }>;
}> {
  const radii = boundedValues(inputs.radii ?? DEFAULT_RADIAL_SCALAR_PROFILE_INPUTS.radii, "radii", 2, 4096, 0, 1e12);
  const profile = boundedValues(inputs.profile ?? DEFAULT_RADIAL_SCALAR_PROFILE_INPUTS.profile, "profile", 2, 4096, -1e12, 1e12);
  if (radii.length !== profile.length) throw new RangeError("radii and profile must have equal lengths");
  const scaleRadius = bounded(inputs.scaleRadius ?? 1, "scaleRadius", 1e-12, 1e12);
  const series = radii.map((radius, index) => {
    checkCancelled(options);
    if (index > 0 && radius <= radii[index - 1]!) throw new RangeError("radii must be strictly increasing");
    const reference = Math.tanh(radius / scaleRadius);
    const supplied = profile[index]!;
    return { radius, supplied, reference, residual: supplied - reference };
  });
  return comparison("EARTH-GRV-003", "Residual against a normalized canonical tanh radial scalar profile", {
    reference: "f(r)=tanh(r/r0)",
    rmsResidual: rms(series.map(({ residual }) => residual)),
    maximumAbsoluteResidual: Math.max(...series.map(({ residual }) => Math.abs(residual))),
    series,
  }, { normalizedComparator: true, topologyClaim: false });
}

export interface CanonicalScalarStressInputs {
  timeDerivative?: number;
  radialDerivative?: number;
  potentialEnergyDensity?: number;
}

export const DEFAULT_CANONICAL_SCALAR_STRESS_INPUTS = Object.freeze({
  timeDerivative: 0.5,
  radialDerivative: 0.25,
  potentialEnergyDensity: 0.125,
}) satisfies CanonicalScalarStressInputs;

export function canonicalScalarStressComponents(
  inputs: CanonicalScalarStressInputs = DEFAULT_CANONICAL_SCALAR_STRESS_INPUTS,
): AstroComparatorResult<"EARTH-GRV-004", {
  convention: "metric(-,+,+,+); canonical minimally-coupled scalar";
  energyDensity: number;
  radialPressure: number;
  tangentialPressure: number;
  trace: number;
}> {
  const dt = bounded(inputs.timeDerivative ?? 0.5, "timeDerivative", -1e12, 1e12);
  const dr = bounded(inputs.radialDerivative ?? 0.25, "radialDerivative", -1e12, 1e12);
  const potential = bounded(inputs.potentialEnergyDensity ?? 0.125, "potentialEnergyDensity", -1e24, 1e24);
  const energyDensity = 0.5 * (dt * dt + dr * dr) + potential;
  const radialPressure = 0.5 * (dt * dt + dr * dr) - potential;
  const tangentialPressure = 0.5 * (dt * dt - dr * dr) - potential;
  return comparison("EARTH-GRV-004", "Canonical scalar stress-energy component contract in a local orthonormal frame", {
    convention: "metric(-,+,+,+); canonical minimally-coupled scalar",
    energyDensity,
    radialPressure,
    tangentialPressure,
    trace: -energyDensity + radialPressure + 2 * tangentialPressure,
  }, { covariantEarthActionSupplied: false });
}

export interface SchwarzschildPpnInputs {
  massKg?: number;
  observerRadiusMetres?: number;
  impactParameterMetres?: number;
  orbitSemiMajorAxisMetres?: number;
  orbitEccentricity?: number;
  gamma?: number;
  beta?: number;
}

export const DEFAULT_SCHWARZSCHILD_PPN_INPUTS = Object.freeze({
  massKg: SOLAR_MASS,
  observerRadiusMetres: 6.957e8,
  impactParameterMetres: 6.957e8,
  orbitSemiMajorAxisMetres: 5.790_905e10,
  orbitEccentricity: 0.205_63,
  gamma: 1,
  beta: 1,
}) satisfies SchwarzschildPpnInputs;

export function schwarzschildPpnObservables(
  inputs: SchwarzschildPpnInputs = DEFAULT_SCHWARZSCHILD_PPN_INPUTS,
): AstroComparatorResult<"EARTH-GRV-005", {
  schwarzschildRadiusMetres: number;
  compactness: number;
  gravitationalRedshift: number;
  lightDeflectionRadians: number;
  periapsisAdvanceRadiansPerOrbit: number;
}> {
  const mass = bounded(inputs.massKg ?? SOLAR_MASS, "massKg", 1, 1e45);
  const radius = bounded(inputs.observerRadiusMetres ?? 6.957e8, "observerRadiusMetres", 1e-9, 1e30);
  const impact = bounded(inputs.impactParameterMetres ?? radius, "impactParameterMetres", 1e-9, 1e30);
  const semiMajor = bounded(inputs.orbitSemiMajorAxisMetres ?? 5.790_905e10, "orbitSemiMajorAxisMetres", 1e-9, 1e30);
  const eccentricity = bounded(inputs.orbitEccentricity ?? 0.205_63, "orbitEccentricity", 0, 0.999_999);
  const gamma = bounded(inputs.gamma ?? 1, "gamma", -10, 10);
  const beta = bounded(inputs.beta ?? 1, "beta", -10, 10);
  const schwarzschildRadiusMetres = 2 * G * mass / C ** 2;
  if (radius <= schwarzschildRadiusMetres) throw new RangeError("observerRadiusMetres must exceed the Schwarzschild radius");
  return comparison("EARTH-GRV-005", "Schwarzschild and first-PPN observable formula comparator", {
    schwarzschildRadiusMetres,
    compactness: G * mass / (radius * C ** 2),
    gravitationalRedshift: 1 / Math.sqrt(1 - schwarzschildRadiusMetres / radius) - 1,
    lightDeflectionRadians: 2 * (1 + gamma) * G * mass / (impact * C ** 2),
    periapsisAdvanceRadiansPerOrbit: 2 * Math.PI * (2 + 2 * gamma - beta) * G * mass
      / (semiMajor * (1 - eccentricity ** 2) * C ** 2),
  }, { ppnParametersUserSupplied: true, earthFieldEquationsSupplied: false });
}

export interface WaveDispersionInputs {
  waveNumbers?: readonly number[];
  propagationSpeed?: number;
  cutoffAngularFrequency?: number;
}

export const DEFAULT_WAVE_DISPERSION_INPUTS = Object.freeze({
  waveNumbers: [0.25, 0.5, 1, 2, 4],
  propagationSpeed: 1,
  cutoffAngularFrequency: 0,
}) satisfies WaveDispersionInputs;

export function waveDispersionComparator(
  inputs: WaveDispersionInputs = DEFAULT_WAVE_DISPERSION_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-GRV-006", {
  relation: "omega^2=c_w^2*k^2+omega_0^2";
  series: Array<{ waveNumber: number; angularFrequency: number; phaseSpeed: number; groupSpeed: number; nullResidual: number }>;
}> {
  const waveNumbers = boundedValues(inputs.waveNumbers ?? DEFAULT_WAVE_DISPERSION_INPUTS.waveNumbers, "waveNumbers", 1, 4096, 1e-12, 1e12);
  const speed = bounded(inputs.propagationSpeed ?? 1, "propagationSpeed", 1e-12, C);
  const cutoff = bounded(inputs.cutoffAngularFrequency ?? 0, "cutoffAngularFrequency", 0, 1e30);
  const series = waveNumbers.map((waveNumber) => {
    checkCancelled(options);
    const angularFrequency = Math.hypot(speed * waveNumber, cutoff);
    return {
      waveNumber,
      angularFrequency,
      phaseSpeed: angularFrequency / waveNumber,
      groupSpeed: speed ** 2 * waveNumber / angularFrequency,
      nullResidual: angularFrequency ** 2 - speed ** 2 * waveNumber ** 2 - cutoff ** 2,
    };
  });
  return comparison("EARTH-GRV-006", "Scalar Klein-Gordon dispersion benchmark, not a tensor-mode derivation", {
    relation: "omega^2=c_w^2*k^2+omega_0^2",
    series,
  }, { tensorPolarizationsDerived: false });
}

export interface FlatLambdaCdmInputs {
  hubbleKilometresPerSecondPerMegaparsec?: number;
  omegaMatter?: number;
  redshifts?: readonly number[];
  quadratureSteps?: number;
}

export const DEFAULT_FLAT_LAMBDA_CDM_INPUTS = Object.freeze({
  hubbleKilometresPerSecondPerMegaparsec: 70,
  omegaMatter: 0.3,
  redshifts: [0, 0.5, 1, 2],
  quadratureSteps: 512,
}) satisfies FlatLambdaCdmInputs;

function simpsonIntegral(end: number, steps: number, integrand: (x: number) => number, options: EarthRunOptions): number {
  if (end === 0) return 0;
  const width = end / steps;
  let sum = integrand(0) + integrand(end);
  for (let index = 1; index < steps; index += 1) {
    if ((index & 63) === 0) checkCancelled(options);
    sum += (index % 2 === 0 ? 2 : 4) * integrand(index * width);
  }
  return sum * width / 3;
}

export function flatLambdaCdmBackground(
  inputs: FlatLambdaCdmInputs = DEFAULT_FLAT_LAMBDA_CDM_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-COS-002", {
  omegaLambda: number;
  hubbleTimeGyr: number;
  series: Array<{ redshift: number; hubbleKilometresPerSecondPerMegaparsec: number; comovingDistanceMegaparsecs: number; lookbackTimeGyr: number }>;
}> {
  const hubble = bounded(inputs.hubbleKilometresPerSecondPerMegaparsec ?? 70, "hubbleKilometresPerSecondPerMegaparsec", 1, 1e4);
  const omegaMatter = bounded(inputs.omegaMatter ?? 0.3, "omegaMatter", 1e-6, 0.999_999);
  const omegaLambda = 1 - omegaMatter;
  const redshifts = boundedValues(inputs.redshifts ?? DEFAULT_FLAT_LAMBDA_CDM_INPUTS.redshifts, "redshifts", 1, 128, 0, 100);
  const steps = boundedInteger(inputs.quadratureSteps ?? 512, "quadratureSteps", 32, 8192);
  if (steps % 2 !== 0) throw new RangeError("quadratureSteps must be even");
  const hubbleSi = hubble * 1_000 / MEGAPARSEC;
  const expansion = (redshift: number) => Math.sqrt(omegaMatter * (1 + redshift) ** 3 + omegaLambda);
  const series = redshifts.map((redshift) => {
    checkCancelled(options);
    return {
      redshift,
      hubbleKilometresPerSecondPerMegaparsec: hubble * expansion(redshift),
      comovingDistanceMegaparsecs: C / hubbleSi * simpsonIntegral(redshift, steps, (z) => 1 / expansion(z), options) / MEGAPARSEC,
      lookbackTimeGyr: simpsonIntegral(redshift, steps, (z) => 1 / ((1 + z) * expansion(z)), options) / hubbleSi / (1e9 * YEAR),
    };
  });
  return comparison("EARTH-COS-002", "Flat matter-plus-Lambda FLRW background evaluated by bounded Simpson quadrature", {
    omegaLambda,
    hubbleTimeGyr: 1 / hubbleSi / (1e9 * YEAR),
    series,
  }, { flatnessAssumed: true, radiationIncluded: false });
}

export interface LinearGrowthInputs {
  omegaMatter?: number;
  initialScaleFactor?: number;
  finalScaleFactor?: number;
  steps?: number;
}

export const DEFAULT_LINEAR_GROWTH_INPUTS = Object.freeze({
  omegaMatter: 0.3,
  initialScaleFactor: 1e-3,
  finalScaleFactor: 1,
  steps: 2048,
}) satisfies LinearGrowthInputs;

export function linearGrowthComparator(
  inputs: LinearGrowthInputs = DEFAULT_LINEAR_GROWTH_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-COS-003", {
  normalizedGrowth: number;
  logarithmicGrowthRate: number;
  omegaMatterFinal: number;
}> {
  const omegaMatter = bounded(inputs.omegaMatter ?? 0.3, "omegaMatter", 1e-6, 0.999_999);
  const initial = bounded(inputs.initialScaleFactor ?? 1e-3, "initialScaleFactor", 1e-6, 0.5);
  const final = bounded(inputs.finalScaleFactor ?? 1, "finalScaleFactor", initial + 1e-6, 1);
  const steps = boundedInteger(inputs.steps ?? 2048, "steps", 32, 65_536);
  const omegaLambda = 1 - omegaMatter;
  const dx = Math.log(final / initial) / steps;
  let x = Math.log(initial);
  let growth = initial;
  let derivative = initial;
  const rates = (logA: number, d: number, v: number): [number, number] => {
    const a = Math.exp(logA);
    const matterFraction = omegaMatter * a ** -3 / (omegaMatter * a ** -3 + omegaLambda);
    return [v, -(2 - 1.5 * matterFraction) * v + 1.5 * matterFraction * d];
  };
  for (let index = 0; index < steps; index += 1) {
    if ((index & 63) === 0) checkCancelled(options);
    const k1 = rates(x, growth, derivative);
    const k2 = rates(x + dx / 2, growth + dx * k1[0] / 2, derivative + dx * k1[1] / 2);
    const k3 = rates(x + dx / 2, growth + dx * k2[0] / 2, derivative + dx * k2[1] / 2);
    const k4 = rates(x + dx, growth + dx * k3[0], derivative + dx * k3[1]);
    growth += dx * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
    derivative += dx * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
    x += dx;
  }
  const omegaMatterFinal = omegaMatter * final ** -3 / (omegaMatter * final ** -3 + omegaLambda);
  return comparison("EARTH-COS-003", "Scale-independent growing-mode equation in a flat standard matter-plus-Lambda background", {
    normalizedGrowth: growth / final,
    logarithmicGrowthRate: derivative / growth,
    omegaMatterFinal,
  }, { boltzmannSpeciesEvolved: false, transferFunctionClaim: false });
}

export interface SachsWolfeInputs {
  scalarAmplitude?: number;
  minimumMultipole?: number;
  maximumMultipole?: number;
}

export const DEFAULT_SACHS_WOLFE_INPUTS = Object.freeze({
  scalarAmplitude: 2.1e-9,
  minimumMultipole: 2,
  maximumMultipole: 30,
}) satisfies SachsWolfeInputs;

export function toySachsWolfeSpectrum(
  inputs: SachsWolfeInputs = DEFAULT_SACHS_WOLFE_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-COS-004", {
  approximation: "l(l+1)C_l/(2*pi)=A_s/25";
  series: Array<{ multipole: number; angularPower: number; scaledPower: number }>;
}> {
  const amplitude = bounded(inputs.scalarAmplitude ?? 2.1e-9, "scalarAmplitude", 1e-20, 1);
  const minimum = boundedInteger(inputs.minimumMultipole ?? 2, "minimumMultipole", 2, 4096);
  const maximum = boundedInteger(inputs.maximumMultipole ?? 30, "maximumMultipole", minimum, 4096);
  const series = Array.from({ length: maximum - minimum + 1 }, (_, offset) => {
    checkCancelled(options);
    const multipole = minimum + offset;
    const angularPower = 2 * Math.PI * amplitude / (25 * multipole * (multipole + 1));
    return { multipole, angularPower, scaledPower: multipole * (multipole + 1) * angularPower / (2 * Math.PI) };
  });
  return comparison("EARTH-COS-004", "Large-angle scale-invariant Sachs-Wolfe toy spectrum", {
    approximation: "l(l+1)C_l/(2*pi)=A_s/25",
    series,
  }, { likelihoodEvaluated: false, acousticPhysicsIncluded: false });
}

export interface BaoToyInputs {
  minimumSeparationMegaparsecs?: number;
  maximumSeparationMegaparsecs?: number;
  samples?: number;
  peakSeparationMegaparsecs?: number;
  peakWidthMegaparsecs?: number;
  peakAmplitude?: number;
}

export const DEFAULT_BAO_TOY_INPUTS = Object.freeze({
  minimumSeparationMegaparsecs: 40,
  maximumSeparationMegaparsecs: 160,
  samples: 241,
  peakSeparationMegaparsecs: 105,
  peakWidthMegaparsecs: 10,
  peakAmplitude: 0.01,
}) satisfies BaoToyInputs;

export function baoToyCorrelation(
  inputs: BaoToyInputs = DEFAULT_BAO_TOY_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-COS-005", {
  peakSeparationMegaparsecs: number;
  series: Array<{ separationMegaparsecs: number; smoothBaseline: number; baoExcess: number; correlation: number }>;
}> {
  const minimum = bounded(inputs.minimumSeparationMegaparsecs ?? 40, "minimumSeparationMegaparsecs", 0.1, 1e4);
  const maximum = bounded(inputs.maximumSeparationMegaparsecs ?? 160, "maximumSeparationMegaparsecs", minimum + 1e-6, 1e4);
  const samples = boundedInteger(inputs.samples ?? 241, "samples", 3, 8193);
  const peak = bounded(inputs.peakSeparationMegaparsecs ?? 105, "peakSeparationMegaparsecs", minimum, maximum);
  const width = bounded(inputs.peakWidthMegaparsecs ?? 10, "peakWidthMegaparsecs", 1e-3, maximum - minimum);
  const amplitude = bounded(inputs.peakAmplitude ?? 0.01, "peakAmplitude", 0, 1e6);
  const series = linearSamples(minimum, maximum, samples).map((separationMegaparsecs) => {
    checkCancelled(options);
    const smoothBaseline = 0.002 * (separationMegaparsecs / 100) ** -2;
    const baoExcess = amplitude * Math.exp(-0.5 * ((separationMegaparsecs - peak) / width) ** 2);
    return { separationMegaparsecs, smoothBaseline, baoExcess, correlation: smoothBaseline + baoExcess };
  });
  const peakRow = series.reduce((best, row) => row.baoExcess > best.baoExcess ? row : best);
  return comparison("EARTH-COS-005", "Bounded smooth-plus-Gaussian BAO correlation toy", {
    peakSeparationMegaparsecs: peakRow.separationMegaparsecs,
    series,
  }, { surveySelectionIncluded: false, nonlinearEvolutionIncluded: false });
}

export interface PlanetShellInputs {
  observedRadiusMetres?: number;
  shellScaleMetres?: number;
  shellCount?: number;
  shellCountDerivedFromObservedRadius?: boolean;
  shellScaleDerivedFromObservedRadius?: boolean;
}

export const DEFAULT_PLANET_SHELL_INPUTS = Object.freeze({
  observedRadiusMetres: 6.371e6,
  shellScaleMetres: 1e6,
  shellCount: 6,
  shellCountDerivedFromObservedRadius: false,
  shellScaleDerivedFromObservedRadius: false,
}) satisfies PlanetShellInputs;

export function planetShellCircularityAudit(
  inputs: PlanetShellInputs = DEFAULT_PLANET_SHELL_INPUTS,
): AstroComparatorResult<"EARTH-PLAN-001", {
  predictedRadiusMetres: number;
  absoluteResidualMetres: number;
  fractionalResidual: number;
  circular: boolean;
  eligibleAsIndependentResidual: boolean;
}> {
  const observed = bounded(inputs.observedRadiusMetres ?? 6.371e6, "observedRadiusMetres", 1, 1e12);
  const scale = bounded(inputs.shellScaleMetres ?? 1e6, "shellScaleMetres", 1e-9, 1e12);
  const count = boundedInteger(inputs.shellCount ?? 6, "shellCount", 1, 1_000_000);
  const countCircular = flag(inputs.shellCountDerivedFromObservedRadius ?? false, "shellCountDerivedFromObservedRadius");
  const scaleCircular = flag(inputs.shellScaleDerivedFromObservedRadius ?? false, "shellScaleDerivedFromObservedRadius");
  const circular = countCircular || scaleCircular;
  const predictedRadiusMetres = scale * count;
  return comparison("EARTH-PLAN-001", "Integer shell-radius arithmetic with explicit target-leakage flags", {
    predictedRadiusMetres,
    absoluteResidualMetres: predictedRadiusMetres - observed,
    fractionalResidual: (predictedRadiusMetres - observed) / observed,
    circular,
    eligibleAsIndependentResidual: !circular,
  }, { targetLeakage: circular });
}

export interface ProfileBoundaryDatum { id: string; densityBelow: number; densityAbove: number; claimedRatio?: number }
export interface ProfileBoundaryRatioInputs { boundaries?: readonly ProfileBoundaryDatum[] }

export const DEFAULT_PROFILE_BOUNDARY_RATIO_INPUTS = Object.freeze({
  boundaries: [{ id: "standard-step", densityBelow: 12, densityAbove: 10, claimedRatio: 1.2 }],
}) satisfies ProfileBoundaryRatioInputs;

export function profileBoundaryRatioAudit(
  inputs: ProfileBoundaryRatioInputs = DEFAULT_PROFILE_BOUNDARY_RATIO_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-PLAN-002", {
  series: Array<{ id: string; ratioBelowToAbove: number; claimedRatio: number | null; relativeResidual: number | null }>;
}> {
  const boundaries = inputs.boundaries ?? DEFAULT_PROFILE_BOUNDARY_RATIO_INPUTS.boundaries;
  if (!Array.isArray(boundaries) || boundaries.length < 1 || boundaries.length > 1024) throw new RangeError("boundaries must contain 1 to 1024 entries");
  const ids = new Set<string>();
  const series = boundaries.map((datum, index) => {
    checkCancelled(options);
    const id = text(datum.id, `boundaries[${index}].id`);
    if (ids.has(id)) throw new RangeError(`boundary id must be unique: ${id}`);
    ids.add(id);
    const below = bounded(datum.densityBelow, `boundaries[${index}].densityBelow`, 1e-30, 1e30);
    const above = bounded(datum.densityAbove, `boundaries[${index}].densityAbove`, 1e-30, 1e30);
    const claimedRatio = datum.claimedRatio === undefined ? null : bounded(datum.claimedRatio, `boundaries[${index}].claimedRatio`, 1e-30, 1e30);
    const ratioBelowToAbove = below / above;
    return { id, ratioBelowToAbove, claimedRatio, relativeResidual: claimedRatio === null ? null : relativeError(ratioBelowToAbove, claimedRatio) };
  });
  return comparison("EARTH-PLAN-002", "User-profile density ratios evaluated on consistently oriented boundary pairs", { series }, {
    authenticatedProfileBundled: false,
  });
}

export interface HydrostaticSphereInputs { radiusMetres?: number; densityKgPerCubicMetre?: number; samples?: number }
export const DEFAULT_HYDROSTATIC_SPHERE_INPUTS = Object.freeze({ radiusMetres: 1e6, densityKgPerCubicMetre: 5_500, samples: 65 }) satisfies HydrostaticSphereInputs;

export function newtonianHydrostaticSphere(
  inputs: HydrostaticSphereInputs = DEFAULT_HYDROSTATIC_SPHERE_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-PLAN-003", {
  totalMassKg: number;
  centralPressurePascals: number;
  series: Array<{ radiusMetres: number; enclosedMassKg: number; gravityMetresPerSecondSquared: number; pressurePascals: number }>;
}> {
  const radius = bounded(inputs.radiusMetres ?? 1e6, "radiusMetres", 1, 1e10);
  const density = bounded(inputs.densityKgPerCubicMetre ?? 5_500, "densityKgPerCubicMetre", 1e-12, 1e12);
  const samples = boundedInteger(inputs.samples ?? 65, "samples", 3, 4097);
  const centralPressurePascals = 2 * Math.PI * G * density ** 2 * radius ** 2 / 3;
  const series = linearSamples(0, radius, samples).map((r) => {
    checkCancelled(options);
    const enclosedMassKg = 4 * Math.PI * density * r ** 3 / 3;
    return {
      radiusMetres: r,
      enclosedMassKg,
      gravityMetresPerSecondSquared: r === 0 ? 0 : G * enclosedMassKg / r ** 2,
      pressurePascals: 2 * Math.PI * G * density ** 2 * (radius ** 2 - r ** 2) / 3,
    };
  });
  return comparison("EARTH-PLAN-003", "Analytic constant-density Newtonian hydrostatic sphere; no TOV or material EOS", {
    totalMassKg: 4 * Math.PI * density * radius ** 3 / 3,
    centralPressurePascals,
    series,
  }, { tovSolved: false, materialEquationOfStateUsed: false });
}

export interface ShearWaveInputs { lengthMetres?: number; densityKgPerCubicMetre?: number; shearModulusPascals?: number; modes?: number }
export const DEFAULT_SHEAR_WAVE_INPUTS = Object.freeze({ lengthMetres: 1_000, densityKgPerCubicMetre: 3_300, shearModulusPascals: 60e9, modes: 8 }) satisfies ShearWaveInputs;

export function shearWaveBenchmark(
  inputs: ShearWaveInputs = DEFAULT_SHEAR_WAVE_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-PLAN-004", {
  shearSpeedMetresPerSecond: number;
  modes: Array<{ mode: number; wavelengthMetres: number; frequencyHertz: number }>;
}> {
  const length = bounded(inputs.lengthMetres ?? 1_000, "lengthMetres", 1e-6, 1e12);
  const density = bounded(inputs.densityKgPerCubicMetre ?? 3_300, "densityKgPerCubicMetre", 1e-12, 1e12);
  const modulus = bounded(inputs.shearModulusPascals ?? 60e9, "shearModulusPascals", 1e-12, 1e30);
  const modeCount = boundedInteger(inputs.modes ?? 8, "modes", 1, 4096);
  const speed = Math.sqrt(modulus / density);
  const modes = Array.from({ length: modeCount }, (_, index) => {
    checkCancelled(options);
    const mode = index + 1;
    const wavelengthMetres = 2 * length / mode;
    return { mode, wavelengthMetres, frequencyHertz: speed / wavelengthMetres };
  });
  return comparison("EARTH-PLAN-004", "Fixed-end one-dimensional linear elastic shear-wave benchmark", {
    shearSpeedMetresPerSecond: speed,
    modes,
  }, { sphericalShellSolved: false, viscosityIncluded: false });
}

export interface DynamoScalingInputs {
  velocityMetresPerSecond?: number;
  rotationRadiansPerSecond?: number;
  lengthMetres?: number;
  magneticDiffusivitySquareMetresPerSecond?: number;
  densityKgPerCubicMetre?: number;
  magneticFieldTesla?: number;
}
export const DEFAULT_DYNAMO_SCALING_INPUTS = Object.freeze({
  velocityMetresPerSecond: 1e-4,
  rotationRadiansPerSecond: 7.292_115e-5,
  lengthMetres: 2.2e6,
  magneticDiffusivitySquareMetresPerSecond: 1,
  densityKgPerCubicMetre: 11_000,
  magneticFieldTesla: 3e-3,
}) satisfies DynamoScalingInputs;

export function dynamoScalingComparator(
  inputs: DynamoScalingInputs = DEFAULT_DYNAMO_SCALING_INPUTS,
): AstroComparatorResult<"EARTH-PLAN-006", {
  rossbyNumber: number;
  magneticReynoldsNumber: number;
  elsasserNumber: number;
}> {
  const velocity = bounded(inputs.velocityMetresPerSecond ?? 1e-4, "velocityMetresPerSecond", 1e-20, 1e8);
  const rotation = bounded(inputs.rotationRadiansPerSecond ?? 7.292_115e-5, "rotationRadiansPerSecond", 1e-20, 1e6);
  const length = bounded(inputs.lengthMetres ?? 2.2e6, "lengthMetres", 1e-12, 1e12);
  const diffusivity = bounded(inputs.magneticDiffusivitySquareMetresPerSecond ?? 1, "magneticDiffusivitySquareMetresPerSecond", 1e-20, 1e20);
  const density = bounded(inputs.densityKgPerCubicMetre ?? 11_000, "densityKgPerCubicMetre", 1e-20, 1e20);
  const field = bounded(inputs.magneticFieldTesla ?? 3e-3, "magneticFieldTesla", 0, 1e12);
  const mu0 = 4e-7 * Math.PI;
  return comparison("EARTH-PLAN-006", "Dimensionless rotating-conducting-fluid scaling contract", {
    rossbyNumber: velocity / (rotation * length),
    magneticReynoldsNumber: velocity * length / diffusivity,
    elsasserNumber: field ** 2 / (density * mu0 * diffusivity * rotation),
  }, { mhdEquationsSolved: false, reversalsPredicted: false });
}

export interface OrbitalRatioInputs { ratios?: readonly number[]; ratioBase?: number; minimumExponent?: number; maximumExponent?: number }
export const DEFAULT_ORBITAL_RATIO_INPUTS = Object.freeze({ ratios: [1, 1.5, 2, 3], ratioBase: 2 ** (1 / 3), minimumExponent: -12, maximumExponent: 12 }) satisfies OrbitalRatioInputs;

export function orbitalRatioMultiplicityAudit(
  inputs: OrbitalRatioInputs = DEFAULT_ORBITAL_RATIO_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-PLAN-007", {
  testedPowers: number;
  series: Array<{ ratio: number; nearestExponent: number; nearestPower: number; logResidual: number; multiplicityCorrectedScore: number }>;
}> {
  const ratios = boundedValues(inputs.ratios ?? DEFAULT_ORBITAL_RATIO_INPUTS.ratios, "ratios", 1, 4096, 1e-12, 1e12);
  const base = bounded(inputs.ratioBase ?? 2 ** (1 / 3), "ratioBase", 1.000_001, 100);
  const minimum = boundedInteger(inputs.minimumExponent ?? -12, "minimumExponent", -128, 128);
  const maximum = boundedInteger(inputs.maximumExponent ?? 12, "maximumExponent", minimum, 128);
  const testedPowers = maximum - minimum + 1;
  const series = ratios.map((ratio) => {
    checkCancelled(options);
    const nearestExponent = Math.max(minimum, Math.min(maximum, Math.round(Math.log(ratio) / Math.log(base))));
    const nearestPower = base ** nearestExponent;
    const logResidual = Math.abs(Math.log(ratio / nearestPower));
    return { ratio, nearestExponent, nearestPower, logResidual, multiplicityCorrectedScore: Math.min(1, testedPowers * logResidual) };
  });
  return comparison("EARTH-PLAN-007", "Nearest predeclared orbital-ratio powers with a bounded look-elsewhere correction", {
    testedPowers,
    series,
  }, { exponentRangePredeclared: true, catalogBundled: false });
}

export interface JeansEscapeInputs {
  planetMassKg?: number;
  exobaseRadiusMetres?: number;
  exobaseTemperatureKelvin?: number;
  particleMassKg?: number;
  numberDensityPerCubicMetre?: number;
}
export const DEFAULT_JEANS_ESCAPE_INPUTS = Object.freeze({
  planetMassKg: 5.9722e24,
  exobaseRadiusMetres: 6.5e6,
  exobaseTemperatureKelvin: 1_000,
  particleMassKg: PROTON_MASS,
  numberDensityPerCubicMetre: 1e12,
}) satisfies JeansEscapeInputs;

export function jeansEscapeComparator(
  inputs: JeansEscapeInputs = DEFAULT_JEANS_ESCAPE_INPUTS,
): AstroComparatorResult<"EARTH-PLAN-011", {
  jeansParameter: number;
  mostProbableThermalSpeedMetresPerSecond: number;
  escapeFluxPerSquareMetrePerSecond: number;
}> {
  const mass = bounded(inputs.planetMassKg ?? 5.9722e24, "planetMassKg", 1, 1e35);
  const radius = bounded(inputs.exobaseRadiusMetres ?? 6.5e6, "exobaseRadiusMetres", 1, 1e12);
  const temperature = bounded(inputs.exobaseTemperatureKelvin ?? 1_000, "exobaseTemperatureKelvin", 1, 1e9);
  const particleMass = bounded(inputs.particleMassKg ?? PROTON_MASS, "particleMassKg", 1e-32, 1e-20);
  const numberDensity = bounded(inputs.numberDensityPerCubicMetre ?? 1e12, "numberDensityPerCubicMetre", 0, 1e40);
  const jeansParameter = G * mass * particleMass / (K_B * temperature * radius);
  const thermalSpeed = Math.sqrt(2 * K_B * temperature / particleMass);
  return comparison("EARTH-PLAN-011", "Collisionless Maxwellian Jeans escape at a user-specified exobase", {
    jeansParameter,
    mostProbableThermalSpeedMetresPerSecond: thermalSpeed,
    escapeFluxPerSquareMetrePerSecond: numberDensity * thermalSpeed * (1 + jeansParameter) * Math.exp(-jeansParameter) / (2 * Math.sqrt(Math.PI)),
  }, { hydrodynamicEscapeSolved: false, atmosphericProfileBundled: false });
}

export interface MassRadiusDatum { id: string; massSolar: number; radiusSolar: number }
export interface StellarMassRadiusInputs { data?: readonly MassRadiusDatum[]; normalization?: number; exponent?: number }
export const DEFAULT_STELLAR_MASS_RADIUS_INPUTS = Object.freeze({
  data: [{ id: "unit-standard", massSolar: 1, radiusSolar: 1 }, { id: "power-standard", massSolar: 2, radiusSolar: 2 ** 0.8 }],
  normalization: 1,
  exponent: 0.8,
}) satisfies StellarMassRadiusInputs;

export function stellarMassRadiusResidualAudit(
  inputs: StellarMassRadiusInputs = DEFAULT_STELLAR_MASS_RADIUS_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-STAR-001", {
  rootMeanSquareResidualDex: number;
  series: Array<{ id: string; predictedRadiusSolar: number; residualDex: number }>;
}> {
  const data = inputs.data ?? DEFAULT_STELLAR_MASS_RADIUS_INPUTS.data;
  if (!Array.isArray(data) || data.length < 1 || data.length > 4096) throw new RangeError("data must contain 1 to 4096 entries");
  const normalization = bounded(inputs.normalization ?? 1, "normalization", 1e-12, 1e12);
  const exponent = bounded(inputs.exponent ?? 0.8, "exponent", -10, 10);
  const ids = new Set<string>();
  const series = data.map((datum, index) => {
    checkCancelled(options);
    const id = text(datum.id, `data[${index}].id`);
    if (ids.has(id)) throw new RangeError(`datum id must be unique: ${id}`);
    ids.add(id);
    const mass = bounded(datum.massSolar, `data[${index}].massSolar`, 1e-6, 1e6);
    const radius = bounded(datum.radiusSolar, `data[${index}].radiusSolar`, 1e-6, 1e6);
    const predictedRadiusSolar = normalization * mass ** exponent;
    return { id, predictedRadiusSolar, residualDex: Math.log10(radius / predictedRadiusSolar) };
  });
  return comparison("EARTH-STAR-001", "User-data residuals against a frozen normalized stellar mass-radius power law", {
    rootMeanSquareResidualDex: rms(series.map(({ residualDex }) => residualDex)),
    series,
  }, { projectionDefinedByUser: true, catalogBundled: false });
}

export interface LaneEmdenInputs { polytropicIndex?: number; stepSize?: number; maximumXi?: number }
export const DEFAULT_LANE_EMDEN_INPUTS = Object.freeze({ polytropicIndex: 1, stepSize: 0.002, maximumXi: 10 }) satisfies LaneEmdenInputs;

export function laneEmdenPolytrope(
  inputs: LaneEmdenInputs = DEFAULT_LANE_EMDEN_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-STAR-002", {
  firstZeroXi: number;
  dimensionlessMass: number;
  pointsComputed: number;
}> {
  const index = bounded(inputs.polytropicIndex ?? 1, "polytropicIndex", 0, 4.9);
  const step = bounded(inputs.stepSize ?? 0.002, "stepSize", 1e-5, 0.05);
  const maximumXi = bounded(inputs.maximumXi ?? 10, "maximumXi", 1, 100);
  const maximumSteps = Math.ceil(maximumXi / step);
  if (maximumSteps > 1_000_000) throw new RangeError("maximumXi/stepSize must not exceed 1000000");
  let xi = step;
  let theta = 1 - xi ** 2 / 6 + index * xi ** 4 / 120;
  let derivative = -xi / 3 + index * xi ** 3 / 30;
  let previousXi = 0;
  let previousTheta = 1;
  let previousDerivative = 0;
  let pointsComputed = 1;
  const rates = (x: number, y: number, dy: number): [number, number] => [dy, -2 * dy / x - Math.max(0, y) ** index];
  checkCancelled(options);
  while (theta > 0 && xi < maximumXi) {
    if ((pointsComputed & 255) === 0) checkCancelled(options);
    previousXi = xi;
    previousTheta = theta;
    previousDerivative = derivative;
    const k1 = rates(xi, theta, derivative);
    const k2 = rates(xi + step / 2, theta + step * k1[0] / 2, derivative + step * k1[1] / 2);
    const k3 = rates(xi + step / 2, theta + step * k2[0] / 2, derivative + step * k2[1] / 2);
    const k4 = rates(xi + step, theta + step * k3[0], derivative + step * k3[1]);
    theta += step * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
    derivative += step * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
    xi += step;
    pointsComputed += 1;
  }
  if (theta > 0) throw new RangeError("maximumXi is too small to reach the first zero");
  const fraction = previousTheta / (previousTheta - theta);
  const firstZeroXi = previousXi + fraction * step;
  const zeroDerivative = previousDerivative + fraction * (derivative - previousDerivative);
  return comparison("EARTH-STAR-002", "Dimensionless Newtonian Lane-Emden polytrope integrated by RK4", {
    firstZeroXi,
    dimensionlessMass: -(firstZeroXi ** 2) * zeroDerivative,
    pointsComputed,
  }, { opacityIncluded: false, nuclearEnergyGenerationIncluded: false });
}

export interface HrDatum { id: string; massSolar: number; luminositySolar: number; heldOut?: boolean }
export interface HrRegressionInputs { data?: readonly HrDatum[] }
export const DEFAULT_HR_REGRESSION_INPUTS = Object.freeze({
  data: [
    { id: "train-1", massSolar: 0.5, luminositySolar: 0.5 ** 4, heldOut: false },
    { id: "train-2", massSolar: 1, luminositySolar: 1, heldOut: false },
    { id: "train-3", massSolar: 2, luminositySolar: 16, heldOut: false },
    { id: "held-out", massSolar: 3, luminositySolar: 81, heldOut: true },
  ],
}) satisfies HrRegressionInputs;

export function hrMassLuminosityRegression(
  inputs: HrRegressionInputs = DEFAULT_HR_REGRESSION_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-STAR-004", {
  exponent: number;
  normalization: number;
  trainingScatterDex: number;
  heldOutRootMeanSquareErrorDex: number | null;
}> {
  const data = inputs.data ?? DEFAULT_HR_REGRESSION_INPUTS.data;
  if (!Array.isArray(data) || data.length < 2 || data.length > 4096) throw new RangeError("data must contain 2 to 4096 entries");
  const rows = data.map((datum, index) => {
    checkCancelled(options);
    return {
      x: Math.log10(bounded(datum.massSolar, `data[${index}].massSolar`, 1e-6, 1e6)),
      y: Math.log10(bounded(datum.luminositySolar, `data[${index}].luminositySolar`, 1e-12, 1e18)),
      heldOut: flag(datum.heldOut ?? false, `data[${index}].heldOut`),
    };
  });
  const training = rows.filter(({ heldOut }) => !heldOut);
  if (training.length < 2) throw new RangeError("data must contain at least two training entries");
  const meanX = training.reduce((sum, row) => sum + row.x, 0) / training.length;
  const meanY = training.reduce((sum, row) => sum + row.y, 0) / training.length;
  const xx = training.reduce((sum, row) => sum + (row.x - meanX) ** 2, 0);
  if (xx <= Number.EPSILON) throw new RangeError("training masses must not all be equal");
  const exponent = training.reduce((sum, row) => sum + (row.x - meanX) * (row.y - meanY), 0) / xx;
  const intercept = meanY - exponent * meanX;
  const residuals = rows.map((row) => ({ heldOut: row.heldOut, residual: row.y - intercept - exponent * row.x }));
  const heldOut = residuals.filter((row) => row.heldOut).map(({ residual }) => residual);
  return comparison("EARTH-STAR-004", "Log-space ordinary least-squares mass-luminosity regression on user-designated training rows", {
    exponent,
    normalization: 10 ** intercept,
    trainingScatterDex: rms(residuals.filter((row) => !row.heldOut).map(({ residual }) => residual)),
    heldOutRootMeanSquareErrorDex: heldOut.length === 0 ? null : rms(heldOut),
  }, { catalogBundled: false, selectionFunctionModelled: false });
}

export interface PeriodogramInputs { times?: readonly number[]; values?: readonly number[]; minimumFrequency?: number; maximumFrequency?: number; frequencies?: number }
const DEFAULT_PERIOD_TIMES = Array.from({ length: 64 }, (_, index) => index * 0.25);
const DEFAULT_PERIOD_VALUES = DEFAULT_PERIOD_TIMES.map((time) => Math.sin(2 * Math.PI * 0.2 * time));
export const DEFAULT_PERIODOGRAM_INPUTS = Object.freeze({
  times: DEFAULT_PERIOD_TIMES,
  values: DEFAULT_PERIOD_VALUES,
  minimumFrequency: 0.05,
  maximumFrequency: 1,
  frequencies: 256,
}) satisfies PeriodogramInputs;

export function boundedPeriodogram(
  inputs: PeriodogramInputs = DEFAULT_PERIODOGRAM_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-STAR-005", {
  peakFrequency: number;
  peakPeriod: number;
  peakNormalizedPower: number;
  frequencyTrials: number;
  series: Array<{ frequency: number; normalizedPower: number }>;
}> {
  const times = boundedValues(inputs.times ?? DEFAULT_PERIOD_TIMES, "times", 4, 4096, -1e12, 1e12);
  const values = boundedValues(inputs.values ?? DEFAULT_PERIOD_VALUES, "values", 4, 4096, -1e30, 1e30);
  if (times.length !== values.length) throw new RangeError("times and values must have equal lengths");
  const minimum = bounded(inputs.minimumFrequency ?? 0.05, "minimumFrequency", 1e-12, 1e12);
  const maximum = bounded(inputs.maximumFrequency ?? 1, "maximumFrequency", minimum + 1e-12, 1e12);
  const frequencies = boundedInteger(inputs.frequencies ?? 256, "frequencies", 3, 8192);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (variance <= Number.EPSILON) throw new RangeError("values must have non-zero variance");
  const series = linearSamples(minimum, maximum, frequencies).map((frequency) => {
    checkCancelled(options);
    let cc = 0;
    let ss = 0;
    let yc = 0;
    let ys = 0;
    for (let index = 0; index < times.length; index += 1) {
      if ((index & 255) === 0) checkCancelled(options);
      const phase = 2 * Math.PI * frequency * times[index]!;
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      const centered = values[index]! - mean;
      cc += cosine * cosine;
      ss += sine * sine;
      yc += centered * cosine;
      ys += centered * sine;
    }
    const normalizedPower = (yc ** 2 / Math.max(cc, Number.EPSILON) + ys ** 2 / Math.max(ss, Number.EPSILON)) / variance;
    return { frequency, normalizedPower };
  });
  const peak = series.reduce((best, row) => row.normalizedPower > best.normalizedPower ? row : best);
  return comparison("EARTH-STAR-005", "Bounded mean-centered sinusoidal least-squares periodogram", {
    peakFrequency: peak.frequency,
    peakPeriod: 1 / peak.frequency,
    peakNormalizedPower: peak.normalizedPower,
    frequencyTrials: frequencies,
    series,
  }, { redNoiseNullIncluded: false, multipleFrequencyTrials: frequencies });
}

export interface RadialOscillatorInputs { radiusMetres?: number; soundSpeedMetresPerSecond?: number; modes?: number }
export const DEFAULT_RADIAL_OSCILLATOR_INPUTS = Object.freeze({ radiusMetres: 6.957e8, soundSpeedMetresPerSecond: 2e5, modes: 8 }) satisfies RadialOscillatorInputs;

export function radialOscillatorModes(
  inputs: RadialOscillatorInputs = DEFAULT_RADIAL_OSCILLATOR_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-STAR-006", {
  boundaryCondition: "u(0)=u(R)=0";
  modes: Array<{ radialOrder: number; angularFrequencyRadiansPerSecond: number; periodSeconds: number }>;
}> {
  const radius = bounded(inputs.radiusMetres ?? 6.957e8, "radiusMetres", 1, 1e15);
  const soundSpeed = bounded(inputs.soundSpeedMetresPerSecond ?? 2e5, "soundSpeedMetresPerSecond", 1e-9, C);
  const count = boundedInteger(inputs.modes ?? 8, "modes", 1, 4096);
  const modes = Array.from({ length: count }, (_, index) => {
    checkCancelled(options);
    const radialOrder = index + 1;
    const angularFrequencyRadiansPerSecond = radialOrder * Math.PI * soundSpeed / radius;
    return { radialOrder, angularFrequencyRadiansPerSecond, periodSeconds: 2 * Math.PI / angularFrequencyRadiansPerSecond };
  });
  return comparison("EARTH-STAR-006", "Uniform acoustic-cavity radial oscillator modes with fixed endpoints", {
    boundaryCondition: "u(0)=u(R)=0",
    modes,
  }, { stellarProfileUsed: false, nonradialModesSolved: false });
}

export interface CompactObjectInputs { massKg?: number; radiusMetres?: number }
export const DEFAULT_COMPACT_OBJECT_INPUTS = Object.freeze({ massKg: 1.4 * SOLAR_MASS, radiusMetres: 12_000 }) satisfies CompactObjectInputs;

export function compactObjectFormulaContract(
  inputs: CompactObjectInputs = DEFAULT_COMPACT_OBJECT_INPUTS,
): AstroComparatorResult<"EARTH-STAR-007", {
  schwarzschildRadiusMetres: number;
  compactness: number;
  surfaceRedshift: number | null;
  newtonianBindingEnergyJoules: number;
  outsideHorizon: boolean;
}> {
  const mass = bounded(inputs.massKg ?? 1.4 * SOLAR_MASS, "massKg", 1, 1e40);
  const radius = bounded(inputs.radiusMetres ?? 12_000, "radiusMetres", 1e-6, 1e20);
  const schwarzschildRadiusMetres = 2 * G * mass / C ** 2;
  const outsideHorizon = radius > schwarzschildRadiusMetres;
  return comparison("EARTH-STAR-007", "Compact-object algebra contract; no collapse, TOV, neutrino, shock, or kick evolution", {
    schwarzschildRadiusMetres,
    compactness: G * mass / (radius * C ** 2),
    surfaceRedshift: outsideHorizon ? 1 / Math.sqrt(1 - schwarzschildRadiusMetres / radius) - 1 : null,
    newtonianBindingEnergyJoules: 3 * G * mass ** 2 / (5 * radius),
    outsideHorizon,
  }, { tovSolved: false, collapseSimulated: false });
}

export interface GalaxyMorphologyDatum { id: string; observedPitchDegrees: number; predictedPitchDegrees: number; observedClass: string; predictedClass: string }
export interface GalaxyMorphologyInputs { data?: readonly GalaxyMorphologyDatum[] }
export const DEFAULT_GALAXY_MORPHOLOGY_INPUTS = Object.freeze({
  data: [
    { id: "spiral-a", observedPitchDegrees: 15, predictedPitchDegrees: 14, observedClass: "spiral", predictedClass: "spiral" },
    { id: "barred-b", observedPitchDegrees: 25, predictedPitchDegrees: 27, observedClass: "barred", predictedClass: "barred" },
  ],
}) satisfies GalaxyMorphologyInputs;

export function galaxyMorphologyPitchResidualAudit(
  inputs: GalaxyMorphologyInputs = DEFAULT_GALAXY_MORPHOLOGY_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-GAL-001", {
  pitchRootMeanSquareErrorDegrees: number;
  morphologyAccuracy: number;
  series: Array<{ id: string; pitchResidualDegrees: number; morphologyMatch: boolean }>;
}> {
  const data = inputs.data ?? DEFAULT_GALAXY_MORPHOLOGY_INPUTS.data;
  if (!Array.isArray(data) || data.length < 1 || data.length > 4096) throw new RangeError("data must contain 1 to 4096 entries");
  const ids = new Set<string>();
  const series = data.map((datum, index) => {
    checkCancelled(options);
    const id = text(datum.id, `data[${index}].id`);
    if (ids.has(id)) throw new RangeError(`datum id must be unique: ${id}`);
    ids.add(id);
    const observed = bounded(datum.observedPitchDegrees, `data[${index}].observedPitchDegrees`, -90, 90);
    const predicted = bounded(datum.predictedPitchDegrees, `data[${index}].predictedPitchDegrees`, -90, 90);
    return {
      id,
      pitchResidualDegrees: predicted - observed,
      morphologyMatch: text(datum.observedClass, `data[${index}].observedClass`) === text(datum.predictedClass, `data[${index}].predictedClass`),
    };
  });
  return comparison("EARTH-GAL-001", "User-data pitch-angle residuals and exact morphology-label agreement", {
    pitchRootMeanSquareErrorDegrees: rms(series.map(({ pitchResidualDegrees }) => pitchResidualDegrees)),
    morphologyAccuracy: series.filter(({ morphologyMatch }) => morphologyMatch).length / series.length,
    series,
  }, { deprojectionPerformed: false, imageCatalogBundled: false });
}

export interface DiskDensityModeInputs { surfaceDensityKgPerSquareMetre?: number; epicyclicFrequencyRadiansPerSecond?: number; radialDispersionMetresPerSecond?: number; waveNumberPerMetre?: number }
export const DEFAULT_DISK_DENSITY_MODE_INPUTS = Object.freeze({
  surfaceDensityKgPerSquareMetre: 1,
  epicyclicFrequencyRadiansPerSecond: 1e-15,
  radialDispersionMetresPerSecond: 10_000,
  waveNumberPerMetre: 1e-20,
}) satisfies DiskDensityModeInputs;

export function linearDiskDensityMode(
  inputs: DiskDensityModeInputs = DEFAULT_DISK_DENSITY_MODE_INPUTS,
): AstroComparatorResult<"EARTH-GAL-002", {
  dispersionAngularFrequencySquared: number;
  stable: boolean;
  oscillationAngularFrequency: number | null;
  growthRatePerSecond: number | null;
}> {
  const density = bounded(inputs.surfaceDensityKgPerSquareMetre ?? 1, "surfaceDensityKgPerSquareMetre", 1e-20, 1e20);
  const epicyclic = bounded(inputs.epicyclicFrequencyRadiansPerSecond ?? 1e-15, "epicyclicFrequencyRadiansPerSecond", 0, 1e6);
  const dispersion = bounded(inputs.radialDispersionMetresPerSecond ?? 10_000, "radialDispersionMetresPerSecond", 0, C);
  const waveNumber = bounded(inputs.waveNumberPerMetre ?? 1e-20, "waveNumberPerMetre", 1e-40, 1e3);
  const omegaSquared = epicyclic ** 2 - 2 * Math.PI * G * density * waveNumber + dispersion ** 2 * waveNumber ** 2;
  return comparison("EARTH-GAL-002", "Local razor-thin fluid-disk axisymmetric dispersion relation", {
    dispersionAngularFrequencySquared: omegaSquared,
    stable: omegaSquared >= 0,
    oscillationAngularFrequency: omegaSquared >= 0 ? Math.sqrt(omegaSquared) : null,
    growthRatePerSecond: omegaSquared < 0 ? Math.sqrt(-omegaSquared) : null,
  }, { globalSpiralModeSolved: false, boundaryConditionsApplied: false });
}

export interface RotationCurveDatum { radiusKiloparsecs: number; observedKilometresPerSecond: number; modelKilometresPerSecond: number; uncertaintyKilometresPerSecond?: number }
export interface RotationCurveInputs { data?: readonly RotationCurveDatum[] }
export const DEFAULT_ROTATION_CURVE_INPUTS = Object.freeze({
  data: [
    { radiusKiloparsecs: 1, observedKilometresPerSecond: 100, modelKilometresPerSecond: 95, uncertaintyKilometresPerSecond: 5 },
    { radiusKiloparsecs: 2, observedKilometresPerSecond: 140, modelKilometresPerSecond: 145, uncertaintyKilometresPerSecond: 5 },
  ],
}) satisfies RotationCurveInputs;

export function rotationCurveResidualAudit(
  inputs: RotationCurveInputs = DEFAULT_ROTATION_CURVE_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-GAL-003", {
  rootMeanSquareResidualKilometresPerSecond: number;
  chiSquared: number | null;
  series: Array<{ radiusKiloparsecs: number; residualKilometresPerSecond: number; standardizedResidual: number | null }>;
}> {
  const data = inputs.data ?? DEFAULT_ROTATION_CURVE_INPUTS.data;
  if (!Array.isArray(data) || data.length < 1 || data.length > 8192) throw new RangeError("data must contain 1 to 8192 entries");
  let previousRadius = -Infinity;
  const series = data.map((datum, index) => {
    checkCancelled(options);
    const radiusKiloparsecs = bounded(datum.radiusKiloparsecs, `data[${index}].radiusKiloparsecs`, 1e-9, 1e6);
    if (radiusKiloparsecs <= previousRadius) throw new RangeError("data radii must be strictly increasing");
    previousRadius = radiusKiloparsecs;
    const observed = bounded(datum.observedKilometresPerSecond, `data[${index}].observedKilometresPerSecond`, 0, 1e7);
    const model = bounded(datum.modelKilometresPerSecond, `data[${index}].modelKilometresPerSecond`, 0, 1e7);
    const uncertainty = datum.uncertaintyKilometresPerSecond === undefined
      ? null
      : bounded(datum.uncertaintyKilometresPerSecond, `data[${index}].uncertaintyKilometresPerSecond`, 1e-12, 1e7);
    const residualKilometresPerSecond = observed - model;
    return { radiusKiloparsecs, residualKilometresPerSecond, standardizedResidual: uncertainty === null ? null : residualKilometresPerSecond / uncertainty };
  });
  const standardized = series.flatMap(({ standardizedResidual }) => standardizedResidual === null ? [] : [standardizedResidual]);
  return comparison("EARTH-GAL-003", "Residual contract for user-supplied observed and model rotation curves", {
    rootMeanSquareResidualKilometresPerSecond: rms(series.map(({ residualKilometresPerSecond }) => residualKilometresPerSecond)),
    chiSquared: standardized.length === series.length ? standardized.reduce((sum, value) => sum + value ** 2, 0) : null,
    series,
  }, { forceLawFitted: false, covarianceIncluded: false });
}

export interface HabitableZoneMonotonicityInputs { minimumRadiusKiloparsecs?: number; maximumRadiusKiloparsecs?: number; scaleLengthKiloparsecs?: number; threshold?: number; samples?: number }
export const DEFAULT_HABITABLE_ZONE_MONOTONICITY_INPUTS = Object.freeze({ minimumRadiusKiloparsecs: 0, maximumRadiusKiloparsecs: 30, scaleLengthKiloparsecs: 5, threshold: 0.2, samples: 301 }) satisfies HabitableZoneMonotonicityInputs;

export function habitableZoneMonotonicityAudit(
  inputs: HabitableZoneMonotonicityInputs = DEFAULT_HABITABLE_ZONE_MONOTONICITY_INPUTS,
  options: EarthRunOptions = {},
): AstroComparatorResult<"EARTH-GAL-006", {
  monotonicDirection: "decreasing";
  thresholdCrossings: number;
  crossingRadiusKiloparsecs: number | null;
  canDefineBoundedAnnulus: false;
}> {
  const minimum = bounded(inputs.minimumRadiusKiloparsecs ?? 0, "minimumRadiusKiloparsecs", 0, 1e6);
  const maximum = bounded(inputs.maximumRadiusKiloparsecs ?? 30, "maximumRadiusKiloparsecs", minimum + 1e-9, 1e6);
  const scale = bounded(inputs.scaleLengthKiloparsecs ?? 5, "scaleLengthKiloparsecs", 1e-9, 1e6);
  const threshold = bounded(inputs.threshold ?? 0.2, "threshold", 1e-12, 0.999_999_999_999);
  const samples = boundedInteger(inputs.samples ?? 301, "samples", 3, 8193);
  let thresholdCrossings = 0;
  let crossingRadiusKiloparsecs: number | null = null;
  let previousRadius = minimum;
  let previousValue = Math.exp(-minimum / scale);
  for (const radius of linearSamples(minimum, maximum, samples).slice(1)) {
    checkCancelled(options);
    const value = Math.exp(-radius / scale);
    if ((previousValue - threshold) * (value - threshold) <= 0 && previousValue !== value) {
      thresholdCrossings += 1;
      crossingRadiusKiloparsecs = previousRadius + (radius - previousRadius) * (previousValue - threshold) / (previousValue - value);
    }
    previousRadius = radius;
    previousValue = value;
  }
  return comparison("EARTH-GAL-006", "Monotonic exponential radial-proxy audit showing whether one threshold can define an annulus", {
    monotonicDirection: "decreasing",
    thresholdCrossings,
    crossingRadiusKiloparsecs,
    canDefineBoundedAnnulus: false,
  }, { biosignatureCatalogUsed: false, twoBoundaryPrediction: false });
}

export interface LensingClusterInputs { lensMassKg?: number; impactParameterMetres?: number; lensDistanceMetres?: number; sourceDistanceMetres?: number; lensSourceDistanceMetres?: number; clusterRadiusMetres?: number }
export const DEFAULT_LENSING_CLUSTER_INPUTS = Object.freeze({
  lensMassKg: 1e14 * SOLAR_MASS,
  impactParameterMetres: 500 * 1_000 * PARSEC,
  lensDistanceMetres: 800 * MEGAPARSEC,
  sourceDistanceMetres: 1_600 * MEGAPARSEC,
  lensSourceDistanceMetres: 1_000 * MEGAPARSEC,
  clusterRadiusMetres: MEGAPARSEC,
}) satisfies LensingClusterInputs;

export function lensingClusterFormulaContract(
  inputs: LensingClusterInputs = DEFAULT_LENSING_CLUSTER_INPUTS,
): AstroComparatorResult<"EARTH-GAL-007", {
  pointMassDeflectionRadians: number;
  einsteinAngleRadians: number;
  virialVelocityDispersionMetresPerSecond: number;
}> {
  const mass = bounded(inputs.lensMassKg ?? 1e14 * SOLAR_MASS, "lensMassKg", 1, 1e50);
  const impact = bounded(inputs.impactParameterMetres ?? 500 * 1_000 * PARSEC, "impactParameterMetres", 1, 1e30);
  const lensDistance = bounded(inputs.lensDistanceMetres ?? 800 * MEGAPARSEC, "lensDistanceMetres", 1, 1e30);
  const sourceDistance = bounded(inputs.sourceDistanceMetres ?? 1_600 * MEGAPARSEC, "sourceDistanceMetres", 1, 1e30);
  const lensSourceDistance = bounded(inputs.lensSourceDistanceMetres ?? 1_000 * MEGAPARSEC, "lensSourceDistanceMetres", 1, 1e30);
  const radius = bounded(inputs.clusterRadiusMetres ?? MEGAPARSEC, "clusterRadiusMetres", 1, 1e30);
  if (lensDistance >= sourceDistance) throw new RangeError("lensDistanceMetres must be less than sourceDistanceMetres");
  if (lensSourceDistance > sourceDistance) throw new RangeError("lensSourceDistanceMetres must not exceed sourceDistanceMetres");
  return comparison("EARTH-GAL-007", "Point-lens and virial cluster formula contract with user-supplied distances and mass", {
    pointMassDeflectionRadians: 4 * G * mass / (impact * C ** 2),
    einsteinAngleRadians: Math.sqrt(4 * G * mass * lensSourceDistance / (C ** 2 * lensDistance * sourceDistance)),
    virialVelocityDispersionMetresPerSecond: Math.sqrt(G * mass / (2 * radius)),
  }, { stressLawDerived: false, jointLensingDynamicsFit: false });
}

export const EARTH_ASTRO_COMPARATOR_DEFAULTS = {
  "EARTH-GRV-003": DEFAULT_RADIAL_SCALAR_PROFILE_INPUTS,
  "EARTH-GRV-004": DEFAULT_CANONICAL_SCALAR_STRESS_INPUTS,
  "EARTH-GRV-005": DEFAULT_SCHWARZSCHILD_PPN_INPUTS,
  "EARTH-GRV-006": DEFAULT_WAVE_DISPERSION_INPUTS,
  "EARTH-COS-002": DEFAULT_FLAT_LAMBDA_CDM_INPUTS,
  "EARTH-COS-003": DEFAULT_LINEAR_GROWTH_INPUTS,
  "EARTH-COS-004": DEFAULT_SACHS_WOLFE_INPUTS,
  "EARTH-COS-005": DEFAULT_BAO_TOY_INPUTS,
  "EARTH-PLAN-001": DEFAULT_PLANET_SHELL_INPUTS,
  "EARTH-PLAN-002": DEFAULT_PROFILE_BOUNDARY_RATIO_INPUTS,
  "EARTH-PLAN-003": DEFAULT_HYDROSTATIC_SPHERE_INPUTS,
  "EARTH-PLAN-004": DEFAULT_SHEAR_WAVE_INPUTS,
  "EARTH-PLAN-006": DEFAULT_DYNAMO_SCALING_INPUTS,
  "EARTH-PLAN-007": DEFAULT_ORBITAL_RATIO_INPUTS,
  "EARTH-PLAN-011": DEFAULT_JEANS_ESCAPE_INPUTS,
  "EARTH-STAR-001": DEFAULT_STELLAR_MASS_RADIUS_INPUTS,
  "EARTH-STAR-002": DEFAULT_LANE_EMDEN_INPUTS,
  "EARTH-STAR-004": DEFAULT_HR_REGRESSION_INPUTS,
  "EARTH-STAR-005": DEFAULT_PERIODOGRAM_INPUTS,
  "EARTH-STAR-006": DEFAULT_RADIAL_OSCILLATOR_INPUTS,
  "EARTH-STAR-007": DEFAULT_COMPACT_OBJECT_INPUTS,
  "EARTH-GAL-001": DEFAULT_GALAXY_MORPHOLOGY_INPUTS,
  "EARTH-GAL-002": DEFAULT_DISK_DENSITY_MODE_INPUTS,
  "EARTH-GAL-003": DEFAULT_ROTATION_CURVE_INPUTS,
  "EARTH-GAL-006": DEFAULT_HABITABLE_ZONE_MONOTONICITY_INPUTS,
  "EARTH-GAL-007": DEFAULT_LENSING_CLUSTER_INPUTS,
} as const;

export const EARTH_ASTRO_COMPARATORS = {
  "EARTH-GRV-003": radialScalarProfileResidual,
  "EARTH-GRV-004": canonicalScalarStressComponents,
  "EARTH-GRV-005": schwarzschildPpnObservables,
  "EARTH-GRV-006": waveDispersionComparator,
  "EARTH-COS-002": flatLambdaCdmBackground,
  "EARTH-COS-003": linearGrowthComparator,
  "EARTH-COS-004": toySachsWolfeSpectrum,
  "EARTH-COS-005": baoToyCorrelation,
  "EARTH-PLAN-001": planetShellCircularityAudit,
  "EARTH-PLAN-002": profileBoundaryRatioAudit,
  "EARTH-PLAN-003": newtonianHydrostaticSphere,
  "EARTH-PLAN-004": shearWaveBenchmark,
  "EARTH-PLAN-006": dynamoScalingComparator,
  "EARTH-PLAN-007": orbitalRatioMultiplicityAudit,
  "EARTH-PLAN-011": jeansEscapeComparator,
  "EARTH-STAR-001": stellarMassRadiusResidualAudit,
  "EARTH-STAR-002": laneEmdenPolytrope,
  "EARTH-STAR-004": hrMassLuminosityRegression,
  "EARTH-STAR-005": boundedPeriodogram,
  "EARTH-STAR-006": radialOscillatorModes,
  "EARTH-STAR-007": compactObjectFormulaContract,
  "EARTH-GAL-001": galaxyMorphologyPitchResidualAudit,
  "EARTH-GAL-002": linearDiskDensityMode,
  "EARTH-GAL-003": rotationCurveResidualAudit,
  "EARTH-GAL-006": habitableZoneMonotonicityAudit,
  "EARTH-GAL-007": lensingClusterFormulaContract,
} as const;
