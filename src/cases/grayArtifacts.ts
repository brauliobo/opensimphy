import copJson from '../../public/data/generated/edwin-gray/cop-100rev.json'
import schematicJson from '../../public/data/generated/edwin-gray/schematic.json'
import cueJson from '../../public/data/generated/edwin-gray/whisper/nC740fpBs4M.schematic-cues.json'
import frameManifestJson from '../../public/data/generated/edwin-gray/frames/schematic/manifest.json'
import videoArtifactsJson from '../../public/data/generated/edwin-gray/video-artifacts.json'
import { GRAY_VIDEO } from '../edwin-gray/edwinGrayGuide'
import type { CaseMetric, SchematicRef } from './types'

export interface GrayCop100RevV1 {
  contract: 'edwin-gray-cop-100rev'
  version: number
  magneticLookup: null
  productionLutPublished: boolean
  energyModel: string
  peakWholeSystemCop: number
  meanWholeSystemCop: number
  copRange: readonly [number, number]
  claimedCop: {
    presenter300: number
    whisperArithmetic26p8W_7p5kW: number
    status: 'source-claim-only'
  }
  closure: Record<string, { normalizedResidual: number, wholeSystemCop: number }>
}

export interface GraySchematicV1 {
  contract: 'edwin-gray-schematic'
  version: number
  status: string
  circuit: {
    holdCapacitors: number
    dumpBankCapacitors: number
    commutatorContacts: number
    unusedContactsUnknown: boolean
    originalTrigger: readonly string[]
    modifiedTrigger: readonly string[]
    dump: string
    quench: string
  }
  topology: {
    patent: {
      statorPairStations: number
      rotorPairStations: number
      eventsPerRevolution: number
      simultaneousSectors: number
      statorPitchDeg: number
      rotorPitchDeg: number
      source: string
    }
    colored1979: {
      visibleStatorPoles: number
      purpleRecovery: boolean
      goldRecovery: boolean
      whiteHousing: string
      black: string
    }
  }
  claims: {
    cop300: { kind: string, machine: string }
    cop282: string
  }
  productionLut: { published: boolean }
}

export interface GrayWhisperCueV1 {
  id: string
  why: string
  start: number
  finish: number
  text: string
  section: string
}

export interface GrayClaimsClipV1 {
  id: string
  role: 'claims-window'
  bundled: false
  path: string
  sha256: string
  bytes: number
  sizeLabel: string
  durationSeconds: number
  sourceStartSeconds: number
  sourceEndSeconds: number
  sourceWindow: string
  width: number
  height: number
  videoCodec: string
  audioCodec: string
  container: string
  note: string
}

function numberPair(value: readonly number[]): readonly [number, number] {
  const lo = value[0]
  const hi = value[1]
  if (value.length !== 2 || lo === undefined || hi === undefined) {
    throw new TypeError('Gray COP copRange must be a pair of numbers')
  }
  return [lo, hi]
}

function claimedCop(value: { presenter300: number, whisperArithmetic26p8W_7p5kW: number, status: string }): GrayCop100RevV1['claimedCop'] {
  if (value.status !== 'source-claim-only') throw new TypeError('Gray COP claimedCop.status must be source-claim-only')
  return {
    presenter300: value.presenter300,
    whisperArithmetic26p8W_7p5kW: value.whisperArithmetic26p8W_7p5kW,
    status: value.status,
  }
}

export const GRAY_COP_100REV: GrayCop100RevV1 = Object.freeze({
  contract: 'edwin-gray-cop-100rev',
  version: copJson.version,
  magneticLookup: copJson.magneticLookup,
  productionLutPublished: copJson.productionLutPublished,
  energyModel: copJson.energyModel,
  peakWholeSystemCop: copJson.peakWholeSystemCop,
  meanWholeSystemCop: copJson.meanWholeSystemCop,
  copRange: numberPair(copJson.copRange),
  claimedCop: claimedCop(copJson.claimedCop),
  closure: copJson.closure,
})
export const GRAY_SCHEMATIC = Object.freeze(schematicJson) as GraySchematicV1
export const GRAY_VIDEO_ARTIFACTS = Object.freeze(videoArtifactsJson)
export const GRAY_CLAIMS_CLIP = Object.freeze(videoArtifactsJson.claimsClip) as GrayClaimsClipV1
export const GRAY_WHISPER_FILES = Object.freeze([
  { label: 'Whisper VTT', href: 'data/generated/edwin-gray/whisper/nC740fpBs4M.whisper.vtt' },
  { label: 'Whisper SRT', href: 'data/generated/edwin-gray/whisper/nC740fpBs4M.whisper.srt' },
  { label: 'Whisper TXT', href: 'data/generated/edwin-gray/whisper/nC740fpBs4M.whisper.txt' },
  { label: 'Schematic notes', href: 'data/generated/edwin-gray/schematic.md' },
])

const CUE_FRAMES = new Map(
  (frameManifestJson.frames as readonly { id: string, src: string }[]).map((frame) => [frame.id, frame.src]),
)
const WHISPER_CUES = (cueJson.cues as GrayWhisperCueV1[])

function timestampFromSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function grayCopCatalogHasProductionLut(): boolean {
  return GRAY_COP_100REV.productionLutPublished === true
}

export function grayCopCatalogMetrics(): CaseMetric[] {
  const [lo, hi] = GRAY_COP_100REV.copRange
  return [
    { label: '100-rev peak (ema4)', value: GRAY_COP_100REV.peakWholeSystemCop.toFixed(6), tone: 'ok' },
    { label: '100-rev mean', value: GRAY_COP_100REV.meanWholeSystemCop.toFixed(6), tone: 'ok' },
    { label: '100-rev range', value: `${lo.toFixed(6)}–${hi.toFixed(6)}`, tone: 'ok' },
    { label: 'Presenter COP 300', value: 'source-claim only', tone: 'claim' },
  ]
}

export function grayCopCatalogRows(): Record<string, string>[] {
  return Object.entries(GRAY_COP_100REV.closure).map(([id, row]) => ({
    id,
    model: id,
    cop:   row.wholeSystemCop.toFixed(6),
    residual: row.normalizedResidual.toExponential(3),
  }))
}

export function graySchematicMetrics(): CaseMetric[] {
  const circuit = GRAY_SCHEMATIC.circuit
  const patent = GRAY_SCHEMATIC.topology.patent
  return [
    { label: 'Hold capacitors', value: String(circuit.holdCapacitors) },
    { label: 'Dump-bank capacitors', value: String(circuit.dumpBankCapacitors) },
    { label: 'Commutator contacts', value: String(circuit.commutatorContacts) },
    { label: 'Patent events/rev', value: String(patent.eventsPerRevolution) },
    { label: 'Visible 1979 stator poles', value: String(GRAY_SCHEMATIC.topology.colored1979.visibleStatorPoles) },
    { label: 'Production LUT', value: GRAY_SCHEMATIC.productionLut.published ? 'published' : 'not published', tone: 'warn' },
  ]
}

export function grayWhisperCues(): readonly GrayWhisperCueV1[] {
  return WHISPER_CUES
}

export function grayWhisperCueRows(): Record<string, string>[] {
  return WHISPER_CUES.map((cue) => ({
    id:        cue.id,
    time:      timestampFromSeconds(cue.start),
    section:   cue.section,
    why:       cue.why,
    text:      cue.text,
  }))
}

export function graySchematicCueRefs(): SchematicRef[] {
  return WHISPER_CUES.map((cue) => ({
    id:        cue.id,
    title:     cue.why,
    caption:   cue.text,
    href:      `${GRAY_VIDEO.url}&t=${Math.floor(cue.start)}s`,
    src:       CUE_FRAMES.get(cue.id) ?? null,
    subtitle:  cue.section,
    timestamp: timestampFromSeconds(cue.start),
  }))
}

export function grayClaimsClipMetrics(): CaseMetric[] {
  return [
    { label: 'Claims window', value: GRAY_CLAIMS_CLIP.sourceWindow },
    { label: 'Clip duration', value: `${GRAY_CLAIMS_CLIP.durationSeconds} s` },
    { label: 'Resolution', value: `${GRAY_CLAIMS_CLIP.width}×${GRAY_CLAIMS_CLIP.height}` },
    { label: 'Codecs', value: `${GRAY_CLAIMS_CLIP.videoCodec}+${GRAY_CLAIMS_CLIP.audioCodec}` },
    { label: 'Bundled in app', value: 'false / research path only', tone: 'warn' },
    { label: 'Size', value: `${GRAY_CLAIMS_CLIP.sizeLabel} / ${GRAY_CLAIMS_CLIP.bytes} B` },
  ]
}

export function grayClaimsWindowCueRows(): Record<string, string>[] {
  return WHISPER_CUES
    .filter((cue) => cue.start >= GRAY_CLAIMS_CLIP.sourceStartSeconds && cue.start < GRAY_CLAIMS_CLIP.sourceEndSeconds)
    .map((cue) => ({
      id:      cue.id,
      time:    timestampFromSeconds(cue.start),
      section: cue.section,
      why:     cue.why,
      text:    cue.text,
    }))
}

export function grayClaimsClipHref(): string {
  return `${GRAY_VIDEO.url}&t=${GRAY_CLAIMS_CLIP.sourceStartSeconds}s`
}

export function grayCopCatalogClaims(): { label: string, value: string, status: string }[] {
  return [
    { label: '100-rev peak (ema4)', value: GRAY_COP_100REV.peakWholeSystemCop.toFixed(6), status: 'classical ledger' },
    { label: '100-rev mean', value: GRAY_COP_100REV.meanWholeSystemCop.toFixed(6), status: 'classical ledger' },
    { label: 'Presenter COP 300', value: String(GRAY_COP_100REV.claimedCop.presenter300), status: GRAY_COP_100REV.claimedCop.status },
    { label: 'Whisper 26.8 W / 7.5 kW', value: GRAY_COP_100REV.claimedCop.whisperArithmetic26p8W_7p5kW.toFixed(2), status: GRAY_COP_100REV.claimedCop.status },
    { label: 'Retained transcript COP 282', value: 'Absent', status: 'not in retained pack' },
  ]
}
