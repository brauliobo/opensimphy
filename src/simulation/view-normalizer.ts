import type { ElementBlock, ResultField } from './scene'

export interface AuthoritativeMesh {
  positions: Float64Array
  nodeTags: BigUint64Array
  elementBlocks: ElementBlock[]
}

export interface ListViewData {
  name: string
  sourceFile: string
  dataType: string[]
  numElements: number[]
  data: number[][]
  times?: number[]
}

export interface ModelViewStep {
  dataType: 'NodeData' | 'ElementData' | 'ElementNodeData'
  tags: number[]
  data: number[][]
  time: number
  numComponents: number
}

export interface ModelViewData {
  name: string
  sourceFile: string
  modelName: string
  steps: ModelViewStep[]
}

export interface HomogeneousModelStep {
  dataType: ModelViewStep['dataType']
  tags: number[]
  data: number[]
  time: number
  numComponents: number
}

const nodesByShape: Record<string, number> = { P: 1, L: 2, T: 3, Q: 4, S: 4, H: 8, I: 6, Y: 5 }
const componentsByKind: Record<string, 1 | 3 | 9> = { S: 1, V: 3, T: 9 }

function fieldRange(values: Float64Array, components: number, samples: number, step: number): [number, number] {
  let min = Infinity, max = -Infinity
  const offset = step * samples * components
  for (let sample = 0; sample < samples; sample++) {
    let value = values[offset + sample * components]!
    if (components > 1) value = Math.hypot(...values.slice(offset + sample * components, offset + (sample + 1) * components))
    min = Math.min(min, value); max = Math.max(max, value)
  }
  return [min, max]
}

function finish(field: Omit<ResultField, 'steps' | 'times' | 'ranges' | 'globalRange'>, steps: number[], times: number[]): ResultField {
  if (!steps.length || steps.length !== times.length) throw new Error(`view ${field.name} has inconsistent steps and times`)
  const samples = field.values.length / steps.length / field.components
  if (!Number.isInteger(samples) || samples <= 0) throw new Error(`view ${field.name} has an invalid value count`)
  const ranges = steps.map((_, step) => fieldRange(field.values as Float64Array, field.components, samples, step))
  return {
    ...field, steps: Int32Array.from(steps), times: Float64Array.from(times), ranges: Float64Array.from(ranges.flat()),
    globalRange: [Math.min(...ranges.map(([min]) => min)), Math.max(...ranges.map(([, max]) => max))],
  }
}

function canonicalConnectivity(tags: readonly bigint[]) {
  return tags.slice().sort((a, b) => a < b ? -1 : a > b ? 1 : 0).join(',')
}

export interface MeshIndex {
  extent: number
  tolerance: number
  nodeByTag: Map<bigint, number>
  elementByTag: Map<bigint, { block: ElementBlock; index: number; connectivity: bigint[] }>
  locateNode(point: readonly number[]): number
  locateElement(connectivity: readonly bigint[]): bigint
}

export function indexAuthoritativeMesh(mesh: AuthoritativeMesh): MeshIndex {
  if (mesh.positions.length !== mesh.nodeTags.length * 3) throw new Error('authoritative node coordinates and tags differ in length')
  const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity]
  for (let node = 0; node < mesh.nodeTags.length; node++) for (let axis = 0; axis < 3; axis++) {
    const value = mesh.positions[node * 3 + axis]!
    mins[axis] = Math.min(mins[axis]!, value); maxs[axis] = Math.max(maxs[axis]!, value)
  }
  const extent = Math.max(Math.hypot(...maxs.map((value, axis) => value - mins[axis]!)), Number.MIN_VALUE)
  const tolerance = Math.max(extent * 1e-9, Number.EPSILON * extent * 32)
  const quantize = (value: number) => Math.round(value / tolerance)
  const buckets = new Map<string, number[]>()
  const nodeByTag = new Map<bigint, number>()
  for (let node = 0; node < mesh.nodeTags.length; node++) {
    const tag = mesh.nodeTags[node]!
    if (nodeByTag.has(tag)) throw new Error(`duplicate authoritative node tag ${tag}`)
    nodeByTag.set(tag, node)
    const key = [0, 1, 2].map((axis) => quantize(mesh.positions[node * 3 + axis]!)).join(',')
    const entries = buckets.get(key) ?? []
    entries.push(node); buckets.set(key, entries)
  }
  const locateNode = (point: readonly number[]) => {
    const base = point.map(quantize)
    const candidates = new Set<number>()
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const node of buckets.get(`${base[0]! + dx},${base[1]! + dy},${base[2]! + dz}`) ?? []) {
        if (Math.hypot(...point.map((value, axis) => value - mesh.positions[node * 3 + axis]!)) <= tolerance) candidates.add(node)
      }
    }
    if (candidates.size !== 1) throw new Error(`list coordinate (${point.join(', ')}) maps to ${candidates.size} authoritative nodes`)
    return [...candidates][0]!
  }
  const connectivityIndex = new Map<string, bigint[]>()
  const elementByTag = new Map<bigint, { block: ElementBlock; index: number; connectivity: bigint[] }>()
  for (const block of mesh.elementBlocks) {
    if (!block.elementTags.length || block.connectivity.length % block.elementTags.length) throw new Error(`element block ${block.elementType} has invalid connectivity`)
    const nodes = block.connectivity.length / block.elementTags.length
    for (let index = 0; index < block.elementTags.length; index++) {
      const tag = block.elementTags[index]!
      if (elementByTag.has(tag)) throw new Error(`duplicate authoritative element tag ${tag}`)
      const connectivity = Array.from(block.connectivity.slice(index * nodes, (index + 1) * nodes))
      if (connectivity.some((nodeTag) => !nodeByTag.has(nodeTag))) throw new Error(`element ${tag} references an absent node`)
      elementByTag.set(tag, { block, index, connectivity })
      const key = canonicalConnectivity(connectivity)
      const entries = connectivityIndex.get(key) ?? []
      entries.push(tag); connectivityIndex.set(key, entries)
    }
  }
  const locateElement = (connectivity: readonly bigint[]) => {
    const matches = connectivityIndex.get(canonicalConnectivity(connectivity)) ?? []
    if (matches.length !== 1) throw new Error(`record connectivity maps to ${matches.length} authoritative elements`)
    return matches[0]!
  }
  return { extent, tolerance, nodeByTag, elementByTag, locateNode, locateElement }
}

export function normalizeListView(mesh: AuthoritativeMesh, view: ListViewData): ResultField[] {
  if (view.dataType.length !== view.numElements.length || view.dataType.length !== view.data.length) throw new Error(`view ${view.name} has inconsistent list block counts`)
  const meshIndex = indexAuthoritativeMesh(mesh)
  const fields: ResultField[] = []
  for (let blockIndex = 0; blockIndex < view.dataType.length; blockIndex++) {
    const dataType = view.dataType[blockIndex]!
    const components = componentsByKind[dataType[0] ?? '']
    const nodes = nodesByShape[dataType[1] ?? '']
    const records = view.numElements[blockIndex]!
    const data = view.data[blockIndex]!
    if (!components || !nodes || !Number.isInteger(records) || records <= 0) throw new Error(`view ${view.name} has unsupported list block ${dataType}`)
    const stride = data.length / records
    const coordinateValues = nodes * 3
    const payload = stride - coordinateValues
    if (!Number.isInteger(stride) || payload <= 0 || payload % (nodes * components) !== 0) throw new Error(`view ${view.name} ${dataType} has invalid full-timestep stride ${stride}`)
    const stepCount = payload / nodes / components
    const times = view.times ?? Array.from({ length: stepCount }, (_, step) => step)
    if (times.length !== stepCount) throw new Error(`view ${view.name} has ${stepCount} steps but ${times.length} times`)
    const coordinates: number[][][] = []
    const recordValues: number[][][] = []
    for (let record = 0; record < records; record++) {
      const start = record * stride
      coordinates.push(Array.from({ length: nodes }, (_, node) => [data[start + node]!, data[start + nodes + node]!, data[start + 2 * nodes + node]!]))
      recordValues.push(Array.from({ length: stepCount }, (_, step) => Array.from({ length: nodes * components }, (_, index) => data[start + coordinateValues + step * nodes * components + index]!)))
    }
    const provenance = { representation: 'list' as const, sourceFile: view.sourceFile, viewName: view.name, dataTypes: [dataType], originalRecords: records }
    if (nodes === 1) {
      const values = new Float64Array(stepCount * records * components)
      for (let step = 0; step < stepCount; step++) for (let record = 0; record < records; record++) values.set(recordValues[record]![step]!, (step * records + record) * components)
      fields.push(finish({ id: `${view.name}-${blockIndex}`, name: view.name, association: 'independent', components, values, coordinates: Float64Array.from(coordinates.flat(2)), provenance }, Array.from({ length: stepCount }, (_, step) => step), times))
      continue
    }
    const nodeIndices = coordinates.map((points) => points.map(meshIndex.locateNode))
    const elementTags = nodeIndices.map((indices) => meshIndex.locateElement(indices.map((index) => mesh.nodeTags[index]!)))
    if (new Set(elementTags).size !== elementTags.length) throw new Error(`view ${view.name} maps multiple records to one authoritative element`)
    const elementConstant = recordValues.every((values) => values.every((step) => Array.from({ length: nodes - 1 }, (_, node) => node + 1).every((node) => Array.from({ length: components }, (_, component) => step[node * components + component] === step[component]).every(Boolean))))
    if (elementConstant) {
      const values = new Float64Array(stepCount * records * components)
      for (let step = 0; step < stepCount; step++) for (let record = 0; record < records; record++) values.set(recordValues[record]![step]!.slice(0, components), (step * records + record) * components)
      fields.push(finish({ id: `${view.name}-${blockIndex}`, name: view.name, association: 'element', components, values, tags: BigUint64Array.from(elementTags), provenance }, Array.from({ length: stepCount }, (_, step) => step), times))
      continue
    }
    const byNode = new Map<number, number[][]>()
    for (let record = 0; record < records; record++) for (let node = 0; node < nodes; node++) {
      const index = nodeIndices[record]![node]!
      const candidate = Array.from({ length: stepCount }, (_, step) => recordValues[record]![step]!.slice(node * components, (node + 1) * components))
      const existing = byNode.get(index)
      if (existing && existing.some((values, step) => values.some((value, component) => value !== candidate[step]![component]))) throw new Error(`view ${view.name} has inconsistent duplicate values for node ${mesh.nodeTags[index]}`)
      byNode.set(index, candidate)
    }
    if (byNode.size === mesh.nodeTags.length) {
      const values = new Float64Array(stepCount * mesh.nodeTags.length * components)
      for (let step = 0; step < stepCount; step++) for (let node = 0; node < mesh.nodeTags.length; node++) values.set(byNode.get(node)![step]!, (step * mesh.nodeTags.length + node) * components)
      fields.push(finish({ id: `${view.name}-${blockIndex}`, name: view.name, association: 'node', components, values, tags: mesh.nodeTags.slice(), provenance }, Array.from({ length: stepCount }, (_, step) => step), times))
    } else {
      const values = new Float64Array(stepCount * records * nodes * components)
      for (let step = 0; step < stepCount; step++) for (let record = 0; record < records; record++) values.set(recordValues[record]![step]!, (step * records + record) * nodes * components)
      fields.push(finish({ id: `${view.name}-${blockIndex}`, name: view.name, association: 'element-node', components, values, tags: BigUint64Array.from(elementTags), connectivity: BigUint64Array.from(nodeIndices.flatMap((indices) => indices.map((index) => mesh.nodeTags[index]!))), provenance }, Array.from({ length: stepCount }, (_, step) => step), times))
    }
  }
  return fields
}

export function normalizeModelView(mesh: AuthoritativeMesh, view: ModelViewData): ResultField {
  if (!view.steps.length) throw new Error(`model view ${view.name} has no steps`)
  const meshIndex = indexAuthoritativeMesh(mesh)
  const first = view.steps[0]!
  if (![1, 2, 3, 6, 9].includes(first.numComponents)) throw new Error(`model view ${view.name} has unsupported component count ${first.numComponents}`)
  const components = first.numComponents as ResultField['components']
  const tags = first.tags.map(BigInt)
  if (!tags.length || new Set(tags).size !== tags.length) throw new Error(`model view ${view.name} has missing or duplicate tags`)
  for (const step of view.steps) {
    if (step.dataType !== first.dataType || step.numComponents !== components || step.tags.length !== tags.length || step.tags.some((tag, index) => BigInt(tag) !== tags[index])) throw new Error(`model view ${view.name} changes layout between steps`)
  }
  const association = ({ NodeData: 'node', ElementData: 'element', ElementNodeData: 'element-node' } as const)[first.dataType]
  if (association === 'node' && tags.some((tag) => !meshIndex.nodeByTag.has(tag))) throw new Error(`model view ${view.name} references an absent node`)
  if (association !== 'node' && tags.some((tag) => !meshIndex.elementByTag.has(tag))) throw new Error(`model view ${view.name} references an absent element`)
  let connectivity: BigUint64Array | undefined
  let valuesPerStep = 0
  if (association === 'element-node') {
    const connectivityValues = tags.flatMap((tag) => meshIndex.elementByTag.get(tag)!.connectivity)
    connectivity = BigUint64Array.from(connectivityValues)
    valuesPerStep = connectivityValues.length * components
  } else valuesPerStep = tags.length * components
  const values = new Float64Array(valuesPerStep * view.steps.length)
  for (let stepIndex = 0; stepIndex < view.steps.length; stepIndex++) {
    const step = view.steps[stepIndex]!
    const expected = association === 'element-node'
      ? tags.map((tag) => meshIndex.elementByTag.get(tag)!.connectivity.length * components)
      : tags.map(() => components)
    if (step.data.length !== tags.length || step.data.some((entry, index) => entry.length !== expected[index])) throw new Error(`model view ${view.name} has invalid ${first.dataType} values at step ${stepIndex}`)
    values.set(step.data.flat(), stepIndex * valuesPerStep)
  }
  return finish({
    id: view.name, name: view.name, association, components, values, tags: BigUint64Array.from(tags), connectivity,
    provenance: { representation: 'model', sourceFile: view.sourceFile, viewName: view.name, modelName: view.modelName, dataTypes: [first.dataType], originalRecords: tags.length },
  }, view.steps.map((_, step) => step), view.steps.map(({ time }) => time))
}

export function expandHomogeneousModelStep(mesh: AuthoritativeMesh, step: HomogeneousModelStep): ModelViewStep {
  const index = indexAuthoritativeMesh(mesh)
  const components = step.numComponents
  if (!Number.isInteger(components) || components <= 0) throw new Error('homogeneous model data has an invalid component count')
  const lengths = step.tags.map((value) => {
    const tag = BigInt(value)
    if (step.dataType === 'NodeData') {
      if (!index.nodeByTag.has(tag)) throw new Error(`homogeneous model data references absent node ${tag}`)
      return components
    }
    const element = index.elementByTag.get(tag)
    if (!element) throw new Error(`homogeneous model data references absent element ${tag}`)
    return step.dataType === 'ElementNodeData' ? element.connectivity.length * components : components
  })
  if (lengths.reduce((sum, length) => sum + length, 0) !== step.data.length) throw new Error(`homogeneous ${step.dataType} has invalid flattened values`)
  let offset = 0
  return {
    ...step,
    data: lengths.map((length) => { const value = step.data.slice(offset, offset + length); offset += length; return value }),
  }
}

export function parseParsedPosView(source: string, name = 'parsed-pos', sourceFile = 'view.pos'): ListViewData {
  const pattern = /\b([SVT])([PTQLSHIY])\(([^)]*)\)\{([^}]*)\}\s*;/g
  const blocks = new Map<string, { records: number; data: number[] }>()
  for (const match of source.matchAll(pattern)) {
    const dataType = `${match[1]}${match[2]}`
    const nodes = nodesByShape[match[2]!], components = componentsByKind[match[1]!]
    const coordinates = match[3]!.split(',').map(Number), values = match[4]!.split(',').map(Number)
    if (!nodes || !components || coordinates.length !== nodes * 3 || !values.length || values.length % (nodes * components) || [...coordinates, ...values].some((value) => !Number.isFinite(value))) throw new Error(`parsed POS contains invalid ${dataType} record`)
    const planes = [0, 1, 2].flatMap((axis) => Array.from({ length: nodes }, (_, node) => coordinates[node * 3 + axis]!))
    const block = blocks.get(dataType) ?? { records: 0, data: [] }
    block.records++; block.data.push(...planes, ...values); blocks.set(dataType, block)
  }
  if (!blocks.size) throw new Error('parsed POS contains no numeric records')
  return {
    name, sourceFile, dataType: [...blocks.keys()], numElements: [...blocks.values()].map(({ records }) => records),
    data: [...blocks.values()].map(({ data }) => data), times: parsePosTimes(source),
  }
}

export function parsePosTimes(source: string) {
  const matches = [...source.matchAll(/\bTIME\s*\{([^}]*)\}\s*;/gi)]
  if (!matches.length) return undefined
  if (matches.length !== 1) throw new Error('POS view contains multiple TIME declarations')
  const times = matches[0]![1]!.split(',').map((value) => Number(value.trim()))
  if (!times.length || times.some((value) => !Number.isFinite(value))) throw new Error('POS view has invalid TIME values')
  return times
}
