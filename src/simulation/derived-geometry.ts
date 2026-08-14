import { fieldSampleCount, uniqueTagMap } from './results'
import type { DisplayGeometry, ResultField, SimulationScene } from './scene'

export interface TaggedSegments {
  positions: Float64Array
  sourceTags: BigUint64Array
}

function nodeValues(scene: SimulationScene, field: ResultField, step: number) {
  if (field.association !== 'node' || !field.tags) throw new Error(`${field.name} must be a nodal field`)
  if (step < 0 || step >= field.steps.length) throw new Error(`field step ${step} is out of range`)
  const byTag = uniqueTagMap(field.tags, `field ${field.id}`)
  const samples = fieldSampleCount(field)
  return (node: number, component: number) => {
    const tag = scene.nodeTags?.[node]
    const sample = tag === undefined ? undefined : byTag.get(tag)
    if (sample === undefined) throw new Error(`scene node ${tag} is absent from field ${field.id}`)
    return field.values[(step * samples + sample) * field.components + component]!
  }
}

export function deformedDisplayPositions(scene: SimulationScene, display: DisplayGeometry, field: ResultField, step: number, scale: number) {
  if (field.role !== 'displacement' || field.components !== 3) throw new Error(`field ${field.name} is not a true displacement vector`)
  if (!Number.isFinite(scale)) throw new Error('deformation scale must be finite')
  const value = nodeValues(scene, field, step)
  const positions = new Float32Array(display.positions.length)
  display.displayVertexToSourceNode.forEach((source, vertex) => {
    for (let axis = 0; axis < 3; axis++) positions[vertex * 3 + axis] = scene.referencePositions[source * 3 + axis]! + scale * value(source, axis)
  })
  return positions
}

function interpolate(a: number[], b: number[], av: number, bv: number, level: number) {
  const t = av === bv ? 0.5 : Math.min(1, Math.max(0, (level - av) / (bv - av)))
  return a.map((value, axis) => value + t * (b[axis]! - value))
}

function above(value: number, level: number, tag: bigint) {
  const tolerance = Math.max(1, Math.abs(value), Math.abs(level)) * Number.EPSILON * 32
  return Math.abs(value - level) <= tolerance ? Boolean(tag & 1n) : value > level
}

function onLevel(value: number, level: number) {
  return Math.abs(value - level) <= Math.max(1, Math.abs(value), Math.abs(level)) * Number.EPSILON * 32
}

function pointKey(point: readonly number[]) { return point.map((value) => value.toPrecision(15)).join(',') }

export function surfaceContours(scene: SimulationScene, field: ResultField, step: number, levels: readonly number[]): TaggedSegments {
  if (field.components !== 1) throw new Error('surface contours require a scalar field')
  const value = nodeValues(scene, field, step)
  const segments = new Map<string, { points: number[][]; tag: bigint }>()
  for (let triangle = 0; triangle < scene.surfaceTriangles.length / 3; triangle++) {
    const nodes = Array.from(scene.surfaceTriangles.slice(triangle * 3, triangle * 3 + 3))
    const nodeTags = nodes.map((node) => scene.nodeTags?.[node] ?? BigInt(node + 1))
    const points = nodes.map((node) => Array.from(scene.referencePositions.slice(node * 3, node * 3 + 3)))
    const values = nodes.map((node) => value(node, 0))
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex]!
      if (values.every((candidate) => onLevel(candidate, level))) continue
      const mask = values.reduce((result, candidate, index) => result | (above(candidate, level, nodeTags[index]!) ? 1 << index : 0), 0)
      const edgeIndices = marchingTriangleCases[mask]!
      if (!edgeIndices.length) continue
      const hits = edgeIndices.map((edge) => {
        const [left, right] = triangleEdges[edge]!
        return interpolate(points[left]!, points[right]!, values[left]!, values[right]!, level)
      })
      if (pointKey(hits[0]!) === pointKey(hits[1]!)) continue
      hits.sort((left, right) => pointKey(left).localeCompare(pointKey(right)))
      const key = `${levelIndex}:${pointKey(hits[0]!)}:${pointKey(hits[1]!)}`
      const tag = scene.triangleElementTags?.[triangle] ?? BigInt(triangle + 1), current = segments.get(key)
      if (!current || tag < current.tag) segments.set(key, { points: hits, tag })
    }
  }
  const positions: number[] = [], tags: bigint[] = []
  for (const [, segment] of [...segments].sort(([left], [right]) => left.localeCompare(right))) { positions.push(...segment.points.flat()); tags.push(segment.tag) }
  return { positions: Float64Array.from(positions), sourceTags: BigUint64Array.from(tags) }
}

export interface TaggedTriangles {
  positions: Float64Array
  triangles: Uint32Array
  sourceElementTags: BigUint64Array
  sourceEntityTags: Uint32Array
}

function tetrahedra(scene: SimulationScene) {
  const blocks = scene.elementBlocks.filter(({ dimension }) => dimension === 3)
  if (blocks.some(({ elementType }) => elementType !== 4)) throw new Error(`volume derivation supports only linear tetrahedra (Gmsh type 4); found ${[...new Set(blocks.map(({ elementType }) => elementType))].join(', ')}`)
  return blocks
}

const tetraEdges = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]] as const
const triangleEdges = [[0, 1], [1, 2], [2, 0]] as const
export const marchingTriangleCases: readonly (readonly number[])[] = [[], [0, 2], [0, 1], [1, 2], [1, 2], [0, 1], [0, 2], []]
export const marchingTetraCases: readonly (readonly number[])[] = [
  [], [0, 3, 2], [0, 1, 4], [1, 4, 2, 2, 4, 3], [1, 2, 5], [0, 3, 5, 0, 5, 1], [0, 2, 5, 0, 5, 4], [5, 4, 3],
  [3, 4, 5], [4, 5, 0, 5, 2, 0], [1, 5, 0, 5, 3, 0], [5, 2, 1], [3, 4, 2, 2, 4, 1], [4, 1, 0], [2, 3, 0], [],
]

function tetraSurface(scene: SimulationScene, scalar: (node: number, elementTag: bigint, nodeTag: bigint) => number, level: number, stitch: boolean): TaggedTriangles {
  const nodeByTag = uniqueTagMap(scene.nodeTags, 'scene node')
  const positions: number[] = []
  const vertices = new Map<string, number>()
  const generated = new Map<string, { indices: number[]; tag: bigint; entity: number }>()
  const elements = tetrahedra(scene).flatMap((block) => Array.from(block.elementTags, (tag, element) => ({ block, element, tag })))
    .sort((left, right) => left.tag < right.tag ? -1 : left.tag > right.tag ? 1 : left.block.entityTag - right.block.entityTag)
  for (const { block, element } of elements) {
    const nodeTags = Array.from(block.connectivity.slice(element * 4, element * 4 + 4))
    const nodes = nodeTags.map((tag) => nodeByTag.get(tag)!)
    const points = nodes.map((node) => Array.from(scene.referencePositions.slice(node * 3, node * 3 + 3)))
    const values = nodes.map((node, local) => scalar(node, block.elementTags[element]!, nodeTags[local]!))
    if (values.every((candidate) => onLevel(candidate, level))) continue
    const mask = values.reduce((result, candidate, index) => result | (above(candidate, level, nodeTags[index]!) ? 1 << index : 0), 0)
    const edgeIndices = marchingTetraCases[mask]!
    for (let triangle = 0; triangle < edgeIndices.length; triangle += 3) {
      const indices = edgeIndices.slice(triangle, triangle + 3).map((edge) => {
        const [left, right] = tetraEdges[edge]!
        const pair = nodeTags[left]! < nodeTags[right]! ? [nodeTags[left]!, nodeTags[right]!] : [nodeTags[right]!, nodeTags[left]!]
        const key = `${stitch ? '' : `${block.elementTags[element]}:`}${pair[0]}:${pair[1]}:${level.toPrecision(15)}`
        let index = vertices.get(key)
        if (index === undefined) {
          index = positions.length / 3; positions.push(...interpolate(points[left]!, points[right]!, values[left]!, values[right]!, level)); vertices.set(key, index)
        }
        return index
      })
      const a = positions.slice(indices[0]! * 3, indices[0]! * 3 + 3), b = positions.slice(indices[1]! * 3, indices[1]! * 3 + 3), c = positions.slice(indices[2]! * 3, indices[2]! * 3 + 3)
      const cross = [(b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!), (b[2]! - a[2]!) * (c[0]! - a[0]!) - (b[0]! - a[0]!) * (c[2]! - a[2]!), (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!)]
      if (new Set(indices).size < 3 || Math.hypot(...cross) <= Number.EPSILON) continue
      const key = stitch ? [...indices].sort((left, right) => left - right).join(':') : `${block.elementTags[element]}:${triangle}`
      const candidate = { indices, tag: block.elementTags[element]!, entity: block.entityTag }
      const current = generated.get(key)
      if (!current || candidate.tag < current.tag) generated.set(key, candidate)
    }
  }
  const used = new Map<number, number>(), compactPositions: number[] = [], triangles: number[] = [], tags: bigint[] = [], entities: number[] = []
  for (const [, triangle] of [...generated].sort(([left], [right]) => left.localeCompare(right))) {
    for (const source of triangle.indices) {
      let target = used.get(source)
      if (target === undefined) {
        target = compactPositions.length / 3
        used.set(source, target)
        compactPositions.push(...positions.slice(source * 3, source * 3 + 3))
      }
      triangles.push(target)
    }
    tags.push(triangle.tag); entities.push(triangle.entity)
  }
  return { positions: Float64Array.from(compactPositions), triangles: Uint32Array.from(triangles), sourceElementTags: BigUint64Array.from(tags), sourceEntityTags: Uint32Array.from(entities) }
}

export function tetraIsosurface(scene: SimulationScene, field: ResultField, step: number, level: number) {
  if (field.components !== 1) throw new Error('isosurfaces require a scalar field')
  if (field.association === 'node') {
    const value = nodeValues(scene, field, step)
    return tetraSurface(scene, (node) => value(node, 0), level, true)
  }
  if (field.association !== 'element-node' || !field.tags || !field.connectivity) throw new Error('isosurfaces require nodal or element-node values')
  const sceneElements = new Map(scene.elementBlocks.flatMap((block) => Array.from(block.elementTags, (tag, element) => {
    const count = block.connectivity.length / block.elementTags.length
    return [tag, Array.from(block.connectivity.slice(element * count, (element + 1) * count))] as const
  })))
  const offsets = new Map<bigint, number>()
  let offset = 0
  field.tags.forEach((tag) => {
    const connectivity = sceneElements.get(tag)
    if (!connectivity) throw new Error(`field element ${tag} is absent from the scene`)
    const actual = Array.from(field.connectivity!.slice(offset, offset + connectivity.length))
    if (actual.some((tag, index) => tag !== connectivity[index])) throw new Error(`field element ${tag} connectivity does not match the scene`)
    offsets.set(tag, offset)
    offset += connectivity.length
  })
  if (offset !== field.connectivity.length) throw new Error('element-node field connectivity has trailing values')
  const samples = field.connectivity.length
  return tetraSurface(scene, (_node, elementTag, nodeTag) => {
    const start = offsets.get(elementTag)
    const connectivity = sceneElements.get(elementTag)
    const local = connectivity?.indexOf(nodeTag) ?? -1
    if (start === undefined || local < 0) throw new Error(`field element ${elementTag} is missing node ${nodeTag}`)
    return field.values[step * samples + start + local]!
  }, level, false)
}

export interface ClipPlane { normal: [number, number, number]; constant: number }

export function tetraVolumeSections(scene: SimulationScene, planes: readonly ClipPlane[]) {
  if (!planes.length) return []
  return planes.map((plane) => {
    const length = Math.hypot(...plane.normal)
    if (!(length > 0) || !Number.isFinite(plane.constant)) throw new Error('section plane must have a finite nonzero normal and constant')
    return tetraSurface(scene, (node) => {
      const offset = node * 3
      return (plane.normal[0] * scene.referencePositions[offset]! + plane.normal[1] * scene.referencePositions[offset + 1]! + plane.normal[2] * scene.referencePositions[offset + 2]! + plane.constant) / length
    }, 0, true)
  })
}
