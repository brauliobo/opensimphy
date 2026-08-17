import catalogJson from '../../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../../public/data/generated/awesomePhysics/simulations.json'
import { artifactRecordById, NATIVE_CANDIDATES, WASM_PILOTS } from '../artifactManifest'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsExecutionKind,
  AwesomePhysicsSimulationArtifactV1,
} from '../../types/awesomePhysics'
import {
  AWESOME_BENCHMARK_CASE_REGISTRY_ID,
  GRAY_MOTOR_CASE_FAMILY,
  type AwesomeBenchmarkCaseV1,
  type AwesomeBenchmarkRuntimeV1,
} from './types'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

const WASM_MANIFEST_OVERRIDES: Readonly<Record<string, string>> = {
  'awesome-nphysics2d-wasm': 'nphysics',
  'awesome-spirit-wasm': 'spirit-headless',
}

function manifestIdForAdapter(adapterId: string | undefined): string | undefined {
  if (adapterId === undefined) return undefined
  if (Object.hasOwn(WASM_MANIFEST_OVERRIDES, adapterId)) return WASM_MANIFEST_OVERRIDES[adapterId]
  const records = [...WASM_PILOTS, ...NATIVE_CANDIDATES]
  const match = records.find((record) => (
    adapterId === `awesome-${record.id}-wasm`
    || adapterId === `awesome-${record.project.toLowerCase()}-wasm`
    || adapterId.includes(record.id)
  ))
  return match?.id
}

const PLANNED_WASM_SLOTS: readonly AwesomeBenchmarkCaseV1[] = [
  plannedSlot('galpy', 'galpy', 'wasm', 'pass', 'galpy'),
  plannedSlot('cantera', 'cantera', 'wasm', 'review'),
  plannedSlot('pymunk', 'pymunk', 'wasm', 'pass', 'pymunk'),
  plannedSlot('spirit', 'spirit', 'wasm', 'review'),
  plannedSlot('ncollide', 'ncollide', 'wasm-candidate', 'pass', 'ncollide'),
  plannedSlot('simbody', 'simbody', 'wasm-candidate', 'pass'),
  plannedSlot('fluid-engine-dev', 'fluid-engine-dev', 'wasm-candidate', 'pass'),
  plannedSlot('physx-3-4', 'PhysX-3.4', 'wasm-candidate', 'review'),
  plannedSlot('newton-dynamics', 'newton-dynamics', 'wasm-candidate', 'pass'),
]

function plannedSlot(
  caseId: string,
  catalogName: string,
  execution: AwesomePhysicsExecutionKind,
  licenseGate: AwesomeBenchmarkCaseV1['licenseGate'],
  wasmManifestId?: string,
): AwesomeBenchmarkCaseV1 {
  const item = catalog.items.find((entry) => entry.canonicalName === catalogName || entry.id === `awesome-${caseId}`)
  const descriptor = simulations.items.find((entry) => entry.catalogItemId === item?.id) ?? null
  return {
    caseId: `planned-${caseId}`,
    title: item?.title ?? catalogName,
    family: 'awesome-physics',
    descriptorId: descriptor?.id ?? null,
    catalogItemId: item?.id ?? null,
    adapterId: null,
    execution: descriptor?.execution ?? execution,
    licenseGate: descriptor?.licenseGate ?? licenseGate,
    runtimes: ['native', 'wasm'],
    runnable: false,
    mount: {
      wasmManifestId,
      grayPlugin: 'gray-motor-v1',
      resultSchema: 'awesome-benchmark-result-v1',
    },
  }
}

function runtimesFor(execution: AwesomePhysicsExecutionKind, runnable: boolean): AwesomeBenchmarkRuntimeV1[] {
  if (!runnable) return ['native', 'wasm']
  if (execution === 'wasm') return ['native', 'wasm']
  return ['native']
}

export function awesomeBenchmarkCases(): AwesomeBenchmarkCaseV1[] {
  const cases = simulations.items.map((descriptor): AwesomeBenchmarkCaseV1 => ({
    caseId: descriptor.id,
    title: descriptor.title,
    family: 'awesome-physics',
    descriptorId: descriptor.id,
    catalogItemId: descriptor.catalogItemId,
    adapterId: descriptor.adapterId ?? null,
    execution: descriptor.execution,
    licenseGate: descriptor.licenseGate,
    runtimes: runtimesFor(descriptor.execution, descriptor.runnable),
    runnable: descriptor.runnable,
    mount: {
      adapterFactory: descriptor.adapterId,
      wasmManifestId: manifestIdForAdapter(descriptor.adapterId),
      grayPlugin: 'gray-motor-v1',
      resultSchema: 'awesome-benchmark-result-v1',
    },
  }))
  const claimed = new Set(cases.map((entry) => entry.catalogItemId))
  for (const slot of PLANNED_WASM_SLOTS) {
    if (slot.catalogItemId !== null && claimed.has(slot.catalogItemId)) continue
    cases.push(slot)
  }
  cases.push({
    caseId: 'gray-motor',
    title: 'Edwin Gray motor harness slot',
    family: GRAY_MOTOR_CASE_FAMILY,
    descriptorId: null,
    catalogItemId: null,
    adapterId: null,
    execution: 'gray-motor',
    licenseGate: 'pending',
    runtimes: ['native'],
    runnable: true,
    mount: {
      grayPlugin: 'gray-motor-v1',
      resultSchema: 'awesome-benchmark-result-v1',
    },
  })
  return cases
}

export function awesomeBenchmarkCaseById(caseId: string): AwesomeBenchmarkCaseV1 | null {
  return awesomeBenchmarkCases().find((entry) => entry.caseId === caseId) ?? null
}

export function wasmManifestRecordId(caseItem: AwesomeBenchmarkCaseV1): string | null {
  const id = caseItem.mount.wasmManifestId
  if (id === undefined) return null
  return artifactRecordById(id) === null ? null : id
}

export const awesomeBenchmarkRegistryMeta = Object.freeze({
  registryId: AWESOME_BENCHMARK_CASE_REGISTRY_ID,
  catalogRevision: catalog.catalogRevision,
  simulationCount: simulations.items.length,
})
