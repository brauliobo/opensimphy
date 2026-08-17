/// <reference lib="webworker" />

import { importStep } from 'meshstep'
import { sceneTransferables, surfaceSignatures, type SimulationScene } from '../simulation/scene'
import { verifySimulationManifest } from '../simulation/asset-manifest'
import artifactLock from '../../tools/wasm/artifacts.lock.json'

const worker = self as unknown as DedicatedWorkerGlobalScope

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function loadFixture() {
  const root = new URL(`${import.meta.env.BASE_URL}simulation/`, worker.location.origin)
  const manifestResponse = await fetch(new URL('manifest.json', root), { cache: 'no-store' })
  if (!manifestResponse.ok) throw new Error(`simulation manifest: HTTP ${manifestResponse.status}`)
  const manifest = await verifySimulationManifest(await manifestResponse.json(), artifactLock.contentVersion)
  const file = manifest.partitions.shared.files.find(({ path }) => path === `${artifactLock.contentVersion}/fixtures/cube/cube.step`)
  if (!file) throw new Error('locked STEP cube fixture is absent')
  const fixtureResponse = await fetch(new URL(file.path, root), { cache: 'no-store' })
  if (!fixtureResponse.ok) throw new Error(`locked STEP cube fixture: HTTP ${fixtureResponse.status}`)
  const bytes = new Uint8Array(await fixtureResponse.arrayBuffer())
  if (bytes.byteLength !== file.bytes || await sha256(bytes) !== file.sha256) throw new Error('STEP cube fixture failed lock verification')
  return new TextDecoder().decode(bytes)
}

worker.addEventListener('message', async (event: MessageEvent<{ type: 'convert-cube'; requestId: string }>) => {
  const { requestId } = event.data
  try {
    const result = importStep(await loadFixture(), {
      surfaceDeviation: 0.05,
      normalDeviation: 15,
      maxEdge: 5,
      measureGeometry: true,
      vertexNormals: true,
    })
    if (!result.diagnostics.ok) throw new Error(`meshStep rejected cube: ${JSON.stringify(result.diagnostics)}`)
    const scene: SimulationScene = {
      source: 'meshstep-preview',
      referencePositions: Float64Array.from(result.mesh.positions),
      surfaceTriangles: result.mesh.indices.slice(),
      triangleEntityTags: result.faceOfTri.slice(),
      entities: [...result.faces.values()].map((face) => ({
        dimension: 2,
        tag: face.faceId,
        bounds: [0, 0, 0, 0, 0, 0],
        physicalTags: new Uint32Array(),
      })),
      elementBlocks: [],
      groups: [],
      fields: [],
      surfaceSignatures: surfaceSignatures(result.mesh.positions, result.mesh.indices, result.faceOfTri),
    }
    worker.postMessage({ type: 'result', requestId, scene }, sceneTransferables(scene))
  } catch (error) {
    worker.postMessage({ type: 'error', requestId, error: error instanceof Error ? error.message : String(error) })
  }
})
