import { GRAY_VIDEO, GRAY_VIDEO_TIMELINE } from '../edwin-gray/edwinGrayGuide'
import type { SchematicRef } from './types'

export const GRAY_FRAME_MANIFEST_URL = `${import.meta.env.BASE_URL}data/generated/edwin-gray/frames/manifest.json`
export const GRAY_TRANSCRIPT_CUES_URL = `${import.meta.env.BASE_URL}data/generated/edwin-gray/transcript-cues.json`

const STAGED_FRAMES: Readonly<Record<string, string>> = Object.freeze({
  ema:    'data/generated/edwin-gray/frames/genealogy-004.jpg',
  colors: 'data/generated/edwin-gray/frames/genealogy-084.jpg',
})

const STAGED_CUES: Readonly<Record<string, string>> = Object.freeze({
  ema:    'This motor was not made in isolation. It is the fifth generation of a whole series of motors that started construction in about 1971 and is based by an inventor named Marvin Cole.',
  colors: 'The black motor at the end here just has one set of poles and it\'s got an opening on the side so you can actually see the timing and the effect of what\'s going on inside the motor.',
})

interface GrayFrameManifestV1 {
  schemaVersion: 1
  frames: readonly { id: string, src: string, caption?: string }[]
}

interface GrayTranscriptCuesV1 {
  schemaVersion: 1
  cues: readonly { id: string, text: string }[]
}

const frameSrcById = new Map<string, string>(Object.entries(STAGED_FRAMES))
const cueById = new Map<string, string>(Object.entries(STAGED_CUES))
let manifestState: 'idle' | 'loading' | 'ready' | 'absent' = 'idle'
let manifestPromise: Promise<void> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isManifest(value: unknown): value is GrayFrameManifestV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.frames)) return false
  return value.frames.every((frame) => {
    if (!isRecord(frame)) return false
    return typeof frame.id === 'string' && frame.id.length > 0 && typeof frame.src === 'string' && frame.src.length > 0
  })
}

function isCuePack(value: unknown): value is GrayTranscriptCuesV1 {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.cues)) return false
  return value.cues.every((cue) => isRecord(cue) && typeof cue.id === 'string' && typeof cue.text === 'string')
}

export async function loadGrayFrameManifest(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<void> {
  if (manifestState === 'ready' || manifestState === 'absent') return
  if (manifestPromise) return manifestPromise
  manifestState = 'loading'
  manifestPromise = (async () => {
    const [frameResponse, cueResponse] = await Promise.all([
      fetchImpl(GRAY_FRAME_MANIFEST_URL, { signal }),
      fetchImpl(GRAY_TRANSCRIPT_CUES_URL, { signal }),
    ])
    if (frameResponse.status === 404 && cueResponse.status === 404) {
      manifestState = 'absent'
      return
    }
    if (frameResponse.ok) {
      const payload: unknown = await frameResponse.json()
      if (!isManifest(payload)) throw new TypeError('Gray frame manifest is not a v1 frame list')
      for (const frame of payload.frames) frameSrcById.set(frame.id, frame.src)
    } else if (frameResponse.status !== 404) {
      throw new Error(`Gray frame manifest returned HTTP ${frameResponse.status}`)
    }
    if (cueResponse.ok) {
      const payload: unknown = await cueResponse.json()
      if (!isCuePack(payload)) throw new TypeError('Gray transcript cues are not a v1 cue list')
      for (const cue of payload.cues) cueById.set(cue.id, cue.text)
    } else if (cueResponse.status !== 404) {
      throw new Error(`Gray transcript cues returned HTTP ${cueResponse.status}`)
    }
    manifestState = 'ready'
  })().finally(() => {
    if (manifestState === 'loading') manifestState = 'idle'
    manifestPromise = null
  })
  return manifestPromise
}

export function resetGrayFrameManifestForTests(): void {
  frameSrcById.clear()
  cueById.clear()
  for (const [id, src] of Object.entries(STAGED_FRAMES)) frameSrcById.set(id, src)
  for (const [id, text] of Object.entries(STAGED_CUES)) cueById.set(id, text)
  manifestState = 'idle'
  manifestPromise = null
}

export function setGrayFrameManifestForTests(frames: readonly { id: string, src: string }[], cues: readonly { id: string, text: string }[] = []): void {
  frameSrcById.clear()
  cueById.clear()
  for (const frame of frames) frameSrcById.set(frame.id, frame.src)
  for (const cue of cues) cueById.set(cue.id, cue.text)
  manifestState = 'ready'
}

export function graySchematicRefs(): SchematicRef[] {
  return GRAY_VIDEO_TIMELINE.map((entry) => ({
    id:        entry.id,
    title:     entry.title,
    caption:   `${entry.frame}. ${entry.lesson}`,
    href:      `${GRAY_VIDEO.url}&t=${entry.seconds}s`,
    src:       frameSrcById.get(entry.id) ?? null,
    subtitle:  cueById.get(entry.id) ?? null,
    timestamp: entry.timestamp,
  }))
}
