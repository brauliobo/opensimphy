import type { AwesomePhysicsCatalogItemV1, AwesomePhysicsOrganizationV1, AwesomePhysicsSimulationDescriptorV1 } from '../types/awesomePhysics'
import type { CaseLink, CaseRecord } from './types'

export const CASE_HUB_ID = 'case-hub'
export const GRAY_CASE_ID = 'edwin-gray'
export const AWESOME_CATALOG_ID = 'awesome-physics-catalog'

export const CASE_HUB: CaseRecord = Object.freeze({
  id:           CASE_HUB_ID,
  kind:         'hub',
  title:        'Simulation cases',
  to:           '/labs/cases',
  eyebrow:      'Shared case index',
  description:  'One page per Gray motor and Awesome Physics catalog record, using the same header, metrics, schematics, and run shell.',
  execution:    'index',
  availability: 'available',
  runnable:     false,
  copRelevant:  false,
  mount:        { kind: 'hub' as const },
})

export const GRAY_CASE: CaseRecord = Object.freeze({
  id:           GRAY_CASE_ID,
  kind:         'gray-motor',
  title:        'Edwin Gray motor lab',
  to:           '/labs/edwin-gray',
  eyebrow:      'Historical machine / COP ledger',
  description:  'Patent topology plus colored prototype contracts on one page: schematics, transcript frame map, worker controls, and classical COP beside source claims.',
  execution:    'worker',
  availability: 'available',
  runnable:     true,
  copRelevant:  true,
  mount:        { kind: 'gray-motor' as const, api: 'runGrayInWorker' as const, worker: 'edwinGray.worker' as const },
})

export const AWESOME_CATALOG_CASE: CaseRecord = Object.freeze({
  id:           AWESOME_CATALOG_ID,
  kind:         'hub',
  title:        'Awesome Physics catalog',
  to:           '/awesome-physics',
  eyebrow:      'Source catalog',
  description:  'Preserved Awesome Physics records and bounded local adapters.',
  execution:    'index',
  availability: 'available',
  runnable:     false,
  copRelevant:  false,
  mount:        { kind: 'hub' as const },
})

export const STATIC_CASE_LINKS: readonly CaseLink[] = Object.freeze([
  CASE_HUB,
  GRAY_CASE,
  AWESOME_CATALOG_CASE,
])

export function awesomeItemCase(item: AwesomePhysicsCatalogItemV1, descriptor: AwesomePhysicsSimulationDescriptorV1): CaseRecord {
  const runnable = descriptor.availability === 'available'
    && descriptor.runnable
    && Boolean(descriptor.adapterId)
    && descriptor.capability !== 'archive-reference'
    && descriptor.execution !== 'artifact'
    && descriptor.execution !== 'reference'
    && !descriptor.executionOptions.includes('wasm-candidate')
  return {
    id:           item.id,
    kind:         'awesome-physics',
    title:        item.title,
    to:           `/awesome-physics/${encodeURIComponent(item.id)}`,
    eyebrow:      `${item.catalogSection} / ${item.category}`,
    description:  item.description,
    execution:    descriptor.execution,
    availability: descriptor.availability,
    runnable,
    copRelevant:  false,
    mount:        {
      kind:       'awesome-physics',
      api:        'runAwesomePhysicsInWorker',
      wasm:       'loadVerifiedWasmArtifactById',
      adapterId:  descriptor.adapterId ?? null,
      execution:  descriptor.execution,
    },
  }
}

export function awesomeOrganizationCase(organization: AwesomePhysicsOrganizationV1): CaseRecord {
  return {
    id:           organization.id,
    kind:         'awesome-physics',
    title:        organization.title,
    to:           `/awesome-physics/${encodeURIComponent(organization.id)}`,
    eyebrow:      'Catalog organization',
    description:  organization.description,
    execution:    'none',
    availability: 'catalog-only',
    runnable:     false,
    copRelevant:  false,
    mount:        {
      kind:      'awesome-physics',
      api:       'runAwesomePhysicsInWorker',
      wasm:      'loadVerifiedWasmArtifactById',
      adapterId: null,
      execution: 'none',
    },
  }
}

export function collectCaseRecords(
  items: readonly AwesomePhysicsCatalogItemV1[],
  organizations: readonly AwesomePhysicsOrganizationV1[],
  descriptors: readonly AwesomePhysicsSimulationDescriptorV1[],
): CaseRecord[] {
  const byCatalogId = new Map(descriptors.map((descriptor) => [descriptor.catalogItemId, descriptor]))
  const awesomeItems = items.flatMap((item) => {
    const descriptor = byCatalogId.get(item.id)
    return descriptor ? [awesomeItemCase(item, descriptor)] : []
  })
  return [GRAY_CASE, ...awesomeItems, ...organizations.map(awesomeOrganizationCase)]
}

export function caseNeighbors<T extends CaseLink>(records: readonly T[], currentId: string): { previous: T | null, next: T | null } {
  const index = records.findIndex((record) => record.id === currentId)
  if (index < 0) return { previous: null, next: null }
  return {
    previous: records[index - 1] ?? null,
    next:     records[index + 1] ?? null,
  }
}
