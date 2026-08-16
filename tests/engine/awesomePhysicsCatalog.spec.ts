import catalogJson from '../../public/data/generated/awesomePhysics/catalog.json'
import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type {
  AwesomePhysicsCatalogArtifactV1,
  AwesomePhysicsSimulationArtifactV1,
} from '../../src/types/awesomePhysics'

const catalog = catalogJson as AwesomePhysicsCatalogArtifactV1
const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1
const PHASE_ZERO_IMPLEMENTATION_REVISION = 'phase-0-no-adapters'

function isPhaseZeroOrExplicitlyGated(revision: string): boolean {
  return revision === PHASE_ZERO_IMPLEMENTATION_REVISION || /(?:^|[-_])gated(?:$|[-_])/.test(revision)
}

function expectFiniteLimits(value: Record<string, number>): void {
  for (const limit of Object.values(value)) {
    expect(Number.isFinite(limit)).toBe(true)
    expect(Number.isInteger(limit)).toBe(true)
    expect(limit).toBeGreaterThanOrEqual(0)
  }
}

describe('Awesome Physics catalog foundation', () => {
  it('preserves the complete project, archive, organization, and clone counts', () => {
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.summary).toEqual({
      totalEntries: 86,
      projectEntries: 75,
      archiveEntries: 1,
      organizationEntries: 10,
      clonedRepositories: 74,
      failedAccessEntries: 1,
      documentationAliases: 1,
    })
    expect(catalog.items).toHaveLength(76)
    expect(catalog.items.filter(({ sourceKind }) => sourceKind !== 'archive')).toHaveLength(75)
    expect(catalog.items.filter(({ sourceKind }) => sourceKind === 'archive')).toHaveLength(1)
    expect(catalog.organizations).toHaveLength(10)
    expect(catalog.items.filter(({ access }) => access.status === 'cloned')).toHaveLength(74)
    expect(simulations.summary).toEqual({
      sourceCapabilities: 76,
      runnable: 13,
      available: 13,
      unavailable: 59,
      blocked: 4,
      adapterCount: 13,
      executionKinds: {
        browser: 6,
        wasm: 6,
        'wasm-candidate': 8,
        typescript: 44,
        artifact: 8,
        reference: 3,
        blocked: 1,
      },
    })
  })

  it('keeps catalog and descriptor IDs unique', () => {
    expect(new Set(catalog.items.map(({ id }) => id)).size).toBe(catalog.items.length)
    expect(new Set(catalog.items.map(({ canonicalName }) => canonicalName)).size).toBe(catalog.items.length)
    expect(new Set(catalog.organizations.map(({ id }) => id)).size).toBe(catalog.organizations.length)
    expect(new Set(simulations.items.map(({ id }) => id)).size).toBe(simulations.items.length)
    expect(simulations.items.every(({ catalogItemId }) => catalog.items.some(({ id }) => id === catalogItemId))).toBe(true)
  })

  it('preserves the pypdt access failure without a source or adapter', () => {
    const item = catalog.items.find(({ canonicalName }) => canonicalName === 'pypdt')
    const descriptor = simulations.items.find(({ catalogItemId }) => catalogItemId === item?.id)
    expect(item).toMatchObject({
      upstreamRevision: null,
      localPath: null,
      access: { status: 'not-cloned', attemptedOn: '2026-08-15' },
      accessFailure: {
        attemptedOn: '2026-08-15',
        observed: ['404', 'authentication-unavailable'],
      },
    })
    expect(item?.accessFailure?.note).toContain('retain as an access failure')
    expect(descriptor).toMatchObject({
      execution: 'blocked',
      availability: 'blocked',
      runnable: false,
      sourceRevision: null,
      licenseGate: 'blocked',
    })
    expect(descriptor && 'adapterId' in descriptor).toBe(false)
  })

  it('records the galpy documentation alias and current-upstream substitution', () => {
    const galpy = catalog.items.find(({ canonicalName }) => canonicalName === 'galpy')
    expect(galpy).toMatchObject({
      title: 'galpy',
      sourceKind: 'documentation',
      catalogUrl: 'http://galpy.readthedocs.io/en/latest/',
      upstreamUrl: 'https://github.com/jobovy/galpy',
      localPath: 'awesome-physics-repos/galpy',
      upstreamResolution: {
        kind: 'current-upstream-substitution',
        canonicalUpstreamUrl: 'https://github.com/jobovy/galpy',
      },
    })
    expect(galpy?.links).toContainEqual({
      kind: 'documentation',
      label: 'Canonical galpy documentation',
      url: 'https://docs.galpy.org/en/latest/',
    })
    expect(galpy?.links).toContainEqual({
      kind: 'legacy-documentation',
      label: 'Legacy catalog documentation URL',
      url: 'http://galpy.readthedocs.io/en/latest/',
    })
  })

  it('uses repository-relative paths and finite typed limits', () => {
    for (const item of catalog.items) {
      if (item.localPath !== null) {
        expect(item.localPath.startsWith('/')).toBe(false)
        expect(item.localPath).not.toContain('..')
        expect(item.localPath).not.toContain('\\')
      }
      for (const reference of [
        ...item.evidence.sourceRefs,
        ...item.evidence.licenseRefs,
        ...item.evidence.maintenanceRefs,
      ]) {
        expect(reference.startsWith('/')).toBe(false)
        expect(reference).not.toContain('/home/')
      }
    }
    expect(catalog.source.catalogPath).toBe('awesome-physics/README.md')
    expect(catalog.source.manifestPath).toBe('awesome-physics-repos/CLONE_MANIFEST.tsv')
    expect(catalog.source.migrationPlanPath).toBe('AWESOME_PHYSICS_MIGRATION_PLAN.md')
    for (const descriptor of simulations.items) {
      expectFiniteLimits(descriptor.limits)
      expectFiniteLimits(descriptor.artifactProvenance.byteSize === null ? {} : { byteSize: descriptor.artifactProvenance.byteSize })
      expect(descriptor.artifactProvenance.sha256).toBeNull()
      expect(descriptor.compatibilityRevision).toBe('awesome-physics-compatibility-v1')
      expect(descriptor.outputRevision).toBe('awesome-physics-descriptor-v1')
    }
    const availableDescriptors = simulations.items.filter(({ availability }) => availability === 'available')
    expect(availableDescriptors).toHaveLength(13)
    expect(availableDescriptors.every(({ implementationRevision }) => implementationRevision !== PHASE_ZERO_IMPLEMENTATION_REVISION)).toBe(true)
    expect(simulations.items
      .filter(({ availability }) => availability !== 'available')
      .every(({ implementationRevision }) => isPhaseZeroOrExplicitlyGated(implementationRevision))).toBe(true)
  })

  it('does not attach adapter IDs to unavailable or blocked descriptors', () => {
    expect(simulations.items
      .filter(({ availability }) => availability !== 'available')
      .every(({ adapterId, runnable }) => adapterId === undefined && runnable === false)).toBe(true)
    expect(simulations.items
      .filter(({ availability }) => availability === 'available')
      .every(({ adapterId, runnable }) => adapterId !== undefined && runnable === true)).toBe(true)
    expect(simulations.items.filter(({ execution }) => execution === 'wasm-candidate').every(({ availability }) => availability === 'unavailable')).toBe(true)
    expect(simulations.items.filter(({ execution }) => execution === 'blocked').every(({ availability }) => availability === 'blocked')).toBe(true)
  })
})
