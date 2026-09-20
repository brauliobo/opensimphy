import catalog from '../../tools/wasm/fixtures/projects.json'
import { runtimeProjects } from './cad-projects'
import type { ProjectDescriptor } from './types'

export const projectCatalog = catalog.projects as ProjectDescriptor[]

export function allSolverProjects() {
  return [...projectCatalog.filter(({ kind }) => kind === 'solve'), ...runtimeProjects]
}

export function projectDescriptor(id: string) {
  const descriptor = [...projectCatalog, ...runtimeProjects].find((project) => project.id === id)
  if (!descriptor) throw new Error(`unknown simulation project ${id}`)
  return descriptor
}
