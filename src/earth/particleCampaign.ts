export type EarthCampaignRunState = 'runnable' | 'blocked'

export interface EarthModelCardRecord {
  slug: string
  programId: string
  title: string
  whatItIs: string
  whatItIsNot: string
  status: EarthCampaignRunState
  statusNote: string
}

export const EARTH_PARTICLE_CAMPAIGN_CARDS: readonly EarthModelCardRecord[] = [
  {
    slug:       'SIM-NUC-PROTON',
    programId:  'EARTH-NUC-004',
    title:      'Proton radius',
    whatItIs:   'Proton radius is four competing numbers, not one: SM 0.84075 fm | Nassim 0.84124 fm | Thad 0.84343 fm | EARTH ξ₀ routes fail.',
    whatItIsNot: 'A single agreed radius. Thad is a constants constructor, not a field theory. Nassim’s only clean particle prediction is r_p=4λ_p.',
    status:     'runnable',
    statusNote: 'EARTH ξ₀ routes fail. A finished run is a comparison, not confirmation.',
  },
  {
    slug:       'SIM-COUPLING',
    programId:  'EARTH-NUC-004',
    title:      'Force law Γ(r)',
    whatItIs:   'Three printed EARTH Γ(r) forms placed next to SM couplings and Nassim’s force number.',
    whatItIsNot: 'A running-coupling theory. Thad is a constants constructor, not a field theory.',
    status:     'runnable',
    statusNote: 'Printed EARTH forms conflict. None recover 1/137.',
  },
  {
    slug:       'SIM-NUC-TABLE',
    programId:  'EARTH-NUC-001',
    title:      'Nuclear (p,q) table',
    whatItIs:   'Printed torus-pair labels and E(p,q) numbers from the source table.',
    whatItIsNot: 'A nuclide mass table. Thad and Nassim have no (p,q) map.',
    status:     'runnable',
    statusNote: 'T(3,1) is an unknot. Z = p−3 fails ¹H.',
  },
  {
    slug:       'SIM-PRT-ELECTRON',
    programId:  'EARTH-PRT-001',
    title:      'Electron / Bohr / Rydberg',
    whatItIs:   'Printed α, Bohr radius, electron mass, and Rydberg from CHEM-2.',
    whatItIsNot: 'QED. EARTH printed α/Bohr/ħ/φ⁶ fail literal arithmetic.',
    status:     'runnable',
    statusNote: 'Those printed constants fail as written. Nassim’s electron mass is the Bohr identity.',
  },
  {
    slug:       'SIM-CHEM-SPECTRA',
    programId:  'EARTH-PRT-001',
    title:      'CHEM-6 line examples',
    whatItIs:   'Printed IR / UV / X-ray examples from the chiral-spiral formula.',
    whatItIsNot: 'A molecular Hamiltonian. Thad and Nassim columns show none.',
    status:     'runnable',
    statusNote: 'Source examples fail by large factors. Thad and Nassim have no spectra.',
  },
  {
    slug:       'SIM-PLANCK-TWIST',
    programId:  'EARTH-PRT-005',
    title:      'Planck ħ from twist counting',
    whatItIs:   'Printed ħ from golden-ratio twist counting.',
    whatItIsNot: 'A derivation of ħ. Thad is a constants constructor (l_P m_P = ħ/c), not a field theory.',
    status:     'runnable',
    statusNote: 'EARTH printed ħ fails literal arithmetic (~0.0135 × CODATA).',
  },
  {
    slug:       'SIM-BOSON-LOOP',
    programId:  'EARTH-PRT-005',
    title:      'Closed dislocation loop',
    whatItIs:   'Source labels that a vanishing loop is γ/g and a finite loop is W/Z.',
    whatItIsNot: 'Electroweak poles from ξ₀. Thad is a constants constructor, not a field theory.',
    status:     'runnable',
    statusNote: 'No GeV poles come from ξ₀ = 0.15 fm.',
  },
  {
    slug:       'SIM-FERMION-KINK',
    programId:  'EARTH-FLD-008',
    title:      'Fermion wall kink',
    whatItIs:   'A sine-Gordon kink on the published tube wall, plus the printed φ⁶ mass cascade.',
    whatItIsNot: 'Fractional quark charge. EARTH printed α/Bohr/ħ/φ⁶ fail literal arithmetic.',
    status:     'runnable',
    statusNote: 'φ⁶ is 17.9, not μ/e. Integer winding is not ±1/3.',
  },
  {
    slug:       'SIM-FLD',
    programId:  'EARTH-FLD-001',
    title:      'Published scalar field',
    whatItIs:   'A Derrick check of the printed scalar. This field cannot carry Hopfions.',
    whatItIsNot: 'A Hopfion solver. Thad and Nassim columns show none.',
    status:     'runnable',
    statusNote: 'π₃(S¹) = 0. Collapse is the result, not a stable particle.',
  },
  {
    slug:       'SIM-QM-DECOHERENCE',
    programId:  'EARTH-FLD-005',
    title:      'Grain-boundary decoherence',
    whatItIs:   'Printed Langevin / collapse-time / Floquet toys for measurement language.',
    whatItIsNot: 'Born-rule derivation or Hopfion surgery. Thad and Nassim columns show none.',
    status:     'runnable',
    statusNote: 'The printed explicit step is unstable. Software comparators stay unlabeled as physics.',
  },
]

export const EARTH_BLOCKED_SOURCE_MODELS: readonly EarthModelCardRecord[] = [
  {
    slug:       'PRT-002',
    programId:  'EARTH-PRT-002',
    title:      'Electron-loop radial',
    whatItIs:   'A proposed axisymmetric electron loop.',
    whatItIsNot: 'A runnable kernel. k, r₀, and the coupling are undefined.',
    status:     'blocked',
    statusNote: 'Blocked until those inputs exist. Do not invent them.',
  },
  {
    slug:       'PRT-003',
    programId:  'EARTH-PRT-003',
    title:      'Fractional-winding fermion',
    whatItIs:   'A proposed kink spectrum with fractional winding.',
    whatItIsNot: 'A charge of ±1/3 from the published U(1) map.',
    status:     'blocked',
    statusNote: 'Blocked. Integer winding is not fractional charge.',
  },
  {
    slug:       'PRT-004',
    programId:  'EARTH-PRT-004',
    title:      'Boson-loop dispersion',
    whatItIs:   'A proposed 3D loop fluctuation spectrum.',
    whatItIsNot: 'W/Z masses from ξ₀.',
    status:     'blocked',
    statusNote: 'Blocked. No solved background or gauge-fixed operator.',
  },
  {
    slug:       'NUC-002',
    programId:  'EARTH-NUC-002',
    title:      'Nuclide masses',
    whatItIs:   'A proposed (Z,N) → (p,q) mass table.',
    whatItIsNot: 'AME masses. The pairing function is missing.',
    status:     'blocked',
    statusNote: 'Blocked. No (Z,N) map and no frozen AME bytes.',
  },
  {
    slug:       'NUC-003',
    programId:  'EARTH-NUC-003',
    title:      'Decay / half-life',
    whatItIs:   'A proposed barrier and weak rate.',
    whatItIsNot: 'A half-life operator.',
    status:     'blocked',
    statusNote: 'Blocked. No barrier or weak operator.',
  },
  {
    slug:       'NUC-005',
    programId:  'EARTH-NUC-005',
    title:      'Proton / hadron field',
    whatItIs:   'A proposed Hopfion field for the proton.',
    whatItIsNot: 'The published S¹ scalar.',
    status:     'blocked',
    statusNote: 'Blocked. The published action has no Hopf sector.',
  },
  {
    slug:       'FLD-HOPFION',
    programId:  'EARTH-FLD-002',
    title:      'Hopfion PDE',
    whatItIs:   'A proposed 3D Hopfion relaxation.',
    whatItIsNot: 'A stable Q=1 soliton of the printed Lagrangian.',
    status:     'blocked',
    statusNote: 'Blocked. π₃(S¹) = 0. Do not fake Hopf charge from the S¹ scalar.',
  },
]

const CARDS_BY_PROGRAM: ReadonlyMap<string, EarthModelCardRecord[]> = new Map(
  [...EARTH_PARTICLE_CAMPAIGN_CARDS, ...EARTH_BLOCKED_SOURCE_MODELS].reduce((groups, card) => {
    const list = groups.get(card.programId) ?? []
    list.push(card)
    groups.set(card.programId, list)
    return groups
  }, new Map<string, EarthModelCardRecord[]>()),
)

CARDS_BY_PROGRAM.set('EARTH-FLD-006', [...EARTH_PARTICLE_CAMPAIGN_CARDS.filter(({ slug }) => slug === 'SIM-QM-DECOHERENCE')])
CARDS_BY_PROGRAM.set('EARTH-FLD-007', [...EARTH_PARTICLE_CAMPAIGN_CARDS.filter(({ slug }) => slug === 'SIM-QM-DECOHERENCE')])
CARDS_BY_PROGRAM.set('EARTH-FLD-010', [...EARTH_PARTICLE_CAMPAIGN_CARDS.filter(({ slug }) => slug === 'SIM-FERMION-KINK')])

export const EARTH_PARTICLE_CAMPAIGN_PROGRAM_IDS = new Set([
  'EARTH-NUC-004',
  'EARTH-NUC-001',
  'EARTH-PRT-001',
  'EARTH-PRT-005',
  'EARTH-FLD-001',
  'EARTH-FLD-005',
  'EARTH-FLD-006',
  'EARTH-FLD-007',
  'EARTH-FLD-008',
  'EARTH-FLD-010',
])

export function cardsForProgram(programId: string): EarthModelCardRecord[] {
  return CARDS_BY_PROGRAM.get(programId) ?? []
}

export function isParticleCampaignProgram(programId: string): boolean {
  return EARTH_PARTICLE_CAMPAIGN_PROGRAM_IDS.has(programId)
}
