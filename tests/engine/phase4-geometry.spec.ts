import { deformedDisplayPositions, marchingTetraCases, marchingTriangleCases, surfaceContours, tetraIsosurface, tetraVolumeSections } from '../../src/simulation/derived-geometry'
import { PhysicalGroupEditor } from '../../src/simulation/physical-groups'
import { displayGeometry, type ResultField, type SimulationScene } from '../../src/simulation/scene'

const scene = {
  source: 'gmsh-authoritative',
  referencePositions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  surfaceTriangles: new Uint32Array([0, 1, 2]), triangleEntityTags: new Uint32Array([7]), triangleElementTags: new BigUint64Array([20n]),
  nodeTags: new BigUint64Array([1n, 2n, 3n, 4n]), nodeEntityDimensions: new Uint8Array([0, 0, 0, 0]), nodeEntityTags: new Uint32Array([1, 2, 3, 4]),
  entities: [{ dimension: 2, tag: 7, bounds: [0, 0, 0, 1, 1, 0], physicalTags: new Uint32Array() }, { dimension: 3, tag: 8, bounds: [0, 0, 0, 1, 1, 1], physicalTags: new Uint32Array() }],
  elementBlocks: [{ dimension: 3, entityTag: 8, elementType: 4, elementTags: new BigUint64Array([20n]), connectivity: new BigUint64Array([1n, 2n, 3n, 4n]) }],
  groups: [], fields: [], surfaceSignatures: [],
} satisfies SimulationScene

const scalar = {
  id: 's', name: 'scalar', association: 'node', components: 1, values: new Float64Array([0, 1, 1, 1]),
  steps: new Int32Array([0]), times: new Float64Array([0]), ranges: new Float64Array([0, 1]), globalRange: [0, 1], tags: scene.nodeTags,
  provenance: { representation: 'model', sourceFile: 's.pos', viewName: 's', modelName: 'm', dataTypes: ['NodeData'], originalRecords: 4 },
} satisfies ResultField

describe('Phase 4 derived geometry', () => {
  it('deforms only explicit displacement fields from immutable reference coordinates', () => {
    const display = displayGeometry(scene)
    const displacement = { ...scalar, id: 'u', name: 'u', components: 3, values: new Float64Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]), role: 'displacement' } satisfies ResultField
    expect([...deformedDisplayPositions(scene, display, displacement, 0, 2).slice(0, 3)]).toEqual([2, 0, 0])
    expect([...scene.referencePositions.slice(0, 3)]).toEqual([0, 0, 0])
    expect(() => deformedDisplayPositions(scene, display, { ...displacement, role: 'field' }, 0, 1)).toThrow('not a true displacement')
  })

  it('preserves source tags on contours, tetra isosurfaces and multiple sections', () => {
    expect([...surfaceContours(scene, scalar, 0, [0.5]).sourceTags]).toEqual([20n])
    const iso = tetraIsosurface(scene, scalar, 0, 0.5)
    expect(iso.triangles.length).toBeGreaterThan(0)
    expect([...iso.sourceElementTags]).toEqual([20n])
    expect([...iso.sourceEntityTags]).toEqual([8])
    const discontinuous = {
      ...scalar, id: 'local', association: 'element-node', tags: new BigUint64Array([20n]), connectivity: new BigUint64Array([1n, 2n, 3n, 4n]),
    } satisfies ResultField
    expect(tetraIsosurface(scene, discontinuous, 0, 0.5).triangles.length).toBeGreaterThan(0)
    const sections = tetraVolumeSections(scene, [{ normal: [1, 0, 0], constant: -0.2 }, { normal: [0, 1, 0], constant: -0.2 }])
    expect(sections).toHaveLength(2)
    expect(sections.every(({ sourceElementTags }) => sourceElementTags[0] === 20n)).toBe(true)
    const highOrder = { ...scene, elementBlocks: [{ ...scene.elementBlocks[0]!, elementType: 11 }] }
    expect(() => tetraVolumeSections(highOrder, [{ normal: [1, 0, 0], constant: 0 }])).toThrow('only linear tetrahedra')
  })

  it('exhausts deterministic triangle and tetra cases, removes degeneracy and stitches duplicate tetrahedra', () => {
    expect(marchingTriangleCases).toHaveLength(8)
    for (let mask = 0; mask < marchingTriangleCases.length; mask++) {
      const field = { ...scalar, values: Float64Array.from({ length: 4 }, (_, node) => mask & (1 << node) ? 1 : 0) }
      expect(surfaceContours(scene, field, 0, [0.5]).positions.length / 6).toBe(marchingTriangleCases[mask]!.length / 2)
    }
    expect(marchingTetraCases).toHaveLength(16)
    for (let mask = 0; mask < marchingTetraCases.length; mask++) {
      const field = { ...scalar, values: Float64Array.from({ length: 4 }, (_, node) => mask & (1 << node) ? 1 : 0) }
      const first = tetraIsosurface(scene, field, 0, 0.5)
      const second = tetraIsosurface(scene, field, 0, 0.5)
      expect(first.triangles.length / 3).toBe(marchingTetraCases[mask]!.length / 3)
      expect([...first.positions]).toEqual([...second.positions])
      expect([...first.triangles]).toEqual([...second.triangles])
    }
    const level = { ...scalar, values: new Float64Array([0.5, 0.5, 0.5, 0.5]) }
    expect(tetraIsosurface(scene, level, 0, 0.5)).toMatchObject({ positions: new Float64Array(), triangles: new Uint32Array() })
    expect(surfaceContours(scene, level, 0, [0.5]).positions).toEqual(new Float64Array())
    const duplicated = {
      ...scene,
      elementBlocks: [{ ...scene.elementBlocks[0]!, elementTags: new BigUint64Array([21n, 20n]), connectivity: new BigUint64Array([1n, 2n, 3n, 4n, 1n, 2n, 3n, 4n]) }],
    }
    const stitched = tetraIsosurface(duplicated, scalar, 0, 0.5)
    expect(stitched.triangles).toHaveLength(3)
    expect([...stitched.sourceElementTags]).toEqual([20n])
  })
})

describe('physical-group sidecars', () => {
  it('keeps stable ids through rename, membership, serialization, reload and remesh', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'stable-id' })
    const editor = new PhysicalGroupEditor('fixture')
    const id = editor.add(2, 'wall', [7])
    editor.rename(id, 'boundary')
    editor.setMembership(id, [7, 7])
    const loaded = PhysicalGroupEditor.load(JSON.stringify(editor.sidecar()), 'fixture')
    expect(loaded.sidecar().groups).toEqual([{ id: 'stable-id', dimension: 2, tag: 10000, name: 'boundary', entityTags: [7] }])
    expect(loaded.apply(scene)[0]).toMatchObject({ name: 'boundary', entityTags: new Uint32Array([7]) })
    loaded.delete(id)
    expect(loaded.sidecar().groups).toEqual([])
    loaded.add(3, 'volume', [8]); loaded.reset()
    expect(loaded.sidecar().groups).toEqual([])
    expect(() => PhysicalGroupEditor.load('{"schema":1,"projectId":"other","groups":[]}', 'fixture')).toThrow('identity is invalid')
    expect(() => PhysicalGroupEditor.load('{"schema":1,"projectId":"fixture","groups":[{"id":"x","dimension":2,"tag":1,"name":"bad","entityTags":[]}] }', 'fixture')).toThrow('requires a stable id')
    vi.unstubAllGlobals()
  })
})
