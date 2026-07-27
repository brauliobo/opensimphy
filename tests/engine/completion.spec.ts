import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import completionJson from '../../public/data/generated/completion.json'
import recipesJson from '../../public/data/generated/recipes.json'
import registryJson from '../../public/data/generated/registry.json'
import symbolsJson from '../../public/data/generated/symbols.json'
import { buildCompletionReport, parseCompletionReport } from '../../src/engine/completion'
import { completion } from '../../src/engine/completionRegistry'
import type { PrimitiveSymbolSource, RecipeSource, RegistryArtifact } from '../../src/types/engine'

describe('completion audit', () => {
  it('publishes fail-closed exact generated coverage', () => {
    expect(parseCompletionReport(completionJson)).toEqual(completion)
    expect(completion.complete).toBe(true)
    expect(completion.errors).toEqual([])
    expect(completion.unresolved).toEqual([])
    expect(completion.recipes).toMatchObject({ source: 288, implemented: 288, evaluated: 288, graphed: 288 })
    expect(completion.walls).toMatchObject({ source: 351, implemented: 351, parseable: 351, simulatable: 351 })
    expect(completion.core).toMatchObject({ source: 37, implemented: 37, evaluated: 37, graphed: 37, simulatable: 37 })
    expect(() => parseCompletionReport({ ...completionJson, walls: { source: 351, implemented: 351, parseable: 351, graphed: 0 } })).toThrow(/walls\.simulatable/)
  })

  it('keeps the aggregate registry synchronized with generated inputs', () => {
    const registry = registryJson as RegistryArtifact

    expect(registry.recipes.count).toBe(288)
    expect(registry.recipes.items).toHaveLength(288)
    expect(registry.walls.count).toBe(351)
    expect(registry.walls.items).toHaveLength(351)
    expect(registry.core.count).toBe(37)
    expect(registry.core.items).toHaveLength(37)
    expect(registry.inputs).toEqual(completion.inputs)
  })

  it('recomputes exact completion through every wall payload', async () => {
    const registry = registryJson as RegistryArtifact
    const wallPayloads = await Promise.all(registry.walls.items.map(async ({ filename }) =>
      JSON.parse(await readFile(join(process.cwd(), 'public', 'data', 'number-walls', filename), 'utf8')) as unknown,
    ))
    const report = buildCompletionReport(
      {
        recipes: recipesJson as RecipeSource[],
        symbols: symbolsJson as PrimitiveSymbolSource[],
        wallPayloads,
        wallSourceCount: registry.walls.count,
      },
      { generatedAt: completion.generatedAt },
    )

    expect(report.complete).toBe(true)
    expect(report.recipes).toEqual(completion.recipes)
    expect(report.walls).toEqual(completion.walls)
    expect(report.core).toEqual(completion.core)
  })
})
