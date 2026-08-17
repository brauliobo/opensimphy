import {
  boundedInteger,
  checkCancelled,
  finiteNumber,
  gaussian,
  nonNegativeNumber,
  positiveNumber,
  seededRandom,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";

export interface StochasticDiffusionInputs {
  gridPoints?: number;
  length?: number;
  timeStep?: number;
  steps?: number;
  diffusion?: number;
  damping?: number;
  noise?: number;
  ensembles?: number;
}

function tridiagonalSolve(rhs: Float64Array, diagonal: number, endpointFirst: number, endpointLast: number, offDiagonal: number): Float64Array {
  const count = rhs.length;
  const upper = new Float64Array(count);
  const solution = new Float64Array(count);
  upper[0] = offDiagonal / endpointFirst;
  solution[0] = rhs[0]! / endpointFirst;
  for (let index = 1; index < count; index += 1) {
    const currentDiagonal = index === count - 1 ? endpointLast : diagonal;
    const denominator = currentDiagonal - offDiagonal * upper[index - 1]!;
    upper[index] = index === count - 1 ? 0 : offDiagonal / denominator;
    solution[index] = (rhs[index]! - offDiagonal * solution[index - 1]!) / denominator;
  }
  for (let index = count - 2; index >= 0; index -= 1) {
    solution[index] = solution[index]! - upper[index]! * solution[index + 1]!;
  }
  return solution;
}

function cyclicImplicitSolve(rhs: Float64Array, diagonal: number, offDiagonal: number): Float64Array {
  const count = rhs.length;
  const alpha = offDiagonal;
  const beta = offDiagonal;
  const gamma = -diagonal;
  const endpointFirst = diagonal - gamma;
  const endpointLast = diagonal - alpha * beta / gamma;
  const solution = tridiagonalSolve(rhs, diagonal, endpointFirst, endpointLast, offDiagonal);
  const correctionRhs = new Float64Array(count);
  correctionRhs[0] = gamma;
  correctionRhs[count - 1] = alpha;
  const correction = tridiagonalSolve(correctionRhs, diagonal, endpointFirst, endpointLast, offDiagonal);
  const factor = (solution[0]! + beta * solution[count - 1]! / gamma)
    / (1 + correction[0]! + beta * correction[count - 1]! / gamma);
  for (let index = 0; index < count; index += 1) solution[index] = solution[index]! - factor * correction[index]!;
  return solution;
}

export function stochasticDiffusion(
  inputs: StochasticDiffusionInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<{
  gridPoints: number;
  length: number;
  elapsedTime: number;
  sampleField: number[];
  correlation: number[];
  observedMean: number;
  observedVariance: number;
  expectedVariance: number;
  varianceRelativeResidual: number;
}> {
  const gridPoints = boundedInteger(inputs.gridPoints ?? 64, "gridPoints", 8, 256);
  const length = positiveNumber(inputs.length ?? 1, "length");
  const timeStep = positiveNumber(inputs.timeStep ?? 0.002, "timeStep");
  const steps = boundedInteger(inputs.steps ?? 250, "steps", 1, 5000);
  const diffusion = nonNegativeNumber(inputs.diffusion ?? 0.05, "diffusion");
  const damping = nonNegativeNumber(inputs.damping ?? 1, "damping");
  const noise = nonNegativeNumber(inputs.noise ?? 0.4, "noise");
  const ensembles = boundedInteger(inputs.ensembles ?? 32, "ensembles", 1, 128);
  if (timeStep * steps > 100) throw new RangeError("timeStep*steps must not exceed 100");
  checkCancelled(options);
  const spacing = length / gridPoints;
  const diffusionRatio = diffusion * timeStep / spacing ** 2;
  const diagonal = 1 + damping * timeStep + 2 * diffusionRatio;
  const offDiagonal = -diffusionRatio;
  const noiseScale = noise * Math.sqrt(timeStep / spacing);
  const random = seededRandom(options.seed ?? 0x5eed005);
  const fields: Float64Array[] = [];
  for (let ensemble = 0; ensemble < ensembles; ensemble += 1) {
    let field = new Float64Array(gridPoints);
    for (let step = 0; step < steps; step += 1) {
      if ((step & 31) === 0) checkCancelled(options);
      const rhs = new Float64Array(gridPoints);
      for (let index = 0; index < gridPoints; index += 1) rhs[index] = field[index]! + noiseScale * gaussian(random);
      field = cyclicImplicitSolve(rhs, diagonal, offDiagonal);
    }
    fields.push(field);
  }
  let sum = 0;
  let sumSquares = 0;
  for (const field of fields) {
    for (const value of field) {
      sum += value;
      sumSquares += value * value;
    }
  }
  const sampleCount = ensembles * gridPoints;
  const observedMean = sum / sampleCount;
  const observedVariance = Math.max(0, sumSquares / sampleCount - observedMean ** 2);
  let expectedVariance = 0;
  for (let mode = 0; mode < gridPoints; mode += 1) {
    const decay = damping + 4 * diffusion * Math.sin(Math.PI * mode / gridPoints) ** 2 / spacing ** 2;
    const gain = 1 / (1 + timeStep * decay);
    const denominator = 1 - gain ** 2;
    expectedVariance += denominator === 0
      ? noiseScale ** 2 * steps
      : noiseScale ** 2 * gain ** 2 * (1 - gain ** (2 * steps)) / denominator;
  }
  expectedVariance /= gridPoints;
  const maximumLag = Math.min(16, Math.floor(gridPoints / 2));
  const correlation = Array.from({ length: maximumLag + 1 }, (_, lag) => {
    if (observedVariance === 0) return lag === 0 ? 1 : 0;
    let covariance = 0;
    for (const field of fields) {
      for (let index = 0; index < gridPoints; index += 1) {
        covariance += (field[index]! - observedMean) * (field[(index + lag) % gridPoints]! - observedMean);
      }
    }
    return covariance / sampleCount / observedVariance;
  });
  return {
    method: "Backward-Euler periodic finite-difference diffusion with cyclic tridiagonal solve and normalized white noise",
    diagnostics: {
      boundaryCondition: "periodic",
      scheme: "implicit-backward-euler",
      unconditionallyStable: true,
      diffusionRatio,
      finite: fields.every((field) => field.every(Number.isFinite)),
      seed: options.seed ?? 0x5eed005,
    },
    output: {
      gridPoints,
      length,
      elapsedTime: timeStep * steps,
      sampleField: [...fields[0]!],
      correlation,
      observedMean,
      observedVariance,
      expectedVariance,
      varianceRelativeResidual: expectedVariance === 0 ? Math.abs(observedVariance) : Math.abs(observedVariance - expectedVariance) / expectedVariance,
    },
  };
}

interface ComplexNumber {
  re: number;
  im: number;
}

type ComplexMatrix2 = [[ComplexNumber, ComplexNumber], [ComplexNumber, ComplexNumber]];

function complexMultiply(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return { re: left.re * right.re - left.im * right.im, im: left.re * right.im + left.im * right.re };
}

function complexAdd(left: ComplexNumber, right: ComplexNumber): ComplexNumber {
  return { re: left.re + right.re, im: left.im + right.im };
}

function matrixMultiply(left: ComplexMatrix2, right: ComplexMatrix2): ComplexMatrix2 {
  return [
    [
      complexAdd(complexMultiply(left[0][0], right[0][0]), complexMultiply(left[0][1], right[1][0])),
      complexAdd(complexMultiply(left[0][0], right[0][1]), complexMultiply(left[0][1], right[1][1])),
    ],
    [
      complexAdd(complexMultiply(left[1][0], right[0][0]), complexMultiply(left[1][1], right[1][0])),
      complexAdd(complexMultiply(left[1][0], right[0][1]), complexMultiply(left[1][1], right[1][1])),
    ],
  ];
}

function floquetOperator(bias: number, drive: number, frequency: number, steps: number, options: EarthRunOptions): ComplexMatrix2 {
  const period = 2 * Math.PI / frequency;
  const timeStep = period / steps;
  let operator: ComplexMatrix2 = [[{ re: 1, im: 0 }, { re: 0, im: 0 }], [{ re: 0, im: 0 }, { re: 1, im: 0 }]];
  for (let step = 0; step < steps; step += 1) {
    if ((step & 255) === 0) checkCancelled(options);
    const time = (step + 0.5) * timeStep;
    const x = 0.5 * drive * Math.cos(frequency * time);
    const z = 0.5 * bias;
    const norm = Math.hypot(x, z);
    const cosine = Math.cos(norm * timeStep);
    const sineOverNorm = norm === 0 ? timeStep : Math.sin(norm * timeStep) / norm;
    const increment: ComplexMatrix2 = [
      [{ re: cosine, im: -sineOverNorm * z }, { re: 0, im: -sineOverNorm * x }],
      [{ re: 0, im: -sineOverNorm * x }, { re: cosine, im: sineOverNorm * z }],
    ];
    operator = matrixMultiply(increment, operator);
  }
  return operator;
}

function magnitudeSquared(value: ComplexNumber): number {
  return value.re ** 2 + value.im ** 2;
}

function floquetSummary(operator: ComplexMatrix2, period: number): { positiveQuasienergy: number; quasienergies: [number, number]; transitionProbability: number; unitarityResidual: number } {
  const halfTrace = Math.max(-1, Math.min(1, (operator[0][0].re + operator[1][1].re) / 2));
  const positiveQuasienergy = Math.acos(halfTrace) / period;
  const firstColumnNorm = magnitudeSquared(operator[0][0]) + magnitudeSquared(operator[1][0]);
  const secondColumnNorm = magnitudeSquared(operator[0][1]) + magnitudeSquared(operator[1][1]);
  const overlap = complexAdd(
    complexMultiply({ re: operator[0][0].re, im: -operator[0][0].im }, operator[0][1]),
    complexMultiply({ re: operator[1][0].re, im: -operator[1][0].im }, operator[1][1]),
  );
  return {
    positiveQuasienergy,
    quasienergies: [-positiveQuasienergy, positiveQuasienergy],
    transitionProbability: magnitudeSquared(operator[1][0]),
    unitarityResidual: Math.max(Math.abs(firstColumnNorm - 1), Math.abs(secondColumnNorm - 1), Math.hypot(overlap.re, overlap.im)),
  };
}

export interface FloquetInputs {
  bias?: number;
  drive?: number;
  frequency?: number;
  stepsPerPeriod?: number;
}

export function floquetBenchmark(
  inputs: FloquetInputs = {},
  options: EarthRunOptions = {},
): EarthKernelResult<{
  model: string;
  period: number;
  operator: ComplexMatrix2;
  quasienergies: [number, number];
  transitionProbability: number;
  unitarityResidual: number;
  refinementResidual: number;
  undrivenQuasienergy: number | null;
}> {
  const bias = finiteNumber(inputs.bias ?? 1, "bias");
  const drive = finiteNumber(inputs.drive ?? 0.8, "drive");
  const frequency = positiveNumber(inputs.frequency ?? 1.2, "frequency");
  const stepsPerPeriod = boundedInteger(inputs.stepsPerPeriod ?? 1024, "stepsPerPeriod", 16, 50_000);
  checkCancelled(options);
  const period = 2 * Math.PI / frequency;
  const operator = floquetOperator(bias, drive, frequency, stepsPerPeriod, options);
  const refinedOperator = floquetOperator(bias, drive, frequency, 2 * stepsPerPeriod, options);
  const summary = floquetSummary(operator, period);
  const refined = floquetSummary(refinedOperator, period);
  return {
    method: "Midpoint product of exact unitary exponentials for a periodically driven two-level Hamiltonian",
    diagnostics: {
      sourcePhysicalMapAvailable: false,
      benchmarkLabel: "comparison",
      stepsPerPeriod,
      refinedStepsPerPeriod: 2 * stepsPerPeriod,
      unitary: summary.unitarityResidual < 1e-11,
    },
    output: {
      model: "H(t)=(bias/2)*sigma_z+(drive/2)*cos(frequency*t)*sigma_x",
      period,
      operator,
      quasienergies: summary.quasienergies,
      transitionProbability: summary.transitionProbability,
      unitarityResidual: summary.unitarityResidual,
      refinementResidual: Math.abs(summary.positiveQuasienergy - refined.positiveQuasienergy),
      undrivenQuasienergy: drive === 0 ? Math.acos(Math.cos(Math.abs(bias) * period / 2)) / period : null,
    },
  };
}

export interface SineGordonInputs {
  gridPoints?: number;
  halfLength?: number;
  width?: number;
  center?: number;
}

export function sineGordonBenchmark(inputs: SineGordonInputs = {}): EarthKernelResult<{
  x: number[];
  theta: number[];
  analyticDerivative: number[];
  finiteDifferenceResidual: Array<number | null>;
  maximumResidual: number;
  rmsResidual: number;
  numericalEnergy: number;
  analyticEnergy: number;
}> {
  const gridPoints = boundedInteger(inputs.gridPoints ?? 1001, "gridPoints", 33, 8193);
  const halfLength = positiveNumber(inputs.halfLength ?? 10, "halfLength");
  const width = positiveNumber(inputs.width ?? 1, "width");
  const center = finiteNumber(inputs.center ?? 0, "center");
  if (halfLength / width < 4 || Math.abs(center) > halfLength - 2 * width) {
    throw new RangeError("The kink must have at least four widths of domain and remain two widths from each boundary");
  }
  const spacing = 2 * halfLength / (gridPoints - 1);
  const x = Array.from({ length: gridPoints }, (_, index) => -halfLength + index * spacing);
  const theta = x.map((position) => 4 * Math.atan(Math.exp((position - center) / width)));
  const analyticDerivative = x.map((position) => 2 / (width * Math.cosh((position - center) / width)));
  const finiteDifferenceResidual: Array<number | null> = Array.from({ length: gridPoints }, () => null);
  let squaredResidual = 0;
  let maximumResidual = 0;
  for (let index = 1; index < gridPoints - 1; index += 1) {
    const secondDerivative = (theta[index + 1]! - 2 * theta[index]! + theta[index - 1]!) / spacing ** 2;
    const residual = secondDerivative - Math.sin(theta[index]!) / width ** 2;
    finiteDifferenceResidual[index] = residual;
    squaredResidual += residual ** 2;
    maximumResidual = Math.max(maximumResidual, Math.abs(residual));
  }
  let numericalEnergy = 0;
  for (let index = 0; index < gridPoints; index += 1) {
    const density = 0.5 * analyticDerivative[index]! ** 2 + (1 - Math.cos(theta[index]!)) / width ** 2;
    numericalEnergy += density * spacing * (index === 0 || index === gridPoints - 1 ? 0.5 : 1);
  }
  return {
    method: "Analytic static sine-Gordon kink sampled on a centered second-difference grid",
    diagnostics: {
      spacing,
      pointsPerWidth: width / spacing,
      secondOrderStencil: true,
      finite: theta.every(Number.isFinite) && Number.isFinite(maximumResidual),
    },
    output: {
      x,
      theta,
      analyticDerivative,
      finiteDifferenceResidual,
      maximumResidual,
      rmsResidual: Math.sqrt(squaredResidual / (gridPoints - 2)),
      numericalEnergy,
      analyticEnergy: 8 / width,
    },
  };
}

export interface PotentialDerivativeInputs {
  theta?: number[];
  differenceStep?: number;
}

export function potentialDerivativeAudit(inputs: PotentialDerivativeInputs = {}): EarthKernelResult<{
  samples: Array<{ theta: number; potential: number; analyticDerivative: number; numericalDerivative: number; sineGordonDerivative: number; differenceFromSineGordon: number }>;
  maximumFiniteDifferenceResidual: number;
  maximumSineGordonDifference: number;
}> {
  const theta = inputs.theta ?? Array.from({ length: 65 }, (_, index) => -Math.PI + 2 * Math.PI * index / 64);
  if (!Array.isArray(theta) || theta.length === 0 || theta.length > 4096) throw new RangeError("theta must contain 1 to 4096 values");
  const differenceStep = positiveNumber(inputs.differenceStep ?? 1e-5, "differenceStep");
  if (differenceStep < 1e-8 || differenceStep > 1e-2) throw new RangeError("differenceStep must be from 1e-8 to 1e-2");
  const potential = (angle: number) => (1 - Math.cos(angle)) ** 2;
  const samples = theta.map((inputAngle) => {
    const angle = finiteNumber(inputAngle, "theta value");
    const analyticDerivative = 2 * (1 - Math.cos(angle)) * Math.sin(angle);
    const numericalDerivative = (potential(angle + differenceStep) - potential(angle - differenceStep)) / (2 * differenceStep);
    const sineGordonDerivative = Math.sin(angle);
    return {
      theta: angle,
      potential: potential(angle),
      analyticDerivative,
      numericalDerivative,
      sineGordonDerivative,
      differenceFromSineGordon: analyticDerivative - sineGordonDerivative,
    };
  });
  const maximumFiniteDifferenceResidual = Math.max(...samples.map(({ analyticDerivative, numericalDerivative }) => Math.abs(analyticDerivative - numericalDerivative)));
  const maximumSineGordonDifference = Math.max(...samples.map(({ differenceFromSineGordon }) => Math.abs(differenceFromSineGordon)));
  return {
    method: "Analytic Euler-Lagrange potential derivative checked by centered finite differences",
    diagnostics: {
      derivativeExpression: "2*(1-cos(theta))*sin(theta)",
      sineGordonExpression: "sin(theta)",
      equivalentToSineGordon: maximumSineGordonDifference <= 64 * Number.EPSILON,
    },
    output: { samples, maximumFiniteDifferenceResidual, maximumSineGordonDifference },
  };
}
