export interface RegisterGuideSection {
  id: string
  number: string
  title: string
  question: string
  answer: string
  teacherNote: string
  equation: string
  moduleId: string
}

export interface RegisterTerm {
  term: string
  plain: string
  technical: string
}

export const REGISTER_LEARNING_PROMISE = 'Each tick is 137 coin flips. Because 137 is odd, majority phase cannot tie, and that vote is the next step. Alignment of two 137-bit phases commits a step when at least 69 bits match. Do not store 2^137 amplitudes, and do not take a successful run as a law of physics.'

export const REGISTER_HYPOTHESIS = Object.freeze({
  talk: 'Physics Monastery conversation, unpublished',
  author: 'Hans Moog',
  publicEssay: 'https://www.reverse-engineering-nature.com/p/self-optimizing-universe',
  publicEssayTitle: 'The Self-Optimizing Universe',
  status: 'hypothesis / unpublished',
  validatesTheory: false,
})

export const REGISTER_GUIDE_SECTIONS: readonly RegisterGuideSection[] = Object.freeze([
  Object.freeze({
    id: 'majority',
    number: '01',
    title: '137 coin flips always have a majority phase',
    question: 'Why flip a coin 137 times instead of storing 2^137 amplitudes?',
    answer: '137 is odd, so heads and tails cannot tie. The majority phase is the next discrete step: +1 if at least 69 bits are 1, −1 if at least 69 bits are 0. Two registers commit a step only when a majority of their 137 phases match.',
    teacherNote: 'This is the unpublished method as described in conversation: coin flips, majority phase alignment, next step. Fair coins give a random walk. Weak per-bit agreement at width 137 concentrates into an almost-sure tick. That is a binomial fact, not a field theory.',
    equation: 'step = sign(2 popcount − 137),   commit if aligned ≥ 69',
    moduleId: 'majority-phase',
  }),
  Object.freeze({
    id: 'registers',
    number: '02',
    title: 'A 137-bit register is a word, not a universe of amplitudes',
    question: 'What can you actually store when someone says the laws appear at 2^137?',
    answer: 'You can store one 137-bit GF(2) word (18 bytes) and count 2^137 configurations of that word. You cannot allocate 2^137 complex amplitudes in this browser, or anywhere nearby.',
    teacherNote: 'The unpublished claim used bit operations on registers. This instrument does those operations. It does not simulate a 137-qubit Hilbert space.',
    equation: 'mask = 2^w − 1,   a ⊕ b ⊕ (a ⊕ b) = 0',
    moduleId: 'bit-register',
  }),
  Object.freeze({
    id: 'hierarchy',
    number: '03',
    title: '137 is also an exact combinatorial count',
    question: 'Why does 137 appear as 3 + 7 + 127?',
    answer: 'From n independent bit-strings you can form 2^n − 1 nonzero XOR combinations. The first three closed counts are 3, 7, and 127. Their sum is 137. The next count is 2^127 − 1 and is refused.',
    teacherNote: 'This counting is the published combinatorial-hierarchy analog (Parker-Rhodes / Noyes), used here as one experimental method. It is not Moog’s paper and it is not a derivation of α.',
    equation: '(2^2 − 1) + (2^3 − 1) + (2^7 − 1) = 137',
    moduleId: 'hierarchy',
  }),
  Object.freeze({
    id: 'handshake',
    number: '04',
    title: 'An interaction is a handshake over competing registers',
    question: 'How can a quantum-like event be a selection among possible register pairs?',
    answer: 'An emitter offers a word. Receivers are compatible under a named rule, including majority phase alignment (≥69 matching bits at width 137). One compatible receiver is selected. Apparent probability is compatible / candidates.',
    teacherNote: 'This is the public Moog essay analog: offer, confirmation, first successful transaction. Closed XOR algebras handshake always. Sparse 137-bit random sets almost never do.',
    equation: 'P_app = N_compatible / N_candidates',
    moduleId: 'handshake',
  }),
  Object.freeze({
    id: 'hilbert-bound',
    number: '05',
    title: 'Hilbert space at 137 qubits is a refused representation',
    question: 'If quantum mechanics needs 2^n amplitudes, why use bit registers at all?',
    answer: 'For n ≤ 8 the lab may show a toy amplitude analog. For n = 137 it reports the byte count and refuses allocation. The method under test is register algebra, not state-vector QM.',
    teacherNote: 'A Bell-like 2-bit support can sit on the XOR-zero subspace. That is a teaching comparison, not an emergence of the Schrödinger equation.',
    equation: 'bytes_H ≈ 16 × 2^n     vs     bytes_reg = ceil(n / 8)',
    moduleId: 'hilbert-bound',
  }),
  Object.freeze({
    id: 'universe',
    number: '06',
    title: 'A bounded universe of strings can tick without creating energy',
    question: 'What happens if you XOR random pairs and grow width only when XOR is zero?',
    answer: 'New strings are adjoined, already-closed XORs are counted, and a null XOR can append one bit (a tick). Hitting width 137 stores more words, not a Standard Model. XOR remains an involution.',
    teacherNote: 'This is a bounded Program-Universe analog. The stop conditions are explicit. Reaching 137 bits is a width checkpoint, not a claim that physics laws appeared.',
    equation: 'if a ⊕ b = 0 then width ← width + 1 else adjoin a ⊕ b',
    moduleId: 'universe-tick',
  }),
])

export const REGISTER_TERMS: readonly RegisterTerm[] = Object.freeze([
  Object.freeze({ term: 'majority phase', plain: 'The winning side of 137 coin flips; that vote is the next step.', technical: 'sign(2 popcount − w) on an odd-width word. For w = 137 the threshold is 69 and ties are impossible.' }),
  Object.freeze({ term: 'phase alignment', plain: 'How many of the 137 bits match between offer and receiver.', technical: 'w − Hamming(a, b). A step commits iff this count is at least ceil(w/2).' }),
  Object.freeze({ term: 'register', plain: 'A fixed-width string of bits you can XOR, AND, and count.', technical: 'An element of GF(2)^w represented as a BigInt masked to w bits, w ≤ 137.' }),
  Object.freeze({ term: 'DCS', plain: 'Every pair of strings XOR to another string already in the set.', technical: 'A discriminately closed subset: the 2^n − 1 nonzero vectors of an n-dimensional GF(2) subspace.' }),
  Object.freeze({ term: 'handshake', plain: 'An offer that succeeds when a second register meets a named rule.', technical: 'A selection over competing receivers; collapse analog, not a measured detector click.' }),
  Object.freeze({ term: 'apparent coupling', plain: 'One over the number of counted channels, here 1/137.', technical: 'A combinatorial probability label. It is compared with CODATA α and does not derive QED.' }),
  Object.freeze({ term: 'whole-system XOR', plain: 'Pairing two registers never creates a leftover bit.', technical: 'a ⊕ b ⊕ (a ⊕ b) = 0 is an identity of GF(2). No extra information is injected.' }),
])

export const REGISTER_RELATED_LINKS = Object.freeze([
  Object.freeze({ to: '/labs/quantum-wave', label: 'Quantum wave lab', note: 'The established teaching path through spectra, i, and probability.' }),
  Object.freeze({ to: '/tour', label: 'Tour map', note: 'Start from conventional physics before a source-specific hypothesis.' }),
  Object.freeze({ to: '/evidence', label: 'Evidence guide', note: 'Computation is not validation.' }),
  Object.freeze({ to: '/atlas', label: 'Formula Atlas', note: 'Inspect source-labelled constants, including α, with provenance.' }),
])
