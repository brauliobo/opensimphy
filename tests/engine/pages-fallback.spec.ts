import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPagesFallbacks, deriveStaticPagePaths, staticPagePaths } from '../../scripts/create-pages-fallback.mjs'
import pagePaths from '../../src/router/page-paths.json'

describe('GitHub Pages route fallbacks', () => {
  it('derives every concrete router path and alias', () => {
    expect(deriveStaticPagePaths(pagePaths)).toEqual([
      '/',
      '/atlas',
      '/labs',
      '/labs/core',
      '/core',
      '/labs/walls',
      '/walls',
      '/labs/onelab',
      '/sources',
    ])
  })

  it('copies the base-aware shell to concrete routes and retains an unknown-route 404 fallback', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'opensimphy-pages-'))
    const shell = '<base href="/opensimphy/">'

    try {
      await writeFile(join(dist, 'index.html'), shell)
      await createPagesFallbacks(dist)

      await expect(readFile(join(dist, '404.html'), 'utf8')).resolves.toBe(shell)
      for (const route of staticPagePaths.filter((path) => path !== '/')) {
        await expect(readFile(join(dist, route.slice(1), 'index.html'), 'utf8')).resolves.toBe(shell)
      }
      await expect(access(join(dist, 'unknown', 'index.html'))).rejects.toThrow()
    } finally {
      await rm(dist, { recursive: true, force: true })
    }
  })
})
