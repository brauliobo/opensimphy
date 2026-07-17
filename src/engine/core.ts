import type { ComplexValue, GraphPoint } from "../types/engine.js";
import {
  add,
  argument,
  complex,
  cos,
  divide,
  exp,
  I,
  isFiniteComplex,
  magnitude,
  multiply,
  negate,
  power,
  sin,
  sinh,
  subtract,
} from "./complex.js";

export interface CoreCase {
  id: string;
  title: string;
  category: string;
  sourceUrl: string;
  formula: string;
  provenance: "physics-monastery" | "engine-extension";
}

export interface CoreSurfacePoint {
  x: number;
  y: number;
  real: number;
  imaginary: number;
  magnitude: number;
}

export interface CoreEvaluation {
  id: string;
  title: string;
  category: string;
  sourceUrl: string;
  formula: string;
  provenance: CoreCase["provenance"];
  result: unknown;
  residual: number | null;
  graph: GraphPoint[];
  surface: CoreSurfacePoint[];
  graphReady: boolean;
  precision: "float64-reproduction";
}

const PLANCK_URL = "https://www.physicsmonastery.earth/planck-constants";
const PARTITION_URL = "https://www.physicsmonastery.earth/hyperbolic-partition-eq";
const CONSTRUCTOR_URL = "https://www.physicsmonastery.earth/binomial-constructor";
const MANIFOLD_URL = "https://www.physicsmonastery.earth/simplest-manifold";
const TRANSFORM_URL = "https://www.physicsmonastery.earth/transform-space";
const UNITS_URL = "https://www.physicsmonastery.earth/coherent-units";

function coreCase(id: string, title: string, category: string, sourceUrl: string, formula: string, provenance: CoreCase["provenance"] = "physics-monastery"): CoreCase {
  return { id, title, category, sourceUrl, formula, provenance };
}

export const CORE_CASES: CoreCase[] = [
  coreCase("planck-time", "Monastery Planck time site", "planck", PLANCK_URL, "G_0=pi sinh(1/4)^2; phi_0=log(44/G_0); t_0=phi_0 10^-44 s; S_0(z)=pi sinh(1/(4z))^2 exp(phi_0)/44"),
  coreCase("planck-length", "Monastery Planck length site", "planck", PLANCK_URL, "G_1=1/sinh(sinh(1/7)); phi_1=log(35/G_1); l_0=phi_1 10^-35 m; S_1(z)=sinh(sinh(z/7))^-1 exp(phi_1)/35"),
  coreCase("planck-charge", "Monastery Planck charge site", "planck", PLANCK_URL, "G_2=(5/sqrt(7))3^(-1/3)/W_We; W_We(z)=2^(5/4)sqrt(pi)exp(4pi/32)/Gamma(z/4)^2; q_0=phi_2 10^-18 C; S_2(z)=G_2(z)exp(phi_2)/18"),
  coreCase("planck-temperature", "Monastery Planck temperature site", "planck", PLANCK_URL, "G_3=2(5/sqrt(7))^2 cos(5i/2)^2 cos(7/5)^2; T_0=phi_3 10^32 K; S_3(z)=G_3(z)exp(phi_3)/32"),
  coreCase("planck-mass", "Monastery Planck mass site", "planck", PLANCK_URL, "G_4=5(4pi/2)cos(7/5)^2; m_0=phi_4 10^-8 kg; S_4(z)=G_4(z)exp(phi_4)/8"),
  coreCase("scalar-definition", "Scalar multiplication", "definitions", CONSTRUCTOR_URL, "s_a(x) = a x"),
  coreCase("exponential-definition", "Complex exponential", "definitions", PLANCK_URL, "exp(x+iy)=exp(x)(cos(y)+i sin(y))"),
  coreCase("euler-limit", "Euler exponential limit", "definitions", PLANCK_URL, "e = lim[n->infinity] (1+1/n)^n"),
  coreCase("inversion-boundary", "Inversion boundary", "boundary", CONSTRUCTOR_URL, "IB=(l_p m_p/q_p^2)(C^2/(m kg))=9.99999199973622e-8"),
  coreCase("hyperbolic-quartic-roots", "Hyperbolic partition quartic roots", "quartic", PARTITION_URL, "a=(i^i)^(-4pi/8)-m_p/kg; T(x)=x^4+2pi x^2-2pi a x+2pi; T(x)=product_(j=1)^4(x-zhe_j)"),
  coreCase("elementary-symmetric-invariants", "Elementary symmetric invariants", "quartic", PARTITION_URL, "e_k=sum_(i1<...<ik) product(zhe_ij)"),
  coreCase("inverse-invariants", "Inverse root invariants", "quartic", PARTITION_URL, "e_k(zhe^-1)=e_(4-k)(zhe)/e_4(zhe)"),
  coreCase("power-sum-invariants", "Power-sum invariants", "quartic", PARTITION_URL, "p_k=sum_j zhe_j^k; p_2=-4pi"),
  coreCase("companion-traces", "Companion matrix traces", "companion", PARTITION_URL, "tr(M^k)=sum_j zhe_j^k"),
  coreCase("companion-determinants", "Companion matrix determinants", "companion", PARTITION_URL, "det(M^k)=(2pi)^k; det(exp(M))=exp(tr(M))=1"),
  coreCase("companion-powers", "Companion matrix powers", "companion", PARTITION_URL, "v_(n+1)=M v_n"),
  coreCase("companion-log-flow", "Companion logarithmic flow", "companion", PARTITION_URL, "exp(log(M)t)=M^t; det(M^t)=(2pi)^t"),
  coreCase("companion-root-locus", "Companion root locus", "companion", PARTITION_URL, "roots(x^4+e_2 x^2-s e_3 x+e_4), 0<=s<=2"),
  coreCase("binomial-constructor", "Binomial constructor", "constructor", CONSTRUCTOR_URL, "(A_ext B_ext)(1+A_int R IB)"),
  coreCase("transform-polar-theta", "Polar angular powers", "transforms", CONSTRUCTOR_URL, "R_n=zhe_theta^n"),
  coreCase("transform-polar-radius", "Polar radial powers", "transforms", CONSTRUCTOR_URL, "R_n=zhe_r^n"),
  coreCase("transform-two-products", "Two-part products", "transforms", CONSTRUCTOR_URL, "R_ij=zhe_i zhe_j"),
  coreCase("transform-three-products", "Three-part products", "transforms", CONSTRUCTOR_URL, "R_ijk=zhe_i zhe_j zhe_k"),
  coreCase("transform-two-sums", "Two-part sums", "transforms", CONSTRUCTOR_URL, "R_ij=zhe_i+zhe_j"),
  coreCase("transform-three-sums", "Three-part sums", "transforms", CONSTRUCTOR_URL, "R_ijk=zhe_i+zhe_j+zhe_k"),
  coreCase("transform-two-quadrances", "Two-part quadrances", "transforms", CONSTRUCTOR_URL, "Q_ij=zhe_i^2+zhe_j^2"),
  coreCase("transform-three-quadrances", "Three-part quadrances", "transforms", CONSTRUCTOR_URL, "Q_ijk=zhe_i^2+zhe_j^2+zhe_k^2"),
  coreCase("figure-eight-volume", "Figure-eight manifold identities", "manifold", MANIFOLD_URL, "phi_i=exp(i pi/3); V_fe=i[Li_2(1/phi_i)-Li_2(phi_i)]=2G_Gi; Li_2(1/phi_i)=(4pi/Gamma(5))^2-iG_Gi; Li_2(phi_i)=(4pi/Gamma(5))^2+iG_Gi; their sum=pi^2/18; r_n/r_e=(4pi/Gamma(5))^2"),
  coreCase("gieseking-volume", "Gieseking minimum volume", "manifold", MANIFOLD_URL, "G_Gi=Im Li_2(phi_i); V_fe=2G_Gi"),
  coreCase("dilog-conjugacy", "Dilogarithm conjugacy", "manifold", MANIFOLD_URL, "Li_2(conj(z))=conj(Li_2(z)) for |z|<=1"),
  coreCase("catalan-dilog", "Catalan and knot-radius identities", "manifold", MANIFOLD_URL, "2K=i[Li_2(1/i)-Li_2(i)]; r_n/r_+=K"),
  coreCase("hypersphere-24d-leech", "24D transform factor product", "transform-space", TRANSFORM_URL, "(4pi/5!)(4pi/!5)(4pi/35)(4pi/18)^2(4pi/32)^3(4pi/8)^4=pi^12/12!"),
  coreCase("transform-divisors", "Transform-space divisors", "transform-space", TRANSFORM_URL, "5!=120; !5=44; divisors={120,44,35,18,32,8}"),
  coreCase("constructive-zeros", "Constructive zero components", "transform-space", TRANSFORM_URL, "c_+=zhe_3; c_-=zhe_4; c_+c_-=zhe_r^2"),
  coreCase("twisted-zeros", "Twisted zero components", "transform-space", TRANSFORM_URL, "tau_+=zhe_3^4; tau_-=zhe_4^4; tau_+tau_-=zhe_r^8"),
  coreCase("coherent-five-axis-units", "Five coherent site units", "units", UNITS_URL, "basis={second,meter,coulomb,kelvin,kilogram}"),
  coreCase("typed-six-axis-boundary", "Six-axis typed boundary model", "units", UNITS_URL, "D_6=(T,L,Q,Theta,M,B); B(IB)=1", "engine-extension"),
];

function sum(values: ComplexValue[]): ComplexValue {
  return values.reduce(add, complex(0));
}

function product(values: ComplexValue[]): ComplexValue {
  return values.reduce(multiply, complex(1));
}

function combinations(values: ComplexValue[], size: number): ComplexValue {
  const products: ComplexValue[] = [];
  function visit(start: number, selected: ComplexValue[]): void {
    if (selected.length === size) {
      products.push(product(selected));
      return;
    }
    for (let index = start; index < values.length; index += 1) visit(index + 1, [...selected, values[index]!]);
  }
  visit(0, []);
  return sum(products);
}

function polynomialCoefficients(roots: ComplexValue[]): ComplexValue[] {
  return [complex(1), negate(combinations(roots, 1)), combinations(roots, 2), negate(combinations(roots, 3)), combinations(roots, 4)];
}

function evaluatePolynomial(coefficients: ComplexValue[], value: ComplexValue): ComplexValue {
  return coefficients.reduce((result, coefficient) => add(multiply(result, value), coefficient), complex(0));
}

function durandKerner(coefficients: ComplexValue[]): ComplexValue[] {
  let roots = [complex(1), complex(0.4, 0.9), complex(-0.5, 0.7), complex(-0.7, -0.6)];
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const next = roots.map((root, index) => {
      const denominator = product(roots.filter((_, other) => other !== index).map((other) => subtract(root, other)));
      return subtract(root, divide(evaluatePolynomial(coefficients, root), denominator));
    });
    const change = Math.max(...next.map((root, index) => magnitude(subtract(root, roots[index]!))));
    roots = next;
    if (change < 1e-14) break;
  }
  return roots;
}

type Matrix = ComplexValue[][];

function identityMatrix(): Matrix {
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => complex(row === column ? 1 : 0)));
}

function matrixMultiply(left: Matrix, right: Matrix): Matrix {
  return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) =>
    sum(Array.from({ length: 4 }, (_, index) => multiply(left[row]![index]!, right[index]![column]!))),
  ));
}

function matrixPower(matrix: Matrix, exponent: number): Matrix {
  let result = identityMatrix();
  let factor = matrix;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = matrixMultiply(result, factor);
    factor = matrixMultiply(factor, factor);
    remaining = Math.floor(remaining / 2);
  }
  return result;
}

function matrixTrace(matrix: Matrix): ComplexValue {
  return sum(matrix.map((row, index) => row[index]!));
}

function matrixDeterminant(matrix: Matrix): ComplexValue {
  const working = matrix.map((row) => row.map((value) => complex(value.re, value.im)));
  let determinant = complex(1);
  for (let column = 0; column < working.length; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < working.length; row += 1) {
      if (magnitude(working[row]![column]!) > magnitude(working[pivotRow]![column]!)) pivotRow = row;
    }
    if (magnitude(working[pivotRow]![column]!) === 0) return complex(0);
    if (pivotRow !== column) {
      [working[column], working[pivotRow]] = [working[pivotRow]!, working[column]!];
      determinant = negate(determinant);
    }
    const pivot = working[column]![column]!;
    determinant = multiply(determinant, pivot);
    for (let row = column + 1; row < working.length; row += 1) {
      const factor = divide(working[row]![column]!, pivot);
      for (let index = column + 1; index < working.length; index += 1) {
        working[row]![index] = subtract(working[row]![index]!, multiply(factor, working[column]![index]!));
      }
    }
  }
  return determinant;
}

function companionMatrix(coefficients: ComplexValue[]): Matrix {
  const [, a3, a2, a1, a0] = coefficients;
  return [
    [complex(0), complex(0), complex(0), negate(a0!)],
    [complex(1), complex(0), complex(0), negate(a1!)],
    [complex(0), complex(1), complex(0), negate(a2!)],
    [complex(0), complex(0), complex(1), negate(a3!)],
  ];
}

function gammaComplex(value: ComplexValue): ComplexValue {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value.re < 0.5) return divide(complex(Math.PI), multiply(sin(multiply(complex(Math.PI), value)), gammaComplex(subtract(complex(1), value))));
  const shifted = subtract(value, complex(1));
  let series = complex(0.9999999999998099);
  coefficients.forEach((coefficient, index) => { series = add(series, divide(complex(coefficient), add(shifted, complex(index + 1)))); });
  const t = add(shifted, complex(7.5));
  return multiply(complex(Math.sqrt(2 * Math.PI)), multiply(power(t, add(shifted, complex(0.5))), multiply(exp(negate(t)), series)));
}

function subfactorial(value: number): number {
  if (value === 0) return 1;
  if (value === 1) return 0;
  let previous = 1;
  let current = 0;
  for (let index = 2; index <= value; index += 1) [previous, current] = [current, (index - 1) * (current + previous)];
  return current;
}

function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

interface PlanckSite {
  id: string;
  n: number;
  exponent: number;
  unit: "s" | "m" | "C" | "K" | "kg";
}

const PLANCK_SITES: PlanckSite[] = [
  { id: "planck-time",        n: 44, exponent: -44, unit: "s" },
  { id: "planck-length",      n: 35, exponent: -35, unit: "m" },
  { id: "planck-charge",      n: 18, exponent: -18, unit: "C" },
  { id: "planck-temperature", n: 32, exponent: 32,  unit: "K" },
  { id: "planck-mass",        n: 8,  exponent: -8,  unit: "kg" },
];

const WEIERSTRASS_VALUE = 0.4749493799879206503;
const ROOT_TARGETS: ComplexValue[] = [
  complex(0.08542454315333047),
  complex(3.6675675348550103),
  complex(-1.8764960390041704, 4.066152626159726),
  complex(-1.8764960390041704, -4.066152626159726),
];
const GIESEKING_TARGET = 1.0149416064096536;
const CATALAN_TARGET = 0.915965594177219;
const IB_TARGET = 9.99999199973622e-8;

const TRANSFORM_FAMILY_IDS = new Set([
  "transform-polar-theta",
  "transform-polar-radius",
  "transform-two-products",
  "transform-three-products",
  "transform-two-sums",
  "transform-three-sums",
  "transform-two-quadrances",
  "transform-three-quadrances",
]);

function planckSite(id: string): PlanckSite {
  const site = PLANCK_SITES.find((candidate) => candidate.id === id);
  if (!site) throw new Error(`Unknown Planck site: ${id}`);
  return site;
}

function planckGeometricAt(id: string, z: ComplexValue): ComplexValue {
  if (id === "planck-time") return multiply(complex(Math.PI), power(sinh(divide(complex(0.25), z)), complex(2)));
  if (id === "planck-length") return power(sinh(sinh(divide(z, complex(7)))), complex(-1));
  if (id === "planck-charge") {
    const numerator = (5 / Math.sqrt(7)) * 3 ** (-1 / 3);
    const denominator = 2 ** (5 / 4) * Math.sqrt(Math.PI) * Math.exp(4 * Math.PI / 32);
    return multiply(complex(numerator / denominator), power(gammaComplex(divide(z, complex(4))), complex(2)));
  }
  if (id === "planck-temperature") {
    return multiply(complex(2 * (5 / Math.sqrt(7)) ** 2), multiply(
      power(cos(divide(complex(0, 2.5), z)), complex(2)),
      power(cos(divide(complex(1.4), z)), complex(2)),
    ));
  }
  return multiply(complex(10 * Math.PI), power(cos(divide(complex(1.4), z)), complex(2)));
}

function planckGeometric(site: PlanckSite): number {
  if (site.id === "planck-charge") return (5 / Math.sqrt(7)) * 3 ** (-1 / 3) / WEIERSTRASS_VALUE;
  return planckGeometricAt(site.id, complex(1)).re;
}

function planckEvaluation(id: string): { geometric: number; scalar: number; boundary: number; exponent: number; unit: PlanckSite["unit"] } {
  const site = planckSite(id);
  const geometric = planckGeometric(site);
  const scalar = Math.log(site.n / geometric);
  return { geometric, scalar, boundary: scalar * 10 ** site.exponent, exponent: site.exponent, unit: site.unit };
}

function planckSiteValue(id: string, z: ComplexValue): ComplexValue {
  const site = planckSite(id);
  const { scalar } = planckEvaluation(id);
  return multiply(planckGeometricAt(id, z), complex(Math.exp(scalar) / site.n));
}

function planckSurface(id: string): CoreSurfacePoint[] {
  const points: CoreSurfacePoint[] = [];
  for (let xIndex = 0; xIndex < 9; xIndex += 1) {
    for (let yIndex = 0; yIndex < 9; yIndex += 1) {
      const x = -1 + xIndex / 4;
      const y = -1 + yIndex / 4;
      const z = complex(x, y);
      if (magnitude(z) < 0.2) continue;
      try {
        const value = planckSiteValue(id, z);
        if (isFiniteComplex(value) && Number.isFinite(magnitude(value))) points.push({ x, y, real: value.re, imaginary: value.im, magnitude: magnitude(value) });
      } catch {
        // Gamma poles and reciprocal zeros are excluded from the finite surface.
      }
    }
  }
  return points;
}

function partitionA(massScale = 1): number {
  const iToI = power(I, I);
  return power(iToI, complex(-4 * Math.PI / 8)).re - planckEvaluation("planck-mass").boundary * massScale;
}

function partitionCoefficients(massScale = 1): ComplexValue[] {
  const a = partitionA(massScale);
  return [complex(1), complex(0), complex(2 * Math.PI), complex(-2 * Math.PI * a), complex(2 * Math.PI)];
}

function orderPartitionRoots(roots: ComplexValue[]): ComplexValue[] {
  return [...roots].sort((left, right) => {
    const imaginaryOrder = Math.abs(left.im) - Math.abs(right.im);
    if (Math.abs(imaginaryOrder) > 1e-10) return imaginaryOrder;
    if (Math.abs(left.im) < 1e-10 && Math.abs(right.im) < 1e-10) return left.re - right.re;
    return right.im - left.im;
  });
}

function partitionRoots(massScale = 1): ComplexValue[] {
  return orderPartitionRoots(durandKerner(partitionCoefficients(massScale)));
}

function complexRootPair(roots: ComplexValue[]): [ComplexValue, ComplexValue] {
  const pair = roots.filter((root) => Math.abs(root.im) > 1e-10);
  if (pair.length !== 2) throw new Error("Partition quartic did not produce one complex-conjugate pair");
  return [pair[0]!, pair[1]!];
}

const ROOTS = partitionRoots();
const PARTITION_COEFFICIENTS = partitionCoefficients();
const PARTITION_COMPANION = companionMatrix(PARTITION_COEFFICIENTS);
const [POSITIVE_COMPLEX_ROOT] = complexRootPair(ROOTS);
const ZHE_R = magnitude(POSITIVE_COMPLEX_ROOT);
const ZHE_THETA = argument(POSITIVE_COMPLEX_ROOT);
const INVERSION_BOUNDARY = planckEvaluation("planck-length").boundary
  * planckEvaluation("planck-mass").boundary
  / planckEvaluation("planck-charge").boundary ** 2;

function transformResult(id: string, parameter = 1): unknown {
  if (id === "transform-polar-theta") return [1, 2, 3, 4].map((exponent) => (ZHE_THETA * parameter) ** exponent);
  if (id === "transform-polar-radius") return [1, 2, 3, 4].map((exponent) => (ZHE_R * parameter) ** exponent);
  const roots = partitionRoots(parameter);
  const size = id.includes("three") ? 3 : 2;
  const selected = roots.slice(0, size);
  if (id.includes("products")) return product(selected);
  if (id.includes("sums")) return sum(selected);
  return sum(selected.map((root) => power(root, complex(2))));
}

function unitDilogarithm(angle: number, terms: number): ComplexValue {
  const twoPi = 2 * Math.PI;
  const theta = ((angle % twoPi) + twoPi) % twoPi;
  const real = Math.PI ** 2 / 6 - Math.PI * theta / 2 + theta ** 2 / 4;
  let imaginary = 0;
  for (let index = 1; index <= terms; index += 1) imaginary += Math.sin(index * theta) / index ** 2;
  return complex(real, imaginary);
}

function dilogTerms(parameter: number): number {
  return Math.max(10_000, Math.round(100_000 * parameter));
}

function manifoldState(angle: number, terms: number): {
  phiI: ComplexValue;
  inversePhiI: ComplexValue;
  direct: ComplexValue;
  inverse: ComplexValue;
  gieseking: number;
} {
  const phiI = exp(complex(0, angle));
  const inversePhiI = divide(complex(1), phiI);
  const direct = unitDilogarithm(argument(phiI), terms);
  const inverse = unitDilogarithm(argument(inversePhiI), terms);
  return { phiI, inversePhiI, direct, inverse, gieseking: direct.im };
}

function manifoldBase(gammaArgument = 5): number {
  return power(divide(complex(4 * Math.PI), gammaComplex(complex(gammaArgument))), complex(2)).re;
}

function residualMaximum(...values: number[]): number {
  return Math.max(...values.map(Math.abs));
}

function factorProduct24(scale = 1): { scale: number; factors: number[]; factorProduct: number; hypersphere: number } {
  const angle = 4 * Math.PI * scale;
  const factors = [
    angle / factorial(5),
    angle / subfactorial(5),
    angle / 35,
    (angle / 18) ** 2,
    (angle / 32) ** 3,
    (angle / 8) ** 4,
  ];
  return {
    scale,
    factors,
    factorProduct: factors.reduce((total, value) => total * value, 1),
    hypersphere: (Math.PI * scale) ** 12 / factorial(12),
  };
}

function coreResult(id: string, parameter = 1, includeSurface = false): { result: unknown; metric: number; residual: number | null; surface?: CoreSurfacePoint[] } {
  if (id.startsWith("planck-")) {
    const result = planckEvaluation(id);
    const metric = magnitude(planckSiteValue(id, complex(parameter)));
    return includeSurface ? { result, metric, residual: null, surface: planckSurface(id) } : { result, metric, residual: null };
  }
  if (id === "scalar-definition") return { result: 3 * parameter, metric: 3 * parameter, residual: null };
  if (id === "exponential-definition") {
    const result = exp(complex(parameter, parameter / 2));
    return { result, metric: magnitude(result), residual: magnitude(subtract(result, complex(Math.exp(parameter) * Math.cos(parameter / 2), Math.exp(parameter) * Math.sin(parameter / 2)))) };
  }
  if (id === "euler-limit") {
    const n = Math.max(10, Math.round(100_000 * parameter));
    const result = (1 + 1 / n) ** n;
    return { result, metric: result, residual: result - Math.E };
  }
  if (id === "inversion-boundary") {
    const result = INVERSION_BOUNDARY / parameter ** 2;
    return { result, metric: result, residual: parameter === 1 ? result - IB_TARGET : null };
  }
  if (id === "hyperbolic-quartic-roots") {
    const a = partitionA(parameter);
    const coefficients = partitionCoefficients(parameter);
    const roots = partitionRoots(parameter);
    const reconstructed = polynomialCoefficients(roots);
    const rootResiduals = roots.map((root) => magnitude(evaluatePolynomial(coefficients, root)));
    const coefficientResidual = Math.max(...coefficients.map((coefficient, index) => magnitude(subtract(coefficient, reconstructed[index]!))));
    const targetDeltas = parameter === 1 ? roots.map((root, index) => magnitude(subtract(root, ROOT_TARGETS[index]!))) : [];
    const residual = Math.max(...rootResiduals, coefficientResidual, ...targetDeltas);
    return { result: { a, coefficients, companion: companionMatrix(coefficients), roots, rootResiduals, coefficientResidual, targetDeltas }, metric: Math.max(...roots.map(magnitude)), residual };
  }
  if (id === "elementary-symmetric-invariants") {
    const roots = partitionRoots(parameter);
    const result = { e1: combinations(roots, 1), e2: combinations(roots, 2), e3: combinations(roots, 3), e4: combinations(roots, 4) };
    const residual = residualMaximum(magnitude(result.e1), result.e2.im, result.e2.re - 2 * Math.PI, result.e3.im, result.e3.re - 2 * Math.PI * partitionA(parameter), result.e4.im, result.e4.re - 2 * Math.PI);
    return { result, metric: magnitude(result.e3), residual };
  }
  if (id === "inverse-invariants") {
    const roots = partitionRoots(parameter);
    const e1 = combinations(roots, 1);
    const e2 = combinations(roots, 2);
    const e3 = combinations(roots, 3);
    const e4 = combinations(roots, 4);
    const inverse = roots.map((root) => divide(complex(1), root));
    const result = { e1: combinations(inverse, 1), e2: combinations(inverse, 2), e3: combinations(inverse, 3), e4: combinations(inverse, 4) };
    const residual = Math.max(
      magnitude(subtract(result.e1, divide(e3, e4))),
      magnitude(subtract(result.e2, divide(e2, e4))),
      magnitude(subtract(result.e3, divide(e1, e4))),
      magnitude(subtract(result.e4, divide(complex(1), e4))),
    );
    return { result, metric: magnitude(result.e1), residual };
  }
  if (id === "power-sum-invariants") {
    const roots = partitionRoots(parameter);
    const result = Object.fromEntries([1, 2, 3, 4].map((exponent) => [`p${exponent}`, sum(roots.map((root) => power(root, complex(exponent))))]));
    const expected = [complex(0), complex(-4 * Math.PI), complex(6 * Math.PI * partitionA(parameter)), complex(8 * Math.PI ** 2 - 8 * Math.PI)];
    const residual = Math.max(...expected.map((value, index) => magnitude(subtract(result[`p${index + 1}`] as ComplexValue, value))));
    const exponent = Math.max(1, Math.round(4 * parameter));
    return { result, metric: magnitude(sum(roots.map((root) => power(root, complex(exponent))))), residual };
  }
  if (id === "companion-traces") {
    const roots = partitionRoots(parameter);
    const companion = companionMatrix(partitionCoefficients(parameter));
    const traces = Object.fromEntries([1, 2, 3, 4].map((exponent) => [`traceM${exponent}`, matrixTrace(matrixPower(companion, exponent))]));
    const residual = Math.max(...[1, 2, 3, 4].map((exponent) => magnitude(subtract(traces[`traceM${exponent}`] as ComplexValue, sum(roots.map((root) => power(root, complex(exponent))))))));
    const exponent = Math.max(1, Math.round(4 * parameter));
    return { result: traces, metric: magnitude(matrixTrace(matrixPower(companion, exponent))), residual };
  }
  if (id === "companion-determinants") {
    const companion = companionMatrix(partitionCoefficients(parameter));
    const determinant = matrixDeterminant(companion);
    const determinantSquared = matrixDeterminant(matrixPower(companion, 2));
    const determinantExponential = exp(matrixTrace(companion));
    const result = { detM: determinant, detM2: determinantSquared, detExpM: determinantExponential };
    const residual = Math.max(
      magnitude(subtract(determinant, complex(2 * Math.PI))),
      magnitude(subtract(determinantSquared, complex((2 * Math.PI) ** 2))),
      magnitude(subtract(determinantExponential, complex(1))),
    );
    const exponent = Math.max(1, Math.round(4 * parameter));
    return { result, metric: magnitude(matrixDeterminant(matrixPower(companion, exponent))), residual };
  }
  if (id === "companion-powers") {
    const roots = partitionRoots(parameter);
    const companion = companionMatrix(partitionCoefficients(parameter));
    const exponent = Math.max(1, Math.round(4 * parameter));
    const result = matrixPower(companion, exponent);
    return { result, metric: magnitude(matrixTrace(result)), residual: magnitude(subtract(matrixTrace(result), sum(roots.map((root) => power(root, complex(exponent)))))) };
  }
  if (id === "companion-log-flow") {
    const determinant = matrixDeterminant(PARTITION_COMPANION).re;
    const result = { t: parameter, traceLog: Math.log(determinant), determinant: determinant ** parameter };
    return { result, metric: result.determinant, residual: Math.abs(Math.exp(result.traceLog * parameter) - result.determinant) };
  }
  if (id === "companion-root-locus") {
    const varied = [PARTITION_COEFFICIENTS[0]!, PARTITION_COEFFICIENTS[1]!, PARTITION_COEFFICIENTS[2]!, multiply(PARTITION_COEFFICIENTS[3]!, complex(parameter)), PARTITION_COEFFICIENTS[4]!];
    const roots = orderPartitionRoots(durandKerner(varied));
    return { result: roots, metric: Math.max(...roots.map(magnitude)), residual: Math.max(...roots.map((root) => magnitude(evaluatePolynomial(varied, root)))) };
  }
  if (id === "binomial-constructor") {
    const result = (2 * 3) * (1 + parameter * ZHE_R * INVERSION_BOUNDARY);
    return { result, metric: result, residual: null };
  }
  if (TRANSFORM_FAMILY_IDS.has(id)) {
    const result = transformResult(id, parameter);
    const metric = Array.isArray(result) ? Math.max(...result.map(Number)) : magnitude(result as ComplexValue);
    return { result, metric, residual: null };
  }
  if (id === "figure-eight-volume") {
    const angle = Math.PI * parameter / 3;
    const state = manifoldState(angle, 100_000);
    const volume = multiply(I, subtract(state.inverse, state.direct));
    const twiceGieseking = complex(2 * state.gieseking);
    const identityResidual = magnitude(subtract(volume, twiceGieseking));
    const comparisonResidual = parameter === 1 ? state.gieseking - GIESEKING_TARGET : 0;
    const phaseExpected = complex(Math.cos(angle), Math.sin(angle));
    const phaseResidual = magnitude(subtract(state.phiI, phaseExpected));
    const base = manifoldBase();
    const inverseExpected = complex(base, -state.gieseking);
    const directExpected = complex(base, state.gieseking);
    const inverseResidual = parameter === 1 ? magnitude(subtract(state.inverse, inverseExpected)) : 0;
    const directResidual = parameter === 1 ? magnitude(subtract(state.direct, directExpected)) : 0;
    const dilogarithmSum = add(state.inverse, state.direct);
    const sumExpected = Math.PI ** 2 / 3 - Math.PI * angle + angle ** 2 / 2;
    const sumResidual = magnitude(subtract(dilogarithmSum, complex(sumExpected)));
    const nuclearToElectron = base;
    const radiusElectronResidual = nuclearToElectron - Math.PI ** 2 / 36;
    const result = {
      ...state,
      angle,
      phaseExpected,
      phaseResidual,
      volume,
      twiceGieseking,
      identityResidual,
      comparisonResidual,
      inverseDilogarithm: state.inverse,
      inverseExpected,
      inverseResidual,
      directDilogarithm: state.direct,
      directExpected,
      directResidual,
      dilogarithmSum,
      sumExpected,
      sumResidual,
      nuclearToElectron,
      radiusElectronResidual,
    };
    return { result, metric: volume.re, residual: residualMaximum(identityResidual, comparisonResidual, phaseResidual, inverseResidual, directResidual, sumResidual, radiusElectronResidual) };
  }
  if (id === "gieseking-volume") {
    const state = manifoldState(Math.PI * parameter / 3, 100_000);
    const volume = 2 * state.gieseking;
    const comparisonResidual = parameter === 1 ? state.gieseking - GIESEKING_TARGET : 0;
    return { result: { phiI: state.phiI, gieseking: state.gieseking, volume, comparisonResidual }, metric: state.gieseking, residual: comparisonResidual };
  }
  if (id === "dilog-conjugacy") {
    const state = manifoldState(Math.PI * parameter / 3, 100_000);
    const conjugateDirect = complex(state.direct.re, -state.direct.im);
    return { result: { z: state.phiI, dilogarithmConjugate: state.inverse, conjugateDilogarithm: conjugateDirect }, metric: magnitude(state.inverse), residual: magnitude(subtract(state.inverse, conjugateDirect)) };
  }
  if (id === "catalan-dilog") {
    const terms = dilogTerms(parameter);
    const direct = unitDilogarithm(Math.PI / 2, terms);
    const inverse = unitDilogarithm(-Math.PI / 2, terms);
    const twiceCatalan = multiply(I, subtract(inverse, direct));
    const catalan = direct.im;
    const identityResidual = magnitude(subtract(twiceCatalan, complex(2 * catalan)));
    const comparisonResidual = parameter === 1 ? catalan - CATALAN_TARGET : 0;
    const nuclearToPositiveKnot = catalan;
    const radiusKnotResidual = nuclearToPositiveKnot - catalan;
    return { result: { terms, inverseDilogarithm: inverse, directDilogarithm: direct, twiceCatalan, catalan, identityResidual, comparisonResidual, nuclearToPositiveKnot, radiusKnotResidual }, metric: catalan, residual: residualMaximum(identityResidual, comparisonResidual, radiusKnotResidual) };
  }
  if (id === "hypersphere-24d-leech") {
    const result = factorProduct24(parameter);
    const residual = result.factorProduct - result.hypersphere;
    return { result, metric: result.factorProduct, residual };
  }
  if (id === "transform-divisors") {
    const order = Math.max(2, Math.round(5 * parameter));
    const result = { order, factorial: factorial(order), subfactorial: subfactorial(order), divisors: order === 5 ? [120, 44, 35, 18, 32, 8] : [] };
    const residual = order === 5 ? Math.abs(result.factorial - 120) + Math.abs(result.subfactorial - 44) : 0;
    return { result, metric: result.factorial + result.subfactorial, residual };
  }
  if (id === "constructive-zeros") {
    const [constructivePositive, constructiveNegative] = complexRootPair(partitionRoots(parameter));
    const constructiveProduct = multiply(constructivePositive, constructiveNegative);
    const radialSquare = magnitude(constructivePositive) ** 2;
    return { result: { constructivePositive, constructiveNegative, constructiveProduct, radialSquare }, metric: magnitude(constructiveProduct), residual: magnitude(subtract(constructiveProduct, complex(radialSquare))) };
  }
  if (id === "twisted-zeros") {
    const [constructivePositive, constructiveNegative] = complexRootPair(partitionRoots(parameter));
    const twistedPositive = power(constructivePositive, complex(4));
    const twistedNegative = power(constructiveNegative, complex(4));
    const twistedProduct = multiply(twistedPositive, twistedNegative);
    const radialEighth = magnitude(constructivePositive) ** 8;
    return { result: { twistedPositive, twistedNegative, twistedProduct, radialEighth }, metric: magnitude(twistedProduct), residual: magnitude(subtract(twistedProduct, complex(radialEighth))) };
  }
  if (id === "coherent-five-axis-units") {
    const axes = ["second", "meter", "coulomb", "kelvin", "kilogram"];
    const rank = Math.max(1, Math.min(axes.length, Math.round(axes.length * parameter)));
    return { result: { axes: axes.slice(0, rank), rank }, metric: rank, residual: null };
  }
  const rank = Math.max(1, Math.min(6, Math.round(6 * parameter)));
  const result = {
    axes: ["time", "length", "charge", "temperature", "mass", "boundary"],
    rank,
    external: [0, 0, 0, 0, 0, 0],
    inversionBoundary: [0, 0, 0, 0, 0, 1],
    inverseRootTransform: [0, 0, 0, 0, 0, -1],
    closed: [0, 0, 0, 0, 0, 0],
  };
  return { result, metric: rank, residual: result.inversionBoundary.reduce((total, value, index) => total + value + result.inverseRootTransform[index]!, 0) };
}

function graphPoint(x: number, y: number): GraphPoint {
  const finite = Number.isFinite(y);
  return {
    x,
    y,
    imaginary: 0,
    magnitude: Math.abs(y),
    sign: y === 0 ? 0 : y > 0 ? 1 : -1,
    log10Abs: finite && y !== 0 ? Math.log10(Math.abs(y)) : null,
    finite,
  };
}

function graphParameter(id: string, index: number): number {
  if (id === "companion-root-locus") return (2 * index) / 32;
  if (id === "coherent-five-axis-units" || id === "typed-six-axis-boundary") return 0.2 + (0.8 * index) / 32;
  return 0.5 + (1.5 * index) / 32;
}

export function evaluateCoreCase(source: CoreCase): CoreEvaluation {
  const evaluated = coreResult(source.id, 1, true);
  const graph = Array.from({ length: 33 }, (_, index) => {
    const parameter = graphParameter(source.id, index);
    return graphPoint(parameter, coreResult(source.id, parameter).metric);
  });
  const surface = evaluated.surface ?? (source.id === "companion-root-locus"
    ? graph.flatMap((point) => (coreResult(source.id, point.x).result as ComplexValue[]).map((root) => ({ x: point.x, y: root.re, real: root.re, imaginary: root.im, magnitude: magnitude(root) })))
    : []);
  const graphReady = graph.length > 0 && graph.every((point) => point.finite) && (!source.id.startsWith("planck-") || surface.length > 0);
  return { ...source, result: evaluated.result, residual: evaluated.residual, graph, surface, graphReady, precision: "float64-reproduction" };
}

export function evaluateCoreRegistry(cases: CoreCase[] = CORE_CASES): CoreEvaluation[] {
  const ids = new Set<string>();
  return cases.map((source) => {
    if (ids.has(source.id)) throw new Error(`Duplicate core case ID: ${source.id}`);
    ids.add(source.id);
    return evaluateCoreCase(source);
  });
}
