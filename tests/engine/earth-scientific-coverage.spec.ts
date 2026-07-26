import codeJson from '../../public/data/generated/earth/code.json'
import coverageJson from '../../public/data/generated/earth/scientific-coverage.json'
import formulasJson from '../../public/data/generated/earth/formulas.json'
import manifestJson from '../../public/data/generated/earth/manifest.json'
import registryJson from '../../public/data/generated/earth/scientific-simulations.json'
import simulationsJson from '../../public/data/generated/earth/simulations.json'

type Assignment = {
  sourceType: string
  sourceId: string
  documentId: string
  owner: string
  ownerType: 'canonical-program' | 'classification'
  assignmentBasis: string[]
  confidence: 'high' | 'medium' | 'low'
  sourceIds: {
    documentId: string
    codeBlockId?: string
  }
}

const coverage = coverageJson as unknown as {
  summary: {
    formulaRecords: number
    codeBlocks: number
    simulationCandidates: number
    sourceRecords: number
    assignments: number
    canonicalProgramAssignments: number
    classifiedAssignments: number
    classifications: Record<string, number>
    lowConfidence: number
    exact: boolean
    formulas: { assigned: number }
    code: { assigned: number }
    simulations: { assigned: number }
  }
  formulas: Assignment[]
  code: Assignment[]
  simulations: Assignment[]
}

const assignments = [...coverage.formulas, ...coverage.code, ...coverage.simulations]

function documentId(titleStart: string) {
  const document = manifestJson.documents.find(({ title }) => title.startsWith(titleStart))
  expect(document).toBeDefined()
  return document!.id
}

function canonicalOwnersFor(titleStart: string, records: Assignment[] = assignments) {
  const id = documentId(titleStart)
  return new Set(records.filter(({ documentId, ownerType }) => documentId === id && ownerType === 'canonical-program').map(({ owner }) => owner))
}

describe('EARTH scientific formula-to-program coverage', () => {
  it('publishes exact source and assignment totals without count drift', () => {
    expect(coverage.summary).toMatchObject({
      formulaRecords: 2123,
      codeBlocks: 153,
      simulationCandidates: 146,
      sourceRecords: 2422,
      assignments: 2422,
      canonicalProgramAssignments: 1984,
      classifiedAssignments: 438,
      classifications: {
        duplicate: 432,
        'blocked-source-fragment': 1,
        'non-scientific-example': 5,
      },
      lowConfidence: 161,
      exact: true,
      formulas: { assigned: 2123 },
      code: { assigned: 153 },
      simulations: { assigned: 146 },
    })
    expect(coverage.formulas).toHaveLength(formulasJson.count)
    expect(coverage.code).toHaveLength(codeJson.count)
    expect(coverage.simulations).toHaveLength(simulationsJson.count)
  })

  it('assigns every source ID exactly once', () => {
    const sourceIds = [
      ...formulasJson.items.map(({ id }) => id),
      ...codeJson.items.map(({ id }) => id),
      ...simulationsJson.items.map(({ id }) => id),
    ]
    const assignmentIds = assignments.map(({ sourceId }) => sourceId)

    expect(new Set(sourceIds).size).toBe(2422)
    expect(new Set(assignmentIds).size).toBe(2422)
    expect([...assignmentIds].sort()).toEqual([...sourceIds].sort())
    expect(assignments.every(({ sourceIds, documentId }) => sourceIds.documentId === documentId)).toBe(true)
  })

  it('uses only canonical registry IDs or the three closed classifications', () => {
    const canonicalIds = new Set(registryJson.items.map(({ id }) => id))
    const classifications = new Set(['duplicate', 'blocked-source-fragment', 'non-scientific-example'])

    for (const assignment of assignments) {
      if (assignment.ownerType === 'canonical-program') expect(canonicalIds.has(assignment.owner)).toBe(true)
      else expect(classifications.has(assignment.owner)).toBe(true)
      expect(assignment.assignmentBasis.length).toBeGreaterThan(0)
      expect(['high', 'medium', 'low']).toContain(assignment.confidence)
    }
  })

  it('maps representative chemistry and planetary sources to semantic program families', () => {
    expect(canonicalOwnersFor('Theorem CHEM-3')).toEqual(new Set(['EARTH-CHEM-002']))
    expect(canonicalOwnersFor('Theorem CHEM-6')).toEqual(new Set(['EARTH-SPEC-001']))
    expect(canonicalOwnersFor('Theorem PLANET-3')).toEqual(new Set(['EARTH-PLAN-010']))
    expect(canonicalOwnersFor('Theorem PLANET-6')).toEqual(new Set(['EARTH-PLAN-008']))
  })

  it('maps named field sources and preserves code-block linkage', () => {
    expect(canonicalOwnersFor('Quantum Superposition')).toEqual(new Set(['EARTH-FLD-005']))
    expect(canonicalOwnersFor('Topological Surgery Barrier')).toEqual(new Set(['EARTH-FLD-007']))

    const codeById = new Map(codeJson.items.map((block) => [block.id, block]))
    for (const assignment of coverage.simulations) {
      const source = simulationsJson.items.find(({ id }) => id === assignment.sourceId)
      const block = codeById.get(source!.codeBlockId)
      expect(block).toBeDefined()
      expect(assignment.sourceIds.codeBlockId).toBe(block!.id)
      expect(block!.documentId).toBe(assignment.documentId)
      expect(assignment.assignmentBasis).toContain(`linked-code-block:${block!.id}`)
    }
  })
})
