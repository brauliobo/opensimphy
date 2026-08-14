import catalog from '../../tools/wasm/fixtures/projects.json'
import type { ProjectDescriptor } from './types'

export const projectCatalog = catalog.projects as ProjectDescriptor[]

export function projectDescriptor(id: string) {
  const descriptor = projectCatalog.find((project) => project.id === id)
  if (!descriptor) throw new Error(`unknown simulation project ${id}`)
  return descriptor
}
