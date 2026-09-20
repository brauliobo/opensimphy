import {
  cubeCornerCarrier,
  cubeCornerLabels,
  evaluateCliffordField,
  familySegments,
  formatAllCombination,
  formatPrincipalCombination,
  halfPoints,
  honeycombEdges,
  integerPointsInsideDodecahedron,
  rhombicDodecahedronForCube,
  sceneModel,
  snapPoint,
  tilingCellOrigins,
} from '../../src/clifford-space/cliffordSpaceEngine'

describe('clifford-space Cl(3) honeycomb engine', () => {
  it('evaluates the origin as the scalar 1 with unit hypot', () => {
    const field = evaluateCliffordField(0, 0, 0)

    expect(field.components['1']).toBeCloseTo(1, 12)
    expect(field.components.I).toBeCloseTo(0, 12)
    expect(field.components.J).toBeCloseTo(0, 12)
    expect(field.components.K).toBeCloseTo(0, 12)
    expect(field.components.i).toBeCloseTo(0, 12)
    expect(field.components.j).toBeCloseTo(0, 12)
    expect(field.components.k).toBeCloseTo(0, 12)
    expect(field.components.L).toBeCloseTo(0, 12)
    expect(field.norm).toBeCloseTo(1, 12)
    expect(formatPrincipalCombination(field)).toBe('1.0000')
    expect(formatAllCombination(field)).toBe('1.0000')
  })

  it('splits equally at the cube center and prints k + L as the tied principal pair', () => {
    const field = evaluateCliffordField(0.5, 0.5, 0.5)
    const expected = Math.SQRT2 / 4

    for (const value of field.values) expect(Math.abs(value)).toBeCloseTo(expected, 12)
    expect(field.norm).toBeCloseTo(1, 12)
    expect(formatPrincipalCombination(field)).toBe('0.3536 k + 0.3536 L')
  })

  it('carries −j at the (1,0,1) cube corner', () => {
    expect(cubeCornerCarrier(1, 0, 1)).toEqual({ name: 'j', sign: -1 })
    expect(formatPrincipalCombination(evaluateCliffordField(1, 0, 1))).toBe('-1.0000 j')
  })

  it('lists 33 integer points inside the origin rhombic dodecahedron', () => {
    const labels = integerPointsInsideDodecahedron()
    const keys = new Set(labels.map((label) => label.point.join(',')))

    expect(labels).toHaveLength(33)
    expect(keys.has('0,0,0')).toBe(true)
    expect(keys.has('2,0,0')).toBe(true)
    expect(keys.has('-2,0,0')).toBe(true)
    expect(keys.has('0,2,0')).toBe(true)
    expect(keys.has('0,0,2')).toBe(true)
    expect(keys.has('1,1,1')).toBe(true)
    expect(keys.has('-1,-1,-1')).toBe(true)
    expect(keys.has('1,1,0')).toBe(true)
    expect(keys.has('1,0,1')).toBe(true)
    expect(keys.has('0,1,1')).toBe(true)
  })

  it('keeps the sum of squares of the eight components equal to 1 on a random grid', () => {
    let seed = 20260920
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const points = Array.from({ length: 24 }, () => [ -2 + 4 * next(), -2 + 4 * next(), -2 + 4 * next() ] as const)

    expect(points).toHaveLength(24)
    for (const [x, y, z] of points) {
      const field = evaluateCliffordField(x, y, z)
      const sumSquares = field.values.reduce((total, value) => total + value * value, 0)
      expect(sumSquares).toBeCloseTo(1, 12)
      expect(field.norm).toBeCloseTo(1, 12)
    }
  })

  it('selects even-sum Steinhaus cubes at extent 1 and unique honeycomb edges', () => {
    const origins = tilingCellOrigins(1)
    const keys = origins.map((origin) => origin.join(','))
    const edges = honeycombEdges(2)
    const edgeKeys = edges.map(([a, b]) => {
      const ka = a.join(',')
      const kb = b.join(',')
      return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    })

    expect(origins).toHaveLength(4)
    expect(keys.sort()).toEqual(['-1,-1,0', '-1,0,-1', '0,-1,-1', '0,0,0'].sort())
    for (const [i, j, k] of origins) {
      expect(i).toBeGreaterThanOrEqual(-1)
      expect(i).toBeLessThan(1)
      expect((i + j + k) % 2 === 0).toBe(true)
    }
    expect(edgeKeys).toHaveLength(new Set(edgeKeys).size)
    expect(edges.length).toBeGreaterThan(0)
  })

  it('places FCC half-points and gives interior sites 12 neighbors at distance √(1/2)', () => {
    const extent = 3
    const points = halfPoints(extent)
    const keys = new Set(points.map((point) => point.join(',')))
    const listed = points.filter((point) => (
      (point[0] === 0.5 && point[1] === 0 && point[2] === 0)
      || (point[0] === 0.5 && point[1] === 0.5 && point[2] === 0.5)
    ))
    const interior = points.filter((point) => point.every((coord) => Math.abs(coord) <= extent - 0.5))

    expect(keys.has('0.5,0,0')).toBe(true)
    expect(keys.has('0.5,0.5,0.5')).toBe(true)
    expect(listed).toHaveLength(2)

    for (const point of interior) {
      const neighbors = points.filter((other) => {
        const d2 = (other[0] - point[0]) ** 2 + (other[1] - point[1]) ** 2 + (other[2] - point[2]) ** 2
        return Math.abs(d2 - 0.5) < 1e-9
      })
      expect(neighbors).toHaveLength(12)
    }

    const segments = familySegments(extent)
    const degree = (target: readonly [number, number, number]) => segments.filter(({ a, b }) => (
      a.join(',') === target.join(',') || b.join(',') === target.join(',')
    )).length
    expect(degree([0.5, 0, 0])).toBe(12)
    expect(degree([0.5, 0.5, 0.5])).toBe(12)
  })

  it('labels all eight unit-cube corners', () => {
    const labels = cubeCornerLabels()
    const byPoint = Object.fromEntries(labels.map((label) => [label.point.join(','), label]))

    expect(labels).toHaveLength(8)
    expect(byPoint['0,0,0']).toMatchObject({ name: '1', sign: 1, text: '1' })
    expect(byPoint['1,0,0']).toMatchObject({ name: 'I', sign: 1, text: 'I' })
    expect(byPoint['0,1,0']).toMatchObject({ name: 'J', sign: 1, text: 'J' })
    expect(byPoint['0,0,1']).toMatchObject({ name: 'K', sign: 1, text: 'K' })
    expect(byPoint['0,1,1']).toMatchObject({ name: 'i', sign: 1, text: 'i' })
    expect(byPoint['1,0,1']).toMatchObject({ name: 'j', sign: -1, text: '-j' })
    expect(byPoint['1,1,0']).toMatchObject({ name: 'k', sign: 1, text: 'k' })
    expect(byPoint['1,1,1']).toMatchObject({ name: 'L', sign: 1, text: 'L' })
  })

  it('builds a 14-vertex rhombic dodecahedron with the outward +x apex', () => {
    const cell = rhombicDodecahedronForCube([0, 0, 0])

    expect(cell.vertices).toHaveLength(14)
    expect(cell.edges).toHaveLength(24)
    expect(cell.faces).toHaveLength(12)
    expect(cell.faces.every((face) => face.length === 4)).toBe(true)
    expect(cell.vertices.some((vertex) => vertex[0] === 1.5 && vertex[1] === 0.5 && vertex[2] === 0.5)).toBe(true)
    expect(cell.center).toEqual([0.5, 0.5, 0.5])
  })

  it('snaps to integer lattice points and to FCC half-points', () => {
    expect(snapPoint([1.2, -0.6, 0.4], 'nothing')).toEqual([1.2, -0.6, 0.4])
    expect(snapPoint([1.2, -0.6, 0.4], 'integer')).toEqual([1, -1, 0])
    expect(snapPoint([0.4, 0.1, 0.05], 'half-points')).toEqual([0.5, 0, 0])
    expect(snapPoint([0.4, 0.4, 0.4], 'half-points')).toEqual([0.5, 0.5, 0.5])
  })

  it('fills honeycomb in whole-space and tiling, and keeps it empty in one-cube', () => {
    const base = {
      point:            [0.5, 0.5, 0.5] as const,
      extent:           2,
      showDodecahedron: true,
      showDots:         false,
      labels:           'none' as const,
    }
    const oneCube   = sceneModel({ ...base, mode: 'one-cube',    showGrid: true })
    const whole     = sceneModel({ ...base, mode: 'whole-space', showGrid: true })
    const tiling    = sceneModel({ ...base, mode: 'tiling',      showGrid: true })
    const ungirded  = sceneModel({ ...base, mode: 'whole-space', showGrid: false })

    expect(oneCube.honeycomb).toHaveLength(0)
    expect(oneCube.families).toHaveLength(0)
    expect(whole.honeycomb.length).toBeGreaterThan(0)
    expect(whole.families.length).toBeGreaterThan(0)
    expect(tiling.honeycomb.length).toBeGreaterThan(0)
    expect(tiling.honeycomb).toHaveLength(whole.honeycomb.length)
    expect(tiling.families).toHaveLength(0)
    expect(ungirded.honeycomb).toHaveLength(0)
    expect(ungirded.cube.edges).toHaveLength(12)
  })
})
