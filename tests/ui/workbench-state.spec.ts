import {
  decodeWorkbenchInputEnvelope,
  encodeWorkbenchInputEnvelope,
  MAX_WORKBENCH_URL_INPUT_BYTES,
  mergeOwnedQuery,
  parseBooleanQuery,
  parseEnumQuery,
  parseIntegerQuery,
  parseNumberQuery,
  parseQueryScalar,
  parseSafeIdQuery,
} from '../../src/workbench/urlState'
import { sha256 } from '../../src/workbench/sha256'

function encodeRawJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let encoded = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded += alphabet[first >> 2]
    encoded += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)]
    if (second !== undefined) encoded += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)]
    if (third !== undefined) encoded += alphabet[third & 63]
  }
  return encoded
}

describe('shared SHA-256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ])('matches the known vector for %j', (value, expected) => {
    expect(sha256(value)).toBe(expected)
  })

  it('hashes Unicode as deterministic UTF-8', () => {
    const value = 'café β'
    const expected = '548928a911a3d5396ce8f61b0564b46a04c63e00dc7aaacdeade95a24e846355'

    expect(sha256(value)).toBe(expected)
    expect(sha256(value)).toBe(sha256(value))
    expect(sha256(value)).not.toBe(sha256('cafe β'))
  })
})

describe('workbench scalar URL state', () => {
  it('accepts only scalar strings and safe IDs', () => {
    expect(parseQueryScalar('one')).toBe('one')
    expect(parseQueryScalar(['one', 'two'])).toBeNull()
    expect(parseQueryScalar(1)).toBeNull()
    expect(parseSafeIdQuery('EARTH-PHYS:001')).toBe('EARTH-PHYS:001')
    expect(parseSafeIdQuery('__proto__')).toBeNull()
    expect(parseSafeIdQuery('bad/id')).toBeNull()
  })

  it('parses finite bounded numbers with optional step alignment', () => {
    expect(parseIntegerQuery('6', { min: 0, max: 10, step: 2 })).toBe(6)
    expect(parseIntegerQuery('7', { min: 0, max: 10, step: 2 })).toBeNull()
    expect(parseIntegerQuery('11', { min: 0, max: 10 })).toBeNull()
    expect(parseIntegerQuery('01', { min: 0, max: 10 })).toBeNull()
    expect(parseIntegerQuery(['6'], { min: 0, max: 10 })).toBeNull()
    expect(parseNumberQuery('0.3', { min: 0.1, max: 0.5, step: 0.1 })).toBe(0.3)
    expect(parseNumberQuery('0.35', { min: 0.1, max: 0.5, step: 0.1 })).toBeNull()
    expect(parseNumberQuery('1e999', { min: 0, max: 10 })).toBeNull()
    expect(parseNumberQuery('NaN', { min: 0, max: 10 })).toBeNull()
    expect(parseNumberQuery(' 1', { min: 0, max: 10 })).toBeNull()
  })

  it('parses declared enums and explicit booleans only', () => {
    expect(parseEnumQuery('manual', ['manual', 'artifact'] as const)).toBe('manual')
    expect(parseEnumQuery('other', ['manual', 'artifact'] as const)).toBeNull()
    expect(parseBooleanQuery('true')).toBe(true)
    expect(parseBooleanQuery('false')).toBe(false)
    expect(parseBooleanQuery('1')).toBeNull()
  })

  it('merges only owned keys, omits defaults, and returns deterministic ordering', () => {
    const current = { z: 'last', mode: 'old', repeated: ['one', 'two'], a: 'first' }
    const first = mergeOwnedQuery(
      current,
      ['mode', 'scale'],
      { mode: 'manual', scale: 2 },
      { mode: 'manual', scale: 1 },
    )
    const second = mergeOwnedQuery(
      { repeated: ['one', 'two'], a: 'first', mode: 'different', z: 'last' },
      ['scale', 'mode'],
      { scale: 2, mode: 'manual' },
      { scale: 1, mode: 'manual' },
    )

    expect(first).toEqual({ a: 'first', repeated: ['one', 'two'], scale: '2', z: 'last' })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(current).toEqual({ z: 'last', mode: 'old', repeated: ['one', 'two'], a: 'first' })
  })
})

describe('workbench input URL envelope', () => {
  it('round-trips canonical nested Unicode object inputs', () => {
    const first = encodeWorkbenchInputEnvelope({ z: { beta: 'β', alpha: 'café' }, a: [1, true, null] })
    const second = encodeWorkbenchInputEnvelope({ a: [1, true, null], z: { alpha: 'café', beta: 'β' } })

    expect(first).toBe(second)
    expect(decodeWorkbenchInputEnvelope(first)).toEqual({ a: [1, true, null], z: { alpha: 'café', beta: 'β' } })
  })

  it('rejects a valid envelope whose JSON object keys are not in canonical order', () => {
    expect(() => decodeWorkbenchInputEnvelope(
      encodeRawJson('{"version":1,"inputs":{"z":1,"a":2}}'),
    )).toThrow(/not canonical/)
  })

  it('rejects malformed base64url, unknown versions, fields, and non-object inputs', () => {
    expect(() => decodeWorkbenchInputEnvelope('not+base64')).toThrow(/base64url/)
    expect(() => decodeWorkbenchInputEnvelope('A')).toThrow(/base64url/)
    expect(() => decodeWorkbenchInputEnvelope(encodeRawJson('{"version":2,"inputs":{}}'))).toThrow(/version must be 1/)
    expect(() => decodeWorkbenchInputEnvelope(encodeRawJson('{"version":1,"inputs":{},"outputs":{}}'))).toThrow(/exactly/)
    expect(() => decodeWorkbenchInputEnvelope(encodeRawJson('{"version":1,"inputs":[]}'))).toThrow(/inputs must be an object/)
    expect(() => encodeWorkbenchInputEnvelope([])).toThrow(/inputs must be an object/)
  })

  it('rejects unsafe keys, prototype values, and non-finite numbers', () => {
    expect(() => decodeWorkbenchInputEnvelope(
      encodeRawJson('{"version":1,"inputs":{"__proto__":{"polluted":true}}}'),
    )).toThrow(/unsafe object key/)
    expect(Object.prototype).not.toHaveProperty('polluted')

    class InputRecord {
      value = 1
    }
    expect(() => encodeWorkbenchInputEnvelope(new InputRecord())).toThrow(/plain JSON object/)
    expect(() => encodeWorkbenchInputEnvelope({ value: Number.NaN })).toThrow(/finite JSON number/)
    expect(() => decodeWorkbenchInputEnvelope(
      encodeRawJson('{"version":1,"inputs":{"value":1e999}}'),
    )).toThrow(/finite JSON number/)
  })

  it('enforces the decoded UTF-8 byte limit on encode and decode', () => {
    expect(() => encodeWorkbenchInputEnvelope({ value: 'x'.repeat(MAX_WORKBENCH_URL_INPUT_BYTES) })).toThrow(/exceeds/)
    const oversized = encodeRawJson(JSON.stringify({ version: 1, inputs: { value: 'x'.repeat(MAX_WORKBENCH_URL_INPUT_BYTES) } }))
    expect(() => decodeWorkbenchInputEnvelope(oversized)).toThrow(/exceeds/)
  })
})
