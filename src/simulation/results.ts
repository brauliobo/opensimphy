import type { ElementBlock, ResultField, SimulationScene } from './scene'

export type FieldRangeMode = 'global' | 'step' | 'custom'

export function fieldRange(field: ResultField, step: number, mode: FieldRangeMode, custom?: [number, number]): [number, number] {
  if (mode === 'custom') {
    if (!custom || !custom.every(Number.isFinite) || custom[0] >= custom[1]) throw new Error('custom field range must have finite increasing bounds')
    return custom
  }
  if (mode === 'global') return field.globalRange
  if (step < 0 || step >= field.steps.length) throw new Error(`field step ${step} is out of range`)
  return [field.ranges[step * 2]!, field.ranges[step * 2 + 1]!]
}

export function fieldSampleCount(field: ResultField) {
  const count = field.values.length / field.steps.length / field.components
  if (!Number.isInteger(count) || count <= 0) throw new Error(`field ${field.id} has an invalid sample count`)
  return count
}

export function fieldMagnitudes(field: ResultField, step: number) {
  if (step < 0 || step >= field.steps.length) throw new Error(`field step ${step} is out of range`)
  const samples = fieldSampleCount(field)
  const values = new Float64Array(samples)
  const offset = step * samples * field.components
  for (let sample = 0; sample < samples; sample++) {
    let magnitude = 0
    for (let component = 0; component < field.components; component++) magnitude += field.values[offset + sample * field.components + component]! ** 2
    values[sample] = field.components === 1 ? field.values[offset + sample]! : Math.sqrt(magnitude)
  }
  return values
}

function sceneExtent(scene: SimulationScene) {
  const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity]
  for (let node = 0; node < scene.referencePositions.length / 3; node++) for (let axis = 0; axis < 3; axis++) {
    const value = scene.referencePositions[node * 3 + axis]!
    mins[axis] = Math.min(mins[axis]!, value); maxs[axis] = Math.max(maxs[axis]!, value)
  }
  return Math.max(Math.hypot(...maxs.map((value, axis) => value - mins[axis]!)), Number.MIN_VALUE)
}

interface TriangleProjection {
  weights: [number, number, number]
  planeDistance: number
  localScale: number
}

function triangleProjection(point: readonly number[], a: readonly number[], b: readonly number[], c: readonly number[], extent: number): TriangleProjection | undefined {
  const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
  const ac = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
  const normal = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!]
  const normalLength = Math.hypot(...normal)
  const localScale = Math.max(Math.hypot(...ab), Math.hypot(...ac), Math.hypot(c[0]! - b[0]!, c[1]! - b[1]!, c[2]! - b[2]!))
  const degeneracyTolerance = Math.max(localScale * localScale * 1e-14, Number.EPSILON * extent * extent * 64)
  if (normalLength <= degeneracyTolerance) throw new Error('probe source triangle is geometrically degenerate')
  const ap = [point[0]! - a[0]!, point[1]! - a[1]!, point[2]! - a[2]!]
  const signedDistance = ap.reduce((sum, value, axis) => sum + value * normal[axis]!, 0) / normalLength
  const planeTolerance = Math.max(extent * 1e-10, localScale * 1e-9, Number.EPSILON * extent * 64)
  if (Math.abs(signedDistance) > planeTolerance) return
  const projected = point.map((value, axis) => value - signedDistance * normal[axis]! / normalLength)
  const v2 = projected.map((value, axis) => value - a[axis]!)
  const d00 = ab.reduce((sum, value, axis) => sum + value * ab[axis]!, 0)
  const d01 = ab.reduce((sum, value, axis) => sum + value * ac[axis]!, 0)
  const d11 = ac.reduce((sum, value, axis) => sum + value * ac[axis]!, 0)
  const d20 = v2.reduce((sum, value, axis) => sum + value * ab[axis]!, 0)
  const d21 = v2.reduce((sum, value, axis) => sum + value * ac[axis]!, 0)
  const denominator = d00 * d11 - d01 * d01
  if (Math.abs(denominator) <= degeneracyTolerance * degeneracyTolerance) throw new Error('probe source triangle is geometrically degenerate')
  const v = (d11 * d20 - d01 * d21) / denominator
  const w = (d00 * d21 - d01 * d20) / denominator
  const weights: [number, number, number] = [1 - v - w, v, w]
  const edgeTolerance = Math.max(1e-12, planeTolerance / localScale)
  return weights.every((value) => value >= -edgeTolerance && value <= 1 + edgeTolerance) ? { weights, planeDistance: Math.abs(signedDistance), localScale } : undefined
}

export function uniqueTagMap(tags: BigUint64Array | undefined, label: string) {
  if (!tags?.length) throw new Error(`${label} tags are absent`)
  const map = new Map<bigint, number>()
  tags.forEach((tag, index) => {
    if (map.has(tag)) throw new Error(`${label} contains duplicate tag ${tag}`)
    map.set(tag, index)
  })
  return map
}

export interface FieldProbe {
  fieldId: string
  step: number
  time: number
  point: [number, number, number]
  sourceTriangle: number
  sourceElementTag?: bigint
  sourceNodeTags: bigint[]
  values: number[]
  magnitude: number
}

function probeProjectedField(scene: SimulationScene, field: ResultField, step: number, sourceTriangle: number, point: [number, number, number], projection: TriangleProjection): FieldProbe {
  if (step < 0 || step >= field.steps.length) throw new Error(`field step ${step} is out of range`)
  const indices = Array.from(scene.surfaceTriangles.slice(sourceTriangle * 3, sourceTriangle * 3 + 3))
  const sourceNodeTags = indices.map((index) => scene.nodeTags?.[index] ?? BigInt(index + 1))
  const values = Array.from({ length: field.components }, () => 0)
  const samples = fieldSampleCount(field)
  const stepOffset = step * samples * field.components
  if (field.association === 'node') {
    const fieldTags = uniqueTagMap(field.tags, `field ${field.id}`)
    const fieldIndices = sourceNodeTags.map((tag) => fieldTags.get(tag) ?? -1)
    if (fieldIndices.some((index) => index < 0)) throw new Error('probe triangle contains a node absent from the field')
    for (let corner = 0; corner < 3; corner++) for (let component = 0; component < field.components; component++) values[component]! += projection.weights[corner]! * field.values[stepOffset + fieldIndices[corner]! * field.components + component]!
  } else if (field.association === 'element') {
    const tag = scene.triangleElementTags?.[sourceTriangle]
    const index = tag === undefined ? -1 : uniqueTagMap(field.tags, `field ${field.id}`).get(tag) ?? -1
    if (index < 0) throw new Error('probe triangle element is absent from the field')
    for (let component = 0; component < field.components; component++) values[component] = field.values[stepOffset + index * field.components + component]!
  } else throw new Error(`local surface probes do not support ${field.association} fields`)
  return {
    fieldId: field.id, step: field.steps[step]!, time: field.times[step]!, point, sourceTriangle,
    sourceElementTag: scene.triangleElementTags?.[sourceTriangle], sourceNodeTags, values,
    magnitude: field.components === 1 ? values[0]! : Math.hypot(...values),
  }
}

export function probeField(scene: SimulationScene, field: ResultField, step: number, sourceTriangle: number, point: [number, number, number]): FieldProbe {
  const indices = Array.from(scene.surfaceTriangles.slice(sourceTriangle * 3, sourceTriangle * 3 + 3))
  if (indices.length !== 3) throw new Error(`surface triangle ${sourceTriangle} is absent`)
  const points = indices.map((index) => Array.from(scene.referencePositions.slice(index * 3, index * 3 + 3)))
  const projection = triangleProjection(point, points[0]!, points[1]!, points[2]!, sceneExtent(scene))
  if (!projection) throw new Error('probe point is outside or off the plane of its source triangle')
  return probeProjectedField(scene, field, step, sourceTriangle, point, projection)
}

export function probeScenePoint(scene: SimulationScene, field: ResultField, step: number, point: [number, number, number]) {
  const extent = sceneExtent(scene)
  const matches: Array<{ triangle: number; projection: TriangleProjection; elementTag: bigint }> = []
  for (let triangle = 0; triangle < scene.surfaceTriangles.length / 3; triangle++) {
    const indices = Array.from(scene.surfaceTriangles.slice(triangle * 3, triangle * 3 + 3))
    const points = indices.map((index) => Array.from(scene.referencePositions.slice(index * 3, index * 3 + 3)))
    const projection = triangleProjection(point, points[0]!, points[1]!, points[2]!, extent)
    if (projection) matches.push({ triangle, projection, elementTag: scene.triangleElementTags?.[triangle] ?? BigInt(triangle) })
  }
  if (!matches.length) throw new Error(`point (${point.join(', ')}) is outside or off the plane of the result surface`)
  matches.sort((a, b) => a.projection.planeDistance - b.projection.planeDistance || (a.elementTag < b.elementTag ? -1 : a.elementTag > b.elementTag ? 1 : a.triangle - b.triangle))
  const best = matches[0]!
  const tolerance = Math.max(extent * 1e-10, best.projection.localScale * 1e-9)
  const overlapping = matches.filter(({ projection }) => Math.abs(projection.planeDistance - best.projection.planeDistance) <= tolerance)
  const uniqueElements = new Set(overlapping.map(({ elementTag }) => elementTag))
  if (uniqueElements.size > 1 && field.association === 'element') throw new Error(`point (${point.join(', ')}) overlaps ${uniqueElements.size} field elements`)
  return probeProjectedField(scene, field, step, best.triangle, point, best.projection)
}

function csvCell(value: string | number | bigint) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

interface ElementIdentity { block: ElementBlock; element: number; connectivity: bigint[] }

function sceneIdentity(scene: SimulationScene) {
  const nodes = uniqueTagMap(scene.nodeTags, 'scene node')
  const elements = new Map<bigint, ElementIdentity>()
  for (const block of scene.elementBlocks) {
    if (!block.elementTags.length || block.connectivity.length % block.elementTags.length) throw new Error(`element block ${block.elementType} has invalid connectivity`)
    const count = block.connectivity.length / block.elementTags.length
    block.elementTags.forEach((tag, element) => {
      if (elements.has(tag)) throw new Error(`scene contains duplicate element tag ${tag}`)
      const connectivity = Array.from(block.connectivity.slice(element * count, (element + 1) * count))
      if (connectivity.some((tag) => !nodes.has(tag))) throw new Error(`element ${tag} references an absent node`)
      elements.set(tag, { block, element, connectivity })
    })
  }
  return { nodes, elements }
}

export function fieldCsv(scene: SimulationScene, field: ResultField) {
  const identity = sceneIdentity(scene)
  const samples = fieldSampleCount(field)
  const header = ['field', 'representation', 'model_name', 'association', 'step', 'time', 'sample', 'tag', 'element_tag', 'local_index', 'node_tag', 'x', 'y', 'z', 'connectivity', 'entity_dimension', 'entity_tag', ...Array.from({ length: field.components }, (_, index) => `component_${index + 1}`)]
  const rows: Array<Array<string | number | bigint>> = [header]
  const append = (step: number, sample: number, tag: string | bigint | number, elementTag: string | bigint, localIndex: string | number, nodeTag: string | bigint, coordinate: Array<string | number>, connectivity: bigint[], dimension: string | number, entity: string | number, valueSample: number) => {
    const offset = (step * samples + valueSample) * field.components
    rows.push([field.name, field.provenance.representation, field.provenance.modelName ?? '', field.association, field.steps[step]!, field.times[step]!, sample, tag, elementTag, localIndex, nodeTag, ...coordinate, connectivity.join(' '), dimension, entity, ...Array.from(field.values.slice(offset, offset + field.components))])
  }
  for (let step = 0; step < field.steps.length; step++) {
    if (field.association === 'node') for (let sample = 0; sample < samples; sample++) {
      const tag = field.tags?.[sample]
      const node = tag === undefined ? -1 : identity.nodes.get(tag) ?? -1
      if (tag === undefined || node < 0) throw new Error(`field node ${tag} is absent from the scene`)
      append(step, sample, tag, '', '', tag, Array.from(scene.referencePositions.slice(node * 3, node * 3 + 3)), [], scene.nodeEntityDimensions?.[node] ?? '', scene.nodeEntityTags?.[node] ?? '', sample)
    }
    else if (field.association === 'element') for (let sample = 0; sample < samples; sample++) {
      const tag = field.tags?.[sample], element = tag === undefined ? undefined : identity.elements.get(tag)
      if (tag === undefined || !element) throw new Error(`field element ${tag} is absent from the scene`)
      append(step, sample, tag, tag, '', '', ['', '', ''], element.connectivity, element.block.dimension, element.block.entityTag, sample)
    }
    else if (field.association === 'element-node') {
      if (!field.tags || !field.connectivity) throw new Error(`field ${field.id} lacks element-node identity`)
      let valueSample = 0, connectivityOffset = 0
      for (let sample = 0; sample < field.tags.length; sample++) {
        const tag = field.tags[sample]!, element = identity.elements.get(tag)
        if (!element) throw new Error(`field element ${tag} is absent from the scene`)
        const connectivity = Array.from(field.connectivity.slice(connectivityOffset, connectivityOffset + element.connectivity.length))
        if (connectivity.length !== element.connectivity.length || connectivity.some((nodeTag, index) => nodeTag !== element.connectivity[index])) throw new Error(`field element ${tag} connectivity differs from the scene`)
        connectivityOffset += connectivity.length
        for (let local = 0; local < connectivity.length; local++, valueSample++) {
          const nodeTag = connectivity[local]!, node = identity.nodes.get(nodeTag)!
          append(step, sample, tag, tag, local, nodeTag, Array.from(scene.referencePositions.slice(node * 3, node * 3 + 3)), connectivity, element.block.dimension, element.block.entityTag, valueSample)
        }
      }
      if (connectivityOffset !== field.connectivity.length || valueSample !== samples) throw new Error(`field ${field.id} has inconsistent element-node samples`)
    } else if (field.association === 'independent') {
      if (field.coordinates?.length !== samples * 3) throw new Error(`field ${field.id} has invalid independent coordinates`)
      for (let sample = 0; sample < samples; sample++) append(step, sample, sample, '', sample, '', Array.from(field.coordinates.slice(sample * 3, sample * 3 + 3)), [], '', '', sample)
    } else throw new Error(`CSV export does not support ${field.association} fields`)
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

const shapeByNodes: Record<number, string> = { 1: 'P', 2: 'L', 3: 'T', 4: 'Q', 5: 'Y', 6: 'I', 8: 'H' }

export function fieldPos(scene: SimulationScene, field: ResultField) {
  const identity = sceneIdentity(scene)
  const samples = fieldSampleCount(field)
  const records: string[] = []
  const code = field.components === 1 ? 'S' : field.components === 3 ? 'V' : field.components === 9 ? 'T' : undefined
  if (!code) throw new Error(`native POS export does not support ${field.components} components`)
  const nodeCoordinates = (connectivity: readonly bigint[]) => connectivity.flatMap((tag) => {
    const node = identity.nodes.get(tag)
    if (node === undefined) throw new Error(`POS node ${tag} is absent from the scene`)
    return Array.from(scene.referencePositions.slice(node * 3, node * 3 + 3))
  })
  if (field.association === 'node') for (let sample = 0; sample < samples; sample++) {
    const tag = field.tags?.[sample]
    if (tag === undefined) throw new Error(`field ${field.id} lacks node tags`)
    const values: number[] = []
    for (let step = 0; step < field.steps.length; step++) values.push(...field.values.slice((step * samples + sample) * field.components, (step * samples + sample + 1) * field.components))
    records.push(`${code}P(${nodeCoordinates([tag]).join(',')}){${values.join(',')}}; // node ${tag}`)
  }
  else if (field.association === 'element' || field.association === 'element-node') {
    if (!field.tags) throw new Error(`field ${field.id} lacks element tags`)
    let valueSample = 0, connectivityOffset = 0
    for (let sample = 0; sample < field.tags.length; sample++) {
      const tag = field.tags[sample]!, element = identity.elements.get(tag)
      if (!element) throw new Error(`field element ${tag} is absent from the scene`)
      const connectivity = field.association === 'element-node'
        ? Array.from(field.connectivity?.slice(connectivityOffset, connectivityOffset + element.connectivity.length) ?? [])
        : element.connectivity
      if (!connectivity.length || connectivity.some((nodeTag, index) => nodeTag !== element.connectivity[index])) throw new Error(`field element ${tag} connectivity differs from the scene`)
      connectivityOffset += field.association === 'element-node' ? connectivity.length : 0
      const shape = shapeByNodes[connectivity.length]
      if (!shape) throw new Error(`native POS export does not support ${connectivity.length}-node elements`)
      const values: number[] = []
      for (let step = 0; step < field.steps.length; step++) {
        if (field.association === 'element') {
          const value = Array.from(field.values.slice((step * samples + sample) * field.components, (step * samples + sample + 1) * field.components))
          for (let node = 0; node < connectivity.length; node++) values.push(...value)
        } else for (let node = 0; node < connectivity.length; node++) values.push(...field.values.slice((step * samples + valueSample + node) * field.components, (step * samples + valueSample + node + 1) * field.components))
      }
      records.push(`${code}${shape}(${nodeCoordinates(connectivity).join(',')}){${values.join(',')}}; // element ${tag}`)
      valueSample += field.association === 'element-node' ? connectivity.length : 0
    }
    if (field.association === 'element-node' && (connectivityOffset !== field.connectivity?.length || valueSample !== samples)) throw new Error(`field ${field.id} has inconsistent element-node samples`)
  } else if (field.association === 'independent') {
    if (field.coordinates?.length !== samples * 3) throw new Error(`field ${field.id} has invalid independent coordinates`)
    for (let sample = 0; sample < samples; sample++) {
      const values: number[] = []
      for (let step = 0; step < field.steps.length; step++) values.push(...field.values.slice((step * samples + sample) * field.components, (step * samples + sample + 1) * field.components))
      records.push(`${code}P(${Array.from(field.coordinates.slice(sample * 3, sample * 3 + 3)).join(',')}){${values.join(',')}}; // independent ${sample}`)
    }
  } else throw new Error(`native POS export does not support ${field.association} fields`)
  return `View "${field.name.replaceAll('"', '\\"')}" {\n${records.join('\n')}\nTIME{${Array.from(field.times).join(',')}};\n};\n`
}

export function deterministicGlyphIndices(count: number, mobile: boolean) {
  const limit = mobile ? 192 : 768
  if (count <= limit) return Uint32Array.from({ length: count }, (_, index) => index)
  const stride = count / limit
  return Uint32Array.from({ length: limit }, (_, index) => Math.floor(index * stride))
}
