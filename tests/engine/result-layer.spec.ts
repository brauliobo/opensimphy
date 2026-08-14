import * as THREE from 'three'
import { ResultLayer, turbo } from '../../src/simulation/result-layer'
import { displayGeometry, type ResultField, type SimulationScene } from '../../src/simulation/scene'

const scene = {
  source: 'gmsh-authoritative', referencePositions: new Float64Array([0, 0, 0, 2, 0, 0, 0, 2, 0]),
  surfaceTriangles: new Uint32Array([0, 1, 2]), triangleEntityTags: new Uint32Array([7]), triangleElementTags: new BigUint64Array([10n]), triangleRegionTags: new Uint32Array([0]),
  nodeTags: new BigUint64Array([1n, 2n, 3n]), nodeEntityDimensions: new Uint8Array([0, 0, 0]), nodeEntityTags: new Uint32Array([1, 2, 3]),
  entities: [], elementBlocks: [{ dimension: 2, entityTag: 7, elementType: 2, elementTags: new BigUint64Array([10n]), connectivity: new BigUint64Array([1n, 2n, 3n]) }],
  groups: [], fields: [], surfaceSignatures: [],
} satisfies SimulationScene

function layer(source: SimulationScene = scene) {
  const world = new THREE.Scene()
  const display = displayGeometry(source)
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(display.positions, 3))
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
  return { result: new ResultLayer(world, mesh, source, display), world, mesh }
}

const vectorField = {
  id: 'vector', name: 'vector', association: 'element', components: 3,
  values: new Float64Array([2, 0, 0, 0, 4, 0]), steps: new Int32Array([0, 1]), times: new Float64Array([0, 3]),
  ranges: new Float64Array([2, 2, 4, 4]), globalRange: [2, 4], tags: new BigUint64Array([10n]),
  provenance: { representation: 'list', sourceFile: 'e.pos', viewName: 'e', dataTypes: ['VT'], originalRecords: 1 },
} satisfies ResultField

describe('ResultLayer', () => {
  it('maps scalar colors by strict node tags and timestep', () => {
    const field = {
      id: 'scalar', name: 'scalar', association: 'node', components: 1,
      values: new Float64Array([0, 0.5, 1, 1, 0.5, 0]), steps: new Int32Array([0, 1]), times: new Float64Array([0, 2]),
      ranges: new Float64Array([0, 1, 0, 1]), globalRange: [0, 1], tags: new BigUint64Array([1n, 2n, 3n]),
      provenance: { representation: 'model', sourceFile: 'x.msh', viewName: 'scalar', modelName: 'm', dataTypes: ['NodeData'], originalRecords: 3 },
    } satisfies ResultField
    const { result, mesh } = layer()
    result.set(field, 1, 'global')
    const colors = Array.from((mesh.geometry.getAttribute('color') as THREE.BufferAttribute).array)
    expect(colors.slice(0, 3)).toEqual(expect.arrayContaining(turbo(1).toArray()))
    expect(result.getState()).toMatchObject({ step: 1, time: 2, range: [0, 1], glyphs: 0, deformationScale: 0 })
    expect(() => result.set({ ...field, tags: new BigUint64Array([1n, 1n, 3n]) }, 0, 'global')).toThrow('duplicate tag 1')
  })

  it('builds deterministic vector transforms, direction, magnitude color and timestep state', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { result } = layer()
    result.set(vectorField, 0, 'global')
    const first = result.getState()
    const matrix = new THREE.Matrix4().fromArray(first.glyphMatrices![0]!)
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3()
    matrix.decompose(position, quaternion, scale)
    expect(position.x).toBeCloseTo(2 / 3)
    expect(position.y).toBeCloseTo(2 / 3)
    expect(position.z).toBe(0)
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).toArray()[0]).toBeCloseTo(1)
    expect(scale.z).toBeCloseTo(first.glyphLengthRange![0])
    expect(scale.x).toBeCloseTo(first.glyphRadiusRange![0])
    expect(scale.x / scale.z).toBeCloseTo(0.12)
    expect(first.glyphLengthRange![0] / first.sceneDiagonal!).toBeGreaterThanOrEqual(0.003)
    expect(first.glyphLengthRange![1] / first.sceneDiagonal!).toBeLessThanOrEqual(0.04)
    expect(first.glyphColors![0]).toEqual(turbo(0).toArray())
    result.set(vectorField, 1, 'global')
    const second = result.getState()
    expect(second).toMatchObject({ step: 1, time: 3, glyphs: 1 })
    expect(second.glyphColors![0]).toEqual(turbo(1).toArray())
    vi.unstubAllGlobals()
  })

  it('scales microstrip, tiny, large and translated glyphs equivalently', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const microstrip = {
      ...scene,
      referencePositions: new Float64Array([0, 0, 0, 0.0002, 0, 0, 0, 0.0002, 0, 0.014, 0.002, 0]),
      nodeTags: new BigUint64Array([1n, 2n, 3n, 4n]),
      nodeEntityDimensions: new Uint8Array([0, 0, 0, 0]), nodeEntityTags: new Uint32Array([1, 2, 3, 4]),
    } satisfies SimulationScene
    const transform = (factor: number, offset: number) => ({
      ...microstrip,
      referencePositions: Float64Array.from(microstrip.referencePositions, (value) => value * factor + offset),
    })
    const metrics = [microstrip, transform(1e-9, 0), transform(1e9, 0), transform(1, 1e6)].map((source) => {
      const { result } = layer(source)
      result.set(vectorField, 1, 'global')
      const state = result.getState()
      return {
        lengthRatio: state.glyphLengthRange![0] / state.sceneDiagonal!,
        radiusRatio: state.glyphRadiusRange![0] / state.sceneDiagonal!,
        center: new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(state.glyphMatrices![0]!)),
      }
    })
    for (const metric of metrics) {
      expect(metric.lengthRatio).toBeGreaterThanOrEqual(0.003)
      expect(metric.lengthRatio).toBeLessThanOrEqual(0.04)
      expect(metric.radiusRatio / metric.lengthRatio).toBeCloseTo(0.12)
    }
    expect(metrics[1]!.lengthRatio).toBeCloseTo(metrics[0]!.lengthRatio)
    expect(metrics[2]!.lengthRatio).toBeCloseTo(metrics[0]!.lengthRatio)
    expect(metrics[3]!.lengthRatio).toBeCloseTo(metrics[0]!.lengthRatio)
    expect(metrics[3]!.center.x - metrics[0]!.center.x).toBeCloseTo(1e6)
    expect(metrics[3]!.center.y - metrics[0]!.center.y).toBeCloseTo(1e6)
    expect(metrics[3]!.center.z - metrics[0]!.center.z).toBeCloseTo(1e6)
    vi.unstubAllGlobals()
  })
})
