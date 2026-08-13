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

export type OnelabWorkerResponse =
  | { type: 'warmed'; requestId: string; manifest: SimulationAssetManifest }
  | { type: 'entered-native'; requestId: string; workerId: string; operation: 'gmsh-mesh' | 'getdp-solve' }
  | { type: 'result'; requestId: string; result: MicrostripResult }
  | { type: 'error'; requestId: string; error: string }
