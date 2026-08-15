import {
  evaluateGrayCopClaim,
  evaluateGrayMotor,
  GRAY_COP_CLAIM_SCENARIOS,
  GRAY_PRESETS,
  type GrayCopClaimScenario,
} from '../../src/edwin-gray/edwinGrayEngine'

describe('Edwin Gray COP claim reproduction', () => {
  it('reproduces the diagram arithmetic without endorsing the attributed claim', () => {
    const result = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282)

    expect(result.claim).toMatchObject({
      classification: 'attributed-boundary-claim',
      attributedInputPowerW: 26.8,
      attributedOutputPowerW: 7_460,
      displayedCop: 282,
      outputPowerNeededForDisplayedCopW: 7_557.6,
    })
    expect(result.claim.arithmeticCop).toBeCloseTo(278.35820895522386, 12)
    expect(result.claim.displayedCopMismatch).toBeCloseTo(3.64179104477614, 12)
    expect(result.status).toBe('arithmetic-mismatch-boundary-open')
    expect(result.validatesTheory).toBe(false)
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'arithmetic-cop',
      'displayed-cop-mismatch',
      'observed-output-deficit',
      'target-cop-deficit',
    ]))
    expect(JSON.stringify(result.claim)).not.toMatch(/computed|validated/i)
  })

  it('reports the observed and COP-282 target deficits independently', () => {
    const closure = evaluateGrayCopClaim(
      GRAY_COP_CLAIM_SCENARIOS.diagramCop282,
    ).conservationClosure

    expect(closure.observedOutput?.requiredUnaccountedPowerW).toBeCloseTo(7_433.2, 12)
    expect(closure.displayedCopTarget?.requiredUnaccountedPowerW).toBeCloseTo(7_530.8, 12)
    expect(closure.observedOutput?.boundaryClosed).toBe(false)
    expect(closure.observedOutput?.closedSystemCop).toBeNull()
    expect(closure.displayedCopTarget?.closedSystemCop).toBeNull()
  })

  it('calculates closed-system COP only after all input is explicitly declared', () => {
    const observed = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282, {
      explicitExternalInputPowerW: 7_433.2,
    })
    const target = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282, {
      explicitExternalInputPowerW: 7_000,
      storedEnergyDepletionPowerW: 530.8,
    })

    expect(observed.conservationClosure.observedOutput).toMatchObject({
      boundaryClosed: true,
      requiredUnaccountedPowerW: 0,
      closedSystemCop: 1,
    })
    expect(observed.conservationClosure.displayedCopTarget?.boundaryClosed).toBe(false)
    expect(target.conservationClosure.displayedCopTarget).toMatchObject({
      boundaryClosed: true,
      requiredUnaccountedPowerW: 0,
      closedSystemCop: 1,
    })
  })

  it('never reports a closed boundary above unity without stored-energy depletion', () => {
    const scenarios: GrayCopClaimScenario[] = [
      {
        id: 'unity',
        label: 'Unity boundary',
        source: 'user-provided-diagram',
        attributedInputPowerW: 10,
        attributedOutputPowerW: 10,
        attributedOutputPowerRangeW: null,
        displayedCop: 1,
        sourceNote: 'Invariant fixture.',
      },
      {
        id: 'lossy',
        label: 'Lossy boundary',
        source: 'user-provided-diagram',
        attributedInputPowerW: 12,
        attributedOutputPowerW: 9,
        attributedOutputPowerRangeW: null,
        displayedCop: 0.75,
        sourceNote: 'Invariant fixture.',
      },
      GRAY_COP_CLAIM_SCENARIOS.diagramCop282,
    ]

    const cases = scenarios.map((scenario) => evaluateGrayCopClaim(scenario, {
      explicitExternalInputPowerW: scenario.attributedOutputPowerW === null
        ? 0
        : Math.max(0, scenario.attributedOutputPowerW - scenario.attributedInputPowerW),
    }))

    for (const result of cases) {
      const closure = result.conservationClosure.observedOutput
      if (closure?.boundaryClosed) expect(closure.closedSystemCop).toBeLessThanOrEqual(1)
      expect(result.conservationClosure.storedEnergyDepletionPowerW).toBe(0)
    }
  })

  it('retains transcript alternatives as distinct unresolved source scenarios', () => {
    const cop300 = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.transcriptCop300)
    const ambiguous = evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.transcriptAmbiguousOutput)

    expect(Object.keys(GRAY_COP_CLAIM_SCENARIOS)).toEqual([
      'diagramCop282',
      'transcriptCop300',
      'transcriptAmbiguousOutput',
    ])
    expect(cop300.status).toBe('incomplete-source-values')
    expect(cop300.claim).toMatchObject({
      attributedInputPowerW: 26,
      attributedOutputPowerW: null,
      displayedCop: 300,
      outputPowerNeededForDisplayedCopW: 7_800,
    })
    expect(ambiguous.status).toBe('ambiguous-source-values')
    expect(ambiguous.claim.attributedOutputPowerW).toBeNull()
    expect(ambiguous.claim.attributedOutputPowerRangeW).toEqual([7_120, 7_460])
    expect(ambiguous.claim.arithmeticCopRange).toEqual([
      7_120 / 26.8,
      7_460 / 26.8,
    ])
  })

  it('does not inject claim deficits into the motor simulation', () => {
    const before = evaluateGrayMotor(GRAY_PRESETS.ema4)

    evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282, {
      explicitExternalInputPowerW: 7_000,
      storedEnergyDepletionPowerW: 530.8,
    })

    const after = evaluateGrayMotor(GRAY_PRESETS.ema4)
    expect(after).toEqual(before)
    expect(after.ledger.sourceCapacitorJ).toBe(
      0.5 * GRAY_PRESETS.ema4.capacitanceF * GRAY_PRESETS.ema4.chargeVoltageV ** 2,
    )
    expect(after.ledger.systemCop).toBeNull()
    expect(after.ledger.claimedCop).toBe(300)
    expect(after.ledger.claimedInputW).toBe(26)
  })
})
