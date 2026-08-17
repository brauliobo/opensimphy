import type { JsonObject, JsonValue, WorkbenchSnapshotInputV1, WorkbenchSnapshotV1 } from '../../src/types/workbench'
import {
  addSnapshot,
  cloneJsonValue,
  compareSnapshotPair,
  compareSnapshots,
  createSnapshotPair,
  createWorkbenchSnapshot,
  parseWorkbenchSnapshot,
  parseWorkbenchSnapshotJson,
  removeSnapshot,
  serializeWorkbenchSnapshot,
  WorkbenchSnapshotValidationError,
} from '../../src/workbench/snapshots'

const TIMESTAMP = '2026-07-27T10:00:00.000Z'
const COMPATIBILITY_KEY = 'a'.repeat(64)

function snapshotFields(): {
  methodId: string
  inputs: JsonValue
  outputs: JsonValue
  finding: JsonObject
  provenance: JsonObject
  sourceRevision: string
  implementationRevision: string
  modelRevision: string
  contentRevision: string
  compatibilityKey: string
} {
  return {
    methodId:               'direct-evaluation',
    inputs:                 { numerator: 12, denominator: 3, flags: [true, null] },
    outputs:                { quotient: 4, unit: 'm/s' },
    finding:                { status: 'computed', establishes: ['bounded arithmetic'] },
    provenance:             { engine: 'dimension-engine', evidenceRefs: ['bipm-si-brochure-9'] },
    sourceRevision:         'BIPM SI Brochure, 9th edition',
    implementationRevision: 'tour-dimension-engine-v1',
    modelRevision:          'isq-dimension-model-v1',
    contentRevision:        '2026-07-27',
    compatibilityKey:       COMPATIBILITY_KEY,
  }
}

function input(overrides: Partial<ReturnType<typeof snapshotFields>> & { label?: string; instrumentId?: string } = {}): WorkbenchSnapshotInputV1 {
  return {
    instrumentId: 'dimensional-equation-builder',
    label:        'Baseline run',
    ...snapshotFields(),
    ...overrides,
  }
}

function snapshot(overrides: Parameters<typeof input>[0] = {}, timestamp = TIMESTAMP): WorkbenchSnapshotV1 {
  return createWorkbenchSnapshot(input(overrides), timestamp)
}

describe('workbench snapshot contract', () => {
  it('creates the exact immutable version-1 schema without collapsing revisions', () => {
    const value = snapshot()

    expect(Object.keys(value)).toEqual([
      'schemaVersion',
      'instrumentId',
      'methodId',
      'inputs',
      'outputs',
      'finding',
      'provenance',
      'sourceRevision',
      'implementationRevision',
      'modelRevision',
      'contentRevision',
      'compatibilityKey',
      'timestamp',
      'label',
    ])
    expect(value).toMatchObject({
      schemaVersion:          1,
      sourceRevision:         'BIPM SI Brochure, 9th edition',
      implementationRevision: 'tour-dimension-engine-v1',
      modelRevision:          'isq-dimension-model-v1',
      contentRevision:        '2026-07-27',
      timestamp:              TIMESTAMP,
    })
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.inputs)).toBe(true)
    expect(Object.isFrozen(value.finding.establishes)).toBe(true)
  })

  it('supports one program ID instead of an instrument ID', () => {
    const value = createWorkbenchSnapshot({ ...snapshotFields(), programId: 'EARTH-PHYS-001' }, TIMESTAMP)

    expect(value.programId).toBe('EARTH-PHYS-001')
    expect(Object.hasOwn(value, 'instrumentId')).toBe(false)
    expect(Object.hasOwn(value, 'label')).toBe(false)
  })

  it('defensively clones nested values and returns no mutable source references', () => {
    const mutable = {
      instrumentId:          'instrument-one',
      methodId:              'method-one',
      inputs:                { values: [1, 2] },
      outputs:               { result: { value: 2 } },
      finding:               { status: 'computed' },
      provenance:            { sources: ['source-one'] },
      sourceRevision:        'source-v1',
      implementationRevision: 'implementation-v1',
      compatibilityKey:      COMPATIBILITY_KEY,
    }
    const value = createWorkbenchSnapshot(mutable, TIMESTAMP)

    mutable.inputs.values[0] = 99
    mutable.outputs.result.value = 99
    mutable.finding.status = 'changed'
    mutable.provenance.sources.push('source-two')

    expect(value.inputs).toEqual({ values: [1, 2] })
    expect(value.outputs).toEqual({ result: { value: 2 } })
    expect(value.finding).toEqual({ status: 'computed' })
    expect(value.provenance).toEqual({ sources: ['source-one'] })
    expect(() => ((value.inputs as { values: number[] }).values[0] = 7)).toThrow()
  })

  it('parses and serializes only the exact persisted schema', () => {
    const value = snapshot()
    const parsed = parseWorkbenchSnapshotJson(serializeWorkbenchSnapshot(value))

    expect(parsed).toEqual(value)
    expect(parsed).not.toBe(value)
    expect(() => parseWorkbenchSnapshotJson('{not json')).toThrow()
    expect(() => parseWorkbenchSnapshot({ ...value, extra: true })).toThrow(/expected exactly these fields/)
    const { outputs: _outputs, ...missingOutputs } = value
    expect(() => parseWorkbenchSnapshot(missingOutputs)).toThrow(/expected exactly these fields/)
    expect(() => parseWorkbenchSnapshot({ ...value, programId: 'other-program' })).toThrow(/exactly one/)
    const { instrumentId: _instrumentId, ...missingIdentity } = value
    expect(() => parseWorkbenchSnapshot(missingIdentity)).toThrow(/exactly one/)
    expect(() => parseWorkbenchSnapshot({ ...value, schemaVersion: 2 })).toThrow(/schema version 1/)
  })

  it('rejects unsupported JSON values, non-finite numbers, and cycles', () => {
    expect(() => snapshot({ inputs: { omitted: undefined } as never })).toThrow(/undefined/)
    expect(() => snapshot({ outputs: { count: 1n } as never })).toThrow(/bigint/)
    expect(() => snapshot({ outputs: { value: Number.NaN } })).toThrow(/finite JSON number/)
    expect(() => snapshot({ outputs: { value: Number.POSITIVE_INFINITY } })).toThrow(/finite JSON number/)
    expect(() => snapshot({ finding: 'plain text' as never })).toThrow(/structured JSON object/)

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => snapshot({ inputs: cyclic as never })).toThrow(/cyclic/)
  })

  it('rejects unsafe keys, sparse or decorated arrays, and non-plain prototypes', () => {
    const polluted = JSON.parse('{"safe":1,"__proto__":{"polluted":true}}') as unknown
    expect(() => cloneJsonValue(polluted)).toThrow(/unsafe object key/)
    expect(Object.prototype).not.toHaveProperty('polluted')

    const sparse = Array(2)
    sparse[1] = 'present'
    expect(() => cloneJsonValue(sparse)).toThrow(/sparse arrays/)

    const decorated = [1] as number[] & { note?: string }
    decorated.note = 'not JSON array data'
    expect(() => cloneJsonValue(decorated)).toThrow(/extra properties/)

    class RecordLike {
      value = 1
    }
    expect(() => cloneJsonValue(new RecordLike())).toThrow(/plain object prototype/)
    expect(() => cloneJsonValue(new Date())).toThrow(/plain object prototype/)

    const inherited = Object.create(snapshot()) as Record<string, unknown>
    expect(() => parseWorkbenchSnapshot(inherited)).toThrow(/plain object prototype/)
  })

  it.each(['__proto__', 'constructor', 'prototype', 'bad/id', '', ' leading'])('rejects unsafe IDs: %s', (unsafeId) => {
    expect(() => snapshot({ instrumentId: unsafeId })).toThrow(/safe ID/)
    expect(() => snapshot({ methodId: unsafeId })).toThrow(/safe ID/)
  })

  it('validates every revision independently', () => {
    expect(() => snapshot({ sourceRevision: '' })).toThrow(/sourceRevision/)
    expect(() => snapshot({ implementationRevision: 'implementation\nrevision' })).toThrow(/implementationRevision/)
    expect(() => snapshot({ modelRevision: ' model-v1' })).toThrow(/modelRevision/)
    expect(() => snapshot({ contentRevision: 'content-v1\u0000' })).toThrow(/contentRevision/)
    expect(() => snapshot({ sourceRevision: 'x'.repeat(513) })).toThrow(/sourceRevision/)
    expect(() => snapshot({ label: ' label' })).toThrow(/safe non-empty text/)
  })

  it('requires a lowercase SHA-256 compatibility key and canonical ISO timestamp', () => {
    expect(() => snapshot({ compatibilityKey: 'A'.repeat(64) })).toThrow(/lowercase SHA-256/)
    expect(() => snapshot({ compatibilityKey: 'a'.repeat(63) })).toThrow(/lowercase SHA-256/)
    expect(() => snapshot({}, '2026-07-27T10:00:00Z')).toThrow(/ISO timestamp/)
    expect(() => snapshot({}, '2026-02-30T10:00:00.000Z')).toThrow(/ISO timestamp/)
    expect(() => snapshot({}, 'not-a-date')).toThrow(/ISO timestamp/)
  })

  it('rejects accessors and non-enumerable or symbol properties', () => {
    const accessor = { value: 1 }
    Object.defineProperty(accessor, 'computed', { enumerable: true, get: () => 2 })
    expect(() => cloneJsonValue(accessor)).toThrow(/enumerable data property/)

    const hidden = { value: 1 }
    Object.defineProperty(hidden, 'hidden', { value: 2 })
    expect(() => cloneJsonValue(hidden)).toThrow(/enumerable data property/)

    const symbolic = { value: 1, [Symbol('hidden')]: 2 }
    expect(() => cloneJsonValue(symbolic)).toThrow(/symbol keys/)
  })
})

describe('snapshot pairing and comparison', () => {
  it('supports zero, one, or two snapshots and explicitly rejects a third', () => {
    const first = snapshot()
    const second = snapshot({ label: 'Variant' }, '2026-07-27T10:01:00.000Z')
    const one = addSnapshot(createSnapshotPair(), first)
    const two = addSnapshot(one, second)

    expect(one).toHaveLength(1)
    expect(two).toHaveLength(2)
    expect(Object.isFrozen(two)).toBe(true)
    expect(() => addSnapshot(two, snapshot({}, '2026-07-27T10:02:00.000Z'))).toThrow(/pair is full/)
    expect(() => createSnapshotPair([first, second, first])).toThrow(/at most two/)
    expect(removeSnapshot(two, 0)).toEqual([second])
    expect(() => removeSnapshot(one, 1)).toThrow(/not present/)
  })

  it('treats only exact compatibility-key equality as compatible', () => {
    const first = snapshot()
    const second = snapshot({ outputs: { quotient: 5 } }, '2026-07-27T10:01:00.000Z')
    const comparison = compareSnapshots(first, second)

    expect(comparison).toMatchObject({ compatible: true, compatibilityKey: COMPATIBILITY_KEY })
    expect(comparison.findings).toEqual([first.finding, second.finding])
    expect(Object.hasOwn(comparison, 'residual')).toBe(false)
  })

  it('returns parallel findings and no residual for incompatible snapshots', () => {
    const first = snapshot({ finding: { status: 'first' } })
    const second = snapshot({
      finding:          { status: 'second' },
      compatibilityKey: 'b'.repeat(64),
    }, '2026-07-27T10:01:00.000Z')
    const comparison = compareSnapshotPair(createSnapshotPair([first, second]))

    expect(comparison).toMatchObject({
      compatible:       false,
      compatibilityKey: null,
      residual:         null,
      findings:         [{ status: 'first' }, { status: 'second' }],
    })
    expect(() => compareSnapshotPair(createSnapshotPair([first]))).toThrow(/exactly two/)
  })

  it('clones mutable values entering a pair', () => {
    const mutable = JSON.parse(JSON.stringify(snapshot())) as WorkbenchSnapshotV1 & { outputs: { quotient: number } }
    const pair = createSnapshotPair([mutable])
    mutable.outputs.quotient = 99

    expect(pair[0]?.outputs).toEqual({ quotient: 4, unit: 'm/s' })
    expect(pair[0]).not.toBe(mutable)
  })

  it('uses a dedicated validation error for contract failures', () => {
    expect(() => snapshot({ compatibilityKey: 'wrong' })).toThrow(WorkbenchSnapshotValidationError)
  })
})
