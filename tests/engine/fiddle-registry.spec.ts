import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import scanInput from '../../data/fiddles/chenopdodium-profile-scan.jsonl?raw'
import registryJson from '../../public/data/generated/fiddles/registry.json'
import runtimeJson from '../../public/data/generated/fiddles/runtime-verification.json'
import { consolidateFiddleRuntime, validateEvidenceUnicode } from '../../scripts/consolidate-fiddle-runtime.mjs'
import { buildFiddleRegistry } from '../../scripts/generate-fiddle-registry.mjs'
import { parseFiddleRegistry } from '../../src/registries/fiddleRegistry'
import { parseFiddleRuntimeLedger } from '../../src/registries/fiddleRuntime'
import type { FiddleRegistry } from '../../src/types/fiddle'

const registry = parseFiddleRegistry(registryJson)
const runtime = parseFiddleRuntimeLedger(runtimeJson, registry)
const evidencePaths = [
  '../../data/fiddles/runtime/chenopdodium-runtime-001-195.json',
  '../../data/fiddles/runtime/chenopdodium-runtime-196-390.json',
  '../../data/fiddles/runtime/chenopdodium-runtime-391-585.json',
  '../../data/fiddles/runtime/chenopdodium-runtime-586-780.json',
].map((path) => resolve(import.meta.dirname, path))

function copyRegistry(): FiddleRegistry {
  return structuredClone(registry)
}

describe('JSFiddle archive registry', () => {
  it('associates all runtime records and exact aggregate counts to the registry', () => {
    expect(runtime.registry).toMatchObject({ sourceRevision: registry.source.sourceRevision, recordCount: 780 })
    expect(runtime.aggregate).toEqual({
      verified: 710,
      'rendered-with-errors': 28,
      empty: 17,
      blocked: 0,
      timeout: 25,
      failed: 0,
      total: 780,
      scientificallyValidated: 0,
    })
    expect(runtime.records).toHaveLength(780)
    expect(runtime.records.every((record, index) => record.slug === registry.records[index]!.slug)).toBe(true)
  })

  it('fails closed when runtime identity, source revision, or counts drift', () => {
    const badIdentity = structuredClone(runtimeJson)
    badIdentity.records[0]!.slug = 'wrong-slug'
    expect(() => parseFiddleRuntimeLedger(badIdentity, registry)).toThrow(/associated registry record/)

    const badRevision = structuredClone(runtimeJson)
    badRevision.registry.sourceRevision = '0'.repeat(64)
    expect(() => parseFiddleRuntimeLedger(badRevision, registry)).toThrow(/sourceRevision/)

    const badCount = structuredClone(runtimeJson)
    badCount.aggregate.verified -= 1
    expect(() => parseFiddleRuntimeLedger(badCount, registry)).toThrow(/aggregate\.verified/)

    const badEvidenceHash = structuredClone(runtimeJson)
    badEvidenceHash.environment.batches[0]!.sha256 = 'not-a-sha256'
    expect(() => parseFiddleRuntimeLedger(badEvidenceHash, registry)).toThrow(/batches\[0\]\.sha256/)
  })

  it('regenerates the checked-in runtime ledger exactly from the four committed evidence files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'opensimphy-fiddle-runtime-'))
    const outputPath = join(directory, 'runtime-verification.json')
    try {
      const regenerated = await consolidateFiddleRuntime({
        registryPath: resolve(import.meta.dirname, '../../public/data/generated/fiddles/registry.json'),
        batchPaths: evidencePaths,
        outputPath,
      })
      const written = JSON.parse(await readFile(outputPath, 'utf8'))

      expect(regenerated).toEqual(runtimeJson)
      expect(written).toEqual(runtimeJson)
      await Promise.all(evidencePaths.map(async (path, index) => {
        const hash = createHash('sha256').update(await readFile(path)).digest('hex')
        expect(runtime.environment.batches[index]!.sha256).toBe(hash)
      }))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects unpaired UTF-16 surrogates in retained evidence strings', () => {
    expect(() => validateEvidenceUnicode({ diagnostic: `truncated ${String.fromCharCode(0xd835)}` })).toThrow(/unpaired UTF-16 surrogate/)
    expect(() => validateEvidenceUnicode({ diagnostic: 'valid scalar text 𝑢' })).not.toThrow()
  })

  it('accepts the checked-in 780-record, 16-page artifact', () => {
    expect(registry).toMatchObject({
      schemaVersion: 1,
      source: {
        platform: 'jsfiddle',
        author: 'Chenopdodium',
        profileUrl: 'https://jsfiddle.net/u/Chenopdodium/fiddles/',
        profilePages: 16,
        recordCount: 780,
      },
    })
    expect(registry.records).toHaveLength(780)
    expect(new Set(registry.records.map(({ page }) => page))).toEqual(new Set(Array.from({ length: 16 }, (_, index) => index + 1)))
  })

  it('regenerates the checked-in artifact from the committed scan input', () => {
    const sourceRevision = createHash('sha256').update(scanInput).digest('hex')
    const regenerated = parseFiddleRegistry(buildFiddleRegistry(scanInput, sourceRevision))

    expect(regenerated.source.sourceRevision).toBe(registry.source.sourceRevision)
    expect(regenerated.source).toMatchObject({ recordCount: 780, profilePages: 16 })
    expect(regenerated.records).toHaveLength(780)
  })

  it('keeps pastie IDs, slugs, and JSFiddle URLs canonical and unique', () => {
    expect(new Set(registry.records.map(({ pastieId }) => pastieId)).size).toBe(780)
    expect(new Set(registry.records.map(({ slug }) => slug)).size).toBe(780)
    for (const record of registry.records) {
      const path = `${record.slug}/${record.version > 0 ? `${record.version}/` : ''}`
      expect(record.sourceUrl).toBe(`https://jsfiddle.net/Chenopdodium/${path}`)
      expect(record.embedUrl).toBe(`https://jsfiddle.net/Chenopdodium/${path}show/`)
    }
    expect(registry.records[0]).toMatchObject({
      version: 0,
      sourceUrl: 'https://jsfiddle.net/Chenopdodium/wqoycabp/',
      embedUrl: 'https://jsfiddle.net/Chenopdodium/wqoycabp/show/',
    })
  })

  it('rejects count, identity, URL, and flag corruption', () => {
    const badCount = copyRegistry()
    badCount.source.recordCount -= 1
    expect(() => parseFiddleRegistry(badCount)).toThrow(/recordCount/)

    const duplicate = copyRegistry()
    duplicate.records[1]!.pastieId = duplicate.records[0]!.pastieId
    expect(() => parseFiddleRegistry(duplicate)).toThrow(/pastieId/)

    const unsafeUrl = copyRegistry()
    unsafeUrl.records[0]!.sourceUrl = 'http://jsfiddle.net/Chenopdodium/wqoycabp/0/'
    expect(() => parseFiddleRegistry(unsafeUrl)).toThrow(/sourceUrl/)

    const invalidPage = copyRegistry()
    invalidPage.records[0]!.page = 17
    expect(() => parseFiddleRegistry(invalidPage)).toThrow(/page/)

    const invalidVersion = copyRegistry()
    invalidVersion.records[0]!.version = -1
    expect(() => parseFiddleRegistry(invalidVersion)).toThrow(/version/)

    const invalidFlag = copyRegistry()
    invalidFlag.records[0]!.flags.webgl = 1 as unknown as boolean
    expect(() => parseFiddleRegistry(invalidFlag)).toThrow(/flags\.webgl/)
  })
})
