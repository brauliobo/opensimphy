import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const runtimeRegistryFiles = [
  'data/generated/taxonomy.json',
  'data/generated/recipes.json',
  'data/generated/symbols.json',
  'data/generated/walls.json',
  'data/generated/completion.json',
  'data/generated/registry.json',
  'data/generated/fiddles/registry.json',
  'data/generated/fiddles/runtime-verification.json',
]

export function computeRuntimeRegistryRevision(): string {
  const hash = createHash('sha256')
  for (const file of runtimeRegistryFiles) {
    const path = fileURLToPath(new URL(`../../public/${file}`, import.meta.url))
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(path))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

export const runtimeRegistryRevision = computeRuntimeRegistryRevision()
