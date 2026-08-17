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
    expect(simulations.summary.runnable).toBe(simulations.items.filter(({ runnable }) => runnable).length)
    expect(simulations.summary).toMatchObject({
      sourceCapabilities: 76,
      available: simulations.summary.runnable,
      adapterCount: simulations.summary.runnable,
      blocked: 4,
      unavailable: 76 - simulations.summary.runnable - 4,
    })
    expect(Object.values(simulations.summary.executionKinds).reduce((sum, count) => sum + count, 0)).toBe(76)
    expect(simulations.summary.runnable).toBeGreaterThanOrEqual(23)
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
      if (descriptor.catalogItemId === 'awesome-coolprop') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '4db89c1ce8d0b0d98ba7f03594f58a845351cf6a',
          byteSize: 9352013,
          sha256: '57742e874984ad5cddb12db534ea3a9c9903e5c5c518a08e18a099827a3a9829',
        })
      } else if (descriptor.catalogItemId === 'awesome-positionbaseddynamics') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: 'beafc921e21553515b4f406258e5b16054a45268',
          byteSize: 1256,
          sha256: '3182948748996ee1f755a4092bde52cea0c8ba586d66d5c54690b8a63d8362df',
        })
      } else if (descriptor.catalogItemId === 'awesome-bullet3') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '63c4d67e337017f9d8b298c900e9aabdb69296e7',
          byteSize: 333983,
          sha256: '1f255bb36e7c7a4f14a03cccfb95f13a39fdf50a9c2b2259faa1048e0473b425',
        })
      } else if (descriptor.catalogItemId === 'awesome-nphysics') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '65aa85c5470a5da85e0c13652ce58400ae2e2201',
          byteSize: 366856,
          sha256: 'e549cc0b2af0084dd7ba6908c07357ba4b447516dd799c26763ee4b8a381b2ba',
        })
      } else if (descriptor.catalogItemId === 'awesome-spirit') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: 'e82250d3b14411c2c2fa292d143f13e3e111ad8c',
          byteSize: 3821,
          sha256: '34a942b98bfed0d3cc1d27b731662b0315f23d2df1ed904133faa1038bdcd6a4',
        })
      } else if (descriptor.catalogItemId === 'awesome-pymunk') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '6287ce6d9223d1d79d28b2c26f37499f45b445b8',
          byteSize: 76555,
          sha256: '0166b68c54e17b3892ca675749afdc065806e8df5636fc55e89d8d4badb67158',
        })
      } else if (descriptor.catalogItemId === 'awesome-galpy') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '3762e73ef84578f4a911325d283e652eb1886625',
          byteSize: 19591,
          sha256: '0e053c12eaa70b3bf771697505acaa049269c481c7d1f9ac363e8f5cf08f7720',
        })
      } else if (descriptor.catalogItemId === 'awesome-ncollide') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: 'f3c3ecb3c98d1c2698574372b6b0e9d0032bc0c5',
          byteSize: 113119,
          sha256: '57ca3a88ae50d98a93221ae161143b991f0f3e0c3c52c687348216ea2c35da6a',
        })
      } else if (descriptor.catalogItemId === 'awesome-fluid-engine-dev') {
        expect(descriptor.artifactProvenance).toMatchObject({
          sourceRevision: '94c300ff5ad8a2f588e5e27e8e9746a424b29863',
          byteSize: 230684,
          sha256: 'd8bdd5c4841ab009e0b008cacbee88660c09bf8906714c388decd548934e389e',
        })
      } else if (descriptor.artifactProvenance.sha256 !== null) {
        expect(descriptor.availability).toBe('available')
        expect(descriptor.artifactProvenance.sha256).toMatch(/^[a-f0-9]{64}$/)
        expect(descriptor.artifactProvenance.byteSize).toBeGreaterThan(0)
      } else {
        expect(descriptor.artifactProvenance.sha256).toBeNull()
      }
      expect(descriptor.compatibilityRevision).toBe('awesome-physics-compatibility-v1')
      expect(descriptor.outputRevision).toBe('awesome-physics-descriptor-v1')
    }
    const availableDescriptors = simulations.items.filter(({ availability }) => availability === 'available')
    expect(availableDescriptors).toHaveLength(simulations.summary.runnable)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-scikit-beam')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-raysect')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-quantumoptics-jl')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-astropy')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-galpy')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-ncollide')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-fluid-engine-dev')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-cantera')).toBe(true)
    expect(availableDescriptors.some(({ catalogItemId }) => catalogItemId === 'awesome-simbody')).toBe(false)
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
