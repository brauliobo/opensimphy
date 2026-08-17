import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const loadSets = {
  'combined-real': ['shared', 'combined-real'],
  'combined-real+complex': ['shared', 'combined-real', 'combined-complex'],
  'separate-real': ['shared', 'gmsh', 'separate-real'],
  'separate-real+complex': ['shared', 'gmsh', 'separate-real', 'separate-complex'],
}

describe('generated browser profile measurements', () => {
  it('matches the exact current staged manifest and generated documentation', async () => {
    await expect(execFileAsync(process.execPath, ['tools/wasm/verify-profile-measurements.mjs'])).resolves.toMatchObject({
      stdout: expect.stringContaining('verified profile evidence sources and documentation for 8b4dd5c93e4141bd5be9'),
    })
  })

  it('defines cumulative load sets as the manifest plus complete browser-fetched partitions', async () => {
    const report = JSON.parse(await readFile('tools/wasm/profile-measurements.json', 'utf8'))
    const manifest = JSON.parse(await readFile('public/simulation/manifest.json', 'utf8'))
    const docs = await readFile('docs/wasm-toolchain.md', 'utf8')
    expect(report.contentVersion).toBe('8b4dd5c93e4141bd5be9')
    for (const [name, partitions] of Object.entries(loadSets)) {
      const expectedPaths = ['manifest.json', ...partitions.flatMap((partition) => manifest.partitions[partition].files.map(({ path }: { path: string }) => path))]
      expect(report.measurements[name].partitions).toEqual(partitions)
      expect(report.measurements[name].filePaths).toEqual(expectedPaths)
      expect(report.measurements[name].files).toBe(expectedPaths.length)
    }
    expect(docs).toContain(`Measured from content version \`${report.contentVersion}\``)
    expect(docs).toContain(`| Combined real | ${report.measurements['combined-real'].files} | ${report.measurements['combined-real'].rawBytes.toLocaleString('en-US')} |`)
  })
})
