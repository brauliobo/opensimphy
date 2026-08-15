import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GRAY_EVIDENCE_BY_ID,
  GRAY_EVIDENCE_CONTRADICTIONS,
  GRAY_EVIDENCE_RECORDS,
  GRAY_RETAINED_FRAME_BOUNDARY,
  grayEvidenceRecord,
} from '../../src/edwin-gray/edwinGrayEvidence'
import { GRAY_SOURCE_GUIDE } from '../../src/edwin-gray/edwinGrayGuide'

const requiredRecordIds = [
  'gray-frame-ema3-cannibalized-into-ema4',
  'gray-frame-ema4-e2-transistor-supplies',
  'gray-caption-ema6-two-horsepower',
  'gray-caption-colored-machine-distinctions',
  'gray-caption-schloff-awg14-rewind',
  'gray-caption-schloff-zero-start-opposite-rotation',
  'gray-caption-schloff-ten-kw-no-load',
  'gray-caption-original-thyratron-ignitron-trigger',
  'gray-caption-modified-zener-ignitron-trigger',
  'gray-caption-fifteen-contacts-unknown-wiring',
  'gray-caption-presenter-reconstructed-capacitor-switching',
  'gray-caption-original-500-rpm-starter',
  'gray-caption-purple-recovery-coils',
  'gray-caption-gold-without-recovery',
  'gray-caption-recovery-67-percent-secondhand',
  'gray-caption-input-26-8-watts',
  'gray-caption-output-raw-7-12-kilowatts',
  'gray-caption-cop300-presenter-claim',
  'gray-audit-cop282-absent',
] as const

const machineFiles = ['black-v1.json', 'ema4-v1.json', 'ema6-v1.json', 'gold-v1.json', 'purple-v1.json', 'white-v1.json']

describe('Edwin Gray transcript and frame evidence', () => {
  it('covers every audited modification and claim with structured provenance', () => {
    expect(new Set(GRAY_EVIDENCE_RECORDS.map(({ id }) => id))).toEqual(new Set(requiredRecordIds))
    expect(new Set(GRAY_EVIDENCE_RECORDS.map(({ id }) => id)).size).toBe(GRAY_EVIDENCE_RECORDS.length)

    for (const record of GRAY_EVIDENCE_RECORDS) {
      expect(record.sourceType).toBeTruthy()
      expect(record.sourceRef).toBeTruthy()
      expect(record.text).toBeTruthy()
      expect(record.confidenceNote).toBeTruthy()
      expect(record.machineState.revision).toBeTruthy()
      expect(record.implications.length).toBeGreaterThan(0)
      expect(record.validationStatus).not.toBe('validated')

      if (record.timestamp.startSeconds !== null && record.timestamp.endSeconds !== null) {
        expect(record.timestamp.startSeconds).toBeLessThan(record.timestamp.endSeconds)
        expect(record.timestamp.start).not.toBeNull()
        expect(record.timestamp.end).not.toBeNull()
      } else {
        expect(record.id).toBe('gray-audit-cop282-absent')
        expect(record.timestamp.precision).toBe('source-pack-wide')
      }
    }
  })

  it('keeps sampled-frame conclusions inside the retained video boundary', () => {
    expect(GRAY_RETAINED_FRAME_BOUNDARY).toMatchObject({
      sourceStartSeconds: 470,
      sourceEndSeconds: 770,
      exactFrameTimestampsRetained: false,
    })

    const framed = GRAY_EVIDENCE_RECORDS.filter(({ frameRange }) => frameRange !== null)
    expect(framed.length).toBeGreaterThan(0)
    for (const record of framed) {
      expect(record.timestamp.startSeconds).toBeGreaterThanOrEqual(GRAY_RETAINED_FRAME_BOUNDARY.sourceStartSeconds)
      expect(record.timestamp.endSeconds).toBeLessThanOrEqual(GRAY_RETAINED_FRAME_BOUNDARY.sourceEndSeconds)
      expect(record.frameRange).toMatchObject({
        retainedSourceStart: GRAY_RETAINED_FRAME_BOUNDARY.sourceStart,
        retainedSourceEnd: GRAY_RETAINED_FRAME_BOUNDARY.sourceEnd,
      })
    }

    for (const record of GRAY_EVIDENCE_RECORDS.filter(({ timestamp }) => (timestamp.startSeconds ?? 0) > 770)) {
      expect(record.frameRange).toBeNull()
    }
  })

  it('resolves apparent trigger and start contradictions only by machine state', () => {
    const stateScoped = GRAY_EVIDENCE_CONTRADICTIONS.filter(({ status }) => status === 'state-scoped')
    expect(stateScoped.map(({ id }) => id)).toEqual([
      'gray-start-condition-state-boundary',
      'gray-trigger-state-boundary',
    ])

    for (const contradiction of GRAY_EVIDENCE_CONTRADICTIONS) {
      const records = contradiction.recordIds.map(grayEvidenceRecord)
      expect(records).toHaveLength(contradiction.recordIds.length)
      if (contradiction.status === 'state-scoped') {
        expect(new Set(records.map(({ machineState }) => machineState.phase))).toEqual(new Set(['original', 'modified']))
      }
    }

    expect(grayEvidenceRecord('gray-caption-original-500-rpm-starter').machineState.phase).toBe('original')
    expect(grayEvidenceRecord('gray-caption-schloff-zero-start-opposite-rotation').machineState.phase).toBe('modified')
    expect(grayEvidenceRecord('gray-caption-original-thyratron-ignitron-trigger').machineState.revision).toContain('thyratron')
    expect(grayEvidenceRecord('gray-caption-modified-zener-ignitron-trigger').machineState.revision).toContain('Zener')
  })

  it('preserves performance claims without inventing a COP or output value', () => {
    expect(grayEvidenceRecord('gray-caption-input-26-8-watts').text).toContain('26.8 watts')
    expect(grayEvidenceRecord('gray-caption-output-raw-7-12-kilowatts')).toMatchObject({
      textKind: 'raw-caption',
      text: 'came up with uh 7 12 kilowatts out',
      confidence: 'low',
      validationStatus: 'ambiguous-automatic-caption',
    })
    expect(grayEvidenceRecord('gray-caption-cop300-presenter-claim').text).toContain('COP of 300')
    expect(grayEvidenceRecord('gray-audit-cop282-absent')).toMatchObject({
      textKind: 'absence-finding',
      validationStatus: 'absent-from-retained-pack',
    })
    expect(GRAY_EVIDENCE_RECORDS.filter(({ text }) => /COP 282/i.test(text)).map(({ id }) => id)).toEqual(['gray-audit-cop282-absent'])
    expect(GRAY_EVIDENCE_CONTRADICTIONS.find(({ id }) => id === 'gray-performance-claim-boundary')).toMatchObject({ status: 'unresolved' })
  })

  it('exposes the same bounded ledger through the guide', () => {
    expect(GRAY_SOURCE_GUIDE.records).toBe(GRAY_EVIDENCE_RECORDS)
    expect(GRAY_SOURCE_GUIDE.contradictions).toBe(GRAY_EVIDENCE_CONTRADICTIONS)
    expect(GRAY_SOURCE_GUIDE.retainedFrameBoundary).toBe(GRAY_RETAINED_FRAME_BOUNDARY)
    expect(GRAY_SOURCE_GUIDE.interpretationBoundary).toContain('do not validate')
  })

  it('keeps machine contracts split into original, modified, and inferred states', () => {
    for (const file of machineFiles) {
      const contract = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/machines/v1', file), 'utf8'))
      const source = contract.identity.source

      expect(Object.keys(source.value)).toEqual(['catalog', 'originalState', 'modifiedState', 'inferredState'])
      expect(source.value.originalState.status).toBeTruthy()
      expect(source.value.modifiedState.status).toBeTruthy()
      expect(source.value.inferredState.status).toContain('surrogate')
      const compatibilityFields = Object.values(contract.compatibilityIdentity) as Array<{ value: unknown }>
      expect(compatibilityFields.slice(0, 7).every((field) => field.value === null)).toBe(true)

      const evidenceIds = [source.value.originalState, source.value.modifiedState, source.value.inferredState]
        .flatMap((state: { evidenceRefs: string[] }) => state.evidenceRefs)
        .filter((reference: string) => reference.startsWith('gray-'))
      expect(evidenceIds.every((id: string) => Object.hasOwn(GRAY_EVIDENCE_BY_ID, id))).toBe(true)
    }
  })

  it('fails closed for unknown evidence IDs', () => {
    expect(() => grayEvidenceRecord('gray-missing-record')).toThrow('Unknown Edwin Gray evidence record')
  })
})
