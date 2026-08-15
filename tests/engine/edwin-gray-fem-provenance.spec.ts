import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { aggregateNormalizedResults, normalizeResults } from '../../fem/edwin-gray/scripts/normalize-results.mjs'
import { buildGrayMagneticLookup } from '../../src/edwin-gray/edwinGrayFem'
import { parseGrayFemLookupDocument } from '../../src/edwin-gray/edwinGrayFem'

const caseData = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/cases/patent-3890548-illustrative.json'), 'utf8'))
const resultSchema = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/schema/motor-fem-lut.schema.json'), 'utf8'))
const inputHash = 'a'.repeat(64)
const parameters = { rotorAngleDeg: 0, meshSizeM: 0.025, driveCurrentA: 1 }

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

describe('Edwin Gray FEM result provenance', () => {
  let jobDir: string

  beforeEach(() => {
    jobDir = mkdtempSync(join(tmpdir(), 'edwin-gray-fem-'))
    for (const [name, value] of Object.entries({
      'observables.dat': '0.1\n',
      'coenergy.dat': '0.1\n',
      'inductance.dat': '0.2\n',
    })) {
      writeFileSync(join(jobDir, name), value)
    }
  })

  afterEach(() => {
    rmSync(jobDir, { recursive: true, force: true })
  })

  function addCheckpoint(): void {
    writeFileSync(join(jobDir, 'checkpoint.json'), JSON.stringify({
      checkpointVersion: 'fem-checkpoint-v4',
      jobId: 'test-job',
      inputHash,
      parameters,
      backend: 'host',
      resultContract: 'edwin-gray-browser-result@1',
      meshQuality: 'passed',
      phases: { mesh: 'complete', solve: 'complete', normalize: 'pending' },
      artifacts: {
        outputs: {
          'observables.dat': sha256(join(jobDir, 'observables.dat')),
          'coenergy.dat': sha256(join(jobDir, 'coenergy.dat')),
          'inductance.dat': sha256(join(jobDir, 'inductance.dat')),
        },
      },
    }))
  }

  function normalize(): ReturnType<typeof normalizeResults> {
    return normalizeResults({
      caseData,
      jobDir,
      parameters,
      inputHash,
      solver: 'getdp',
      backend: 'host',
      artifacts: [
        join(jobDir, 'observables.dat'),
        join(jobDir, 'coenergy.dat'),
        join(jobDir, 'inductance.dat'),
      ],
      resultSchema,
    })
  }

  it('rejects solver tables without a completed runner checkpoint', () => {
    expect(() => normalize()).toThrow(/runner checkpoint/)
  })

  it('accepts only output bytes recorded by the checkpoint', () => {
    addCheckpoint()

    const result = normalize()

    expect(result.entries[0]!.provenance.inputHash).toBe(inputHash)
    expect(result.entries[0]!.observables.inductanceH.value).toBe(0.2)

    writeFileSync(join(jobDir, 'inductance.dat'), '999\n')
    expect(() => normalize()).toThrow(/output hash/)
  })

  it('rejects browser LUT documents with incomplete entry provenance', () => {
    const entry = {
      entryId: 'angle-0-mesh-0.025-current-1',
      status: 'complete',
      parameters: { rotorAngleDeg: 0, meshSizeM: 0.025, driveCurrentA: 1 },
      observables: {
        magneticEnergyJ: { value: 0.1, unit: 'J' },
        coEnergyJ: { value: 0.1, unit: 'J' },
        inductanceH: { value: 0.2, unit: 'H' },
      },
      provenance: {
        synthetic: false,
        sourceFormat: 'getdp-table',
        solver: 'getdp',
        backend: 'host',
        inputHash,
        symmetryApplied: false,
        artifacts: ['observables.dat'],
      },
    }
    const document = {
      contract: 'edwin-gray-browser-result',
      contractVersion: 1,
      lutContract: 'motor-fem-lut-v1',
      caseId: caseData.caseId,
      status: 'complete',
      entries: [entry, { ...entry, entryId: 'angle-1-mesh-0.025-current-1', parameters: { ...entry.parameters, rotorAngleDeg: 1 } }],
      provenance: { synthetic: false, limitations: ['smoke'], source: 'test' },
    }

    expect(() => parseGrayFemLookupDocument({
      ...document,
      entries: document.entries.map(({ provenance: _provenance, ...rest }) => rest),
    })).toThrow(/synthetic|provenance/)
    expect(parseGrayFemLookupDocument(document).entries).toHaveLength(2)
  })

  it('aggregates completed job documents into one single-current angle LUT', () => {
    addCheckpoint()
    const first = normalize()
    const second = structuredClone(first)
    second.entries[0]!.entryId = 'angle-13.3333333333-mesh-0.025-current-1'
    second.entries[0]!.parameters.rotorAngleDeg = 13.3333333333

    const result = aggregateNormalizedResults([first, second], { resultSchema })

    expect(result.status).toBe('complete')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.map((entry) => entry.parameters.rotorAngleDeg)).toEqual([0, 13.3333333333])
    expect(result.provenance.synthetic).toBe(false)
    expect(result.provenance.source).toContain('aggregated over 2 rotor angles')
    expect(buildGrayMagneticLookup(result).anglesDeg).toEqual([0, 13.3333333333])
  })

  it('rejects aggregation of duplicate angles', () => {
    addCheckpoint()
    const first = normalize()
    const second = structuredClone(first)

    expect(() => aggregateNormalizedResults([first, second], { resultSchema })).toThrow(/unique angles/)
  })
})
