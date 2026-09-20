import { canonicalizeOnelab, parseOnelab } from './onelab-db'
import cavityEigenPro from './templates/cavity-eigen.pro?raw'
import cubeElectrostaticsPro from './templates/cube-electrostatics.pro?raw'
import type { ProjectDescriptor, ProjectFile } from './types'

export const cubeElectrostaticsSource = cubeElectrostaticsPro
export const cavityEigenSource = cavityEigenPro

export const cubeStepElectrostatics: ProjectDescriptor = {
  id: 'cube-step-electrostatics',
  title: 'STEP cube electrostatics',
  kind: 'solve',
  source: 'OpenSimPhy CAD workbench / locked meshStep cube.step',
  directory: 'cube',
  files: ['cube.step', 'cube-electrostatics.pro'],
  geometry: 'cube.step',
  problem: 'cube-electrostatics.pro',
  dimension: 3,
  scalarType: 'real-double',
  resolution: 'Ele',
  postOperations: ['Map'],
  solver: 'getdp',
  cad: true,
  convergence: {
    linear: { absoluteTolerance: 1e-12, relativeTolerance: 1e-8, residualCount: 2 },
    structure: { kind: 'fixed', groups: [{ kind: 'linear', systemName: 'Sys_Ele' }] },
  },
  setNumbers: {},
  parameterNames: {},
  probes: [[0, 0, 10], [0, 0, 2], [0, 0, 18]],
}

export const cubeCavityEigen: ProjectDescriptor = {
  id: 'cube-cavity-eigen',
  title: 'Cube Dirichlet eigenmodes',
  kind: 'solve',
  source: 'OpenSimPhy SLEPc EigenSolve on the Gmsh cube mesh',
  directory: 'cube',
  files: ['cube.geo', 'cavity-eigen.pro'],
  geometry: 'cube.geo',
  problem: 'cavity-eigen.pro',
  dimension: 3,
  scalarType: 'real-double',
  resolution: 'Eigen',
  postOperations: ['Map'],
  solver: 'slepc',
  cad: false,
  setNumbers: {},
  parameterNames: {},
  probes: [[0, 0, 10]],
}

export const runtimeProjects: ProjectDescriptor[] = [cubeStepElectrostatics, cubeCavityEigen]

export function electrostaticCadProject(id: string, geometry: string, title = `STEP ${geometry}`): ProjectDescriptor {
  return {
    ...cubeStepElectrostatics,
    id,
    title,
    source: `OpenSimPhy CAD workbench / ${geometry}`,
    directory: id,
    files: [geometry, 'cube-electrostatics.pro'],
    geometry,
  }
}

export function runtimeProject(id: string) {
  const descriptor = runtimeProjects.find((project) => project.id === id)
  if (!descriptor) throw new Error(`unknown runtime simulation project ${id}`)
  return descriptor
}

export function isRuntimeProject(id: string) {
  return runtimeProjects.some((project) => project.id === id)
}

export function textFile(path: string, source: string): ProjectFile {
  return { path, bytes: new TextEncoder().encode(source) }
}

export const cadMeshParameter = {
  type: 'number' as const,
  name: 'Parameters/Global mesh size factor',
  label: 'Global mesh size factor',
  help: 'Multiplies the target Gmsh mesh size for CAD and cavity meshes.',
  values: [2],
  min: 0.5,
  max: 8,
  step: 0.5,
  changedValue: 31,
  visible: true,
  readOnly: false,
  clients: { Gmsh: 0, GetDP: 0 },
}

export function cadDatabase(meshSize = 2) {
  return canonicalizeOnelab({ onelab: { version: '1.3', parameters: [{ ...cadMeshParameter, values: [meshSize] }] } })
}

export function ensureMeshParameter(json: string, meshSize = 2) {
  const database = parseOnelab(json)
  if (database.onelab.parameters.some(({ name }) => name === cadMeshParameter.name)) return canonicalizeOnelab(json)
  return canonicalizeOnelab({ onelab: { version: database.onelab.version, parameters: [...database.onelab.parameters, { ...cadMeshParameter, values: [meshSize] }] } })
}
