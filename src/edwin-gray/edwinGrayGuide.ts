export interface GrayTimelineEntry {
  id: string
  timestamp: string
  seconds: number
  title: string
  frame: string
  lesson: string
  moduleId: string
}

export interface GrayGuideSection {
  id: string
  number: string
  title: string
  question: string
  answer: string
  teacherNote: string
  equation: string
  evidenceLabel: string
  assumptionLabel: string
  moduleId?: string
}

export interface GrayTerm {
  term: string
  plain: string
  technical: string
}

export const GRAY_VIDEO = Object.freeze({
  id: 'nC740fpBs4M',
  url: 'https://www.youtube.com/watch?v=nC740fpBs4M',
  title: 'Motor Edwin Gray',
  uploader: 'Rogerio Polenta',
  duration: '1:16:08',
  uploaded: '2026-08-11',
  downloadedSource: 'research/opensimphy-edwin-gray/source/nC740fpBs4M.mp4',
  transcript: 'Motor Edwin Gray.txt',
  analysisReport: 'research/opensimphy-edwin-gray/analysis/report.md',
})

export const GRAY_FEM_PROVENANCE = Object.freeze({
  workspace: 'https://github.com/brauliobo/opensimphy/blob/main/fem/edwin-gray/README.md',
  sourceLedger: 'https://github.com/brauliobo/opensimphy/blob/main/fem/edwin-gray/source/README.md',
  status: 'not-run',
  solverBoundary: 'FEAScript is not a magnetic solver and does not produce the FEM values shown by this workspace.',
})

export const GRAY_LEARNING_PROMISE = 'The shortest version is: a charged capacitor is modeled as a pulsed dump through open-core electromagnets, a rotating arc is given a quench condition, and a classical energy ledger stays below unity even when historical COP-300 claims are shown beside it.'

export const GRAY_GUIDE_SECTIONS: readonly GrayGuideSection[] = Object.freeze([
  Object.freeze({
    id: 'topology',
    number: '01',
    title: 'Patent topology: 9 stator pair stations and 3 rotor pair stations',
    question: 'What topology does the patent actually describe?',
    answer: 'The patent-derived schedule uses 9 stator pair stations, 3 rotor pair stations, two major/minor elements per station, and 27 angular events per revolution. Three sectors are represented at each event.',
    teacherNote: 'Keep this patent-described topology separate from the later colored prototype evidence. The dimensions, materials, winding details, and displayed cross-sections are illustrative assumptions, not a teardown.',
    equation: '27 events/rev = 9 stator pair stations x 3 rotor sectors',
    evidenceLabel: 'Evidence: patent-described and patent-derived topology',
    assumptionLabel: 'Assumption: dimensions, materials, and winding details are illustrative',
    moduleId: 'geometry',
  }),
  Object.freeze({
    id: 'circuit',
    number: '02',
    title: 'Charge two capacitors, pulse-charge four, then schedule a dump',
    question: 'How did the 1979 gold/purple electrics switch?',
    answer: 'A high-voltage supply holds a pair of capacitors. A commutator event is modeled as charging a four-capacitor bank, followed by a scheduled dump into the participating sectors.',
    teacherNote: 'The exact wiring and contact assignment are not established here. The instrument shows a bounded schematic and three-sector event schedule; it does not claim a whole-machine simultaneous trigger.',
    equation: 'E = 1/2 C V^2 dumped into L_eq of paralleled open-core coils',
    evidenceLabel: 'Evidence: presenter-reported circuit description',
    assumptionLabel: 'Assumption: ideal switches and lumped capacitor/coil values',
    moduleId: 'circuit',
  }),
  Object.freeze({
    id: 'arc',
    number: '03',
    title: 'The running condition is an elongating pole-face arc',
    question: 'Why will the machine not start from rest?',
    answer: 'Current is interrupted by stretching an arc across the pole faces. The talk reports 500 rpm for one described setup, with quench timing marked in three-degree steps; this is not a universal threshold.',
    teacherNote: 'The “radiant event” is a source-claim placed at current interruption. This instrument integrates only the classical RLC current until the modeled quench condition and does not insert extra force at the break.',
    equation: 't_quench = theta_quench / omega,  omega = 2 pi n / 60',
    evidenceLabel: 'Evidence: presenter-reported 500 rpm reference condition, not universal',
    assumptionLabel: 'Assumption: arc quench is represented by a bounded timing and speed rule',
    moduleId: 'pulse',
  }),
  Object.freeze({
    id: 'energy',
    number: '04',
    title: 'A classical ledger versus a historical COP claim',
    question: 'Where does the capacitor energy go?',
    answer: 'Into I^2 R, the quench spark, a small Maxwell-stress torque, optional recovery-coil transfer, and leftover C and L. The independent torque integral is shown directly; any pulse-stage balance residual remains visible instead of being assigned to torque.',
    teacherNote: 'Crosby/JPL COP 300 at 26 W is a source-claim from the talk, not a result of this model. Open cores leak flux; McCay’s own point is that classical magnetic torque is tiny.',
    equation: 'W_torque = integral(tau d theta);  Delta E = E_source - (W_torque + W_rec + losses + residuals)',
    evidenceLabel: 'Evidence: historical COP-300 statement is a source-claim',
    assumptionLabel: 'Assumption: angle-dependent co-energy and inductance form a lumped classical surrogate',
    moduleId: 'energy',
  }),
  Object.freeze({
    id: 'compare',
    number: '05',
    title: 'Later colored prototypes: evidence comparison, not patent topology',
    question: 'What changes between the colored prototype rows?',
    answer: 'The catalog comparison varies the prototype label, pole count, leakage coupling, housing, and recovery winding. It does not revise the patent topology or prove that any colored machine had the displayed parameters.',
    teacherNote: 'Compare rows, do not merge them into a single “Gray motor.” Purple, gold, white, black, EMA4, and EMA6 are source-described prototype claims represented by illustrative model inputs; recovery energy here is transformer-like at interruption.',
    equation: 'k_white << k_aluminum;  W_rec = 0 unless hasRecovery',
    evidenceLabel: 'Evidence: later colored prototype descriptions and claims',
    assumptionLabel: 'Assumption: coupling, housing, and recovery values are illustrative comparison inputs',
    moduleId: 'family',
  }),
])

export const GRAY_TERMS: readonly GrayTerm[] = Object.freeze([
  { term: 'COP', plain: 'Useful output divided by electrical input for one stated model.', technical: 'Here COP_classical = (W_mech + W_rec) / (1/2 C V^2) for one dump. Historical COP 300 is a source-claim, not this ratio.' },
  { term: 'Open-core coil', plain: 'An electromagnet whose iron does not close a loop.', technical: 'L ≈ μ0 N^2 A / l times a leakage factor. There is no high-permeability return, so gap flux is small.' },
  { term: 'Ignitron', plain: 'A mercury-arc switch used to dump or charge the capacitor bank.', technical: 'Modeled only as an ideal closing/opening instant. Tube drop and ionization are omitted.' },
  { term: 'Conversion tube', plain: 'Gray’s three-element switching tube from the 1975 patent.', technical: 'EMA6 tried it, then went back to a mechanical commutator. This lab does not simulate plasma inside the tube.' },
  { term: 'Recovery coil', plain: 'An outer winding on the purple/EMA4 stator poles.', technical: 'Coupled at quench as W_rec ≤ k_rec * (1/2 L I_q^2). Isolated from the inner drive winding.' },
  { term: 'Radiant event', plain: 'The talk’s name for a non-classical kick at arc break.', technical: 'Source-claim. The engine never adds a force term at interruption.' },
])

export const GRAY_VIDEO_TIMELINE: readonly GrayTimelineEntry[] = Object.freeze([
  { id: 'intro', timestamp: '00:04:00', seconds: 240, title: 'Purple motor on the bench', frame: 'side view of the 1979 purple machine', lesson: 'Identify the prototype, not a production motor.', moduleId: 'geometry' },
  { id: 'ema', timestamp: '00:08:00', seconds: 480, title: 'EMA4 then EMA6', frame: '1971 Cole machine and 1976 Hackenberger machine', lesson: 'The family starts before Dodge City.', moduleId: 'geometry' },
  { id: 'colors', timestamp: '00:12:00', seconds: 720, title: 'Purple, white, gold, black', frame: 'line-up of 1979 housings', lesson: 'Each color tests one subsystem.', moduleId: 'family' },
  { id: 'gold-teardown', timestamp: '00:25:00', seconds: 1500, title: 'Gold commutator and ignitrons', frame: '15-contact commutator, stator, rotor, ignitron set', lesson: 'Trace the scheduled participating sectors, not an all-coil trigger.', moduleId: 'circuit' },
  { id: 'charge-net', timestamp: '00:30:00', seconds: 1800, title: 'Two capacitors, then four', frame: 'high-side charge ignitrons and dump path', lesson: 'Pulse-charge, then dump a few degrees later.', moduleId: 'circuit' },
  { id: 'open-cores', timestamp: '00:33:00', seconds: 1980, title: 'Open-core coils from the black motor', frame: 'laminated open cores, AWG 14 rewind', lesson: 'No closed magnetic path.', moduleId: 'geometry' },
  { id: 'recovery', timestamp: '00:36:00', seconds: 2160, title: 'Purple recovery windings', frame: 'large outer coils around small stator coils', lesson: 'Three-winding pole, Stubblefield-like layout.', moduleId: 'family' },
  { id: 'secret-arc', timestamp: '00:46:00', seconds: 2760, title: 'Pole-face arc and 2×3 in window', frame: 'front window and air-compressor notch', lesson: 'Quench by stretching the arc, not by a quiet semiconductor.', moduleId: 'pulse' },
  { id: 'secret-battery', timestamp: '00:50:00', seconds: 3000, title: 'Second battery and taps', frame: 'asymmetric golf-cart battery stack', lesson: 'The talk treats the battery as essential, not a simple A/B swap.', moduleId: 'circuit' },
  { id: 'secret-iron', timestamp: '00:59:00', seconds: 3540, title: 'Iron wire claim', frame: 'copper-looking windings, iron-wire hypothesis', lesson: 'Material claim is historical; the RLC model still uses a lumped R.', moduleId: 'energy' },
  { id: 'qa-rpm', timestamp: '01:10:00', seconds: 4200, title: 'Reported 500 rpm reference', frame: 'end-bell degree marks every 3 degrees', lesson: 'The presenter reports this condition for one setup; it is not universal.', moduleId: 'pulse' },
])

export const GRAY_RELATED_LINKS = Object.freeze([
  { to: '/tour/electrical-standards', label: 'Electrical standards', note: 'Exact SI electrical identities, not a motor' },
  { to: '/labs/quantum-wave', label: 'Quantum wave lab', note: 'The other video-derived teaching lab' },
  { to: '/evidence', label: 'Evidence guide', note: 'Claim classes and validatesTheory: false' },
  { to: '/labs', label: 'All laboratories', note: 'Back to the workbench index' },
])
