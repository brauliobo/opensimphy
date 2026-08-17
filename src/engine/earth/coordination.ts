import {
  boundedInteger,
  checkCancelled,
  positiveNumber,
  seededRandom,
  type EarthKernelResult,
  type EarthRunOptions,
} from "./common.js";
import { dot3 } from "../../simphy/vec.js";

type Vector3 = [number, number, number];
const AXES = [0, 1, 2] as const;

export interface SphericalCoordinationInputs {
  coordination: number;
  starts?: number;
  maximumIterations?: number;
  gradientTolerance?: number;
}

interface CoordinationState {
  energy: number;
  gradients: Vector3[];
  gradientNorm: number;
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(...vector);
  if (length === 0) throw new RangeError("Cannot normalize a zero coordination vector");
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function evaluate(points: Vector3[]): CoordinationState {
  const gradients = points.map(() => [0, 0, 0] as Vector3);
  let energy = 0;
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const denominator = 1 - Math.max(-1, Math.min(1, dot3(points[left]!, points[right]!)));
      if (denominator <= 1e-14) return { energy: Number.POSITIVE_INFINITY, gradients, gradientNorm: Number.POSITIVE_INFINITY };
      energy += 2 / denominator;
      const scale = 2 / denominator ** 2;
      const leftGradient = gradients[left]!;
      const rightGradient = gradients[right]!;
      const leftPoint = points[left]!;
      const rightPoint = points[right]!;
      for (const axis of AXES) {
        leftGradient[axis] += scale * rightPoint[axis];
        rightGradient[axis] += scale * leftPoint[axis];
      }
    }
  }
  let squaredNorm = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const gradient = gradients[index]!;
    const radial = dot3(point, gradient);
    for (const axis of AXES) gradient[axis] -= radial * point[axis];
    squaredNorm += dot3(gradient, gradient);
  }
  return { energy, gradients, gradientNorm: Math.sqrt(squaredNorm) };
}

function fibonacciStart(count: number, phase: number): Vector3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const z = 1 - 2 * (index + 0.5) / count;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = goldenAngle * index + phase;
    return [radius * Math.cos(angle), radius * Math.sin(angle), z];
  });
}

function randomStart(count: number, random: () => number): Vector3[] {
  return Array.from({ length: count }, () => {
    const z = 2 * random() - 1;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = 2 * Math.PI * random();
    return [radius * Math.cos(angle), radius * Math.sin(angle), z];
  });
}

function optimize(
  initialPoints: Vector3[],
  maximumIterations: number,
  gradientTolerance: number,
  options: EarthRunOptions,
): { points: Vector3[]; initialEnergy: number; energy: number; gradientNorm: number; iterations: number; converged: boolean } {
  let points = initialPoints.map((point) => [...point] as Vector3);
  let state = evaluate(points);
  const initialEnergy = state.energy;
  let step = 0.02;
  let iterations = 0;
  for (; iterations < maximumIterations && state.gradientNorm > gradientTolerance; iterations += 1) {
    if (iterations % 16 === 0) checkCancelled(options);
    let accepted = false;
    let trialStep = step;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = points.map((point, index) => normalize([
        point[0] - trialStep * state.gradients[index]![0],
        point[1] - trialStep * state.gradients[index]![1],
        point[2] - trialStep * state.gradients[index]![2],
      ]));
      const candidateState = evaluate(candidate);
      if (candidateState.energy < state.energy) {
        points = candidate;
        state = candidateState;
        step = Math.min(0.05, trialStep * 1.25);
        accepted = true;
        break;
      }
      trialStep *= 0.5;
    }
    if (!accepted) break;
  }
  return {
    points,
    initialEnergy,
    energy: state.energy,
    gradientNorm: state.gradientNorm,
    iterations,
    converged: state.gradientNorm <= gradientTolerance,
  };
}

export function sphericalCoordination(
  inputs: SphericalCoordinationInputs,
  options: EarthRunOptions = {},
): EarthKernelResult<{
  coordination: number;
  points: Vector3[];
  pairAnglesRadians: number[];
  pairAnglesDegrees: number[];
  energy: number;
  startDiagnostics: Array<{ start: number; initialEnergy: number; finalEnergy: number; gradientNorm: number; iterations: number; converged: boolean }>;
}> {
  const coordination = boundedInteger(inputs.coordination, "coordination", 2, 12);
  const starts = boundedInteger(inputs.starts ?? 8, "starts", 1, 32);
  const maximumIterations = boundedInteger(inputs.maximumIterations ?? 2000, "maximumIterations", 1, 5000);
  const gradientTolerance = positiveNumber(inputs.gradientTolerance ?? 1e-8, "gradientTolerance");
  if (gradientTolerance < 1e-12 || gradientTolerance > 1e-2) {
    throw new RangeError("gradientTolerance must be from 1e-12 to 1e-2");
  }
  checkCancelled(options);
  const random = seededRandom(options.seed ?? 0x45a17);
  const solutions = Array.from({ length: starts }, (_, start) => {
    const initial = start === 0 ? fibonacciStart(coordination, 0) : randomStart(coordination, random);
    return optimize(initial, maximumIterations, gradientTolerance, options);
  });
  let bestIndex = 0;
  for (let index = 1; index < solutions.length; index += 1) {
    if (solutions[index]!.energy < solutions[bestIndex]!.energy) bestIndex = index;
  }
  const best = solutions[bestIndex]!;
  const pairAnglesRadians: number[] = [];
  for (let left = 0; left < best.points.length; left += 1) {
    for (let right = left + 1; right < best.points.length; right += 1) {
      pairAnglesRadians.push(Math.acos(Math.max(-1, Math.min(1, dot3(best.points[left]!, best.points[right]!)))));
    }
  }
  pairAnglesRadians.sort((left, right) => left - right);
  const startDiagnostics = solutions.map((solution, start) => ({
    start,
    initialEnergy: solution.initialEnergy,
    finalEnergy: solution.energy,
    gradientNorm: solution.gradientNorm,
    iterations: solution.iterations,
    converged: solution.converged,
  }));
  return {
    method: "Seeded multistart Riemannian gradient descent on unit vectors with backtracking",
    diagnostics: {
      starts,
      bestStart: bestIndex,
      maximumIterations,
      converged: best.converged,
      finalProjectedGradientNorm: best.gradientNorm,
      energySpread: Math.max(...solutions.map(({ energy }) => energy)) - Math.min(...solutions.map(({ energy }) => energy)),
      minimumPairAngleDegrees: pairAnglesRadians[0]! * 180 / Math.PI,
    },
    output: {
      coordination,
      points: best.points,
      pairAnglesRadians,
      pairAnglesDegrees: pairAnglesRadians.map((angle) => angle * 180 / Math.PI),
      energy: best.energy,
      startDiagnostics,
    },
  };
}
