import {
  boundedInteger,
  boundedNumber,
  logarithmicSamples,
  nonNegativeNumber,
  positiveNumber,
  relativeError,
  type EarthKernelResult,
  type EarthProvenanceKind,
} from "./common.js";
import { derrickScalarGate } from "./particle/derrickScalarGate.js";
import { CODATA_2022_HBAR_J_S, GOLDEN_RATIO, SPEED_OF_LIGHT_M_PER_S } from "../../simphy/constants.js";

const G_SI = 6.67430e-11;
const HBAR_SI = CODATA_2022_HBAR_J_S;
const C_SI = SPEED_OF_LIGHT_M_PER_S;
const PROTON_MASS_SI = 1.67262192595e-27;
const BOLTZMANN_SI = 1.380649e-23;
const RADIATION_CONSTANT_SI = 7.5657e-16;
const STANDARD_ATMOSPHERE = 101325;
const ANGSTROM = 1e-10;

type AuditLabel = EarthProvenanceKind;

function nonEmptyText(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  return value;
}

function auditLabel(kind: AuditLabel): { provenanceKind: AuditLabel; benchmarkLabel: AuditLabel } {
  return { provenanceKind: kind, benchmarkLabel: kind };
}


function linearSamples(minimum: number, maximum: number, count: number): number[] {
  if (count === 1) return [minimum];
  return Array.from({ length: count }, (_, index) => minimum + (maximum - minimum) * index / (count - 1));
}

export interface DerrickScalingInputs {
  gradientEnergy?: number;
  potentialEnergy?: number;
  lambdaMinimum?: number;
  lambdaMaximum?: number;
  samples?: number;
}

export const DEFAULT_DERRICK_SCALING_INPUTS: DerrickScalingInputs = {
  gradientEnergy: 1,
  potentialEnergy: 1,
  lambdaMinimum: 0.01,
  lambdaMaximum: 100,
  samples: 129,
};

export function derrickScalingAudit(
  inputs: DerrickScalingInputs = DEFAULT_DERRICK_SCALING_INPUTS,
) {
  return derrickScalarGate(inputs);
}

export interface GravityFormulaAuditInputs {
  xi0Metres?: number;
  gravitationalConstant?: number;
  hbar?: number;
  speedOfLight?: number;
  protonMass?: number;
  universeCount?: number;
  universeRadiusMetres?: number;
  radiationConstant?: number;
  claimedLambdaPerSquareMetre?: number;
  claimedH0KmPerSecondPerMpc?: number;
  claimedCmbTemperatureKelvin?: number;
  countOrRadiusUsesObservedCosmology?: boolean;
}

export const DEFAULT_GRAVITY_FORMULA_AUDIT_INPUTS: GravityFormulaAuditInputs = {
  xi0Metres: 0.15e-15,
  gravitationalConstant: G_SI,
  hbar: HBAR_SI,
  speedOfLight: C_SI,
  protonMass: PROTON_MASS_SI,
  universeCount: 9.15e79,
  universeRadiusMetres: 8.8e26,
  radiationConstant: RADIATION_CONSTANT_SI,
  claimedLambdaPerSquareMetre: 1.19e-52,
  claimedH0KmPerSecondPerMpc: 68.3,
  claimedCmbTemperatureKelvin: 2.72548,
  countOrRadiusUsesObservedCosmology: true,
};

export function gravityFormulaAudit(
  inputs: GravityFormulaAuditInputs = DEFAULT_GRAVITY_FORMULA_AUDIT_INPUTS,
): EarthKernelResult<{
  inputsSI: Required<Omit<GravityFormulaAuditInputs, "countOrRadiusUsesObservedCosmology">> & { countOrRadiusUsesObservedCosmology: boolean };
  volumeCubicMetres: number;
  numberDensityPerCubicMetre: number;
  massDensityKgPerCubicMetre: number;
  formulas: Array<{
    name: "G" | "Lambda" | "H0" | "CMB-temperature";
    printed: string;
    literalValue: number;
    claimedValue: number;
    relativeResidual: number;
    literalSIUnit: string;
    requiredSIUnit: string;
    dimensionallyValidInSI: boolean;
    caveat: string;
  }>;
  matterOnlyFriedmannH0PerSecond: number;
}> {
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const gravitationalConstant = positiveNumber(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant");
  const hbar = positiveNumber(inputs.hbar ?? HBAR_SI, "hbar");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? C_SI, "speedOfLight");
  const protonMass = positiveNumber(inputs.protonMass ?? PROTON_MASS_SI, "protonMass");
  const universeCount = positiveNumber(inputs.universeCount ?? 9.15e79, "universeCount");
  const universeRadiusMetres = positiveNumber(inputs.universeRadiusMetres ?? 8.8e26, "universeRadiusMetres");
  const radiationConstant = positiveNumber(inputs.radiationConstant ?? RADIATION_CONSTANT_SI, "radiationConstant");
  const claimedLambdaPerSquareMetre = positiveNumber(inputs.claimedLambdaPerSquareMetre ?? 1.19e-52, "claimedLambdaPerSquareMetre");
  const claimedH0KmPerSecondPerMpc = positiveNumber(inputs.claimedH0KmPerSecondPerMpc ?? 68.3, "claimedH0KmPerSecondPerMpc");
  const claimedCmbTemperatureKelvin = positiveNumber(inputs.claimedCmbTemperatureKelvin ?? 2.72548, "claimedCmbTemperatureKelvin");
  const countOrRadiusUsesObservedCosmology = inputs.countOrRadiusUsesObservedCosmology ?? true;
  const megaparsecMetres = 3.0856775814913673e22;
  const claimedH0PerSecond = claimedH0KmPerSecondPerMpc * 1000 / megaparsecMetres;
  const volumeCubicMetres = 4 * Math.PI * universeRadiusMetres ** 3 / 3;
  const numberDensityPerCubicMetre = universeCount / volumeCubicMetres;
  const massDensityKgPerCubicMetre = numberDensityPerCubicMetre * protonMass;
  const printedG = xi0Metres ** 2 / (8 * Math.PI);
  const printedGradientQuantity = 0.5 * (universeCount / (2 * Math.PI * universeRadiusMetres)) ** 2;
  const printedLambda = 8 * Math.PI * gravitationalConstant * printedGradientQuantity;
  const printedH0 = Math.sqrt(4 * Math.PI * gravitationalConstant * numberDensityPerCubicMetre / 3);
  const printedCmbTemperature = (printedGradientQuantity / radiationConstant) ** 0.25;
  const formulas = [
    {
      name: "G" as const,
      printed: "G=xi0^2/(8*pi)",
      literalValue: printedG,
      claimedValue: gravitationalConstant,
      relativeResidual: relativeError(printedG, gravitationalConstant),
      literalSIUnit: "m^2",
      requiredSIUnit: "m^3 kg^-1 s^-2",
      dimensionallyValidInSI: false,
      caveat: "The equality is only a natural-unit declaration; restoring SI requires additional hbar/c or mass-scale factors.",
    },
    {
      name: "Lambda" as const,
      printed: "Lambda=8*pi*G*(1/2)*(Q/(2*pi*R))^2",
      literalValue: printedLambda,
      claimedValue: claimedLambdaPerSquareMetre,
      relativeResidual: relativeError(printedLambda, claimedLambdaPerSquareMetre),
      literalSIUnit: "m kg^-1 s^-2",
      requiredSIUnit: "m^-2",
      dimensionallyValidInSI: false,
      caveat: "Q/R squared is not an SI energy density, and the Einstein-equation conversion would require a declared energy density and c^-4.",
    },
    {
      name: "H0" as const,
      printed: "H0=sqrt(4*pi*G*n/3)",
      literalValue: printedH0,
      claimedValue: claimedH0PerSecond,
      relativeResidual: relativeError(printedH0, claimedH0PerSecond),
      literalSIUnit: "kg^-1/2 s^-1",
      requiredSIUnit: "s^-1",
      dimensionallyValidInSI: false,
      caveat: "Number density must be converted to mass/energy density before it can enter a Friedmann equation.",
    },
    {
      name: "CMB-temperature" as const,
      printed: "T_CMB=(E/a)^(1/4)",
      literalValue: printedCmbTemperature,
      claimedValue: claimedCmbTemperatureKelvin,
      relativeResidual: relativeError(printedCmbTemperature, claimedCmbTemperatureKelvin),
      literalSIUnit: "(m^-2/(J m^-3 K^-4))^1/4",
      requiredSIUnit: "K",
      dimensionallyValidInSI: false,
      caveat: "The radiation law is valid only when E is an independently specified energy density in J m^-3.",
    },
  ];
  return {
    method: "Literal Float64 substitution into printed gravity/cosmology expressions with an SI dimension ledger",
    diagnostics: {
      ...auditLabel("reproduction"),
      allPrintedExpressionsDimensionallyValidInSI: formulas.every(({ dimensionallyValidInSI }) => dimensionallyValidInSI),
      failedDimensionalChecks: formulas.filter(({ dimensionallyValidInSI }) => !dimensionallyValidInSI).length,
      targetCircularity: countOrRadiusUsesObservedCosmology,
      naturalUnitConventionDeclaredBySource: false,
    },
    output: {
      inputsSI: {
        xi0Metres,
        gravitationalConstant,
        hbar,
        speedOfLight,
        protonMass,
        universeCount,
        universeRadiusMetres,
        radiationConstant,
        claimedLambdaPerSquareMetre,
        claimedH0KmPerSecondPerMpc,
        claimedCmbTemperatureKelvin,
        countOrRadiusUsesObservedCosmology,
      },
      volumeCubicMetres,
      numberDensityPerCubicMetre,
      massDensityKgPerCubicMetre,
      formulas,
      matterOnlyFriedmannH0PerSecond: Math.sqrt(8 * Math.PI * gravitationalConstant * massDensityKgPerCubicMetre / 3),
    },
  };
}

export interface CompactnessStateInput {
  id: string;
  lengthMetres: number;
  massKg: number;
  hubblePerSecond?: number;
}

export type CompactnessRegime = "outside-horizon" | "horizon" | "inside-horizon";

export interface CompactnessSeriesSample {
  radiusOverLength: number;
  compactness: number;
  hubbleTerm: number;
  kottlerF: number;
}

export interface CompactnessState {
  id: string;
  lengthMetres: number;
  massKg: number;
  hubblePerSecond: number;
  x: number;
  y: number;
  compactnessFromPlanckRatios: number;
  compactnessSI: number;
  compactnessIdentityRelativeResidual: number;
  boundaryMassKg: number;
  screeningRatio: number;
  hubbleTerm: number;
  kottlerF: number;
  regime: CompactnessRegime;
  series: CompactnessSeriesSample[];
}

export interface CompactnessKottlerInputs {
  states?: CompactnessStateInput[];
  gravitationalConstant?: number;
  hbar?: number;
  speedOfLight?: number;
  radialSamples?: number;
}

const DEFAULT_PROTON_INTERFACE_LENGTH = 4 * HBAR_SI / (PROTON_MASS_SI * C_SI);

export const DEFAULT_COMPACTNESS_KOTTLER_INPUTS: CompactnessKottlerInputs = {
  states: [{ id: "proton-four-reduced-compton", lengthMetres: DEFAULT_PROTON_INTERFACE_LENGTH, massKg: PROTON_MASS_SI, hubblePerSecond: 2.2e-18 }],
  gravitationalConstant: G_SI,
  hbar: HBAR_SI,
  speedOfLight: C_SI,
  radialSamples: 65,
};

export function compactnessKottlerInterface(
  inputs: CompactnessKottlerInputs = DEFAULT_COMPACTNESS_KOTTLER_INPUTS,
): EarthKernelResult<{
  planckLengthMetres: number;
  planckMassKg: number;
  definitions: { x: string; y: string; compactness: string; kottler: string };
  states: CompactnessState[];
}> {
  const gravitationalConstant = positiveNumber(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant");
  const hbar = positiveNumber(inputs.hbar ?? HBAR_SI, "hbar");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? C_SI, "speedOfLight");
  const radialSamples = boundedInteger(inputs.radialSamples ?? 65, "radialSamples", 2, 1024);
  const stateInputs = inputs.states ?? DEFAULT_COMPACTNESS_KOTTLER_INPUTS.states!;
  if (!Array.isArray(stateInputs) || stateInputs.length === 0 || stateInputs.length > 256) {
    throw new RangeError("states must contain 1 to 256 entries");
  }
  const planckLengthMetres = Math.sqrt(hbar * gravitationalConstant / speedOfLight ** 3);
  const planckMassKg = Math.sqrt(hbar * speedOfLight / gravitationalConstant);
  const states: CompactnessState[] = stateInputs.map((state) => {
    const id = nonEmptyText(state.id, "state id");
    const lengthMetres = positiveNumber(state.lengthMetres, "lengthMetres");
    const massKg = positiveNumber(state.massKg, "massKg");
    const hubblePerSecond = nonNegativeNumber(state.hubblePerSecond ?? 0, "hubblePerSecond");
    const x = lengthMetres / planckLengthMetres;
    const y = massKg / planckMassKg;
    const compactnessFromPlanckRatios = 2 * y / x;
    const compactnessSI = 2 * gravitationalConstant * massKg / (lengthMetres * speedOfLight ** 2);
    const boundaryMassKg = lengthMetres * speedOfLight ** 2 / (2 * gravitationalConstant);
    const hubbleTerm = (hubblePerSecond * lengthMetres / speedOfLight) ** 2;
    const kottlerF = 1 - compactnessSI - hubbleTerm;
    const horizonTolerance = 64 * Number.EPSILON;
    const regime: CompactnessRegime = Math.abs(kottlerF) <= horizonTolerance ? "horizon" : kottlerF > 0 ? "outside-horizon" : "inside-horizon";
    const series = linearSamples(0.25, 4, radialSamples).map((radiusOverLength) => {
      const radius = radiusOverLength * lengthMetres;
      const compactness = 2 * gravitationalConstant * massKg / (radius * speedOfLight ** 2);
      const radialHubbleTerm = (hubblePerSecond * radius / speedOfLight) ** 2;
      return { radiusOverLength, compactness, hubbleTerm: radialHubbleTerm, kottlerF: 1 - compactness - radialHubbleTerm };
    });
    return {
      id,
      lengthMetres,
      massKg,
      hubblePerSecond,
      x,
      y,
      compactnessFromPlanckRatios,
      compactnessSI,
      compactnessIdentityRelativeResidual: relativeError(compactnessFromPlanckRatios, compactnessSI),
      boundaryMassKg,
      screeningRatio: massKg / boundaryMassKg,
      hubbleTerm,
      kottlerF,
      regime,
      series,
    };
  });
  return {
    method: "Exact Planck-coordinate compactness identities and the static Kottler lapse at declared SI boundary states",
    diagnostics: {
      ...auditLabel("comparison"),
      identityOnly: true,
      predictsMass: false,
      maximumCompactnessIdentityResidual: Math.max(...states.map(({ compactnessIdentityRelativeResidual }) => compactnessIdentityRelativeResidual)),
    },
    output: {
      planckLengthMetres,
      planckMassKg,
      definitions: {
        x: "x=L/l_P",
        y: "y=m/m_P",
        compactness: "chi=2y/x=2Gm/(Lc^2)=m/M_boundary",
        kottler: "f(L)=1-chi-(HL/c)^2",
      },
      states,
    },
  };
}

export interface PlanckEntropyAuditInputs {
  xi0Metres?: number;
  phi?: number;
  areaSquareMetres?: number;
  gravitationalConstant?: number;
  hbar?: number;
  speedOfLight?: number;
}

export const DEFAULT_PLANCK_ENTROPY_AUDIT_INPUTS: PlanckEntropyAuditInputs = {
  xi0Metres: 0.15e-15,
  phi: GOLDEN_RATIO,
  areaSquareMetres: 1,
  gravitationalConstant: G_SI,
  hbar: HBAR_SI,
  speedOfLight: C_SI,
};

export function planckEntropyAudit(
  inputs: PlanckEntropyAuditInputs = DEFAULT_PLANCK_ENTROPY_AUDIT_INPUTS,
): EarthKernelResult<{
  lengths: Array<{ name: "standard" | "metric-source" | "quantum-gravity-source"; formula: string; metres: number; ratioToStandard: number }>;
  entropyPerBoltzmann: Array<{ name: "standard" | "source-xi0" | "metric-source-length" | "quantum-gravity-source-length"; formula: string; value: number; ratioToStandard: number }>;
  finding: string;
}> {
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const phi = boundedNumber(inputs.phi ?? GOLDEN_RATIO, "phi", 1.000001, 10);
  const areaSquareMetres = positiveNumber(inputs.areaSquareMetres ?? 1, "areaSquareMetres");
  const gravitationalConstant = positiveNumber(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant");
  const hbar = positiveNumber(inputs.hbar ?? HBAR_SI, "hbar");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? C_SI, "speedOfLight");
  const standard = Math.sqrt(hbar * gravitationalConstant / speedOfLight ** 3);
  const metricSource = xi0Metres * phi ** -2;
  const quantumGravitySource = xi0Metres * phi ** 54;
  const lengths = [
    { name: "standard" as const, formula: "sqrt(hbar*G/c^3)", metres: standard, ratioToStandard: 1 },
    { name: "metric-source" as const, formula: "xi0*phi^-2", metres: metricSource, ratioToStandard: metricSource / standard },
    { name: "quantum-gravity-source" as const, formula: "xi0*phi^54", metres: quantumGravitySource, ratioToStandard: quantumGravitySource / standard },
  ];
  const standardEntropy = areaSquareMetres / (4 * standard ** 2);
  const entropyPerBoltzmann = [
    { name: "standard" as const, formula: "A/(4*l_P^2)", value: standardEntropy, ratioToStandard: 1 },
    { name: "source-xi0" as const, formula: "A/(4*xi0^2)", value: areaSquareMetres / (4 * xi0Metres ** 2), ratioToStandard: standard ** 2 / xi0Metres ** 2 },
    { name: "metric-source-length" as const, formula: "A/(4*(xi0*phi^-2)^2)", value: areaSquareMetres / (4 * metricSource ** 2), ratioToStandard: standard ** 2 / metricSource ** 2 },
    { name: "quantum-gravity-source-length" as const, formula: "A/(4*(xi0*phi^54)^2)", value: areaSquareMetres / (4 * quantumGravitySource ** 2), ratioToStandard: standard ** 2 / quantumGravitySource ** 2 },
  ];
  return {
    method: "Direct comparison of two printed EARTH Planck lengths and entropy area scales with the standard SI definitions",
    diagnostics: {
      ...auditLabel("comparison"),
      sourceLengthsMutuallyConsistent: relativeError(metricSource, quantumGravitySource) <= 64 * Number.EPSILON,
      metricSourceMatchesStandard: relativeError(metricSource, standard) <= 1e-6,
      quantumGravitySourceMatchesStandard: relativeError(quantumGravitySource, standard) <= 1e-6,
      entropyFormulaDimensionlessAfterDividingByBoltzmann: true,
    },
    output: {
      lengths,
      entropyPerBoltzmann,
      finding: "The printed source lengths conflict with each other and with sqrt(hbar*G/c^3); replacing l_P by xi0 also changes the Bekenstein-Hawking entropy scale.",
    },
  };
}

export interface GeomagneticExpressionAuditInputs {
  twistAngle?: number;
  xi0Metres?: number;
  protonMass?: number;
  speedOfLight?: number;
  coreRadiusMetres?: number;
  phi?: number;
  claimedDipoleAmpereSquareMetres?: number;
}

export const DEFAULT_GEOMAGNETIC_EXPRESSION_AUDIT_INPUTS: GeomagneticExpressionAuditInputs = {
  twistAngle: 0.15,
  xi0Metres: 0.15e-15,
  protonMass: PROTON_MASS_SI,
  speedOfLight: C_SI,
  coreRadiusMetres: 3.48e6,
  phi: GOLDEN_RATIO,
  claimedDipoleAmpereSquareMetres: 7.85e22,
};

export function geomagneticExpressionAudit(
  inputs: GeomagneticExpressionAuditInputs = DEFAULT_GEOMAGNETIC_EXPRESSION_AUDIT_INPUTS,
): EarthKernelResult<{
  printedFormula: string;
  literalPrefactor: number;
  literalValue: number;
  claimedDipoleAmpereSquareMetres: number;
  relativeResidual: number;
  literalDimension: string;
  requiredDimension: string;
  missingDimension: string;
}> {
  const twistAngle = positiveNumber(inputs.twistAngle ?? 0.15, "twistAngle");
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const protonMass = positiveNumber(inputs.protonMass ?? PROTON_MASS_SI, "protonMass");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? C_SI, "speedOfLight");
  const coreRadiusMetres = positiveNumber(inputs.coreRadiusMetres ?? 3.48e6, "coreRadiusMetres");
  const phi = boundedNumber(inputs.phi ?? GOLDEN_RATIO, "phi", 1.000001, 10);
  const claimedDipoleAmpereSquareMetres = positiveNumber(inputs.claimedDipoleAmpereSquareMetres ?? 7.85e22, "claimedDipoleAmpereSquareMetres");
  const literalPrefactor = twistAngle / (2 * Math.PI) * protonMass * speedOfLight / xi0Metres;
  const literalValue = 3 * literalPrefactor * Math.PI * coreRadiusMetres ** 4 * phi ** -6;
  return {
    method: "Literal evaluation and SI base-dimension audit of the printed residual-twist dipole expression",
    diagnostics: {
      ...auditLabel("reproduction"),
      dimensionallyMagneticMoment: false,
      containsChargeOrCurrentInput: false,
      numericalAgreementCannotEstablishPhysicalUnits: true,
      sourceIntermediateClaim1Point194e19Matches: relativeError(literalPrefactor, 1.194e19) <= 0.01,
    },
    output: {
      printedFormula: "M=3*(deltaChi/(2*pi))*(m_p*c/xi0)*pi*R_core^4*phi^-6",
      literalPrefactor,
      literalValue,
      claimedDipoleAmpereSquareMetres,
      relativeResidual: relativeError(literalValue, claimedDipoleAmpereSquareMetres),
      literalDimension: "kg m^4 s^-1",
      requiredDimension: "A m^2 = C m^2 s^-1",
      missingDimension: "C kg^-1 m^-2",
    },
  };
}

export interface AtmosphericScaleHeightInputs {
  surfaceMassDensityKgPerCubicMetre?: number;
  nuclearNumberDensityPerCubicMetre?: number;
  xi0Metres?: number;
  temperatureKelvin?: number;
  meanMolecularWeight?: number;
  gravityMetresPerSecondSquared?: number;
  protonMass?: number;
  boltzmannConstant?: number;
  densityMinimum?: number;
  densityMaximum?: number;
  samples?: number;
}

export const DEFAULT_ATMOSPHERIC_SCALE_HEIGHT_INPUTS: AtmosphericScaleHeightInputs = {
  surfaceMassDensityKgPerCubicMetre: 1.225,
  nuclearNumberDensityPerCubicMetre: 1.7e44,
  xi0Metres: 0.15e-15,
  temperatureKelvin: 288.15,
  meanMolecularWeight: 28.97,
  gravityMetresPerSecondSquared: 9.80665,
  protonMass: PROTON_MASS_SI,
  boltzmannConstant: BOLTZMANN_SI,
  densityMinimum: 0.01,
  densityMaximum: 100,
  samples: 81,
};

export function atmosphericScaleHeightAudit(
  inputs: AtmosphericScaleHeightInputs = DEFAULT_ATMOSPHERIC_SCALE_HEIGHT_INPUTS,
): EarthKernelResult<{
  sourceCoherenceMetres: number;
  hydrostaticScaleHeightMetres: number;
  requiredProjectionFactor: number;
  numberDensityPerCubicMetre: number;
  formulas: { source: string; comparator: string };
  series: Array<{ massDensityKgPerCubicMetre: number; sourceCoherenceMetres: number; hydrostaticScaleHeightMetres: number; requiredProjectionFactor: number }>;
}> {
  const surfaceMassDensityKgPerCubicMetre = positiveNumber(inputs.surfaceMassDensityKgPerCubicMetre ?? 1.225, "surfaceMassDensityKgPerCubicMetre");
  const nuclearNumberDensityPerCubicMetre = positiveNumber(inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44, "nuclearNumberDensityPerCubicMetre");
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const temperatureKelvin = positiveNumber(inputs.temperatureKelvin ?? 288.15, "temperatureKelvin");
  const meanMolecularWeight = positiveNumber(inputs.meanMolecularWeight ?? 28.97, "meanMolecularWeight");
  const gravityMetresPerSecondSquared = positiveNumber(inputs.gravityMetresPerSecondSquared ?? 9.80665, "gravityMetresPerSecondSquared");
  const protonMass = positiveNumber(inputs.protonMass ?? PROTON_MASS_SI, "protonMass");
  const boltzmannConstant = positiveNumber(inputs.boltzmannConstant ?? BOLTZMANN_SI, "boltzmannConstant");
  const densityMinimum = positiveNumber(inputs.densityMinimum ?? 0.01, "densityMinimum");
  const densityMaximum = positiveNumber(inputs.densityMaximum ?? 100, "densityMaximum");
  if (densityMaximum <= densityMinimum) throw new RangeError("densityMaximum must be greater than densityMinimum");
  const samples = boundedInteger(inputs.samples ?? 81, "samples", 2, 2048);
  const coherenceAtDensity = (massDensity: number) => xi0Metres * (nuclearNumberDensityPerCubicMetre / (massDensity / protonMass)) ** (1 / 3);
  const hydrostaticScaleHeightMetres = boltzmannConstant * temperatureKelvin / (meanMolecularWeight * protonMass * gravityMetresPerSecondSquared);
  const sourceCoherenceMetres = coherenceAtDensity(surfaceMassDensityKgPerCubicMetre);
  const series = logarithmicSamples(densityMinimum, densityMaximum, samples).map((massDensityKgPerCubicMetre) => {
    const sourceCoherence = coherenceAtDensity(massDensityKgPerCubicMetre);
    return {
      massDensityKgPerCubicMetre,
      sourceCoherenceMetres: sourceCoherence,
      hydrostaticScaleHeightMetres,
      requiredProjectionFactor: hydrostaticScaleHeightMetres / sourceCoherence,
    };
  });
  return {
    method: "Same-density EARTH coherence transform compared with the ideal-gas isothermal hydrostatic scale height",
    diagnostics: {
      ...auditLabel("comparison"),
      comparator: "simple-standard-isothermal-hydrostatic",
      sourceProjectionSpecified: false,
      densityAloneDeterminesHydrostaticScaleHeight: false,
    },
    output: {
      sourceCoherenceMetres,
      hydrostaticScaleHeightMetres,
      requiredProjectionFactor: hydrostaticScaleHeightMetres / sourceCoherenceMetres,
      numberDensityPerCubicMetre: surfaceMassDensityKgPerCubicMetre / protonMass,
      formulas: {
        source: "xi=xi0*(n_nuclear/n_surface)^(1/3)",
        comparator: "H=k_B*T/(mu*m_p*g)",
      },
      series,
    },
  };
}

export interface WaterPhaseCoherenceInputs {
  temperatureMinimumKelvin?: number;
  temperatureMaximumKelvin?: number;
  temperaturePoints?: number;
  pressureMinimumPascal?: number;
  pressureMaximumPascal?: number;
  pressurePoints?: number;
  salinityPsu?: number;
  xi0Metres?: number;
  nuclearNumberDensityPerCubicMetre?: number;
  protonMass?: number;
  targetCoherenceAngstrom?: number;
}

export const DEFAULT_WATER_PHASE_COHERENCE_INPUTS: WaterPhaseCoherenceInputs = {
  temperatureMinimumKelvin: 260,
  temperatureMaximumKelvin: 400,
  temperaturePoints: 71,
  pressureMinimumPascal: STANDARD_ATMOSPHERE,
  pressureMaximumPascal: STANDARD_ATMOSPHERE,
  pressurePoints: 1,
  salinityPsu: 0,
  xi0Metres: 0.15e-15,
  nuclearNumberDensityPerCubicMetre: 1.7e44,
  protonMass: PROTON_MASS_SI,
  targetCoherenceAngstrom: 3.8,
};

type WaterPhase = "solid" | "liquid" | "vapor";

function simpleWaterBoilingPoint(pressurePascal: number): number {
  const molarGasConstant = 8.314462618;
  const latentHeatJoulePerMole = 40_650;
  return 1 / (1 / 373.15 - molarGasConstant / latentHeatJoulePerMole * Math.log(pressurePascal / STANDARD_ATMOSPHERE));
}

function simpleWaterDensity(temperatureKelvin: number, pressurePascal: number, salinityPsu: number, phase: WaterPhase): number {
  if (phase === "vapor") return pressurePascal / (461.5 * temperatureKelvin);
  if (phase === "solid") return 917 * (1 - 1.6e-4 * (temperatureKelvin - 273.15)) + 0.75 * salinityPsu;
  const temperatureCelsius = Math.max(0, Math.min(100, temperatureKelvin - 273.15));
  const densityAtOneAtmosphere = 1000 * (1 - (temperatureCelsius + 288.9414) / (508929.2 * (temperatureCelsius + 68.12963)) * (temperatureCelsius - 3.9863) ** 2);
  const bulkModulusPascal = 2.2e9;
  return (densityAtOneAtmosphere + 0.75 * salinityPsu) * (1 + (pressurePascal - STANDARD_ATMOSPHERE) / bulkModulusPascal);
}

export function waterPhaseCoherenceSweep(
  inputs: WaterPhaseCoherenceInputs = DEFAULT_WATER_PHASE_COHERENCE_INPUTS,
): EarthKernelResult<{
  comparator: string;
  comparatorLimitations: string;
  targetCoherenceAngstrom: number;
  points: Array<{
    temperatureKelvin: number;
    pressurePascal: number;
    salinityPsu: number;
    freezingPointKelvin: number;
    boilingPointKelvin: number;
    phase: WaterPhase;
    densityKgPerCubicMetre: number;
    coherenceMetres: number;
    coherenceAngstrom: number;
    relativeResidualToTarget: number;
  }>;
  phaseCounts: Record<WaterPhase, number>;
  nearestTargetPoint: { temperatureKelvin: number; pressurePascal: number; phase: WaterPhase; coherenceAngstrom: number; relativeResidualToTarget: number };
}> {
  const temperatureMinimumKelvin = boundedNumber(inputs.temperatureMinimumKelvin ?? 260, "temperatureMinimumKelvin", 200, 500);
  const temperatureMaximumKelvin = boundedNumber(inputs.temperatureMaximumKelvin ?? 400, "temperatureMaximumKelvin", 200, 500);
  if (temperatureMaximumKelvin <= temperatureMinimumKelvin) throw new RangeError("temperatureMaximumKelvin must be greater than temperatureMinimumKelvin");
  const temperaturePoints = boundedInteger(inputs.temperaturePoints ?? 71, "temperaturePoints", 2, 512);
  const pressureMinimumPascal = boundedNumber(inputs.pressureMinimumPascal ?? STANDARD_ATMOSPHERE, "pressureMinimumPascal", 1e3, 1e7);
  const pressureMaximumPascal = boundedNumber(inputs.pressureMaximumPascal ?? STANDARD_ATMOSPHERE, "pressureMaximumPascal", 1e3, 1e7);
  if (pressureMaximumPascal < pressureMinimumPascal) throw new RangeError("pressureMaximumPascal must not be less than pressureMinimumPascal");
  const pressurePoints = boundedInteger(inputs.pressurePoints ?? 1, "pressurePoints", 1, 128);
  if (pressurePoints > 1 && pressureMaximumPascal === pressureMinimumPascal) throw new RangeError("pressure range must be non-zero when pressurePoints exceeds one");
  if (temperaturePoints * pressurePoints > 8192) throw new RangeError("temperaturePoints*pressurePoints must not exceed 8192");
  const salinityPsu = boundedNumber(inputs.salinityPsu ?? 0, "salinityPsu", 0, 50);
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const nuclearNumberDensityPerCubicMetre = positiveNumber(inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44, "nuclearNumberDensityPerCubicMetre");
  const protonMass = positiveNumber(inputs.protonMass ?? PROTON_MASS_SI, "protonMass");
  const targetCoherenceAngstrom = positiveNumber(inputs.targetCoherenceAngstrom ?? 3.8, "targetCoherenceAngstrom");
  const temperatures = linearSamples(temperatureMinimumKelvin, temperatureMaximumKelvin, temperaturePoints);
  const pressures = pressurePoints === 1 ? [pressureMinimumPascal] : logarithmicSamples(pressureMinimumPascal, pressureMaximumPascal, pressurePoints);
  const points = pressures.flatMap((pressurePascal) => temperatures.map((temperatureKelvin) => {
    const freezingPointKelvin = 273.15 - 0.054 * salinityPsu;
    const boilingPointKelvin = simpleWaterBoilingPoint(pressurePascal);
    const phase: WaterPhase = temperatureKelvin < freezingPointKelvin ? "solid" : temperatureKelvin < boilingPointKelvin ? "liquid" : "vapor";
    const densityKgPerCubicMetre = simpleWaterDensity(temperatureKelvin, pressurePascal, salinityPsu, phase);
    const coherenceMetres = xi0Metres * (nuclearNumberDensityPerCubicMetre / (densityKgPerCubicMetre / protonMass)) ** (1 / 3);
    const coherenceAngstrom = coherenceMetres / ANGSTROM;
    return {
      temperatureKelvin,
      pressurePascal,
      salinityPsu,
      freezingPointKelvin,
      boilingPointKelvin,
      phase,
      densityKgPerCubicMetre,
      coherenceMetres,
      coherenceAngstrom,
      relativeResidualToTarget: relativeError(coherenceAngstrom, targetCoherenceAngstrom),
    };
  }));
  const nearest = points.reduce((best, point) => point.relativeResidualToTarget < best.relativeResidualToTarget ? point : best);
  const phaseCounts: Record<WaterPhase, number> = { solid: 0, liquid: 0, vapor: 0 };
  for (const point of points) phaseCounts[point.phase] += 1;
  return {
    method: "Bounded temperature-pressure grid using a declared engineering phase/density approximation followed by the literal EARTH density transform",
    diagnostics: {
      ...auditLabel("comparison"),
      comparator: "simple-standard-engineering-approximation",
      iapwsImplementation: false,
      biologicalHabitabilityCriterion: false,
      gridPoints: points.length,
      targetMatchedWithinOnePercent: nearest.relativeResidualToTarget <= 0.01,
    },
    output: {
      comparator: "Simple standard comparator: constant-latent-heat Clausius-Clapeyron boiling curve, linear salinity freezing depression, Kell liquid-density fit, ideal vapor, and linear ice density",
      comparatorLimitations: "This is not IAPWS-95 and is not valid for precision thermodynamics, high-pressure ice polymorphs, critical behavior, or biological habitability claims.",
      targetCoherenceAngstrom,
      points,
      phaseCounts,
      nearestTargetPoint: {
        temperatureKelvin: nearest.temperatureKelvin,
        pressurePascal: nearest.pressurePascal,
        phase: nearest.phase,
        coherenceAngstrom: nearest.coherenceAngstrom,
        relativeResidualToTarget: nearest.relativeResidualToTarget,
      },
    },
  };
}

export interface PlanetaryBindingEnergyInputs {
  planetMassKg?: number;
  planetRadiusMetres?: number;
  baryonCount?: number;
  earthCoherenceMetres?: number;
  gravitationalConstant?: number;
  hbar?: number;
  speedOfLight?: number;
  protonMass?: number;
  nuclearNumberDensityPerCubicMetre?: number;
  localCoherenceMetres?: number;
  xi0Metres?: number;
  observedSeismicSpeedMetresPerSecond?: number;
}

export const DEFAULT_PLANETARY_BINDING_ENERGY_INPUTS: PlanetaryBindingEnergyInputs = {
  planetMassKg: 5.9722e24,
  planetRadiusMetres: 6.371e6,
  baryonCount: 5.9722e24 / PROTON_MASS_SI,
  earthCoherenceMetres: 6.371e6,
  gravitationalConstant: G_SI,
  hbar: HBAR_SI,
  speedOfLight: C_SI,
  protonMass: PROTON_MASS_SI,
  nuclearNumberDensityPerCubicMetre: 1.7e44,
  localCoherenceMetres: 1.5e-6,
  xi0Metres: 0.15e-15,
  observedSeismicSpeedMetresPerSecond: 4500,
};

export function planetaryBindingEnergyAudit(
  inputs: PlanetaryBindingEnergyInputs = DEFAULT_PLANETARY_BINDING_ENERGY_INPUTS,
): EarthKernelResult<{
  binding: {
    printedFormula: string;
    literalValue: number;
    literalDimension: string;
    hbarCConvertedJoules: number;
    uniformSphereComparatorJoules: number;
    convertedRelativeResidual: number;
  };
  seismic: {
    printedFormula: string;
    literalValue: number;
    literalDimension: string;
    requiredDimension: string;
    observedMetresPerSecond: number;
    numericRelativeResidual: number;
  };
}> {
  const planetMassKg = positiveNumber(inputs.planetMassKg ?? 5.9722e24, "planetMassKg");
  const planetRadiusMetres = positiveNumber(inputs.planetRadiusMetres ?? 6.371e6, "planetRadiusMetres");
  const baryonCount = positiveNumber(inputs.baryonCount ?? planetMassKg / PROTON_MASS_SI, "baryonCount");
  const earthCoherenceMetres = positiveNumber(inputs.earthCoherenceMetres ?? planetRadiusMetres, "earthCoherenceMetres");
  const gravitationalConstant = positiveNumber(inputs.gravitationalConstant ?? G_SI, "gravitationalConstant");
  const hbar = positiveNumber(inputs.hbar ?? HBAR_SI, "hbar");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? C_SI, "speedOfLight");
  const protonMass = positiveNumber(inputs.protonMass ?? PROTON_MASS_SI, "protonMass");
  const nuclearNumberDensityPerCubicMetre = positiveNumber(inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44, "nuclearNumberDensityPerCubicMetre");
  const localCoherenceMetres = positiveNumber(inputs.localCoherenceMetres ?? 1.5e-6, "localCoherenceMetres");
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const observedSeismicSpeedMetresPerSecond = positiveNumber(inputs.observedSeismicSpeedMetresPerSecond ?? 4500, "observedSeismicSpeedMetresPerSecond");
  const literalBinding = baryonCount ** 2 / (6 * Math.PI * earthCoherenceMetres);
  const hbarCConvertedJoules = literalBinding * hbar * speedOfLight;
  const uniformSphereComparatorJoules = 3 * gravitationalConstant * planetMassKg ** 2 / (5 * planetRadiusMetres);
  const literalSeismic = Math.sqrt(1 / 6) * baryonCount / earthCoherenceMetres
    * Math.sqrt(1 / (protonMass * nuclearNumberDensityPerCubicMetre))
    * (localCoherenceMetres / xi0Metres) ** 1.5;
  return {
    method: "Literal source-formula substitution with SI base dimensions and a uniform-sphere binding comparator",
    diagnostics: {
      ...auditLabel("comparison"),
      printedBindingIsEnergyInSI: false,
      hbarCRestorationDeclaredBySource: false,
      printedSeismicIsSpeedInSI: false,
      standardBindingComparator: "uniform-density-sphere",
    },
    output: {
      binding: {
        printedFormula: "Q_Earth^2/(6*pi*xi_Earth)",
        literalValue: literalBinding,
        literalDimension: "m^-1 when Q is a count",
        hbarCConvertedJoules,
        uniformSphereComparatorJoules,
        convertedRelativeResidual: relativeError(hbarCConvertedJoules, uniformSphereComparatorJoules),
      },
      seismic: {
        printedFormula: "sqrt(1/6)*(Q_Earth/xi_Earth)*sqrt(1/(m_p*n_nuc))*(xi(r)/xi0)^(3/2)",
        literalValue: literalSeismic,
        literalDimension: "m^1/2 kg^-1/2",
        requiredDimension: "m s^-1",
        observedMetresPerSecond: observedSeismicSpeedMetresPerSecond,
        numericRelativeResidual: relativeError(literalSeismic, observedSeismicSpeedMetresPerSecond),
      },
    },
  };
}

export interface DnaGeometryLinkingInputs {
  xi0Metres?: number;
  dnaToNuclearDensityRatio?: number;
  assignedCoherenceAngstrom?: number;
  observedPitchAngstrom?: number;
  observedRiseAngstrom?: number;
  observedBasePairsPerTurn?: number;
  observedDiameterAngstrom?: number;
  basePairCount?: number;
  supercoilingDensity?: number;
  phi?: number;
}

export const DEFAULT_DNA_GEOMETRY_LINKING_INPUTS: DnaGeometryLinkingInputs = {
  xi0Metres: 0.15e-15,
  dnaToNuclearDensityRatio: 1e-8,
  assignedCoherenceAngstrom: 34,
  observedPitchAngstrom: 34,
  observedRiseAngstrom: 3.4,
  observedBasePairsPerTurn: 10.4,
  observedDiameterAngstrom: 20,
  basePairCount: 1040,
  supercoilingDensity: -0.06,
  phi: GOLDEN_RATIO,
};

export function dnaGeometryLinkingAudit(
  inputs: DnaGeometryLinkingInputs = DEFAULT_DNA_GEOMETRY_LINKING_INPUTS,
): EarthKernelResult<{
  densityTransform: { coherenceMetres: number; coherenceAngstrom: number; assignedCoherenceAngstrom: number; requiredHiddenFactor: number };
  literalGeometry: {
    pitchAngstrom: number;
    repeatFromPitchAndRise: number;
    claimedRepeat: number;
    majorGrooveAngstrom: number;
    minorGrooveAngstrom: number;
    diameterFromPrintedFormulaAngstrom: number;
    assignedDiameterAngstrom: number;
  };
  identityResiduals: { observedPitchMinusRiseTimesRepeatAngstrom: number; printedRepeatMinusClaim: number };
  basePairing: { allowedPairs: ["A-T", "G-C"]; derivedByGeometry: false };
  forms: Array<{ form: "A" | "B" | "Z"; handedness: "right" | "left"; riseAngstrom: number; basePairsPerTurn: number; pitchAngstrom: number; diameterAngstrom: number }>;
  linking: {
    basePairCount: number;
    printedRelaxedLinking: number;
    standardRelaxedLinking: number;
    printedSupercoiledLinking: number;
    standardSupercoiledLinking: number;
    nearestIntegerResidualForPrintedClosedLink: number;
  };
}> {
  const xi0Metres = positiveNumber(inputs.xi0Metres ?? 0.15e-15, "xi0Metres");
  const dnaToNuclearDensityRatio = boundedNumber(inputs.dnaToNuclearDensityRatio ?? 1e-8, "dnaToNuclearDensityRatio", 1e-30, 1);
  const assignedCoherenceAngstrom = positiveNumber(inputs.assignedCoherenceAngstrom ?? 34, "assignedCoherenceAngstrom");
  const observedPitchAngstrom = positiveNumber(inputs.observedPitchAngstrom ?? 34, "observedPitchAngstrom");
  const observedRiseAngstrom = positiveNumber(inputs.observedRiseAngstrom ?? 3.4, "observedRiseAngstrom");
  const observedBasePairsPerTurn = positiveNumber(inputs.observedBasePairsPerTurn ?? 10.4, "observedBasePairsPerTurn");
  const observedDiameterAngstrom = positiveNumber(inputs.observedDiameterAngstrom ?? 20, "observedDiameterAngstrom");
  const basePairCount = boundedInteger(inputs.basePairCount ?? 1040, "basePairCount", 1, 1_000_000_000);
  const supercoilingDensity = boundedNumber(inputs.supercoilingDensity ?? -0.06, "supercoilingDensity", -1, 1);
  const phi = boundedNumber(inputs.phi ?? GOLDEN_RATIO, "phi", 1.000001, 10);
  const coherenceMetres = xi0Metres * dnaToNuclearDensityRatio ** (-1 / 3);
  const coherenceAngstrom = coherenceMetres / ANGSTROM;
  const pitchAngstrom = assignedCoherenceAngstrom * phi;
  const repeatFromPitchAndRise = pitchAngstrom / observedRiseAngstrom;
  const printedRelaxedLinking = basePairCount / phi ** 2;
  const standardRelaxedLinking = basePairCount / observedBasePairsPerTurn;
  const printedSupercoiledLinking = printedRelaxedLinking * (1 + supercoilingDensity);
  const standardSupercoiledLinking = standardRelaxedLinking * (1 + supercoilingDensity);
  return {
    method: "Literal density, helix, groove, and linking expressions checked against simple canonical DNA-form geometry",
    diagnostics: {
      ...auditLabel("reproduction"),
      densityTransformMatchesAssignedCoherence: relativeError(coherenceAngstrom, assignedCoherenceAngstrom) <= 0.01,
      pitchRiseRepeatIdentityHolds: relativeError(observedPitchAngstrom, observedRiseAngstrom * observedBasePairsPerTurn) <= 0.01,
      printedRepeatClaimHolds: relativeError(repeatFromPitchAndRise, observedBasePairsPerTurn) <= 0.01,
      basePairSpecificityDerived: false,
      dnaFormsDerived: false,
    },
    output: {
      densityTransform: {
        coherenceMetres,
        coherenceAngstrom,
        assignedCoherenceAngstrom,
        requiredHiddenFactor: assignedCoherenceAngstrom / coherenceAngstrom,
      },
      literalGeometry: {
        pitchAngstrom,
        repeatFromPitchAndRise,
        claimedRepeat: observedBasePairsPerTurn,
        majorGrooveAngstrom: assignedCoherenceAngstrom / phi,
        minorGrooveAngstrom: assignedCoherenceAngstrom / phi ** 3,
        diameterFromPrintedFormulaAngstrom: 2 * assignedCoherenceAngstrom / phi,
        assignedDiameterAngstrom: observedDiameterAngstrom,
      },
      identityResiduals: {
        observedPitchMinusRiseTimesRepeatAngstrom: observedPitchAngstrom - observedRiseAngstrom * observedBasePairsPerTurn,
        printedRepeatMinusClaim: repeatFromPitchAndRise - observedBasePairsPerTurn,
      },
      basePairing: { allowedPairs: ["A-T", "G-C"], derivedByGeometry: false },
      forms: [
        { form: "A", handedness: "right", riseAngstrom: 2.6, basePairsPerTurn: 11, pitchAngstrom: 28.6, diameterAngstrom: 23 },
        { form: "B", handedness: "right", riseAngstrom: 3.4, basePairsPerTurn: 10.5, pitchAngstrom: 35.7, diameterAngstrom: 20 },
        { form: "Z", handedness: "left", riseAngstrom: 3.7, basePairsPerTurn: 12, pitchAngstrom: 44.4, diameterAngstrom: 18 },
      ],
      linking: {
        basePairCount,
        printedRelaxedLinking,
        standardRelaxedLinking,
        printedSupercoiledLinking,
        standardSupercoiledLinking,
        nearestIntegerResidualForPrintedClosedLink: Math.abs(printedSupercoiledLinking - Math.round(printedSupercoiledLinking)),
      },
    },
  };
}

export type ScreeningRouteDependency = "proton-mass" | "proton-radius" | "target-chi" | "observed-compactness" | "none";
export type ScreeningRouteKind = "prediction" | "identity" | "calibration" | "incomplete";

export interface ScreeningRouteRecord {
  id: string;
  label?: string;
  chi: number | null;
  kind: ScreeningRouteKind;
  dependencies: ScreeningRouteDependency[];
  note?: string;
}

export interface ScreeningRouteLedgerEntry {
  id: string;
  label: string | null;
  chi: number | null;
  kind: ScreeningRouteKind;
  dependencies: ScreeningRouteDependency[];
  note: string | null;
  targetLeakage: boolean;
  independentlyEligible: boolean;
  relativeResidualToTarget: number | null;
  matchesTarget: boolean | null;
  exclusionReason: string | null;
}

export interface ScreeningNoGoInputs {
  targetChi?: number;
  relativeTolerance?: number;
  routes?: ScreeningRouteRecord[];
}

const DEFAULT_TARGET_CHI = 2.95307471488277e-39;

export const DEFAULT_SCREENING_NO_GO_INPUTS: ScreeningNoGoInputs = {
  targetChi: DEFAULT_TARGET_CHI,
  relativeTolerance: 0.01,
  routes: [
    {
      id: "haramein-radius-identity",
      label: "chi=alpha_g/2 after L=4*hbar/(m_p*c)",
      chi: DEFAULT_TARGET_CHI,
      kind: "identity",
      dependencies: ["proton-mass", "proton-radius"],
    },
    {
      id: "horn-k0-rewrite",
      label: "chi=2*k0*l_P^2/L with k0=m_p*c/hbar",
      chi: DEFAULT_TARGET_CHI,
      kind: "identity",
      dependencies: ["proton-mass", "proton-radius"],
    },
    {
      id: "earth-density-length",
      label: "Density transform supplies L but no compactness",
      chi: null,
      kind: "incomplete",
      dependencies: ["none"],
    },
    {
      id: "roberts-spectrum",
      label: "No operator-derived compactness is available",
      chi: null,
      kind: "incomplete",
      dependencies: ["none"],
    },
  ],
};

export function screeningNoGoLedger(
  inputs: ScreeningNoGoInputs = DEFAULT_SCREENING_NO_GO_INPUTS,
): EarthKernelResult<{
  targetChi: number;
  relativeTolerance: number;
  routes: ScreeningRouteLedgerEntry[];
  independentRouteIds: string[];
  independentMatchingRouteIds: string[];
  noGo: boolean;
}> {
  const targetChi = positiveNumber(inputs.targetChi ?? DEFAULT_TARGET_CHI, "targetChi");
  const relativeTolerance = boundedNumber(inputs.relativeTolerance ?? 0.01, "relativeTolerance", 0, 1);
  const routeInputs = inputs.routes ?? DEFAULT_SCREENING_NO_GO_INPUTS.routes!;
  if (!Array.isArray(routeInputs) || routeInputs.length === 0 || routeInputs.length > 256) {
    throw new RangeError("routes must contain 1 to 256 entries");
  }
  const allowedDependencies = new Set<ScreeningRouteDependency>(["proton-mass", "proton-radius", "target-chi", "observed-compactness", "none"]);
  const ids = new Set<string>();
  const routes: ScreeningRouteLedgerEntry[] = routeInputs.map((route) => {
    const id = nonEmptyText(route.id, "route id");
    if (ids.has(id)) throw new RangeError(`route id must be unique: ${id}`);
    ids.add(id);
    if (!Array.isArray(route.dependencies) || route.dependencies.length === 0 || route.dependencies.some((dependency) => !allowedDependencies.has(dependency))) {
      throw new RangeError(`route ${id} must declare recognized dependencies`);
    }
    if (route.dependencies.includes("none") && route.dependencies.length !== 1) {
      throw new RangeError(`route ${id} cannot combine none with other dependencies`);
    }
    if (!(["prediction", "identity", "calibration", "incomplete"] as ScreeningRouteKind[]).includes(route.kind)) {
      throw new RangeError(`route ${id} has an unsupported kind`);
    }
    const chi = route.chi === null ? null : positiveNumber(route.chi, `route ${id} chi`);
    const targetLeakage = route.dependencies.some((dependency) => dependency !== "none");
    const independentlyEligible = route.kind === "prediction" && chi !== null && !targetLeakage;
    const relativeResidualToTarget = chi === null ? null : relativeError(chi, targetChi);
    const matchesTarget = relativeResidualToTarget === null ? null : relativeResidualToTarget <= relativeTolerance;
    const exclusionReason = independentlyEligible
      ? null
      : targetLeakage
        ? `depends on ${route.dependencies.join(", ")}`
        : route.kind !== "prediction"
          ? `route is ${route.kind}, not an independent prediction`
          : "route has no chi output";
    return {
      id,
      label: route.label ?? null,
      chi,
      kind: route.kind,
      dependencies: [...route.dependencies],
      note: route.note ?? null,
      targetLeakage,
      independentlyEligible,
      relativeResidualToTarget,
      matchesTarget,
      exclusionReason,
    };
  });
  const independentRouteIds = routes.filter(({ independentlyEligible }) => independentlyEligible).map(({ id }) => id);
  const independentMatchingRouteIds = routes.filter(({ independentlyEligible, matchesTarget }) => independentlyEligible && matchesTarget).map(({ id }) => id);
  return {
    method: "Deterministic route ledger that freezes each supplied chi before comparing it with the separately supplied target",
    diagnostics: {
      ...auditLabel("comparison"),
      routeValuesDerivedFromTargetByKernel: false,
      routesWithTargetLeakage: routes.filter(({ targetLeakage }) => targetLeakage).length,
      independentRoutes: independentRouteIds.length,
      independentMatches: independentMatchingRouteIds.length,
    },
    output: {
      targetChi,
      relativeTolerance,
      routes,
      independentRouteIds,
      independentMatchingRouteIds,
      noGo: independentMatchingRouteIds.length === 0,
    },
  };
}

export const EARTH_DOMAIN_DEFAULT_INPUTS = {
  "EARTH-FLD-001": DEFAULT_DERRICK_SCALING_INPUTS,
  "EARTH-GRV-001": DEFAULT_GRAVITY_FORMULA_AUDIT_INPUTS,
  "EARTH-COS-001": DEFAULT_COMPACTNESS_KOTTLER_INPUTS,
  "EARTH-COS-006": DEFAULT_PLANCK_ENTROPY_AUDIT_INPUTS,
  "EARTH-PLAN-005": DEFAULT_GEOMAGNETIC_EXPRESSION_AUDIT_INPUTS,
  "EARTH-PLAN-008": DEFAULT_ATMOSPHERIC_SCALE_HEIGHT_INPUTS,
  "EARTH-PLAN-009": DEFAULT_WATER_PHASE_COHERENCE_INPUTS,
  "EARTH-PLAN-012": DEFAULT_PLANETARY_BINDING_ENERGY_INPUTS,
  "EARTH-BIO-004": DEFAULT_DNA_GEOMETRY_LINKING_INPUTS,
  "EARTH-X-003": DEFAULT_SCREENING_NO_GO_INPUTS,
} as const;

export const EARTH_DOMAIN_KERNELS = {
  "EARTH-FLD-001": derrickScalingAudit,
  "EARTH-GRV-001": gravityFormulaAudit,
  "EARTH-COS-001": compactnessKottlerInterface,
  "EARTH-COS-006": planckEntropyAudit,
  "EARTH-PLAN-005": geomagneticExpressionAudit,
  "EARTH-PLAN-008": atmosphericScaleHeightAudit,
  "EARTH-PLAN-009": waterPhaseCoherenceSweep,
  "EARTH-PLAN-012": planetaryBindingEnergyAudit,
  "EARTH-BIO-004": dnaGeometryLinkingAudit,
  "EARTH-X-003": screeningNoGoLedger,
} as const;
