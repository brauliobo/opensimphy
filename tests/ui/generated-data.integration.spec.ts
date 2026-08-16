import recipesJson from '../../public/data/generated/recipes.json'
import symbolsJson from '../../public/data/generated/symbols.json'
import provenanceJson from '../../public/data/generated/provenance.json'
import { evaluateRecipes } from '../../src/engine'
import type { PrimitiveSymbolSource, RecipeSource } from '../../src/types/engine'

describe('generated data integration', () => {
  it('evaluates a real generated recipe with engine graph points and markers', () => {
    const result = evaluateRecipes(
      (recipesJson as RecipeSource[]).slice(0, 1),
      symbolsJson as PrimitiveSymbolSource[],
      { graphSteps: 9 },
    )

    expect(result.errors).toEqual([])
    expect(result.unresolved).toEqual([])
    expect(result.evaluations[0]?.graphReady).toBe(true)
    expect(result.evaluations[0]?.graph.points).toHaveLength(9)
    expect(result.evaluations[0]?.graph.markers.map((marker) => marker.label)).toEqual(['computed', 'expected'])
  })

  it('keeps generated provenance independent of the checkout path', () => {
    const provenance = provenanceJson as typeof provenanceJson
    const serialized = JSON.stringify(provenance)

    expect(provenance.schemaVersion).toBe(2)
    expect(serialized).not.toContain('localSourcePath')
    expect(serialized).not.toContain('originalPath')
    expect(provenance.physicsMonastery.sourceArtifacts.every(({ sourceIdentifier }) => sourceIdentifier.startsWith('physics-monastery/'))).toBe(true)
    expect(provenance.physicsMonastery.recoveredSitePdfs.map(({ sourcePath }) => sourcePath)).toEqual([
      'data/physics_monastery/site/288.pdf',
      'data/physics_monastery/site/combinatorics.pdf',
      'data/physics_monastery/site/transform_dictionary.pdf',
    ])
  })
})
