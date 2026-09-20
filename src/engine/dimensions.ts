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

export const SI_TIME = dimension(1);
export const SI_LENGTH = dimension(0, 1);
export const SI_CHARGE = dimension(0, 0, 1);
export const SI_TEMPERATURE = dimension(0, 0, 0, 1);
export const SI_MASS = dimension(0, 0, 0, 0, 1);
export const SI_ENERGY = addDimensions(SI_MASS, addDimensions(scaleDimension(SI_LENGTH, 2), scaleDimension(SI_TIME, -2)));
export const SI_ACTION = addDimensions(SI_MASS, addDimensions(scaleDimension(SI_LENGTH, 2), scaleDimension(SI_TIME, -1)));
export const SI_CURRENT = subtractDimensions(SI_CHARGE, SI_TIME);
export const SI_FORCE = addDimensions(SI_MASS, subtractDimensions(SI_LENGTH, scaleDimension(SI_TIME, 2)));
export const SI_VOLTAGE = subtractDimensions(SI_ENERGY, SI_CHARGE);
export const SI_RESISTANCE = subtractDimensions(SI_VOLTAGE, SI_CURRENT);
export const SI_FREQUENCY = scaleDimension(SI_TIME, -1);
export const SI_PRESSURE = subtractDimensions(SI_FORCE, scaleDimension(SI_LENGTH, 2));
export const SI_POWER = subtractDimensions(SI_ENERGY, SI_TIME);

export const UNIT_SYMBOLS: Record<string, EvaluationSymbol> = {
  "-": unit(DIMENSIONLESS),
  dimensionless: unit(DIMENSIONLESS),
  cycle: unit(DIMENSIONLESS),
  cycles: unit(DIMENSIONLESS),
  mol: unit(DIMENSIONLESS),
  sr: unit(DIMENSIONLESS),
  cd: unit(DIMENSIONLESS),
  lm: unit(DIMENSIONLESS),
  s: unit(SI_TIME),
  second: unit(SI_TIME),
  m: unit(SI_LENGTH),
  meter: unit(SI_LENGTH),
  fm: unit(SI_LENGTH),
  C: unit(SI_CHARGE),
  coulomb: unit(SI_CHARGE),
  K: unit(SI_TEMPERATURE),
  kelvin: unit(SI_TEMPERATURE),
  kg: unit(SI_MASS),
  kilogram: unit(SI_MASS),
  u: unit(SI_MASS),
  Hz: unit(SI_FREQUENCY),
  MHz: unit(SI_FREQUENCY),
  J: unit(SI_ENERGY),
  joule: unit(SI_ENERGY),
  eV: unit(SI_ENERGY),
  MeV: unit(SI_ENERGY),
  GeV: unit(SI_ENERGY),
  E_h: unit(SI_ENERGY),
  A: unit(SI_CURRENT),
  ampere: unit(SI_CURRENT),
  N: unit(SI_FORCE),
  noether: unit(addDimensions(SI_MASS, subtractDimensions(SI_LENGTH, SI_TIME))),
  Pa: unit(SI_PRESSURE),
  pascal: unit(SI_PRESSURE),
  V: unit(SI_VOLTAGE),
  volt: unit(SI_VOLTAGE),
  Ohm: unit(SI_RESISTANCE),
  ohm: unit(SI_RESISTANCE),
  Ω: unit(SI_RESISTANCE),
  S: unit(scaleDimension(SI_RESISTANCE, -1)),
  F: unit(subtractDimensions(SI_CHARGE, SI_VOLTAGE)),
  farad: unit(subtractDimensions(SI_CHARGE, SI_VOLTAGE)),
  H: unit(addDimensions(SI_RESISTANCE, SI_TIME)),
  henry: unit(addDimensions(SI_RESISTANCE, SI_TIME)),
  T: unit(subtractDimensions(SI_FORCE, addDimensions(SI_CURRENT, SI_LENGTH))),
  tesla: unit(subtractDimensions(SI_FORCE, addDimensions(SI_CURRENT, SI_LENGTH))),
  W: unit(SI_POWER),
  watt: unit(SI_POWER),
  Wb: unit(addDimensions(SI_VOLTAGE, SI_TIME)),
  c: unit(subtractDimensions(SI_LENGTH, SI_TIME)),
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
