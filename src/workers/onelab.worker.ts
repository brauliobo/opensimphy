/// <reference lib="webworker" />

import type { FieldSample, MicrostripResult, OnelabWorkerRequest, OnelabWorkerResponse, SimulationAssetManifest, ViewBlock } from '../simulation/types'
import { OnelabWorkerScheduler } from '../simulation/worker-scheduler'
import artifactLock from '../../tools/wasm/artifacts.lock.json'

const worker = self as unknown as DedicatedWorkerGlobalScope
const root = new URL(`${import.meta.env.BASE_URL}simulation/`, worker.location.origin)
const workerId = crypto.randomUUID()
const publicationLock = 'opensimphy-onelab-publication'
const scheduler = new OnelabWorkerScheduler()
const logs: string[] = []
let manifest: SimulationAssetManifest | undefined
let assets: Map<string, Uint8Array> | undefined
let gmsh: any
let getdp: any

function emit(message: OnelabWorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(message, transfer)
}

async function digest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function verifiedResponse(response: Response, file: { path: string; bytes: number; sha256: string }) {
  if (!response.ok) throw new Error(`simulation asset ${file.path}: HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== file.bytes) throw new Error(`simulation asset ${file.path}: expected ${file.bytes} bytes, got ${bytes.byteLength}`)
  const actual = await digest(bytes)
  if (actual !== file.sha256) throw new Error(`simulation asset ${file.path}: SHA256 mismatch`)
  return new Response(bytes, { headers: response.headers, status: 200 })
}

function cacheIdentity(next: SimulationAssetManifest) {
  return { version: next.version, cacheName: next.cacheName, fileMapDigest: next.fileMapDigest, files: next.files }
}

async function completeCache(next: SimulationAssetManifest, cache: Cache) {
  const markerUrl = new URL(`${next.version}/complete.json`, root).href
  const manifestUrl = new URL('manifest.json', root).href
  const marker = await cache.match(markerUrl)
  if (!marker) return false
  try {
    if (JSON.stringify(await marker.json()) !== JSON.stringify(cacheIdentity(next))) return false
    const expectedUrls = [manifestUrl, markerUrl, ...next.files.map((file) => new URL(file.path, root).href)].sort()
    const actualUrls = (await cache.keys()).map((request) => request.url).sort()
    if (JSON.stringify(actualUrls) !== JSON.stringify(expectedUrls)) return false
    const cachedManifest = await cache.match(manifestUrl)
    if (!cachedManifest || JSON.stringify(await cachedManifest.json()) !== JSON.stringify(next)) return false
    for (const file of next.files) {
      const response = await cache.match(new URL(file.path, root).href)
      if (!response) return false
      await verifiedResponse(response, file)
    }
    return true
  } catch {
    return false
  }
}

async function cacheSnapshot(next: SimulationAssetManifest) {
  const cache = await caches.open(next.cacheName)
  if (!await completeCache(next, cache)) return undefined
  const snapshot = new Map<string, Uint8Array>()
  for (const file of next.files) {
    const response = await cache.match(new URL(file.path, root).href)
    if (!response) return undefined
    snapshot.set(file.path, new Uint8Array(await (await verifiedResponse(response, file)).arrayBuffer()))
  }
  return snapshot
}

async function populateCache(next: SimulationAssetManifest) {
  const finalName = next.cacheName
  const stagingName = `${finalName}-staging-${workerId}`
  const existing = await navigator.locks.request(publicationLock, { mode: 'shared' }, () => cacheSnapshot(next))
  if (existing) return existing
  const staging = await caches.open(stagingName)
  try {
    for (const file of next.files) {
      const url = new URL(file.path, root).href
      const stagingUrl = new URL(url)
      stagingUrl.searchParams.set('stage', workerId)
      const response = await verifiedResponse(await fetch(stagingUrl, { cache: 'no-store' }), file)
      await staging.put(url, response)
    }
    const publish = async () => {
      const current = await cacheSnapshot(next)
      if (current) return current
      await caches.delete(finalName)
      const final = await caches.open(finalName)
      try {
        for (const file of next.files) {
          const url = new URL(file.path, root).href
          const response = await staging.match(url)
          if (!response) throw new Error(`staging cache lost ${url}`)
          await final.put(url, response)
        }
        await final.put(new URL('manifest.json', root).href, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }))
        await final.put(new URL(`${next.version}/complete.json`, root).href, new Response(JSON.stringify(cacheIdentity(next))))
        const published = await cacheSnapshot(next)
        if (!published) throw new Error(`published cache ${finalName} is incomplete`)
        for (const name of await caches.keys()) {
          if (name.startsWith('opensimphy-onelab-') && !name.includes('-staging-') && name !== finalName) await caches.delete(name)
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
  if (!manifest || !assets) throw new Error('simulation asset snapshot is not loaded')
  const file = manifest.files.find((entry) => entry.path.endsWith(`/${path}`))
  if (!file) throw new Error(`asset ${path} is absent from the manifest`)
  const bytes = assets.get(file.path)
  if (!bytes) throw new Error(`verified asset ${path} is absent from the initialized snapshot`)
  return new Response(bytes)
}

async function fetchBytes(path: string) {
  return new Uint8Array(await (await fetchAsset(path)).arrayBuffer())
}

async function initializeModules() {
  if (gmsh && getdp && manifest && assets) return
  let response: Response | undefined
  let offlineSnapshot: Map<string, Uint8Array> | undefined
  try { response = await fetch(new URL('manifest.json', root), { cache: 'no-store' }) } catch { /* offline recreation */ }
  if (!response) {
    const offline = await navigator.locks.request(publicationLock, { mode: 'shared' }, async () => {
      for (const name of await caches.keys()) {
        if (!name.startsWith('opensimphy-onelab-') || name.includes('-staging-')) continue
        const candidate = await (await caches.open(name)).match(new URL('manifest.json', root).href)
        if (!candidate) continue
        const candidateManifest = await candidate.clone().json() as SimulationAssetManifest
        const snapshot = await cacheSnapshot(candidateManifest)
        if (snapshot) return { response: candidate, snapshot }
      }
    })
    response = offline?.response
    offlineSnapshot = offline?.snapshot
  }
  if (!response) throw new Error('simulation manifest is unavailable online and no complete cache exists')
  if (!response.ok) throw new Error(`simulation manifest: HTTP ${response.status}`)
  const next = await response.json() as SimulationAssetManifest
  const expectedDigest = await digest(new TextEncoder().encode(JSON.stringify(next.files.map(({ path, bytes, sha256 }) => ({ path: path.slice(next.version.length + 1), bytes, sha256 })))))
  if (next.schema !== 2 || next.version !== artifactLock.contentVersion || next.cacheName !== `opensimphy-onelab-${next.version}` || next.fileMapDigest !== expectedDigest) throw new Error('invalid simulation manifest identity')
  assets = offlineSnapshot ?? await populateCache(next)
  manifest = next

  const moduleUrl = (source: string) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
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
  gmsh = await initializeGmsh({
    wasmBinary: await fetchBytes('gmsh/gmsh-core.wasm'),
    locateFile: () => new URL('unused.wasm', root).href,
    print: (line: string) => logs.push(`[gmsh] ${line}`),
    printErr: (line: string) => logs.push(`[gmsh:err] ${line}`),
  })
  const module = await createGetdpModule({
    wasmBinary: await fetchBytes('getdp/getdp.wasm'),
    locateFile: () => new URL('unused.wasm', root).href,
    print: (line: string) => logs.push(`[getdp] ${line}`),
    printErr: (line: string) => logs.push(`[getdp:err] ${line}`),
  })
  getdp = createGetdpRuntime(module)
  gmsh.initialize()
}

async function initialize() {
  await scheduler.initialize(initializeModules)
  if (!manifest) throw new Error('simulation manifest initialization did not complete')
  return manifest
}

function writeFile(fs: any, path: string, bytes: Uint8Array) {
  try { fs.unlink(path) } catch { /* absent */ }
  fs.writeFile(path, bytes)
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

function deterministicSamples(scalar: ReturnType<typeof extractView>, vector: ReturnType<typeof extractView>): FieldSample[] {
  const targets: Array<[string, number, number]> = [['ground-near', 0.0004, 0.0002], ['substrate', 0.0013, 0.0007], ['air', 0.0032, 0.00055]]
  return targets.map(([key, x, y]) => {
    let index = 0
    let distance = Infinity
    scalar.points.forEach((point, candidate) => {
      const current = Math.hypot(point[0] - x, point[1] - y)
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
    return { key, coordinate, scalar: scalar.block.values[index] ?? 0, vector: vectorValue, magnitude: Math.hypot(...vectorValue) }
  })
}

async function runMicrostrip(requestId: string): Promise<MicrostripResult> {
  await initialize()
  logs.length = 0
  const [geo, pro] = await Promise.all([fetchBytes('fixtures/microstrip/microstrip.geo'), fetchBytes('fixtures/microstrip/microstrip.pro')])
  gmsh.clear()
  writeFile(gmsh.FS, '/microstrip.geo', geo)
  gmsh.open('/microstrip.geo')
  gmsh.option.setNumber('Mesh.MshFileVersion', 2.2)
  emit({ type: 'entered-native', requestId, workerId, operation: 'gmsh-mesh' })
  gmsh.model.mesh.generate(2)
  const nodes = gmsh.model.mesh.getNodes().nodeTags.length
  gmsh.write('/microstrip.msh')
  const msh = gmsh.FS.readFile('/microstrip.msh') as Uint8Array
  const elements = Number(/\$Elements\s+(\d+)/.exec(new TextDecoder().decode(msh))?.[1])
  if (!Number.isInteger(elements)) throw new Error('could not read MSH2 element count')
  writeFile(getdp.FS, '/microstrip.pro', pro)
  writeFile(getdp.FS, '/microstrip.msh', msh)
  for (const output of ['/microstrip.res', '/v.pos', '/e.pos', '/d.pos', '/e_cut.pos']) try { getdp.FS.unlink(output) } catch { /* absent */ }
  emit({ type: 'entered-native', requestId, workerId, operation: 'getdp-solve' })
  const status = getdp.run(['getdp', '/microstrip.pro', '-msh', '/microstrip.msh', '-solve', 'Ele', '-pos', 'Map'])
  if (status !== 0) throw new Error(`GetDP exited with status ${status}`)
  const residuals = logs.flatMap((line) => [...line.matchAll(/KSP Residual norm\s+([0-9.eE+-]+)/g)].map((match) => Number(match[1])))
  const initialResidual = residuals[0]
  const residual = residuals.at(-1)
  if (!Number.isFinite(initialResidual) || !Number.isFinite(residual) || residual >= initialResidual) throw new Error('PETSc residual did not converge')
  const posBytes: Record<string, number> = {}
  for (const name of ['v.pos', 'e.pos', 'd.pos', 'e_cut.pos']) {
    const bytes = getdp.FS.readFile(`/${name}`) as Uint8Array
    posBytes[name] = bytes.byteLength
    writeFile(gmsh.FS, `/${name}`, bytes)
  }
  for (const tag of gmsh.view.getTags().tags as number[]) gmsh.view.remove(tag)
  gmsh.merge('/v.pos'); gmsh.merge('/e.pos')
  const views = gmsh.view.getTags().tags as number[]
  if (views.length < 2) throw new Error('Gmsh did not load scalar and vector views')
  const scalar = extractView('v', gmsh.view.getListData(views[0]), 1)
  const vector = extractView('e', gmsh.view.getListData(views[1]), 3)
  return {
    nodes, elements, initialResidual, residual, mshBytes: msh.byteLength, posBytes,
    scalar: scalar.block, vector: vector.block, samples: deterministicSamples(scalar, vector),
    logs: [...logs], memoryBytes: gmsh.module.wasmMemory.buffer.byteLength + getdp.module.wasmMemory.buffer.byteLength, workerId,
  }
}

async function handleRequest(event: MessageEvent<OnelabWorkerRequest>) {
  const { requestId } = event.data
  try {
    if (event.data.type === 'warm') emit({ type: 'warmed', requestId, manifest: await initialize() })
    else {
      const result = await runMicrostrip(requestId)
      emit({ type: 'result', requestId, result }, [result.scalar.values.buffer, result.vector.values.buffer])
    }
  } catch (error) {
    emit({ type: 'error', requestId, error: error instanceof Error ? error.stack ?? error.message : String(error) })
  }
}

worker.addEventListener('message', (event: MessageEvent<OnelabWorkerRequest>) => {
  void scheduler.enqueue(() => handleRequest(event))
})
