import type { SimulationAssetManifest, SimulationAssetPartitionName } from './types'

export const simulationPartitionNames = ['shared', 'gmsh', 'separate-real', 'separate-complex', 'combined-real', 'combined-complex'] as const

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function verifySimulationManifest(value: unknown, contentVersion: string) {
  if (!value || typeof value !== 'object') throw new Error('invalid simulation manifest')
  const manifest = value as SimulationAssetManifest
  if (manifest.schema !== 5 || manifest.version !== contentVersion) throw new Error('invalid simulation manifest identity')
  if (!manifest.partitions || JSON.stringify(Object.keys(manifest.partitions).sort()) !== JSON.stringify([...simulationPartitionNames].sort())) throw new Error('invalid simulation partition set')
  const allPaths = new Set<string>()
  for (const name of simulationPartitionNames) await verifySimulationPartition(manifest, name, allPaths)
  return manifest
}

async function verifySimulationPartition(manifest: SimulationAssetManifest, name: SimulationAssetPartitionName, allPaths = new Set<string>()) {
  const partition = manifest.partitions[name]
  if (!partition || partition.name !== name || partition.cacheName !== `opensimphy-onelab-${manifest.version}-${name}` || !Array.isArray(partition.files)) throw new Error(`invalid ${name} simulation partition identity`)
  for (const file of partition.files) {
    if (!file || typeof file.path !== 'string' || !file.path.startsWith(`${manifest.version}/`) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`invalid ${name} simulation file metadata`)
    if (allPaths.has(file.path)) throw new Error(`duplicate simulation asset path: ${file.path}`)
    allPaths.add(file.path)
  }
  const digest = await sha256(new TextEncoder().encode(JSON.stringify(partition.files)))
  if (partition.fileMapDigest !== digest) throw new Error(`invalid ${name} simulation partition file-map digest`)
  return partition
}
