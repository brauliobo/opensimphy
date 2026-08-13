import { displayGeometry, matchSurfaceSignatures, sceneTransferables, surfaceSignatures, type SimulationScene } from '../../src/simulation/scene'

const positions = new Float64Array([
  -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0,
  -1, -1, 2, 1, -1, 2, 1, 1, 2, -1, 1, 2,
])
const triangles = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7])
const entities = new Uint32Array([101, 101, 102, 102])

describe('neutral simulation scenes', () => {
  it('keeps immutable display-to-source mappings while splitting render vertices', () => {
    const scene = {
      source: 'gmsh-authoritative', referencePositions: positions, surfaceTriangles: triangles,
      triangleEntityTags: entities, entities: [], elementBlocks: [], groups: [], fields: [], surfaceSignatures: [],
    } satisfies SimulationScene
    const display = displayGeometry(scene)
    display.positions[0] = 99
    expect(scene.referencePositions[0]).toBe(-1)
    expect([...display.displayVertexToSourceNode]).toEqual([...triangles])
    expect([...display.displayTriangleToSourceTriangle]).toEqual([0, 1, 2, 3])
  })

  it('matches only a complete unique geometric bijection', () => {
    const preview = surfaceSignatures(positions, triangles, entities)
    const authoritative = preview.map((signature, index) => ({ ...signature, sourceKey: 301 + index }))
    expect(matchSurfaceSignatures(preview, authoritative)).toEqual([
      { previewKey: 101, authoritativeKey: 301 },
      { previewKey: 102, authoritativeKey: 302 },
    ])
    expect(matchSurfaceSignatures(preview, [authoritative[0]!, authoritative[0]!])).toBeUndefined()
    expect(matchSurfaceSignatures(preview, authoritative.slice(0, 1))).toBeUndefined()
  })

  it('uses model extent rather than distance from origin for matching tolerances', () => {
    const preview = surfaceSignatures(positions, triangles, entities)
    const translate = (offset: number) => preview.map((signature, index) => ({
      ...signature,
      sourceKey: 301 + index,
      centroid: signature.centroid.map((value) => value + offset) as [number, number, number],
    }))
    const translatedPreview = translate(1_000_000).map((signature, index) => ({ ...signature, sourceKey: preview[index]!.sourceKey }))
    const translatedAuthority = translate(1_000_000)
    expect(matchSurfaceSignatures(translatedPreview, translatedAuthority)).toHaveLength(2)
    const displaced = translatedAuthority.map((signature, index) => index ? signature : {
      ...signature, centroid: [signature.centroid[0] + 0.1, signature.centroid[1], signature.centroid[2]] as [number, number, number],
    })
    expect(matchSurfaceSignatures(translatedPreview, displaced)).toBeUndefined()
    expect(matchSurfaceSignatures(translatedPreview, [translatedAuthority[0]!, { ...translatedAuthority[0]!, sourceKey: 302 }])).toBeUndefined()
  })

  it('deduplicates shared buffers and excludes SharedArrayBuffer from transfer lists', () => {
    const shared = new ArrayBuffer(32)
    const scene = {
      source: 'gmsh-authoritative',
      referencePositions: new Float64Array(shared, 0, 3),
      surfaceTriangles: new Uint32Array(shared, 24, 1),
      triangleEntityTags: new Uint32Array([1]),
      entities: [], elementBlocks: [], groups: [], fields: [], surfaceSignatures: [],
    } satisfies SimulationScene
    expect(sceneTransferables(scene).filter((buffer) => buffer === shared)).toHaveLength(1)
    if (typeof SharedArrayBuffer !== 'undefined') {
      scene.referencePositions = new Float64Array(new SharedArrayBuffer(24))
      expect(sceneTransferables(scene)).not.toContain(scene.referencePositions.buffer)
    }
  })
})
