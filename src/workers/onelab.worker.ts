/// <reference lib="webworker" />

import type { FieldSample, LoopControlResponse, MicrostripResult, OnelabWorkerRequest, OnelabWorkerResponse, ProjectBootstrap, ProjectDescriptor, ProjectEnvelope, ProjectFile, ProjectResponse, SimulationAssetManifest, SimulationAssetPartition, SimulationAssetPartitionName, ViewBlock } from '../simulation/types'
import { callGetdpWithDatabase, canonicalizeOnelab, mergeValidatedValues, parseOnelab, setParameterValue, validateReadOnlyValues } from '../simulation/onelab-db'
import { certifyConvergence } from '../simulation/convergence'
import { canonicalMshRecords } from '../simulation/msh'
import { sceneTransferables, surfaceSignatures, type ElementBlock, type ModelEntity, type PhysicalGroup, type SimulationScene } from '../simulation/scene'
import { complexFieldRepresentations, expandHomogeneousModelStep, parsePosTimes, normalizeListView, normalizeModelView, type ModelViewStep } from '../simulation/view-normalizer'
import { projectDescriptor } from '../simulation/project-catalog'
import { OnelabWorkerScheduler } from '../simulation/worker-scheduler'
import artifactLock from '../../tools/wasm/artifacts.lock.json'
import { maximumLoopPoints } from '../simulation/loops'
import { verifySimulationManifest } from '../simulation/asset-manifest'

const worker = self as unknown as DedicatedWorkerGlobalScope
const root = new URL(`${import.meta.env.BASE_URL}simulation/`, worker.location.origin)
const workerId = crypto.randomUUID()
const publicationLock = 'opensimphy-onelab-publication'
const scheduler = new OnelabWorkerScheduler()
const logs: string[] = []
let manifest: SimulationAssetManifest | undefined
const partitionAssets = new Map<SimulationAssetPartitionName, Map<string, Uint8Array>>()
let gmsh: any
let getdp: any
let complexGetdp: any
let combinedReal: any
let combinedComplex: any
const startupMilliseconds = new Map<ProjectDescriptor['scalarType'], number>()
const residentModules = new Map<string, { module: any; startupMilliseconds: number }>()
const baselineWasmMemory = new Map<string, number>()
const runtimeProfile = import.meta.env.VITE_ONELAB_PROFILE === 'separate' ? 'separate' : 'combined'

function registerModule(name: string, module: any, started: number) {
  residentModules.set(name, { module, startupMilliseconds: performance.now() - started })
}

function residentModuleMetrics() {
  const buffers = new Set<object>()
  const moduleStartupMilliseconds: Record<string, number> = {}
  const moduleWasmMemoryBytes: Record<string, number> = {}
  let wasmMemoryBytes = 0
  for (const [name, resident] of [...residentModules].sort(([left], [right]) => left.localeCompare(right))) {
    const buffer = resident.module.wasmMemory.buffer as object & { byteLength: number }
    moduleStartupMilliseconds[name] = resident.startupMilliseconds
    moduleWasmMemoryBytes[name] = buffer.byteLength
    if (!buffers.has(buffer)) {
      buffers.add(buffer)
      wasmMemoryBytes += buffer.byteLength
    }
  }
  const residentSet = [...residentModules.keys()].sort().join(',')
  const baseline = baselineWasmMemory.get(residentSet) ?? wasmMemoryBytes
  baselineWasmMemory.set(residentSet, baseline)
  return { moduleStartupMilliseconds, moduleWasmMemoryBytes, wasmMemoryBytes, repeatRunGrowthBytes: wasmMemoryBytes - baseline }
}

function emit(message: OnelabWorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(message, transfer)
}

async function digest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function canonicalNativeDatabase(json: string) {
  return canonicalizeOnelab(json)
}

async function verifiedResponse(response: Response, file: { path: string; bytes: number; sha256: string }) {
  if (!response.ok) throw new Error(`simulation asset ${file.path}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== file.bytes) throw new Error(`simulation asset ${file.path}: expected ${file.bytes} bytes, got ${bytes.byteLength}`)
  const actual = await digest(bytes)
  if (actual !== file.sha256) throw new Error(`simulation asset ${file.path}: SHA256 mismatch`)
  return new Response(bytes, { headers: response.headers, status: 200 })
}

function cacheIdentity(next: SimulationAssetManifest, partition: SimulationAssetPartition) {
  return { version: next.version, name: partition.name, cacheName: partition.cacheName, fileMapDigest: partition.fileMapDigest, files: partition.files }
}

async function completeCache(next: SimulationAssetManifest, partition: SimulationAssetPartition, cache: Cache) {
  const markerUrl = new URL(`${next.version}/${partition.name}.complete.json`, root).href
  const manifestUrl = new URL('manifest.json', root).href
  const marker = await cache.match(markerUrl)
  if (!marker) return false
  try {
    if (JSON.stringify(await marker.json()) !== JSON.stringify(cacheIdentity(next, partition))) return false
    const expectedUrls = [manifestUrl, markerUrl, ...partition.files.map((file) => new URL(file.path, root).href)].sort()
    const actualUrls = (await cache.keys()).map((request) => request.url).sort()
    if (JSON.stringify(actualUrls) !== JSON.stringify(expectedUrls)) return false
    const cachedManifest = await cache.match(manifestUrl)
    if (!cachedManifest || JSON.stringify(await cachedManifest.json()) !== JSON.stringify(next)) return false
    for (const file of partition.files) {
      const response = await cache.match(new URL(file.path, root).href)
      if (!response) return false
      await verifiedResponse(response, file)
    }
    return true
  } catch {
    return false
  }
}

async function cacheSnapshot(next: SimulationAssetManifest, partition: SimulationAssetPartition) {
  const cache = await caches.open(partition.cacheName)
  if (!await completeCache(next, partition, cache)) return undefined
  const snapshot = new Map<string, Uint8Array>()
  for (const file of partition.files) {
    const response = await cache.match(new URL(file.path, root).href)
    if (!response) return undefined
    snapshot.set(file.path, new Uint8Array(await (await verifiedResponse(response, file)).arrayBuffer()))
  }
  return snapshot
}

async function populateCache(next: SimulationAssetManifest, partition: SimulationAssetPartition) {
  const finalName = partition.cacheName
  const stagingName = `${finalName}-staging-${workerId}`
  const existing = await navigator.locks.request(publicationLock, { mode: 'shared' }, () => cacheSnapshot(next, partition))
  if (existing) return existing
  const staging = await caches.open(stagingName)
  try {
    for (const file of partition.files) {
      const url = new URL(file.path, root).href
      const stagingUrl = new URL(url)
      stagingUrl.searchParams.set('stage', workerId)
      const response = await verifiedResponse(await fetch(stagingUrl, { cache: 'no-store' }), file)
      await staging.put(url, response)
    }
    const publish = async () => {
      const current = await cacheSnapshot(next, partition)
      if (current) return current
      await caches.delete(finalName)
      const final = await caches.open(finalName)
      try {
        for (const file of partition.files) {
          const url = new URL(file.path, root).href
          const response = await staging.match(url)
          if (!response) throw new Error(`staging cache lost ${url}`)
          await final.put(url, response)
        }
        await final.put(new URL('manifest.json', root).href, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }))
        await final.put(new URL(`${next.version}/${partition.name}.complete.json`, root).href, new Response(JSON.stringify(cacheIdentity(next, partition))))
        const published = await cacheSnapshot(next, partition)
        if (!published) throw new Error(`published cache ${finalName} is incomplete`)
        for (const name of await caches.keys()) {
          if (name.startsWith('opensimphy-onelab-') && !name.includes('-staging-') && !name.startsWith(`opensimphy-onelab-${next.version}-`)) await caches.delete(name)
        }
        return published
      } catch (error) {
        await caches.delete(finalName)
        throw error
      }
    }
    return await navigator.locks.request(publicationLock, { mode: 'exclusive' }, publish)
  } finally {
    await caches.delete(stagingName)
  }
}

async function fetchAsset(path: string) {
  if (!manifest) throw new Error('simulation manifest is not loaded')
  const partition = Object.values(manifest.partitions).find(({ files }) => files.some((entry) => entry.path.endsWith(`/${path}`)))
  const file = partition?.files.find((entry) => entry.path.endsWith(`/${path}`))
  if (!file) throw new Error(`asset ${path} is absent from the manifest`)
  const bytes = partitionAssets.get(partition!.name)?.get(file.path)
  if (!bytes) throw new Error(`verified asset ${path} is absent from the initialized snapshot`)
  return new Response(bytes)
}

async function fetchBytes(path: string) {
  return new Uint8Array(await (await fetchAsset(path)).arrayBuffer())
}

async function initializeModules() {
  const started = performance.now()
  const realPartition = runtimeProfile === 'combined' ? 'combined-real' : 'separate-real'
  const requiredPartitions: SimulationAssetPartitionName[] = runtimeProfile === 'combined'
    ? ['shared', realPartition]
    : ['shared', 'gmsh', realPartition]
  if (gmsh && getdp && manifest && requiredPartitions.every((name) => partitionAssets.has(name))) return
  let response: Response | undefined
  try { response = await fetch(new URL('manifest.json', root), { cache: 'no-store' }) } catch { /* offline recreation */ }
  if (!response) {
    const offline = await navigator.locks.request(publicationLock, { mode: 'shared' }, async () => {
      for (const name of await caches.keys()) {
        if (!name.startsWith('opensimphy-onelab-') || name.includes('-staging-')) continue
        const candidate = await (await caches.open(name)).match(new URL('manifest.json', root).href)
        if (!candidate) continue
        const candidateManifest = await candidate.clone().json() as SimulationAssetManifest
        try { await verifySimulationManifest(candidateManifest, artifactLock.contentVersion) } catch { continue }
        const snapshots = await Promise.all(requiredPartitions.map(async (partition) => [partition, await cacheSnapshot(candidateManifest, candidateManifest.partitions[partition])] as const))
        if (snapshots.every(([, snapshot]) => snapshot)) return { response: candidate, snapshots }
      }
    })
    response = offline?.response
    for (const [partition, snapshot] of offline?.snapshots ?? []) partitionAssets.set(partition, snapshot!)
  }
  if (!response) throw new Error('simulation manifest is unavailable online and no complete cache exists')
  if (!response.ok) throw new Error(`simulation manifest: HTTP ${response.status}`)
  const next = await verifySimulationManifest(await response.json(), artifactLock.contentVersion)
  for (const name of requiredPartitions) if (!partitionAssets.has(name)) partitionAssets.set(name, await populateCache(next, next.partitions[name]))
  manifest = next

  const moduleUrl = (source: string) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  if (runtimeProfile === 'combined') {
    const entryUrl = moduleUrl(await (await fetchAsset('combined-real/combined.mjs')).text())
    const gmshRuntimeUrl = moduleUrl(await (await fetchAsset('combined-real/runtime.mjs')).text())
    const descriptorUrl = moduleUrl(await (await fetchAsset('combined-real/gmsh-descriptor.mjs')).text())
    const combinedRuntimeUrl = moduleUrl(await (await fetchAsset('combined-real/combined-runtime.mjs')).text())
    const [{ default: createCombinedModule }, { buildApi }, { default: descriptor }, { createCombinedRuntime }] = await Promise.all([
      import(/* @vite-ignore */ entryUrl), import(/* @vite-ignore */ gmshRuntimeUrl), import(/* @vite-ignore */ descriptorUrl), import(/* @vite-ignore */ combinedRuntimeUrl),
    ])
    const moduleStarted = performance.now()
    const module = await createCombinedModule({
      wasmBinary: await fetchBytes('combined-real/combined.wasm'), locateFile: () => new URL('unused.wasm', root).href,
      print: (line: string) => logs.push(`[combined-real] ${line}`), printErr: (line: string) => logs.push(`[combined-real:err] ${line}`),
    })
    registerModule('combined-real', module, moduleStarted)
    combinedReal = createCombinedRuntime(module, buildApi, descriptor)
    gmsh = combinedReal
    getdp = combinedReal.solver
    gmsh.initialize()
    startupMilliseconds.set('real-double', performance.now() - started)
    return
  }
  const gmshCoreUrl = moduleUrl(await (await fetchAsset('gmsh/gmsh-core.mjs')).text())
  const gmshRuntimeUrl = moduleUrl(await (await fetchAsset('gmsh/runtime.mjs')).text())
  const gmshDescriptorUrl = moduleUrl(await (await fetchAsset('gmsh/gmsh-descriptor.mjs')).text())
  const gmshEntrySource = await (await fetchAsset('gmsh/gmsh.mjs')).text()
  const gmshEntryUrl = moduleUrl(gmshEntrySource
    .replace('./gmsh-core.mjs', gmshCoreUrl)
    .replace('./runtime.mjs', gmshRuntimeUrl)
    .replace('./gmsh-descriptor.mjs', gmshDescriptorUrl))
  const getdpEntryUrl = moduleUrl(await (await fetchAsset('getdp/getdp.mjs')).text())
  const getdpRuntimeUrl = moduleUrl(await (await fetchAsset('getdp/runtime.mjs')).text())
  const [{ default: initializeGmsh }, { default: createGetdpModule }, { createGetdpRuntime }] = await Promise.all([
    import(/* @vite-ignore */ gmshEntryUrl),
    import(/* @vite-ignore */ getdpEntryUrl),
    import(/* @vite-ignore */ getdpRuntimeUrl),
  ])
  const gmshStarted = performance.now()
  gmsh = await initializeGmsh({
    wasmBinary: await fetchBytes('gmsh/gmsh-core.wasm'),
    locateFile: () => new URL('unused.wasm', root).href,
    print: (line: string) => logs.push(`[gmsh] ${line}`),
    printErr: (line: string) => logs.push(`[gmsh:err] ${line}`),
  })
  registerModule('gmsh', gmsh.module, gmshStarted)
  const getdpStarted = performance.now()
  const module = await createGetdpModule({
    wasmBinary: await fetchBytes('getdp/getdp.wasm'),
    locateFile: () => new URL('unused.wasm', root).href,
    print: (line: string) => logs.push(`[getdp] ${line}`),
    printErr: (line: string) => logs.push(`[getdp:err] ${line}`),
  })
  registerModule('getdp-real', module, getdpStarted)
  getdp = createGetdpRuntime(module)
  gmsh.initialize()
  startupMilliseconds.set('real-double', performance.now() - started)
}

async function initialize() {
  await scheduler.initialize(initializeModules)
  if (!manifest) throw new Error('simulation manifest initialization did not complete')
  return manifest
}

async function solverFor(scalarType: ProjectDescriptor['scalarType']) {
  await initialize()
  if (scalarType === 'real-double') {
    if (runtimeProfile === 'combined') gmsh = combinedReal
    return getdp
  }
  if (complexGetdp) {
    if (runtimeProfile === 'combined') gmsh = combinedComplex
    return complexGetdp
  }
  if (!manifest) throw new Error('simulation manifest is not loaded')
  const complexPartition = runtimeProfile === 'combined' ? 'combined-complex' : 'separate-complex'
  const started = performance.now()
  if (!partitionAssets.has(complexPartition)) partitionAssets.set(complexPartition, await populateCache(manifest, manifest.partitions[complexPartition]))
  const moduleUrl = (source: string) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  if (runtimeProfile === 'combined') {
    const entryUrl = moduleUrl(await (await fetchAsset('combined-complex/combined.mjs')).text())
    const gmshRuntimeUrl = moduleUrl(await (await fetchAsset('combined-complex/runtime.mjs')).text())
    const descriptorUrl = moduleUrl(await (await fetchAsset('combined-complex/gmsh-descriptor.mjs')).text())
    const combinedRuntimeUrl = moduleUrl(await (await fetchAsset('combined-complex/combined-runtime.mjs')).text())
    const [{ default: createCombinedModule }, { buildApi }, { default: descriptor }, { createCombinedRuntime }] = await Promise.all([
      import(/* @vite-ignore */ entryUrl), import(/* @vite-ignore */ gmshRuntimeUrl), import(/* @vite-ignore */ descriptorUrl), import(/* @vite-ignore */ combinedRuntimeUrl),
    ])
    const moduleStarted = performance.now()
    const module = await createCombinedModule({
      wasmBinary: await fetchBytes('combined-complex/combined.wasm'), locateFile: () => new URL('unused.wasm', root).href,
      print: (line: string) => logs.push(`[combined-complex] ${line}`), printErr: (line: string) => logs.push(`[combined-complex:err] ${line}`),
    })
    registerModule('combined-complex', module, moduleStarted)
    combinedComplex = createCombinedRuntime(module, buildApi, descriptor)
    combinedComplex.initialize()
    complexGetdp = combinedComplex.solver
    gmsh = combinedComplex
    startupMilliseconds.set('complex-double', performance.now() - started)
    return complexGetdp
  }
  const entryUrl = moduleUrl(await (await fetchAsset('getdp-complex/getdp.mjs')).text())
  const runtimeUrl = moduleUrl(await (await fetchAsset('getdp/runtime.mjs')).text())
  const [{ default: createGetdpModule }, { createGetdpRuntime }] = await Promise.all([
    import(/* @vite-ignore */ entryUrl),
    import(/* @vite-ignore */ runtimeUrl),
  ])
  const moduleStarted = performance.now()
  const module = await createGetdpModule({
    wasmBinary: await fetchBytes('getdp-complex/getdp.wasm'),
    locateFile: () => new URL('unused.wasm', root).href,
    print: (line: string) => logs.push(`[getdp-complex] ${line}`),
    printErr: (line: string) => logs.push(`[getdp-complex:err] ${line}`),
  })
  registerModule('getdp-complex', module, moduleStarted)
  complexGetdp = createGetdpRuntime(module)
  startupMilliseconds.set('complex-double', performance.now() - started)
  return complexGetdp
}

function writeFile(fs: any, path: string, bytes: Uint8Array) {
  try { fs.unlink(path) } catch { /* absent */ }
  fs.writeFile(path, bytes)
}

function memfsMetrics(fs: any, rootPath: string) {
  let files = 0, bytes = 0
  const visit = (path: string) => {
    for (const name of fs.readdir(path) as string[]) {
      if (name === '.' || name === '..') continue
      const child = `${path.replace(/\/$/, '')}/${name}`
      const stat = fs.stat(child)
      if (fs.isDir(stat.mode)) visit(child)
      else { files++; bytes += stat.size }
    }
  }
  visit(rootPath)
  return { memfsFiles: files, memfsBytes: bytes }
}

function extractView(name: string, list: { dataType: string[]; numElements: number[]; data: number[][] }, components: 1 | 3) {
  const nodeCounts: Record<string, number> = { P: 1, L: 2, T: 3, Q: 4, S: 4, H: 8, I: 6, Y: 5 }
  const values: number[] = []
  const points: Array<[number, number, number]> = []
  let elements = 0
  for (let block = 0; block < list.dataType.length; block++) {
    const dataType = list.dataType[block]
    if (!dataType || dataType[0] !== (components === 1 ? 'S' : 'V')) continue
    const nodes = nodeCounts[dataType[1] ?? '']
    const count = list.numElements[block] ?? 0
    const data = list.data[block] ?? []
    if (!nodes || !count) continue
    const stride = data.length / count
    const coordinateCount = nodes * 3
    if (!Number.isInteger(stride) || stride < coordinateCount + nodes * components) throw new Error(`unexpected ${dataType} list-data layout`)
    for (let element = 0; element < count; element++) {
      const start = element * stride
      // Gmsh list data stores x[], y[], z[] planes before the value payload.
      for (let node = 0; node < nodes; node++) points.push([data[start + node] ?? 0, data[start + nodes + node] ?? 0, data[start + 2 * nodes + node] ?? 0])
      const offset = start + coordinateCount
      for (let index = 0; index < nodes * components; index++) values.push(data[offset + index] ?? 0)
    }
    elements += count
  }
  if (!elements) throw new Error(`view ${name} has no data`)
  return { block: { name, dataType: components === 1 ? 'scalar' : 'vector', numElements: elements, components, values: new Float64Array(values) } satisfies ViewBlock, points }
}

function deterministicSamples(scalar: ReturnType<typeof extractView>, vector: ReturnType<typeof extractView>, targets: Array<[number, number, number]>, projectId: string): FieldSample[] {
  return targets.map(([x, y, z], target) => {
    let index = 0
    let distance = Infinity
    scalar.points.forEach((point, candidate) => {
      const current = Math.hypot(point[0] - x, point[1] - y, point[2] - z)
      if (current < distance) { index = candidate; distance = current }
    })
    const coordinate = scalar.points[index] ?? [0, 0, 0]
    let vectorIndex = 0
    let vectorDistance = Infinity
    vector.points.forEach((point, candidate) => {
      const current = Math.hypot(point[0] - coordinate[0], point[1] - coordinate[1], point[2] - coordinate[2])
      if (current < vectorDistance) { vectorIndex = candidate; vectorDistance = current }
    })
    const vectorValue: [number, number, number] = [vector.block.values[vectorIndex * 3] ?? 0, vector.block.values[vectorIndex * 3 + 1] ?? 0, vector.block.values[vectorIndex * 3 + 2] ?? 0]
    const legacyKeys = ['ground-near', 'substrate', 'air']
    return { key: projectId === 'microstrip' ? legacyKeys[target]! : `probe-${target + 1}`, coordinate, scalar: scalar.block.values[index] ?? 0, vector: vectorValue, magnitude: Math.hypot(...vectorValue) }
  })
}

function authoritativeScene(): SimulationScene {
  const allNodes = gmsh.model.mesh.getNodes()
  const nodeIndex = new Map<number, number>()
  allNodes.nodeTags.forEach((tag: number, index: number) => nodeIndex.set(tag, index))
  const nodeClassification = new Map<number, [number, number]>()
  const entities: ModelEntity[] = []
  for (const [dimension, entityTag] of pairs(gmsh.model.getEntities().dimTags as number[])) {
    const bounds = gmsh.model.getBoundingBox(dimension, entityTag)
    entities.push({
      dimension: dimension as 0 | 1 | 2 | 3,
      tag: entityTag,
      bounds: [bounds.xmin, bounds.ymin, bounds.zmin, bounds.xmax, bounds.ymax, bounds.zmax],
      physicalTags: Uint32Array.from(gmsh.model.getPhysicalGroupsForEntity(dimension, entityTag).physicalTags),
    })
    for (const tag of gmsh.model.mesh.getNodes(dimension, entityTag).nodeTags as number[]) {
      const current = nodeClassification.get(tag)
      if (!current || dimension < current[0]) nodeClassification.set(tag, [dimension, entityTag])
    }
  }
  const triangles: number[] = []
  const triangleEntities: number[] = []
  const triangleElements: bigint[] = []
  const triangleRegions: number[] = []
  for (const [, surfaceTag] of pairs(gmsh.model.getEntities(2).dimTags as number[])) {
    const adjacentVolumes = gmsh.model.getAdjacencies(2, surfaceTag).upward as number[]
    const blocks = gmsh.model.mesh.getElements(2, surfaceTag)
    blocks.elementTypes.forEach((type: number, block: number) => {
      const properties = gmsh.model.mesh.getElementProperties(type)
      if (properties.numPrimaryNodes !== 3) return
      const tags = blocks.elementTags[block] as number[]
      const connectivity = blocks.nodeTags[block] as number[]
      tags.forEach((elementTag, element) => {
        for (let corner = 0; corner < 3; corner++) triangles.push(nodeIndex.get(connectivity[element * properties.numNodes + corner]!)!)
        triangleEntities.push(surfaceTag)
        triangleElements.push(BigInt(elementTag))
        triangleRegions.push(adjacentVolumes[0] ?? 0)
      })
    })
  }
  const elementBlocks: ElementBlock[] = []
  for (const [dimension, entityTag] of pairs(gmsh.model.getEntities().dimTags as number[])) {
    const blocks = gmsh.model.mesh.getElements(dimension, entityTag)
    blocks.elementTypes.forEach((elementType: number, block: number) => elementBlocks.push({
      dimension: dimension as 0 | 1 | 2 | 3,
      entityTag,
      elementType,
      elementTags: BigUint64Array.from((blocks.elementTags[block] as number[]).map(BigInt)),
      connectivity: BigUint64Array.from((blocks.nodeTags[block] as number[]).map(BigInt)),
    }))
  }
  const groups: PhysicalGroup[] = pairs(gmsh.model.getPhysicalGroups().dimTags as number[]).map(([dimension, tag]) => ({
    dimension: dimension as 0 | 1 | 2 | 3,
    tag,
    name: gmsh.model.getPhysicalName(dimension, tag).name,
    entityTags: Uint32Array.from(gmsh.model.getEntitiesForPhysicalGroup(dimension, tag).tags),
  }))
  return {
    source: 'gmsh-authoritative',
    referencePositions: Float64Array.from(allNodes.coord),
    surfaceTriangles: Uint32Array.from(triangles),
    triangleEntityTags: Uint32Array.from(triangleEntities),
    triangleElementTags: BigUint64Array.from(triangleElements),
    triangleRegionTags: Uint32Array.from(triangleRegions),
    nodeTags: BigUint64Array.from(allNodes.nodeTags.map(BigInt)),
    nodeEntityDimensions: Uint8Array.from(allNodes.nodeTags.map((tag: number) => nodeClassification.get(tag)?.[0] ?? 255)),
    nodeEntityTags: Uint32Array.from(allNodes.nodeTags.map((tag: number) => nodeClassification.get(tag)?.[1] ?? 0)),
    entities, elementBlocks, groups, fields: [],
    surfaceSignatures: surfaceSignatures(allNodes.coord, triangles, triangleEntities),
  }
}

function projectFile(files: ProjectFile[], path: string) {
  const normalized = path.replace(/^\/+/, '')
  const file = files.find((candidate) => candidate.path.replace(/^\/+/, '') === normalized)
  if (!file) throw new Error(`project envelope is missing ${path}`)
  return file.bytes
}

function safeProjectPath(rootPath: string, path: string) {
  const normalized = path.replace(/^\/+/, '')
  if (!normalized || normalized.split('/').includes('..')) throw new Error(`unsafe project path ${path}`)
  return `${rootPath}/${normalized}`
}

function writeProjectFiles(envelope: ProjectEnvelope, solver: any) {
  if (envelope.schema !== 3) throw new Error(`unsupported project envelope schema ${envelope.schema}`)
  gmsh.clear()
  gmsh.onelab.clear()
  gmsh.parser.clear()
  solver.onelab.clear()
  const rootPath = `/projects/${envelope.descriptor.id}`
  gmsh.FS.mkdirTree(rootPath)
  if (solver.FS !== gmsh.FS) solver.FS.mkdirTree(rootPath)
  for (const file of envelope.files) {
    const path = safeProjectPath(rootPath, file.path)
    const directory = path.slice(0, path.lastIndexOf('/'))
    gmsh.FS.mkdirTree(directory)
    if (solver.FS !== gmsh.FS) solver.FS.mkdirTree(directory)
    writeFile(gmsh.FS, path, file.bytes)
    if (solver.FS !== gmsh.FS) writeFile(solver.FS, path, file.bytes)
  }
  gmsh.FS.chdir(rootPath)
  if (solver.FS !== gmsh.FS) solver.FS.chdir(rootPath)
  return rootPath
}

function parseGmshDatabase(descriptor: ProjectDescriptor, database = '') {
  gmsh.clear()
  gmsh.onelab.clear()
  gmsh.parser.clear()
  if (database) gmsh.onelab.set(database, 'json')
  gmsh.open(descriptor.geometry)
  return canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
}

function importGmshDatabase(database: string) {
  gmsh.onelab.clear()
  gmsh.onelab.set(database, 'json')
  return canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
}

function callSolverWithDatabase(solver: any, database: string, invoke: () => number) {
  if (runtimeProfile === 'separate') return callGetdpWithDatabase(solver.onelab, database, invoke)
  importGmshDatabase(database)
  const changedBefore = gmsh.onelab.getChanged('').value
  const status = invoke()
  return {
    status,
    changedBefore,
    changedAfter: gmsh.onelab.getChanged('').value,
    database: canonicalNativeDatabase(gmsh.onelab.get('', 'json').data),
  }
}

function effectiveNumbers(descriptor: ProjectDescriptor, database: string) {
  const parameters = new Map(parseOnelab(database).onelab.parameters.map((parameter) => [parameter.name, parameter]))
  return Object.fromEntries(Object.entries(descriptor.parameterNames).map(([constant, name]) => {
    const parameter = parameters.get(name)
    const value = parameter?.type === 'number' && parameter.values.length === 1 ? parameter.values[0] : undefined
    if (!Number.isFinite(value)) throw new Error(`effective native number ${constant} is absent from ${name}`)
    return [constant, value]
  }))
}

function seedInitialNumbers(descriptor: ProjectDescriptor, database: string) {
  let seeded = database
  for (const [constant, value] of Object.entries(descriptor.setNumbers)) {
    const name = descriptor.parameterNames[constant]
    if (!name) throw new Error(`descriptor ${descriptor.id} has no native parameter name for ${constant}`)
    seeded = setParameterValue(seeded, name, value)
  }
  return seeded
}

function numberArguments(parameters: Record<string, number>) {
  return Object.entries(parameters).flatMap(([name, value]) => ['-setnumber', name, String(value)])
}

function applyPhysicalGroups(envelope: ProjectEnvelope) {
  const { sidecar, descriptor } = envelope
  if (sidecar.schema !== 1 || sidecar.projectId !== descriptor.id || !Array.isArray(sidecar.groups)) throw new Error('physical-group sidecar identity is invalid')
  const entities = new Set(pairs(gmsh.model.getEntities().dimTags as number[]).map(([dimension, tag]) => `${dimension}:${tag}`))
  const nativeGroups = pairs(gmsh.model.getPhysicalGroups().dimTags as number[]).map(([dimension, tag]) => ({ dimension, tag, name: gmsh.model.getPhysicalName(dimension, tag).name }))
  const ids = new Set<string>(), keys = new Set<string>(), names = new Set<string>()
  for (const group of sidecar.groups) {
    const name = group.name.trim(), key = `${group.dimension}:${group.tag}`, nameKey = `${group.dimension}:${name}`
    if (!group.id || ids.has(group.id) || ![0, 1, 2, 3].includes(group.dimension) || !Number.isInteger(group.tag) || group.tag <= 0 || !name || !group.entityTags.length || group.entityTags.some((tag) => !Number.isInteger(tag) || tag <= 0 || !entities.has(`${group.dimension}:${tag}`))) throw new Error(`invalid physical group ${group.id || name}`)
    if (keys.has(key) || names.has(nameKey) || nativeGroups.some((native) => native.dimension === group.dimension && (native.tag === group.tag || native.name === name))) throw new Error(`physical group conflict in dimension ${group.dimension}: ${name}`)
    ids.add(group.id); keys.add(key); names.add(nameKey)
    gmsh.model.addPhysicalGroup(group.dimension, group.entityTags, group.tag)
    gmsh.model.setPhysicalName(group.dimension, group.tag, name)
  }
}

async function solvePreparedProject(requestId: string, envelope: ProjectEnvelope, solver: any, parameters: Record<string, number>): Promise<MicrostripResult> {
  const descriptor = envelope.descriptor
  logs.length = 0
  gmsh.option.setNumber('Mesh.MshFileVersion', 2.2)
  emit({ type: 'entered-native', requestId, workerId, operation: 'gmsh-mesh' })
  const useReferenceMesh = descriptor.referenceMesh && Object.entries(descriptor.setNumbers).every(([name, value]) => parameters[name] === value)
  if (useReferenceMesh) {
    gmsh.clear(); gmsh.open(descriptor.referenceMesh!)
    applyPhysicalGroups(envelope)
  } else {
    gmsh.model.mesh.generate(descriptor.dimension)
  }
  const nodes = gmsh.model.mesh.getNodes().nodeTags.length
  const meshPath = `${descriptor.id}.msh`
  gmsh.write(meshPath)
  const msh = gmsh.FS.readFile(meshPath) as Uint8Array
  const mshSource = new TextDecoder().decode(msh)
  const meshSha256 = await digest(new TextEncoder().encode(canonicalMshRecords(mshSource)))
  const elements = Number(/\$Elements\s+(\d+)/.exec(mshSource)?.[1])
  if (!Number.isInteger(elements)) throw new Error('could not read MSH2 element count')
  const meshPhysicalNames = [...mshSource.matchAll(/^(\d+)\s+(\d+)\s+"([^"]+)"$/gm)].map((match) => ({ dimension: Number(match[1]), tag: Number(match[2]), name: match[3]! }))
  const elementSection = /\$Elements\s+\d+\s+([\s\S]*?)\$EndElements/.exec(mshSource)?.[1] ?? ''
  const meshPhysicalTags = [...new Set(elementSection.trim().split('\n').filter(Boolean).flatMap((line) => {
    const values = line.trim().split(/\s+/).map(Number), count = values[2] ?? 0
    return count > 0 && (values[3] ?? 0) > 0 ? [values[3]!] : []
  }))].sort((a, b) => a - b)
  writeFile(solver.FS, meshPath, msh)
  for (const output of solver.FS.readdir('.').filter((name: string) => /\.(?:pos|res)$/.test(name))) solver.FS.unlink(output)
  emit({ type: 'entered-native', requestId, workerId, operation: 'getdp-solve' })
  if (runtimeProfile === 'combined') gmsh.logger.start()
  let status: number
  try {
    status = solver.run([
      'getdp', descriptor.problem!, '-msh', meshPath, ...numberArguments(parameters),
      '-solve', descriptor.resolution!, ...descriptor.postOperations!.flatMap((operation) => ['-pos', operation]),
    ])
  } finally {
    if (runtimeProfile === 'combined') {
      logs.push(...gmsh.logger.get().log)
      gmsh.logger.stop()
    }
  }
  if (status !== 0) throw new Error(`GetDP exited with status ${status}`)
  if (!descriptor.convergence) throw new Error(`project ${descriptor.id} has no convergence certification criteria`)
  const certification = certifyConvergence(logs, descriptor.convergence, parameters)
  const convergence = certification.groups
  const residuals = convergence.filter(({ kind }) => kind === 'linear').flatMap(({ residuals }) => residuals)
  const initialResidual = residuals[0]
  const residual = residuals.at(-1)
  if (!certification.converged || !Number.isFinite(initialResidual) || !Number.isFinite(residual)) throw new Error(`PETSc convergence certification failed: ${JSON.stringify(certification)}`)
  const degreesOfFreedom = Math.max(...logs.flatMap((line) => [...line.matchAll(/System \d+\/\d+: (\d+) Dofs/g)].map((match) => Number(match[1]))))
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom <= 0) throw new Error(`could not read GetDP system dimension: ${JSON.stringify(logs.filter((line) => line.includes('System')).slice(-10))}`)
  const posBytes: Record<string, number> = {}
  const posSources = new Map<string, string>()
  const outputNames = (solver.FS.readdir('.') as string[]).filter((name) => name.endsWith('.pos')).sort()
  if (!outputNames.length) throw new Error(`project ${descriptor.id} produced no POS outputs`)
  const outputs: Array<{ path: string; bytes: number; sha256: string; records: number }> = []
  for (const name of outputNames) {
    const bytes = solver.FS.readFile(name) as Uint8Array
    posBytes[name] = bytes.byteLength
    const source = new TextDecoder().decode(bytes)
    posSources.set(name, source)
    writeFile(gmsh.FS, name, bytes)
    outputs.push({ path: name, bytes: bytes.byteLength, sha256: await digest(bytes), records: (source.match(/\b[SVT][PTQLSHIY]\(/g) ?? []).length })
  }
  for (const tag of gmsh.view.getTags().tags as number[]) gmsh.view.remove(tag)
  for (const name of outputNames) gmsh.merge(name)
  const views = gmsh.view.getTags().tags as number[]
  if (views.length !== outputNames.length) throw new Error(`Gmsh loaded ${views.length} result views for ${outputNames.length} POS files`)
  const nativeProbes = (descriptor.probes ?? []).flatMap((coordinate) => views.flatMap((tag, index) => {
    const probe = gmsh.view.probe(tag, ...coordinate)
    return probe.distance === 0 && probe.values.length ? [{ file: outputNames[index]!, coordinate, values: probe.values }] : []
  }))
  const scene = authoritativeScene()
  const names = outputNames
  const mesh = { positions: scene.referencePositions, nodeTags: scene.nodeTags!, elementBlocks: scene.elementBlocks }
  scene.fields = views.flatMap((tag, index) => {
    const name = names[index]!.slice(0, -4)
    const sourceFile = names[index]!
    const modelSteps: ModelViewStep[] = []
    const stepCount = gmsh.view.option.getNumber(tag, 'NbTimeStep').value
    for (let step = 0; step < stepCount; step++) {
      let modelStep: ModelViewStep | undefined
      try {
        const homogeneous = gmsh.view.getHomogeneousModelData(tag, step)
        if (homogeneous.dataType) {
          try { modelStep = expandHomogeneousModelStep(mesh, homogeneous) } catch { /* heterogeneous or padded model data */ }
        }
      } catch { /* list representation or heterogeneous model data */ }
      if (!modelStep) {
        try {
          const heterogeneous = gmsh.view.getModelData(tag, step)
          if (heterogeneous.dataType) modelStep = heterogeneous
        } catch { /* list representation */ }
      }
      if (!modelStep) break
      modelSteps.push(modelStep)
    }
    if (modelSteps.length) {
      if (modelSteps.length !== stepCount) throw new Error(`model view ${name} exposed ${modelSteps.length} of ${stepCount} steps`)
      const field = normalizeModelView(mesh, { name, sourceFile, modelName: gmsh.model.getCurrent().name, steps: modelSteps })
      return descriptor.scalarType === 'complex-double' ? complexFieldRepresentations(field) : [field]
    }
    const fields = normalizeListView(mesh, { name, sourceFile, ...gmsh.view.getListData(tag), times: parsePosTimes(posSources.get(sourceFile)!) })
    return descriptor.scalarType === 'complex-double' ? fields.flatMap(complexFieldRepresentations) : fields
  })
  const complexProbes = descriptor.scalarType === 'complex-double' ? nativeProbes.flatMap((probe) => {
    const source = scene.fields.find((field) => field.provenance.sourceFile === probe.file && field.complexPart === 'real')
    if (!source) throw new Error(`complex probe ${probe.file} has no normalized source field`)
    const pairs = source.provenance.complexSourceTimes
    if (!pairs || probe.values.length !== pairs.length * source.components * 2) throw new Error(`complex probe ${probe.file} does not match harmonic metadata`)
    return pairs.flatMap((times, pair) => {
      const offset = pair * source.components * 2
      const real = probe.values.slice(offset, offset + source.components)
      const imaginary = probe.values.slice(offset + source.components, offset + source.components * 2)
      return (['real', 'imaginary', 'magnitude', 'phase'] as const).map((representation) => ({
        file: probe.file, coordinate: probe.coordinate, representation, time: times[0],
        sourceTimes: times,
        values: real.map((value, component) => representation === 'real' ? value : representation === 'imaginary' ? imaginary[component]! : representation === 'magnitude' ? Math.hypot(value, imaginary[component]!) : Math.atan2(imaginary[component]!, value)),
      }))
    })
  }) : []
  const scalarField = scene.fields.find((field) => descriptor.id === 'microstrip' && field.provenance.sourceFile === 'v.pos') ?? scene.fields.find((field) => field.components === 1)
  const vectorField = scene.fields.find((field) => descriptor.id === 'microstrip' && field.provenance.sourceFile === 'e.pos') ?? scene.fields.find((field) => field.components === 3)
  if (!scalarField || !vectorField) throw new Error(`project ${descriptor.id} must expose scalar and vector result fields`)
  const scalarSource = extractView(scalarField.name, gmsh.view.getListData(views[names.indexOf(scalarField.provenance.sourceFile)]!), 1)
  const vectorSource = extractView(vectorField.name, gmsh.view.getListData(views[names.indexOf(vectorField.provenance.sourceFile)]!), 3)
  const memory = residentModuleMetrics()
  const cachedPartitionBytes = [...partitionAssets.values()].flatMap((snapshot) => [...snapshot.values()]).reduce((sum, bytes) => sum + bytes.byteLength, 0)
  const resourceAudit = {
    profile: runtimeProfile,
    scalarType: descriptor.scalarType,
    startupMilliseconds: startupMilliseconds.get(descriptor.scalarType) ?? 0,
    ...memory,
    cachedPartitionBytes,
    modelEntities: scene.entities.length,
    views: views.length,
    ...memfsMetrics(gmsh.FS, `/projects/${descriptor.id}`),
    ...(runtimeProfile === 'combined' ? { nativeBridge: solver.diagnostics.bridge() } : {}),
  }
  return {
    projectId: descriptor.id, parameters,
    nodes, elements, meshSha256, meshPhysicalNames, meshPhysicalTags, degreesOfFreedom, initialResidual, residual, mshBytes: msh.byteLength, posBytes,
    scalar: scalarSource.block, vector: vectorSource.block, samples: deterministicSamples(scalarSource, vectorSource, descriptor.probes ?? [], descriptor.id),
    scene, logs: [...logs],
    memoryBytes: memory.wasmMemoryBytes, resourceAudit,
    snapshotBytes: cachedPartitionBytes,
    loadedPartitions: [...partitionAssets.keys()].sort(), workerId,
    outputs, convergence, nativeProbes, complexProbes,
  }
}

async function openProject(projectId: string): Promise<ProjectBootstrap> {
  await initialize()
  const descriptor = projectDescriptor(projectId)
  if (descriptor.kind !== 'solve' || !descriptor.problem || !descriptor.resolution || !descriptor.postOperations?.length) throw new Error(`project ${projectId} is not a solver project`)
  const solver = await solverFor(descriptor.scalarType)
  const files = await Promise.all(descriptor.files.map(async (path) => ({
    path,
    bytes: await fetchBytes(`fixtures/${descriptor.directory}/${path}`),
  })))
  const envelope: ProjectEnvelope = { schema: 3, action: 'reset', projectId: 'bootstrap', revision: 0, files, database: '', defaults: '', descriptor, sidecar: { schema: 1, projectId: descriptor.id, groups: [] } }
  writeProjectFiles(envelope, solver)
  const gmshDeclarations = parseGmshDatabase(descriptor)
  const declarations = callSolverWithDatabase(solver, gmshDeclarations, () => solver.run(['getdp', descriptor.problem!, '-check']))
  if (declarations.status !== 0) throw new Error(`GetDP declaration check exited with status ${declarations.status}`)
  const gmshDefaults = parseGmshDatabase(descriptor, seedInitialNumbers(descriptor, declarations.database))
  const checked = callSolverWithDatabase(solver, gmshDefaults, () => solver.run(['getdp', descriptor.problem!, ...numberArguments(effectiveNumbers(descriptor, gmshDefaults)), '-check']))
  if (checked.status !== 0) throw new Error(`GetDP default check exited with status ${checked.status}`)
  return { files, defaults: checked.database, descriptor }
}

async function openMicrostrip() { return openProject('microstrip') }

async function runProject(requestId: string, envelope: ProjectEnvelope): Promise<ProjectResponse> {
  await initialize()
  const descriptor = envelope.descriptor
  const solver = await solverFor(descriptor.scalarType)
  logs.length = 0
  writeProjectFiles(envelope, solver)
  const gmshDefaults = parseGmshDatabase(descriptor, envelope.defaults)
  emit({ type: 'entered-native', requestId, workerId, operation: 'getdp-check' })
  const declarations = callSolverWithDatabase(solver, gmshDefaults, () => solver.run(['getdp', descriptor.problem!, '-check']))
  if (declarations.status !== 0) throw new Error(`GetDP declaration check exited with status ${declarations.status}`)
  if (envelope.action !== 'reset') validateReadOnlyValues(declarations.database, envelope.database, envelope.defaults)
  const requested = envelope.action === 'reset' ? declarations.database : mergeValidatedValues(declarations.database, envelope.database)
  let database = parseGmshDatabase(descriptor, requested)
  emit({ type: 'entered-native', requestId, workerId, operation: 'getdp-check' })
  const checked = callSolverWithDatabase(solver, database, () => solver.run(['getdp', descriptor.problem!, ...numberArguments(effectiveNumbers(descriptor, database)), '-check']))
  if (checked.status !== 0) throw new Error(`GetDP check exited with status ${checked.status}`)
  database = parseGmshDatabase(descriptor, checked.database)
  if (envelope.loopIndex !== undefined) {
    if (runtimeProfile !== 'combined' || !Number.isInteger(envelope.loopIndex) || envelope.loopIndex < 0 || envelope.loopIndex >= maximumLoopPoints) throw new Error('invalid native ONELAB loop point index')
    const total = solver.loop.initialize(maximumLoopPoints)
    if (envelope.loopIndex >= total) throw new Error(`native ONELAB loop point ${envelope.loopIndex} exceeds ${total} points`)
    for (let index = 0; index < envelope.loopIndex; index++) if (!solver.loop.increment()) throw new Error(`native ONELAB loop ended before point ${envelope.loopIndex}`)
    database = canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
  }
  applyPhysicalGroups(envelope)
  const parameters = effectiveNumbers(descriptor, database)
  if (envelope.action === 'compute') {
    const imported = runtimeProfile === 'combined'
      ? canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
      : canonicalNativeDatabase(solver.onelab.get())
    if (imported !== database) throw new Error('GetDP database changed after check export')
    const result = await solvePreparedProject(requestId, envelope, solver, parameters)
    database = runtimeProfile === 'combined'
      ? canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
      : importGmshDatabase(canonicalNativeDatabase(solver.onelab.get()))
    return { action: envelope.action, projectId: envelope.projectId, revision: envelope.revision, database, result }
  }
  return { action: envelope.action, projectId: envelope.projectId, revision: envelope.revision, database }
}

async function controlLoop(requestId: string, operation: 'initialize' | 'increment', envelope: ProjectEnvelope): Promise<LoopControlResponse> {
  if (runtimeProfile !== 'combined') throw new Error('native ONELAB loops require the combined runtime profile')
  const solver = await solverFor(envelope.descriptor.scalarType)
  let total: number | undefined
  let hasNext = true
  let database: string
  if (operation === 'initialize') {
    const checked = await runProject(requestId, { ...envelope, action: 'check' })
    importGmshDatabase(checked.database)
    total = solver.loop.initialize(maximumLoopPoints)
    database = canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
  } else {
    writeProjectFiles(envelope, solver)
    importGmshDatabase(envelope.database)
    hasNext = solver.loop.increment()
    database = canonicalNativeDatabase(gmsh.onelab.get('', 'json').data)
  }
  return {
    projectId: envelope.projectId,
    revision: envelope.revision,
    database,
    hasNext,
    ...(total === undefined ? {} : { total }),
    nativeBridge: solver.diagnostics.bridge(),
  }
}

async function runMicrostrip(requestId: string) {
  const project = await openMicrostrip()
  const response = await runProject(requestId, {
    schema: 3, action: 'compute', projectId: 'legacy', revision: 0,
    files: project.files, database: project.defaults, defaults: project.defaults, descriptor: project.descriptor, sidecar: { schema: 1, projectId: project.descriptor.id, groups: [] },
  })
  if (!response.result) throw new Error('legacy microstrip computation returned no result')
  return response.result
}

function pairs(values: number[]) {
  const result: Array<[number, number]> = []
  for (let index = 0; index < values.length; index += 2) result.push([values[index]!, values[index + 1]!])
  return result
}

async function getCubeScene(): Promise<SimulationScene> {
  await initialize()
  gmsh.clear()
  writeFile(gmsh.FS, '/cube.geo', await fetchBytes('fixtures/cube/cube.geo'))
  gmsh.open('/cube.geo')
  const surfaces = pairs(gmsh.model.getEntities(2).dimTags as number[]).map(([, tag]) => tag)
  if (surfaces.length !== 6) throw new Error(`built-in cube has ${surfaces.length} surfaces instead of 6`)
  gmsh.model.mesh.generate(3)

  return authoritativeScene()
}

async function getRenderingScene(): Promise<SimulationScene> {
  await initialize()
  gmsh.clear()
  for (const name of ['test_field.pos', 'test_displ.pos']) {
    writeFile(gmsh.FS, `/${name}`, await fetchBytes(`fixtures/gmsh-rendering/${name}`))
    gmsh.merge(`/${name}`)
  }
  const tags = gmsh.view.getTags().tags as number[]
  if (tags.length !== 2) throw new Error(`rendering fixture exposed ${tags.length} views instead of 2`)
  const scalarList = gmsh.view.getListData(tags[0])
  const block = scalarList.dataType.findIndex((type: string) => type === 'SS')
  if (block < 0) throw new Error('test_field.pos has no scalar quadrangle block')
  const records = scalarList.numElements[block] as number
  const data = scalarList.data[block] as number[]
  const stride = data.length / records
  const positions: number[] = [], nodeTags: bigint[] = [], connectivity: bigint[] = [], elementTags: bigint[] = []
  const nodeByCoordinate = new Map<string, number>()
  for (let record = 0; record < records; record++) {
    const start = record * stride
    for (let corner = 0; corner < 4; corner++) {
      const point = [data[start + corner]!, data[start + 4 + corner]!, data[start + 8 + corner]!]
      const key = point.map((value) => value.toPrecision(14)).join(',')
      let node = nodeByCoordinate.get(key)
      if (node === undefined) {
        node = nodeTags.length
        nodeByCoordinate.set(key, node)
        positions.push(...point)
        nodeTags.push(BigInt(node + 1))
      }
      connectivity.push(nodeTags[node]!)
    }
    elementTags.push(BigInt(record + 1))
  }
  const elementBlocks: ElementBlock[] = [{ dimension: 2, entityTag: 1, elementType: 3, elementTags: BigUint64Array.from(elementTags), connectivity: BigUint64Array.from(connectivity) }]
  const mesh = { positions: Float64Array.from(positions), nodeTags: BigUint64Array.from(nodeTags), elementBlocks }
  const triangles: number[] = [], triangleElements: bigint[] = []
  for (let record = 0; record < records; record++) {
    const nodes = Array.from(connectivity.slice(record * 4, record * 4 + 4), (tag) => Number(tag - 1n))
    triangles.push(nodes[0]!, nodes[1]!, nodes[2]!, nodes[0]!, nodes[2]!, nodes[3]!)
    triangleElements.push(elementTags[record]!, elementTags[record]!)
  }
  const fields = [
    ...normalizeListView(mesh, { name: 'test field', sourceFile: 'test_field.pos', ...scalarList }),
    ...normalizeListView(mesh, { name: 'true displacement', sourceFile: 'test_displ.pos', ...gmsh.view.getListData(tags[1]) }),
  ]
  const displacement = fields.find(({ provenance }) => provenance.sourceFile === 'test_displ.pos')
  if (!displacement || displacement.association !== 'node' || displacement.components !== 3) throw new Error('test_displ.pos did not normalize to a nodal vector')
  displacement.role = 'displacement'
  const referencePositions = mesh.positions
  const surfaceTriangles = Uint32Array.from(triangles)
  const triangleEntityTags = Uint32Array.from({ length: records * 2 }, () => 1)
  return {
    source: 'gmsh-authoritative', referencePositions, surfaceTriangles, triangleEntityTags,
    triangleElementTags: BigUint64Array.from(triangleElements), triangleRegionTags: new Uint32Array(records * 2),
    nodeTags: mesh.nodeTags, nodeEntityDimensions: Uint8Array.from({ length: nodeTags.length }, () => 2),
    nodeEntityTags: Uint32Array.from({ length: nodeTags.length }, () => 1),
    entities: [{ dimension: 2, tag: 1, bounds: [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5], physicalTags: new Uint32Array() }],
    elementBlocks, groups: [], fields, surfaceSignatures: surfaceSignatures(referencePositions, surfaceTriangles, triangleEntityTags),
  }
}

async function handleRequest(event: MessageEvent<OnelabWorkerRequest>) {
  const { requestId } = event.data
  try {
    if (event.data.type === 'warm') emit({ type: 'warmed', requestId, manifest: await initialize() })
    else if (event.data.type === 'open-microstrip') emit({ type: 'project-opened', requestId, project: await openMicrostrip() })
    else if (event.data.type === 'open-project') emit({ type: 'project-opened', requestId, project: await openProject(event.data.projectId) })
    else if (event.data.type === 'project') {
      const response = await runProject(requestId, event.data.envelope)
      const transfers = response.result ? [response.result.scalar.values.buffer, response.result.vector.values.buffer, ...sceneTransferables(response.result.scene)] : []
      emit({ type: 'project-response', requestId, response }, transfers)
    }
    else if (event.data.type === 'loop-control') {
      emit({ type: 'loop-control-response', requestId, response: await controlLoop(requestId, event.data.operation, event.data.envelope) })
    }
    else if (event.data.type === 'get-cube-scene') {
      const scene = await getCubeScene()
      emit({ type: 'scene', requestId, scene }, sceneTransferables(scene))
    } else if (event.data.type === 'get-rendering-scene') {
      const scene = await getRenderingScene()
      emit({ type: 'scene', requestId, scene }, sceneTransferables(scene))
    } else {
      const result = await runMicrostrip(requestId)
      emit({ type: 'result', requestId, result }, [result.scalar.values.buffer, result.vector.values.buffer, ...sceneTransferables(result.scene)])
    }
  } catch (error) {
    emit({ type: 'error', requestId, error: error instanceof Error ? error.stack ?? error.message : String(error) })
  }
}

worker.addEventListener('message', (event: MessageEvent<OnelabWorkerRequest>) => {
  void scheduler.enqueue(() => handleRequest(event))
})
