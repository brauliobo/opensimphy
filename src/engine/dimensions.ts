import type { DimensionVector, EvaluationSymbol } from "../types/engine.js";
import { complex } from "./complex.js";

export const DIMENSIONLESS: DimensionVector = Object.freeze({ time: 0, length: 0, charge: 0, temperature: 0, mass: 0 });

export function dimension(time = 0, length = 0, charge = 0, temperature = 0, mass = 0): DimensionVector {
  return { time, length, charge, temperature, mass };
}

export function addDimensions(left: DimensionVector, right: DimensionVector): DimensionVector {
  return dimension(
    left.time + right.time,
    left.length + right.length,
    left.charge + right.charge,
    left.temperature + right.temperature,
    left.mass + right.mass,
  );
}

export function subtractDimensions(left: DimensionVector, right: DimensionVector): DimensionVector {
  return dimension(
    left.time - right.time,
    left.length - right.length,
    left.charge - right.charge,
    left.temperature - right.temperature,
    left.mass - right.mass,
  );
}

export function scaleDimension(value: DimensionVector, scalar: number): DimensionVector {
  return dimension(value.time * scalar, value.length * scalar, value.charge * scalar, value.temperature * scalar, value.mass * scalar);
}

export function dimensionsEqual(left: DimensionVector, right: DimensionVector, tolerance = 1e-12): boolean {
  return (Object.keys(DIMENSIONLESS) as Array<keyof DimensionVector>).every((axis) => Math.abs(left[axis] - right[axis]) <= tolerance);
}

export function isDimensionless(value: DimensionVector): boolean {
  return dimensionsEqual(value, DIMENSIONLESS);
}

function unit(value: DimensionVector): EvaluationSymbol {
  return { value: complex(1), dimension: value, source: "unit" };
}

const TIME = dimension(1);
const LENGTH = dimension(0, 1);
const CHARGE = dimension(0, 0, 1);
const TEMPERATURE = dimension(0, 0, 0, 1);
const MASS = dimension(0, 0, 0, 0, 1);
const ENERGY = addDimensions(MASS, addDimensions(scaleDimension(LENGTH, 2), scaleDimension(TIME, -2)));
const CURRENT = subtractDimensions(CHARGE, TIME);
const FORCE = addDimensions(MASS, subtractDimensions(LENGTH, scaleDimension(TIME, 2)));
const VOLTAGE = subtractDimensions(ENERGY, CHARGE);
const RESISTANCE = subtractDimensions(VOLTAGE, CURRENT);

export const UNIT_SYMBOLS: Record<string, EvaluationSymbol> = {
  "-": unit(DIMENSIONLESS),
  dimensionless: unit(DIMENSIONLESS),
  cycle: unit(DIMENSIONLESS),
  cycles: unit(DIMENSIONLESS),
  mol: unit(DIMENSIONLESS),
  sr: unit(DIMENSIONLESS),
  cd: unit(DIMENSIONLESS),
  lm: unit(DIMENSIONLESS),
  s: unit(TIME),
  second: unit(TIME),
  m: unit(LENGTH),
  meter: unit(LENGTH),
  fm: unit(LENGTH),
  C: unit(CHARGE),
  coulomb: unit(CHARGE),
  K: unit(TEMPERATURE),
  kelvin: unit(TEMPERATURE),
  kg: unit(MASS),
  kilogram: unit(MASS),
  u: unit(MASS),
  Hz: unit(scaleDimension(TIME, -1)),
  MHz: unit(scaleDimension(TIME, -1)),
  J: unit(ENERGY),
  joule: unit(ENERGY),
  eV: unit(ENERGY),
  MeV: unit(ENERGY),
  GeV: unit(ENERGY),
  E_h: unit(ENERGY),
  A: unit(CURRENT),
  ampere: unit(CURRENT),
  N: unit(FORCE),
  noether: unit(addDimensions(MASS, subtractDimensions(LENGTH, TIME))),
  Pa: unit(subtractDimensions(FORCE, scaleDimension(LENGTH, 2))),
  pascal: unit(subtractDimensions(FORCE, scaleDimension(LENGTH, 2))),
  V: unit(VOLTAGE),
  volt: unit(VOLTAGE),
  Ohm: unit(RESISTANCE),
  ohm: unit(RESISTANCE),
  Ω: unit(RESISTANCE),
  S: unit(scaleDimension(RESISTANCE, -1)),
  F: unit(subtractDimensions(CHARGE, VOLTAGE)),
  farad: unit(subtractDimensions(CHARGE, VOLTAGE)),
  H: unit(addDimensions(RESISTANCE, TIME)),
  henry: unit(addDimensions(RESISTANCE, TIME)),
  T: unit(subtractDimensions(FORCE, addDimensions(CURRENT, LENGTH))),
  tesla: unit(subtractDimensions(FORCE, addDimensions(CURRENT, LENGTH))),
  W: unit(subtractDimensions(ENERGY, TIME)),
  watt: unit(subtractDimensions(ENERGY, TIME)),
  Wb: unit(addDimensions(VOLTAGE, TIME)),
  c: unit(subtractDimensions(LENGTH, TIME)),
};

export function formatDimension(value: DimensionVector): string {
  const labels: Array<[keyof DimensionVector, string]> = [
    ["time", "s"],
    ["length", "m"],
    ["charge", "C"],
    ["temperature", "K"],
    ["mass", "kg"],
  ];
  const terms = labels.filter(([axis]) => Math.abs(value[axis]) > 1e-12).map(([axis, label]) => `${label}^${value[axis]}`);
  return terms.length ? terms.join(" ") : "dimensionless";
}
