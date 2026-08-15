import { createHash } from 'node:crypto'
import { simulationPartitionNames, verifySimulationManifest } from '../../src/simulation/asset-manifest'
import type { SimulationAssetManifest, SimulationAssetPartitionName } from '../../src/simulation/types'

const version = '8b4dd5c93e4141bd5be9'
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function validManifest() {
  const partitions = Object.fromEntries(simulationPartitionNames.map((name, index) => {
    const files = [{ path: `${version}/${name}/asset-${index}.wasm`, bytes: index + 1, sha256: 'a'.repeat(64) }]
    return [name, { name, cacheName: `opensimphy-onelab-${version}-${name}`, fileMapDigest: digest(files), files }]
  })) as Record<SimulationAssetPartitionName, SimulationAssetManifest['partitions'][SimulationAssetPartitionName]>
  return { schema: 5, version, scalarTypes: ['real-double', 'complex-double'], revisions: {}, partitions } satisfies SimulationAssetManifest
}

describe('shared simulation manifest verification', () => {
  it('accepts the current schema, lock version, exact partition identities and file-map digests', async () => {
    await expect(verifySimulationManifest(validManifest(), version)).resolves.toMatchObject({ schema: 5, version })
  })

  it.each([
    ['schema', (manifest: any) => { manifest.schema = 4 }],
    ['content version', (manifest: any) => { manifest.version = 'stale' }],
    ['partition set', (manifest: any) => { delete manifest.partitions.shared }],
    ['partition name', (manifest: any) => { manifest.partitions.shared.name = 'gmsh' }],
    ['cache identity', (manifest: any) => { manifest.partitions.shared.cacheName += '-stale' }],
    ['file-map digest', (manifest: any) => { manifest.partitions.shared.fileMapDigest = '0'.repeat(64) }],
  ])('rejects invalid %s', async (_, mutate) => {
    const manifest = validManifest()
    mutate(manifest)
    await expect(verifySimulationManifest(manifest, version)).rejects.toThrow()
  })

  it('rejects duplicate files across partitions and paths outside the locked version', async () => {
    const duplicate = validManifest()
    duplicate.partitions.gmsh.files[0] = { ...duplicate.partitions.shared.files[0] }
    duplicate.partitions.gmsh.fileMapDigest = digest(duplicate.partitions.gmsh.files)
    await expect(verifySimulationManifest(duplicate, version)).rejects.toThrow('duplicate')

    const foreign = validManifest()
    foreign.partitions.shared.files[0].path = `foreign/${foreign.partitions.shared.files[0].path}`
    foreign.partitions.shared.fileMapDigest = digest(foreign.partitions.shared.files)
    await expect(verifySimulationManifest(foreign, version)).rejects.toThrow('file metadata')
  })
})
