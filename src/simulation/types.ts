export interface SimulationAssetManifest {
  schema: 2
  version: string
  cacheName: string
  fileMapDigest: string
  scalarType: 'real-double'
  revisions: Record<string, { url: string; commit: string; tree: string }>
  files: Array<{ path: string; bytes: number; sha256: string }>
}

export interface ViewBlock {
  name: string
  dataType: string
  numElements: number
  components: 1 | 3
  values: Float64Array
}

export interface MicrostripResult {
  nodes: number
  elements: number
  meshSha256: string
  degreesOfFreedom: number
  initialResidual: number
  residual: number
  mshBytes: number
  posBytes: Record<string, number>
  scalar: ViewBlock
  vector: ViewBlock
  logs: string[]
  memoryBytes: number
  workerId: string
  samples: FieldSample[]
  scene: SimulationScene
}

export interface ProjectFile {
  path: string
  bytes: Uint8Array
}

export interface ProjectEnvelope {
  schema: 1
  action: 'check' | 'compute' | 'reset'
  projectId: string
  revision: number
  files: ProjectFile[]
  database: string
  defaults: string
}

export interface ProjectResponse {
  action: ProjectEnvelope['action']
  projectId: string
  revision: number
  database: string
  result?: MicrostripResult
}

export interface ProjectBootstrap {
  files: ProjectFile[]
  defaults: string
}

export interface FieldSample {
  key: string
  coordinate: [number, number, number]
  scalar: number
  vector: [number, number, number]
  magnitude: number
}

export type OnelabWorkerRequest =
  | { type: 'warm'; requestId: string }
  | { type: 'run-microstrip'; requestId: string }
  | { type: 'open-microstrip'; requestId: string }
  | { type: 'project'; requestId: string; envelope: ProjectEnvelope }
  | { type: 'get-cube-scene'; requestId: string }

export type OnelabWorkerResponse =
  | { type: 'warmed'; requestId: string; manifest: SimulationAssetManifest }
  | { type: 'entered-native'; requestId: string; workerId: string; operation: 'getdp-check' | 'gmsh-mesh' | 'getdp-solve' }
  | { type: 'result'; requestId: string; result: MicrostripResult }
  | { type: 'project-opened'; requestId: string; project: ProjectBootstrap }
  | { type: 'project-response'; requestId: string; response: ProjectResponse }
  | { type: 'scene'; requestId: string; scene: SimulationScene }
  | { type: 'error'; requestId: string; error: string }
import type { SimulationScene } from './scene'
