import { GRAY_VIDEO } from '../../src/edwin-gray/edwinGrayGuide'
import {
  GRAY_CLAIMS_CLIP,
  GRAY_COP_100REV,
  GRAY_SCHEMATIC,
  GRAY_VIDEO_ARTIFACTS,
  grayClaimsClipHref,
  grayClaimsWindowCueRows,
  grayCopCatalogClaims,
  grayCopCatalogHasProductionLut,
  grayCopCatalogMetrics,
  grayCopCatalogRows,
  graySchematicCueRefs,
  grayWhisperCues,
} from '../../src/cases/grayArtifacts'

describe('Edwin Gray persisted lab artifacts', () => {
  it('exposes the 100-rev classical COP catalog beside a published production LUT', () => {
    expect(GRAY_COP_100REV.productionLutPublished).toBe(true)
    expect(GRAY_COP_100REV.magneticLookup).toBeNull()
    expect(grayCopCatalogHasProductionLut()).toBe(true)
    expect(GRAY_COP_100REV.peakWholeSystemCop).toBeCloseTo(0.026006101059471973, 12)
    expect(GRAY_COP_100REV.meanWholeSystemCop).toBeCloseTo(0.01616000022113847, 12)
    expect(GRAY_COP_100REV.copRange).toEqual([0.008455854947167687, 0.026006101059471973])
    expect(GRAY_COP_100REV.claimedCop).toMatchObject({ presenter300: 300, status: 'source-claim-only' })
    expect(GRAY_COP_100REV.closure.ema4.wholeSystemCop).toBe(GRAY_COP_100REV.peakWholeSystemCop)
    expect(grayCopCatalogRows()).toHaveLength(7)
    expect(grayCopCatalogMetrics().some((row) => row.value === 'source-claim only')).toBe(true)
    expect(grayCopCatalogClaims().some((row) => row.status === 'source-claim-only')).toBe(true)
    expect(GRAY_VIDEO_ARTIFACTS.productionLut.published).toBe(true)
  })

  it('maps whisper schematic cues and only attaches retained cue frames', () => {
    expect(GRAY_SCHEMATIC.productionLut.published).toBe(true)
    expect(GRAY_SCHEMATIC.circuit.holdCapacitors).toBe(2)
    expect(GRAY_SCHEMATIC.circuit.dumpBankCapacitors).toBe(4)
    expect(GRAY_SCHEMATIC.claims.cop282).toBe('absent-from-this-pack')
    const cues = grayWhisperCues()
    const refs = graySchematicCueRefs()
    expect(cues.length).toBeGreaterThan(10)
    expect(refs).toHaveLength(cues.length)
    const ignitron = refs.find((entry) => entry.id === 'ignitron-array')
    const cop300 = refs.find((entry) => entry.id === 'cop-300')
    expect(ignitron?.src).toBe('data/generated/edwin-gray/frames/schematic/cue-ignitron-array.jpg')
    expect(ignitron?.href).toBe(`${GRAY_VIDEO.url}&t=1956s`)
    expect(cop300?.src).toBeNull()
    expect(cop300?.caption).toContain('COP of 300')
  })

  it('indexes the claims clip on the research path without bundling the mkv', () => {
    expect(GRAY_CLAIMS_CLIP.bundled).toBe(false)
    expect(GRAY_CLAIMS_CLIP.path).toBe('research/opensimphy-edwin-gray/source/media/nC740fpBs4M-3300-4380.mkv')
    expect(GRAY_CLAIMS_CLIP.sha256).toBe('480235ab6fa2830a94c207a3a1e6752f0266b002ce3a017b6805d926584d327b')
    expect(GRAY_CLAIMS_CLIP.bytes).toBe(136731975)
    expect(GRAY_CLAIMS_CLIP.durationSeconds).toBe(1090)
    expect(GRAY_CLAIMS_CLIP.sourceStartSeconds).toBe(3300)
    expect(GRAY_VIDEO_ARTIFACTS.claimsClip.bundled).toBe(false)
    expect(grayClaimsClipHref()).toBe(`${GRAY_VIDEO.url}&t=3300s`)
    expect(grayClaimsWindowCueRows().every((row) => row.time >= '00:55:00')).toBe(true)
    expect(grayClaimsWindowCueRows().some((row) => row.id === 'q-spark-gaps')).toBe(true)
  })
})
