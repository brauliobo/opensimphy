import { cubeDirichletSpectrum, solveLaplaceEigen } from '../../src/simulation/eigen'
import type { SimulationScene } from '../../src/simulation/scene'

function gridScene(divisions: number): SimulationScene {
  const n = divisions + 1
  const positions: number[] = []
  const nodeTags: bigint[] = []
  const dimensions: number[] = []
  const nodeEntityTags: number[] = []
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    positions.push(i / divisions, j / divisions, 0)
    nodeTags.push(BigInt(j * n + i + 1))
    const boundary = i === 0 || j === 0 || i === divisions || j === divisions
    dimensions.push(boundary ? 1 : 2)
    nodeEntityTags.push(boundary ? 1 : 2)
  }
  const triangles: number[] = []
  const elementTags: bigint[] = []
  const connectivity: bigint[] = []
  let element = 1n
  for (let j = 0; j < divisions; j++) for (let i = 0; i < divisions; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1
    triangles.push(a, b, d, a, d, c)
    connectivity.push(nodeTags[a]!, nodeTags[b]!, nodeTags[d]!, nodeTags[a]!, nodeTags[d]!, nodeTags[c]!)
    elementTags.push(element, element + 1n)
    element += 2n
  }
  const count = elementTags.length
  return {
    source: 'gmsh-authoritative',
    referencePositions: Float64Array.from(positions),
    surfaceTriangles: Uint32Array.from(triangles),
    triangleEntityTags: Uint32Array.from({ length: count }, () => 2),
    triangleElementTags: BigUint64Array.from(elementTags),
    triangleRegionTags: new Uint32Array(count),
    nodeTags: BigUint64Array.from(nodeTags),
    nodeEntityDimensions: Uint8Array.from(dimensions),
    nodeEntityTags: Uint32Array.from(nodeEntityTags),
    entities: [{ dimension: 2, tag: 2, bounds: [0, 0, 0, 1, 1, 0], physicalTags: new Uint32Array() }],
    elementBlocks: [{ dimension: 2, entityTag: 2, elementType: 2, elementTags: BigUint64Array.from(elementTags), connectivity: BigUint64Array.from(connectivity) }],
    groups: [],
    fields: [],
    surfaceSignatures: [],
  }
}

describe('bounded P1 Laplace eigen', () => {
  it('returns the analytical cube Dirichlet spectrum in increasing order', () => {
    expect(cubeDirichletSpectrum(1, 4)[0]).toBeCloseTo(3 * Math.PI ** 2, 12)
    expect(cubeDirichletSpectrum(20, 1)[0]).toBeCloseTo(3 * Math.PI ** 2 / 400, 12)
  })

  it('solves a coarse unit-square Dirichlet problem with a small residual', () => {
    const solved = solveLaplaceEigen(gridScene(4), 3)
    expect(solved.freeNodes).toBe(9)
    expect(solved.modes).toHaveLength(3)
    expect(solved.modes[0]!.value).toBeGreaterThan(10)
    expect(solved.modes[0]!.value).toBeLessThan(40)
    expect(solved.modes[1]!.value).toBeGreaterThan(solved.modes[0]!.value)
    expect(solved.modes[2]!.value).toBeGreaterThan(solved.modes[1]!.value)
    expect(solved.modes[0]!.residual).toBeLessThan(1e-4)
    for (const mode of solved.modes) expect(mode.residual).toBeLessThan(5e-3)
    expect(solved.field.association).toBe('node')
    expect(solved.field.values.length).toBe(solved.nodes * 3)
  })
})
