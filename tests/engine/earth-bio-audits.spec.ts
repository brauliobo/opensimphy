import {
  DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS,
  DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS,
  DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS,
  DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS,
  DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS,
  axonActionPotentialArithmeticAudit,
  geneticCodeKnotTableAudit,
  livingStateArithmeticAudit,
  metabolismFidelityLifespanAudit,
  translationSplicingArithmeticAudit,
} from '../../src/engine/earth/bioAudits'

describe('EARTH biology literal audits', () => {
  it('audits the complete printed codon table without inventing a predictive mapping', () => {
    const result = geneticCodeKnotTableAudit()
    const lysineAaa = result.output.entries.find(({ codon }) => codon === 'AAA')
    const stopUga = result.output.entries.find(({ codon }) => codon === 'UGA')

    expect(result.output.coverage).toEqual({ rows: 64, uniqueCodons: 64, completeStandardCodonSet: true })
    expect(result.output.generativeMapping).toMatchObject({ status: 'blocked', predictiveGenerator: false })
    expect(lysineAaa).toMatchObject({ p: 5, q: 1, metric: 31, printedEnergyKcalPerMol: 15.66, arithmeticMatches: false })
    expect(lysineAaa?.formulaEnergyKcalPerMol).toBeCloseTo(18.6713, 12)
    expect(stopUga).toMatchObject({ p: 3, q: 2, metric: 19, printedEnergyKcalPerMol: 69.47, arithmeticMatches: false })
    expect(stopUga?.formulaEnergyKcalPerMol).toBeCloseTo(14.0537, 12)
    expect(result.output.findings.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'incomplete-codon-to-knot-mapping',
      'same-energy-multiple-amino-acids',
      'synonymous-codons-split-across-energies',
      'source-chemical-unit-scaling',
    ]))
  })

  it('exposes the fidelity, power, and lifespan arithmetic failures', () => {
    const result = metabolismFidelityLifespanAudit()
    const expectedFrequency = 3 * 2.998e8 * 0.15 ** 2 / (2 * Math.PI * 1e-5)
    const expectedEnergyJ = 7.83 * 4_184 / 6.022_140_76e23

    expect(result.output.fidelity.reproducedErrorRate).toBeCloseTo(0.15 ** 18, 25)
    expect(result.output.metabolism.frequencyHzPerCell).toBeCloseTo(expectedFrequency, 2)
    expect(result.output.metabolism.reproducedPowerW).toBeCloseTo(expectedFrequency * 3.7e13 * expectedEnergyJ, 6)
    expect(result.output.lifespan.reproducedYears).toBeCloseTo(1e9 / 20 / (365.25 * 24 * 60 * 60), 12)
    expect(result.output.findings.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'fidelity-error-rate',
      'metabolic-power',
      'lifespan-threshold',
      'lifespan-organism-scale-factor',
    ]))
  })

  it('keeps translation and splicing units explicit while rejecting the printed rate jump', () => {
    const result = translationSplicingArithmeticAudit()
    const expectedBaseRate = 3 * 2.998e8 / (2 * Math.PI * 3.8e-10)

    expect(result.output.peptideBond.reproducedKcalPerMol).toBeCloseTo(-7.8299, 12)
    expect(result.output.translation.baseFrequencyHz).toBeCloseTo(expectedBaseRate, 2)
    expect(result.output.translation.suppressedFrequencyHz).toBeCloseTo(expectedBaseRate * 0.15 ** 2, 2)
    expect(result.output.translation.suppressedFrequencyHz).toBeGreaterThan(1e15)
    expect(result.output.splicing).toMatchObject({ reproducedKcalPerMol: 5.22, atpEquivalent: expect.closeTo(5.22 / 7.3, 12) })
    expect(result.output.unitConversions.map(({ inputUnit, outputUnit }) => [inputUnit, outputUnit])).toEqual([
      ['angstrom', 'm'],
      ['kcal/mol', 'J/bond'],
    ])
    expect(result.output.findings.find(({ id }) => id === 'translation-rate')?.status).toBe('failure')
  })

  it('reproduces the living-state formulas and reports their known numerical conflicts', () => {
    const result = livingStateArithmeticAudit()

    expect(result.output.q.reproduced).toBeCloseTo(70 / 1.673e-27, -14)
    expect(result.output.q.reproduced).toBeLessThan(1e29)
    expect(result.output.q.claimed).toBe(3.7e37)
    expect(result.output.bodyDensity.baryonsPerM3).toBeCloseTo(1_000 / 1.673e-27, -15)
    expect(result.output.bodyDensity.coherenceLengthM).toBeCloseTo(9.86e-12, 13)
    expect(result.output.minimumViableQ).toMatchObject({ printedTrefoils: 4.8e6, derivationSpecified: false })
    expect(result.output.mutation.reproducedErrorRate).toBeCloseTo(0.15 ** 18, 25)
    expect(result.output.findings.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'human-topological-charge',
      'living-state-mutation-rate',
      'living-state-metabolic-power',
      'living-state-lifespan',
      'minimum-viable-q-derivation',
    ]))
  })

  it('audits axon and action-potential diameter, width, node, refractory, voltage, and ATP claims', () => {
    const result = axonActionPotentialArithmeticAudit()

    expect(result.output.coherence.reproducedM).toBeCloseTo(8.45e-12, 13)
    expect(result.output.diameter.reproducedM).toBeLessThan(1e-10)
    expect(result.output.diameter.claimedM).toBeCloseTo(1.139e-6, 18)
    expect(result.output.stiffness.reproduced).toBeLessThan(1e-7)
    expect(result.output.width.fromPrintedStiffnessM).toBeCloseTo(1.618e-8, 10)
    expect(result.output.width.fromPrintedProjectionM).toBeGreaterThan(5e-6)
    expect(result.output.nodes.intervalMinimumM).toBeCloseTo(1.99e-3, 4)
    expect(result.output.nodes.intervalMaximumM).toBeCloseTo(3.99e-3, 4)
    expect(result.output.refractory.formulaSeconds).toBeLessThan(1e-12)
    expect(result.output.voltage).toMatchObject({ voltageConversionSpecified: false })
    expect(result.output.energy.restJAsMeV).toBeCloseTo(0.00103, 5)
    expect(result.output.energy.atpPerSpike).toBeCloseTo(647.0588235294117, 12)
    expect(result.output.findings.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'axon-inner-diameter',
      'kink-width-projection',
      'unloaded-velocity-input',
      'node-interval-range',
      'absolute-refractory-period',
      'peak-voltage-conversion',
      'after-hyperpolarization-units',
      'rest-energy-joule-mev',
      'atp-per-spike',
    ]))
  })
})

describe('EARTH biology audit bounds and determinism', () => {
  it('publishes source-derived defaults and deterministic bounded results', () => {
    expect(DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS.entries).toHaveLength(64)
    expect(DEFAULT_METABOLISM_FIDELITY_LIFESPAN_AUDIT_INPUTS).toMatchObject({ fidelityChecks: 18, claimedBasalPowerW: 100, claimedLifespanYears: 120 })
    expect(DEFAULT_TRANSLATION_SPLICING_ARITHMETIC_AUDIT_INPUTS).toMatchObject({ proteinSpacingAngstrom: 3.8, claimedTranslationRatePerS: 20 })
    expect(DEFAULT_LIVING_STATE_ARITHMETIC_AUDIT_INPUTS).toMatchObject({ bodyMassKg: 70, shellCount: 54, minimumViableQ: 4.8e6 })
    expect(DEFAULT_AXON_ACTION_POTENTIAL_ARITHMETIC_AUDIT_INPUTS).toMatchObject({ claimedInnerDiameterUm: 1.139, claimedAtpPerSpike: 667 })
    expect(geneticCodeKnotTableAudit()).toEqual(geneticCodeKnotTableAudit())
    expect(metabolismFidelityLifespanAudit()).toEqual(metabolismFidelityLifespanAudit())
    expect(translationSplicingArithmeticAudit()).toEqual(translationSplicingArithmeticAudit())
    expect(livingStateArithmeticAudit()).toEqual(livingStateArithmeticAudit())
    expect(axonActionPotentialArithmeticAudit()).toEqual(axonActionPotentialArithmeticAudit())
    expect(axonActionPotentialArithmeticAudit().diagnostics).toMatchObject({ medicalAdvice: false, medicalValidation: false })
  })

  it('rejects non-finite and unbounded work requests', () => {
    const entry = DEFAULT_GENETIC_CODE_KNOT_TABLE_AUDIT_INPUTS.entries![0]!
    expect(() => geneticCodeKnotTableAudit({ entries: Array.from({ length: 65 }, () => entry) })).toThrow('entries must contain 1 to 64 entries')
    expect(() => metabolismFidelityLifespanAudit({ fidelityChecks: 129 })).toThrow('fidelityChecks must be an integer from 1 to 128')
    expect(() => translationSplicingArithmeticAudit({ speedMPerS: Number.NaN })).toThrow('speedMPerS must be finite')
    expect(() => livingStateArithmeticAudit({ shellCount: 257 })).toThrow('shellCount must be an integer from 0 to 256')
    expect(() => axonActionPotentialArithmeticAudit({ nodeMultiplierMaximum: 1_000_001 })).toThrow('nodeMultiplierMaximum must be an integer from 413 to 1000000')
  })
})
