import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import earthRegistryJson from '../../public/data/generated/earth/scientific-simulations.json'
import recipesJson from '../../public/data/generated/recipes.json'
import { buildTourArtifacts, readTourSource } from '../../scripts/lib/tour-content.mjs'
import { SCALE_RULER_PRESET_IDS } from '../../src/tour/scaleRulerEngine'
import type { TourProgress } from '../../src/types/tour'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourceDirectory = join(root, 'content', 'tour')
const generatedDirectory = join(root, 'public', 'data', 'generated', 'tour')
const recipeIds = recipesJson.map(({ constant_id }) => constant_id)
const programIds = earthRegistryJson.items.map(({ id }) => id)

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

describe('tour content generator', () => {
  let source: Awaited<ReturnType<typeof readTourSource>>
  let artifacts: ReturnType<typeof buildTourArtifacts>

  beforeAll(async () => {
    source = await readTourSource(sourceDirectory)
    source.lessons = [source.lessons.find(({ id }) => id === 'physical-quantities')!, ...source.lessons.filter(({ id }) => id !== 'physical-quantities')]
    source.simulations = [source.simulations.find(({ id }) => id === 'dimensional-equation-builder')!, ...source.simulations.filter(({ id }) => id !== 'dimensional-equation-builder')]
    artifacts = buildTourArtifacts(source, { recipeIds, programIds })
  })

  function rebuild(mutator: (candidate: any) => void): () => unknown {
    const candidate = structuredClone(source)
    mutator(candidate)
    return () => buildTourArtifacts(candidate, { recipeIds, programIds })
  }

  it('builds the exact ordered corpus with closed references and acyclic navigation', () => {
    expect(artifacts.summary).toEqual({
      chapters: 20,
      lessons: 9,
      simulations: 9,
      glossary: 27,
      references: 10,
      quickStations: 8,
      quickStationMinutes: 27,
    })
    expect(artifacts.chapters.map(({ order }) => order)).toEqual(Array.from({ length: 20 }, (_, index) => index))
    expect(artifacts.manifest.quickStations.map(({ order }) => order)).toEqual(Array.from({ length: 8 }, (_, index) => index + 1))
    expect(artifacts.manifest.quickStations.reduce((total, station) => total + station.estimatedMinutes, 0)).toBe(27)
    expect(artifacts.manifest).toMatchObject({ contentRevision: '2026-07-27', depthComposition: 'technical-includes-guided' })
    expect(artifacts.manifest).not.toHaveProperty('generatedAt')
    expect(new Set(artifacts.chapters.map(({ status }) => status))).toEqual(new Set(['content-ready', 'planned']))
    expect(artifacts.manifest.quickStations.map(({ id, chapterId, lessonId, simulationId, status }) => ({ id, chapterId, lessonId, simulationId, status }))).toEqual([
      { id: 'anchors-scales', chapterId: 'units', lessonId: 'physical-quantities', simulationId: 'dimensional-equation-builder', status: 'content-ready' },
      { id: 'unit-bridges', chapterId: 'unit-bridges', lessonId: 'photon-equivalent-scales', simulationId: 'photon-scale-converter', status: 'content-ready' },
      { id: 'electrical-standards', chapterId: 'electrical-standards', lessonId: 'quantum-electrical-standards', simulationId: 'electrical-standards-network', status: 'content-ready' },
      { id: 'atoms-materials', chapterId: 'atomic-structure', lessonId: 'hydrogen-spectra', simulationId: 'hydrogen-spectrum-explorer', status: 'content-ready' },
      { id: 'particles-mass', chapterId: 'particle-scales', lessonId: 'particle-mass-scales', simulationId: 'particle-scale-comparator', status: 'content-ready' },
      { id: 'spin-magnetism', chapterId: 'spin-magnetism', lessonId: 'spin-precession', simulationId: 'spin-precession-visualizer', status: 'content-ready' },
      { id: 'heat-radiation', chapterId: 'heat-matter', lessonId: 'blackbody-radiation', simulationId: 'blackbody-spectrum', status: 'content-ready' },
      { id: 'molar-matter', chapterId: 'heat-matter', lessonId: 'particle-to-mole', simulationId: 'particle-to-mole-scaler', status: 'content-ready' },
    ])

    const referenceIds = new Set(artifacts.references.entries.map(({ id }) => id))
    const glossaryIds = new Set(artifacts.glossary.entries.map(({ id }) => id))
    for (const entry of artifacts.glossary.entries) expect(entry.evidenceRefs.every((id) => referenceIds.has(id)), entry.id).toBe(true)
    for (const lesson of artifacts.lessons) {
      expect(lesson.evidenceRefs.every((id) => referenceIds.has(id)), lesson.id).toBe(true)
      expect(lesson.glossaryIds.every((id) => glossaryIds.has(id)), lesson.id).toBe(true)
      expect(lesson.formulaIds.every((id) => recipeIds.includes(id)), lesson.id).toBe(true)
      expect(lesson.programIds.every((id) => programIds.includes(id)), lesson.id).toBe(true)
    }
    for (const simulation of artifacts.simulations) {
      expect(simulation.evidenceRefs.every((id) => referenceIds.has(id)), simulation.id).toBe(true)
      expect(simulation.glossaryIds.every((id) => glossaryIds.has(id)), simulation.id).toBe(true)
    }
    expect(artifacts.manifest.quickStations[0].glossaryIds.every((id) => glossaryIds.has(id))).toBe(true)
    expect(artifacts.lessons[0].quickPath).toMatchObject({
      estimatedMinutes: 4,
      guidedBlockIds: ['si-defining-anchors', 'dimensions-and-kinds'],
      equationStepIds: ['fixed-si-anchors'],
      checkpointIds: ['centimetre-prediction'],
      simulationPresetId: 'average-speed-from-path',
    })
    expect(artifacts.lessons[0].equationSteps.find(({ id }) => id === 'fixed-si-anchors')?.evidenceRefs).toEqual(['bipm-si-brochure-9'])
    expect(artifacts.lessons[0].observationStage.items.map(({ id, value, unit, role }) => ({ id, value, unit, role }))).toEqual([
      { id: 'caesium-133-transition', value: 9192631770, unit: 'Hz', role: 'fixed-definition' },
      { id: 'speed-of-light', value: 299792458, unit: 'm/s', role: 'fixed-definition' },
      { id: 'planck-constant', value: 6.62607015e-34, unit: 'J s', role: 'fixed-definition' },
    ])
    expect(artifacts.lessons[0].observationStage.items.every((item) => item.evidenceRefs.length > 0)).toBe(true)
    expect(artifacts.lessons[0].observationStage.items.every((item) => !Object.hasOwn(item, 'attribution'))).toBe(true)
    expect(artifacts.manifest.attributionPolicy.attributedRoots).toContain('observation-stage')
    expect(artifacts.manifest.attributionPolicy.inheritingRecordKinds).toContain('observation-stage-item')

    const guidedRatio = artifacts.lessons[0].guidedBlocks.find(({ id }) => id === 'dimensionless-ratios')
    expect(guidedRatio?.body).toContain('Dimensionless does not mean meaningless. A ratio can encode shape, efficiency, probability, refractive index, an angle convention, or another physically important comparison.')
    expect(guidedRatio?.glossaryIds.every((id) => glossaryIds.has(id))).toBe(true)
    expect(artifacts.lessons[0].technicalBlocks.find(({ id }) => id === 'natural-unit-conventions')?.body.join(' ')).toContain('restore the powers of c, hbar, and k_B')
    expect(artifacts.lessons[0].technicalBlocks.find(({ id }) => id === 'audit-boundary')?.body.join(' ')).toContain('exactly 68 known source declaration dimension conflicts')

    expect(artifacts.chapters[0].previousChapterId).toBeNull()
    expect(artifacts.chapters.at(-1)?.nextChapterId).toBeNull()
    expect(new Set(artifacts.chapters.map(({ nextChapterId }) => nextChapterId).filter(Boolean)).size).toBe(19)
    expect(artifacts.lessons.map(({ id, previousLessonId, nextLessonId }) => ({ id, previousLessonId, nextLessonId }))).toEqual([
      { id: 'physical-quantities', previousLessonId: null, nextLessonId: 'clocks-action-light-gravity' },
      { id: 'clocks-action-light-gravity', previousLessonId: 'physical-quantities', nextLessonId: 'photon-equivalent-scales' },
      { id: 'photon-equivalent-scales', previousLessonId: 'clocks-action-light-gravity', nextLessonId: 'quantum-electrical-standards' },
      { id: 'quantum-electrical-standards', previousLessonId: 'photon-equivalent-scales', nextLessonId: 'hydrogen-spectra' },
      { id: 'hydrogen-spectra', previousLessonId: 'quantum-electrical-standards', nextLessonId: 'particle-mass-scales' },
      { id: 'particle-mass-scales', previousLessonId: 'hydrogen-spectra', nextLessonId: 'spin-precession' },
      { id: 'spin-precession', previousLessonId: 'particle-mass-scales', nextLessonId: 'blackbody-radiation' },
      { id: 'blackbody-radiation', previousLessonId: 'spin-precession', nextLessonId: 'particle-to-mole' },
      { id: 'particle-to-mole', previousLessonId: 'blackbody-radiation', nextLessonId: null },
    ])
    expect(artifacts.manifest.quickStations.every((station) => artifacts.lessons.find(({ id }) => id === station.lessonId)?.quickPath?.estimatedMinutes === station.estimatedMinutes)).toBe(true)
    expect(artifacts.simulations.every(({ revision }) => revision.contentRevision === artifacts.manifest.contentRevision)).toBe(true)
    expect(buildTourArtifacts(source, { recipeIds, programIds })).toEqual(artifacts)
  })

  it('preserves the corrected scientific and interaction contracts', () => {
    const lessonById = new Map(artifacts.lessons.map((lesson) => [lesson.id, lesson]))
    const simulationById = new Map(artifacts.simulations.map((simulation) => [simulation.id, simulation]))
    expect(artifacts.references.entries.map(({ id }) => id)).toContain('iau-resolution-b3-2015')
    expect(artifacts.references.entries.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'iau-2012-resolution-b2',
      'cipm-1988-electrical-conventional-values',
    ]))
    expect(artifacts.manifest.quickStations.find(({ id }) => id === 'atoms-materials')?.interaction).toContain('does not evaluate')

    expect(lessonById.get('clocks-action-light-gravity')?.observationStage.items.map(({ id, role }) => ({ id, role }))).toEqual(expect.arrayContaining([
      { id: 'measured-gravity', role: 'measured-reference' },
      { id: 'derived-planck-length', role: 'derived-model-value' },
    ]))
    expect(lessonById.get('quantum-electrical-standards')?.observationStage.items.slice(2).every(({ role }) => role === 'conventional-value')).toBe(true)
    expect(lessonById.get('spin-precession')?.observationStage.items.map(({ value, role }) => ({ value, role }))).toEqual([
      { value: -2.80249513861e10, role: 'measured-reference' },
      { value: 42577478.461, role: 'measured-reference' },
      { value: 1, role: 'model-input' },
    ])
    expect(lessonById.get('spin-precession')?.equationSteps.find(({ id }) => id === 'phase-circle')?.expression).toContain('phi(t) = -omega t')
    const spin = simulationById.get('spin-precession-visualizer')!
    expect(spin.outputSchema.find(({ id }) => id === 'phaseCycles')?.description).toContain('phaseCycles = -f * t')
    expect(spin.equations).toContain('phi(t) = -omega t; phaseCycles = -f * t; T = 1/|f|; x = cos(phi); y = sin(phi)')

    const scale = simulationById.get('physical-scale-ruler')!
    expect(scale.evidenceRefs).toEqual(expect.arrayContaining(['iau-2012-resolution-b2', 'iau-resolution-b3-2015']))
    expect(scale.sourceLocator).toContain('exact declared or derived Julian-year, light-year, and parsec relationships')
    const scalePresetControl = scale.controls.find(({ id }) => id === 'presetId')
    expect(scalePresetControl?.type).toBe('select')
    if (scalePresetControl?.type === 'select') {
      expect(scalePresetControl.options.map(({ value }) => value)).toEqual(SCALE_RULER_PRESET_IDS)
      expect(scalePresetControl.options.find(({ value }) => value === 'parsec')).toEqual({
        value: 'parsec',
        label: 'Parsec',
        description: 'Exact geometrical value 648000/pi astronomical units under the stated IAU convention.',
      })
    }

    const molarCheckpoint = lessonById.get('particle-to-mole')?.checkpoints.find(({ id }) => id === 'dependent-conversion-check')
    expect(molarCheckpoint).toMatchObject({
      kind: 'prediction',
      answerId: 'all-linear',
    })
    expect(molarCheckpoint?.choices.map(({ id }) => id)).toEqual(['all-linear', 'count-mass-only', 'none'])
    const molar = simulationById.get('particle-to-mole-scaler')!
    expect(molar.predictionPrompt).toBe('If amount of substance doubles while molar mass, temperature, pressure, and signed charge number remain fixed, predict which dependent count, mass, ideal-gas volume, and Faraday charge outputs double.')
    expect(molar.limits).toEqual({ tier: 'immediate', maxOperations: 2, maxDurationMs: 16 })

    const electrical = simulationById.get('electrical-standards-network')!
    expect(electrical.evidenceRefs).toContain('cipm-1988-electrical-conventional-values')
    expect(electrical.modelComponents.find(({ id }) => id === 'historical-conventional-comparison')?.attribution.evidenceRefs).toContain('cipm-1988-electrical-conventional-values')
    expect(electrical.controls.filter(({ readingDepth }) => readingDepth === 'guided')).toHaveLength(3)
    expect(electrical.controls.find(({ id }) => id === 'frequencyHz')).toMatchObject({ readingDepth: 'technical', min: 0, max: 1e15 })
    expect(electrical.presets.every(({ inputs }) => Object.keys(inputs).sort().join(',') === 'chargeCarriers,frequencyHz,presetId,voltageV')).toBe(true)
    expect(electrical.outputSchema.map(({ id }) => id)).toContain('josephsonVoltageFromFrequencyV')
    expect(electrical.equations).toEqual(expect.arrayContaining(['K_J = 2e/h', 'f = K_J V', 'V = f/K_J']))
    expect(electrical.outputSchema.find(({ id }) => id === 'josephsonVoltageFromFrequencyV')?.description).toContain('V = f/K_J')

    const blackbody = simulationById.get('blackbody-spectrum')!
    expect(blackbody.limits).toEqual({ tier: 'immediate', maxOperations: 2, maxDurationMs: 16 })
    expect(blackbody.predictionPrompt).toBe('When thermodynamic temperature increases, predict whether the wavelength-form peak shifts shorter, shifts longer, or stays unchanged, and whether ideal radiant exitance follows the fourth power of the temperature ratio, follows it linearly, or stays unchanged.')
    const blackbodyCheckpoint = lessonById.get('blackbody-radiation')?.checkpoints.find(({ id }) => id === 'hotter-curve-check')
    expect(blackbodyCheckpoint?.answerId).toBe('shorter-t4')
    expect(blackbodyCheckpoint?.choices.map(({ id }) => id)).toEqual(['shorter-t4', 'longer-linear', 'unchanged'])
    const atomic = simulationById.get('hydrogen-spectrum-explorer')!
    expect(atomic.predictionPrompt).toBe('For the selected transition, use the finite-proton reduced-mass factor below one to predict whether its wavelength is longer, shorter, or unchanged relative to the same infinite-mass state.')
    expect(atomic.limits).toEqual({ tier: 'immediate', maxOperations: 2, maxDurationMs: 16 })
    for (const id of ['hydrogen-spectra', 'particle-mass-scales', 'spin-precession']) {
      const lesson = lessonById.get(id)!
      expect(lesson.evidenceRefs).toContain('openstax-university-physics-v3')
      expect([...lesson.guidedBlocks, ...lesson.technicalBlocks].some(({ evidenceRefs }) => evidenceRefs.includes('openstax-university-physics-v3'))).toBe(true)
    }
    for (const id of ['hydrogen-spectrum-explorer', 'particle-scale-comparator', 'spin-precession-visualizer']) {
      expect(simulationById.get(id)?.finding.evidenceRefs).toContain('openstax-university-physics-v3')
    }
  })

  it('matches every generated aggregate and shard', async () => {
    expect(await readJson(join(generatedDirectory, 'manifest.json'))).toEqual(artifacts.manifest)
    expect(await readJson(join(generatedDirectory, 'glossary.json'))).toEqual(artifacts.glossary)
    expect(await readJson(join(generatedDirectory, 'references.json'))).toEqual(artifacts.references)
    expect(await readJson(join(generatedDirectory, 'claim-vocabulary.json'))).toEqual(artifacts.claimVocabulary)

    for (const [directory, records] of [
      ['chapters', artifacts.chapters],
      ['lessons', artifacts.lessons],
      ['simulations', artifacts.simulations],
    ] as const) {
      expect((await readdir(join(generatedDirectory, directory))).sort()).toEqual(records.map(({ id }) => `${id}.json`).sort())
      for (const record of records) expect(await readJson(join(generatedDirectory, directory, `${record.id}.json`))).toEqual(record)
    }
  })

  it('fails closed on malformed attributed evidence and missing conclusion boundaries', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].seenInActivity[0].attribution.evidenceRefs = ['not-a-reference']
    })).toThrow('unknown evidence reference not-a-reference')
    expect(rebuild((candidate) => {
      delete candidate.lessons[0].computedHere
    })).toThrow('is missing properties: computedHere')
    expect(rebuild((candidate) => {
      candidate.lessons[0].checkpoints[0].attribution.evidenceRefs = []
    })).toThrow('evidenceRefs must not be empty')
  })

  it('fails closed on malformed observation stages and item evidence', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items = []
    })).toThrow('observationStage.items must be a non-empty array')
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items[0].unexpected = 'not in the contract'
    })).toThrow('has unknown properties: unexpected')
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items[0].evidenceRefs = ['not-a-reference']
    })).toThrow('unknown evidence reference not-a-reference')
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items[1].id = candidate.lessons[0].observationStage.items[0].id
    })).toThrow('observationStage item IDs must contain unique values')
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items[0].explanation = '<b>not inert plain text</b>'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      delete candidate.lessons[0].observationStage.attribution
    })).toThrow('is missing properties: attribution')
    expect(rebuild((candidate) => {
      candidate.lessons[0].observationStage.items[0].role = 'reference'
    })).toThrow('role is not recognized')
  })

  it('fails closed on invalid numeric controls and preset values', () => {
    expect(rebuild((candidate) => {
      candidate.simulations[0].controls.find(({ id }: { id: string }) => id === 'sampleSiMagnitude').min = 101
    })).toThrow('min must be less than max')
    expect(rebuild((candidate) => {
      candidate.simulations[0].presets[0].inputs.sampleSiMagnitude = 1000
    })).toThrow('must be within [0.1, 100]')
    expect(rebuild((candidate) => {
      candidate.simulations[0].limits.maxOperations = 0
    })).toThrow('limits.maxOperations must be a positive integer')
  })

  it('fails closed on malformed attribution and result axes', () => {
    expect(rebuild((candidate) => {
      delete candidate.lessons[0].equationSteps[0].sourceLocator
    })).toThrow('is missing properties: sourceLocator')
    expect(rebuild((candidate) => {
      candidate.simulations[0].finding.resultStatus = 'passed'
    })).toThrow('resultStatus is not recognized')
    expect(rebuild((candidate) => {
      candidate.claimVocabulary.resultStatuses[1].id = 'passed'
    })).toThrow('claim-vocabulary.resultStatuses must equal')
  })

  it('fails closed when station estimates leave the 20-30 minute budget', () => {
    expect(rebuild((candidate) => {
      candidate.manifest.quickStations[0].estimatedMinutes = 20
    })).toThrow('estimatedMinutes total must be within [20, 30]')
    expect(rebuild((candidate) => {
      candidate.manifest.quickStations[0].estimatedMinutes = 0
    })).toThrow('estimatedMinutes must be a positive integer')
  })

  it('fails closed on malformed structured outputs and excessive Guided controls', () => {
    expect(rebuild((candidate) => {
      candidate.simulations[0].outputSchema[0].nullable = 'sometimes'
    })).toThrow('nullable must be boolean')
    expect(rebuild((candidate) => {
      candidate.simulations[0].controls.find(({ id }: { id: string }) => id === 'sampleSiMagnitude').readingDepth = 'guided'
    })).toThrow('may expose at most 3 Guided controls, found 4')
  })

  it('rejects observed values without empirical context and all source-time validation claims', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].guidedBlocks[0].claimClass = 'observed-value'
    })).toThrow('observed-value requires empirical reference-data context')
    expect(rebuild((candidate) => {
      candidate.lessons[0].checkpoints[0].attribution.validatesTheory = true
    })).toThrow('validatesTheory must be false for static schema-v1 source')
    expect(rebuild((candidate) => {
      candidate.lessons[0].guidedBlocks[0].methodRelationship = 'literal-reproduction'
    })).toThrow('literal-reproduction requires source-reproduction modelOrigin')
  })

  it('enforces exact conclusion scopes and exact source properties', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].computedHere[0].scope = 'activity'
    })).toThrow('scope must be computation for computedHere')
    expect(rebuild((candidate) => {
      candidate.simulations[0].outputSchema[0].unexpected = 'accepted before strict schema validation'
    })).toThrow('has unknown properties: unexpected')
    expect(rebuild((candidate) => {
      candidate.simulations[0].comparison.compatibilityKey = 'source-must-not-supply-this'
    })).toThrow('has unknown properties: compatibilityKey')
  })

  it('requires a complete content-ready station chain', () => {
    expect(rebuild((candidate) => {
      candidate.manifest.quickStations[0].lessonId = null
      candidate.manifest.quickStations[0].simulationId = null
    })).toThrow('requires a linked lesson')
  })

  it('validates quickPath duration and every linked record', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].quickPath.estimatedMinutes = 16
    })).toThrow('must not exceed lesson estimatedMinutes 15')
    expect(rebuild((candidate) => {
      candidate.lessons[0].quickPath.guidedBlockIds[0] = 'dimension-vectors'
    })).toThrow('unknown or non-Guided block dimension-vectors')
    expect(rebuild((candidate) => {
      candidate.lessons[0].quickPath.equationStepIds[0] = 'missing-equation'
    })).toThrow('contains unknown equation step missing-equation')
    expect(rebuild((candidate) => {
      candidate.lessons[0].quickPath.checkpointIds[0] = 'missing-checkpoint'
    })).toThrow('contains unknown checkpoint missing-checkpoint')
    expect(rebuild((candidate) => {
      candidate.lessons[0].quickPath.simulationPresetId = 'missing-preset'
    })).toThrow('references unknown preset missing-preset')
  })

  it('derives stable compatibility keys from id, every revision, and structured outputs', () => {
    const key = artifacts.simulations[0].comparison.compatibilityKey
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(artifacts.simulations[0].revision.implementationRevision).toBe('tour-dimension-engine-v1')
    expect(key).toBe('1ecb7b383154f3daa44bf2d8976fde1edd19131054ff37444842d2a9192f17dc')
    expect(source.simulations[0].comparison).not.toHaveProperty('compatibilityKey')
    expect(buildTourArtifacts(source, { recipeIds, programIds }).simulations[0].comparison.compatibilityKey).toBe(key)

    const limitsChanged = structuredClone(source)
    limitsChanged.simulations[0].limits.maxOperations += 1
    expect(buildTourArtifacts(limitsChanged, { recipeIds, programIds }).simulations[0].comparison.compatibilityKey).toBe(key)

    const mutations = [
      (candidate: any) => {
        candidate.simulations[0].id = 'dimensional-equation-builder-revised'
        candidate.lessons[0].simulationId = 'dimensional-equation-builder-revised'
        candidate.manifest.quickStations[0].simulationId = 'dimensional-equation-builder-revised'
      },
      (candidate: any) => { candidate.simulations[0].revision.modelRevision += '-revised' },
      (candidate: any) => { candidate.simulations[0].revision.implementationRevision += '-revised' },
      (candidate: any) => { candidate.simulations[0].outputSchema[0].description += ' Changed contract.' },
    ]
    for (const mutate of mutations) {
      const changed = structuredClone(source)
      mutate(changed)
      expect(buildTourArtifacts(changed, { recipeIds, programIds }).simulations[0].comparison.compatibilityKey).not.toBe(key)
    }
    expect(rebuild((candidate) => {
      candidate.manifest.contentRevision = '2026-07-28'
      candidate.simulations.forEach((simulation: any) => { simulation.revision.contentRevision = '2026-07-28' })
    })).toThrow('manifest.contentRevision must be 2026-07-27 for the current corpus')
  })

  it('fails closed when the current lesson or simulation corpus is incomplete', () => {
    expect(rebuild((candidate) => { candidate.lessons.pop() })).toThrow('Expected 9 lessons, found 8')
    expect(rebuild((candidate) => { candidate.simulations.pop() })).toThrow('Expected 9 simulations, found 8')
  })

  it('accepts generalized duplicate input roles when controls remain valid', () => {
    const duplicateRoles = structuredClone(source)
    duplicateRoles.simulations[0].controls.find(({ id }: { id: string }) => id === 'sampleSiMagnitude').inputRole = 'coordinate-selection'
    expect(() => buildTourArtifacts(duplicateRoles, { recipeIds, programIds })).not.toThrow()
  })

  it('fails closed on unknown recipe formulas and EARTH programs', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].formulaIds.push('unknown-formula')
    })).toThrow('unknown recipe/formula unknown-formula')
    expect(rebuild((candidate) => {
      candidate.lessons[0].programIds.push('EARTH-NOT-999')
    })).toThrow('unknown EARTH program EARTH-NOT-999')
  })

  it('keeps technical-only terminology out of Guided blocks', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].guidedBlocks[0].glossaryIds.push('base-dimension')
    })).toThrow('base-dimension, which is not available at guided depth')
    expect(rebuild((candidate) => {
      candidate.lessons[0].checkpoints[0].prompt = 'Explain Natural Units before continuing.'
    })).toThrow('Guided text contains technical-only glossary term Natural units')
    expect(rebuild((candidate) => {
      candidate.simulations[0].controls[0].label = 'Base dimension target'
    })).toThrow('Guided text contains technical-only glossary term Base dimension')
    expect(rebuild((candidate) => {
      candidate.lessons[0].equationSteps.find(({ id }: { id: string }) => id === 'fixed-si-anchors').label = 'Natural units anchors'
    })).toThrow('Guided text contains technical-only glossary term Natural units')
  })

  it('validates station and simulation glossary declarations', () => {
    expect(rebuild((candidate) => {
      candidate.manifest.quickStations[0].glossaryIds.push('missing-glossary')
    })).toThrow('unknown glossary reference missing-glossary')
    expect(rebuild((candidate) => {
      candidate.simulations[0].glossaryIds.push(candidate.simulations[0].glossaryIds[0])
    })).toThrow('simulations.dimensional-equation-builder.glossaryIds must contain unique values')
  })

  it('represents quick-station completion independently in TourProgress v1', () => {
    const progress: TourProgress = {
      version: 1,
      readingDepth: 'guided',
      chapters: {},
      lessons: {},
      stations: {
        'anchors-scales': {
          visited: true,
          complete: true,
          updatedAt: '2026-07-26T12:00:00.000Z',
        },
      },
    }

    expect(progress.stations['anchors-scales']).toEqual({
      visited: true,
      complete: true,
      updatedAt: '2026-07-26T12:00:00.000Z',
    })
    expect(progress.chapters).toEqual({})
    expect(progress.lessons).toEqual({})
  })

  it('rejects HTML-like and executable strings before artifact construction', () => {
    expect(rebuild((candidate) => {
      candidate.lessons[0].summary = '<script>alert(1)</script>'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      candidate.lessons[0].summary = '<iframe src="https://example.com"></iframe>'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      candidate.lessons[0].summary = '<b>not inert plain text</b>'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      candidate.references.entries[0].url = 'javascript:alert(1)'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      candidate.lessons[0].summary = 'onerror = alert(1)'
    })).toThrow('HTML-like or executable text')
    expect(rebuild((candidate) => {
      candidate.lessons[0].summary = 'data:text/html,<p>unsafe</p>'
    })).toThrow('HTML-like or executable text')
  })
})
