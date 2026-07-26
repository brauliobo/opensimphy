import {
  boundedInteger,
  finiteNumber,
  positiveNumber,
  relativeError,
  type EarthKernelResult,
} from "./common.js";

export const EARTH_GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
export const EARTH_SPEED_OF_LIGHT = 299_792_458;
export const EARTH_PLANCK_CONSTANT = 6.626_070_15e-34;
export const EARTH_ELEMENTARY_CHARGE = 1.602_176_634e-19;
export const EARTH_HBAR_C_MEV_FM = 197.326_980_4;

export type AuditStatus = "pass" | "failure";

export interface EarthLiteralFinding {
  id: string;
  status: AuditStatus;
  category: "arithmetic" | "dimension" | "topology" | "sequence" | "units" | "dependency" | "source-claim";
  message: string;
  relativeResidual: number | null;
}

function reproductionDiagnostics(extra: Record<string, boolean | number | string | null>): Record<string, boolean | number | string | null> {
  return {
    provenance: "reproduction",
    validatesTheory: false,
    ...extra,
  };
}

function boundedPositive(value: number, name: string, minimum: number, maximum: number): number {
  positiveNumber(value, name);
  if (value < minimum || value > maximum) throw new RangeError(`${name} must be from ${minimum} to ${maximum}`);
  return value;
}

function validateArrayLength(value: unknown[], name: string, minimum: number, maximum: number): void {
  if (value.length < minimum || value.length > maximum) {
    throw new RangeError(`${name} must contain ${minimum} to ${maximum} entries`);
  }
}

// SI base-dimension order: mass, length, time, current, temperature, amount, luminous intensity.
export type DimensionVector = [number, number, number, number, number, number, number];

export interface CanonicalConstantClaim {
  id: string;
  symbol: string;
  expression: string;
  claimedValue: number;
  reproducedValue: number;
  unit: string;
  claimedDimensions: DimensionVector;
  reproducedDimensions: DimensionVector;
  canonicalValue?: number;
  canonicalUnit?: string;
}

export interface CanonicalConstantAuditInputs {
  claims?: CanonicalConstantClaim[];
  relativeTolerance?: number;
}

const DIMENSIONLESS: DimensionVector = [0, 0, 0, 0, 0, 0, 0];
const LENGTH: DimensionVector = [0, 1, 0, 0, 0, 0, 0];
const INVERSE_ENERGY: DimensionVector = [-1, -2, 2, 0, 0, 0, 0];
const ACTION: DimensionVector = [1, 2, -1, 0, 0, 0, 0];

const SOURCE_TWIST = 1 / Math.sqrt(3 * EARTH_GOLDEN_RATIO ** 2);
const SOURCE_LAMBDA = (4 * Math.PI) ** 3;
const SOURCE_XI_FROM_PROTON_RADIUS = 0.8414 * Math.sqrt(10 / 3);
const SOURCE_XI_FROM_PION_ENERGY = 6 * Math.sqrt(2) / (Math.sqrt(2 * Math.PI) * 2 * 92.213721);
const SOURCE_PLANCK_ACTION = SOURCE_TWIST * 0.15e-15 * (1.672_621_923_69e-27 * EARTH_SPEED_OF_LIGHT / 3) / (2 * Math.PI);

export const DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS: CanonicalConstantAuditInputs = {
  relativeTolerance: 1e-10,
  claims: [
    {
      id: "lambda-theory-paper",
      symbol: "lambda0",
      expression: "lambda0=(4*pi)^3",
      claimedValue: 1973.9208802178713,
      reproducedValue: SOURCE_LAMBDA,
      unit: "1",
      claimedDimensions: DIMENSIONLESS,
      reproducedDimensions: DIMENSIONLESS,
    },
    {
      id: "lambda-toolkit",
      symbol: "lambda0",
      expression: "lambda0=(4*pi)^3",
      claimedValue: 44.492,
      reproducedValue: SOURCE_LAMBDA,
      unit: "1",
      claimedDimensions: DIMENSIONLESS,
      reproducedDimensions: DIMENSIONLESS,
    },
    {
      id: "golden-twist",
      symbol: "deltaChi",
      expression: "deltaChi=1/sqrt(3*phi^2)",
      claimedValue: 0.15,
      reproducedValue: SOURCE_TWIST,
      unit: "rad",
      claimedDimensions: DIMENSIONLESS,
      reproducedDimensions: DIMENSIONLESS,
    },
    {
      id: "xi0-proton-radius-route",
      symbol: "xi0",
      expression: "xi0=r_p*sqrt(10/3), r_p=0.8414 fm",
      claimedValue: 0.15,
      reproducedValue: SOURCE_XI_FROM_PROTON_RADIUS,
      unit: "fm",
      claimedDimensions: LENGTH,
      reproducedDimensions: LENGTH,
    },
    {
      id: "xi0-pion-route",
      symbol: "xi0",
      expression: "xi0=6*sqrt(2)/(sqrt(2*pi)*2*f_pi)",
      claimedValue: 0.15,
      reproducedValue: SOURCE_XI_FROM_PION_ENERGY,
      unit: "fm (claimed); MeV^-1 (expression)",
      claimedDimensions: LENGTH,
      reproducedDimensions: INVERSE_ENERGY,
    },
    {
      id: "phi-power-18",
      symbol: "phi^18",
      expression: "phi^18",
      claimedValue: 2584,
      reproducedValue: EARTH_GOLDEN_RATIO ** 18,
      unit: "1",
      claimedDimensions: DIMENSIONLESS,
      reproducedDimensions: DIMENSIONLESS,
    },
    {
      id: "proton-rest-energy",
      symbol: "m_p*c^2",
      expression: "printed proton rest energy",
      claimedValue: 938.2720813,
      reproducedValue: 938.2720813,
      unit: "MeV",
      claimedDimensions: [1, 2, -2, 0, 0, 0, 0],
      reproducedDimensions: [1, 2, -2, 0, 0, 0, 0],
      canonicalValue: 938.27208816,
      canonicalUnit: "MeV",
    },
    {
      id: "planck-twist-action",
      symbol: "hbar",
      expression: "deltaChi*xi0*(m_p*c/3)/(2*pi)",
      claimedValue: 1.054571817e-34,
      reproducedValue: SOURCE_PLANCK_ACTION,
      unit: "J s",
      claimedDimensions: ACTION,
      reproducedDimensions: ACTION,
      canonicalValue: 1.054571817e-34,
      canonicalUnit: "J s",
    },
  ],
};

function validateDimensions(dimensions: DimensionVector, name: string): DimensionVector {
  if (!Array.isArray(dimensions) || dimensions.length !== 7) throw new RangeError(`${name} must contain seven SI exponents`);
  return dimensions.map((value) => boundedInteger(value, `${name} exponent`, -12, 12)) as DimensionVector;
}

function sameDimensions(left: DimensionVector, right: DimensionVector): boolean {
  return left.every((value, index) => value === right[index]);
}

export function canonicalConstantAudit(
  inputs: CanonicalConstantAuditInputs = DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS,
): EarthKernelResult<{
  scope: "literal-known-occurrences";
  claims: Array<CanonicalConstantClaim & { arithmeticResidual: number; canonicalResidual: number | null; arithmeticMatches: boolean; dimensionsMatch: boolean; canonicalMatches: boolean | null }>;
  findings: EarthLiteralFinding[];
  graph: { nodes: Array<{ id: string; symbol: string }>; edges: Array<{ from: string; to: string; relation: "claims" | "compares-to" }> };
}> {
  const claims = inputs.claims ?? DEFAULT_CANONICAL_CONSTANT_AUDIT_INPUTS.claims!;
  validateArrayLength(claims, "claims", 1, 128);
  const relativeTolerance = boundedPositive(inputs.relativeTolerance ?? 1e-10, "relativeTolerance", 1e-16, 0.1);
  const auditedClaims = claims.map((claim) => {
    const claimedValue = finiteNumber(claim.claimedValue, `${claim.id} claimedValue`);
    const reproducedValue = finiteNumber(claim.reproducedValue, `${claim.id} reproducedValue`);
    const canonicalValue = claim.canonicalValue === undefined ? undefined : finiteNumber(claim.canonicalValue, `${claim.id} canonicalValue`);
    const claimedDimensions = validateDimensions(claim.claimedDimensions, `${claim.id} claimedDimensions`);
    const reproducedDimensions = validateDimensions(claim.reproducedDimensions, `${claim.id} reproducedDimensions`);
    const arithmeticResidual = relativeError(reproducedValue, claimedValue);
    const canonicalResidual = canonicalValue === undefined ? null : relativeError(reproducedValue, canonicalValue);
    return {
      ...claim,
      claimedValue,
      reproducedValue,
      claimedDimensions,
      reproducedDimensions,
      canonicalValue,
      arithmeticResidual,
      canonicalResidual,
      arithmeticMatches: arithmeticResidual <= relativeTolerance,
      dimensionsMatch: sameDimensions(claimedDimensions, reproducedDimensions),
      canonicalMatches: canonicalResidual === null ? null : canonicalResidual <= relativeTolerance,
    };
  });
  const findings: EarthLiteralFinding[] = [];
  for (const claim of auditedClaims) {
    if (!claim.arithmeticMatches) findings.push({
      id: `${claim.id}-arithmetic`,
      status: "failure",
      category: "arithmetic",
      message: `${claim.expression} does not reproduce the printed value`,
      relativeResidual: claim.arithmeticResidual,
    });
    if (!claim.dimensionsMatch) findings.push({
      id: `${claim.id}-dimensions`,
      status: "failure",
      category: "dimension",
      message: `${claim.expression} does not have the dimensions assigned by the source`,
      relativeResidual: null,
    });
    if (claim.canonicalMatches === false) findings.push({
      id: `${claim.id}-canonical`,
      status: "failure",
      category: "source-claim",
      message: `${claim.symbol} differs from the supplied canonical comparator`,
      relativeResidual: claim.canonicalResidual,
    });
  }
  const symbols = [...new Set(auditedClaims.map(({ symbol }) => symbol))];
  const canonicalSymbols = [...new Set(auditedClaims.filter(({ canonicalValue }) => canonicalValue !== undefined).map(({ symbol }) => symbol))];
  return {
    method: "Literal Float64 evaluation of a bounded table of known EARTH constant occurrences; no corpus parser",
    diagnostics: reproductionDiagnostics({
      occurrences: auditedClaims.length,
      failedArithmetic: auditedClaims.filter(({ arithmeticMatches }) => !arithmeticMatches).length,
      failedDimensions: auditedClaims.filter(({ dimensionsMatch }) => !dimensionsMatch).length,
      failedCanonicalComparisons: auditedClaims.filter(({ canonicalMatches }) => canonicalMatches === false).length,
    }),
    output: {
      scope: "literal-known-occurrences",
      claims: auditedClaims,
      findings,
      graph: {
        nodes: [
          ...symbols.map((symbol) => ({ id: `symbol:${symbol}`, symbol })),
          ...canonicalSymbols.map((symbol) => ({ id: `canonical:${symbol}`, symbol })),
          ...auditedClaims.map(({ id, symbol }) => ({ id: `claim:${id}`, symbol })),
        ],
        edges: auditedClaims.flatMap(({ id, symbol, canonicalValue }) => [
          { from: `claim:${id}`, to: `symbol:${symbol}`, relation: "claims" as const },
          ...(canonicalValue === undefined ? [] : [{ from: `claim:${id}`, to: `canonical:${symbol}`, relation: "compares-to" as const }]),
        ]),
      },
    },
  };
}

type MorphismSymbol = "1" | "2" | "3";
type Morphism = Record<MorphismSymbol, string>;

export interface SourceSequenceAuditInputs {
  generations?: number;
  digitCount?: number;
  beattyCount?: number;
}

export const DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS: SourceSequenceAuditInputs = {
  generations: 12,
  digitCount: 256,
  beattyCount: 64,
};

const UNIFORM_MORPHISM: Morphism = { "1": "12", "2": "13", "3": "21" };
const GROWTH_MORPHISM: Morphism = { "1": "12", "2": "3", "3": "1" };

function applyMorphism(word: string, morphism: Morphism): string {
  let next = "";
  for (const symbol of word) next += morphism[symbol as MorphismSymbol];
  return next;
}

function morphismWords(morphism: Morphism, generations: number, minimumLength: number): { word: string; lengths: number[] } {
  let word = "1";
  const lengths = [1];
  let generation = 0;
  while (generation < generations || word.length < minimumLength) {
    if (generation >= 18) throw new RangeError("requested sequence prefix exceeds the 18-generation bound");
    word = applyMorphism(word, morphism);
    generation += 1;
    lengths.push(word.length);
  }
  return { word, lengths };
}

function isPrime(value: number): boolean {
  if (value < 2 || !Number.isSafeInteger(value)) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) if (value % divisor === 0) return false;
  return true;
}

function commonSuffixLength(left: string, right: string): number {
  const bound = Math.min(left.length, right.length);
  let length = 0;
  while (length < bound && left[left.length - 1 - length] === right[right.length - 1 - length]) length += 1;
  return length;
}

export function sourceSequenceAudit(
  inputs: SourceSequenceAuditInputs = DEFAULT_SOURCE_SEQUENCE_AUDIT_INPUTS,
): EarthKernelResult<{
  morphisms: Array<{ name: string; rules: Morphism; word: string; lengths: number[]; primeLengthClaims: Array<{ generation: number; length: number; prime: boolean }> }>;
  digitClaim: { digitMap: Record<MorphismSymbol, string>; morphicDigits: string; algebraicPi: number; float64Digits: string; comparedDigits: number; matchingPrefixLength: number; zeroPositions: number[] };
  beattyClaim: { expression: string; positions: number[]; allAppearAsMorphicZeros: boolean };
  seedTailClaim: Array<{ morphism: string; pair: string; commonSuffixLength: number }>;
  findings: EarthLiteralFinding[];
  series: Array<{ n: number; lowerWythoffPosition: number }>;
}> {
  const generations = boundedInteger(inputs.generations ?? 12, "generations", 0, 18);
  const digitCount = boundedInteger(inputs.digitCount ?? 256, "digitCount", 1, 4096);
  const beattyCount = boundedInteger(inputs.beattyCount ?? 64, "beattyCount", 1, 4096);
  const definitions = [
    { name: "uniform-source", rules: UNIFORM_MORPHISM },
    { name: "growth-source", rules: GROWTH_MORPHISM },
  ];
  const morphisms = definitions.map(({ name, rules }) => {
    const generated = morphismWords(rules, generations, digitCount);
    return {
      name,
      rules,
      word: generated.word.slice(0, Math.max(digitCount, 2 ** Math.min(generations, 12))),
      lengths: generated.lengths,
      primeLengthClaims: generated.lengths.slice(0, generations + 1).map((length, generation) => ({ generation, length, prime: isPrime(length) })),
    };
  });
  const uniformWord = morphismWords(UNIFORM_MORPHISM, generations, digitCount).word;
  const digitMap: Record<MorphismSymbol, string> = { "1": "1", "2": "4", "3": "9" };
  const morphicDigits = [...uniformWord.slice(0, digitCount)].map((symbol) => digitMap[symbol as MorphismSymbol]).join("");
  const algebraicPi = Math.sqrt(6) * EARTH_GOLDEN_RATIO ** -2;
  const float64Digits = algebraicPi.toFixed(15).replace(".", "");
  const comparedDigits = Math.min(float64Digits.length, morphicDigits.length);
  let matchingPrefixLength = 0;
  while (matchingPrefixLength < comparedDigits && morphicDigits[matchingPrefixLength] === float64Digits[matchingPrefixLength]) matchingPrefixLength += 1;
  const zeroPositions = [...morphicDigits].flatMap((digit, index) => digit === "0" ? [index + 1] : []);
  const positions = Array.from({ length: beattyCount }, (_, index) => Math.floor((index + 1) * EARTH_GOLDEN_RATIO ** 2) + 1);
  const seedTailClaim = definitions.flatMap(({ name, rules }) => {
    const words = (["1", "2", "3"] as MorphismSymbol[]).map((seed) => {
      let word: string = seed;
      for (let generation = 0; generation < generations; generation += 1) word = applyMorphism(word, rules);
      return { seed, word };
    });
    return [[0, 1], [0, 2], [1, 2]].map(([left, right]) => ({
      morphism: name,
      pair: `${words[left]!.seed}/${words[right]!.seed}`,
      commonSuffixLength: commonSuffixLength(words[left]!.word, words[right]!.word),
    }));
  });
  const findings: EarthLiteralFinding[] = [
    {
      id: "digit-map-prefix",
      status: matchingPrefixLength === comparedDigits ? "pass" : "failure",
      category: "sequence",
      message: "The printed 1->1, 2->4, 3->9 map does not generate the Float64 prefix of the printed algebraic pi expression",
      relativeResidual: null,
    },
    {
      id: "beatty-zero-positions",
      status: positions.every((position) => zeroPositions.includes(position)) ? "pass" : "failure",
      category: "sequence",
      message: "The mapped alphabet contains no zero, so its zero positions cannot be the lower Wythoff sequence",
      relativeResidual: null,
    },
    {
      id: "prime-crossings",
      status: morphisms.every(({ primeLengthClaims }) => primeLengthClaims.every(({ length, prime }) => length < 2 || prime)) ? "pass" : "failure",
      category: "sequence",
      message: "Bounded generation lengths are not always prime",
      relativeResidual: null,
    },
  ];
  return {
    method: "Exact bounded string iteration, literal digit mapping, primality trial division, and Beatty evaluation",
    diagnostics: reproductionDiagnostics({
      generations,
      digitCount,
      beattyCount,
      deterministic: true,
      failedClaims: findings.filter(({ status }) => status === "failure").length,
    }),
    output: {
      morphisms,
      digitClaim: { digitMap, morphicDigits, algebraicPi, float64Digits, comparedDigits, matchingPrefixLength, zeroPositions },
      beattyClaim: { expression: "floor(n*phi^2)+1, n>=1", positions, allAppearAsMorphicZeros: positions.every((position) => zeroPositions.includes(position)) },
      seedTailClaim,
      findings,
      series: positions.map((lowerWythoffPosition, index) => ({ n: index + 1, lowerWythoffPosition })),
    },
  };
}

export interface NuclearPairSourceClaim {
  label: string;
  p: number;
  q: number;
  claimedA?: number;
  claimedZ?: number;
  claimedKind?: "unknot" | "knot" | "link";
}

export interface NuclearPairEnumerationInputs {
  maximumP?: number;
  maximumQ?: number;
  coprimeOnly?: boolean;
  enforceThreeStrandRule?: boolean;
  sourceClaims?: NuclearPairSourceClaim[];
}

export const DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS: NuclearPairEnumerationInputs = {
  maximumP: 12,
  maximumQ: 12,
  coprimeOnly: true,
  enforceThreeStrandRule: true,
  sourceClaims: [
    { label: "proton", p: 3, q: 1, claimedA: 1, claimedZ: 1, claimedKind: "knot" },
    { label: "helium-4", p: 3, q: 3, claimedA: 4, claimedZ: 2, claimedKind: "knot" },
    { label: "carbon-12", p: 5, q: 5, claimedA: 12, claimedZ: 6, claimedKind: "knot" },
  ],
};

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function standardTorusRules(p: number, q: number): { gcd: number; components: number; kind: "unknot" | "knot" | "link"; minimalCrossingNumber: number } {
  const gcd = greatestCommonDivisor(p, q);
  return {
    gcd,
    components: gcd,
    kind: p === 1 || q === 1 ? "unknot" : gcd === 1 ? "knot" : "link",
    minimalCrossingNumber: Math.min((p - 1) * q, (q - 1) * p),
  };
}

export function nuclearPairEnumerationAudit(
  inputs: NuclearPairEnumerationInputs = DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS,
): EarthKernelResult<{
  candidates: Array<{ p: number; q: number; gcd: number; components: number; kind: "unknot" | "knot" | "link"; minimalCrossingNumber: number; sourceA: number; sourceZ: number; sourceEnergyMetric: number }>;
  sourceClaims: Array<NuclearPairSourceClaim & { standardKind: "unknot" | "knot" | "link"; standardCrossingNumber: number; sourceRuleA: number; sourceRuleZ: number; contradictions: string[] }>;
  findings: EarthLiteralFinding[];
  series: Array<{ p: number; q: number; crossingNumber: number; energyMetric: number }>;
}> {
  const maximumP = boundedInteger(inputs.maximumP ?? 12, "maximumP", 1, 512);
  const maximumQ = boundedInteger(inputs.maximumQ ?? 12, "maximumQ", 1, 512);
  if (maximumP * maximumQ > 65_536) throw new RangeError("maximumP*maximumQ must not exceed 65536");
  const coprimeOnly = inputs.coprimeOnly ?? true;
  const enforceThreeStrandRule = inputs.enforceThreeStrandRule ?? true;
  const candidates = [];
  for (let p = 1; p <= maximumP; p += 1) {
    for (let q = 1; q <= maximumQ; q += 1) {
      const standard = standardTorusRules(p, q);
      if (coprimeOnly && standard.gcd !== 1) continue;
      if (enforceThreeStrandRule && p > q + 2) continue;
      candidates.push({
        p,
        q,
        ...standard,
        sourceA: p * q,
        sourceZ: p - 3,
        sourceEnergyMetric: p ** 2 + q ** 2 + p * q,
      });
    }
  }
  const sourceClaims = inputs.sourceClaims ?? DEFAULT_NUCLEAR_PAIR_ENUMERATION_INPUTS.sourceClaims!;
  validateArrayLength(sourceClaims, "sourceClaims", 0, 512);
  const auditedClaims = sourceClaims.map((claim) => {
    const p = boundedInteger(claim.p, `${claim.label} p`, 1, 1_000_000);
    const q = boundedInteger(claim.q, `${claim.label} q`, 1, 1_000_000);
    const standard = standardTorusRules(p, q);
    const sourceRuleA = p * q;
    const sourceRuleZ = p - 3;
    const contradictions: string[] = [];
    if (claim.claimedA !== undefined && boundedInteger(claim.claimedA, `${claim.label} claimedA`, 0, 1_000_000_000) !== sourceRuleA) contradictions.push("claimed A differs from printed A=p*q");
    if (claim.claimedZ !== undefined && boundedInteger(claim.claimedZ, `${claim.label} claimedZ`, -1_000_000, 1_000_000) !== sourceRuleZ) contradictions.push("claimed Z differs from printed Z=p-3");
    if (claim.claimedKind !== undefined && claim.claimedKind !== standard.kind) contradictions.push("claimed topology differs from standard torus classification");
    if (standard.gcd !== 1) contradictions.push("pair is not coprime");
    return { ...claim, p, q, standardKind: standard.kind, standardCrossingNumber: standard.minimalCrossingNumber, sourceRuleA, sourceRuleZ, contradictions };
  });
  const findings = auditedClaims.flatMap((claim): EarthLiteralFinding[] => claim.contradictions.map((message, index) => ({
    id: `${claim.label}-${index + 1}`,
    status: "failure",
    category: message.includes("topology") || message.includes("coprime") ? "topology" : "source-claim",
    message,
    relativeResidual: null,
  })));
  return {
    method: "Bounded positive (p,q) enumeration using gcd, standard torus component/crossing formulas, and literal EARTH A/Z/energy rules",
    diagnostics: reproductionDiagnostics({
      candidates: candidates.length,
      sourceClaims: auditedClaims.length,
      contradictions: findings.length,
      deterministic: true,
    }),
    output: {
      candidates,
      sourceClaims: auditedClaims,
      findings,
      series: candidates.map(({ p, q, minimalCrossingNumber, sourceEnergyMetric }) => ({ p, q, crossingNumber: minimalCrossingNumber, energyMetric: sourceEnergyMetric })),
    },
  };
}

export interface ProtonFormulaAuditInputs {
  xi0Fm?: number;
  protonChargeRadiusFm?: number;
  canonicalProtonChargeRadiusFm?: number;
  canonicalProtonEnergyMeV?: number;
  hbarCMeVFm?: number;
  lambdaClaims?: Array<{ label: string; value: number }>;
}

export const DEFAULT_PROTON_FORMULA_AUDIT_INPUTS: ProtonFormulaAuditInputs = {
  xi0Fm: 0.15,
  protonChargeRadiusFm: 0.8414,
  canonicalProtonChargeRadiusFm: 0.84075,
  canonicalProtonEnergyMeV: 938.27208816,
  hbarCMeVFm: EARTH_HBAR_C_MEV_FM,
  lambdaClaims: [
    { label: "toolkit printed 44.492", value: 44.492 },
    { label: "theory-paper printed 1973.9208802178713", value: 1973.9208802178713 },
    { label: "literal (4*pi)^3", value: SOURCE_LAMBDA },
  ],
};

export function protonFormulaAudit(
  inputs: ProtonFormulaAuditInputs = DEFAULT_PROTON_FORMULA_AUDIT_INPUTS,
): EarthKernelResult<{
  radius: { xi0Fm: number; sourceChargeRadiusFm: number; canonicalChargeRadiusFm: number; xiFromPrintedRadiusRouteFm: number; radiusFromInvertedRouteFm: number; tubeRadiusFm: number };
  energyVariants: Array<{ label: string; lambda0: number; inverseLengthFm: number; convertedEnergyMeV: number; relativeResidualToCanonical: number }>;
  findings: EarthLiteralFinding[];
  series: Array<{ lambda0: number; convertedEnergyMeV: number }>;
}> {
  const xi0Fm = boundedPositive(inputs.xi0Fm ?? 0.15, "xi0Fm", 1e-12, 1e6);
  const protonChargeRadiusFm = boundedPositive(inputs.protonChargeRadiusFm ?? 0.8414, "protonChargeRadiusFm", 1e-12, 1e6);
  const canonicalProtonChargeRadiusFm = boundedPositive(inputs.canonicalProtonChargeRadiusFm ?? 0.84075, "canonicalProtonChargeRadiusFm", 1e-12, 1e6);
  const canonicalProtonEnergyMeV = boundedPositive(inputs.canonicalProtonEnergyMeV ?? 938.27208816, "canonicalProtonEnergyMeV", 1e-12, 1e12);
  const hbarCMeVFm = boundedPositive(inputs.hbarCMeVFm ?? EARTH_HBAR_C_MEV_FM, "hbarCMeVFm", 1e-12, 1e12);
  const lambdaClaims = inputs.lambdaClaims ?? DEFAULT_PROTON_FORMULA_AUDIT_INPUTS.lambdaClaims!;
  validateArrayLength(lambdaClaims, "lambdaClaims", 1, 32);
  const energyVariants = lambdaClaims.map(({ label, value }) => {
    const lambda0 = boundedPositive(value, `${label} lambda0`, 1e-12, 1e12);
    const inverseLengthFm = Math.PI ** 2 * Math.sqrt(lambda0) / xi0Fm;
    const convertedEnergyMeV = inverseLengthFm * hbarCMeVFm;
    return { label, lambda0, inverseLengthFm, convertedEnergyMeV, relativeResidualToCanonical: relativeError(convertedEnergyMeV, canonicalProtonEnergyMeV) };
  });
  const xiFromPrintedRadiusRouteFm = protonChargeRadiusFm * Math.sqrt(10 / 3);
  const radiusFromInvertedRouteFm = xi0Fm / Math.sqrt(10 / 3);
  const tubeRadiusFm = xi0Fm * EARTH_GOLDEN_RATIO ** -2;
  const findings: EarthLiteralFinding[] = [
    {
      id: "proton-radius-route",
      status: relativeError(xiFromPrintedRadiusRouteFm, xi0Fm) <= 1e-10 ? "pass" : "failure",
      category: "arithmetic",
      message: "xi0=r_p*sqrt(10/3) does not yield the printed xi0 from the printed proton radius",
      relativeResidual: relativeError(xiFromPrintedRadiusRouteFm, xi0Fm),
    },
    ...energyVariants.map(({ label, relativeResidualToCanonical }): EarthLiteralFinding => ({
      id: `proton-energy-${label}`,
      status: relativeResidualToCanonical <= 1e-6 ? "pass" : "failure",
      category: "units",
      message: "pi^2*sqrt(lambda0)/xi0 has inverse-length units and does not reproduce proton energy after explicit hbar*c conversion",
      relativeResidual: relativeResidualToCanonical,
    })),
  ];
  return {
    method: "Literal radius and inverse-length mass/energy formulas with explicit fm-to-MeV conversion by hbar*c",
    diagnostics: reproductionDiagnostics({
      failedClaims: findings.filter(({ status }) => status === "failure").length,
      energyUnitConversion: "MeV fm / fm",
      sourceFormulaIsEnergyWithoutConversion: false,
    }),
    output: {
      radius: { xi0Fm, sourceChargeRadiusFm: protonChargeRadiusFm, canonicalChargeRadiusFm: canonicalProtonChargeRadiusFm, xiFromPrintedRadiusRouteFm, radiusFromInvertedRouteFm, tubeRadiusFm },
      energyVariants,
      findings,
      series: energyVariants.map(({ lambda0, convertedEnergyMeV }) => ({ lambda0, convertedEnergyMeV })),
    },
  };
}

export interface ElectronBohrRydbergAuditInputs {
  atomicNumber?: number;
  xi0M?: number;
  protonEnergyMeV?: number;
  canonicalElectronEnergyMeV?: number;
  canonicalBohrRadiusM?: number;
  canonicalRydbergPerM?: number;
  sourceClaimedPhi18?: number;
  sourceClaimedAlphaInverse?: number;
}

export const DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS: ElectronBohrRydbergAuditInputs = {
  atomicNumber: 1,
  xi0M: 0.15e-15,
  protonEnergyMeV: 938.2720813,
  canonicalElectronEnergyMeV: 0.51099895,
  canonicalBohrRadiusM: 5.29177210544e-11,
  canonicalRydbergPerM: 10_973_731.568157,
  sourceClaimedPhi18: 2584,
  sourceClaimedAlphaInverse: 137.0359990842167,
};

export function electronBohrRydbergAudit(
  inputs: ElectronBohrRydbergAuditInputs = DEFAULT_ELECTRON_BOHR_RYDBERG_AUDIT_INPUTS,
): EarthKernelResult<{
  dependencies: { phi: number; actualPhi18: number; claimedPhi18: number; computedAlphaInverse: number; claimedAlphaInverse: number };
  bohr: { unit: "m"; canonical: number; bareActualDependencies: number; effectiveActualDependencies: number; effectiveClaimedDependencies: number; sourcePrintedResult: number };
  electron: { unit: "MeV/c^2"; canonical: number; actualDependencies: number; claimedDependencies: number; sourcePrintedResult: number };
  rydberg: { unit: "m^-1"; canonical: number; fromActualElectronFormula: number; fromClaimedElectronFormula: number; sourcePrintedResult: number };
  findings: EarthLiteralFinding[];
  graph: { nodes: string[]; edges: Array<{ from: string; to: string }> };
}> {
  const atomicNumber = boundedInteger(inputs.atomicNumber ?? 1, "atomicNumber", 1, 118);
  const xi0M = boundedPositive(inputs.xi0M ?? 0.15e-15, "xi0M", 1e-30, 1);
  const protonEnergyMeV = boundedPositive(inputs.protonEnergyMeV ?? 938.2720813, "protonEnergyMeV", 1e-12, 1e12);
  const canonicalElectronEnergyMeV = boundedPositive(inputs.canonicalElectronEnergyMeV ?? 0.51099895, "canonicalElectronEnergyMeV", 1e-12, 1e12);
  const canonicalBohrRadiusM = boundedPositive(inputs.canonicalBohrRadiusM ?? 5.29177210544e-11, "canonicalBohrRadiusM", 1e-30, 1);
  const canonicalRydbergPerM = boundedPositive(inputs.canonicalRydbergPerM ?? 10_973_731.568157, "canonicalRydbergPerM", 1e-12, 1e30);
  const claimedPhi18 = boundedPositive(inputs.sourceClaimedPhi18 ?? 2584, "sourceClaimedPhi18", 1e-12, 1e12);
  const claimedAlphaInverse = boundedPositive(inputs.sourceClaimedAlphaInverse ?? 137.0359990842167, "sourceClaimedAlphaInverse", 1e-12, 1e12);
  const actualPhi18 = EARTH_GOLDEN_RATIO ** 18;
  const computedAlphaInverse = 120 * Math.PI * 3 * EARTH_GOLDEN_RATIO ** 2;
  const bareActualDependencies = xi0M * actualPhi18 / atomicNumber;
  const effectiveActualDependencies = xi0M * actualPhi18 * computedAlphaInverse / atomicNumber;
  const effectiveClaimedDependencies = xi0M * claimedPhi18 * claimedAlphaInverse / atomicNumber;
  const sourcePrintedBohr = 5.29177210903e-11 / atomicNumber;
  const actualElectron = protonEnergyMeV * EARTH_GOLDEN_RATIO ** -36 / computedAlphaInverse;
  const claimedElectron = protonEnergyMeV / claimedPhi18 ** 2 / claimedAlphaInverse;
  const sourcePrintedElectron = 0.5109989461;
  const rydbergFromEnergy = (energyMeV: number, alphaInverse: number) => energyMeV * 1e6 * EARTH_ELEMENTARY_CHARGE / (2 * EARTH_PLANCK_CONSTANT * EARTH_SPEED_OF_LIGHT * alphaInverse ** 2);
  const fromActualElectronFormula = rydbergFromEnergy(actualElectron, computedAlphaInverse);
  const fromClaimedElectronFormula = rydbergFromEnergy(claimedElectron, claimedAlphaInverse);
  const sourcePrintedRydberg = 10_973_731.56816;
  const checks = [
    ["alpha-expression", computedAlphaInverse, claimedAlphaInverse, "The printed alpha inverse expression does not produce its claimed value", "arithmetic"],
    ["bohr-formula", effectiveActualDependencies, canonicalBohrRadiusM, "The Bohr formula with evaluated dependencies does not reproduce the canonical radius", "source-claim"],
    ["electron-formula", actualElectron, canonicalElectronEnergyMeV, "The electron mass formula does not reproduce the canonical electron rest energy", "source-claim"],
    ["rydberg-formula", fromActualElectronFormula, canonicalRydbergPerM, "The Rydberg formula fed by the electron formula does not reproduce the canonical constant", "dependency"],
  ] as const;
  const findings: EarthLiteralFinding[] = checks.map(([id, actual, expected, message, category]) => ({
    id,
    status: relativeError(actual, expected) <= 1e-8 ? "pass" : "failure",
    category,
    message,
    relativeResidual: relativeError(actual, expected),
  }));
  findings.push({
    id: "canonical-output-circularity",
    status: "failure",
    category: "dependency",
    message: "Printed Bohr, electron, and Rydberg outputs are canonical-looking constants not obtained from the printed intermediate formulas",
    relativeResidual: null,
  });
  return {
    method: "Literal EARTH electron/Bohr formulas followed by SI Rydberg conversion and canonical residuals",
    diagnostics: reproductionDiagnostics({
      failedClaims: findings.filter(({ status }) => status === "failure").length,
      atomicNumber,
      unitsExplicit: true,
    }),
    output: {
      dependencies: { phi: EARTH_GOLDEN_RATIO, actualPhi18, claimedPhi18, computedAlphaInverse, claimedAlphaInverse },
      bohr: { unit: "m", canonical: canonicalBohrRadiusM / atomicNumber, bareActualDependencies, effectiveActualDependencies, effectiveClaimedDependencies, sourcePrintedResult: sourcePrintedBohr },
      electron: { unit: "MeV/c^2", canonical: canonicalElectronEnergyMeV, actualDependencies: actualElectron, claimedDependencies: claimedElectron, sourcePrintedResult: sourcePrintedElectron },
      rydberg: { unit: "m^-1", canonical: canonicalRydbergPerM, fromActualElectronFormula, fromClaimedElectronFormula, sourcePrintedResult: sourcePrintedRydberg },
      findings,
      graph: {
        nodes: ["xi0", "phi", "alpha", "proton-energy", "bohr-radius", "electron-energy", "rydberg", "h", "c"],
        edges: [
          { from: "xi0", to: "bohr-radius" },
          { from: "phi", to: "bohr-radius" },
          { from: "alpha", to: "bohr-radius" },
          { from: "proton-energy", to: "electron-energy" },
          { from: "phi", to: "electron-energy" },
          { from: "alpha", to: "electron-energy" },
          { from: "electron-energy", to: "rydberg" },
          { from: "alpha", to: "rydberg" },
          { from: "h", to: "rydberg" },
          { from: "c", to: "rydberg" },
        ],
      },
    },
  };
}

export interface BondPotentialAuditInputs {
  A: number;
  k: number;
  d0: number;
  minimumDistance?: number;
  maximumDistance?: number;
  samples?: number;
  distanceUnit?: string;
  energyUnit?: string;
}

export const DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS: BondPotentialAuditInputs = {
  A: 1,
  k: 1,
  d0: 1,
  minimumDistance: 0.25,
  maximumDistance: 3,
  samples: 129,
  distanceUnit: "normalized distance",
  energyUnit: "normalized energy",
};

export function bondPotentialAudit(inputs: BondPotentialAuditInputs = DEFAULT_BOND_POTENTIAL_AUDIT_INPUTS): EarthKernelResult<{
  parameters: { A: number; k: number; d0: number; distanceUnit: string; energyUnit: string };
  minimum: { distance: number; potential: number; firstDerivative: number; hessian: number };
  sensitivity: { A: number; k: number; d0: number };
  series: Array<{ distance: number; potential: number; firstDerivative: number }>;
  findings: EarthLiteralFinding[];
}> {
  if (inputs.A === undefined || inputs.k === undefined || inputs.d0 === undefined) throw new TypeError("A, k, and d0 are required");
  const A = boundedPositive(inputs.A, "A", 1e-12, 1e12);
  const k = boundedPositive(inputs.k, "k", 1e-12, 1e12);
  const d0 = boundedPositive(inputs.d0, "d0", 1e-9, 1e9);
  const minimumDistance = boundedPositive(inputs.minimumDistance ?? d0 / 4, "minimumDistance", 1e-9, 1e9);
  const maximumDistance = boundedPositive(inputs.maximumDistance ?? d0 * 3, "maximumDistance", 1e-9, 1e9);
  if (maximumDistance <= minimumDistance) throw new RangeError("maximumDistance must be greater than minimumDistance");
  const samples = boundedInteger(inputs.samples ?? 129, "samples", 2, 4096);
  const distanceUnit = inputs.distanceUnit?.trim() || "normalized distance";
  const energyUnit = inputs.energyUnit?.trim() || "normalized energy";
  const potential = (distance: number) => A / distance ** 2 + k * (distance - d0) ** 2;
  const derivative = (distance: number) => -2 * A / distance ** 3 + 2 * k * (distance - d0);
  let lower = d0;
  let upper = Math.max(2 * d0, d0 + 1);
  for (let expansion = 0; derivative(upper) <= 0 && expansion < 128; expansion += 1) upper *= 2;
  if (!Number.isFinite(upper) || derivative(upper) <= 0) throw new RangeError("A, k, and d0 place the minimum outside the bounded Float64 search");
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (derivative(midpoint) < 0) lower = midpoint;
    else upper = midpoint;
  }
  const distance = (lower + upper) / 2;
  const hessian = 6 * A / distance ** 4 + 2 * k;
  const implicitDenominator = k * distance ** 2 * (4 * distance - 3 * d0);
  const sensitivity = {
    A: 1 / implicitDenominator,
    k: -(distance - d0) * distance ** 3 / implicitDenominator,
    d0: k * distance ** 3 / implicitDenominator,
  };
  const spacing = (maximumDistance - minimumDistance) / (samples - 1);
  const series = Array.from({ length: samples }, (_, index) => {
    const sampleDistance = minimumDistance + index * spacing;
    return { distance: sampleDistance, potential: potential(sampleDistance), firstDerivative: derivative(sampleDistance) };
  });
  return {
    method: "Analytic derivatives and deterministic bisection for U(d)=A/d^2+k(d-d0)^2",
    diagnostics: reproductionDiagnostics({
      explicitParameters: true,
      samples,
      convexForPositiveDistance: true,
      finite: series.every(({ potential: value, firstDerivative }) => Number.isFinite(value) && Number.isFinite(firstDerivative)),
    }),
    output: {
      parameters: { A, k, d0, distanceUnit, energyUnit },
      minimum: { distance, potential: potential(distance), firstDerivative: derivative(distance), hessian },
      sensitivity,
      series,
      findings: [{ id: "source-parameters", status: "failure", category: "dependency", message: "The source does not physically specify A, k, and d0; this reproduction uses only the explicit supplied values", relativeResidual: null }],
    },
  };
}

export interface ShellCapacityAuditInputs {
  shells?: number;
  xi0Fm?: number;
}

export const DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS: ShellCapacityAuditInputs = {
  shells: 8,
  xi0Fm: 0.15,
};

export function shellCapacityAudit(
  inputs: ShellCapacityAuditInputs = DEFAULT_SHELL_CAPACITY_AUDIT_INPUTS,
): EarthKernelResult<{
  shells: Array<{ index: number; principalShell: number; radiusFm: number; printedFormulaCapacity: number; printedSequenceCapacity: number; standardCapacity: number; printedCumulative: number; standardCumulative: number; formulaMatchesPrintedSequence: boolean }>;
  findings: EarthLiteralFinding[];
  series: Array<{ principalShell: number; printedFormulaCapacity: number; standardCapacity: number }>;
}> {
  const shellCount = boundedInteger(inputs.shells ?? 8, "shells", 1, 64);
  const xi0Fm = boundedPositive(inputs.xi0Fm ?? 0.15, "xi0Fm", 1e-12, 1e6);
  let printedCumulative = 0;
  let standardCumulative = 0;
  const shells = Array.from({ length: shellCount }, (_, index) => {
    const principalShell = index + 1;
    const printedFormulaCapacity = 2 * (index + 1) * (index + 2);
    const printedSequenceCapacity = 2 * principalShell ** 2;
    const standardCapacity = 2 * principalShell ** 2;
    printedCumulative += printedFormulaCapacity;
    standardCumulative += standardCapacity;
    return {
      index,
      principalShell,
      radiusFm: xi0Fm * EARTH_GOLDEN_RATIO ** (18 + 3 * index),
      printedFormulaCapacity,
      printedSequenceCapacity,
      standardCapacity,
      printedCumulative,
      standardCumulative,
      formulaMatchesPrintedSequence: printedFormulaCapacity === printedSequenceCapacity,
    };
  });
  const failures = shells.filter(({ formulaMatchesPrintedSequence }) => !formulaMatchesPrintedSequence);
  const findings: EarthLiteralFinding[] = failures.map(({ principalShell, printedFormulaCapacity, printedSequenceCapacity }) => ({
    id: `shell-${principalShell}`,
    status: "failure",
    category: "arithmetic",
    message: `Printed formula gives ${printedFormulaCapacity}, while the adjacent printed sequence gives ${printedSequenceCapacity}`,
    relativeResidual: relativeError(printedFormulaCapacity, printedSequenceCapacity),
  }));
  return {
    method: "Direct bounded evaluation of the printed shell radius/capacity formula beside the printed and standard 2n^2 sequence",
    diagnostics: reproductionDiagnostics({
      shellCount,
      formulaSequenceMismatches: failures.length,
      radiusUnit: "fm",
      deterministic: true,
    }),
    output: {
      shells,
      findings,
      series: shells.map(({ principalShell, printedFormulaCapacity, standardCapacity }) => ({ principalShell, printedFormulaCapacity, standardCapacity })),
    },
  };
}

export type SpectrumClaimUnit = "Hz" | "cm^-1" | "nm" | "eV";

export interface StandingWaveModeInput {
  label: string;
  distanceAngstrom: number;
  harmonic: number;
  claimedValue?: number;
  claimedUnit?: SpectrumClaimUnit;
}

export interface StandingWaveSpectrumInputs {
  modes?: StandingWaveModeInput[];
  twistAngle?: number;
  speedOfLight?: number;
  planckConstant?: number;
  elementaryCharge?: number;
}

export const DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS: StandingWaveSpectrumInputs = {
  twistAngle: 0.15,
  modes: [
    { label: "C-H stretch", distanceAngstrom: 1.09, harmonic: 1, claimedValue: 3030, claimedUnit: "cm^-1" },
    { label: "C=C stretch", distanceAngstrom: 1.34, harmonic: 1, claimedValue: 1650, claimedUnit: "cm^-1" },
    { label: "C triple C stretch", distanceAngstrom: 1.203, harmonic: 1, claimedValue: 2140, claimedUnit: "cm^-1" },
    { label: "carbonyl UV-vis", distanceAngstrom: 1.23, harmonic: 1, claimedValue: 287, claimedUnit: "nm" },
    { label: "Cu K-alpha", distanceAngstrom: 1.54, harmonic: 1, claimedValue: 8047.8, claimedUnit: "eV" },
  ],
};

export function standingWaveSpectrumAudit(
  inputs: StandingWaveSpectrumInputs = DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS,
): EarthKernelResult<{
  modes: Array<StandingWaveModeInput & { distanceM: number; standingWavelengthM: number; standardFrequencyHz: number; printedFrequencyHz: number; printedWavenumberPerCm: number; printedWavelengthNm: number; printedEnergyEv: number; claimedComputedValue: number | null; claimedRelativeResidual: number | null }>;
  findings: EarthLiteralFinding[];
  series: Array<{ harmonic: number; frequencyHz: number; wavenumberPerCm: number; energyEv: number }>;
}> {
  const modes = inputs.modes ?? DEFAULT_STANDING_WAVE_SPECTRUM_AUDIT_INPUTS.modes!;
  validateArrayLength(modes, "modes", 1, 512);
  const twistAngle = boundedPositive(inputs.twistAngle ?? 0.15, "twistAngle", 1e-9, 1e3);
  const speedOfLight = boundedPositive(inputs.speedOfLight ?? EARTH_SPEED_OF_LIGHT, "speedOfLight", 1, 1e10);
  const planckConstant = boundedPositive(inputs.planckConstant ?? EARTH_PLANCK_CONSTANT, "planckConstant", 1e-40, 1e-30);
  const elementaryCharge = boundedPositive(inputs.elementaryCharge ?? EARTH_ELEMENTARY_CHARGE, "elementaryCharge", 1e-25, 1e-15);
  const computedModes = modes.map((mode) => {
    const distanceAngstrom = boundedPositive(mode.distanceAngstrom, `${mode.label} distanceAngstrom`, 1e-6, 1e9);
    const harmonic = boundedInteger(mode.harmonic, `${mode.label} harmonic`, 1, 10_000);
    const distanceM = distanceAngstrom * 1e-10;
    const standingWavelengthM = 2 * distanceM / harmonic;
    const standardFrequencyHz = speedOfLight / standingWavelengthM;
    const printedFrequencyHz = harmonic * 3 * speedOfLight / (2 * Math.PI * distanceM) * twistAngle ** 2;
    const printedWavenumberPerCm = printedFrequencyHz / (speedOfLight * 100);
    const printedWavelengthNm = speedOfLight / printedFrequencyHz * 1e9;
    const printedEnergyEv = planckConstant * printedFrequencyHz / elementaryCharge;
    const claimedValue = mode.claimedValue === undefined ? undefined : finiteNumber(mode.claimedValue, `${mode.label} claimedValue`);
    const claimedComputedValue = claimedValue === undefined || mode.claimedUnit === undefined ? null : {
      Hz: printedFrequencyHz,
      "cm^-1": printedWavenumberPerCm,
      nm: printedWavelengthNm,
      eV: printedEnergyEv,
    }[mode.claimedUnit];
    return {
      ...mode,
      distanceAngstrom,
      harmonic,
      claimedValue,
      distanceM,
      standingWavelengthM,
      standardFrequencyHz,
      printedFrequencyHz,
      printedWavenumberPerCm,
      printedWavelengthNm,
      printedEnergyEv,
      claimedComputedValue,
      claimedRelativeResidual: claimedValue === undefined || claimedComputedValue === null ? null : relativeError(claimedComputedValue, claimedValue),
    };
  });
  const findings: EarthLiteralFinding[] = computedModes.flatMap((mode) => mode.claimedRelativeResidual === null ? [] : [{
    id: `spectrum-${mode.label}`,
    status: mode.claimedRelativeResidual <= 1e-8 ? "pass" as const : "failure" as const,
    category: "units" as const,
    message: `The printed frequency law converted to ${mode.claimedUnit} does not reproduce the source example`,
    relativeResidual: mode.claimedRelativeResidual,
  }]);
  return {
    method: "Literal lambda_m=2d/m and printed twist-frequency law with explicit SI, cm^-1, nm, and eV conversions",
    diagnostics: reproductionDiagnostics({
      modes: computedModes.length,
      failedSourceExamples: findings.filter(({ status }) => status === "failure").length,
      lengthInputUnit: "angstrom",
      frequencyOutputUnit: "Hz",
    }),
    output: {
      modes: computedModes,
      findings,
      series: computedModes.map(({ harmonic, printedFrequencyHz, printedWavenumberPerCm, printedEnergyEv }) => ({ harmonic, frequencyHz: printedFrequencyHz, wavenumberPerCm: printedWavenumberPerCm, energyEv: printedEnergyEv })),
    },
  };
}

export interface CriticalTemperatureExample {
  multiplier: number;
  claimedKelvin?: number;
  label?: string;
}

export interface CriticalTemperatureAuditInputs {
  deltaEnergyKcalPerMol?: number;
  boltzmannKcalPerMolKelvin?: number;
  examples?: CriticalTemperatureExample[];
}

export const DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS: CriticalTemperatureAuditInputs = {
  deltaEnergyKcalPerMol: 2.61,
  boltzmannKcalPerMolKelvin: 0.001986,
  examples: [
    { multiplier: 1, claimedKelvin: 1313, label: "printed T0" },
    { multiplier: 2, claimedKelvin: 2626, label: "two strands" },
    { multiplier: 3, claimedKelvin: 3939, label: "three strands" },
  ],
};

export function criticalTemperatureAudit(
  inputs: CriticalTemperatureAuditInputs = DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS,
): EarthKernelResult<{
  deltaEnergyKcalPerMol: number;
  boltzmannKcalPerMolKelvin: number;
  baseTemperatureKelvin: number;
  examples: Array<CriticalTemperatureExample & { temperatureKelvin: number; claimedRelativeResidual: number | null }>;
  findings: EarthLiteralFinding[];
  series: Array<{ multiplier: number; temperatureKelvin: number }>;
}> {
  const deltaEnergyKcalPerMol = boundedPositive(inputs.deltaEnergyKcalPerMol ?? 2.61, "deltaEnergyKcalPerMol", 1e-12, 1e9);
  const boltzmannKcalPerMolKelvin = boundedPositive(inputs.boltzmannKcalPerMolKelvin ?? 0.001986, "boltzmannKcalPerMolKelvin", 1e-12, 1);
  const sourceExamples = inputs.examples ?? DEFAULT_CRITICAL_TEMPERATURE_AUDIT_INPUTS.examples!;
  validateArrayLength(sourceExamples, "examples", 1, 256);
  const baseTemperatureKelvin = deltaEnergyKcalPerMol / boltzmannKcalPerMolKelvin;
  const examples = sourceExamples.map((example) => {
    const multiplier = boundedInteger(example.multiplier, `${example.label ?? "example"} multiplier`, 1, 1_000_000);
    const claimedKelvin = example.claimedKelvin === undefined ? undefined : boundedPositive(example.claimedKelvin, `${example.label ?? "example"} claimedKelvin`, 1e-12, 1e15);
    const temperatureKelvin = multiplier * baseTemperatureKelvin;
    return {
      ...example,
      multiplier,
      claimedKelvin,
      temperatureKelvin,
      claimedRelativeResidual: claimedKelvin === undefined ? null : relativeError(temperatureKelvin, claimedKelvin),
    };
  });
  const findings: EarthLiteralFinding[] = examples.flatMap((example) => example.claimedRelativeResidual === null ? [] : [{
    id: `temperature-${example.label ?? example.multiplier}`,
    status: example.claimedRelativeResidual <= 1e-8 ? "pass" as const : "failure" as const,
    category: "arithmetic" as const,
    message: "T0=DeltaE0/kB and Tc=m*T0 do not reproduce the rounded source example exactly",
    relativeResidual: example.claimedRelativeResidual,
  }]);
  return {
    method: "Direct molar-unit evaluation of T0=DeltaE0/kB followed by the printed integer multiplier",
    diagnostics: reproductionDiagnostics({
      examples: examples.length,
      failedSourceExamples: findings.filter(({ status }) => status === "failure").length,
      energyUnit: "kcal/mol",
      temperatureUnit: "K",
    }),
    output: {
      deltaEnergyKcalPerMol,
      boltzmannKcalPerMolKelvin,
      baseTemperatureKelvin,
      examples,
      findings,
      series: examples.map(({ multiplier, temperatureKelvin }) => ({ multiplier, temperatureKelvin })),
    },
  };
}

export const earthFnd001Audit = canonicalConstantAudit;
export const earthFnd014Audit = sourceSequenceAudit;
export const earthNuc001Audit = nuclearPairEnumerationAudit;
export const earthNuc004Audit = protonFormulaAudit;
export const earthPrt001Audit = electronBohrRydbergAudit;
export const earthChem002Audit = bondPotentialAudit;
export const earthChem007Audit = shellCapacityAudit;
export const earthSpec001Audit = standingWaveSpectrumAudit;
export const earthTherm001Audit = criticalTemperatureAudit;
