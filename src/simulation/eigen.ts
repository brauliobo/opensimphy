import type { ResultField, SimulationScene } from './scene'

export interface EigenMode {
  index: number
  value: number
  residual: number
}

export interface EigenProblemResult {
  nodes: number
  freeNodes: number
  modes: EigenMode[]
  field: ResultField
}

const TRIANGLE = 2
const TETRAHEDRON = 4

function invert3(matrix: number[][]) {
  const a = matrix[0]![0]!, b = matrix[0]![1]!, c = matrix[0]![2]!
  const d = matrix[1]![0]!, e = matrix[1]![1]!, f = matrix[1]![2]!
  const g = matrix[2]![0]!, h = matrix[2]![1]!, i = matrix[2]![2]!
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (!(Math.abs(det) > 0)) throw new Error('singular element Jacobian')
  const scale = 1 / det
  return [
    [(e * i - f * h) * scale, (c * h - b * i) * scale, (b * f - c * e) * scale],
    [(f * g - d * i) * scale, (a * i - c * g) * scale, (c * d - a * f) * scale],
    [(d * h - e * g) * scale, (b * g - a * h) * scale, (a * e - b * d) * scale],
  ]
}

function point(positions: Float64Array, node: number): [number, number, number] {
  return [positions[node * 3]!, positions[node * 3 + 1]!, positions[node * 3 + 2]!]
}

function nodeIndex(scene: SimulationScene) {
  const tags = scene.nodeTags
  if (!tags) throw new Error('eigen mesh has no node tags')
  const index = new Map<bigint, number>()
  tags.forEach((tag, node) => index.set(tag, node))
  return index
}

function add(matrix: number[][], row: number, column: number, value: number) {
  matrix[row]![column]! += value
}

function assemble(scene: SimulationScene) {
  const index = nodeIndex(scene)
  const count = scene.referencePositions.length / 3
  const stiffness = Array.from({ length: count }, () => Array.from({ length: count }, () => 0))
  const mass = Array.from({ length: count }, () => Array.from({ length: count }, () => 0))
  let elements = 0
  for (const block of scene.elementBlocks) {
    if (block.elementType !== TRIANGLE && block.elementType !== TETRAHEDRON) continue
    const nodes = block.elementType === TETRAHEDRON ? 4 : 3
    if (block.connectivity.length !== block.elementTags.length * nodes) throw new Error(`element block ${block.elementType} has invalid connectivity`)
    block.elementTags.forEach((_tag, element) => {
      const local = Array.from({ length: nodes }, (_, corner) => {
        const node = index.get(block.connectivity[element * nodes + corner]!)
        if (node === undefined) throw new Error('eigen mesh references an absent node')
        return node
      })
      if (nodes === 4) assembleTetra(scene.referencePositions, stiffness, mass, local)
      else assembleTriangle(scene.referencePositions, stiffness, mass, local)
      elements++
    })
  }
  if (!elements) throw new Error('eigen mesh has no linear triangle or tetrahedron elements')
  return { stiffness, mass, count }
}

function assembleTriangle(positions: Float64Array, stiffness: number[][], mass: number[][], local: number[]) {
  const [x0, y0] = point(positions, local[0]!)
  const [x1, y1] = point(positions, local[1]!)
  const [x2, y2] = point(positions, local[2]!)
  const twice = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
  const area = Math.abs(twice) / 2
  if (!(area > 0)) throw new Error('degenerate triangle')
  const grads = [
    [(y1 - y2) / twice, (x2 - x1) / twice],
    [(y2 - y0) / twice, (x0 - x2) / twice],
    [(y0 - y1) / twice, (x1 - x0) / twice],
  ]
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    add(stiffness, local[row]!, local[column]!, area * (grads[row]![0]! * grads[column]![0]! + grads[row]![1]! * grads[column]![1]!))
    add(mass, local[row]!, local[column]!, area * (row === column ? 1 / 6 : 1 / 12))
  }
}

function assembleTetra(positions: Float64Array, stiffness: number[][], mass: number[][], local: number[]) {
  const p0 = point(positions, local[0]!)
  const p1 = point(positions, local[1]!)
  const p2 = point(positions, local[2]!)
  const p3 = point(positions, local[3]!)
  const jacobian = [
    [p1[0] - p0[0], p2[0] - p0[0], p3[0] - p0[0]],
    [p1[1] - p0[1], p2[1] - p0[1], p3[1] - p0[1]],
    [p1[2] - p0[2], p2[2] - p0[2], p3[2] - p0[2]],
  ]
  const det = jacobian[0]![0]! * (jacobian[1]![1]! * jacobian[2]![2]! - jacobian[1]![2]! * jacobian[2]![1]!)
    - jacobian[0]![1]! * (jacobian[1]![0]! * jacobian[2]![2]! - jacobian[1]![2]! * jacobian[2]![0]!)
    + jacobian[0]![2]! * (jacobian[1]![0]! * jacobian[2]![1]! - jacobian[1]![1]! * jacobian[2]![0]!)
  const volume = Math.abs(det) / 6
  if (!(volume > 0)) throw new Error('degenerate tetrahedron')
  const inverse = invert3(jacobian)
  const ref = [[-1, -1, -1], [1, 0, 0], [0, 1, 0], [0, 0, 1]]
  const grads = ref.map((gradient) => [
    inverse[0]![0]! * gradient[0]! + inverse[1]![0]! * gradient[1]! + inverse[2]![0]! * gradient[2]!,
    inverse[0]![1]! * gradient[0]! + inverse[1]![1]! * gradient[1]! + inverse[2]![1]! * gradient[2]!,
    inverse[0]![2]! * gradient[0]! + inverse[1]![2]! * gradient[1]! + inverse[2]![2]! * gradient[2]!,
  ])
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    add(stiffness, local[row]!, local[column]!, volume * (grads[row]![0]! * grads[column]![0]! + grads[row]![1]! * grads[column]![1]! + grads[row]![2]! * grads[column]![2]!))
    add(mass, local[row]!, local[column]!, volume * (row === column ? 1 / 10 : 1 / 20))
  }
}

function cholesky(matrix: number[][]) {
  const n = matrix.length
  const lower = Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i]![j]!
      for (let k = 0; k < j; k++) sum -= lower[i]![k]! * lower[j]![k]!
      if (i === j) {
        if (!(sum > 0)) throw new Error('mass matrix is not positive definite')
        lower[i]![j] = Math.sqrt(sum)
      } else lower[i]![j] = sum / lower[j]![j]!
    }
  }
  return lower
}

function solveLower(lower: number[][], values: number[]) {
  const result = values.map((value) => value)
  for (let i = 0; i < lower.length; i++) {
    let sum = result[i]!
    for (let j = 0; j < i; j++) sum -= lower[i]![j]! * result[j]!
    result[i] = sum / lower[i]![i]!
  }
  return result
}

function solveUpper(lower: number[][], values: number[]) {
  const result = values.map((value) => value)
  for (let i = lower.length - 1; i >= 0; i--) {
    let sum = result[i]!
    for (let j = i + 1; j < lower.length; j++) sum -= lower[j]![i]! * result[j]!
    result[i] = sum / lower[i]![i]!
  }
  return result
}

function freeNodes(scene: SimulationScene, volumeDimension: 2 | 3) {
  const count = scene.referencePositions.length / 3
  const dimensions = scene.nodeEntityDimensions
  if (!dimensions || dimensions.length !== count) throw new Error('eigen mesh is missing node classification')
  return Array.from({ length: count }, (_, node) => node).filter((node) => (dimensions[node] ?? 255) >= volumeDimension)
}

function slice(matrix: number[][], keep: number[]) {
  return keep.map((row) => keep.map((column) => matrix[row]![column]!))
}

function matVec(matrix: number[][], vector: number[]) {
  return matrix.map((row) => row.reduce((sum, value, column) => sum + value * vector[column]!, 0))
}

function dot(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * right[index]!, 0)
}

function choleskySolve(lower: number[][], values: number[]) {
  return solveUpper(lower, solveLower(lower, values))
}

function normalizeMass(mass: number[][], vector: number[]) {
  const scale = Math.sqrt(Math.max(dot(vector, matVec(mass, vector)), 1e-30))
  return vector.map((value) => value / scale)
}

function orthogonalize(mass: number[][], vector: number[], previous: number[][]) {
  let next = vector.map((value) => value)
  for (const mode of previous) {
    const coeff = dot(mode, matVec(mass, next))
    next = next.map((value, index) => value - coeff * mode[index]!)
  }
  return normalizeMass(mass, next)
}

function residual(stiffness: number[][], mass: number[][], vector: number[], value: number) {
  let num = 0, den = 0
  for (let i = 0; i < vector.length; i++) {
    let kv = 0, mv = 0
    for (let j = 0; j < vector.length; j++) {
      kv += stiffness[i]![j]! * vector[j]!
      mv += mass[i]![j]! * vector[j]!
    }
    const r = kv - value * mv
    num += r * r
    den += kv * kv + mv * mv
  }
  return Math.sqrt(num / Math.max(den, 1e-30))
}

function inverseIteration(stiffness: number[][], mass: number[][], modeCount: number) {
  const lower = cholesky(stiffness)
  const modes: Array<{ value: number; vector: number[] }> = []
  for (let mode = 0; mode < modeCount; mode++) {
    let vector = normalizeMass(mass, Array.from({ length: stiffness.length }, (_, index) => ((index + mode + 1) % 7) - 3))
    vector = orthogonalize(mass, vector, modes.map(({ vector: previous }) => previous))
    let value = 0
    for (let iteration = 0; iteration < 48; iteration++) {
      vector = orthogonalize(mass, choleskySolve(lower, matVec(mass, vector)), modes.map(({ vector: previous }) => previous))
      const next = dot(vector, matVec(stiffness, vector)) / Math.max(dot(vector, matVec(mass, vector)), 1e-30)
      if (Math.abs(next - value) <= 1e-12 * Math.max(1, Math.abs(next))) { value = next; break }
      value = next
    }
    modes.push({ value, vector })
  }
  return modes
}

export function cubeDirichletSpectrum(length: number, count: number) {
  if (!(length > 0) || !Number.isInteger(count) || count <= 0) throw new Error('cube spectrum needs a positive length and mode count')
  const values: number[] = []
  for (let i = 1; i <= count + 2; i++) for (let j = 1; j <= count + 2; j++) for (let k = 1; k <= count + 2; k++) {
    values.push(Math.PI ** 2 * ((i / length) ** 2 + (j / length) ** 2 + (k / length) ** 2))
  }
  return values.sort((left, right) => left - right).slice(0, count)
}

export function solveLaplaceEigen(scene: SimulationScene, modeCount = 8): EigenProblemResult {
  const volumeDimension = scene.elementBlocks.some(({ dimension }) => dimension === 3) ? 3 : 2
  const { stiffness, mass, count } = assemble(scene)
  const keep = freeNodes(scene, volumeDimension)
  if (keep.length < 2) throw new Error('eigenproblem has too few unconstrained nodes')
  const reducedK = slice(stiffness, keep)
  const reducedM = slice(mass, keep)
  const reduced = inverseIteration(reducedK, reducedM, Math.min(modeCount, keep.length))
    const modes = reduced.map((entry, index) => {
    const full = Array.from({ length: count }, () => 0)
    keep.forEach((node, i) => { full[node] = entry.vector[i]! })
    return { index, value: entry.value, residual: residual(reducedK, reducedM, entry.vector, entry.value), vector: full }
  })
  const field: ResultField = {
    id: 'eigen-u',
    name: 'u',
    association: 'node',
    components: 1,
    values: Float64Array.from(modes.flatMap((mode) => mode.vector)),
    steps: Int32Array.from(modes.map((mode) => mode.index)),
    times: Float64Array.from(modes.map((mode) => mode.value)),
    ranges: Float64Array.from(modes.flatMap((mode) => {
      const min = Math.min(...mode.vector)
      const max = Math.max(...mode.vector)
      return [min, max]
    })),
    globalRange: [Math.min(...modes.flatMap((mode) => mode.vector)), Math.max(...modes.flatMap((mode) => mode.vector))],
    tags: scene.nodeTags,
    provenance: { representation: 'model', sourceFile: 'eigen.p1', viewName: 'u', dataTypes: ['P1'], originalRecords: modes.length },
    units: '1',
    role: 'field',
  }
  return {
    nodes: count,
    freeNodes: keep.length,
    modes: modes.map(({ index, value, residual }) => ({ index, value, residual })),
    field,
  }
}
