export interface ElementBlock {
  dimension: 0 | 1 | 2 | 3
  entityTag: number
  elementType: number
  elementTags: BigUint64Array
  connectivity: BigUint64Array
}

export interface ModelEntity {
  dimension: 0 | 1 | 2 | 3
  tag: number
  bounds: [number, number, number, number, number, number]
  physicalTags: Uint32Array
}

export interface PhysicalGroup {
  dimension: 0 | 1 | 2 | 3
  tag: number
  name: string
  entityTags: Uint32Array
}

export interface FieldProvenance {
  representation: 'list' | 'model'
  sourceFile: string
  viewName: string
  dataTypes: string[]
  originalRecords: number
  modelName?: string
}

export interface ResultField {
  id: string
  name: string
  association: 'node' | 'element' | 'element-node' | 'integration-point' | 'independent'
  components: 1 | 2 | 3 | 6 | 9
  /** Step-major values, ordered by `tags` (or `coordinates` for independent data). */
  values: Float32Array | Float64Array
  steps: Int32Array
  times: Float64Array
  /** Per-step [min, max] pairs followed by no padding. */
  ranges: Float64Array
  globalRange: [number, number]
  tags?: BigUint64Array
  /** Source mesh connectivity for element-node values. */
  connectivity?: BigUint64Array
  /** Coordinates are only present for data independent from the authoritative mesh. */
  coordinates?: Float64Array
  provenance: FieldProvenance
  units?: string
  complexPart?: 'real' | 'imaginary' | 'magnitude' | 'phase'
}

export interface SurfaceSignature {
  sourceKey: number
  area: number
  centroid: [number, number, number]
  normal: [number, number, number]
}

export interface SimulationScene {
  source: 'meshstep-preview' | 'gmsh-authoritative'
  referencePositions: Float64Array
  surfaceTriangles: Uint32Array
  triangleEntityTags: Uint32Array
  triangleElementTags?: BigUint64Array
  /** Adjacent authoritative volume entity for each surface triangle; 0 means no adjacent volume. */
  triangleRegionTags?: Uint32Array
  nodeTags?: BigUint64Array
  nodeEntityDimensions?: Uint8Array
  nodeEntityTags?: Uint32Array
  entities: ModelEntity[]
  elementBlocks: ElementBlock[]
  groups: PhysicalGroup[]
  fields: ResultField[]
  surfaceSignatures: SurfaceSignature[]
}

export interface DisplayGeometry {
  positions: Float32Array
  triangles: Uint32Array
  displayVertexToSourceNode: Uint32Array
  displayTriangleToSourceTriangle: Uint32Array
}

export function displayGeometry(scene: SimulationScene): DisplayGeometry {
  const positions = new Float32Array(scene.surfaceTriangles.length * 3)
  const triangles = new Uint32Array(scene.surfaceTriangles.length)
  const displayVertexToSourceNode = new Uint32Array(scene.surfaceTriangles.length)
  for (let corner = 0; corner < scene.surfaceTriangles.length; corner++) {
    const source = scene.surfaceTriangles[corner]!
    displayVertexToSourceNode[corner] = source
    triangles[corner] = corner
    positions[corner * 3] = scene.referencePositions[source * 3]!
    positions[corner * 3 + 1] = scene.referencePositions[source * 3 + 1]!
    positions[corner * 3 + 2] = scene.referencePositions[source * 3 + 2]!
  }
  const displayTriangleToSourceTriangle = Uint32Array.from({ length: scene.surfaceTriangles.length / 3 }, (_, index) => index)
  return { positions, triangles, displayVertexToSourceNode, displayTriangleToSourceTriangle }
}

export function surfaceSignatures(
  positions: ArrayLike<number>,
  triangles: ArrayLike<number>,
  entityTags: ArrayLike<number>,
): SurfaceSignature[] {
  const values = new Map<number, { area: number; centroid: number[]; normal: number[] }>()
  for (let triangle = 0; triangle < entityTags.length; triangle++) {
    const key = Number(entityTags[triangle])
    const value = values.get(key) ?? { area: 0, centroid: [0, 0, 0], normal: [0, 0, 0] }
    const indices = [triangles[triangle * 3], triangles[triangle * 3 + 1], triangles[triangle * 3 + 2]].map(Number)
    const points = indices.map((index) => [Number(positions[index * 3]), Number(positions[index * 3 + 1]), Number(positions[index * 3 + 2])])
    const ux = points[1]![0]! - points[0]![0]!, uy = points[1]![1]! - points[0]![1]!, uz = points[1]![2]! - points[0]![2]!
    const vx = points[2]![0]! - points[0]![0]!, vy = points[2]![1]! - points[0]![1]!, vz = points[2]![2]! - points[0]![2]!
    const cross = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    const area = Math.hypot(...cross) / 2
    value.area += area
    for (let axis = 0; axis < 3; axis++) {
      value.centroid[axis]! += area * (points[0]![axis]! + points[1]![axis]! + points[2]![axis]!) / 3
      value.normal[axis]! += cross[axis]!
    }
    values.set(key, value)
  }
  return [...values.entries()].map(([sourceKey, value]) => {
    const length = Math.hypot(...value.normal)
    return {
      sourceKey,
      area: value.area,
      centroid: value.centroid.map((entry) => entry / value.area) as [number, number, number],
      normal: value.normal.map((entry) => entry / length) as [number, number, number],
    }
  }).sort((a, b) => a.sourceKey - b.sourceKey)
}

export interface SurfaceMatch {
  previewKey: number
  authoritativeKey: number
}

export function matchSurfaceSignatures(preview: SurfaceSignature[], authoritative: SurfaceSignature[]): SurfaceMatch[] | undefined {
  if (!preview.length || preview.length !== authoritative.length) return
  const centroids = [...preview, ...authoritative].map(({ centroid }) => centroid)
  const extent = Math.max(...[0, 1, 2].map((axis) => {
    const values = centroids.map((centroid) => centroid[axis]!)
    return Math.max(...values) - Math.min(...values)
  }), Math.sqrt(authoritative.reduce((sum, signature) => sum + signature.area, 0)), Number.EPSILON)
  const candidates = preview.map((source) => authoritative.filter((target) => {
    const areaError = Math.abs(source.area - target.area) / Math.max(source.area, target.area, 1)
    const centroidError = Math.hypot(...source.centroid.map((value, axis) => value - target.centroid[axis]!)) / extent
    const normalAlignment = Math.abs(source.normal.reduce((sum, value, axis) => sum + value * target.normal[axis]!, 0))
    return areaError <= 0.02 && centroidError <= 0.002 && normalAlignment >= 0.999
  }))
  if (candidates.some((entries) => entries.length !== 1)) return
  const matches = candidates.map((entries, index) => ({ previewKey: preview[index]!.sourceKey, authoritativeKey: entries[0]!.sourceKey }))
  if (new Set(matches.map(({ authoritativeKey }) => authoritativeKey)).size !== authoritative.length) return
  return matches
}

export function sceneTransferables(scene: SimulationScene): Transferable[] {
  const buffers = new Set<ArrayBuffer>()
  const add = (view?: ArrayBufferView<ArrayBufferLike>) => {
    if (view?.buffer instanceof ArrayBuffer) buffers.add(view.buffer)
  }
  add(scene.referencePositions); add(scene.surfaceTriangles); add(scene.triangleEntityTags)
  add(scene.triangleElementTags); add(scene.triangleRegionTags); add(scene.nodeTags)
  add(scene.nodeEntityDimensions); add(scene.nodeEntityTags)
  for (const entity of scene.entities) add(entity.physicalTags)
  for (const block of scene.elementBlocks) { add(block.elementTags); add(block.connectivity) }
  for (const group of scene.groups) add(group.entityTags)
  for (const field of scene.fields) {
    add(field.values); add(field.steps); add(field.times); add(field.ranges)
    add(field.tags); add(field.connectivity); add(field.coordinates)
  }
  return [...buffers]
}

export interface SceneSummary {
  source: SimulationScene['source']
  bounds: { min: [number, number, number]; max: [number, number, number]; dimensions: [number, number, number] }
  nodes: number
  triangles: number
  entityCounts: [number, number, number, number]
  blockDimensions: number[]
  physicalGroups: Array<{ dimension: number; tag: number; name: string; entityTags: number[] }>
  nodeTagsUnique: boolean
  elementTagsUnique: boolean
  connectivityValid: boolean
  nodeClassificationComplete: boolean
  surfaceEntityTags: number[]
  regionTags: number[]
}

export function summarizeScene(scene: SimulationScene): SceneSummary {
  const points = Array.from({ length: scene.referencePositions.length / 3 }, (_, index) => [
    scene.referencePositions[index * 3]!, scene.referencePositions[index * 3 + 1]!, scene.referencePositions[index * 3 + 2]!,
  ] as [number, number, number])
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]!))) as [number, number, number]
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]!))) as [number, number, number]
  const nodeTags = [...(scene.nodeTags ?? [])]
  const elementTags = scene.elementBlocks.flatMap((block) => [...block.elementTags])
  const nodeTagSet = new Set(nodeTags)
  const entityCounts = [0, 1, 2, 3].map((dimension) => scene.entities.filter((entity) => entity.dimension === dimension).length) as [number, number, number, number]
  return {
    source: scene.source,
    bounds: { min, max, dimensions: max.map((value, axis) => value - min[axis]!) as [number, number, number] },
    nodes: points.length,
    triangles: scene.surfaceTriangles.length / 3,
    entityCounts,
    blockDimensions: [...new Set(scene.elementBlocks.map(({ dimension }) => dimension))].sort(),
    physicalGroups: scene.groups.map((group) => ({ ...group, entityTags: [...group.entityTags] })),
    nodeTagsUnique: nodeTags.length === nodeTagSet.size,
    elementTagsUnique: elementTags.length === new Set(elementTags).size,
    connectivityValid: scene.elementBlocks.every((block) => [...block.connectivity].every((tag) => nodeTagSet.has(tag))),
    nodeClassificationComplete: scene.nodeEntityDimensions?.length === nodeTags.length && scene.nodeEntityTags?.length === nodeTags.length && scene.nodeEntityTags.every((tag) => tag > 0),
    surfaceEntityTags: [...new Set(scene.triangleEntityTags)].sort((a, b) => a - b),
    regionTags: [...new Set(scene.triangleRegionTags ?? [])].sort((a, b) => a - b),
  }
}
