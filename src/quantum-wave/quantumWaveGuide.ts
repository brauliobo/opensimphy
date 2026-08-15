export interface QuantumTimelineEntry {
  id: string
  timestamp: string
  seconds: number
  title: string
  frame: string
  lesson: string
  moduleId: string
}

export interface QuantumGuideSection {
  id: string
  number: string
  title: string
  question: string
  answer: string
  teacherNote: string
  equation: string
  moduleId?: string
}

export interface QuantumTerm {
  term: string
  plain: string
  technical: string
}

export const QUANTUM_VIDEO = Object.freeze({
  id: '3QU-_PSbKlo',
  url: 'https://www.youtube.com/watch?v=3QU-_PSbKlo',
  title: 'I finally understood why the universe needs imaginary numbers (My mind is blown!)',
  channel: 'FloatHeadPhysics',
  duration: '44:36',
  downloadedSource: 'research/opensimphy-video/source/3QU-_PSbKlo.mp4',
  transcript: 'research/opensimphy-video/transcript/3QU-_PSbKlo.txt',
  frameReport: 'research/opensimphy-video/analysis/curated-frame-times.tsv',
  analysisReport: 'research/opensimphy-video/analysis/report.md',
})

export const QUANTUM_LEARNING_PROMISE = 'The shortest version is: waves can carry phase, curvature extracts energy, and i makes phase rotate instead of grow or decay.'

export const QUANTUM_GUIDE_SECTIONS: readonly QuantumGuideSection[] = Object.freeze([
  Object.freeze({
    id: 'spectra',
    number: '01',
    title: 'A spectrum is a fingerprint, not a photograph of an orbit',
    question: 'Why do atoms make separated color lines instead of every color?',
    answer: 'A level difference has a definite energy. If a photon carries that difference, its frequency and wavelength are fixed.',
    teacherNote: 'Start with the observable: a spectrometer records lines. The level diagram is a model that explains how those lines can be organized; it is not a camera image of an electron path.',
    equation: 'Delta E = h f = h c / lambda',
    moduleId: 'spectral-lines',
  }),
  Object.freeze({
    id: 'standing-waves',
    number: '02',
    title: 'Allowed shapes are standing-wave shapes',
    question: 'What does it mean for a matter wave to fit?',
    answer: 'A standing wave repeats a spatial pattern. Nodes stay still while antinodes reach the largest excursion.',
    teacherNote: 'The guitar-string analogy is useful for counting allowed shapes. It does not mean an electron is a bead traveling around a classical track.',
    equation: 'psi(x,t) = A sin(k x) cos(omega t)',
    moduleId: 'standing-wave',
  }),
  Object.freeze({
    id: 'operators',
    number: '03',
    title: 'Curvature lets an operator read a wave',
    question: 'How can a differential operation find momentum or kinetic energy?',
    answer: 'For a pure sine component, the second derivative returns the same shape with a predictable factor. That factor is proportional to p squared.',
    teacherNote: 'A pure sine wave is the easy calibration case. A localized packet is a mixture of wavelengths, so its local curvature and kinetic-energy readout vary across x.',
    equation: 'K psi = -(hbar^2 / 2m) d^2 psi / dx^2',
    moduleId: 'operator-lab',
  }),
  Object.freeze({
    id: 'fourier',
    number: '04',
    title: 'A complicated wave can be assembled from simple waves',
    question: 'Why does the sine-wave operator generalize to other shapes?',
    answer: 'Fourier analysis writes a broad family of shapes as weighted sums of sine and cosine components. A linear derivative acts on each component and the results add.',
    teacherNote: 'The square-wave edges are deliberately imperfect in a finite sum. More components sharpen the approximation but do not turn a finite display into an exact discontinuity.',
    equation: 'd(A + B)/dx = dA/dx + dB/dx',
    moduleId: 'fourier-composer',
  }),
  Object.freeze({
    id: 'complex-plane',
    number: '05',
    title: 'i turns a derivative into a quarter-turn',
    question: 'Why is the imaginary unit useful instead of decorative?',
    answer: 'On the real line, a self-reproducing exponential grows or decays. In the complex plane, the same exponential can rotate at fixed radius.',
    teacherNote: 'The vector picture is the key: multiplying by i means a 90-degree turn. A velocity perpendicular to a position changes its direction without changing its magnitude.',
    equation: 'e^(i theta) = cos(theta) + i sin(theta)',
    moduleId: 'complex-plane',
  }),
  Object.freeze({
    id: 'schrodinger',
    number: '06',
    title: 'The Schrodinger equation is an energy bookkeeping rule',
    question: 'How do the pieces assemble into the familiar equation?',
    answer: 'The time derivative supplies total energy, while spatial curvature supplies kinetic energy. Potential energy is added as a local multiplication term.',
    teacherNote: 'The equation is a model with a declared domain and assumptions. Matching its algebra in this page is a computation, not an empirical validation of every interpretation attached to it.',
    equation: 'i hbar d psi/dt = -(hbar^2/2m) d^2 psi/dx^2 + V psi',
    moduleId: 'schrodinger-equation',
  }),
  Object.freeze({
    id: 'probability',
    number: '07',
    title: 'The Born rule turns amplitude into probability',
    question: 'How can a wave predict where individual particles arrive?',
    answer: 'Amplitudes add first. Their squared magnitude gives a nonnegative probability density, so interference can change local counts while the normalized total stays fixed.',
    teacherNote: 'Think of a single-particle experiment repeated many times. One landing is not a full fringe; the distribution emerges from accumulated events.',
    equation: 'P(x) proportional to |psi(x)|^2',
    moduleId: 'probability-wave',
  }),
  Object.freeze({
    id: 'applications',
    number: '08',
    title: 'Solutions become useful when a model connects them to devices',
    question: 'Where do these wave ideas leave the chalkboard?',
    answer: 'Hydrogen-like probability densities, energy bands, electron optics, clocks, and transistors are different applications of carefully scoped models.',
    teacherNote: 'The orbital map is a probability-density slice, not a planetary orbit. The band diagram is schematic: a real material requires a Hamiltonian, lattice, interactions, and measured parameters.',
    equation: 'V(r) = - e^2 / (4 pi epsilon_0 r)',
    moduleId: 'hydrogen-materials',
  }),
])

export const QUANTUM_VIDEO_TIMELINE: readonly QuantumTimelineEntry[] = Object.freeze([
  Object.freeze({ id: 'frame-005', timestamp: '01:30', seconds: 90, title: 'Discrete hydrogen lines', frame: '005 / angstrom-balmer-spectrum', lesson: 'Observation comes before the model.', moduleId: 'spectral-lines' }),
  Object.freeze({ id: 'frame-015', timestamp: '05:12', seconds: 312, title: 'Quantized energy levels', frame: '015 / bohr-energy-levels', lesson: 'An energy difference can match a photon.', moduleId: 'spectral-lines' }),
  Object.freeze({ id: 'frame-035', timestamp: '12:50', seconds: 770, title: 'psi = sin(x)', frame: '035 / psi-sine-x', lesson: 'Build the simplest spatial wave first.', moduleId: 'standing-wave' }),
  Object.freeze({ id: 'frame-050', timestamp: '18:45', seconds: 1125, title: 'Kinetic-energy operator', frame: '050 / kinetic-energy-operator', lesson: 'Curvature carries the p-squared factor.', moduleId: 'operator-lab' }),
  Object.freeze({ id: 'frame-058', timestamp: '22:18', seconds: 1338, title: 'Fourier convergence', frame: '058 / fourier-convergence', lesson: 'Sums of simple waves approximate broad shapes.', moduleId: 'fourier-composer' }),
  Object.freeze({ id: 'frame-086', timestamp: '32:27', seconds: 1947, title: 'Square root of -1', frame: '086 / square-root-negative-one', lesson: 'A new direction solves the rotation problem.', moduleId: 'complex-plane' }),
  Object.freeze({ id: 'frame-096', timestamp: '36:08', seconds: 2168, title: 'Full Schrodinger equation', frame: '096 / schrodinger-equation-full', lesson: 'Energy, curvature, and potential meet.', moduleId: 'schrodinger-equation' }),
  Object.freeze({ id: 'frame-106', timestamp: '39:52', seconds: 2392, title: 'Probability amplitude squared', frame: '106 / probability-amplitude-squared', lesson: 'Amplitude becomes a measurable distribution.', moduleId: 'probability-wave' }),
  Object.freeze({ id: 'frame-116', timestamp: '43:31', seconds: 2611, title: 'Hydrogen orbitals', frame: '116 / hydrogen-orbitals', lesson: 'The model reaches atomic and material applications.', moduleId: 'hydrogen-materials' }),
])

export const QUANTUM_TERMS: readonly QuantumTerm[] = Object.freeze([
  Object.freeze({ term: 'phase', plain: 'Where a repeating wave is in its cycle.', technical: 'The argument of an oscillatory function; relative phase controls interference.' }),
  Object.freeze({ term: 'operator', plain: 'A rule that transforms a wave so we can read a property from it.', technical: 'A linear map on a declared function space; this lab uses bounded differential examples.' }),
  Object.freeze({ term: 'curvature', plain: 'How sharply a graph bends at a point.', technical: 'The second spatial derivative, which appears in the nonrelativistic kinetic-energy operator.' }),
  Object.freeze({ term: 'amplitude', plain: 'The wave value before we convert it into a probability.', technical: 'A generally complex coefficient or field whose squared magnitude can form a density.' }),
  Object.freeze({ term: 'normalization', plain: 'Scaling probabilities so all possible outcomes add to one.', technical: 'A unit-integral condition on the probability density over the declared domain.' }),
  Object.freeze({ term: 'energy level', plain: 'One allowed model energy for a bound system.', technical: 'An eigenvalue or level in a specified Hamiltonian model, not a classical orbit radius.' }),
])

export const QUANTUM_RELATED_LINKS = Object.freeze([
  Object.freeze({ to: '/tour/atomic-structure/hydrogen-spectra', label: 'Tour: hydrogen spectra', note: 'A provenance-rich established-physics spectrum instrument.' }),
  Object.freeze({ to: '/tour/particle-scales/particle-mass-scales', label: 'Tour: particle scales', note: 'Keep rest energy, Compton scale, and de Broglie wavelength distinct.' }),
  Object.freeze({ to: '/tour/units/physical-quantities', label: 'Tour: quantities and dimensions', note: 'Check what an equation means before trusting its number.' }),
  Object.freeze({ to: '/labs/core', label: 'Core lab', note: 'Explore roots, matrices, and spectra as mathematical objects.' }),
  Object.freeze({ to: '/atlas', label: 'Formula Atlas', note: 'Inspect source-labelled formulas and their dependencies.' }),
  Object.freeze({ to: '/evidence', label: 'Evidence guide', note: 'Separate computation, reproduction, comparison, and validation.' }),
])
