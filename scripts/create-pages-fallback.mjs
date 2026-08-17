import assert from 'node:assert/strict'
import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pagePaths from '../src/router/page-paths.json' with { type: 'json' }

export function deriveStaticPagePaths(paths) {
  const routes = Object.values(paths)
  assert(routes.every((route) => typeof route === 'string' && route.startsWith('/')), 'Page routes must be absolute paths')

  return [...new Set(routes.filter((route) => !route.includes(':') && !route.includes('*')))]
}

export const staticPagePaths = deriveStaticPagePaths(pagePaths)

export async function createPagesFallbacks(dist) {
  const index = join(dist, 'index.html')
  await copyFile(index, join(dist, '404.html'))

  for (const route of staticPagePaths) {
    if (route === '/') continue
    const directory = join(dist, ...route.slice(1).split('/'))
    await mkdir(directory, { recursive: true })
    await copyFile(index, join(directory, 'index.html'))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await createPagesFallbacks(join(process.cwd(), 'dist'))
}
