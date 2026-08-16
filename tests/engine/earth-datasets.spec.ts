import datasetsJson from '../../public/data/generated/earth/datasets.json'

const registry = datasetsJson as typeof datasetsJson

describe('EARTH dataset registry', () => {
  it('extracts exactly 19 candidate datasets with deterministic summary counts', () => {
    expect(registry.summary).toEqual({
      sourceRows: 19,
      registered: 19,
      disputedClaims: 4,
      metadataAuthenticated: 19,
      dataAcquired: 0,
      dataFrozen: 0,
      g0bPending: 10,
      g0bBlocked: 9,
      personalData: 1,
      controlledAccess: 0,
      controlledHandling: 1,
      byPriority: { P0: 10, P1: 8, P2: 1 },
      byRedistributionMode: { raw: 8, 'derived-only': 5, 'metadata-only': 4, prohibited: 0, unknown: 2 },
    })
    expect(registry.datasets).toHaveLength(19)
    expect(new Set(registry.datasets.map(({ datasetId }) => datasetId)).size).toBe(19)
    expect(registry.datasets.every(({ simulationIds }) => simulationIds.length > 0)).toBe(true)
    expect(registry.datasets.every(({ sourceUrls, termsUrl }) => sourceUrls.length > 0 && termsUrl.startsWith('https://'))).toBe(true)
  })

  it('preserves all four disputed source claims without turning them into datasets', () => {
    expect(registry.disputedClaims.map(({ claim, registryStatus }) => [claim, registryStatus])).toEqual([
      ['"Gaia DR4 2025"', 'nonexistent-as-claimed'],
      ['"PREM 2025"', 'nonexistent-as-claimed'],
      ['Exact 1,842-galaxy pitch-angle catalogue', 'unverified-source'],
      ['Thousands of confirmed biosignature planets', 'nonexistent-as-claimed'],
    ])
    expect(registry.disputedClaims.find(({ claim }) => claim.startsWith('Exact 1,842'))?.simulationIds).toEqual(['EARTH-GAL-001'])
    expect(registry.disputedClaims.find(({ claim }) => claim.startsWith('Thousands'))?.simulationIds).toEqual(['EARTH-GAL-006'])
    expect(registry.datasets.some(({ name }) => /Gaia DR4|PREM 2025|biosignature/i.test(name))).toBe(false)
  })

  it('authenticates metadata without fabricating acquired or frozen data', () => {
    expect(registry.sourcePlan).toEqual({
      path: 'research/earth-thad-nassim/EARTH_SIMULATION_PLAN.md',
      revision: '2026-07-17',
      sha256: 'f7cfcd3cbc7f8eb5369ba4ec00d4fa4b1a7d6cfee8f5c4ca01951eba6a87eeb9',
    })
    expect(registry.sourceRegistry).toEqual({
      path: 'research/earth-thad-nassim/EARTH_DATASET_REGISTRY.md',
      reviewDate: '2026-07-17',
      sha256: '5e875e1f8c142facf2f56ca93be75003902e5f953dee546627e41855dc139801',
    })
    expect(registry.policy).toEqual({
      metadataAuthenticationDoesNotImplyAcquisition: true,
      datasetBytesAcquired: false,
      g0bPassed: false,
    })
    for (const dataset of registry.datasets) {
      expect(dataset).toMatchObject({
        metadataAuthenticated: true,
        acquisitionStatus: 'not-acquired',
        frozen: false,
        rowCount: null,
        byteCount: null,
        sha256: null,
      })
      expect(['pending', 'blocked']).toContain(dataset.g0bState)
    }
    expect(JSON.stringify(registry.datasets)).not.toMatch(/"sha256":\s*"[a-f0-9]{64}"/)
  })

  it('keeps source access separate from controlled personal-data handling', () => {
    const controlled = registry.datasets.filter(({ requiresControlledHandling }) => requiresControlledHandling)
    expect(controlled).toHaveLength(1)
    expect(controlled[0]).toMatchObject({
      name: 'EEG Motor Movement/Imagery Dataset',
      accessClass: 'open-web',
      accessClasses: ['open-web'],
      redistributionMode: 'derived-only',
      personalData: true,
      requiresControlledHandling: true,
      dataHandling: 'controlled-local-only',
      priority: 'P2',
      g0bState: 'pending',
    })
    expect(controlled[0].personalDataEvidence).toContain('de-identified EEG from 109 volunteers')
    expect(controlled[0].blockerEvidence).toContain('keep subject-level data offline')
    expect(registry.datasets.filter(({ accessClasses }) => accessClasses.includes('controlled'))).toHaveLength(0)
  })
})
