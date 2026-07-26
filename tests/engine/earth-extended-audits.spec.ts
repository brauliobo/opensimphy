import {
  DEFAULT_ELECTROLYTE_SPECIATION_INPUTS,
  DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS,
  DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS,
  DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS,
  DEFAULT_SOLUBILITY_PRODUCT_AUDIT_INPUTS,
  electrolyteSpeciationComparator,
  molecularSpectroscopyAudit,
  particleQuantumNumberAudit,
  photonKinematicsAudit,
  solubilityProductAudit,
} from '../../src/engine/earth/extendedAudits'

describe('EARTH extended literal and standard-comparison audits', () => {
  it('retains explicit particle source claims and the known winding and power failures', () => {
    const result = particleQuantumNumberAudit()
    const down = result.output.quantumClaims.find(({ id }) => id === 'down-quark')
    const electron = result.output.quantumClaims.find(({ id }) => id === 'electron')
    const generationRatio = result.output.literalClaims.find(({ id }) => id === 'generation-ratio-phi6')
    const mixing = result.output.literalClaims.find(({ id }) => id === 'mixing-phi-minus-2')

    expect(result.diagnostics).toMatchObject({
      provenanceKind: 'reproduction',
      standardValuesAreEarthDerived: false,
      hiddenNetworkOrData: false,
    })
    expect(down?.source.document).toBe('Fermion Theorem')
    expect(down).toMatchObject({ sourceWinding: -2 / 3, sourceChargeE: -1 / 3, standardChargeE: -1 / 3, windingChargeConsistent: false })
    expect(electron).toMatchObject({ sourceWinding: -2, sourceChargeE: -1, windingChargeConsistent: false })
    expect(generationRatio?.evaluatedValue).toBeCloseTo(17.94427190999916, 13)
    expect(generationRatio?.claimedValue).toBeCloseTo(206.7682831916941, 12)
    expect(generationRatio?.expressionResidual).toBeGreaterThan(0.9)
    expect(mixing?.evaluatedValue).toBeCloseTo(0.38196601125010515, 14)
    expect(result.output.findings.find(({ id }) => id === 'down-quark-winding-charge')?.status).toBe('failure')
    expect(result.output.findings.find(({ id }) => id === 'photon-representation')?.status).toBe('pass')
  })

  it('evaluates supplied rotor, rovibrational, and hyperfine constants and enforces selection rules', () => {
    const result = molecularSpectroscopyAudit({
      rotationalTransitions: [
        { id: 'J0-to-J1', lowerJ: 0, upperJ: 1, claimedAllowed: true },
        { id: 'J1-to-J3', lowerJ: 1, upperJ: 3, claimedAllowed: true },
      ],
      rovibrationalTransitions: [
        { id: 'R0', lowerJ: 0, upperJ: 1, claimedAllowed: true },
        { id: 'Q1', lowerJ: 1, upperJ: 1, claimedAllowed: true },
        { id: 'P1', lowerJ: 1, upperJ: 0, claimedAllowed: true },
      ],
      hyperfineTransitions: [
        { id: 'F0-to-F1', lowerF: 0, upperF: 1, claimedAllowed: true },
        { id: 'F0-to-F0', lowerF: 0, upperF: 0, claimedAllowed: true },
        { id: 'F1-to-F1', lowerF: 1, upperF: 1, claimedAllowed: true },
      ],
    })
    const rotationalAllowed = result.output.rotational.find(({ id }) => id === 'J0-to-J1')
    const rotationalForbidden = result.output.rotational.find(({ id }) => id === 'J1-to-J3')
    const rBranch = result.output.rovibrational.find(({ id }) => id === 'R0')
    const qBranch = result.output.rovibrational.find(({ id }) => id === 'Q1')
    const hyperfineAllowed = result.output.hyperfine.find(({ id }) => id === 'F0-to-F1')
    const hyperfineForbidden = result.output.hyperfine.find(({ id }) => id === 'F0-to-F0')

    expect(result.diagnostics).toMatchObject({ benchmarkLabel: 'standard-comparison-not-EARTH-derived', earthSelectionRulesAvailable: false, earthTransitionOperatorAvailable: false })
    expect(rotationalAllowed).toMatchObject({ transitionCmInverse: expect.closeTo(3.845, 12), standardAllowed: true, sourceClaimMatches: true })
    expect(rotationalForbidden).toMatchObject({ standardAllowed: false, sourceClaimMatches: false })
    expect(rBranch).toMatchObject({ transitionCmInverse: expect.closeTo(2147.06, 10), branch: 'R', standardAllowed: true })
    expect(qBranch).toMatchObject({ branch: 'Q', standardAllowed: false, sourceClaimMatches: false })
    expect(hyperfineAllowed).toMatchObject({ transitionHz: expect.closeTo(1_420_405_751.768, 4), levelsValid: true, standardAllowed: true })
    expect(hyperfineForbidden).toMatchObject({ levelsValid: true, standardAllowed: false, sourceClaimMatches: false })
    expect(result.output.findings.filter(({ status }) => status === 'failure').map(({ id }) => id)).toEqual(expect.arrayContaining([
      'J1-to-J3-selection-rule',
      'Q1-selection-rule',
      'F0-to-F0-selection-rule',
    ]))
  })

  it('runs standard photon comparators with energy-momentum conservation and no EARTH attribution', () => {
    const result = photonKinematicsAudit()
    const { compton, doppler, photoelectric, larmor } = result.output

    expect(result.diagnostics).toMatchObject({
      benchmarkLabel: 'standard-comparison-not-EARTH-derived',
      standardPhysicsOnly: true,
      earthEmissionFunctionalAvailable: false,
      earthScatteringFunctionalAvailable: false,
    })
    expect(compton.electronComptonWavelengthM).toBeCloseTo(2.42631023538e-12, 22)
    expect(compton.wavelengthShiftM).toBeCloseTo(2 * compton.electronComptonWavelengthM, 22)
    expect(compton.energyMomentumResidual).toBeLessThan(1e-12)
    expect(doppler.observedFrequencyHz).toBeGreaterThan(doppler.restFrequencyHz)
    expect(photoelectric.photonEnergyEv).toBeCloseTo(4.135667696, 8)
    expect(photoelectric.maximumKineticEnergyEv).toBeCloseTo(photoelectric.photonEnergyEv - photoelectric.workFunctionEv, 14)
    expect(photoelectric.energyBalanceResidualEv).toBe(0)
    expect(larmor.powerW).toBeGreaterThan(0)
    expect(result.output.findings.every(({ status }) => status === 'pass')).toBe(true)
    expect(result.output.series).toHaveLength(33)
  })

  it('reproduces the printed Ksp failure and keeps activity assumptions explicit', () => {
    const result = solubilityProductAudit()

    expect(result.output.printedExpression).toContain('exp(-DeltaE0/(R*T))')
    expect(result.output.literal.value).toBeCloseTo(0.13, 2)
    expect(result.output.literal.claimedValue).toBe(36)
    expect(result.output.literal.claimedRelativeResidual).toBeGreaterThan(0.99)
    expect(result.output.standardActivityComparator).toMatchObject({
      label: 'standard-comparison-not-EARTH-derived',
      cationActivity: 6,
      anionActivity: 6,
      activityProduct: 36,
    })
    expect(result.output.caveats.join(' ')).toContain('dimensionless')
    expect(result.output.caveats.join(' ')).toContain('non-ideal')
    expect(result.output.findings.every(({ status }) => status === 'failure')).toBe(true)
  })

  it('closes ideal monoprotic and salt mass and charge balances', () => {
    const acid = electrolyteSpeciationComparator({
      system: 'monoprotic-acid',
      analyticalConcentrationMolPerL: 0.1,
      acidDissociationConstant: 1.8e-5,
      waterIonProduct: 1e-14,
    })
    const hydrogen = acid.output.species.find(({ name }) => name === 'H+')!
    const conjugateBase = acid.output.species.find(({ name }) => name === 'A-')!
    const salt = electrolyteSpeciationComparator({
      system: 'fully-dissociated-salt',
      analyticalConcentrationMolPerL: 0.2,
      cationStoichiometry: 1,
      anionStoichiometry: 2,
      cationCharge: 2,
      anionCharge: -1,
    })

    expect(acid.output.model).toBe('ideal-standard-comparison-not-EARTH-derived')
    expect(hydrogen.concentrationMolPerL).toBeCloseTo(0.001332, 5)
    expect(conjugateBase.concentrationMolPerL).toBeCloseTo(hydrogen.concentrationMolPerL, 6)
    expect(Math.abs(acid.output.balances.massBalanceResidualMolPerL)).toBeLessThan(1e-15)
    expect(Math.abs(acid.output.balances.chargeBalanceResidualMolPerL)).toBeLessThan(1e-15)
    expect(acid.output.balances.equilibriumRelativeResidual).toBeLessThan(1e-14)
    expect(salt.output.species).toEqual([
      { name: 'cation', charge: 2, concentrationMolPerL: 0.2, activityCoefficient: 1, activity: 0.2 },
      { name: 'anion', charge: -1, concentrationMolPerL: 0.4, activityCoefficient: 1, activity: 0.4 },
    ])
    expect(salt.output.balances.chargeBalanceResidualMolPerL).toBe(0)
  })
})

describe('EARTH extended audit defaults, determinism, and bounds', () => {
  it('exports complete defaults and returns deterministic results', () => {
    expect(DEFAULT_PARTICLE_QUANTUM_NUMBER_AUDIT_INPUTS.quantumClaims).toHaveLength(5)
    expect(DEFAULT_MOLECULAR_SPECTROSCOPY_AUDIT_INPUTS.rovibrationalTransitions).toHaveLength(3)
    expect(DEFAULT_PHOTON_KINEMATICS_AUDIT_INPUTS.comptonScatteringAngleRad).toBe(Math.PI)
    expect(DEFAULT_SOLUBILITY_PRODUCT_AUDIT_INPUTS.sourceClaimedKsp).toBe(36)
    expect(DEFAULT_ELECTROLYTE_SPECIATION_INPUTS.system).toBe('monoprotic-acid')
    expect(particleQuantumNumberAudit()).toEqual(particleQuantumNumberAudit())
    expect(molecularSpectroscopyAudit()).toEqual(molecularSpectroscopyAudit())
    expect(photonKinematicsAudit()).toEqual(photonKinematicsAudit())
    expect(solubilityProductAudit()).toEqual(solubilityProductAudit())
    expect(electrolyteSpeciationComparator()).toEqual(electrolyteSpeciationComparator())
  })

  it('rejects non-finite, oversized, non-quantized, and non-conserving inputs', () => {
    expect(() => particleQuantumNumberAudit({
      quantumClaims: Array.from({ length: 129 }, (_, index) => ({
        id: String(index),
        particle: 'x',
        source: { document: 'd', location: 'l', text: 't' },
        sourceStatistics: 'boson' as const,
        sourceSpin: 1,
        sourceChargeE: 0,
        sourceMonodromyTurns: 1,
        standardStatistics: 'boson' as const,
        standardSpin: 1,
        standardChargeE: 0,
      })),
    })).toThrow('quantumClaims must contain 1 to 128 entries')
    expect(() => molecularSpectroscopyAudit({ nuclearSpin: 0.3 })).toThrow('nuclearSpin must be an integer or half-integer')
    expect(() => molecularSpectroscopyAudit({ rotationalTransitions: Array.from({ length: 513 }, (_, index) => ({ id: String(index), lowerJ: 0, upperJ: 1 })) })).toThrow('rotationalTransitions must contain 1 to 512 entries')
    expect(() => photonKinematicsAudit({ comptonScatteringAngleRad: Math.PI + 0.01 })).toThrow('comptonScatteringAngleRad must be from 0')
    expect(() => photonKinematicsAudit({ incidentWavelengthM: Number.NaN })).toThrow('incidentWavelengthM must be finite')
    expect(() => solubilityProductAudit({ coherenceExponent: 65 })).toThrow('coherenceExponent must be an integer from 1 to 64')
    expect(() => electrolyteSpeciationComparator({
      system: 'fully-dissociated-salt',
      cationStoichiometry: 1,
      anionStoichiometry: 1,
      cationCharge: 2,
      anionCharge: -1,
    })).toThrow('salt stoichiometry and charges must describe an electrically neutral formula unit')
  })
})
