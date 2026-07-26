import { readFile } from 'node:fs/promises'
import completionJson from '../../public/data/generated/earth/completion.json'
import manifestJson from '../../public/data/generated/earth/manifest.json'
import registryJson from '../../public/data/generated/earth/scientific-simulations.json'
import {
  EARTH_GATE_IDS,
  EXECUTABLE_EARTH_SIMULATION_IDS,
  buildEarthSimulationRegistry,
} from '../../scripts/lib/earth-simulation-registry.mjs'
import {
  DEFAULT_EARTH_SIMULATION_INPUTS,
  EARTH_PROGRAM_DEFINITIONS,
  SUPPORTED_EARTH_SIMULATION_IDS,
  getDefaultEarthMethodId,
  listEarthMethods,
  runEarthSimulation,
} from '../../src/engine/earth'

const planPath = '../research/earth-thad-nassim/EARTH_SIMULATION_PLAN.md'
const registry = registryJson as typeof registryJson
const completion = completionJson as typeof completionJson
const unavailableSourceMethodCount = registry.items.filter((simulation) => (
  simulation.scientificStatus === 'blocked-source'
  && !simulation.executionMethods.some((method) => method.runnable && method.relationship === 'earth-source-reproduction')
)).length
const declaredMethodCount = 134 + unavailableSourceMethodCount
const G2A_REQUIRED_IDS = new Set([
  'EARTH-PLAN-001', 'EARTH-PLAN-007', 'EARTH-PLAN-008',
  'EARTH-STAR-001', 'EARTH-STAR-003', 'EARTH-STAR-005',
  'EARTH-GAL-001', 'EARTH-GAL-003', 'EARTH-GAL-005', 'EARTH-GAL-006',
  'EARTH-BIO-002', 'EARTH-BIO-003', 'EARTH-BIO-004', 'EARTH-BIO-005',
  'EARTH-NEURO-001', 'EARTH-NEURO-002', 'EARTH-NEURO-003', 'EARTH-NEURO-004', 'EARTH-NEURO-005',
])

function expectFiniteJson(value: unknown, path = 'result'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectFiniteJson(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => expectFiniteJson(item, `${path}.${key}`))
  }
}

describe('EARTH scientific simulation registry', () => {
  it('registers exactly the canonical 130 IDs across 17 prefixes', () => {
    expect(registry.schemaVersion).toBe(2)
    expect(registry.summary).toMatchObject({
      sourceRows: 130,
      registered: 130,
      prefixes: 17,
      runnable: 130,
      blocked: 0,
      totalMethods: declaredMethodCount,
      runnableMethods: 134,
    })
    expect(registry.items).toHaveLength(130)
    expect(new Set(registry.items.map(({ id }) => id)).size).toBe(130)
    expect(new Set(registry.items.map(({ prefix }) => prefix)).size).toBe(17)
    expect(registry.items.map(({ id }) => id)).toContain('EARTH-X-003')
    expect(registry.items.map(({ id }) => id)).toContain('EARTH-X-005')
  })

  it('mirrors all engine methods and defaults without claiming scientific validation', () => {
    expect(Object.keys(EARTH_PROGRAM_DEFINITIONS)).toEqual(registry.items.map(({ id }) => id))
    expect(registry.items.flatMap(({ executionMethods }) => executionMethods)).toHaveLength(declaredMethodCount)
    for (const simulation of registry.items) {
      const programId = simulation.id as keyof typeof EARTH_PROGRAM_DEFINITIONS
      expect(simulation.defaultMethodId, programId).toBe(getDefaultEarthMethodId(programId))
      expect(simulation.executionMethods.find(({ id }) => id === simulation.defaultMethodId)?.runnable, programId).toBe(true)
      expect(simulation.executionMethods.filter(({ runnable }) => runnable), programId).toEqual(listEarthMethods(programId).map((method) => ({
        id: method.id,
        title: method.title,
        relationship: method.relationship,
        modelOrigin: method.modelOrigin,
        runtime: method.runtime,
        runnable: method.runtime !== 'unavailable',
        earthDerived: method.earthDerived,
        validatesEarthTheory: method.validatesEarthTheory,
      })))
      expect(simulation.executionMethods.every(({ validatesEarthTheory }) => validatesEarthTheory === false)).toBe(true)
    }
    expect(registry.items.find(({ id }) => id === 'EARTH-THERM-006')?.defaultMethodId).toBe('earth-source-reproduction-v1')
    for (const id of ['EARTH-COS-006', 'EARTH-PLAN-008', 'EARTH-PLAN-012']) {
      expect(registry.items.find((item) => item.id === id)?.defaultMethodId).toBe('traditional-analytic-baseline-v1')
    }
  })

  it('declares one unavailable source formulation wherever blocked source closure is missing', () => {
    const blockedSourcePrograms = registry.items.filter(({ scientificStatus }) => scientificStatus === 'blocked-source')
    expect(unavailableSourceMethodCount).toBe(blockedSourcePrograms.length)
    expect(registry.summary.totalMethods).toBe(registry.summary.runnableMethods + unavailableSourceMethodCount)
    expect(registry.summary.runnableMethods).toBe(134)

    for (const simulation of blockedSourcePrograms) {
      const runnableSource = simulation.executionMethods.find((method) => (
        method.runnable && method.relationship === 'earth-source-reproduction'
      ))
      const unavailableSource = simulation.executionMethods.find(({ relationship }) => relationship === 'earth-source-model')
      expect(Boolean(runnableSource || unavailableSource), simulation.id).toBe(true)
      if (!unavailableSource) continue
      expect(unavailableSource, simulation.id).toMatchObject({
        id: 'earth-source-model-v1',
        modelOrigin: 'earth-corpus',
        runtime: 'unavailable',
        runnable: false,
        earthDerived: true,
        validatesEarthTheory: false,
        precision: null,
      })
      expect(unavailableSource.model, simulation.id).toContain('governing EARTH source contract is incomplete')
      expect(unavailableSource.model, simulation.id).toContain(simulation.sourceState.text)
      expect(simulation.defaultMethodId, simulation.id).not.toBe(unavailableSource.id)
    }
  })

  it('does not duplicate the runnable source formulation on the four pilots', () => {
    for (const id of ['EARTH-THERM-006', 'EARTH-COS-006', 'EARTH-PLAN-008', 'EARTH-PLAN-012']) {
      const simulation = registry.items.find((item) => item.id === id)!
      expect(simulation.executionMethods.filter(({ relationship }) => relationship === 'earth-source-reproduction')).toHaveLength(1)
      expect(simulation.executionMethods.filter(({ relationship }) => relationship === 'earth-source-model')).toHaveLength(0)
    }
  })

  it('links every program to locked sources and carries every gate state', () => {
    const manifestIds = new Set(manifestJson.documents.map(({ id }) => id))
    expect(registry.summary.sourceLinked).toBe(130)
    for (const simulation of registry.items) {
      expect(simulation.sourceDocumentIds.length).toBeGreaterThan(0)
      expect(simulation.sourceDocumentIds.every((id) => manifestIds.has(id))).toBe(true)
      expect(Object.keys(simulation.gateStates)).toEqual(EARTH_GATE_IDS)
    }
  })

  it('keeps source-blocked models runnable only as comparisons or contract validators', () => {
    for (const id of ['EARTH-FLD-002', 'EARTH-SPEC-002', 'EARTH-MAT-005', 'EARTH-GRV-004', 'EARTH-GAL-002', 'EARTH-BIO-002', 'EARTH-NEURO-005']) {
      const simulation = registry.items.find((item) => item.id === id)
      expect(simulation).toMatchObject({ runnable: true, scientificStatus: 'blocked-source' })
      expect(simulation?.execution).not.toBe('blocked')
      expect(simulation?.blockers.length).toBeGreaterThan(0)
    }
    expect(registry.items.filter(({ execution }) => execution === 'blocked')).toHaveLength(0)
    expect(registry.summary.runnable + registry.summary.blocked).toBe(130)
    for (const simulation of registry.items.filter(({ sourceState }) => sourceState.status === 'blocked')) {
      expect(simulation.blockers).toContain(simulation.sourceState.text)
      expect(simulation.blockers).not.toContain('No verified execution adapter or immutable offline artifact is available.')
    }
  })

  it('preserves source metadata and scopes G0b and G2a to program requirements', async () => {
    const planText = await readFile(planPath, 'utf8')
    const planRows = new Map(planText.split('\n').flatMap((line) => {
      if (!/^\| EARTH-[A-Z]+-\d{3} \|/.test(line)) return []
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
      return cells.length === 6 ? [[cells[0], cells] as const] : []
    }))
    for (const simulation of registry.items.filter(({ inferredTypeMetadata }) => !inferredTypeMetadata)) {
      const cells = planRows.get(simulation.id)
      expect(cells, simulation.id).toBeDefined()
      expect(simulation.classificationSource, simulation.id).toBe(cells?.[2].split(' / ')[0])
      expect(simulation.tierSource, simulation.id).toBe(cells?.[2].split(' / ')[1])
      expect(simulation.executionTiers, simulation.id).toEqual(cells?.[2].split(' / ')[1].split('/'))
      expect(simulation.sourceState.text, simulation.id).toBe(cells?.[5])
    }

    const datasetAudits = registry.items.filter(({ classification }) => classification === 'dataset-audit')
    expect(datasetAudits).toHaveLength(30)
    expect(datasetAudits.every(({ gateStates }) => ['pending', 'blocked'].includes(gateStates.G0b))).toBe(true)
    for (const simulation of registry.items) {
      if (G2A_REQUIRED_IDS.has(simulation.id)) expect(['pending', 'blocked']).toContain(simulation.gateStates.G2a)
      else expect(simulation.gateStates.G2a).toBe('not-applicable')
    }
  })

  it('runs all 130 kernels with clone-safe bounded defaults and finite JSON results', () => {
    const engineIds = [...SUPPORTED_EARTH_SIMULATION_IDS]
    const registryRunnableIds = registry.items.filter(({ runnable }) => runnable).map(({ id }) => id)
    expect(engineIds).toHaveLength(130)
    expect(new Set(engineIds).size).toBe(130)
    expect(EXECUTABLE_EARTH_SIMULATION_IDS).toEqual(engineIds)
    expect(registryRunnableIds).toEqual(engineIds)
    expect(Object.keys(DEFAULT_EARTH_SIMULATION_INPUTS)).toEqual(engineIds)

    const structuredDefaults = structuredClone(DEFAULT_EARTH_SIMULATION_INPUTS)
    const clonedDefaults = JSON.parse(JSON.stringify(structuredDefaults)) as Record<string, unknown>
    expect(clonedDefaults).toEqual(DEFAULT_EARTH_SIMULATION_INPUTS)
    const untypedRun = runEarthSimulation as (id: string, inputs: unknown) => { status: string }
    for (const id of engineIds) {
      const result = untypedRun(id, clonedDefaults[id])
      expect(result.status, `${id} must complete`).toBe('completed')
      expectFiniteJson(result, id)
      expect(() => JSON.parse(JSON.stringify(result))).not.toThrow()
    }
  }, 30_000)

  it('separates runnable comparison blockers from execution availability', () => {
    const comparisonIds = [...SUPPORTED_EARTH_SIMULATION_IDS].filter((id) => {
      const inputs = DEFAULT_EARTH_SIMULATION_INPUTS[id]
      return runEarthSimulation(id, inputs as never).provenance.kind === 'comparison'
    })
    expect(comparisonIds).toHaveLength(96)
    for (const id of comparisonIds) {
      const simulation = registry.items.find((item) => item.id === id)
      expect(simulation?.runnable).toBe(true)
      expect(['exploratory', 'blocked-source']).toContain(simulation?.scientificStatus)
      expect(simulation?.execution).not.toBe('blocked')
      expect(simulation?.gateStates).toMatchObject({ G0: 'pass', G1: 'pass', G4: 'not-evaluated', G5: 'not-evaluated' })
      expect(simulation?.gateStates.G2).not.toBe('pass')
      expect(simulation?.gateStates.G3).not.toBe('pass')
    }

    const literalAudit = registry.items.find(({ id }) => id === 'EARTH-FND-001')
    expect(literalAudit?.gateStates).toMatchObject({ G0: 'pass', G1: 'pass', G2: 'not-applicable', G3: 'not-applicable', G4: 'not-evaluated', G5: 'not-evaluated' })
    expect(registry.items.find(({ id }) => id === 'EARTH-GAL-005')).toMatchObject({
      runnable: true,
      scientificStatus: 'blocked-source',
      gateStates: expect.objectContaining({ G4: 'not-evaluated', G5: 'not-evaluated' }),
    })
    expect(registry.items.find(({ id }) => id === 'EARTH-GAL-005')?.blockers.length).toBeGreaterThan(0)
  })

  it('marks literal formula audits as reproductions', () => {
    const reproductions = [...SUPPORTED_EARTH_SIMULATION_IDS].filter((id) =>
      runEarthSimulation(id, DEFAULT_EARTH_SIMULATION_INPUTS[id] as never).provenance.kind === 'reproduction')
    expect(reproductions).toHaveLength(34)
    for (const id of ['EARTH-PLAN-010', 'EARTH-STAR-003', 'EARTH-STAR-008', 'EARTH-STAR-009'] as const) {
      expect(runEarthSimulation(id, DEFAULT_EARTH_SIMULATION_INPUTS[id]).provenance.kind).toBe('reproduction')
      expect(registry.items.find((item) => item.id === id)).toMatchObject({ runnable: true, scientificStatus: 'unresolved' })
    }
  })

  it('records explicitly consumed program dependencies without reversing producer links', () => {
    expect(registry.items.find(({ id }) => id === 'EARTH-GEO-002')?.dependencyIds).toEqual(['EARTH-GEO-001'])
    expect(registry.items.find(({ id }) => id === 'EARTH-SPEC-003')?.dependencyIds).toEqual(['EARTH-SPEC-002'])
    expect(registry.items.find(({ id }) => id === 'EARTH-FLD-010')?.dependencyIds).toEqual([])
    expect(registry.items.find(({ id }) => id === 'EARTH-PRT-003')?.dependencyIds).toContain('EARTH-FLD-010')
  })

  it('publishes completion for exact structure rather than scientific validation', async () => {
    expect(completion).toMatchObject({
      schemaVersion: 2,
      source: 130,
      registered: 130,
      sourceLinked: 130,
      implemented: SUPPORTED_EARTH_SIMULATION_IDS.length,
      runnable: SUPPORTED_EARTH_SIMULATION_IDS.length,
      blocked: 0,
      methods: declaredMethodCount,
      runnableMethods: 134,
      prefixes: 17,
      structuralCoverageExact: true,
      executableCoverageExact: true,
      scientificallyValidated: false,
      complete: true,
    })
    expect(completion.runnable).toBe(registry.summary.runnable)
    expect(completion.blocked).toBe(registry.summary.blocked)
    expect(completion.methods).toBe(registry.summary.totalMethods)
    expect(completion.runnableMethods).toBe(registry.summary.runnableMethods)

    const planText = await readFile(planPath, 'utf8')
    const rebuilt = buildEarthSimulationRegistry(planText, manifestJson)
    expect(rebuilt.registry).toEqual(registry)
    expect(rebuilt.completion).toEqual(completion)
    expect(() => buildEarthSimulationRegistry(planText.replace('| EARTH-FND-001 |', '| REMOVED-FND-001 |'), manifestJson)).toThrow('Expected 130 canonical EARTH rows')
  })
})
