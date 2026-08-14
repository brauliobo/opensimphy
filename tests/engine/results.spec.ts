import { deterministicGlyphIndices, fieldCsv, fieldPos, fieldRange, probeField, probeScenePoint } from '../../src/simulation/results'
import type { ResultField, SimulationScene } from '../../src/simulation/scene'

const field = {
  id: 'v', name: 'potential', association: 'node', components: 1,
  values: new Float64Array([0, 1, 2, 2, 3, 4]), steps: new Int32Array([0, 1]), times: new Float64Array([0, 0.5]),
  ranges: new Float64Array([0, 2, 2, 4]), globalRange: [0, 4], tags: new BigUint64Array([1n, 2n, 3n]),
  provenance: { representation: 'list', sourceFile: 'v.pos', viewName: 'v', dataTypes: ['ST'], originalRecords: 1 },
} satisfies ResultField
const scene = {
  source: 'gmsh-authoritative', referencePositions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  surfaceTriangles: new Uint32Array([0, 1, 2]), triangleEntityTags: new Uint32Array([7]), triangleElementTags: new BigUint64Array([10n]),
  nodeTags: new BigUint64Array([1n, 2n, 3n]), nodeEntityDimensions: new Uint8Array([0, 0, 0]), nodeEntityTags: new Uint32Array([1, 2, 3]),
  entities: [], elementBlocks: [{ dimension: 2, entityTag: 7, elementType: 2, elementTags: new BigUint64Array([10n]), connectivity: new BigUint64Array([1n, 2n, 3n]) }],
  groups: [], fields: [field], surfaceSignatures: [],
} satisfies SimulationScene

describe('mapped result behavior', () => {
  it('uses global, per-step and validated custom ranges', () => {
    expect(fieldRange(field, 1, 'global')).toEqual([0, 4])
    expect(fieldRange(field, 1, 'step')).toEqual([2, 4])
    expect(fieldRange(field, 1, 'custom', [1, 3])).toEqual([1, 3])
    expect(() => fieldRange(field, 1, 'custom', [3, 1])).toThrow('increasing bounds')
  })

  it('probes nodal fields barycentrically with source tags', () => {
    expect(probeField(scene, field, 1, 0, [0.25, 0.25, 0])).toMatchObject({ values: [2.75], magnitude: 2.75, sourceElementTag: 10n, sourceNodeTags: [1n, 2n, 3n], time: 0.5 })
    expect(probeScenePoint(scene, field, 1, [0.25, 0.25, 0]).values).toEqual([2.75])
    expect(() => probeScenePoint(scene, field, 1, [0.25, 0.25, 1e-4])).toThrow('off the plane')
  })

  it('handles translated, tiny, edge and overlapping probe geometry deterministically', () => {
    const translate = 1e9
    const translated = { ...scene, referencePositions: Float64Array.from(scene.referencePositions, (value) => value + translate) }
    expect(probeScenePoint(translated, field, 0, [translate + 0.25, translate + 0.25, translate]).values[0]).toBeCloseTo(0.75)
    const tiny = { ...scene, referencePositions: Float64Array.from(scene.referencePositions, (value) => value * 1e-12) }
    expect(probeScenePoint(tiny, field, 0, [2.5e-13, 2.5e-13, 0]).values[0]).toBeCloseTo(0.75)
    expect(probeScenePoint(scene, field, 0, [0.5, 0.5, 0]).sourceTriangle).toBe(0)
    const overlap = {
      ...scene, surfaceTriangles: new Uint32Array([0, 1, 2, 0, 1, 2]), triangleEntityTags: new Uint32Array([7, 8]),
      triangleElementTags: new BigUint64Array([10n, 20n]),
      elementBlocks: [...scene.elementBlocks, { dimension: 2 as const, entityTag: 8, elementType: 2, elementTags: new BigUint64Array([20n]), connectivity: new BigUint64Array([1n, 2n, 3n]) }],
    }
    const element = { ...field, id: 'element', association: 'element' as const, values: new Float64Array([1, 2]), steps: new Int32Array([0]), times: new Float64Array([0]), ranges: new Float64Array([1, 2]), globalRange: [1, 2] as [number, number], tags: new BigUint64Array([10n, 20n]) }
    expect(() => probeScenePoint(overlap, element, 0, [0.25, 0.25, 0])).toThrow('overlaps 2 field elements')
    expect(probeScenePoint(overlap, field, 0, [0.25, 0.25, 0]).sourceElementTag).toBe(10n)
    const degenerate = { ...scene, referencePositions: new Float64Array([0, 0, 0, 1, 0, 0, 2, 0, 0]) }
    expect(() => probeScenePoint(degenerate, field, 0, [0.5, 0, 0])).toThrow('geometrically degenerate')
  })

  it('exports tagged timestep CSV and native parsed POS on demand', () => {
    const csv = fieldCsv(scene, field)
    expect(csv).toContain('field,representation,model_name,association,step,time,sample,tag,element_tag,local_index,node_tag,x,y,z,connectivity,entity_dimension,entity_tag,component_1')
    expect(csv).toContain('potential,list,,node,1,0.5,2,3,,,3,0,1,0,,0,3,4')
    const pos = fieldPos(scene, field)
    expect(pos).toContain('SP(0,0,0){0,2}; // node 1')
    expect(pos).toContain('TIME{0,0.5};')
  })

  it('exports complete element, element-node and independent identity to CSV and POS', () => {
    const elementNode = {
      ...field, id: 'en', name: 'element-node', association: 'element-node' as const, components: 1 as const,
      values: new Float64Array([5, 6, 7]), steps: new Int32Array([0]), times: new Float64Array([4]), ranges: new Float64Array([5, 7]), globalRange: [5, 7] as [number, number],
      tags: new BigUint64Array([10n]), connectivity: new BigUint64Array([1n, 2n, 3n]),
    }
    const csv = fieldCsv(scene, elementNode)
    expect(csv).toContain('element-node,list,,element-node,0,4,0,10,10,0,1,0,0,0,1 2 3,2,7,5')
    expect(csv).toContain('element-node,list,,element-node,0,4,0,10,10,2,3,0,1,0,1 2 3,2,7,7')
    expect(fieldPos(scene, elementNode)).toContain('ST(0,0,0,1,0,0,0,1,0){5,6,7}; // element 10')
    const independent = {
      ...field, id: 'cut', name: 'cut', association: 'independent' as const, components: 3 as const,
      values: new Float64Array([1, 2, 3, 4, 5, 6]), steps: new Int32Array([0]), times: new Float64Array([9]), ranges: new Float64Array([Math.sqrt(14), Math.sqrt(77)]), globalRange: [Math.sqrt(14), Math.sqrt(77)] as [number, number],
      tags: undefined, coordinates: new Float64Array([0.2, 0.3, 0, 0.4, 0.5, 0]),
    }
    expect(fieldCsv(scene, independent)).toContain('cut,list,,independent,0,9,1,1,,1,,0.4,0.5,0,,,,4,5,6')
    expect(fieldPos(scene, independent)).toContain('VP(0.4,0.5,0){4,5,6}; // independent 1')
  })

  it('decimates vectors deterministically for mobile', () => {
    expect([...deterministicGlyphIndices(5, true)]).toEqual([0, 1, 2, 3, 4])
    const first = deterministicGlyphIndices(1000, true)
    expect(first).toHaveLength(192)
    expect([...deterministicGlyphIndices(1000, true)]).toEqual([...first])
  })
})
