import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { aggregateNormalizedResults, normalizeResults } from '../../fem/edwin-gray/scripts/normalize-results.mjs'
import { buildGrayMagneticLookup, parseGrayFemLookupDocument } from '../../src/edwin-gray/edwinGrayFem'

const sourceCase = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/cases/patent-3890548-illustrative.json'), 'utf8'))
const resultSchema = JSON.parse(readFileSync(join(process.cwd(), 'fem/edwin-gray/schema/motor-fem-lut.schema.json'), 'utf8'))
const anglesDeg = [0, 13.3333333333]
const eventIndices = [0, 1]
const excitationContract = 'edwin-gray-fem-excitation-event-map/v1'
const caseData = structuredClone(sourceCase)
caseData.sweep.anglesDeg = anglesDeg
caseData.sweep.eventIndices = eventIndices
caseData.sweep.meshSizesM = [0.025]
caseData.sweep.driveCurrentA = [1]
const modelInputHash = 'b'.repeat(64)
const firstJobInputHash = 'a'.repeat(64)
const secondJobInputHash = 'c'.repeat(64)

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

describe('Edwin Gray FEM result provenance', () => {
  let runDir: string

  beforeEach(() => {
    runDir = mkdtempSync(join(tmpdir(), 'edwin-gray-fem-'))
  })

  afterEach(() => {
    rmSync(runDir, { recursive: true, force: true })
  })

  function prepareJob(
    name: string,
    parameters: { rotorAngleDeg: number; eventIndex: number; excitationContract: string; meshSizeM: number; driveCurrentA: number },
    jobInputHash: string,
    outputs: Record<string, string> = {
      'observables.dat': '0.1\n',
      'coenergy.dat': '0.1\n',
      'inductance.dat': '0.2\n',
    },
  ): string {
    const jobDir = join(runDir, name)
    mkdirSync(jobDir)
    for (const [fileName, value] of Object.entries(outputs)) writeFileSync(join(jobDir, fileName), value)
    writeFileSync(join(jobDir, 'mesh-audit.json'), '{"valid":true}\n')
    writeFileSync(join(jobDir, 'checkpoint.json'), JSON.stringify({
      checkpointVersion: 'fem-checkpoint-v5',
      jobId: name,
      modelInputHash,
      jobInputHash,
      inputHash: jobInputHash,
      parameters,
      backend: 'host',
      resultContract: 'edwin-gray-browser-result@1',
      excitationContract: parameters.excitationContract,
      eventIndex: parameters.eventIndex,
      meshQuality: 'passed',
      phases: { mesh: 'complete', solve: 'complete', normalize: 'pending' },
      artifacts: {
        audit: sha256(join(jobDir, 'mesh-audit.json')),
        outputs: Object.fromEntries(Object.keys(outputs).map((fileName) => [fileName, sha256(join(jobDir, fileName))])),
      },
    }))
    return jobDir
  }

  function normalizeJob(angle: number, jobInputHash: string, name = `angle-${angle}`) {
    const eventIndex = eventIndices[anglesDeg.indexOf(angle)] ?? 0
    const parameters = { rotorAngleDeg: angle, eventIndex, excitationContract, meshSizeM: 0.025, driveCurrentA: 1 }
    const jobDir = prepareJob(name, parameters, jobInputHash)
    return normalizeResults({
      caseData,
      jobDir,
      parameters,
      inputHash: jobInputHash,
      modelInputHash,
      solver: 'getdp',
      backend: 'host',
      artifacts: [
        join(jobDir, 'observables.dat'),
        join(jobDir, 'coenergy.dat'),
        join(jobDir, 'inductance.dat'),
        join(jobDir, 'mesh-audit.json'),
      ],
      resultSchema,
    })
  }

  function completeLookup() {
    return aggregateNormalizedResults([
      normalizeJob(anglesDeg[0]!, firstJobInputHash, 'first'),
      normalizeJob(anglesDeg[1]!, secondJobInputHash, 'second'),
    ], { resultSchema })
  }

  it('rejects solver tables without a completed runner checkpoint', () => {
    const parameters = { rotorAngleDeg: 0, eventIndex: 0, excitationContract, meshSizeM: 0.025, driveCurrentA: 1 }
    const jobDir = join(runDir, 'untrusted')
    mkdirSync(jobDir)
    for (const name of ['observables.dat', 'coenergy.dat', 'inductance.dat']) writeFileSync(join(jobDir, name), '0.1\n')

    expect(() => normalizeResults({
      caseData,
      jobDir,
      parameters,
      inputHash: firstJobInputHash,
      modelInputHash,
      artifacts: [join(jobDir, 'observables.dat')],
      resultSchema,
    })).toThrow(/runner checkpoint/)
  })

  it('preserves model, job, and artifact hashes from checkpoint-attested output', () => {
    const result = normalizeJob(0, firstJobInputHash)
    const provenance = result.entries[0]!.provenance

    expect(provenance.modelInputHash).toBe(modelInputHash)
    expect(provenance.jobInputHash).toBe(firstJobInputHash)
    expect(provenance.inputHash).toBe(firstJobInputHash)
    expect(provenance.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'inductance.dat', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    ]))
  })

  it('accepts only output bytes recorded by the checkpoint', () => {
    normalizeJob(0, firstJobInputHash, 'attested')
    writeFileSync(join(runDir, 'attested', 'inductance.dat'), '999\n')

    expect(() => normalizeResults({
      caseData,
      jobDir: join(runDir, 'attested'),
      parameters: { rotorAngleDeg: 0, eventIndex: 0, excitationContract, meshSizeM: 0.025, driveCurrentA: 1 },
      inputHash: firstJobInputHash,
      modelInputHash,
      artifacts: [join(runDir, 'attested', 'inductance.dat')],
      resultSchema,
    })).toThrow(/output hash/)
  })

  it('rejects raw JSON without exact checkpoint hash evidence', () => {
    const parameters = { rotorAngleDeg: 0, eventIndex: 0, excitationContract, meshSizeM: 0.025, driveCurrentA: 1 }
    const raw = {
      synthetic: false,
      parameters,
      provenance: { modelInputHash, jobInputHash: firstJobInputHash, solver: 'getdp', backend: 'host' },
      observables: {
        magneticEnergyJ: { value: 0.1, unit: 'J' },
        coEnergyJ: { value: 0.1, unit: 'J' },
        inductanceH: { value: 0.2, unit: 'H' },
      },
    }
    const jobDir = prepareJob('raw', parameters, firstJobInputHash, { 'result.raw.json': `${JSON.stringify(raw)}\n` })
    const rawPath = join(jobDir, 'result.raw.json')
    const checkpoint = JSON.parse(readFileSync(join(jobDir, 'checkpoint.json'), 'utf8'))
    checkpoint.artifacts.outputs['result.raw.json'] = 'd'.repeat(64)
    writeFileSync(join(jobDir, 'checkpoint.json'), JSON.stringify(checkpoint))

    expect(() => normalizeResults({
      caseData,
      jobDir,
      parameters,
      inputHash: firstJobInputHash,
      modelInputHash,
      rawPath,
      artifacts: [rawPath],
      resultSchema,
    })).toThrow(/Raw solver JSON hash/)
  })

  it('aggregates genuinely distinct jobs into the exact declared angle LUT', () => {
    const result = completeLookup()
    result.compatibility = {
      machineContractId: 'patent-3890548-illustrative',
      machineRevision: 1,
      modelRevision: 1,
      topologyIdentity: 'us3890548a-nine-stator-three-rotor-pair-topology',
      turns: 100,
      excitation: 'impressed-current-magnetostatic',
      modelInputHash,
    }

    expect(result.entries.map((entry) => entry.provenance.jobInputHash)).toEqual([firstJobInputHash, secondJobInputHash])
    expect(result.entries.map((entry) => entry.parameters.rotorAngleDeg)).toEqual(anglesDeg)
    expect(result.expectedAnglesDeg).toEqual(anglesDeg)
    const runtimeLookup = buildGrayMagneticLookup(result)
    expect(runtimeLookup.provenance.inputHash).toBe(modelInputHash)
    expect(runtimeLookup.compatibility).toEqual(result.compatibility)

    const browserContract = structuredClone(result)
    for (const entry of browserContract.entries) delete entry.provenance.inputHash
    expect(parseGrayFemLookupDocument(browserContract).entries).toHaveLength(2)
  })

  it('rejects duplicate, missing, and extra angles against the declared sweep', () => {
    const result = completeLookup()
    const extra = structuredClone(result.entries[1]!)
    extra.entryId = 'angle-20-event-1-mesh-0.025-current-1'
    extra.parameters.rotorAngleDeg = 20
    extra.provenance.jobInputHash = 'd'.repeat(64)
    extra.provenance.inputHash = extra.provenance.jobInputHash

    expect(() => aggregateNormalizedResults([normalizeJob(0, firstJobInputHash, 'duplicate-a'), normalizeJob(0, secondJobInputHash, 'duplicate-b')], { resultSchema })).toThrow(/unique angles/)
    expect(() => parseGrayFemLookupDocument({ ...result, entries: result.entries.slice(0, 1) })).toThrow(/exactly match/)
    expect(() => parseGrayFemLookupDocument({ ...result, entries: [...result.entries, extra] })).toThrow(/exactly match/)
  })

  it('rejects mixed model, case, mesh, and current provenance', () => {
    const first = normalizeJob(0, firstJobInputHash, 'mixed-first')
    const second = normalizeJob(anglesDeg[1]!, secondJobInputHash, 'mixed-second')

    const mixedModel = structuredClone(second)
    mixedModel.entries[0]!.provenance.modelInputHash = 'e'.repeat(64)
    expect(() => aggregateNormalizedResults([first, mixedModel], { resultSchema })).toThrow(/model input hash/)

    const mixedCase = structuredClone(second)
    mixedCase.caseId = 'other-case'
    expect(() => aggregateNormalizedResults([first, mixedCase], { resultSchema })).toThrow(/case ID/)

    const mixedMesh = structuredClone(second)
    mixedMesh.entries[0]!.parameters.meshSizeM = 0.04
    expect(() => aggregateNormalizedResults([first, mixedMesh], { resultSchema })).toThrow(/mesh size/)

    const mixedCurrent = structuredClone(second)
    mixedCurrent.entries[0]!.parameters.driveCurrentA = 10
    expect(() => aggregateNormalizedResults([first, mixedCurrent], { resultSchema })).toThrow(/drive current/)

    const browserMixedCurrent = completeLookup()
    browserMixedCurrent.entries[1]!.parameters.driveCurrentA = 10
    expect(() => parseGrayFemLookupDocument(browserMixedCurrent)).toThrow(/reference current/)
  })

  it('rejects incomplete, synthetic, and unhashed browser entries', () => {
    const result = completeLookup()
    const incomplete = structuredClone(result)
    incomplete.entries[0]!.status = 'pending'
    expect(() => parseGrayFemLookupDocument(incomplete)).toThrow(/not complete/)

    const synthetic = structuredClone(result)
    synthetic.entries[0]!.provenance.synthetic = true
    expect(() => parseGrayFemLookupDocument(synthetic)).toThrow(/synthetic/)

    const unhashed = structuredClone(result)
    unhashed.entries[0]!.provenance.artifacts = ['observables.dat']
    expect(() => parseGrayFemLookupDocument(unhashed)).toThrow(/artifact hashes/)
  })
})
