import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import claimsJson from '../../public/data/generated/earth/claims.json'
import codeJson from '../../public/data/generated/earth/code.json'
import formulasJson from '../../public/data/generated/earth/formulas.json'
import manifestJson from '../../public/data/generated/earth/manifest.json'
import simulationsJson from '../../public/data/generated/earth/simulations.json'
import sourceLockJson from '../../public/data/sources/earth-source-lock.json'
import { sanitizeMarkdown, verifyEarthSourceLock } from '../../scripts/lib/earth-corpus.mjs'

interface Ledger {
  count: number
  items: Array<Record<string, unknown>>
}

const manifest = manifestJson as typeof manifestJson
const claims = claimsJson as Ledger
const code = codeJson as Ledger
const formulas = formulasJson as Ledger
const simulations = simulationsJson as Ledger

describe('EARTH corpus registry', () => {
  it('pins every document to the clean source revision with stable unique routes', () => {
    expect(sourceLockJson.source.revision).toMatch(/^[a-f0-9]{40}$/)
    expect(manifest.sourceRevision).toBe(sourceLockJson.source.revision)
    expect(sourceLockJson.files).toHaveLength(63)
    expect(manifest.summary.documents).toBe(63)
    expect(new Set(manifest.documents.map(({ id }) => id)).size).toBe(63)
    expect(new Set(manifest.documents.map(({ slug }) => slug)).size).toBe(63)

    for (const document of manifest.documents) {
      expect(sourceLockJson.files).toContainEqual({
        path: document.source.path,
        sha256: document.source.sha256,
        bytes: document.source.bytes,
      })
      expect(document.dataUrl).toBe(`/data/generated/earth/documents/${document.slug}.json`)
    }
  })

  it('separates exact syntax inventories from unreviewed semantic candidates', () => {
    expect(manifest.summary).toEqual({
      documents: 63,
      sourceBytes: 612016,
      sourceLines: 11114,
      headings: 692,
      formulas: 2123,
      delimitedFormulas: 902,
      plainFormulaCandidates: 1221,
      claimCandidates: 122,
      codeBlocks: 153,
      simulationCandidates: 146,
      diagnostics: 1,
    })
    expect(formulas.count).toBe(manifest.summary.formulas)
    expect(claims.count).toBe(manifest.summary.claimCandidates)
    expect(code.count).toBe(manifest.summary.codeBlocks)
    expect(simulations.count).toBe(manifest.summary.simulationCandidates)
    expect(code.items.filter(({ language }) => language === 'python')).toHaveLength(148)
    expect(code.items.every(({ execution }) => execution === 'disabled')).toBe(true)
    expect(claims.items.every(({ validationStatus }) => validationStatus === 'unreviewed-source-claim')).toBe(true)
    expect(simulations.items.every(({ validationStatus }) => validationStatus === 'unreviewed-candidate')).toBe(true)
  })

  it('publishes inert lazy shards and preserves malformed-source diagnostics', async () => {
    const readme = manifest.documents.find(({ source }) => source.path === 'README.md')
    const theoryZero = manifest.documents.find(({ title }) => title === 'Theory-Zero')
    expect(readme).toBeDefined()
    expect(theoryZero?.counts.diagnostics).toBe(1)

    const shardPath = resolve('public', readme!.dataUrl.replace(/^\//, ''))
    const shard = JSON.parse(await readFile(shardPath, 'utf8')) as { document: { sanitizedMarkdown: string } }
    expect(shard.document.sanitizedMarkdown).not.toContain('<img')
    expect(shard.document.sanitizedMarkdown).toContain('&lt;img')
    expect(shard.document.sanitizedMarkdown).toContain('[Image omitted: License: CC BY-NC-SA 4.0]')
  })

  it('fails closed when source bytes drift and neutralizes active Markdown images', () => {
    const documents = [{ source: { path: 'README.md', sha256: 'actual', bytes: 1 } }]
    const lock = { schemaVersion: 1, files: [{ path: 'README.md', sha256: 'locked', bytes: 1 }] }
    expect(() => verifyEarthSourceLock(documents, lock)).toThrow('changed file README.md')
    expect(sanitizeMarkdown('![plot](https://example.test/plot.png)')).toBe('[Image omitted: plot](https://example.test/plot.png)')
  })
})
