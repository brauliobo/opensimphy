export interface CliffordGuideSection {
  id: string
  number: string
  title: string
  question: string
  answer: string
  teacherNote: string
  equation: string
  moduleId: string
}

export interface CliffordTerm {
  term: string
  plain: string
  technical: string
}

export const CLIFFORD_LEARNING_PROMISE = 'The shortest version is: eight trigonometric blades on R^3 have Euclidean norm 1 at every point, integer cube corners carry the Cl(3) basis, and rhombic dodecahedra built from cubes plus height-1/2 pyramids tile space on the Steinhaus even-sum cubes.'

export const CLIFFORD_SOURCE = Object.freeze({
  note: 'Reconstructed from the interactive Cl(3) × rhombic-dodecahedron honeycomb visualization (trigonometric 8-blade field on R^3; Steinhaus cube-pyramid RD tiling).',
  validatesTheory: false,
})

export const CLIFFORD_GUIDE_SECTIONS: readonly CliffordGuideSection[] = Object.freeze([
  Object.freeze({
    id: 'field',
    number: '01',
    title: 'An 8-blade field on R^3 is a unit multivector at every point',
    question: 'What is being plotted when eight Cl(3) components vary with x, y, z?',
    answer: 'Each coordinate is sampled by a cosine/sine pair at π/2. The eight products are the scalar, three vectors, three bivectors, and the pseudoscalar. Their Euclidean norm is identically 1, so the field is a moving decomposition of a unit element, not a source of extra energy.',
    teacherNote: 'The two-term principal combination is an apparent readout. The whole-system ledger is the eight-component hypot, which stays 1. Do not treat a large k+L display as surplus.',
    equation: 'cx = cos(πx/2),  |ψ|^2 = 1^2 + I^2 + J^2 + K^2 + i^2 + j^2 + k^2 + L^2 ≡ 1',
    moduleId: 'space-view',
  }),
  Object.freeze({
    id: 'cell',
    number: '02',
    title: 'Cube corners carry basis blades; pyramids make a rhombic dodecahedron',
    question: 'Why do the integer corners of the unit cube show 1, I, J, K, i, −j, k, L?',
    answer: 'At integer points the trigonometric products collapse to a single ±basis blade. Attaching a height-1/2 pyramid to each cube face adds six axis vertices. Each cube vertex joins its three nearest axis vertices (distance √3/2), giving the 14-vertex, 24-edge, 12-rhombus cell around that cube.',
    teacherNote: 'The origin-centered rhombic dodecahedron max(|x|+|y|, |y|+|z|, |z|+|x|) ≤ 2 is the integer-label region (33 lattice points). The displayed cell for cube origin (0,0,0) is centered at (0.5,0.5,0.5).',
    equation: 'k = IJ,  i = JK,  j = −IK,  L = IJK',
    moduleId: 'space-view',
  }),
  Object.freeze({
    id: 'tiling',
    number: '03',
    title: 'Even-sum cubes and FCC half-points fill space without overlap',
    question: 'How does one rhombic dodecahedron become a honeycomb?',
    answer: 'Steinhaus black cubes are the integer origins (i,j,k) with i+j+k even. Those cube-plus-pyramid cells tile R^3. Half-points — sites in (1/2)ℤ^3 with an odd number of half-integers — are the FCC-translated lattice. Their 12 neighbors at distance √(1/2) split into six undirected line families.',
    teacherNote: 'Whole-space mode shows the honeycomb and the six families together. One-cube mode isolates a single cell. Tiling mode keeps the honeycomb. None of these pictures validates a physical field theory.',
    equation: 'i+j+k even,  x+y+z ≡ 1/2 (mod 1),  |n − p| = √(1/2)',
    moduleId: 'space-view',
  }),
])

export const CLIFFORD_TERMS: readonly CliffordTerm[] = Object.freeze([
  Object.freeze({
    term: 'rhombic dodecahedron',
    plain: 'A 12-faced cell made by putting a shallow pyramid on each face of a cube.',
    technical: 'Catalan solid with 14 vertices (8 cube + 6 axis), 24 edges of length √3/2, and 12 rhombi. Here: pyramids of height 1/2 on the cube [ox,ox+1]^3.',
  }),
  Object.freeze({
    term: 'half-points',
    plain: 'Lattice points that sit on half-integers in an odd number of coordinates.',
    technical: 'The FCC-translated set {p ∈ (1/2)ℤ^3 : x+y+z ≡ 1/2 (mod 1)}. Nearest neighbors differ by a permutation of (±1/2, ±1/2, 0).',
  }),
  Object.freeze({
    term: 'Cl(3) basis',
    plain: 'The eight labels 1, I, J, K, i, j, k, L that a point in space can carry.',
    technical: 'Grades 0..3 of Cl(3): scalar, vectors I,J,K, bivectors i=JK, j=−IK, k=IJ, pseudoscalar L=IJK. Cube corners isolate one signed blade.',
  }),
  Object.freeze({
    term: 'apparent vs whole-system',
    plain: 'Two large blades can dominate the display while all eight still square-sum to 1.',
    technical: 'Apparent combination: the two largest |components|. Whole-system COP analog: hypot of the eight values, identically 1. No extra term is injected.',
  }),
])

export const CLIFFORD_RELATED_LINKS = Object.freeze([
  Object.freeze({ to: '/labs/quantum-wave', label: 'Quantum wave lab', note: 'Waves, i, and probability on a declared domain, without a space-tiling claim.' }),
  Object.freeze({ to: '/labs', label: 'Labs', note: 'Other instruments. Computation here is a reconstruction, not a validation.' }),
])
