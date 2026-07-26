import recipesJson from '../../public/data/generated/recipes.json'
import symbolsJson from '../../public/data/generated/symbols.json'
import { evaluateRecipes } from '../../src/engine/recipes'
import type { PrimitiveSymbolSource, RecipeSource } from '../../src/types/engine'

describe('recipe registry', () => {
  it('evaluates and graphs all source recipes with model parity', () => {
    const result = evaluateRecipes(
      recipesJson as RecipeSource[],
      symbolsJson as PrimitiveSymbolSource[],
      { graphSteps: 3 },
    )

    expect(result.evaluations).toHaveLength(288)
    expect(result.unresolved).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.evaluations.filter(({ modelParity }) => !modelParity).map(({ recipeNumber, id, relativeModelError }) => ({ recipeNumber, id, relativeModelError }))).toEqual([])
    expect(result.evaluations.filter(({ graphReady }) => !graphReady).map(({ recipeNumber, id }) => ({ recipeNumber, id }))).toEqual([])
  })

  it('preserves the source dependency passes and dimension findings', () => {
    const result = evaluateRecipes(
      recipesJson as RecipeSource[],
      symbolsJson as PrimitiveSymbolSource[],
      { graphSteps: 3 },
    )

    expect(result.passes).toBe(3)
    expect(result.evaluations.filter(({ dimensionAudit }) => !dimensionAudit.matches)).toHaveLength(68)
    expect(result.evaluations.find(({ recipeNumber }) => recipeNumber === 243)?.dimensionAudit).toMatchObject({
      declared: 'm/cycle',
      matches: true,
    })
  })
})
