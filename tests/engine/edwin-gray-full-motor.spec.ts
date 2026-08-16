import {
  evaluateGrayFullMotor,
  GRAY_PRESETS,
  runGrayFullMotor,
  type GrayFullMotorInput,
  type GrayMagneticLookup,
} from '../../src/edwin-gray/edwinGrayEngine'

const prescribedInput = {
  ...GRAY_PRESETS.purple,
  revolutions: 1,
  mode: 'prescribed-diagnostic',
  machineMode: 'original-500rpm-contact-v1',
} satisfies GrayFullMotorInput

describe('Edwin Gray continuous full motor teaching model', () => {
  it('executes the canonical ordered 27-event train per revolution', () => {
    const result = runGrayFullMotor({ ...prescribedInput, revolutions: 2 })

    expect(result.scheduledEventCount).toBe(54)
    expect(result.completedEventCount).toBe(54)
    expect(result.completedRevolutions).toBe(2)
    expect(result.events.map((event) => event.eventIndex)).toEqual(
      Array.from({ length: 54 }, (_, index) => index),
    )
    expect(result.events.every((event) => event.sectors.length === 3)).toBe(true)
    expect(result.events[27]!.scheduledAbsoluteAngleDeg).toBeCloseTo(360, 12)
    expect(result.targetFinalAngleDeg).toBe(720)
    expect(result.finalAngleDeg).toBeCloseTo(720, 12)
    expect(result.finalState.absoluteAngleDeg).toBe(result.finalAngleDeg)
    expect(result.finalState.rpm).toBeCloseTo(500, 12)
  })

  it('derives dynamic event times from the evolving absolute rotor state', () => {
    const prescribed = evaluateGrayFullMotor(prescribedInput)
    const dynamic = evaluateGrayFullMotor({
      ...prescribedInput,
      mode: 'dynamic',
      rotorInertiaKgM2: 0.02,
      loadTorqueNm: 0.01,
    })

    expect(dynamic.stalled).toBe(false)
    expect(dynamic.completedEventCount).toBe(27)
    expect(dynamic.events.every((event, index) => index === 0
      || event.timeSeconds > dynamic.events[index - 1]!.timeSeconds)).toBe(true)
    expect(dynamic.events[10]!.timeSeconds).not.toBeCloseTo(prescribed.events[10]!.timeSeconds, 8)
    expect(dynamic.finalRpm).not.toBeCloseTo(dynamic.input.startRpm, 8)
    expect(dynamic.finalState.kineticEnergyJ).toBeCloseTo(
      0.5 * dynamic.input.rotorInertiaKgM2 * dynamic.finalState.omegaRadPerSecond ** 2,
      12,
    )
  })

  it('stops scheduling later events when load stalls the rotor', () => {
    const result = evaluateGrayFullMotor({
      ...prescribedInput,
      mode: 'dynamic',
      rotorInertiaKgM2: 0.01,
      loadTorqueNm: 1_000,
    })

    expect(result.stalled).toBe(true)
    expect(result.completedEventCount).toBeLessThan(result.scheduledEventCount)
    expect(result.finalRpm).toBe(0)
    expect(result.stallTimeSeconds).toBe(result.simulatedDurationSeconds)
    expect(result.stallAngleDeg).toBe(result.finalAngleDeg)
    expect(result.events.at(-1)!.scheduledAbsoluteAngleDeg).toBeLessThan(result.targetFinalAngleDeg)
    expect(result.findings.some((finding) => finding.code === 'stall')).toBe(true)
  })

  it('solves and bounds recovery while recharging between events', () => {
    const result = evaluateGrayFullMotor(prescribedInput)
    const recoveredEvents = result.events.filter((event) => event.ledger.recoveredJ > 0)

    expect(recoveredEvents.length).toBeGreaterThan(0)
    expect(result.events.slice(1).some((event) => event.recharge.sourceJ > 0)).toBe(true)
    expect(result.events.slice(1).some((event) => event.recharge.recoveryReturnedJ > 0)).toBe(true)
    for (const event of recoveredEvents) {
      expect(event.ledger.dumpBankPeakJ).toBeLessThan(
        event.ledger.holdingDeliveredJ + event.ledger.dumpBankInitialJ,
      )
      expect(event.ledger.holdingToDumpLossJ).toBeCloseTo(
        event.ledger.holdingDeliveredJ + event.ledger.dumpBankInitialJ
          - event.ledger.dumpBankPeakJ,
        12,
      )
      expect(event.recoveryBranch.solved).toBe(true)
      expect(event.recoveryBranch.topology).toBe('series-rlc-quarter-cycle')
      expect(event.recoveryBranch.transferTimeSeconds).toBeGreaterThan(0)
      expect(event.ledger.recoveredJ).toBeLessThanOrEqual(event.recoveryBranch.availableMagneticJ)
      expect(event.ledger.recoveredJ).toBeLessThanOrEqual(event.recoveryBranch.storageHeadroomJ)
      expect(event.ledger.numericalResidualJ).toBeCloseTo(0, 12)
    }
    expect(recoveredEvents.some((event) => !Object.is(
      event.ledger.recoveredJ,
      event.recoveryBranch.availableMagneticJ * result.motor.recoveryCoupling,
    ))).toBe(true)
  })

  it('versions the original 500 rpm rule separately from the modified machine', () => {
    const original = evaluateGrayFullMotor({ ...prescribedInput, startRpm: 300 })
    const boundary = evaluateGrayFullMotor({ ...prescribedInput, startRpm: 500 })
    const modified = evaluateGrayFullMotor({
      ...prescribedInput,
      startRpm: 300,
      machineMode: 'modified-electronic-v1',
    })

    expect(original.quenchRule).toMatchObject({
      id: 'original-500rpm-contact-v1',
      version: 1,
      referenceMinimumRpm: 500,
      provenance: 'presenter-reported',
    })
    expect(original.events.every((event) => !event.contactRuleSatisfied && !event.quenchSucceeded)).toBe(true)
    expect(boundary.events.every((event) => event.contactRuleSatisfied && event.quenchSucceeded)).toBe(true)
    expect(modified.quenchRule).toMatchObject({
      id: 'modified-electronic-v1',
      version: 1,
      referenceMinimumRpm: null,
      provenance: 'illustrative-modification',
    })
    expect(modified.events.every((event) => event.contactRuleSatisfied && event.quenchSucceeded)).toBe(true)
  })

  it('requires rotor motion and a conducted positive-energy pulse before quench success', () => {
    for (const machineMode of ['original-500rpm-contact-v1', 'modified-electronic-v1'] as const) {
      const result = evaluateGrayFullMotor({ ...prescribedInput, startRpm: 0, machineMode })
      const event = result.events[0]!

      expect(event.conductedPulse).toBe(false)
      expect(event.interruptionReachable).toBe(false)
      expect(event.quenchSucceeded).toBe(false)
      expect(event.ledger.holdingDeliveredJ).toBe(0)
      expect(event.ledger.magneticPeakJ).toBe(0)
    }
  })

  it('keeps failed-quench energy through inter-event decay and blocks the next fire', () => {
    const withRecovery = evaluateGrayFullMotor({
      ...prescribedInput,
      quenchDeg: 20,
      machineMode: 'modified-electronic-v1',
    })
    const withoutRecovery = evaluateGrayFullMotor({
      ...prescribedInput,
      motorId: 'gold',
      quenchDeg: 20,
      machineMode: 'modified-electronic-v1',
    })

    for (const result of [withRecovery, withoutRecovery]) {
      const failed = result.events[0]!
      const blocked = result.events[1]!
      expect(failed.conductedPulse).toBe(true)
      expect(failed.interruptionReachable).toBe(false)
      expect(failed.quenchSucceeded).toBe(false)
      expect(failed.after.arcState).toBe('sustained')
      expect(failed.ledger.residualCoilJ).toBeGreaterThan(0)
      expect(blocked.recharge.priorCoilMagneticJ).toBe(failed.ledger.residualCoilJ)
      expect(blocked.recharge.priorCoilArcLossJ).toBeGreaterThan(0)
      expect(blocked.recharge.residualCoilJ).toBeGreaterThan(0)
      expect(blocked.fireEligible).toBe(false)
      expect(blocked.conductedPulse).toBe(false)
      expect(blocked.quenchSucceeded).toBe(false)
      expect(Math.abs(result.ledger.normalizedResidual)).toBeLessThan(1e-10)
    }
    expect(withRecovery.events[0]!.ledger.recoveredJ).toBeGreaterThan(0)
    expect(withRecovery.events[0]!.ledger.residualCoilJ)
      .toBeLessThan(withoutRecovery.events[0]!.ledger.residualCoilJ)
    expect(withoutRecovery.events[0]!.ledger.recoveredJ).toBe(0)
  })

  it('separates holding-capacitance supply from dump-capacitance transient sensitivity', () => {
    const baseline = evaluateGrayFullMotor({
      ...prescribedInput,
      capacitanceF: 1e-6,
      dumpCapacitanceF: 2e-7,
    })
    const largerHolding = evaluateGrayFullMotor({
      ...prescribedInput,
      capacitanceF: 2e-6,
      dumpCapacitanceF: 2e-7,
    })
    const largerDump = evaluateGrayFullMotor({
      ...prescribedInput,
      capacitanceF: 1e-6,
      dumpCapacitanceF: 4e-7,
    })

    expect(largerHolding.events[0]!.ledger.holdingDeliveredJ)
      .not.toBeCloseTo(baseline.events[0]!.ledger.holdingDeliveredJ, 10)
    expect(largerDump.events[0]!.ledger.dumpBankPeakJ)
      .not.toBeCloseTo(baseline.events[0]!.ledger.dumpBankPeakJ, 10)
    expect(largerDump.events[0]!.ledger.magneticPeakJ)
      .not.toBeCloseTo(baseline.events[0]!.ledger.magneticPeakJ, 10)
    expect(largerDump.input.capacitanceF).toBe(baseline.input.capacitanceF)
    expect(largerHolding.input.dumpCapacitanceF).toBe(baseline.input.dumpCapacitanceF)
  })

  it('closes a complete declared boundary without importing COP claim deficits', () => {
    const result = evaluateGrayFullMotor({
      ...prescribedInput,
      mode: 'dynamic',
      rotorInertiaKgM2: 0.02,
      loadTorqueNm: 0.01,
    })
    const ledger = result.ledger

    expect(ledger.boundaryComplete).toBe(true)
    expect(ledger.copScope).toBe('complete-declared-source-and-stored-energy-boundary')
    expect(ledger.claimDeficitInjectedJ).toBe(0)
    expect(ledger.accountedJ).toBeCloseTo(ledger.totalDeclaredInputJ, 10)
    expect(ledger.numericalResidualJ).toBeCloseTo(0, 10)
    expect(Math.abs(ledger.normalizedResidual)).toBeLessThan(1e-10)
    expect(ledger.wholeSystemCop).toBeGreaterThanOrEqual(0)
    expect(ledger.wholeSystemCop).toBeLessThanOrEqual(1)
    expect(ledger.wholeSystemEfficiency).toBe(ledger.wholeSystemCop)
    expect(result.validatesTheory).toBe(false)
    expect(result.findings.some((finding) => finding.statement.includes('no claim deficit'))).toBe(true)
  })

  it('converges under event-transient refinement and labels compatible lookup use as hybrid', () => {
    const coarse = evaluateGrayFullMotor({ ...prescribedInput, integrationStepsPerEvent: 4 })
    const refined = evaluateGrayFullMotor({ ...prescribedInput, integrationStepsPerEvent: 64 })
    const reference = evaluateGrayFullMotor({ ...prescribedInput, integrationStepsPerEvent: 1024 })
    const lookup: GrayMagneticLookup = {
      source: 'fem-lookup',
      caseId: 'full-motor-test',
      referenceCurrentA: 10,
      anglesDeg: [0, 90, 180, 270],
      inductanceH: [1e-5, 1.2e-5, 1e-5, 0.8e-5],
      coEnergyJ: [0.0005, 0.0006, 0.0005, 0.0004],
      provenance: {
        solver: 'test-solver',
        backend: 'test-backend',
        inputHash: 'f6ef1e3563ff77b7a83c7325419066e9212367f581ff9440fa40f2efc8741e91',
      },
      compatibility: {
        machineContractId: 'patent-3890548-illustrative',
        machineRevision: 1,
        modelRevision: 1,
        topologyIdentity: 'us3890548a-nine-stator-three-rotor-pair-topology',
        turns: 100,
        excitation: 'impressed-current-magnetostatic',
        modelInputHash: 'f6ef1e3563ff77b7a83c7325419066e9212367f581ff9440fa40f2efc8741e91',
      },
    }
    const hybrid = evaluateGrayFullMotor({
      ...prescribedInput,
      motorId: 'patent-illustrative',
      machineContractId: 'patent-3890548-illustrative',
      turns: 100,
      machineMode: 'modified-electronic-v1',
      magneticLookup: lookup,
    })

    expect(refined.finalAngleDeg).toBe(coarse.finalAngleDeg)
    expect(refined.simulatedDurationSeconds).toBe(coarse.simulatedDurationSeconds)
    const coarseError = Math.abs(coarse.events[0]!.ledger.magneticPeakJ
      - reference.events[0]!.ledger.magneticPeakJ)
    const refinedError = Math.abs(refined.events[0]!.ledger.magneticPeakJ
      - reference.events[0]!.ledger.magneticPeakJ)
    expect(coarseError).toBeGreaterThan(0)
    expect(refinedError).toBeLessThan(coarseError)
    expect(refined.numericalMethod).toBe('bounded-midpoint-event-map-v2')
    expect(hybrid.magneticScope).toBe('hybrid-fem-magnetic-lumped-circuit')
    expect(hybrid.findings.find((finding) => finding.code === 'magnetic-scope')!.statement)
      .toContain('FEM lookup values cover only the magnetic relation')
    expect(() => evaluateGrayFullMotor({
      ...hybrid.input,
      turns: 101,
      magneticLookup: lookup,
    })).toThrow(/final submitted machine, turns, excitation, or model hash/)
  })

  it('enforces exact contract-to-engine mapping and isolates prototype surrogates from patent FEM', () => {
    expect(() => evaluateGrayFullMotor({
      ...prescribedInput,
      machineContractId: 'patent-3890548-illustrative',
    })).toThrow(/requires engine profile patent-illustrative/)
    expect(evaluateGrayFullMotor(prescribedInput).engineProfile).toMatchObject({
      contractId: 'edwin-gray-purple',
      motorId: 'purple',
      scenarioKind: 'source-described-prototype-illustrative-surrogate',
      femCompatible: false,
    })
    expect(evaluateGrayFullMotor({
      ...prescribedInput,
      motorId: 'patent-illustrative',
      machineContractId: 'patent-3890548-illustrative',
      turns: 100,
    }).motor.id).toBe('patent-illustrative')
  })

  it('reports monotonically completed event counts from the event loop', () => {
    const completed: number[] = []
    const result = evaluateGrayFullMotor(prescribedInput, {
      onEventCompleted: (count) => completed.push(count),
    })
    expect(completed).toEqual(Array.from({ length: result.completedEventCount }, (_, index) => index + 1))
  })
})
