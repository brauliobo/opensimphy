export interface SimulationAssetManifest {
  schema: 4
  version: string
  scalarTypes: Array<'real-double' | 'complex-double'>
  revisions: Record<string, { url: string; commit: string; tree: string }>
  partitions: Record<SimulationAssetPartitionName, SimulationAssetPartition>
}

export type SimulationAssetPartitionName = 'core' | 'real' | 'complex'
export interface SimulationAssetPartition {
  name: SimulationAssetPartitionName
  cacheName: string
  fileMapDigest: string
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
  projectId: string
  parameters: Record<string, number>
  nodes: number
  elements: number
  meshSha256: string
  meshPhysicalNames: Array<{ dimension: number; tag: number; name: string }>
  meshPhysicalTags: number[]
  degreesOfFreedom: number
  initialResidual: number
  residual: number
  mshBytes: number
  posBytes: Record<string, number>
  scalar: ViewBlock
  vector: ViewBlock
  logs: string[]
  memoryBytes: number
  snapshotBytes: number
  loadedPartitions: SimulationAssetPartitionName[]
  workerId: string
  samples: FieldSample[]
  scene: SimulationScene
  outputs: Array<{ path: string; bytes: number; sha256: string; records: number }>
  convergence: ConvergenceGroup[]
  nativeProbes: NativeProbe[]
  complexProbes: ComplexProbe[]
}

export interface NativeProbe {
  file: string
  coordinate: [number, number, number]
  values: number[]
}

export interface ComplexProbe extends NativeProbe {
  representation: 'real' | 'imaginary' | 'magnitude' | 'phase'
  time: number
  sourceTimes: [number, number]
}

export interface ConvergenceGroup {
  system: number
  systemName: string
  solve: number
  kind: 'linear' | 'nonlinear'
  boundary: 'solve' | 'nonlinear-iteration'
  timeStep?: number
  time?: number
  nonlinearIteration?: number
  relativeResidual?: number
  reason?: number
  reasonText?: string
  residuals: number[]
  converged: boolean
}

export interface LinearConvergenceCriteria {
  absoluteTolerance: number
  relativeTolerance: number
  residualCount: number
}

export interface NonlinearConvergenceCriteria {
  absoluteTolerance: number
  relativeTolerance: number
  minIterations: number
  maxIterations: number
}

export type ConvergenceStructure =
  | { kind: 'fixed'; groups: Array<{ kind: 'linear'; systemName: string }> }
  | { kind: 'transient'; systemName: string; endParameter: string; stepParameter: string; activation?: { parameter: string; value: number } }
  | { kind: 'nonlinear'; systemName: string; activation?: { parameter: string; value: number } }

export interface ConvergenceCriteria {
  linear: LinearConvergenceCriteria
  nonlinear?: NonlinearConvergenceCriteria
  structure: ConvergenceStructure
}

export interface ProjectDescriptor {
  id: string
  title: string
  kind: 'solve' | 'render'
  source: string
  directory: string
  files: string[]
  geometry: string
  referenceMesh?: string
  problem?: string
  dimension: 1 | 2 | 3
  scalarType: 'real-double' | 'complex-double'
  resolution?: string
  postOperations?: string[]
  referenceField?: string
  referenceRelative?: number
  convergence?: ConvergenceCriteria
  setNumbers: Record<string, number>
  parameterNames: Record<string, string>
  probes?: Array<[number, number, number]>
  fieldView?: string
  displacementView?: string
}

export interface ProjectFile {
  path: string
  bytes: Uint8Array
}

export interface ProjectEnvelope {
  schema: 3
  action: 'check' | 'compute' | 'reset'
  projectId: string
  revision: number
  files: ProjectFile[]
  database: string
  defaults: string
  descriptor: ProjectDescriptor
  sidecar: PhysicalGroupSidecar
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
  descriptor: ProjectDescriptor
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
  | { type: 'open-project'; requestId: string; projectId: string }
  | { type: 'project'; requestId: string; envelope: ProjectEnvelope }
  | { type: 'get-cube-scene'; requestId: string }
  | { type: 'get-rendering-scene'; requestId: string }

export type OnelabWorkerResponse =
  | { type: 'warmed'; requestId: string; manifest: SimulationAssetManifest }
  | { type: 'entered-native'; requestId: string; workerId: string; operation: 'getdp-check' | 'gmsh-mesh' | 'getdp-solve' }
  | { type: 'result'; requestId: string; result: MicrostripResult }
  | { type: 'project-opened'; requestId: string; project: ProjectBootstrap }
  | { type: 'project-response'; requestId: string; response: ProjectResponse }
  | { type: 'scene'; requestId: string; scene: SimulationScene }
  | { type: 'error'; requestId: string; error: string }
import type { SimulationScene } from './scene'
import type { PhysicalGroupSidecar } from './physical-groups'
