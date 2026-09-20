import type { EvaluationSymbol } from '../types/engine'
import { ELEMENTARY_CHARGE_C } from '../simphy/constants'
import { complex } from '../engine/complex'
import {
  SI_ENERGY,
  SI_FREQUENCY,
  SI_LENGTH,
  UNIT_SYMBOLS,
} from '../engine/dimensions'

function si(value: number, dim: EvaluationSymbol['dimension']): EvaluationSymbol {
  return { value: complex(value), dimension: dim, source: 'unit' }
}

export const COMPUTE_UNIT_ALIASES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['kilograms', 'kg'],
  ['kilogram', 'kg'],
  ['metres', 'meter'],
  ['meters', 'meter'],
  ['metre', 'meter'],
  ['seconds', 'second'],
  ['newtons', 'N'],
  ['newton', 'N'],
  ['joules', 'joule'],
  ['coulombs', 'coulomb'],
  ['amperes', 'ampere'],
  ['kelvins', 'kelvin'],
  ['pascals', 'Pa'],
  ['volts', 'volt'],
  ['watts', 'watt'],
  ['teslas', 'tesla'],
  ['farads', 'farad'],
  ['henries', 'henry'],
  ['henrys', 'henry'],
  ['ohms', 'ohm'],
])

export function computeSiUnitSymbols(): Record<string, EvaluationSymbol> {
  const electronVolt = ELEMENTARY_CHARGE_C
  const scaled: Record<string, EvaluationSymbol> = {
    eV:  si(electronVolt, SI_ENERGY),
    keV: si(electronVolt * 1e3, SI_ENERGY),
    MeV: si(electronVolt * 1e6, SI_ENERGY),
    GeV: si(electronVolt * 1e9, SI_ENERGY),
    TeV: si(electronVolt * 1e12, SI_ENERGY),
    fm:  si(1e-15, SI_LENGTH),
    pm:  si(1e-12, SI_LENGTH),
    nm:  si(1e-9, SI_LENGTH),
    um:  si(1e-6, SI_LENGTH),
    µm:  si(1e-6, SI_LENGTH),
    mm:  si(1e-3, SI_LENGTH),
    cm:  si(1e-2, SI_LENGTH),
    km:  si(1e3, SI_LENGTH),
    kHz: si(1e3, SI_FREQUENCY),
    MHz: si(1e6, SI_FREQUENCY),
    GHz: si(1e9, SI_FREQUENCY),
  }
  const aliases: Record<string, EvaluationSymbol> = {}
  for (const [word, token] of COMPUTE_UNIT_ALIASES) {
    const symbol = scaled[token] ?? UNIT_SYMBOLS[token]
    if (symbol) aliases[word] = symbol
  }
  return { ...scaled, ...aliases }
}
