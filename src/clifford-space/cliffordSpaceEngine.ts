export type BasisName = '1' | 'I' | 'J' | 'K' | 'i' | 'j' | 'k' | 'L'
export type Vec3 = readonly [number, number, number]
export type SpaceMode = 'whole-space' | 'one-cube' | 'tiling'
export type CameraView = 'oblique' | 'x' | 'y' | 'z'
export type SliceAxis = 'x' | 'y' | 'z'
export type SnapMode = 'nothing' | 'integer' | 'half-points'
export type LabelSet = 'none' | 'cube-corners' | 'inside-dodecahedron'

export interface BasisSpec {
  name: BasisName
  color: string
  formula: string
  grade: 0 | 1 | 2 | 3
}

export interface CliffordField {
  x: number
  y: number
  z: number
  components: Record<BasisName, number>
  values: readonly number[]
  norm: number
}

export interface IntegerLabel {
  point: Vec3
  text: string
  name: BasisName
  sign: 1 | -1
}

export interface RhombicDodecahedron {
  center: Vec3
  vertices: readonly Vec3[]
  edges: readonly [Vec3, Vec3][]
  faces: readonly (readonly Vec3[])[]
}

export interface LineFamily {
  id: number
  color: string
  direction: Vec3
  switch: 1 | -1
}

const HALF = 0.5
const TERM_EPS = 1e-12
const EDGE_ROUND = 1e9
const AXIS_EDGE2 = 0.75

export const BASIS: readonly BasisSpec[] = Object.freeze([
  Object.freeze({ name: '1', color: '#d8d4cc', formula: 'cos(πx/2) cos(πy/2) cos(πz/2)',  grade: 0 as const }),
  Object.freeze({ name: 'I', color: '#7ec8e3', formula: 'sin(πx/2) cos(πy/2) cos(πz/2)',  grade: 1 as const }),
  Object.freeze({ name: 'J', color: '#9b8cff', formula: 'cos(πx/2) sin(πy/2) cos(πz/2)',  grade: 1 as const }),
  Object.freeze({ name: 'K', color: '#d67be3', formula: 'cos(πx/2) cos(πy/2) sin(πz/2)',  grade: 1 as const }),
  Object.freeze({ name: 'i', color: '#b6e35a', formula: 'cos(πx/2) sin(πy/2) sin(πz/2)',  grade: 2 as const }),
  Object.freeze({ name: 'j', color: '#f09ad0', formula: '-sin(πx/2) cos(πy/2) sin(πz/2)', grade: 2 as const }),
  Object.freeze({ name: 'k', color: '#7ee0b8', formula: 'sin(πx/2) sin(πy/2) cos(πz/2)',  grade: 2 as const }),
  Object.freeze({ name: 'L', color: '#c4c0b6', formula: 'sin(πx/2) sin(πy/2) sin(πz/2)',  grade: 3 as const }),
])

export const BASIS_COLORS: Record<BasisName, string> = Object.freeze({
  '1': '#d8d4cc',
  I:   '#7ec8e3',
  J:   '#9b8cff',
  K:   '#d67be3',
  i:   '#b6e35a',
  j:   '#f09ad0',
  k:   '#7ee0b8',
  L:   '#c4c0b6',
})

export const FAMILY_COLORS: readonly string[] = Object.freeze([
  '#e6b85c',
  '#63cbd1',
  '#9bc77b',
  '#ef755f',
  '#9b8cff',
  '#f09ad0',
])

export const LINE_FAMILIES: readonly LineFamily[] = Object.freeze([
  Object.freeze({ id: 0, color: FAMILY_COLORS[0]!, direction: vec3(1,  1,  0), switch: 1 as const }),
  Object.freeze({ id: 1, color: FAMILY_COLORS[1]!, direction: vec3(1, -1,  0), switch: 1 as const }),
  Object.freeze({ id: 2, color: FAMILY_COLORS[2]!, direction: vec3(1,  0,  1), switch: 1 as const }),
  Object.freeze({ id: 3, color: FAMILY_COLORS[3]!, direction: vec3(1,  0, -1), switch: 1 as const }),
  Object.freeze({ id: 4, color: FAMILY_COLORS[4]!, direction: vec3(0,  1,  1), switch: 1 as const }),
  Object.freeze({ id: 5, color: FAMILY_COLORS[5]!, direction: vec3(0,  1, -1), switch: 1 as const }),
])

export const ALGEBRA_IDENTITIES: readonly string[] = Object.freeze([
  'k = IJ, i = JK, j = -IK',
  'L = H = IJK = I i',
  'ij = -k (in 0: +k)',
])

const HALF_NEIGHBOR_OFFSETS: readonly Vec3[] = Object.freeze([
  vec3( HALF,  HALF, 0),
  vec3( HALF, -HALF, 0),
  vec3(-HALF,  HALF, 0),
  vec3(-HALF, -HALF, 0),
  vec3( HALF, 0,  HALF),
  vec3( HALF, 0, -HALF),
  vec3(-HALF, 0,  HALF),
  vec3(-HALF, 0, -HALF),
  vec3(0,  HALF,  HALF),
  vec3(0,  HALF, -HALF),
  vec3(0, -HALF,  HALF),
  vec3(0, -HALF, -HALF),
])

const UNIT_CUBE_VERTICES: readonly Vec3[] = Object.freeze(buildUnitCubeVertices())
const UNIT_CUBE_EDGES: readonly [Vec3, Vec3][] = Object.freeze(buildUnitCubeEdges(UNIT_CUBE_VERTICES))
const CUBE_CORNER_LABELS: readonly IntegerLabel[] = Object.freeze(
  UNIT_CUBE_VERTICES.map(([x, y, z]) => integerLabel(x, y, z)),
)
const INSIDE_DODECAHEDRON_LABELS: readonly IntegerLabel[] = Object.freeze(collectIntegerPointsInsideDodecahedron())

function vec3(x: number, y: number, z: number): Vec3 {
  return Object.freeze([x, y, z]) as Vec3
}

function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a[0] + b[0], a[1] + b[1], a[2] + b[2])
}

function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return dx * dx + dy * dy + dz * dz
}

function roundKeyCoord(value: number): number {
  return Math.round(value * EDGE_ROUND) / EDGE_ROUND
}

function vecKey(point: Vec3): string {
  return `${roundKeyCoord(point[0])},${roundKeyCoord(point[1])},${roundKeyCoord(point[2])}`
}

function undirectedKey(a: Vec3, b: Vec3): string {
  const ka = vecKey(a)
  const kb = vecKey(b)
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function sortedEdge(a: Vec3, b: Vec3): [Vec3, Vec3] {
  return vecKey(a) <= vecKey(b) ? [a, b] : [b, a]
}

function buildUnitCubeVertices(): Vec3[] {
  const vertices: Vec3[] = []
  for (const x of [0, 1]) {
    for (const y of [0, 1]) {
      for (const z of [0, 1]) vertices.push(vec3(x, y, z))
    }
  }
  return vertices
}

function buildUnitCubeEdges(vertices: readonly Vec3[]): [Vec3, Vec3][] {
  const edges: [Vec3, Vec3][] = []
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i]!
      const b = vertices[j]!
      const manhattan = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
      if (manhattan === 1) edges.push([a, b])
    }
  }
  return edges
}

function integerLabel(ix: number, iy: number, iz: number): IntegerLabel {
  const carrier = cubeCornerCarrier(ix, iy, iz)
  const text = carrier.sign === 1
    ? carrier.name
    : carrier.name === '1' ? '-1' : `-${carrier.name}`
  return Object.freeze({
    point: vec3(ix, iy, iz),
    text,
    name: carrier.name,
    sign: carrier.sign,
  })
}

function insideOriginDodecahedron(x: number, y: number, z: number): boolean {
  return Math.max(Math.abs(x) + Math.abs(y), Math.abs(y) + Math.abs(z), Math.abs(z) + Math.abs(x)) <= 2
}

function collectIntegerPointsInsideDodecahedron(): IntegerLabel[] {
  const labels: IntegerLabel[] = []
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) {
        if (insideOriginDodecahedron(x, y, z)) labels.push(integerLabel(x, y, z))
      }
    }
  }
  return labels
}

function formatTerm(name: BasisName, value: number, digits: number, first: boolean): string {
  const body = name === '1' ? Math.abs(value).toFixed(digits) : `${Math.abs(value).toFixed(digits)} ${name}`
  if (first) return value < 0 ? `-${body}` : body
  return value < 0 ? ` - ${body}` : ` + ${body}`
}

function formatTerms(field: CliffordField, names: readonly BasisName[], digits: number): string {
  const terms = names.filter((name) => Math.abs(field.components[name]) > TERM_EPS)
  if (terms.length === 0) return (0).toFixed(digits)
  return terms.map((name, index) => formatTerm(name, field.components[name], digits, index === 0)).join('')
}

function trigPair(coord: number): { c: number; s: number } {
  const angle = Math.PI * coord / 2
  return { c: Math.cos(angle), s: Math.sin(angle) }
}

function axisVerticesForCube(ox: number, oy: number, oz: number): readonly Vec3[] {
  return Object.freeze([
    vec3(ox - HALF, oy + HALF, oz + HALF),
    vec3(ox + 1.5,  oy + HALF, oz + HALF),
    vec3(ox + HALF, oy - HALF, oz + HALF),
    vec3(ox + HALF, oy + 1.5,  oz + HALF),
    vec3(ox + HALF, oy + HALF, oz - HALF),
    vec3(ox + HALF, oy + HALF, oz + 1.5),
  ])
}

function cubeVerticesForOrigin(ox: number, oy: number, oz: number): readonly Vec3[] {
  return Object.freeze(UNIT_CUBE_VERTICES.map(([x, y, z]) => vec3(ox + x, oy + y, oz + z)))
}

function connectedAxisVertices(cube: Vec3, axisVerts: readonly Vec3[]): Vec3[] {
  return axisVerts.filter((vertex) => Math.abs(distanceSquared(cube, vertex) - AXIS_EDGE2) < 1e-9)
}

function evenSum(i: number, j: number, k: number): boolean {
  return (i + j + k) % 2 === 0
}

function fractionalMod1(value: number): number {
  return ((value % 1) + 1) % 1
}

function familyForDelta(dx: number, dy: number, dz: number): LineFamily {
  let x = Math.round(dx * 2)
  let y = Math.round(dy * 2)
  let z = Math.round(dz * 2)
  if (x < 0 || (x === 0 && y < 0) || (x === 0 && y === 0 && z < 0)) {
    x = -x
    y = -y
    z = -z
  }
  return LINE_FAMILIES.find((family) => (
    family.direction[0] === x && family.direction[1] === y && family.direction[2] === z
  ))!
}

function lexLess(a: Vec3, b: Vec3): boolean {
  if (a[0] !== b[0]) return a[0] < b[0]
  if (a[1] !== b[1]) return a[1] < b[1]
  return a[2] < b[2]
}

export function evaluateCliffordField(x: number, y: number, z: number): CliffordField {
  const px = trigPair(x)
  const py = trigPair(y)
  const pz = trigPair(z)
  const values = Object.freeze([
    px.c * py.c * pz.c,
    px.s * py.c * pz.c,
    px.c * py.s * pz.c,
    px.c * py.c * pz.s,
    px.c * py.s * pz.s,
    -px.s * py.c * pz.s,
    px.s * py.s * pz.c,
    px.s * py.s * pz.s,
  ]) as readonly number[]
  const components: Record<BasisName, number> = {
    '1': values[0]!,
    I:   values[1]!,
    J:   values[2]!,
    K:   values[3]!,
    i:   values[4]!,
    j:   values[5]!,
    k:   values[6]!,
    L:   values[7]!,
  }
  return {
    x,
    y,
    z,
    components,
    values,
    norm: Math.hypot(...values),
  }
}

export function formatPrincipalCombination(field: CliffordField, digits = 4): string {
  const ranked = BASIS.map((spec, index) => ({ spec, index, abs: Math.abs(field.values[index]!) }))
  ranked.sort((a, b) => {
    const delta = b.abs - a.abs
    return Math.abs(delta) > TERM_EPS ? delta : b.index - a.index
  })
  const chosen = ranked.slice(0, 2).sort((a, b) => a.index - b.index)
  return formatTerms(field, chosen.map((item) => item.spec.name), digits)
}

export function formatAllCombination(field: CliffordField, digits = 4): string {
  return formatTerms(field, BASIS.map((spec) => spec.name), digits)
}

export function cubeCornerCarrier(ix: number, iy: number, iz: number): { name: BasisName; sign: 1 | -1 } {
  const field = evaluateCliffordField(ix, iy, iz)
  let best = 0
  for (let i = 1; i < field.values.length; i++) {
    if (Math.abs(field.values[i]!) > Math.abs(field.values[best]!)) best = i
  }
  return {
    name: BASIS[best]!.name,
    sign: field.values[best]! < 0 ? -1 : 1,
  }
}

export function integerPointsInsideDodecahedron(): readonly IntegerLabel[] {
  return INSIDE_DODECAHEDRON_LABELS
}

export function cubeCornerLabels(): readonly IntegerLabel[] {
  return CUBE_CORNER_LABELS
}

export function unitCubeVertices(): readonly Vec3[] {
  return UNIT_CUBE_VERTICES
}

export function unitCubeEdges(): readonly [Vec3, Vec3][] {
  return UNIT_CUBE_EDGES
}

export function rhombicDodecahedronForCube(origin: Vec3): RhombicDodecahedron {
  const [ox, oy, oz] = origin
  const cubeVerts = cubeVerticesForOrigin(ox, oy, oz)
  const axisVerts = axisVerticesForCube(ox, oy, oz)
  const vertices = Object.freeze([...cubeVerts, ...axisVerts])
  const edges: [Vec3, Vec3][] = []
  for (const cube of cubeVerts) {
    for (const axis of connectedAxisVertices(cube, axisVerts)) edges.push([cube, axis])
  }
  const faces = UNIT_CUBE_EDGES.map(([ua, ub]) => {
    const a = vec3(ox + ua[0], oy + ua[1], oz + ua[2])
    const b = vec3(ox + ub[0], oy + ub[1], oz + ub[2])
    const shared = connectedAxisVertices(a, axisVerts).filter((vertex) => (
      connectedAxisVertices(b, axisVerts).some((other) => vecKey(other) === vecKey(vertex))
    ))
    return Object.freeze([a, shared[0]!, b, shared[1]!])
  })
  return {
    center:   vec3(ox + HALF, oy + HALF, oz + HALF),
    vertices,
    edges:    Object.freeze(edges),
    faces:    Object.freeze(faces),
  }
}

export function tilingCellOrigins(extent: number): readonly Vec3[] {
  const origins: Vec3[] = []
  for (let i = -extent; i < extent; i++) {
    for (let j = -extent; j < extent; j++) {
      for (let k = -extent; k < extent; k++) {
        if (evenSum(i, j, k)) origins.push(vec3(i, j, k))
      }
    }
  }
  return Object.freeze(origins)
}

export function honeycombEdges(extent: number): readonly [Vec3, Vec3][] {
  const seen = new Set<string>()
  const edges: [Vec3, Vec3][] = []
  for (const origin of tilingCellOrigins(extent)) {
    for (const [a, b] of rhombicDodecahedronForCube(origin).edges) {
      const key = undirectedKey(a, b)
      if (seen.has(key)) continue
      seen.add(key)
      edges.push(sortedEdge(a, b))
    }
  }
  return Object.freeze(edges)
}

export function halfPoints(extent: number): readonly Vec3[] {
  const points: Vec3[] = []
  for (let ix = -2 * extent; ix <= 2 * extent; ix++) {
    for (let iy = -2 * extent; iy <= 2 * extent; iy++) {
      for (let iz = -2 * extent; iz <= 2 * extent; iz++) {
        if ((Math.abs(ix) + Math.abs(iy) + Math.abs(iz)) % 2 !== 1) continue
        points.push(vec3(ix / 2, iy / 2, iz / 2))
      }
    }
  }
  return Object.freeze(points)
}

export function familySegments(extent: number): readonly { family: LineFamily; a: Vec3; b: Vec3 }[] {
  const points = halfPoints(extent)
  const inRange = new Set(points.map(vecKey))
  const seen = new Set<string>()
  const segments: { family: LineFamily; a: Vec3; b: Vec3 }[] = []
  for (const point of points) {
    for (const offset of HALF_NEIGHBOR_OFFSETS) {
      const neighbor = add(point, offset)
      if (!inRange.has(vecKey(neighbor))) continue
      const key = undirectedKey(point, neighbor)
      if (seen.has(key)) continue
      seen.add(key)
      const [a, b] = sortedEdge(point, neighbor)
      segments.push({
        family: familyForDelta(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
        a,
        b,
      })
    }
  }
  return Object.freeze(segments)
}

export function snapPoint(point: Vec3, mode: SnapMode): Vec3 {
  if (mode === 'nothing') return point
  if (mode === 'integer') return vec3(Math.round(point[0]), Math.round(point[1]), Math.round(point[2]))
  const hx = Math.round(point[0] * 2) / 2
  const hy = Math.round(point[1] * 2) / 2
  const hz = Math.round(point[2] * 2) / 2
  let best: Vec3 | null = null
  let bestD = Infinity
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const candidate = vec3(hx + dx * HALF, hy + dy * HALF, hz + dz * HALF)
        if (Math.abs(fractionalMod1(candidate[0] + candidate[1] + candidate[2]) - HALF) > 1e-9) continue
        const d = distanceSquared(point, candidate)
        if (d < bestD - 1e-15 || (Math.abs(d - bestD) <= 1e-15 && (best === null || lexLess(candidate, best)))) {
          bestD = d
          best = candidate
        }
      }
    }
  }
  return best!
}

export function slicePlane(point: Vec3, axis: SliceAxis, size: number): { origin: Vec3; u: Vec3; v: Vec3; corners: readonly Vec3[] } {
  const u = axis === 'x' ? vec3(0, 1, 0) : vec3(1, 0, 0)
  const v = axis === 'z' ? vec3(0, 1, 0) : vec3(0, 0, 1)
  const h = size / 2
  const corners = Object.freeze([
    vec3(point[0] - h * u[0] - h * v[0], point[1] - h * u[1] - h * v[1], point[2] - h * u[2] - h * v[2]),
    vec3(point[0] + h * u[0] - h * v[0], point[1] + h * u[1] - h * v[1], point[2] + h * u[2] - h * v[2]),
    vec3(point[0] + h * u[0] + h * v[0], point[1] + h * u[1] + h * v[1], point[2] + h * u[2] + h * v[2]),
    vec3(point[0] - h * u[0] + h * v[0], point[1] - h * u[1] + h * v[1], point[2] - h * u[2] + h * v[2]),
  ])
  return { origin: point, u, v, corners }
}

export function setSliceCoordinate(point: Vec3, axis: SliceAxis, u: number, v: number): Vec3 {
  if (axis === 'x') return vec3(point[0], u, v)
  if (axis === 'y') return vec3(u, point[1], v)
  return vec3(u, v, point[2])
}

export function cameraPose(view: CameraView, target: Vec3): { position: Vec3; up: Vec3; target: Vec3 } {
  if (view === 'oblique') return { position: add(target, vec3(2.4, 2.1, 1.7)), up: vec3(0, 0, 1), target }
  if (view === 'x')       return { position: add(target, vec3(4, 0, 0)),       up: vec3(0, 0, 1), target }
  if (view === 'y')       return { position: add(target, vec3(0, 4, 0)),       up: vec3(0, 0, 1), target }
  return                       { position: add(target, vec3(0, 0, 4)),       up: vec3(0, 1, 0), target }
}

function integerLattice(extent: number): readonly Vec3[] {
  const points: Vec3[] = []
  for (let x = -extent; x <= extent; x++) {
    for (let y = -extent; y <= extent; y++) {
      for (let z = -extent; z <= extent; z++) points.push(vec3(x, y, z))
    }
  }
  return Object.freeze(points)
}

export function sceneModel(input: {
  point: Vec3
  mode: SpaceMode
  extent: number
  showGrid: boolean
  showDodecahedron: boolean
  showDots: boolean
  labels: LabelSet
}): {
  field: CliffordField
  cube: { vertices: readonly Vec3[]; edges: readonly [Vec3, Vec3][] }
  dodecahedron: RhombicDodecahedron | null
  honeycomb: readonly [Vec3, Vec3][]
  families: readonly { family: LineFamily; a: Vec3; b: Vec3 }[]
  dots: readonly Vec3[]
  labels: readonly IntegerLabel[]
  cellCount: number
} {
  const origins = tilingCellOrigins(input.extent)
  const honeycomb = input.mode === 'one-cube' || !input.showGrid
    ? Object.freeze([]) as readonly [Vec3, Vec3][]
    : honeycombEdges(input.extent)
  const families = input.mode === 'whole-space'
    ? familySegments(input.extent)
    : Object.freeze([]) as readonly { family: LineFamily; a: Vec3; b: Vec3 }[]
  const labels = input.labels === 'cube-corners'
    ? cubeCornerLabels()
    : input.labels === 'inside-dodecahedron'
      ? integerPointsInsideDodecahedron()
      : Object.freeze([]) as readonly IntegerLabel[]
  return {
    field:         evaluateCliffordField(input.point[0], input.point[1], input.point[2]),
    cube:          { vertices: unitCubeVertices(), edges: unitCubeEdges() },
    dodecahedron:  input.showDodecahedron ? rhombicDodecahedronForCube(vec3(0, 0, 0)) : null,
    honeycomb,
    families,
    dots:          input.showDots
      ? (input.mode === 'one-cube' ? unitCubeVertices() : integerLattice(input.extent))
      : Object.freeze([]),
    labels,
    cellCount:     input.mode === 'one-cube' ? 1 : origins.length,
  }
}
