import recipesJson from '../../public/data/generated/recipes.json'
import taxonomyJson from '../../public/data/generated/taxonomy.json'
import type { RecipeSource, TaxonomyArtifact } from '../../src/types/engine'

const recipes = recipesJson as RecipeSource[]
const taxonomy = taxonomyJson as TaxonomyArtifact

describe('constant taxonomy', () => {
  it('classifies every recipe into the eight-topic narrative without a fallback bucket', () => {
    expect(taxonomy.total).toBe(288)
    expect(taxonomy.topics).toHaveLength(8)
    expect(taxonomy.topics.map(({ id, count }) => [id, count])).toEqual([
      ['foundations', 15],
      ['metrology', 60],
      ['electromagnetism', 10],
      ['atomic', 26],
      ['particles', 64],
      ['magnetism', 81],
      ['thermal', 17],
      ['molar-matter', 15],
    ])
    expect(new Set(recipes.map((recipe) => recipe.taxonomy.topic)).has('other')).toBe(false)
    expect(recipes.every((recipe) => recipe.taxonomy.topic && recipe.taxonomy.category)).toBe(true)
  })

  it('covers each topic with non-empty categories and stable exact/measured totals', () => {
    for (const topic of taxonomy.topics) {
      expect(topic.categories.every((category) => category.count > 0)).toBe(true)
      expect(topic.categories.reduce((sum, category) => sum + category.count, 0)).toBe(topic.count)
      expect(topic.exactCount + topic.measuredCount).toBe(topic.count)
      expect(topic.featured).toHaveLength(4)
      expect(topic.featured.every((item) => recipes[item.recipeNumber - 1]?.constant_id === item.id)).toBe(true)
    }
    expect(taxonomy.facets.basis).toEqual([
      { id: 'exact', count: 70 },
      { id: 'measured', count: 218 },
    ])
    expect(taxonomy.facets.buildPass).toEqual([
      { id: 'pass-1', count: 203 },
      { id: 'pass-2', count: 79 },
      { id: 'pass-3', count: 6 },
    ])
    expect(taxonomy.facets.constructor.reduce((sum, item) => sum + item.count, 0)).toBe(288)
    expect(taxonomy.facets.sourceUnitFamily.reduce((sum, item) => sum + item.count, 0)).toBe(288)
    expect(taxonomy.facets.representation.reduce((sum, item) => sum + item.count, 0)).toBe(288)
  })
})
