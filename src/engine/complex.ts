import type { ComplexValue } from "../types/engine.js";

export const ZERO: ComplexValue = Object.freeze({ re: 0, im: 0 });
export const ONE: ComplexValue = Object.freeze({ re: 1, im: 0 });
export const I: ComplexValue = Object.freeze({ re: 0, im: 1 });

export function complex(re: number, im = 0): ComplexValue {
  return { re, im };
}

export function add(left: ComplexValue, right: ComplexValue): ComplexValue {
  return complex(left.re + right.re, left.im + right.im);
}

export function subtract(left: ComplexValue, right: ComplexValue): ComplexValue {
  return complex(left.re - right.re, left.im - right.im);
}

export function negate(value: ComplexValue): ComplexValue {
  return complex(-value.re, -value.im);
}

export function multiply(left: ComplexValue, right: ComplexValue): ComplexValue {
  return complex(left.re * right.re - left.im * right.im, left.re * right.im + left.im * right.re);
}

export function divide(left: ComplexValue, right: ComplexValue): ComplexValue {
  const denominator = right.re * right.re + right.im * right.im;
  if (denominator === 0) throw new RangeError("Complex division by zero");
  return complex(
    (left.re * right.re + left.im * right.im) / denominator,
    (left.im * right.re - left.re * right.im) / denominator,
  );
}

export function magnitude(value: ComplexValue): number {
  return Math.hypot(value.re, value.im);
}

export function argument(value: ComplexValue): number {
  return Math.atan2(value.im, value.re);
}

export function exp(value: ComplexValue): ComplexValue {
  const radius = Math.exp(value.re);
  return complex(radius * Math.cos(value.im), radius * Math.sin(value.im));
}

export function log(value: ComplexValue): ComplexValue {
  return complex(Math.log(magnitude(value)), argument(value));
}

function integerPower(base: ComplexValue, exponent: number): ComplexValue {
  if (exponent < 0) return divide(ONE, integerPower(base, -exponent));
  let result = ONE;
  let factor = base;
  let power = exponent;
  while (power > 0) {
    if (power % 2 === 1) result = multiply(result, factor);
    factor = multiply(factor, factor);
    power = Math.floor(power / 2);
  }
  return result;
}

export function power(base: ComplexValue, exponent: ComplexValue): ComplexValue {
  if (exponent.im === 0 && Number.isSafeInteger(exponent.re)) return integerPower(base, exponent.re);
  if (base.re === 0 && base.im === 0) {
    if (exponent.im === 0 && exponent.re > 0) return ZERO;
    throw new RangeError("Undefined zero power");
  }
  return exp(multiply(exponent, log(base)));
}

export function sin(value: ComplexValue): ComplexValue {
  return complex(Math.sin(value.re) * Math.cosh(value.im), Math.cos(value.re) * Math.sinh(value.im));
}

export function cos(value: ComplexValue): ComplexValue {
  return complex(Math.cos(value.re) * Math.cosh(value.im), -Math.sin(value.re) * Math.sinh(value.im));
}

export function sinh(value: ComplexValue): ComplexValue {
  return complex(Math.sinh(value.re) * Math.cos(value.im), Math.cosh(value.re) * Math.sin(value.im));
}

export function cosh(value: ComplexValue): ComplexValue {
  return complex(Math.cosh(value.re) * Math.cos(value.im), Math.sinh(value.re) * Math.sin(value.im));
}

export function isFiniteComplex(value: ComplexValue): boolean {
  return Number.isFinite(value.re) && Number.isFinite(value.im);
}

export function nearlyReal(value: ComplexValue, tolerance = 2e-12): number {
  const scale = Math.max(1, Math.abs(value.re));
  if (Math.abs(value.im) > tolerance * scale) throw new RangeError(`Expected a real result, imaginary residual is ${value.im}`);
  return value.re;
}

export function parseComplex(text: string): ComplexValue {
  const source = text.trim().replace(/j$/, "i");
  if (!source.endsWith("i")) {
    const value = Number(source);
    if (!Number.isFinite(value)) throw new Error(`Invalid numeric symbol value: ${text}`);
    return complex(value);
  }
  const body = source.slice(0, -1);
  let split = -1;
  for (let index = 1; index < body.length; index += 1) {
    if ((body[index] === "+" || body[index] === "-") && body[index - 1] !== "e" && body[index - 1] !== "E") split = index;
  }
  if (split < 0) {
    const imaginary = body === "" || body === "+" ? 1 : body === "-" ? -1 : Number(body);
    if (!Number.isFinite(imaginary)) throw new Error(`Invalid complex symbol value: ${text}`);
    return complex(0, imaginary);
  }
  const re = Number(body.slice(0, split));
  const im = Number(body.slice(split));
  if (!Number.isFinite(re) || !Number.isFinite(im)) throw new Error(`Invalid complex symbol value: ${text}`);
  return complex(re, im);
}
