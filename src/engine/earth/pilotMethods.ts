import {
  boundedInteger,
  checkCancelled,
  finiteNumber,
  relativeError,
  type EarthDiagnostics,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const G_SI = 6.674_30e-11;
const HBAR_SI = 1.054_571_817e-34;
const C_SI = 299_792_458;
const PROTON_MASS_SI = 1.672_621_925_95e-27;
const BOLTZMANN_SI = 1.380_649e-23;

function bounded(value: number, name: string, minimum: number, maximum: number): number {
  finiteNumber(value, name);
  if (value < minimum || value > maximum) throw new RangeError(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

function sourceDiagnostics(extra: EarthDiagnostics = {}): EarthDiagnostics {
  return {
    provenanceKind: "reproduction",
    benchmarkLabel: "earth-source-reproduction",
    standardPhysicsUsed: false,
    validatesEarthTheory: false,
    deterministic: true,
    ...extra,
  };
}

function baselineDiagnostics(extra: EarthDiagnostics = {}): EarthDiagnostics {
  return {
    provenanceKind: "comparison",
    benchmarkLabel: "traditional-analytic-baseline-not-EARTH-derived",
    earthFormulaUsed: false,
    validatesEarthTheory: false,
    deterministic: true,
    ...extra,
  };
}

export interface EarthSolubilityProductSourceInputs {
  temperatureKelvin?: number;
  deltaEnergyKcalPerMol?: number;
  molarGasConstantKcalPerMolKelvin?: number;
  saltCoherenceAngstrom?: number;
  solutionCoherenceAngstrom?: number;
  coherenceExponent?: number;
  sourceClaimedKsp?: number;
}

export const DEFAULT_EARTH_SOLUBILITY_PRODUCT_SOURCE_INPUTS = Object.freeze({
  temperatureKelvin: 298.15,
  deltaEnergyKcalPerMol: 2.61,
  molarGasConstantKcalPerMolKelvin: 0.001986,
  saltCoherenceAngstrom: 5.64,
  solutionCoherenceAngstrom: 3.8,
  coherenceExponent: 6,
  sourceClaimedKsp: 36,
}) satisfies EarthSolubilityProductSourceInputs;

export interface EarthSolubilityProductSourceOutput {
  printedExpression: "Ksp=exp(-DeltaE0/(R*T))*(xi_salt/xi_solution)^n";
  boltzmannFactor: number;
  coherenceRatioPower: number;
  ksp: number;
  claimedKsp: number;
  claimedRelativeResidual: number;
}

export function earthSolubilityProductSource(
  inputs: EarthSolubilityProductSourceInputs = DEFAULT_EARTH_SOLUBILITY_PRODUCT_SOURCE_INPUTS,
): EarthKernelResult<EarthSolubilityProductSourceOutput> {
  const temperatureKelvin = bounded(inputs.temperatureKelvin ?? 298.15, "temperatureKelvin", 1, 1e6);
  const deltaEnergyKcalPerMol = bounded(inputs.deltaEnergyKcalPerMol ?? 2.61, "deltaEnergyKcalPerMol", -1e6, 1e6);
  const molarGasConstantKcalPerMolKelvin = bounded(inputs.molarGasConstantKcalPerMolKelvin ?? 0.001986, "molarGasConstantKcalPerMolKelvin", 1e-12, 1);
  const saltCoherenceAngstrom = bounded(inputs.saltCoherenceAngstrom ?? 5.64, "saltCoherenceAngstrom", 1e-12, 1e12);
  const solutionCoherenceAngstrom = bounded(inputs.solutionCoherenceAngstrom ?? 3.8, "solutionCoherenceAngstrom", 1e-12, 1e12);
  const coherenceExponent = boundedInteger(inputs.coherenceExponent ?? 6, "coherenceExponent", 1, 64);
  const claimedKsp = bounded(inputs.sourceClaimedKsp ?? 36, "sourceClaimedKsp", 1e-300, 1e300);
  const boltzmannFactor = Math.exp(-deltaEnergyKcalPerMol / (molarGasConstantKcalPerMolKelvin * temperatureKelvin));
  const coherenceRatioPower = (saltCoherenceAngstrom / solutionCoherenceAngstrom) ** coherenceExponent;
  const ksp = boltzmannFactor * coherenceRatioPower;
  if (!Number.isFinite(ksp)) throw new RangeError("printed Ksp expression exceeds the Float64 bound");
  return {
    method: "Literal bounded evaluation of the printed EARTH CHEM-8 Ksp expression",
    diagnostics: sourceDiagnostics({ arithmeticMatchesClaim: relativeError(ksp, claimedKsp) <= 1e-8 }),
    output: {
      printedExpression: "Ksp=exp(-DeltaE0/(R*T))*(xi_salt/xi_solution)^n",
      boltzmannFactor,
      coherenceRatioPower,
      ksp,
      claimedKsp,
      claimedRelativeResidual: relativeError(ksp, claimedKsp),
    },
  };
}

export interface StandardIonActivityProductInputs {
  cationConcentrationMolPerL?: number;
  anionConcentrationMolPerL?: number;
  cationActivityCoefficient?: number;
  anionActivityCoefficient?: number;
  cationStoichiometry?: number;
  anionStoichiometry?: number;
  standardConcentrationMolPerL?: number;
}

export const DEFAULT_STANDARD_ION_ACTIVITY_PRODUCT_INPUTS = Object.freeze({
  cationConcentrationMolPerL: 6,
  anionConcentrationMolPerL: 6,
  cationActivityCoefficient: 1,
  anionActivityCoefficient: 1,
  cationStoichiometry: 1,
  anionStoichiometry: 1,
  standardConcentrationMolPerL: 1,
}) satisfies StandardIonActivityProductInputs;

export interface StandardIonActivityProductOutput {
  formula: "Q=(gamma_c*c_c/c0)^nu_c*(gamma_a*c_a/c0)^nu_a";
  cationActivity: number;
  anionActivity: number;
  ionActivityProduct: number;
  standardConcentrationMolPerL: number;
}

export function standardIonActivityProduct(
  inputs: StandardIonActivityProductInputs = DEFAULT_STANDARD_ION_ACTIVITY_PRODUCT_INPUTS,
): EarthKernelResult<StandardIonActivityProductOutput> {
  const cationConcentration = bounded(inputs.cationConcentrationMolPerL ?? 6, "cationConcentrationMolPerL", 1e-15, 100);
  const anionConcentration = bounded(inputs.anionConcentrationMolPerL ?? 6, "anionConcentrationMolPerL", 1e-15, 100);
  const cationCoefficient = bounded(inputs.cationActivityCoefficient ?? 1, "cationActivityCoefficient", 1e-12, 100);
  const anionCoefficient = bounded(inputs.anionActivityCoefficient ?? 1, "anionActivityCoefficient", 1e-12, 100);
  const cationStoichiometry = boundedInteger(inputs.cationStoichiometry ?? 1, "cationStoichiometry", 1, 16);
  const anionStoichiometry = boundedInteger(inputs.anionStoichiometry ?? 1, "anionStoichiometry", 1, 16);
  const standardConcentrationMolPerL = bounded(inputs.standardConcentrationMolPerL ?? 1, "standardConcentrationMolPerL", 1e-12, 100);
  const cationActivity = cationCoefficient * cationConcentration / standardConcentrationMolPerL;
  const anionActivity = anionCoefficient * anionConcentration / standardConcentrationMolPerL;
  const ionActivityProduct = cationActivity ** cationStoichiometry * anionActivity ** anionStoichiometry;
  if (!Number.isFinite(ionActivityProduct)) throw new RangeError("ion activity product exceeds the Float64 bound");
  return {
    method: "Standard dimensionless ion-activity product from supplied concentrations and activity coefficients",
    diagnostics: baselineDiagnostics({ idealActivityCoefficients: cationCoefficient === 1 && anionCoefficient === 1 }),
    output: {
      formula: "Q=(gamma_c*c_c/c0)^nu_c*(gamma_a*c_a/c0)^nu_a",
      cationActivity,
      anionActivity,
      ionActivityProduct,
      standardConcentrationMolPerL,
    },
  };
}

export interface EarthPlanckEntropySourceInputs {
  xi0Metres?: number;
  phi?: number;
  areaSquareMetres?: number;
}

export const DEFAULT_EARTH_PLANCK_ENTROPY_SOURCE_INPUTS = Object.freeze({
  xi0Metres: 0.15e-15,
  phi: GOLDEN_RATIO,
  areaSquareMetres: 1,
}) satisfies EarthPlanckEntropySourceInputs;

export interface EarthPlanckEntropySourceOutput {
  printedLengths: Array<{ name: "metric-source" | "quantum-gravity-source"; formula: string; metres: number }>;
  printedEntropiesPerBoltzmann: Array<{ name: "source-xi0" | "metric-source-length" | "quantum-gravity-source-length"; formula: string; value: number }>;
}

export function earthPlanckEntropySource(
  inputs: EarthPlanckEntropySourceInputs = DEFAULT_EARTH_PLANCK_ENTROPY_SOURCE_INPUTS,
): EarthKernelResult<EarthPlanckEntropySourceOutput> {
  const xi0Metres = bounded(inputs.xi0Metres ?? 0.15e-15, "xi0Metres", 1e-40, 1e6);
  const phi = bounded(inputs.phi ?? GOLDEN_RATIO, "phi", 1.000_001, 10);
  const areaSquareMetres = bounded(inputs.areaSquareMetres ?? 1, "areaSquareMetres", 1e-30, 1e30);
  const metricSourceMetres = xi0Metres * phi ** -2;
  const quantumGravitySourceMetres = xi0Metres * phi ** 54;
  return {
    method: "Literal evaluation of the two printed EARTH Planck-length expressions and their printed entropy substitutions",
    diagnostics: sourceDiagnostics({ sourceLengthsMutuallyConsistent: relativeError(metricSourceMetres, quantumGravitySourceMetres) <= 64 * Number.EPSILON }),
    output: {
      printedLengths: [
        { name: "metric-source", formula: "xi0*phi^-2", metres: metricSourceMetres },
        { name: "quantum-gravity-source", formula: "xi0*phi^54", metres: quantumGravitySourceMetres },
      ],
      printedEntropiesPerBoltzmann: [
        { name: "source-xi0", formula: "A/(4*xi0^2)", value: areaSquareMetres / (4 * xi0Metres ** 2) },
        { name: "metric-source-length", formula: "A/(4*(xi0*phi^-2)^2)", value: areaSquareMetres / (4 * metricSourceMetres ** 2) },
        { name: "quantum-gravity-source-length", formula: "A/(4*(xi0*phi^54)^2)", value: areaSquareMetres / (4 * quantumGravitySourceMetres ** 2) },
      ],
    },
  };
}

export interface StandardPlanckEntropyInputs {
  areaSquareMetres?: number;
  gravitationalConstant?: number;
  hbar?: number;
  speedOfLight?: number;
}

export const DEFAULT_STANDARD_PLANCK_ENTROPY_INPUTS = Object.freeze({
  areaSquareMetres: 1,
  gravitationalConstant: G_SI,
  hbar: HBAR_SI,
  speedOfLight: C_SI,
}) satisfies StandardPlanckEntropyInputs;

export interface StandardPlanckEntropyOutput {
  planckLengthFormula: "l_P=sqrt(hbar*G/c^3)";
  planckLengthMetres: number;
  bekensteinHawkingFormula: "S/k_B=A/(4*l_P^2)";
  entropyPerBoltzmann: number;
}

export function standardPlanckEntropy(
  inputs: StandardPlanckEntropyInputs = DEFAULT_STANDARD_PLANCK_ENTROPY_INPUTS,
): EarthKernelResult<StandardPlanckEntropyOutput> {
  const area = bounded(inputs.areaSquareMetres ?? 1, "areaSquareMetres", 1e-30, 1e30);
  const gravitationalConstant = bounded(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant", 1e-30, 1e-1);
  const hbar = bounded(inputs.hbar ?? HBAR_SI, "hbar", 1e-100, 1);
  const speedOfLight = bounded(inputs.speedOfLight ?? C_SI, "speedOfLight", 1, 1e12);
  const planckLengthSquared = hbar * gravitationalConstant / speedOfLight ** 3;
  const planckLengthMetres = Math.sqrt(planckLengthSquared);
  return {
    method: "Standard SI Planck length and Bekenstein-Hawking area entropy",
    diagnostics: baselineDiagnostics({ entropyDimensionlessAfterDividingByBoltzmann: true }),
    output: {
      planckLengthFormula: "l_P=sqrt(hbar*G/c^3)",
      planckLengthMetres,
      bekensteinHawkingFormula: "S/k_B=A/(4*l_P^2)",
      entropyPerBoltzmann: area / (4 * planckLengthSquared),
    },
  };
}

export interface EarthAtmosphericCoherenceInputs {
  surfaceMassDensityKgPerCubicMetre?: number;
  nuclearNumberDensityPerCubicMetre?: number;
  xi0Metres?: number;
  protonMass?: number;
  densityMinimum?: number;
  densityMaximum?: number;
  samples?: number;
}

export const DEFAULT_EARTH_ATMOSPHERIC_COHERENCE_INPUTS = Object.freeze({
  surfaceMassDensityKgPerCubicMetre: 1.225,
  nuclearNumberDensityPerCubicMetre: 1.7e44,
  xi0Metres: 0.15e-15,
  protonMass: PROTON_MASS_SI,
  densityMinimum: 0.01,
  densityMaximum: 100,
  samples: 81,
}) satisfies EarthAtmosphericCoherenceInputs;

export interface EarthAtmosphericCoherenceOutput {
  formula: "xi=xi0*(n_nuclear/n_surface)^(1/3)";
  numberDensityPerCubicMetre: number;
  coherenceMetres: number;
  series: Array<{ massDensityKgPerCubicMetre: number; numberDensityPerCubicMetre: number; coherenceMetres: number }>;
}

export function earthAtmosphericCoherenceTransform(
  inputs: EarthAtmosphericCoherenceInputs = DEFAULT_EARTH_ATMOSPHERIC_COHERENCE_INPUTS,
  options: EarthRunOptions = {},
): EarthKernelResult<EarthAtmosphericCoherenceOutput> {
  const density = bounded(inputs.surfaceMassDensityKgPerCubicMetre ?? 1.225, "surfaceMassDensityKgPerCubicMetre", 1e-12, 1e12);
  const nuclearDensity = bounded(inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44, "nuclearNumberDensityPerCubicMetre", 1e20, 1e50);
  const xi0 = bounded(inputs.xi0Metres ?? 0.15e-15, "xi0Metres", 1e-30, 1);
  const protonMass = bounded(inputs.protonMass ?? PROTON_MASS_SI, "protonMass", 1e-32, 1e-20);
  const densityMinimum = bounded(inputs.densityMinimum ?? 0.01, "densityMinimum", 1e-12, 1e12);
  const densityMaximum = bounded(inputs.densityMaximum ?? 100, "densityMaximum", densityMinimum, 1e12);
  if (densityMaximum <= densityMinimum) throw new RangeError("densityMaximum must be greater than densityMinimum");
  const samples = boundedInteger(inputs.samples ?? 81, "samples", 2, 2048);
  const coherenceAtDensity = (massDensity: number) => xi0 * (nuclearDensity / (massDensity / protonMass)) ** (1 / 3);
  const logarithmicMinimum = Math.log(densityMinimum);
  const logarithmicSpan = Math.log(densityMaximum) - logarithmicMinimum;
  const series = Array.from({ length: samples }, (_, index) => {
    checkCancelled(options);
    const massDensityKgPerCubicMetre = Math.exp(logarithmicMinimum + logarithmicSpan * index / (samples - 1));
    return {
      massDensityKgPerCubicMetre,
      numberDensityPerCubicMetre: massDensityKgPerCubicMetre / protonMass,
      coherenceMetres: coherenceAtDensity(massDensityKgPerCubicMetre),
    };
  });
  return {
    method: "EARTH same-density coherence-length transform over a bounded mass-density sweep",
    diagnostics: sourceDiagnostics({ projectionToMacroscopicScaleSpecified: false }),
    output: {
      formula: "xi=xi0*(n_nuclear/n_surface)^(1/3)",
      numberDensityPerCubicMetre: density / protonMass,
      coherenceMetres: coherenceAtDensity(density),
      series,
    },
  };
}

export interface StandardIsothermalScaleHeightInputs {
  temperatureKelvin?: number;
  meanMolecularWeight?: number;
  gravityMetresPerSecondSquared?: number;
  protonMass?: number;
  boltzmannConstant?: number;
}

export const DEFAULT_STANDARD_ISOTHERMAL_SCALE_HEIGHT_INPUTS = Object.freeze({
  temperatureKelvin: 288.15,
  meanMolecularWeight: 28.97,
  gravityMetresPerSecondSquared: 9.80665,
  protonMass: PROTON_MASS_SI,
  boltzmannConstant: BOLTZMANN_SI,
}) satisfies StandardIsothermalScaleHeightInputs;

export interface StandardIsothermalScaleHeightOutput {
  formula: "H=k_B*T/(mu*m_p*g)";
  scaleHeightMetres: number;
  assumptions: "ideal-gas, isothermal, constant-gravity";
}

export function standardIsothermalScaleHeight(
  inputs: StandardIsothermalScaleHeightInputs = DEFAULT_STANDARD_ISOTHERMAL_SCALE_HEIGHT_INPUTS,
): EarthKernelResult<StandardIsothermalScaleHeightOutput> {
  const temperature = bounded(inputs.temperatureKelvin ?? 288.15, "temperatureKelvin", 1, 1e9);
  const molecularWeight = bounded(inputs.meanMolecularWeight ?? 28.97, "meanMolecularWeight", 1e-6, 1e6);
  const gravity = bounded(inputs.gravityMetresPerSecondSquared ?? 9.80665, "gravityMetresPerSecondSquared", 1e-12, 1e12);
  const protonMass = bounded(inputs.protonMass ?? PROTON_MASS_SI, "protonMass", 1e-32, 1e-20);
  const boltzmannConstant = bounded(inputs.boltzmannConstant ?? BOLTZMANN_SI, "boltzmannConstant", 1e-30, 1e-10);
  return {
    method: "Standard ideal-gas isothermal hydrostatic scale height",
    diagnostics: baselineDiagnostics({ isothermal: true, constantGravity: true }),
    output: {
      formula: "H=k_B*T/(mu*m_p*g)",
      scaleHeightMetres: boltzmannConstant * temperature / (molecularWeight * protonMass * gravity),
      assumptions: "ideal-gas, isothermal, constant-gravity",
    },
  };
}

export interface EarthPlanetaryBindingSeismicInputs {
  baryonCount?: number;
  earthCoherenceMetres?: number;
  protonMass?: number;
  nuclearNumberDensityPerCubicMetre?: number;
  localCoherenceMetres?: number;
  xi0Metres?: number;
}

export const DEFAULT_EARTH_PLANETARY_BINDING_SEISMIC_INPUTS = Object.freeze({
  baryonCount: 5.9722e24 / PROTON_MASS_SI,
  earthCoherenceMetres: 6.371e6,
  protonMass: PROTON_MASS_SI,
  nuclearNumberDensityPerCubicMetre: 1.7e44,
  localCoherenceMetres: 1.5e-6,
  xi0Metres: 0.15e-15,
}) satisfies EarthPlanetaryBindingSeismicInputs;

export interface EarthPlanetaryBindingSeismicOutput {
  binding: { printedFormula: "Q_Earth^2/(6*pi*xi_Earth)"; literalValue: number; literalDimension: "m^-1 when Q is a count" };
  seismic: { printedFormula: string; literalValue: number; literalDimension: "m^1/2 kg^-1/2" };
}

export function earthPlanetaryBindingSeismic(
  inputs: EarthPlanetaryBindingSeismicInputs = DEFAULT_EARTH_PLANETARY_BINDING_SEISMIC_INPUTS,
): EarthKernelResult<EarthPlanetaryBindingSeismicOutput> {
  const baryonCount = bounded(inputs.baryonCount ?? 5.9722e24 / PROTON_MASS_SI, "baryonCount", 1, 1e60);
  const earthCoherence = bounded(inputs.earthCoherenceMetres ?? 6.371e6, "earthCoherenceMetres", 1e-12, 1e20);
  const protonMass = bounded(inputs.protonMass ?? PROTON_MASS_SI, "protonMass", 1e-32, 1e-20);
  const nuclearDensity = bounded(inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44, "nuclearNumberDensityPerCubicMetre", 1e20, 1e50);
  const localCoherence = bounded(inputs.localCoherenceMetres ?? 1.5e-6, "localCoherenceMetres", 1e-20, 1e6);
  const xi0 = bounded(inputs.xi0Metres ?? 0.15e-15, "xi0Metres", 1e-20, 1);
  const binding = baryonCount ** 2 / (6 * Math.PI * earthCoherence);
  const seismic = Math.sqrt(1 / 6) * baryonCount / earthCoherence
    * Math.sqrt(1 / (protonMass * nuclearDensity))
    * (localCoherence / xi0) ** 1.5;
  if (!Number.isFinite(binding) || !Number.isFinite(seismic)) throw new RangeError("printed planetary expression exceeds the Float64 bound");
  return {
    method: "Literal evaluation and SI-dimension audit of the printed EARTH planetary binding and seismic expressions",
    diagnostics: sourceDiagnostics({ printedBindingIsEnergyInSI: false, printedSeismicIsSpeedInSI: false }),
    output: {
      binding: {
        printedFormula: "Q_Earth^2/(6*pi*xi_Earth)",
        literalValue: binding,
        literalDimension: "m^-1 when Q is a count",
      },
      seismic: {
        printedFormula: "sqrt(1/6)*(Q_Earth/xi_Earth)*sqrt(1/(m_p*n_nuc))*(xi(r)/xi0)^(3/2)",
        literalValue: seismic,
        literalDimension: "m^1/2 kg^-1/2",
      },
    },
  };
}

export interface StandardUniformSphereBindingInputs {
  planetMassKg?: number;
  planetRadiusMetres?: number;
  gravitationalConstant?: number;
}

export const DEFAULT_STANDARD_UNIFORM_SPHERE_BINDING_INPUTS = Object.freeze({
  planetMassKg: 5.9722e24,
  planetRadiusMetres: 6.371e6,
  gravitationalConstant: G_SI,
}) satisfies StandardUniformSphereBindingInputs;

export interface StandardUniformSphereBindingOutput {
  formula: "U=3*G*M^2/(5*R)";
  bindingEnergyJoules: number;
  assumptions: "Newtonian uniform-density sphere";
}

export function standardUniformSphereBindingEnergy(
  inputs: StandardUniformSphereBindingInputs = DEFAULT_STANDARD_UNIFORM_SPHERE_BINDING_INPUTS,
): EarthKernelResult<StandardUniformSphereBindingOutput> {
  const mass = bounded(inputs.planetMassKg ?? 5.9722e24, "planetMassKg", 1, 1e40);
  const radius = bounded(inputs.planetRadiusMetres ?? 6.371e6, "planetRadiusMetres", 1, 1e20);
  const gravitationalConstant = bounded(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant", 1e-30, 1e-1);
  const bindingEnergyJoules = 3 * gravitationalConstant * mass ** 2 / (5 * radius);
  if (!Number.isFinite(bindingEnergyJoules)) throw new RangeError("uniform-sphere binding energy exceeds the Float64 bound");
  return {
    method: "Standard Newtonian gravitational binding energy of a uniform-density sphere",
    diagnostics: baselineDiagnostics({ uniformDensity: true, newtonian: true }),
    output: {
      formula: "U=3*G*M^2/(5*R)",
      bindingEnergyJoules,
      assumptions: "Newtonian uniform-density sphere",
    },
  };
}
