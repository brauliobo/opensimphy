import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expandHomogeneousModelStep, parseParsedPosView, parsePosTimes, normalizeListView, normalizeModelView } from '../../src/simulation/view-normalizer'
import x4 from '../../tools/wasm/fixtures/gmsh-x4-model-data.json'
import view2Provenance from '../../tools/wasm/fixtures/view2.provenance.json'

const triangleMesh = {
  positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]),
  nodeTags: new BigUint64Array([10n, 20n, 30n, 40n]),
  elementBlocks: [{ dimension: 2 as const, entityTag: 7, elementType: 2, elementTags: new BigUint64Array([100n, 200n]), connectivity: new BigUint64Array([10n, 20n, 30n, 20n, 40n, 30n]) }],
}

function triangleRecord(points: number[][], steps: number[][]) {
  return [...points.map((point) => point[0]), ...points.map((point) => point[1]), ...points.map((point) => point[2]), ...steps.flat()]
}

describe('strict Gmsh list view normalization', () => {
  it('parses the full timestep stride and losslessly collapses nodal and element values', () => {
    const first = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
    const second = [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
    const scalar = normalizeListView(triangleMesh, {
      name: 'v', sourceFile: 'v.pos', dataType: ['ST'], numElements: [2], times: [2, 4],
      data: [[...triangleRecord(first, [[1, 2, 3], [2, 4, 6]]), ...triangleRecord(second, [[2, 4, 3], [4, 8, 6]])]],
    })[0]!
    expect(scalar).toMatchObject({ association: 'node', components: 1, globalRange: [1, 8] })
    expect([...scalar.values]).toEqual([1, 2, 3, 4, 2, 4, 6, 8])
    expect([...scalar.times]).toEqual([2, 4])

    const vector = normalizeListView(triangleMesh, {
      name: 'e', sourceFile: 'e.pos', dataType: ['VT'], numElements: [2],
      data: [[...triangleRecord(first, [Array(3).fill([1, 2, 3]).flat()]), ...triangleRecord(second, [Array(3).fill([4, 5, 6]).flat()])]],
    })[0]!
    expect(vector.association).toBe('element')
    expect([...vector.tags!]).toEqual([100n, 200n])
    expect([...vector.values]).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('preserves non-collapsible element-node values and independent cut points', () => {
    const field = normalizeListView(triangleMesh, {
      name: 'partial', sourceFile: 'partial.pos', dataType: ['ST'], numElements: [1],
      data: [triangleRecord([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[1, 2, 3]])],
    })[0]!
    expect(field.association).toBe('element-node')
    expect([...field.connectivity!]).toEqual([10n, 20n, 30n])

    const cut = normalizeListView(triangleMesh, { name: 'cut', sourceFile: 'cut.pos', dataType: ['VP'], numElements: [2], data: [[0.2, 0.2, 0, 1, 2, 3, 0.4, 0.2, 0, 4, 5, 6]] })[0]!
    expect(cut.association).toBe('independent')
    expect([...cut.coordinates!]).toEqual([0.2, 0.2, 0, 0.4, 0.2, 0])
  })

  it('rejects malformed strides, ambiguous mesh coordinates and inconsistent nodal duplicates', () => {
    expect(() => normalizeListView(triangleMesh, { name: 'bad', sourceFile: 'bad.pos', dataType: ['ST'], numElements: [2], data: [[1, 2, 3]] })).toThrow('invalid full-timestep stride')
    const ambiguous = { ...triangleMesh, positions: new Float64Array([0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0]) }
    expect(() => normalizeListView(ambiguous, { name: 'bad', sourceFile: 'bad.pos', dataType: ['ST'], numElements: [1], data: [triangleRecord([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[1, 2, 3]])] })).toThrow('maps to 2 authoritative nodes')
    const first = [[0, 0, 0], [1, 0, 0], [0, 1, 0]], second = [[1, 0, 0], [1, 1, 0], [0, 1, 0]]
    expect(() => normalizeListView(triangleMesh, { name: 'bad', sourceFile: 'bad.pos', dataType: ['ST'], numElements: [2], data: [[...triangleRecord(first, [[1, 2, 3]]), ...triangleRecord(second, [[99, 4, 3]])]] })).toThrow('inconsistent duplicate values')
  })

  it('pins authentic upstream five-step Gmsh coverage without claiming GetDP transience', () => {
    const source = readFileSync('tools/wasm/fixtures/view2.pos', 'utf8')
    expect(Buffer.byteLength(source)).toBe(view2Provenance.bytes)
    expect(createHash('sha256').update(source).digest('hex')).toBe(view2Provenance.sha256)
    expect(parsePosTimes(source)).toEqual([100, 200, 300, 400, 500])
    expect(source).toContain('This view contains a vector field defined on points, with 5 time steps.')
    expect(source.match(/\bVP\(/g)).toHaveLength(341)
    const parsed = parseParsedPosView(source, 'upstream-view2', 'view2.pos')
    const normalized = normalizeListView(triangleMesh, parsed)
    expect(normalized).toHaveLength(1)
    expect(normalized[0]).toMatchObject({ association: 'independent', components: 3, provenance: { representation: 'list', sourceFile: 'view2.pos', dataTypes: ['VP'], originalRecords: 341 } })
    expect([...normalized[0]!.steps]).toEqual([0, 1, 2, 3, 4])
    expect([...normalized[0]!.times]).toEqual([100, 200, 300, 400, 500])
    expect(normalized[0]!.values).toHaveLength(341 * 5 * 3)
    expect([...normalized[0]!.ranges]).toEqual([0.00063643529, 3880596.9, 0.00038661946, 3880622.3, 0.0031765239, 3880662.8, 0.0044392302, 3880737.8, 0.0056895141, 3880625.5])
  })

  it('expands homogeneous node, element and element-node model layouts', () => {
    expect(expandHomogeneousModelStep(triangleMesh, { dataType: 'NodeData', tags: [10, 20], data: [1, 2], time: 0, numComponents: 1 }).data).toEqual([[1], [2]])
    expect(expandHomogeneousModelStep(triangleMesh, { dataType: 'ElementData', tags: [100], data: [1, 2, 3], time: 0, numComponents: 3 }).data).toEqual([[1, 2, 3]])
    expect(expandHomogeneousModelStep(triangleMesh, { dataType: 'ElementNodeData', tags: [100], data: [1, 2, 3], time: 0, numComponents: 1 }).data).toEqual([[1, 2, 3]])
    expect(() => expandHomogeneousModelStep(triangleMesh, { dataType: 'ElementNodeData', tags: [100], data: [1], time: 0, numComponents: 1 })).toThrow('invalid flattened values')
  })

  it('normalizes authentic model representations without losing tags, layout or time', () => {
    const node = normalizeModelView(triangleMesh, {
      name: 'temperature', sourceFile: 'model.msh', modelName: 'authoritative',
      steps: [
        { dataType: 'NodeData', tags: [10, 20, 30, 40], data: [[1], [2], [3], [4]], time: 0, numComponents: 1 },
        { dataType: 'NodeData', tags: [10, 20, 30, 40], data: [[2], [4], [6], [8]], time: 2.5, numComponents: 1 },
      ],
    })
    expect(node).toMatchObject({ association: 'node', components: 1, globalRange: [1, 8] })
    expect(node.provenance).toEqual({ representation: 'model', sourceFile: 'model.msh', viewName: 'temperature', modelName: 'authoritative', dataTypes: ['NodeData'], originalRecords: 4 })
    expect([...node.tags!]).toEqual([10n, 20n, 30n, 40n])
    expect([...node.times]).toEqual([0, 2.5])

    const elementNode = normalizeModelView(triangleMesh, {
      name: 'flux', sourceFile: 'model.msh', modelName: 'authoritative',
      steps: [{ dataType: 'ElementNodeData', tags: [100, 200], data: [[1, 0, 0, 2, 0, 0, 3, 0, 0], [4, 0, 0, 5, 0, 0, 6, 0, 0]], time: 7, numComponents: 3 }],
    })
    expect(elementNode.association).toBe('element-node')
    expect([...elementNode.connectivity!]).toEqual([10n, 20n, 30n, 20n, 40n, 30n])
    expect([...elementNode.ranges]).toEqual([1, 6])
  })

  it('normalizes all steps from the pinned authentic upstream x4 model fixture', () => {
    const mesh = {
      positions: new Float64Array(x4.nodes.coordinates), nodeTags: BigUint64Array.from(x4.nodes.tags.map(BigInt)),
      elementBlocks: [{ dimension: 2 as const, entityTag: 1, elementType: x4.elements.type, elementTags: BigUint64Array.from(x4.elements.tags.map(BigInt)), connectivity: BigUint64Array.from(x4.elements.connectivity.map(BigInt)) }],
    }
    const node = normalizeModelView(mesh, {
      name: 'Continuous', sourceFile: 'x4_t1.msh', modelName: x4.modelName,
      steps: Array.from({ length: x4.steps }, (_, step) => ({ dataType: 'NodeData' as const, tags: x4.nodes.tags, data: [[10], [10], [12 + step], [13 + step]], time: step, numComponents: 1 })),
    })
    expect(node.provenance).toMatchObject({ representation: 'model', modelName: 'simple model', dataTypes: ['NodeData'] })
    expect([...node.ranges]).toEqual([10, 13, 10, 14, 10, 15, 10, 16, 10, 17, 10, 18, 10, 19, 10, 20, 10, 21, 10, 22])
    const discontinuous = normalizeModelView(mesh, {
      name: 'Discontinuous', sourceFile: 'x4_t2.msh', modelName: x4.modelName,
      steps: Array.from({ length: x4.steps }, (_, step) => ({ dataType: 'ElementNodeData' as const, tags: x4.elements.tags, data: [[10, 10, 12 + step], [14, 15, 13 + step]], time: step, numComponents: 1 })),
    })
    expect(discontinuous.association).toBe('element-node')
    expect([...discontinuous.ranges]).toEqual([10, 15, 10, 15, 10, 15, 10, 16, 10, 17, 10, 18, 10, 19, 10, 20, 10, 21, 10, 22])
  })

  it('indexes translated and tiny meshes by extent while rejecting coordinate and connectivity ambiguity', () => {
    const translated = { ...triangleMesh, positions: Float64Array.from(triangleMesh.positions, (value) => value + 1e9) }
    const field = normalizeListView(translated, {
      name: 'translated', sourceFile: 'translated.pos', dataType: ['ST'], numElements: [1],
      data: [triangleRecord([[1e9, 1e9, 1e9], [1e9 + 1, 1e9, 1e9], [1e9, 1e9 + 1, 1e9]], [[1, 2, 3]])],
    })[0]!
    expect(field.association).toBe('element-node')
    const tiny = { ...triangleMesh, positions: Float64Array.from(triangleMesh.positions, (value) => value * 1e-12) }
    expect(normalizeListView(tiny, {
      name: 'tiny', sourceFile: 'tiny.pos', dataType: ['ST'], numElements: [1],
      data: [triangleRecord([[0, 0, 0], [1e-12, 0, 0], [0, 1e-12, 0]], [[1, 2, 3]])],
    })[0]!.association).toBe('element-node')
    const duplicateElement = { ...triangleMesh, elementBlocks: [...triangleMesh.elementBlocks, { ...triangleMesh.elementBlocks[0]!, elementTags: new BigUint64Array([300n]), connectivity: new BigUint64Array([30n, 20n, 10n]) }] }
    expect(() => normalizeListView(duplicateElement, {
      name: 'ambiguous', sourceFile: 'ambiguous.pos', dataType: ['ST'], numElements: [1], data: [triangleRecord([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[1, 2, 3]])],
    })).toThrow('maps to 2 authoritative elements')
  })
})
