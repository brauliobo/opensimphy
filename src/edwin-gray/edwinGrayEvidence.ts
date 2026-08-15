export type GrayEvidenceSourceType =
  | 'automatic-caption'
  | 'presentation-frame'
  | 'presenter-reconstruction'
  | 'secondhand-attribution'
  | 'retained-pack-audit'

export type GrayEvidenceConfidence = 'high' | 'medium' | 'low'
export type GrayMachinePhase = 'original' | 'modified' | 'inferred' | 'unknown' | 'not-applicable'
export type GrayValidationStatus =
  | 'presentation-assertion'
  | 'frame-corroborated-presentation'
  | 'presenter-reconstruction'
  | 'secondhand-unverified'
  | 'ambiguous-automatic-caption'
  | 'absent-from-retained-pack'

export interface GrayTimestampRange {
  start: string | null
  end: string | null
  startSeconds: number | null
  endSeconds: number | null
  precision: 'caption-cue' | 'sampled-frame-window' | 'source-pack-wide'
}

export interface GrayFrameRange {
  first: string
  last: string
  retainedSourceStart: string
  retainedSourceEnd: string
  note: string
}

export interface GrayMachineState {
  machine: string
  phase: GrayMachinePhase
  revision: string
}

export interface GrayEvidenceRecord {
  id: string
  sourceType: GrayEvidenceSourceType
  sourceRef: string
  timestamp: GrayTimestampRange
  textKind: 'quote' | 'paraphrase' | 'raw-caption' | 'absence-finding'
  text: string
  confidence: GrayEvidenceConfidence
  confidenceNote: string
  machineState: GrayMachineState
  validationStatus: GrayValidationStatus
  frameRange: GrayFrameRange | null
  implications: readonly string[]
}

export interface GrayEvidenceContradiction {
  id: string
  recordIds: readonly string[]
  status: 'state-scoped' | 'unresolved'
  resolution: string
}

const CAPTION_SOURCE = 'research/opensimphy-edwin-gray/source/media/nC740fpBs4M.en-orig.vtt'
const FRAME_SOURCE = 'research/opensimphy-edwin-gray/frames'
const REPORT_SOURCE = 'research/opensimphy-edwin-gray/analysis/report.md'

const timestamp = (
  start: string | null,
  end: string | null,
  startSeconds: number | null,
  endSeconds: number | null,
  precision: GrayTimestampRange['precision'] = 'caption-cue',
): GrayTimestampRange => ({ start, end, startSeconds, endSeconds, precision })

const frameRange = (first: string, last: string, note: string): GrayFrameRange => ({
  first,
  last,
  retainedSourceStart: '00:07:50',
  retainedSourceEnd: '00:12:50',
  note,
})

export const GRAY_RETAINED_FRAME_BOUNDARY = Object.freeze({
  sourceStart: '00:07:50',
  sourceEnd: '00:12:50',
  sourceStartSeconds: 470,
  sourceEndSeconds: 770,
  firstFrame: 'genealogy-001.jpg',
  lastFrame: 'genealogy-100.jpg',
  exactFrameTimestampsRetained: false,
  limitation: 'The sampled JPEG sequence has no retained exact frame-to-caption index and cannot support claims outside its five-minute source segment.',
})

export const GRAY_EVIDENCE_RECORDS: readonly GrayEvidenceRecord[] = Object.freeze([
  {
    id: 'gray-frame-ema3-cannibalized-into-ema4',
    sourceType: 'presentation-frame',
    sourceRef: `${FRAME_SOURCE}/genealogy-012.jpg..genealogy-019.jpg`,
    timestamp: timestamp('00:08:25', '00:08:49', 505, 529, 'sampled-frame-window'),
    textKind: 'quote',
    text: 'Motor EMA3 - cannibalized to make the later EMA4',
    confidence: 'high',
    confidenceNote: 'The wording is legible on retained presentation frames; exact timestamps for individual JPEGs were not retained.',
    machineState: { machine: 'EMA3 to EMA4', phase: 'original', revision: 'genealogy claim' },
    validationStatus: 'frame-corroborated-presentation',
    frameRange: frameRange('genealogy-012.jpg', 'genealogy-019.jpg', 'Retained slide identifies EMA3 and states its relationship to EMA4.'),
    implications: ['EMA3 and EMA4 must not be modeled as independent intact machines.', 'Cannibalization is a slide claim, not a teardown or build record.'],
  },
  {
    id: 'gray-frame-ema4-e2-transistor-supplies',
    sourceType: 'presentation-frame',
    sourceRef: `${FRAME_SOURCE}/genealogy-040.jpg..genealogy-047.jpg`,
    timestamp: timestamp('00:09:47', '00:10:08', 587, 608, 'sampled-frame-window'),
    textKind: 'quote',
    text: '1973 Cole-Hackenburger Improved EMA4-E2 Free Energy Motor using Transistor Power Supplies',
    confidence: 'high',
    confidenceNote: 'The wording is legible on retained presentation frames; spelling is preserved from the slide.',
    machineState: { machine: 'EMA4-E2', phase: 'modified', revision: '1973 transistor-supply presentation state' },
    validationStatus: 'frame-corroborated-presentation',
    frameRange: frameRange('genealogy-040.jpg', 'genealogy-047.jpg', 'Retained slide labels an improved EMA4-E2 and transistor power supplies.'),
    implications: ['EMA4-E2 is a presented revision, not interchangeable with every EMA4 state.', 'No transistor circuit values are supplied.'],
  },
  {
    id: 'gray-caption-ema6-two-horsepower',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:10:31-00:10:43`,
    timestamp: timestamp('00:10:31', '00:10:43', 631, 643),
    textKind: 'quote',
    text: 'This is called the EMA6 ... when it was demonstrated only put out two horsepower.',
    confidence: 'high',
    confidenceNote: 'The automatic captions clearly associate the approximate output claim with the demonstrated EMA6.',
    machineState: { machine: 'EMA6', phase: 'original', revision: '1976 demonstration state' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['The approximately 2 hp value is a presenter claim, not a retained dynamometer measurement.', 'Later EMA6 revisions must not inherit it as a fixed output.'],
  },
  {
    id: 'gray-caption-colored-machine-distinctions',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:12:02-00:12:31`,
    timestamp: timestamp('00:12:02', '00:12:31', 722, 751),
    textKind: 'paraphrase',
    text: 'Black was described with one pole set and a viewing opening; purple with an energy-recovery system; white as all plastic; gold as like purple but without recovery.',
    confidence: 'high',
    confidenceNote: 'The distinctions are explicit in adjacent caption cues and the machine family is visible in retained frames.',
    machineState: { machine: 'Black/Purple/White/Gold 1979 family', phase: 'original', revision: 'presented color distinctions' },
    validationStatus: 'frame-corroborated-presentation',
    frameRange: frameRange('genealogy-074.jpg', 'genealogy-082.jpg', 'Retained family slide labels black, purple, white, and gold machines; captions provide the distinctions.'),
    implications: ['Color rows represent distinct presented configurations.', 'The slide and narration do not establish dimensions, materials beyond the stated housing, or complete circuits.'],
  },
  {
    id: 'gray-caption-schloff-awg14-rewind',
    sourceType: 'secondhand-attribution',
    sourceRef: `${CAPTION_SOURCE}:00:18:09-00:18:30`,
    timestamp: timestamp('00:18:09', '00:18:30', 1089, 1110),
    textKind: 'paraphrase',
    text: 'The presenter reports Schloff removed uncertain original fine wire and rewound the electromagnets as simple solenoids with AWG 14 wire.',
    confidence: 'medium',
    confidenceNote: 'The modification is attributed to a presenter interview; original wire gauge is expressly uncertain.',
    machineState: { machine: 'surviving colored prototypes', phase: 'modified', revision: 'Schloff AWG 14 rewind' },
    validationStatus: 'secondhand-unverified',
    frameRange: null,
    implications: ['AWG 14 describes the modified state only.', 'Original turns, conductor gauge, and winding topology remain unknown.'],
  },
  {
    id: 'gray-caption-schloff-zero-start-opposite-rotation',
    sourceType: 'secondhand-attribution',
    sourceRef: `${CAPTION_SOURCE}:00:18:30-00:18:35`,
    timestamp: timestamp('00:18:30', '00:18:35', 1110, 1115),
    textKind: 'quote',
    text: 'the motors would start ... from zero speed, and they\'d go in the opposite direction',
    confidence: 'medium',
    confidenceNote: 'The caption is clear, but the statement is secondhand and does not identify every modified machine individually.',
    machineState: { machine: 'surviving colored prototypes', phase: 'modified', revision: 'Schloff AWG 14 rewind' },
    validationStatus: 'secondhand-unverified',
    frameRange: null,
    implications: ['Start-from-zero and reverse rotation belong to the rewound state.', 'This does not refute the separate starter requirement reported for the original state.'],
  },
  {
    id: 'gray-caption-schloff-ten-kw-no-load',
    sourceType: 'secondhand-attribution',
    sourceRef: `${CAPTION_SOURCE}:00:18:37-00:18:46`,
    timestamp: timestamp('00:18:37', '00:18:46', 1117, 1126),
    textKind: 'quote',
    text: 'it took 10 kilowatts of power to run this motor in that configuration with no load',
    confidence: 'medium',
    confidenceNote: 'The presenter states the value clearly but supplies no instrument record or machine-specific test log.',
    machineState: { machine: 'surviving colored prototypes', phase: 'modified', revision: 'Schloff AWG 14 rewind' },
    validationStatus: 'secondhand-unverified',
    frameRange: null,
    implications: ['The 10 kW no-load report characterizes the modified configuration only.', 'It is not evidence for original-machine efficiency.'],
  },
  {
    id: 'gray-caption-cop300-presenter-claim',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:09:00-00:09:32`,
    timestamp: timestamp('00:09:00', '00:09:32', 540, 572),
    textKind: 'quote',
    text: 'That\'s where they came up with the calculations of the COP of 300.',
    confidence: 'high',
    confidenceNote: 'High confidence that the presentation contains the claim; no Crosby/JPL report or measurement ledger is retained.',
    machineState: { machine: 'EMA4', phase: 'original', revision: 'presenter-described Caltech/Crosby test state' },
    validationStatus: 'presentation-assertion',
    frameRange: frameRange('genealogy-020.jpg', 'genealogy-039.jpg', 'Retained EMA4/Crosby presentation slides occur in this sampled visual sequence.'),
    implications: ['COP 300 is a presenter-attributed historical claim, not a validated result.', 'The retained pack cannot reproduce its numerator, denominator, or energy boundary.'],
  },
  {
    id: 'gray-caption-input-26-8-watts',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:29:08-00:29:14`,
    timestamp: timestamp('00:29:08', '00:29:14', 1748, 1754),
    textKind: 'quote',
    text: 'this whole thing took 26.8 watts in',
    confidence: 'high',
    confidenceNote: 'The numeric input is clear in the caption, but its measurement boundary and instrumentation are absent.',
    machineState: { machine: 'unspecified Gray converter system', phase: 'original', revision: 'presenter-reported performance state' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['26.8 W must remain a raw source claim.', 'It cannot be combined with a model ledger without a defined system boundary and duration.'],
  },
  {
    id: 'gray-caption-output-raw-7-12-kilowatts',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:29:14-00:29:19`,
    timestamp: timestamp('00:29:14', '00:29:19', 1754, 1759),
    textKind: 'raw-caption',
    text: 'came up with uh 7 12 kilowatts out',
    confidence: 'low',
    confidenceNote: 'The automatic caption has no audible punctuation and can represent a range, a decimal, or recognition error.',
    machineState: { machine: 'unspecified Gray converter system', phase: 'original', revision: 'presenter-reported performance state' },
    validationStatus: 'ambiguous-automatic-caption',
    frameRange: null,
    implications: ['Do not normalize this text to 7-12 kW or 7.12 kW.', 'No output power value from this cue is suitable as a validated model target.'],
  },
  {
    id: 'gray-caption-fifteen-contacts-unknown-wiring',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:31:52-00:32:23`,
    timestamp: timestamp('00:31:52', '00:32:23', 1912, 1943),
    textKind: 'paraphrase',
    text: 'The commutator has 15 contacts, not all are used, and the presenter says the original purposes and the surviving wiring selection are unknown.',
    confidence: 'high',
    confidenceNote: 'The count and uncertainty are explicit in the captions.',
    machineState: { machine: 'Gold/Purple commutator assembly', phase: 'unknown', revision: 'post-Schloff surviving wiring' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['A complete contact schedule cannot be reconstructed from this source.', 'Unused contacts must not be assigned fabricated functions.'],
  },
  {
    id: 'gray-caption-original-thyratron-ignitron-trigger',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:34:10-00:34:16`,
    timestamp: timestamp('00:34:10', '00:34:16', 2050, 2056),
    textKind: 'paraphrase',
    text: 'Originally the ignitrons were fired by thyratrons.',
    confidence: 'medium',
    confidenceNote: 'The automatic caption mangles the tube names, but the adjacent presenter context and translated transcript identify thyratrons and ignitrons.',
    machineState: { machine: 'Gold/Purple switching assembly', phase: 'original', revision: 'thyratron trigger' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['The original trigger and Schloff trigger are separate revisions.', 'Tube characteristics and wiring remain unavailable.'],
  },
  {
    id: 'gray-caption-modified-zener-ignitron-trigger',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:34:16-00:34:50`,
    timestamp: timestamp('00:34:16', '00:34:50', 2056, 2090),
    textKind: 'paraphrase',
    text: 'Schloff used a Zener-diode string to reduce 5,000 V to a reported 1,500 V ignitron trigger level; the commutator triggered the card, then the ignitron.',
    confidence: 'medium',
    confidenceNote: 'The modification sequence is clear, but no schematic values, diode count, or test record is retained.',
    machineState: { machine: 'Gold/Purple switching assembly', phase: 'modified', revision: 'Schloff Zener trigger card' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['Do not combine the Zener card with the original thyratron trigger in one machine state.', 'The stated voltages are presenter claims, not validated component limits.'],
  },
  {
    id: 'gray-caption-presenter-reconstructed-capacitor-switching',
    sourceType: 'presenter-reconstruction',
    sourceRef: `${CAPTION_SOURCE}:00:34:53-00:35:35`,
    timestamp: timestamp('00:34:53', '00:35:35', 2093, 2135),
    textKind: 'paraphrase',
    text: 'The presenter reconstruction keeps two capacitors charged, pulse-charges a bank of four under commutator control, then discharges that bank through the motor a few degrees later.',
    confidence: 'medium',
    confidenceNote: 'The presenter labels the schematic as his interpretation and says he does not know why it was arranged this way.',
    machineState: { machine: 'Gold switching assembly', phase: 'inferred', revision: 'presenter/Al drawing reconstruction' },
    validationStatus: 'presenter-reconstruction',
    frameRange: null,
    implications: ['The capacitor sequence is suitable only as a bounded inferred topology.', 'It must not be promoted to known original wiring or a complete 15-contact schedule.'],
  },
  {
    id: 'gray-caption-original-500-rpm-starter',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:37:02-00:37:26`,
    timestamp: timestamp('00:37:02', '00:37:26', 2222, 2246),
    textKind: 'paraphrase',
    text: 'The presenter says the technology could not start from zero and describes using a generator as a starter to reach a minimum of 500 RPM.',
    confidence: 'medium',
    confidenceNote: 'The claim is explicit but is not tied to a retained speed trace or a universally identified machine revision.',
    machineState: { machine: 'original Gray motor configuration', phase: 'original', revision: 'presenter-described starter configuration' },
    validationStatus: 'presentation-assertion',
    frameRange: null,
    implications: ['500 RPM is a reported original-state starter condition, not a universal model constant.', 'It must remain separate from the Schloff rewound zero-start state.'],
  },
  {
    id: 'gray-caption-purple-recovery-coils',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:12:13-00:12:20 and 00:40:54-00:43:18`,
    timestamp: timestamp('00:12:13', '00:12:20', 733, 740),
    textKind: 'paraphrase',
    text: 'Purple is described with an energy-recovery system; later narration identifies large outer windings as recovery coils.',
    confidence: 'medium',
    confidenceNote: 'The presentation consistently labels recovery windings, but no winding schedule or recovery measurement is retained.',
    machineState: { machine: 'Purple 1979', phase: 'original', revision: 'presented recovery-coil configuration' },
    validationStatus: 'frame-corroborated-presentation',
    frameRange: frameRange('genealogy-074.jpg', 'genealogy-082.jpg', 'Family slide includes the purple machine; detailed recovery-coil discussion is outside the retained video segment.'),
    implications: ['Presence of recovery coils does not establish recovery efficiency.', 'Drive and recovery winding values remain unknown.'],
  },
  {
    id: 'gray-caption-gold-without-recovery',
    sourceType: 'automatic-caption',
    sourceRef: `${CAPTION_SOURCE}:00:12:24-00:12:31`,
    timestamp: timestamp('00:12:24', '00:12:31', 744, 751),
    textKind: 'quote',
    text: 'The gold motor was the same as the purple motor except it didn\'t have the energy ... recovery.',
    confidence: 'high',
    confidenceNote: 'The color comparison is explicit in the captions and occurs within the retained frame segment.',
    machineState: { machine: 'Gold 1979', phase: 'original', revision: 'presented no-recovery configuration' },
    validationStatus: 'frame-corroborated-presentation',
    frameRange: frameRange('genealogy-074.jpg', 'genealogy-082.jpg', 'Family slide labels the gold and purple machines.'),
    implications: ['Gold must not inherit purple recovery coils.', 'Similarity does not establish otherwise identical internal wiring.'],
  },
  {
    id: 'gray-caption-recovery-67-percent-secondhand',
    sourceType: 'secondhand-attribution',
    sourceRef: `${CAPTION_SOURCE}:00:56:19-00:56:25`,
    timestamp: timestamp('00:56:19', '00:56:25', 3379, 3385),
    textKind: 'quote',
    text: 'Hackenberger said they only got about 67% of the energy back to recharge the battery.',
    confidence: 'medium',
    confidenceNote: 'The percentage is clear, but it is a secondhand attribution without a retained measurement method or denominator.',
    machineState: { machine: 'unspecified recovery-equipped Gray system', phase: 'original', revision: 'Hackenberger-attributed recovery state' },
    validationStatus: 'secondhand-unverified',
    frameRange: null,
    implications: ['67% is not a calibrated recovery coefficient.', 'The source does not establish which machine, operating point, or energy boundary produced it.'],
  },
  {
    id: 'gray-audit-cop282-absent',
    sourceType: 'retained-pack-audit',
    sourceRef: `${REPORT_SOURCE}:retained source pack plus caption search`,
    timestamp: timestamp(null, null, null, null, 'source-pack-wide'),
    textKind: 'absence-finding',
    text: 'COP 282 is absent from the retained Motor Edwin Gray source pack; the retained presentation claim is COP 300.',
    confidence: 'high',
    confidenceNote: 'The retained VTT, JSON3, translated transcript, report, and sampled-frame labels contain no COP 282 claim.',
    machineState: { machine: 'retained source pack', phase: 'not-applicable', revision: '2026-08-12 audit' },
    validationStatus: 'absent-from-retained-pack',
    frameRange: null,
    implications: ['COP 282 must not be attributed to this retained source pack.', 'Any future COP 282 benchmark requires a separate cited source and evidence boundary.'],
  },
])

export const GRAY_EVIDENCE_BY_ID: Readonly<Record<string, GrayEvidenceRecord>> = Object.freeze(
  Object.fromEntries(GRAY_EVIDENCE_RECORDS.map((record) => [record.id, record])),
)

export const GRAY_EVIDENCE_CONTRADICTIONS: readonly GrayEvidenceContradiction[] = Object.freeze([
  {
    id: 'gray-start-condition-state-boundary',
    recordIds: ['gray-caption-original-500-rpm-starter', 'gray-caption-schloff-zero-start-opposite-rotation'],
    status: 'state-scoped',
    resolution: 'The 500 RPM starter claim describes an original configuration; start-from-zero and opposite rotation describe the later AWG 14 Schloff rewind.',
  },
  {
    id: 'gray-trigger-state-boundary',
    recordIds: ['gray-caption-original-thyratron-ignitron-trigger', 'gray-caption-modified-zener-ignitron-trigger'],
    status: 'state-scoped',
    resolution: 'Thyratrons are presented as the original ignitron trigger and the Zener card as Schloff\'s replacement; they are not simultaneous circuit elements.',
  },
  {
    id: 'gray-performance-claim-boundary',
    recordIds: ['gray-caption-cop300-presenter-claim', 'gray-caption-input-26-8-watts', 'gray-caption-output-raw-7-12-kilowatts'],
    status: 'unresolved',
    resolution: 'The claims lack a common retained energy ledger, and the output caption is ambiguous; no COP can be recomputed from these records.',
  },
])

export function grayEvidenceRecord(id: string): GrayEvidenceRecord {
  const record = GRAY_EVIDENCE_BY_ID[id]
  if (!record) throw new Error(`Unknown Edwin Gray evidence record: ${id}`)
  return record
}
