import { createHash } from 'node:crypto'
import scanInput from '../../data/fiddles/chenopdodium-profile-scan.jsonl?raw'
import registryJson from '../../public/data/generated/fiddles/registry.json'
import { buildFiddleRegistry } from '../../scripts/generate-fiddle-registry.mjs'
import { parseFiddleRegistry } from '../../src/registries/fiddleRegistry'
import type { FiddleRegistry } from '../../src/types/fiddle'

const registry = parseFiddleRegistry(registryJson)

function copyRegistry(): FiddleRegistry {
  return structuredClone(registry)
}

describe('JSFiddle archive registry', () => {
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
