import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import code from '../../public/data/generated/earth/code.json'
import coverage from '../../public/data/generated/earth/scientific-coverage.json'
import datasets from '../../public/data/generated/earth/datasets.json'
import evidenceManifest from '../../public/data/generated/earth/evidence/manifest.json'
import prt001Evidence from '../../public/data/generated/earth/evidence/programs/EARTH-PRT-001.json'
import formulas from '../../public/data/generated/earth/formulas.json'
import manifest from '../../public/data/generated/earth/manifest.json'
import registry from '../../public/data/generated/earth/scientific-simulations.json'
import simulations from '../../public/data/generated/earth/simulations.json'
import { buildEarthEvidenceArtifacts } from '../../scripts/lib/earth-evidence.mjs'
import { parseEarthEvidenceManifest, parseEarthProgramEvidence } from '../../src/earth/evidence'

const evidenceRoot = resolve(process.cwd(), 'public/data/generated/earth/evidence')

async function jsonFiles(directory: string): Promise<Array<Record<string, unknown>>> {
  const root = resolve(evidenceRoot, directory)
  const files = (await readdir(root)).filter((name) => name.endsWith('.json')).sort()
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8')) as Record<string, unknown>))
}

describe('EARTH compact evidence artifacts', () => {
  it('rebuilds deterministically from the four owning registries', () => {
    const rebuilt = buildEarthEvidenceArtifacts({ manifest, coverage, registry, datasets })

    expect(rebuilt.manifest).toEqual(evidenceManifest)
    expect(rebuilt.programShards).toHaveLength(130)
    expect(rebuilt.documentShards).toHaveLength(63)
    expect(JSON.stringify(buildEarthEvidenceArtifacts({ manifest, coverage, registry, datasets }))).toBe(JSON.stringify(rebuilt))
  })

  it('publishes all shards and covers every one of the 2,422 source records exactly once', async () => {
    const [programShards, documentShards] = await Promise.all([jsonFiles('programs'), jsonFiles('documents')])
    const canonicalIds = programShards.flatMap((shard) => (shard.assignments as Array<{ sourceId: string }>).map(({ sourceId }) => sourceId))
    const classifiedIds = documentShards.flatMap((shard) => (shard.classifiedRecords as Array<{ sourceId: string }>).map(({ sourceId }) => sourceId))
    const sourceIds = [
      ...formulas.items.map(({ id }) => id),
      ...code.items.map(({ id }) => id),
      ...simulations.items.map(({ id }) => id),
    ]

    expect(programShards).toHaveLength(130)
    expect(documentShards).toHaveLength(63)
    expect(canonicalIds).toHaveLength(1984)
    expect(classifiedIds).toHaveLength(438)
    expect(new Set([...canonicalIds, ...classifiedIds]).size).toBe(2422)
    expect([...canonicalIds, ...classifiedIds].sort()).toEqual(sourceIds.sort())
  })

  it('keeps every program, document, dataset, dispute, and classification reference closed', async () => {
    const [programShards, documentShards] = await Promise.all([jsonFiles('programs'), jsonFiles('documents')])
    const programIds = new Set(registry.items.map(({ id }) => id))
    const documentIds = new Set(manifest.documents.map(({ id }) => id))
    const datasetIds = new Set(datasets.datasets.map(({ datasetId }) => datasetId))
    const disputeIds = new Set(datasets.disputedClaims.map(({ claimId }) => claimId))
    const classifications = new Set(['duplicate', 'blocked-source-fragment', 'non-scientific-example'])

    for (const shard of programShards) {
      expect(programIds.has(shard.programId as string)).toBe(true)
      expect((shard.linkedDocumentIds as string[]).every((id) => documentIds.has(id))).toBe(true)
      expect((shard.linkedDatasetIds as string[]).every((id) => datasetIds.has(id))).toBe(true)
      expect((shard.disputedClaimIds as string[]).every((id) => disputeIds.has(id))).toBe(true)
    }
    for (const shard of documentShards) {
      expect(documentIds.has((shard.document as { id: string }).id)).toBe(true)
      expect((shard.canonicalPrograms as Array<{ programId: string }>).every(({ programId }) => programIds.has(programId))).toBe(true)
      expect((shard.classifiedRecords as Array<{ classification: string }>).every(({ classification }) => classifications.has(classification))).toBe(true)
    }
  })

  it('keeps evidence shards lazy and bounded while excluding full scientific coverage', async () => {
    const config = await readFile(resolve(process.cwd(), 'vite.config.ts'), 'utf8')

    expect(config).toContain("'data/generated/earth/evidence/programs/**/*.json'")
    expect(config).toContain("'data/generated/earth/evidence/documents/**/*.json'")
    expect(config).toContain("'data/generated/earth/scientific-coverage.json'")
    expect(config).toContain("cacheName: 'opensimphy-earth-evidence-shards'")
    expect(config).toContain('expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 30 }')
  })

  it('fails closed on schema, revision, and shard reference drift', () => {
    const parsedManifest = parseEarthEvidenceManifest(evidenceManifest, manifest.sourceRevision, {
      programIds: registry.items.map(({ id }) => id),
      documentIds: manifest.documents.map(({ id }) => id),
    })
    const entry = parsedManifest.programs.find(({ id }) => id === 'EARTH-PRT-001')!

    const extra = structuredClone(evidenceManifest) as unknown as Record<string, unknown>
    extra.unexpected = true
    expect(() => parseEarthEvidenceManifest(extra)).toThrow('expected exactly these fields')
    expect(() => parseEarthEvidenceManifest(evidenceManifest, '0000000000000000000000000000000000000000')).toThrow('does not match the source registry')
    expect(() => parseEarthProgramEvidence(prt001Evidence, entry, parsedManifest, {
      documentIds: manifest.documents.map(({ id }) => id),
      datasetIds: [],
      disputedClaimIds: datasets.disputedClaims.map(({ claimId }) => claimId),
    })).toThrow('unknown reference earth-dataset-codata-recommended-values')
  })
})
