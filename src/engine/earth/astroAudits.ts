import {
  boundedInteger,
  boundedNumber,
  boundedPositive,
  logarithmicSamples,
  relativeError,
  type EarthKernelResult,
  type EarthProvenanceKind,
} from "./common.js";
import { GOLDEN_RATIO, SPEED_OF_LIGHT_M_PER_S } from "../../simphy/constants.js";

const SPEED_OF_LIGHT_METRES_PER_SECOND = SPEED_OF_LIGHT_M_PER_S;
const PROTON_MASS_KG = 1.672_621_925_95e-27;
const SOLAR_MASS_KG = 1.988_47e30;
const SECONDS_PER_YEAR = 31_557_600;

type AuditLabel = EarthProvenanceKind;

function nonEmptyText(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required`);
  if (value.length > 256) throw new RangeError(`${name} must contain at most 256 characters`);
  return value;
}

function strictBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
  return value;
}

function optionalBoolean(value: unknown, name: string, fallback = false): boolean {
  return value === undefined ? fallback : strictBoolean(value, name);
}

function boundedArray<T>(value: T[], name: string, minimum: number, maximum: number): T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
  return value;
}

function auditDiagnostics(kind: AuditLabel, extra: Record<string, boolean | number | string | null>) {
  return {
    provenanceKind: kind,
    benchmarkLabel: kind,
    validatesTheory: false,
    validationClaim: "none",
    ...extra,
  };
}

export type CosmologyDistanceConvention = "proper" | "comoving";
export type HorizonExtent = "radius" | "diameter";

export interface CosmologyHorizonCountInputs {
  horizonDistanceMetres: number;
  horizonExtent: HorizonExtent;
  distanceConvention: CosmologyDistanceConvention;
  scaleFactor: number;
  baryonMassDensityKgPerCubicMetre: number;
  densityConvention: CosmologyDistanceConvention;
  baryonMassKg?: number;
  distanceFractionalUncertainty?: number;
  densityFractionalUncertainty?: number;
  baryonMassFractionalUncertainty?: number;
  distanceDerivedFromDensity?: boolean;
  densityDerivedFromDistance?: boolean;
  densityDerivedFromTargetCount?: boolean;
}

export interface CosmologyHorizonCountOutput {
  formula: "N=rho_b*(4*pi*r^3/3)/m_b";
  properRadiusMetres: number;
  comovingRadiusMetres: number;
  properVolumeCubicMetres: number;
  comovingVolumeCubicMetres: number;
  properBaryonMassDensityKgPerCubicMetre: number;
  comovingBaryonMassDensityKgPerCubicMetre: number;
  baryonCount: number;
  baryonCountFractionalUncertainty: number;
  baryonCountAbsoluteUncertainty: number;
  circularityFlags: {
    distanceDerivedFromDensity: boolean;
    densityDerivedFromDistance: boolean;
    densityDerivedFromTargetCount: boolean;
    anyCircularInput: boolean;
  };
  series: Array<{
    scenario: "lower" | "central" | "upper";
    properRadiusMetres: number;
    properDensityKgPerCubicMetre: number;
    baryonMassKg: number;
    baryonCount: number;
  }>;
}

export function cosmologyHorizonCountCalculator(
  inputs: CosmologyHorizonCountInputs,
): EarthKernelResult<CosmologyHorizonCountOutput> {
  if (!inputs || typeof inputs !== "object") throw new TypeError("inputs are required");
  const horizonDistanceMetres = boundedPositive(inputs.horizonDistanceMetres, "horizonDistanceMetres", 1, 1e29);
  if (inputs.horizonExtent !== "radius" && inputs.horizonExtent !== "diameter") {
    throw new RangeError("horizonExtent must be radius or diameter");
  }
  if (inputs.distanceConvention !== "proper" && inputs.distanceConvention !== "comoving") {
    throw new RangeError("distanceConvention must be proper or comoving");
  }
  if (inputs.densityConvention !== "proper" && inputs.densityConvention !== "comoving") {
    throw new RangeError("densityConvention must be proper or comoving");
  }
  const scaleFactor = boundedPositive(inputs.scaleFactor, "scaleFactor", 1e-6, 1);
  const suppliedRadiusMetres = inputs.horizonExtent === "diameter" ? horizonDistanceMetres / 2 : horizonDistanceMetres;
  const properRadiusMetres = inputs.distanceConvention === "proper" ? suppliedRadiusMetres : suppliedRadiusMetres * scaleFactor;
  const comovingRadiusMetres = properRadiusMetres / scaleFactor;
  const suppliedDensity = boundedPositive(
    inputs.baryonMassDensityKgPerCubicMetre,
    "baryonMassDensityKgPerCubicMetre",
    1e-40,
    1e30,
  );
  const properBaryonMassDensityKgPerCubicMetre = inputs.densityConvention === "proper"
    ? suppliedDensity
    : suppliedDensity / scaleFactor ** 3;
  const comovingBaryonMassDensityKgPerCubicMetre = properBaryonMassDensityKgPerCubicMetre * scaleFactor ** 3;
  const baryonMassKg = boundedPositive(inputs.baryonMassKg ?? PROTON_MASS_KG, "baryonMassKg", 1e-30, 1e-24);
  const distanceFractionalUncertainty = boundedNumber(
    inputs.distanceFractionalUncertainty ?? 0,
    "distanceFractionalUncertainty",
    0,
    0.99,
  );
  const densityFractionalUncertainty = boundedNumber(
    inputs.densityFractionalUncertainty ?? 0,
    "densityFractionalUncertainty",
    0,
    0.99,
  );
  const baryonMassFractionalUncertainty = boundedNumber(
    inputs.baryonMassFractionalUncertainty ?? 0,
    "baryonMassFractionalUncertainty",
    0,
    0.99,
  );
  const distanceDerivedFromDensity = optionalBoolean(inputs.distanceDerivedFromDensity, "distanceDerivedFromDensity");
  const densityDerivedFromDistance = optionalBoolean(inputs.densityDerivedFromDistance, "densityDerivedFromDistance");
  const densityDerivedFromTargetCount = optionalBoolean(inputs.densityDerivedFromTargetCount, "densityDerivedFromTargetCount");
  const anyCircularInput = distanceDerivedFromDensity || densityDerivedFromDistance || densityDerivedFromTargetCount;
  const properVolumeCubicMetres = 4 * Math.PI * properRadiusMetres ** 3 / 3;
  const comovingVolumeCubicMetres = 4 * Math.PI * comovingRadiusMetres ** 3 / 3;
  const baryonCount = properBaryonMassDensityKgPerCubicMetre * properVolumeCubicMetres / baryonMassKg;
  const baryonCountFractionalUncertainty = Math.hypot(
    3 * distanceFractionalUncertainty,
    densityFractionalUncertainty,
    baryonMassFractionalUncertainty,
  );
  const scenarios = [
    { scenario: "lower" as const, direction: -1 },
    { scenario: "central" as const, direction: 0 },
    { scenario: "upper" as const, direction: 1 },
  ];
  const series = scenarios.map(({ scenario, direction }) => {
    const radius = properRadiusMetres * (1 + direction * distanceFractionalUncertainty);
    const density = properBaryonMassDensityKgPerCubicMetre * (1 + direction * densityFractionalUncertainty);
    const mass = baryonMassKg * (1 - direction * baryonMassFractionalUncertainty);
    return {
      scenario,
      properRadiusMetres: radius,
      properDensityKgPerCubicMetre: density,
      baryonMassKg: mass,
      baryonCount: density * (4 * Math.PI * radius ** 3 / 3) / mass,
    };
  });
  return {
    method: "User-supplied spherical horizon and baryon-density calculator with explicit proper/comoving and radius/diameter conventions",
    diagnostics: auditDiagnostics("comparison", {
      anyCircularInput,
      distanceConvention: inputs.distanceConvention,
      densityConvention: inputs.densityConvention,
      horizonExtent: inputs.horizonExtent,
      uncertaintyPropagation: "independent-first-order",
    }),
    output: {
      formula: "N=rho_b*(4*pi*r^3/3)/m_b",
      properRadiusMetres,
      comovingRadiusMetres,
      properVolumeCubicMetres,
      comovingVolumeCubicMetres,
      properBaryonMassDensityKgPerCubicMetre,
      comovingBaryonMassDensityKgPerCubicMetre,
      baryonCount,
      baryonCountFractionalUncertainty,
      baryonCountAbsoluteUncertainty: baryonCount * baryonCountFractionalUncertainty,
      circularityFlags: {
        distanceDerivedFromDensity,
        densityDerivedFromDistance,
        densityDerivedFromTargetCount,
        anyCircularInput,
      },
      series,
    },
  };
}

export interface PlateSeismicFormulaInputs {
  twistAngleRadians?: number;
  speedOfLightMetresPerSecond?: number;
  nuclearCoherenceLengthMetres?: number;
  mantleCoherenceLengthMetres?: number;
  planetRadiusMetres?: number;
  harmonics?: number;
}

export interface LiteralFormulaComparison {
  id: string;
  formula: string;
  literalValue: number;
  sourceClaimedValue: number;
  unit: string;
  relativeResidual: number;
  arithmeticMatches: boolean;
}

export interface PlateSeismicFormulaOutput {
  formulas: LiteralFormulaComparison[];
  circumferenceMetres: number;
  wavelengthMetres: number;
  turnoverSeconds: number;
  literalPlateCount: number;
  literalPlateSpeedMetresPerSecond: number;
  series: Array<{
    harmonic: number;
    literalFormulaSpeedMetresPerSecond: number;
    separatelyAssertedSourceSpeedMmPerYear: number;
  }>;
}

export function plateSeismicFormulaAudit(
  inputs: PlateSeismicFormulaInputs = {},
): EarthKernelResult<PlateSeismicFormulaOutput> {
  const twistAngleRadians = boundedPositive(inputs.twistAngleRadians ?? 0.15, "twistAngleRadians", 1e-12, Math.PI);
  const speedOfLightMetresPerSecond = boundedPositive(
    inputs.speedOfLightMetresPerSecond ?? SPEED_OF_LIGHT_METRES_PER_SECOND,
    "speedOfLightMetresPerSecond",
    1,
    1e10,
  );
  const nuclearCoherenceLengthMetres = boundedPositive(
    inputs.nuclearCoherenceLengthMetres ?? 0.15e-15,
    "nuclearCoherenceLengthMetres",
    1e-20,
    1,
  );
  const mantleCoherenceLengthMetres = boundedPositive(
    inputs.mantleCoherenceLengthMetres ?? 1.5e-6,
    "mantleCoherenceLengthMetres",
    1e-20,
    1e6,
  );
  const planetRadiusMetres = boundedPositive(inputs.planetRadiusMetres ?? 6.371e6, "planetRadiusMetres", 1, 1e10);
  const harmonics = boundedInteger(inputs.harmonics ?? 8, "harmonics", 1, 1024);
  const shearSpeedMetresPerSecond = 3 * twistAngleRadians * speedOfLightMetresPerSecond / (2 * Math.PI);
  const seismicSpeedMetresPerSecond = shearSpeedMetresPerSecond * nuclearCoherenceLengthMetres / mantleCoherenceLengthMetres;
  const circumferenceMetres = 2 * Math.PI * planetRadiusMetres;
  const wavelengthMetres = circumferenceMetres / GOLDEN_RATIO;
  const literalPlateCount = circumferenceMetres / wavelengthMetres;
  const turnoverSeconds = 2 * Math.PI * mantleCoherenceLengthMetres
    / (3 * speedOfLightMetresPerSecond * twistAngleRadians ** 2);
  const literalPlateSpeedMetresPerSecond = wavelengthMetres / turnoverSeconds / GOLDEN_RATIO ** 2;
  const sourcePlateSpeedMetresPerSecond = 62.1e-3 / SECONDS_PER_YEAR;
  const comparisons: Array<Omit<LiteralFormulaComparison, "relativeResidual" | "arithmeticMatches">> = [
    {
      id: "shear-speed",
      formula: "v_shear=3*c*deltaChi/(2*pi)",
      literalValue: shearSpeedMetresPerSecond,
      sourceClaimedValue: 7.16e7,
      unit: "m/s",
    },
    {
      id: "mantle-seismic-speed",
      formula: "v_S=v_shear*xi0/xi_mantle",
      literalValue: seismicSpeedMetresPerSecond,
      sourceClaimedValue: 4_500,
      unit: "m/s",
    },
    {
      id: "plate-count",
      formula: "N=2*pi*R/(2*pi*R*phi^-1)=phi",
      literalValue: literalPlateCount,
      sourceClaimedValue: 15.95,
      unit: "1",
    },
    {
      id: "plate-speed",
      formula: "v_plate=lambda/t_turnover*phi^-2",
      literalValue: literalPlateSpeedMetresPerSecond,
      sourceClaimedValue: sourcePlateSpeedMetresPerSecond,
      unit: "m/s",
    },
  ];
  const formulas = comparisons.map((comparison) => {
    const residual = relativeError(comparison.literalValue, comparison.sourceClaimedValue);
    return { ...comparison, relativeResidual: residual, arithmeticMatches: residual <= 1e-6 };
  });
  const series = Array.from({ length: harmonics }, (_, index) => {
    const harmonic = index + 1;
    return {
      harmonic,
      literalFormulaSpeedMetresPerSecond: literalPlateSpeedMetresPerSecond / harmonic,
      separatelyAssertedSourceSpeedMmPerYear: 62.1 / harmonic,
    };
  });
  return {
    method: "Literal Float64 evaluation of the printed PLANET-3 plate and seismic equations; asserted macroscopic substitutions are not inserted",
    diagnostics: auditDiagnostics("reproduction", {
      failedArithmetic: formulas.filter(({ arithmeticMatches }) => !arithmeticMatches).length,
      dimensionalClosureSupplied: false,
      externalSeismicDataUsed: false,
    }),
    output: {
      formulas,
      circumferenceMetres,
      wavelengthMetres,
      turnoverSeconds,
      literalPlateCount,
      literalPlateSpeedMetresPerSecond,
      series,
    },
  };
}

export interface StellarLifetimeClaim {
  massSolar: number;
  claimedLifetimeGyr: number;
  label?: string;
}

export interface StellarLifetimeFormulaInputs {
  massMinimumSolar?: number;
  massMaximumSolar?: number;
  samples?: number;
  solarLifetimeGyr?: number;
  claims?: StellarLifetimeClaim[];
}

export interface StellarLifetimeFormulaOutput {
  formula: "tau_Gyr=tau_sun*phi^(2*(M/M_sun-1))";
  monotonicDirection: "increasing";
  series: Array<{
    massSolar: number;
    lifetimeGyr: number;
    localLogLogMassExponent: number;
  }>;
  claims: Array<{
    label: string;
    massSolar: number;
    claimedLifetimeGyr: number;
    literalLifetimeGyr: number;
    relativeResidual: number;
    arithmeticMatches: boolean;
  }>;
}

const DEFAULT_STELLAR_LIFETIME_CLAIMS: StellarLifetimeClaim[] = [
  { label: "solar", massSolar: 1, claimedLifetimeGyr: 10 },
  { label: "proxima-source-example", massSolar: 0.12, claimedLifetimeGyr: 4_000 },
  { label: "rigel-source-example", massSolar: 18, claimedLifetimeGyr: 0.008 },
];

export function stellarLifetimeFormulaSweep(
  inputs: StellarLifetimeFormulaInputs = {},
): EarthKernelResult<StellarLifetimeFormulaOutput> {
  const massMinimumSolar = boundedPositive(inputs.massMinimumSolar ?? 0.08, "massMinimumSolar", 0.01, 100);
  const massMaximumSolar = boundedPositive(inputs.massMaximumSolar ?? 25, "massMaximumSolar", 0.01, 100);
  if (massMaximumSolar <= massMinimumSolar) throw new RangeError("massMaximumSolar must be greater than massMinimumSolar");
  const samples = boundedInteger(inputs.samples ?? 129, "samples", 2, 4096);
  const solarLifetimeGyr = boundedPositive(inputs.solarLifetimeGyr ?? 10, "solarLifetimeGyr", 1e-6, 1e6);
  const evaluate = (massSolar: number) => solarLifetimeGyr * GOLDEN_RATIO ** (2 * (massSolar - 1));
  const series = logarithmicSamples(massMinimumSolar, massMaximumSolar, samples).map((massSolar) => ({
    massSolar,
    lifetimeGyr: evaluate(massSolar),
    localLogLogMassExponent: 2 * massSolar * Math.log(GOLDEN_RATIO),
  }));
  const claimInputs = boundedArray(inputs.claims ?? DEFAULT_STELLAR_LIFETIME_CLAIMS, "claims", 1, 256);
  const claims = claimInputs.map((claim, index) => {
    const massSolar = boundedPositive(claim.massSolar, `claims[${index}].massSolar`, 0.01, 100);
    const claimedLifetimeGyr = boundedPositive(claim.claimedLifetimeGyr, `claims[${index}].claimedLifetimeGyr`, 1e-9, 1e9);
    const literalLifetimeGyr = evaluate(massSolar);
    const residual = relativeError(literalLifetimeGyr, claimedLifetimeGyr);
    return {
      label: claim.label === undefined ? `claim-${index + 1}` : nonEmptyText(claim.label, `claims[${index}].label`),
      massSolar,
      claimedLifetimeGyr,
      literalLifetimeGyr,
      relativeResidual: residual,
      arithmeticMatches: residual <= 1e-6,
    };
  });
  return {
    method: "Literal sweep of the printed normalized STAR-2 mass-lifetime equation without replacing its exponent by source prose",
    diagnostics: auditDiagnostics("reproduction", {
      failedSourceExamples: claims.filter(({ arithmeticMatches }) => !arithmeticMatches).length,
      lifetimeIncreasesWithMass: true,
      externalIsochroneDataUsed: false,
    }),
    output: {
      formula: "tau_Gyr=tau_sun*phi^(2*(M/M_sun-1))",
      monotonicDirection: "increasing",
      series,
      claims,
    },
  };
}

export interface PulsationHarmonicClaim {
  id: string;
  harmonic: number;
  claimedPeriodDays?: number;
  harmonicSelectedUsingObservedPeriod?: boolean;
}

export interface PulsationHarmonicAuditInputs {
  coherenceLengthMetres?: number;
  massDensityKgPerCubicMetre?: number;
  coupling?: number;
  harmonics?: PulsationHarmonicClaim[];
}

export interface PulsationHarmonicAuditOutput {
  fundamentalFormula: "Pi0=2*pi*sqrt(xi^3*rho/lambda)";
  fundamentalLiteralValue: number;
  dimensionalUnitFromSIInputs: "kg^1/2";
  dimensionallyValidAsPeriod: false;
  harmonicSearchPenalty: number;
  series: Array<{
    id: string;
    harmonic: number;
    literalFormulaValue: number;
    daysIfValueIsAssumedSeconds: number;
    claimedPeriodDays: number | null;
    relativeResidual: number | null;
    targetLeakage: boolean;
  }>;
}

const DEFAULT_PULSATION_HARMONICS: PulsationHarmonicClaim[] = [
  { id: "delta-cephei", harmonic: 6, claimedPeriodDays: 5.3662, harmonicSelectedUsingObservedPeriod: true },
  { id: "rr-lyrae", harmonic: 5, claimedPeriodDays: 0.5669, harmonicSelectedUsingObservedPeriod: true },
];

export function pulsationHarmonicSourceAudit(
  inputs: PulsationHarmonicAuditInputs = {},
): EarthKernelResult<PulsationHarmonicAuditOutput> {
  const coherenceLengthMetres = boundedPositive(
    inputs.coherenceLengthMetres ?? 6.957e8 / GOLDEN_RATIO ** 6,
    "coherenceLengthMetres",
    1e-20,
    1e13,
  );
  const massDensityKgPerCubicMetre = boundedPositive(
    inputs.massDensityKgPerCubicMetre ?? 1_408,
    "massDensityKgPerCubicMetre",
    1e-30,
    1e20,
  );
  const coupling = boundedPositive(inputs.coupling ?? 44.49, "coupling", 1e-12, 1e12);
  const harmonicInputs = boundedArray(inputs.harmonics ?? DEFAULT_PULSATION_HARMONICS, "harmonics", 1, 1024);
  const fundamentalLiteralValue = 2 * Math.PI * Math.sqrt(
    coherenceLengthMetres ** 3 * massDensityKgPerCubicMetre / coupling,
  );
  const ids = new Set<string>();
  const series = harmonicInputs.map((claim, index) => {
    const id = nonEmptyText(claim.id, `harmonics[${index}].id`);
    if (ids.has(id)) throw new RangeError(`harmonic id must be unique: ${id}`);
    ids.add(id);
    const harmonic = boundedInteger(claim.harmonic, `harmonics[${index}].harmonic`, -32, 32);
    const claimedPeriodDays = claim.claimedPeriodDays === undefined
      ? null
      : boundedPositive(claim.claimedPeriodDays, `harmonics[${index}].claimedPeriodDays`, 1e-12, 1e12);
    const targetLeakage = optionalBoolean(
      claim.harmonicSelectedUsingObservedPeriod,
      `harmonics[${index}].harmonicSelectedUsingObservedPeriod`,
    );
    const literalFormulaValue = fundamentalLiteralValue * GOLDEN_RATIO ** harmonic;
    const daysIfValueIsAssumedSeconds = literalFormulaValue / 86_400;
    return {
      id,
      harmonic,
      literalFormulaValue,
      daysIfValueIsAssumedSeconds,
      claimedPeriodDays,
      relativeResidual: claimedPeriodDays === null ? null : relativeError(daysIfValueIsAssumedSeconds, claimedPeriodDays),
      targetLeakage,
    };
  });
  return {
    method: "Literal STAR-5 pulsation expression and bounded phi-harmonic ledger; SI dimensions are retained instead of relabelled as seconds",
    diagnostics: auditDiagnostics("reproduction", {
      dimensionalFailure: true,
      targetLeakageAssignments: series.filter(({ targetLeakage }) => targetLeakage).length,
      externalCatalogUsed: false,
    }),
    output: {
      fundamentalFormula: "Pi0=2*pi*sqrt(xi^3*rho/lambda)",
      fundamentalLiteralValue,
      dimensionalUnitFromSIInputs: "kg^1/2",
      dimensionallyValidAsPeriod: false,
      harmonicSearchPenalty: Math.log(series.length),
      series,
    },
  };
}

export interface SupernovaNeutronStarAuditInputs {
  nuclearNumberDensityPerCubicMetre?: number;
  coreMassKg?: number;
  protonMassKg?: number;
  twistAngleRadians?: number;
  nuclearCoherenceLengthMetres?: number;
  speedOfLightMetresPerSecond?: number;
  kickMultipliers?: number;
  chandrasekharMassSolar?: number;
  sourceTovMassSolar?: number;
}

export interface SupernovaNeutronStarAuditOutput {
  formulas: LiteralFormulaComparison[];
  coreTrefoilCount: number;
  criticalNumberDensityPerCubicMetre: number;
  blackHoleThresholdNumberDensityPerCubicMetre: number;
  releaseEnergyJoules: number;
  literalNeutronStarRadiusMetres: number;
  thresholds: {
    chandrasekharMassSolar: number;
    sourceTovMassSolar: number;
    derivedBySourceFormula: false;
  };
  series: Array<{
    multiplier: number;
    literalKickMetresPerSecond: number;
    literalKickKilometresPerSecond: number;
    sourceClaimedKickKilometresPerSecond: number;
  }>;
}

export function supernovaNeutronStarSourceAudit(
  inputs: SupernovaNeutronStarAuditInputs = {},
): EarthKernelResult<SupernovaNeutronStarAuditOutput> {
  const nuclearNumberDensityPerCubicMetre = boundedPositive(
    inputs.nuclearNumberDensityPerCubicMetre ?? 1.7e44,
    "nuclearNumberDensityPerCubicMetre",
    1e20,
    1e50,
  );
  const coreMassKg = boundedPositive(inputs.coreMassKg ?? 1.4 * SOLAR_MASS_KG, "coreMassKg", 1e20, 1e33);
  const protonMassKg = boundedPositive(inputs.protonMassKg ?? PROTON_MASS_KG, "protonMassKg", 1e-30, 1e-24);
  const twistAngleRadians = boundedPositive(inputs.twistAngleRadians ?? 0.15, "twistAngleRadians", 1e-12, Math.PI);
  const nuclearCoherenceLengthMetres = boundedPositive(
    inputs.nuclearCoherenceLengthMetres ?? 0.15e-15,
    "nuclearCoherenceLengthMetres",
    1e-20,
    1,
  );
  const speedOfLightMetresPerSecond = boundedPositive(
    inputs.speedOfLightMetresPerSecond ?? SPEED_OF_LIGHT_METRES_PER_SECOND,
    "speedOfLightMetresPerSecond",
    1,
    1e10,
  );
  const kickMultipliers = boundedInteger(inputs.kickMultipliers ?? 3, "kickMultipliers", 1, 1024);
  const chandrasekharMassSolar = boundedPositive(
    inputs.chandrasekharMassSolar ?? 1.44,
    "chandrasekharMassSolar",
    0.1,
    10,
  );
  const sourceTovMassSolar = boundedPositive(inputs.sourceTovMassSolar ?? 2.5, "sourceTovMassSolar", 0.1, 10);
  const phiSix = GOLDEN_RATIO ** 6;
  const coreTrefoilCount = coreMassKg / protonMassKg;
  const criticalNumberDensityPerCubicMetre = phiSix * nuclearNumberDensityPerCubicMetre;
  const blackHoleThresholdNumberDensityPerCubicMetre = GOLDEN_RATIO ** 12 * nuclearNumberDensityPerCubicMetre;
  const releaseEnergyJoules = coreTrefoilCount * twistAngleRadians ** 2 * protonMassKg * speedOfLightMetresPerSecond ** 2;
  const literalNeutronStarRadiusMetres = nuclearCoherenceLengthMetres * phiSix;
  const literalKickMetresPerSecond = 3 * speedOfLightMetresPerSecond * twistAngleRadians / (2 * Math.PI);
  const comparisons: Array<Omit<LiteralFormulaComparison, "relativeResidual" | "arithmeticMatches">> = [
    {
      id: "critical-density",
      formula: "rho_crit=phi^6*rho_nuc",
      literalValue: criticalNumberDensityPerCubicMetre,
      sourceClaimedValue: 8.9e44,
      unit: "m^-3",
    },
    {
      id: "release-energy",
      formula: "E=Q*deltaChi^2*m_p*c^2",
      literalValue: releaseEnergyJoules,
      sourceClaimedValue: 5.75e45,
      unit: "J",
    },
    {
      id: "neutron-star-radius",
      formula: "R_NS=xi0*phi^6",
      literalValue: literalNeutronStarRadiusMetres,
      sourceClaimedValue: 11_800,
      unit: "m",
    },
    {
      id: "kick-speed",
      formula: "v_kick=3*c*deltaChi/(2*pi)",
      literalValue: literalKickMetresPerSecond,
      sourceClaimedValue: 430_000,
      unit: "m/s",
    },
  ];
  const formulas = comparisons.map((comparison) => {
    const residual = relativeError(comparison.literalValue, comparison.sourceClaimedValue);
    return { ...comparison, relativeResidual: residual, arithmeticMatches: residual <= 1e-6 };
  });
  const series = Array.from({ length: kickMultipliers }, (_, index) => {
    const multiplier = index + 1;
    return {
      multiplier,
      literalKickMetresPerSecond: multiplier * literalKickMetresPerSecond,
      literalKickKilometresPerSecond: multiplier * literalKickMetresPerSecond / 1_000,
      sourceClaimedKickKilometresPerSecond: multiplier * 430,
    };
  });
  return {
    method: "Literal Float64 evaluation of printed STAR-6 critical-density, release-energy, radius, kick, and threshold statements",
    diagnostics: auditDiagnostics("reproduction", {
      failedArithmetic: formulas.filter(({ arithmeticMatches }) => !arithmeticMatches).length,
      undefinedRadiusProjectionApplied: false,
      thresholdsDerivedByFormula: false,
      externalPopulationDataUsed: false,
    }),
    output: {
      formulas,
      coreTrefoilCount,
      criticalNumberDensityPerCubicMetre,
      blackHoleThresholdNumberDensityPerCubicMetre,
      releaseEnergyJoules,
      literalNeutronStarRadiusMetres,
      thresholds: {
        chandrasekharMassSolar,
        sourceTovMassSolar,
        derivedBySourceFormula: false,
      },
      series,
    },
  };
}

export interface TullyFisherDatum {
  id: string;
  velocityKilometresPerSecond: number;
  baryonicMassSolar: number;
  heldOut: boolean;
  targetLeakage?: boolean;
}

export interface TullyFisherRegressionInputs {
  data: TullyFisherDatum[];
}

export interface TullyFisherRegressionOutput {
  formula: "log10(M_b/M_sun)=intercept+slope*log10(v/(km/s))";
  slope: number;
  intercept: number;
  trainingScatterDex: number;
  trainingRSquared: number | null;
  heldOutRootMeanSquareErrorDex: number | null;
  validationClaim: "none";
  series: Array<{
    id: string;
    heldOut: boolean;
    targetLeakage: boolean;
    logVelocity: number;
    logBaryonicMass: number;
    predictedLogBaryonicMass: number;
    residualDex: number;
  }>;
}

export function tullyFisherRegression(
  inputs: TullyFisherRegressionInputs,
): EarthKernelResult<TullyFisherRegressionOutput> {
  if (!inputs || typeof inputs !== "object") throw new TypeError("inputs are required");
  const data = boundedArray(inputs.data, "data", 2, 4096);
  const ids = new Set<string>();
  const rows = data.map((datum, index) => {
    const id = nonEmptyText(datum.id, `data[${index}].id`);
    if (ids.has(id)) throw new RangeError(`datum id must be unique: ${id}`);
    ids.add(id);
    const velocityKilometresPerSecond = boundedPositive(
      datum.velocityKilometresPerSecond,
      `data[${index}].velocityKilometresPerSecond`,
      1e-6,
      1e7,
    );
    const baryonicMassSolar = boundedPositive(
      datum.baryonicMassSolar,
      `data[${index}].baryonicMassSolar`,
      1e-12,
      1e18,
    );
    const heldOut = strictBoolean(datum.heldOut, `data[${index}].heldOut`);
    const targetLeakage = optionalBoolean(datum.targetLeakage, `data[${index}].targetLeakage`);
    return {
      id,
      heldOut,
      targetLeakage,
      logVelocity: Math.log10(velocityKilometresPerSecond),
      logBaryonicMass: Math.log10(baryonicMassSolar),
    };
  });
  const training = rows.filter(({ heldOut }) => !heldOut);
  if (training.length < 2) throw new RangeError("data must contain at least two non-held-out entries");
  const meanX = training.reduce((sum, row) => sum + row.logVelocity, 0) / training.length;
  const meanY = training.reduce((sum, row) => sum + row.logBaryonicMass, 0) / training.length;
  const sumXX = training.reduce((sum, row) => sum + (row.logVelocity - meanX) ** 2, 0);
  if (sumXX <= Number.EPSILON) throw new RangeError("non-held-out velocities must not all be equal");
  const sumXY = training.reduce(
    (sum, row) => sum + (row.logVelocity - meanX) * (row.logBaryonicMass - meanY),
    0,
  );
  const slope = sumXY / sumXX;
  const intercept = meanY - slope * meanX;
  const series = rows.map((row) => {
    const predictedLogBaryonicMass = intercept + slope * row.logVelocity;
    return {
      ...row,
      predictedLogBaryonicMass,
      residualDex: row.logBaryonicMass - predictedLogBaryonicMass,
    };
  });
  const trainingSeries = series.filter(({ heldOut }) => !heldOut);
  const heldOutSeries = series.filter(({ heldOut }) => heldOut);
  const trainingSquaredError = trainingSeries.reduce((sum, row) => sum + row.residualDex ** 2, 0);
  const trainingScatterDex = Math.sqrt(trainingSquaredError / trainingSeries.length);
  const totalTrainingVariation = training.reduce((sum, row) => sum + (row.logBaryonicMass - meanY) ** 2, 0);
  const trainingRSquared = totalTrainingVariation === 0 ? null : 1 - trainingSquaredError / totalTrainingVariation;
  const heldOutRootMeanSquareErrorDex = heldOutSeries.length === 0
    ? null
    : Math.sqrt(heldOutSeries.reduce((sum, row) => sum + row.residualDex ** 2, 0) / heldOutSeries.length);
  return {
    method: "Ordinary least-squares regression in base-10 log mass versus base-10 log velocity using only records with heldOut=false",
    diagnostics: auditDiagnostics("comparison", {
      suppliedRecords: rows.length,
      trainingRecords: trainingSeries.length,
      heldOutRecords: heldOutSeries.length,
      targetLeakageRecords: rows.filter(({ targetLeakage }) => targetLeakage).length,
      bundledMockData: false,
    }),
    output: {
      formula: "log10(M_b/M_sun)=intercept+slope*log10(v/(km/s))",
      slope,
      intercept,
      trainingScatterDex,
      trainingRSquared,
      heldOutRootMeanSquareErrorDex,
      validationClaim: "none",
      series,
    },
  };
}

export interface SmbhRatioDatum {
  id: string;
  hostMassSolar: number;
  blackHoleMassSolar: number;
  hostMassDerivedFromBlackHoleMass?: boolean;
}

export interface SmbhRatioResidualInputs {
  data: SmbhRatioDatum[];
}

export interface SmbhRatioResidualOutput {
  formula: "M_BH=phi^-18*M_host";
  frozenPhiMinus18: number;
  sourceClaimedRatio: 0.0073;
  sourceRatioRelativeResidual: number;
  rootMeanSquareResidualDex: number;
  validationClaim: "none";
  series: Array<{
    id: string;
    hostMassSolar: number;
    blackHoleMassSolar: number;
    predictedBlackHoleMassSolar: number;
    observedRatio: number;
    residualSolarMasses: number;
    residualDex: number;
    targetLeakage: boolean;
  }>;
}

export function smbhRatioResidualAudit(
  inputs: SmbhRatioResidualInputs,
): EarthKernelResult<SmbhRatioResidualOutput> {
  if (!inputs || typeof inputs !== "object") throw new TypeError("inputs are required");
  const data = boundedArray(inputs.data, "data", 1, 4096);
  const frozenPhiMinus18 = GOLDEN_RATIO ** -18;
  const ids = new Set<string>();
  const series = data.map((datum, index) => {
    const id = nonEmptyText(datum.id, `data[${index}].id`);
    if (ids.has(id)) throw new RangeError(`datum id must be unique: ${id}`);
    ids.add(id);
    const hostMassSolar = boundedPositive(datum.hostMassSolar, `data[${index}].hostMassSolar`, 1e-12, 1e18);
    const blackHoleMassSolar = boundedPositive(
      datum.blackHoleMassSolar,
      `data[${index}].blackHoleMassSolar`,
      1e-12,
      1e18,
    );
    const targetLeakage = optionalBoolean(
      datum.hostMassDerivedFromBlackHoleMass,
      `data[${index}].hostMassDerivedFromBlackHoleMass`,
    );
    const predictedBlackHoleMassSolar = frozenPhiMinus18 * hostMassSolar;
    return {
      id,
      hostMassSolar,
      blackHoleMassSolar,
      predictedBlackHoleMassSolar,
      observedRatio: blackHoleMassSolar / hostMassSolar,
      residualSolarMasses: blackHoleMassSolar - predictedBlackHoleMassSolar,
      residualDex: Math.log10(blackHoleMassSolar) - Math.log10(predictedBlackHoleMassSolar),
      targetLeakage,
    };
  });
  const rootMeanSquareResidualDex = Math.sqrt(
    series.reduce((sum, datum) => sum + datum.residualDex ** 2, 0) / series.length,
  );
  return {
    method: "Residual audit against the frozen algebraic ratio ((1+sqrt(5))/2)^-18 using only user-supplied host and black-hole masses",
    diagnostics: auditDiagnostics("comparison", {
      suppliedRecords: series.length,
      targetLeakageRecords: series.filter(({ targetLeakage }) => targetLeakage).length,
      ratioFittedToData: false,
      bundledMockData: false,
    }),
    output: {
      formula: "M_BH=phi^-18*M_host",
      frozenPhiMinus18,
      sourceClaimedRatio: 0.0073,
      sourceRatioRelativeResidual: relativeError(frozenPhiMinus18, 0.0073),
      rootMeanSquareResidualDex,
      validationClaim: "none",
      series,
    },
  };
}
