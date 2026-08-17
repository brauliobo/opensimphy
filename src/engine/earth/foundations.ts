import {
  boundedInteger,
  finiteNumber,
  nonNegativeNumber,
  positiveNumber,
  relativeError,
  type EarthKernelResult,
} from "./common.js";
import {
  CODATA_2022_ALPHA,
  CODATA_2022_HBAR_J_S,
  GOLDEN_RATIO,
} from "../../simphy/constants.js";

export { GOLDEN_RATIO };
export const CODATA_ALPHA = CODATA_2022_ALPHA;
export const CODATA_HBAR = CODATA_2022_HBAR_J_S;

export interface GoldenPowerInputs {
  exponents: number[];
  claims?: Array<{ exponent: number; claimed: number; label?: string }>;
}

export function goldenPowerAudit(inputs: GoldenPowerInputs): EarthKernelResult<{
  phi: number;
  powers: Array<{ exponent: number; value: number; inverse: number; productResidual: number }>;
  claims: Array<{ exponent: number; claimed: number; computed: number; absoluteResidual: number; relativeResidual: number; matches: boolean; label: string | null }>;
}> {
  if (!Array.isArray(inputs.exponents) || inputs.exponents.length === 0 || inputs.exponents.length > 256) {
    throw new RangeError("exponents must contain 1 to 256 entries");
  }
  const exponents = [...new Set(inputs.exponents.map((value) => boundedInteger(value, "exponent", -1024, 1024)))];
  const powers = exponents.map((exponent) => {
    const value = GOLDEN_RATIO ** exponent;
    const inverse = GOLDEN_RATIO ** -exponent;
    return { exponent, value, inverse, productResidual: value * inverse - 1 };
  });
  const claims = (inputs.claims ?? [{ exponent: 18, claimed: 2584, label: "source phi^18" }]).map((claim) => {
    const exponent = boundedInteger(claim.exponent, "claim exponent", -1024, 1024);
    const claimed = finiteNumber(claim.claimed, "claimed value");
    const computed = GOLDEN_RATIO ** exponent;
    const absoluteResidual = computed - claimed;
    const claimRelativeError = relativeError(computed, claimed);
    return {
      exponent,
      claimed,
      computed,
      absoluteResidual,
      relativeResidual: claimRelativeError,
      matches: claimRelativeError <= 8 * Number.EPSILON,
      label: claim.label ?? null,
    };
  });
  return {
    method: "Float64 exponentiation with reciprocal and source-claim residuals",
    diagnostics: {
      finite: powers.every(({ value, inverse }) => Number.isFinite(value) && Number.isFinite(inverse)),
      maximumReciprocalResidual: Math.max(...powers.map(({ productResidual }) => Math.abs(productResidual))),
      failedClaims: claims.filter(({ matches }) => !matches).length,
    },
    output: { phi: GOLDEN_RATIO, powers, claims },
  };
}

export interface PiAlphaInputs {
  codataAlpha?: number;
}

export function piAlphaAudit(inputs: PiAlphaInputs = {}): EarthKernelResult<{
  phi: number;
  pi: number;
  piExpressions: Array<{ name: string; value: number; residualToPi: number }>;
  quartic: { coefficients: [number, number, number, number, number]; atPi: number; atPositiveRoot: number; positiveRoot: number };
  alpha: { codata: number; codataInverse: number; sourceInverseUsingPi: number; sourceUsingPi: number; residual: number; relativeResidual: number; sourceInverseByPiExpression: number[] };
}> {
  const codataAlpha = positiveNumber(inputs.codataAlpha ?? CODATA_ALPHA, "codataAlpha");
  const first = Math.sqrt(6) * GOLDEN_RATIO ** -2;
  const second = Math.sqrt(30 - 6 * Math.sqrt(5)) / 2;
  const positiveRoot = Math.sqrt(-5 + Math.sqrt(30));
  const polynomial = (value: number) => value ** 4 + 10 * value ** 2 - 5;
  const piExpressions = [
    { name: "sqrt(6)*phi^-2", value: first, residualToPi: first - Math.PI },
    { name: "sqrt(30-6sqrt(5))/2", value: second, residualToPi: second - Math.PI },
    { name: "positive root of x^4+10x^2-5", value: positiveRoot, residualToPi: positiveRoot - Math.PI },
  ];
  const sourceInverseUsingPi = 120 * Math.PI * 3 * GOLDEN_RATIO ** 2;
  const sourceUsingPi = 1 / sourceInverseUsingPi;
  return {
    method: "Direct Float64 evaluation of printed algebraic pi and fine-structure expressions",
    diagnostics: {
      piIdentityMaximumResidual: Math.max(...piExpressions.map(({ residualToPi }) => Math.abs(residualToPi))),
      quarticPiResidual: polynomial(Math.PI),
      alphaRelativeResidual: relativeError(sourceUsingPi, codataAlpha),
    },
    output: {
      phi: GOLDEN_RATIO,
      pi: Math.PI,
      piExpressions,
      quartic: {
        coefficients: [1, 0, 10, 0, -5],
        atPi: polynomial(Math.PI),
        atPositiveRoot: polynomial(positiveRoot),
        positiveRoot,
      },
      alpha: {
        codata: codataAlpha,
        codataInverse: 1 / codataAlpha,
        sourceInverseUsingPi,
        sourceUsingPi,
        residual: sourceUsingPi - codataAlpha,
        relativeResidual: relativeError(sourceUsingPi, codataAlpha),
        sourceInverseByPiExpression: piExpressions.map(({ value }) => 120 * value * 3 * GOLDEN_RATIO ** 2),
      },
    },
  };
}

const SUBSTITUTION = { "1": "12", "2": "13", "3": "21" } as const;
type SubstitutionSymbol = keyof typeof SUBSTITUTION;

export interface SubstitutionInputs {
  generations: number;
  seeds?: SubstitutionSymbol[];
  maximumFactorLength?: number;
}

function substitute(word: string): string {
  let next = "";
  for (const symbol of word) next += SUBSTITUTION[symbol as SubstitutionSymbol];
  return next;
}

function symbolFrequencies(word: string): Record<SubstitutionSymbol, number> {
  const counts: Record<SubstitutionSymbol, number> = { "1": 0, "2": 0, "3": 0 };
  for (const symbol of word) counts[symbol as SubstitutionSymbol] += 1;
  return {
    "1": counts["1"] / word.length,
    "2": counts["2"] / word.length,
    "3": counts["3"] / word.length,
  };
}

function factorComplexity(word: string, maximumLength: number): Array<{ length: number; distinct: number }> {
  return Array.from({ length: maximumLength }, (_, offset) => {
    const length = offset + 1;
    const factors = new Set<string>();
    for (let index = 0; index + length <= word.length; index += 1) factors.add(word.slice(index, index + length));
    return { length, distinct: factors.size };
  });
}

function commonPrefixLength(left: string, right: string): number {
  const bound = Math.min(left.length, right.length);
  let index = 0;
  while (index < bound && left[index] === right[index]) index += 1;
  return index;
}

export function substitutionAudit(inputs: SubstitutionInputs): EarthKernelResult<{
  substitution: typeof SUBSTITUTION;
  generations: number;
  words: Array<{ seed: SubstitutionSymbol; word: string; lengths: number[]; frequencies: Record<SubstitutionSymbol, number>; complexity: Array<{ length: number; distinct: number }> }>;
  prefixOverlaps: Array<{ seeds: [SubstitutionSymbol, SubstitutionSymbol]; length: number; fraction: number }>;
}> {
  const generations = boundedInteger(inputs.generations, "generations", 0, 18);
  const maximumFactorLength = boundedInteger(inputs.maximumFactorLength ?? 8, "maximumFactorLength", 1, 12);
  const seeds = inputs.seeds ?? ["1", "2", "3"];
  if (seeds.length === 0 || seeds.length > 3 || seeds.some((seed) => !(seed in SUBSTITUTION))) {
    throw new RangeError("seeds must contain one to three symbols from 1, 2, and 3");
  }
  const words = [...new Set(seeds)].map((seed) => {
    let word: string = seed;
    const lengths = [word.length];
    for (let generation = 0; generation < generations; generation += 1) {
      word = substitute(word);
      lengths.push(word.length);
    }
    return { seed, word, lengths, frequencies: symbolFrequencies(word), complexity: factorComplexity(word, maximumFactorLength) };
  });
  const prefixOverlaps: Array<{ seeds: [SubstitutionSymbol, SubstitutionSymbol]; length: number; fraction: number }> = [];
  for (let left = 0; left < words.length; left += 1) {
    for (let right = left + 1; right < words.length; right += 1) {
      const leftWord = words[left]!;
      const rightWord = words[right]!;
      const length = commonPrefixLength(leftWord.word, rightWord.word);
      prefixOverlaps.push({ seeds: [leftWord.seed, rightWord.seed], length, fraction: length / Math.min(leftWord.word.length, rightWord.word.length) });
    }
  }
  const expectedLength = 2 ** generations;
  return {
    method: "Exact bounded uniform-morphism iteration and finite-word factor enumeration",
    diagnostics: {
      expectedLength,
      exactDoubling: words.every(({ word, lengths }) => word.length === expectedLength && lengths.every((length, generation) => length === 2 ** generation)),
      distinctFinalWords: new Set(words.map(({ word }) => word)).size,
    },
    output: { substitution: SUBSTITUTION, generations, words, prefixOverlaps },
  };
}

export interface SubstitutionSpectrumInputs {
  includePrintedMatrix?: boolean;
}

export function substitutionSpectrumAudit(inputs: SubstitutionSpectrumInputs = {}): EarthKernelResult<{
  canonical: { matrix: number[][]; characteristicCoefficients: [number, number, number, number]; eigenvalues: [number, number, number]; perronRoot: number; normalizedRightPerronVector: [number, number, number]; columnSums: number[] };
  printed: { matrix: number[][]; eigenvalues: [number, number, number]; perronRoot: number; differsFromCanonical: boolean } | null;
}> {
  const matrix = [[1, 1, 1], [1, 0, 1], [0, 1, 0]];
  const printedMatrix = [[1, 1, 1], [1, 1, 0], [1, 0, 1]];
  const printed = inputs.includePrintedMatrix === false ? null : {
    matrix: printedMatrix,
    eigenvalues: [1 - Math.sqrt(2), 1, 1 + Math.sqrt(2)] as [number, number, number],
    perronRoot: 1 + Math.sqrt(2),
    differsFromCanonical: true,
  };
  return {
    method: "Exact incidence counting with analytic 3x3 characteristic spectra",
    diagnostics: {
      canonicalGrowthIsTwo: true,
      claimedGoldenGrowthResidual: 2 - GOLDEN_RATIO,
      printedMatrixPerronResidualToPhi: printed ? printed.perronRoot - GOLDEN_RATIO : null,
    },
    output: {
      canonical: {
        matrix,
        characteristicCoefficients: [1, -1, -2, 0],
        eigenvalues: [-1, 0, 2],
        perronRoot: 2,
        normalizedRightPerronVector: [0.5, 1 / 3, 1 / 6],
        columnSums: [2, 2, 2],
      },
      printed,
    },
  };
}

export interface TorusClassificationInputs {
  pairs: Array<{ p: number; q: number; label?: string }>;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function torusClassificationAudit(inputs: TorusClassificationInputs): EarthKernelResult<{
  classifications: Array<{ p: number; q: number; label: string | null; gcd: number; components: number; kind: "unknot" | "knot" | "link"; minimalCrossingNumber: number }>;
}> {
  if (!Array.isArray(inputs.pairs) || inputs.pairs.length === 0 || inputs.pairs.length > 512) {
    throw new RangeError("pairs must contain 1 to 512 torus pairs");
  }
  const classifications = inputs.pairs.map(({ p: inputP, q: inputQ, label }) => {
    const p = boundedInteger(inputP, "p", -1_000_000, 1_000_000);
    const q = boundedInteger(inputQ, "q", -1_000_000, 1_000_000);
    if (p === 0 || q === 0) throw new RangeError("torus parameters p and q must be non-zero");
    const absoluteP = Math.abs(p);
    const absoluteQ = Math.abs(q);
    const gcd = greatestCommonDivisor(absoluteP, absoluteQ);
    const kind: "unknot" | "knot" | "link" = absoluteP === 1 || absoluteQ === 1 ? "unknot" : gcd === 1 ? "knot" : "link";
    const minimalCrossingNumber = Math.min((absoluteP - 1) * absoluteQ, (absoluteQ - 1) * absoluteP);
    return { p, q, label: label ?? null, gcd, components: gcd, kind, minimalCrossingNumber };
  });
  return {
    method: "Standard torus-link gcd, component, and minimal crossing formulas",
    diagnostics: {
      unknots: classifications.filter(({ kind }) => kind === "unknot").length,
      knots: classifications.filter(({ kind }) => kind === "knot").length,
      links: classifications.filter(({ kind }) => kind === "link").length,
    },
    output: { classifications },
  };
}

export interface DensitySpacingInputs {
  xi0: number;
  referenceDensity: number;
  density: number;
  lengthUnit: string;
  densityUnit: string;
  uncertainty?: { xi0?: number; referenceDensity?: number; density?: number };
}

export function densitySpacingAudit(inputs: DensitySpacingInputs): EarthKernelResult<{
  spacing: number;
  lengthUnit: string;
  densityUnit: string;
  derivatives: { xi0: number; referenceDensity: number; density: number };
  standardUncertainty: number;
  relativeStandardUncertainty: number;
}> {
  const xi0 = positiveNumber(inputs.xi0, "xi0");
  const referenceDensity = positiveNumber(inputs.referenceDensity, "referenceDensity");
  const density = positiveNumber(inputs.density, "density");
  if (!inputs.lengthUnit.trim() || !inputs.densityUnit.trim()) throw new TypeError("lengthUnit and densityUnit are required");
  const spacing = xi0 * (referenceDensity / density) ** (1 / 3);
  const derivatives = {
    xi0: spacing / xi0,
    referenceDensity: spacing / (3 * referenceDensity),
    density: -spacing / (3 * density),
  };
  const uncertainty = inputs.uncertainty ?? {};
  const xiUncertainty = nonNegativeNumber(uncertainty.xi0 ?? 0, "xi0 uncertainty");
  const referenceUncertainty = nonNegativeNumber(uncertainty.referenceDensity ?? 0, "referenceDensity uncertainty");
  const densityUncertainty = nonNegativeNumber(uncertainty.density ?? 0, "density uncertainty");
  const standardUncertainty = Math.hypot(
    derivatives.xi0 * xiUncertainty,
    derivatives.referenceDensity * referenceUncertainty,
    derivatives.density * densityUncertainty,
  );
  return {
    method: "Same-scale density ratio with first-order independent uncertainty propagation",
    diagnostics: {
      densityRatio: referenceDensity / density,
      unitsConverted: false,
      finite: Number.isFinite(spacing) && Number.isFinite(standardUncertainty),
    },
    output: {
      spacing,
      lengthUnit: inputs.lengthUnit,
      densityUnit: inputs.densityUnit,
      derivatives,
      standardUncertainty,
      relativeStandardUncertainty: standardUncertainty / spacing,
    },
  };
}

export interface CouplingInputs {
  rOverXi0: number | number[];
}

export function couplingAudit(inputs: CouplingInputs): EarthKernelResult<{
  points: Array<{ rOverXi0: number; logarithmBasePhi: number; direct: number; intermediate: number; boxed: number; maximumPairwiseRelativeDifference: number }>;
}> {
  const ratios = Array.isArray(inputs.rOverXi0) ? inputs.rOverXi0 : [inputs.rOverXi0];
  if (ratios.length === 0 || ratios.length > 4096) throw new RangeError("rOverXi0 must contain 1 to 4096 values");
  const points = ratios.map((inputRatio) => {
    const rOverXi0 = positiveNumber(inputRatio, "rOverXi0");
    const logarithmBasePhi = Math.log(rOverXi0) / Math.log(GOLDEN_RATIO);
    const direct = GOLDEN_RATIO ** 6 / rOverXi0 ** 6;
    const intermediate = GOLDEN_RATIO ** (6 * (2 - 2 * logarithmBasePhi));
    const boxed = GOLDEN_RATIO ** 12 / rOverXi0 ** 6;
    const values = [direct, intermediate, boxed];
    let maximumPairwiseRelativeDifference = 0;
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        maximumPairwiseRelativeDifference = Math.max(maximumPairwiseRelativeDifference, relativeError(values[left]!, values[right]!));
      }
    }
    return { rOverXi0, logarithmBasePhi, direct, intermediate, boxed, maximumPairwiseRelativeDifference };
  });
  return {
    method: "Common-grid direct evaluation of all three printed coupling forms",
    diagnostics: {
      algebraicallyEquivalent: points.every(({ maximumPairwiseRelativeDifference }) => maximumPairwiseRelativeDifference <= 32 * Number.EPSILON),
      maximumPairwiseRelativeDifference: Math.max(...points.map(({ maximumPairwiseRelativeDifference }) => maximumPairwiseRelativeDifference)),
    },
    output: { points },
  };
}

export interface PlanckTwistInputs {
  twistAngle?: number;
  xi0?: number;
  protonMass?: number;
  speedOfLight?: number;
  codataHbar?: number;
  uncertainty?: { twistAngle?: number; xi0?: number; protonMass?: number };
}

export function planckTwistAudit(inputs: PlanckTwistInputs = {}): EarthKernelResult<{
  twistAngle: number;
  action: number;
  codataHbar: number;
  ratioToCodata: number;
  residual: number;
  derivatives: { twistAngle: number; xi0: number; protonMass: number };
  standardUncertainty: number;
}> {
  const twistAngle = positiveNumber(inputs.twistAngle ?? 1 / Math.sqrt(3 * GOLDEN_RATIO ** 2), "twistAngle");
  const xi0 = positiveNumber(inputs.xi0 ?? 0.15e-15, "xi0");
  const protonMass = positiveNumber(inputs.protonMass ?? 1.67262192369e-27, "protonMass");
  const speedOfLight = positiveNumber(inputs.speedOfLight ?? 299792458, "speedOfLight");
  const codataHbar = positiveNumber(inputs.codataHbar ?? CODATA_HBAR, "codataHbar");
  const action = twistAngle * xi0 * protonMass * speedOfLight / (6 * Math.PI);
  const derivatives = {
    twistAngle: action / twistAngle,
    xi0: action / xi0,
    protonMass: action / protonMass,
  };
  const uncertainty = inputs.uncertainty ?? {};
  const standardUncertainty = Math.hypot(
    derivatives.twistAngle * nonNegativeNumber(uncertainty.twistAngle ?? 0, "twistAngle uncertainty"),
    derivatives.xi0 * nonNegativeNumber(uncertainty.xi0 ?? 0, "xi0 uncertainty"),
    derivatives.protonMass * nonNegativeNumber(uncertainty.protonMass ?? 0, "protonMass uncertainty"),
  );
  return {
    method: "SI evaluation of deltaChi*xi0*(m_p*c/3)/(2*pi) with derivative propagation",
    diagnostics: {
      sourceMatchesCodata: relativeError(action, codataHbar) <= standardUncertainty / codataHbar,
      relativeResidual: relativeError(action, codataHbar),
      finite: Number.isFinite(action) && Number.isFinite(standardUncertainty),
    },
    output: {
      twistAngle,
      action,
      codataHbar,
      ratioToCodata: action / codataHbar,
      residual: action - codataHbar,
      derivatives,
      standardUncertainty,
    },
  };
}
