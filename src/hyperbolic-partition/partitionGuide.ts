export interface PartitionGuideSection {
  id: string
  number: string
  title: string
  question: string
  answer: string
  teacherNote: string
  equation: string
}

export interface PartitionTerm {
  term: string
  plain: string
  technical: string
}

export const PARTITION_LEARNING_PROMISE = 'The shortest version is: T_a(x)=x^4+2πx²−2π a x+2π is a 4-sheeted cover of the a-sphere. The four roots are vertices of an ideal tetrahedron after a Möbius move that sends three of them to ∞, 0, 1. Apparent COP-like ratios from one root or one chart are readouts; Vieta’s identities are the closed ledger.'

export const PARTITION_SOURCE = Object.freeze({
  note: 'Reconstructed from the Physics Monastery hyperbolic partition equation page and its Quartic → Ideal Tetrahedron explorer (roots, Möbius, cross-ratio, monodromy, Riemann surface).',
  validatesTheory: false,
  url: 'https://www.physicsmonastery.earth/hyperbolic-partition-eq',
})

export const PARTITION_GUIDE_SECTIONS: readonly PartitionGuideSection[] = Object.freeze([
  Object.freeze({
    id: 'quartic',
    number: '01',
    title: 'Four roots of a real quartic, not four free energies',
    question: 'What does T_a(x)=0 actually constrain?',
    answer: 'The polynomial is monic with vanishing x³ coefficient, so the roots sum to 0. Their product is 2π and their sum of squares is −4π. Those Vieta identities hold for every a. A large individual root is an apparent readout of one sheet, not a surplus term.',
    teacherNote: 'Keep whole-system COP language for energy ledgers. Here the analog of whole-system closure is Vieta: e1=0, e2=2π, e4=2π. Do not inject a claim deficit into the worker.',
    equation: 'T_a(x)=x^4+2π x^2−2π a x+2π = ∏(x−zhe_j)',
  }),
  Object.freeze({
    id: 'mobius',
    number: '02',
    title: '24 labeled Möbius charts collapse to 6 cross-ratios',
    question: 'Why does sending three roots to (∞,0,1) produce an ideal tetrahedron?',
    answer: 'PGL(2) acts triply transitively on the Riemann sphere. Each ordered triple determines a unique Möbius map; the fourth root lands at λ, the cross-ratio. There are 4!=24 labeled charts and 6 distinct λ values, the anharmonic orbit.',
    teacherNote: 'The 24-to-6 reduction is bookkeeping, not extra geometry. Apparent chart-counting is not a source of energy or of new roots.',
    equation: 'λ = ((z−z0)/(z−z∞)) / ((z1−z0)/(z1−z∞))',
  }),
  Object.freeze({
    id: 'monodromy',
    number: '03',
    title: 'Simple ramification at ±a₁ and ±b₁',
    question: 'What happens if a walks around a branch value and returns?',
    answer: 'The discriminant vanishes at two real points ±a₁ and two imaginary points ±b₁. A small loop around one of them transposes two sheets and returns the other two to themselves. Infinity has ramification index 3; 0 is unramified as a second point over ∞.',
    teacherNote: 'Numerical continuation tracks nearest roots. The permutation is a change of sheet label, not a change of the polynomial.',
    equation: 'a(x)=(x^4+2π x^2+2π)/(2π x),  a′(x)=0 ⇒ 3x^4+2π x^2−2π=0',
  }),
])

export const PARTITION_TERMS: readonly PartitionTerm[] = Object.freeze([
  Object.freeze({
    term: 'physical a',
    plain: 'The monastery mass-gap value of the parameter a, a little below e^{π²/4}.',
    technical: 'a = exp(π²/4) − m_p/kg with the monastery Planck-mass site. At that a the four roots are the published zhe_j.',
  }),
  Object.freeze({
    term: 'ideal tetrahedron',
    plain: 'Four points on the sphere, three of them parked at ∞, 0, and 1.',
    technical: 'An ideal tetrahedron in H³ with vertices on ∂H³ ≅ ℂP¹. The remaining vertex is the cross-ratio λ.',
  }),
  Object.freeze({
    term: 'apparent vs Vieta ledger',
    plain: 'One large root or one Möbius chart can dominate the display while the four-root identities stay closed.',
    technical: 'Apparent: a single zhe_j or a single λ. Whole-system analog: e1=0, p2=−4π, e4=2π for every a. No extra term is injected.',
  }),
])

export const PARTITION_RELATED_LINKS = Object.freeze([
  Object.freeze({ to: '/labs/core', label: 'Core lab', note: 'The same quartic appears as a transform case with Vieta checks.' }),
  Object.freeze({ to: '/labs', label: 'Labs', note: 'Other instruments. Computation here is a reconstruction, not a validation.' }),
])
