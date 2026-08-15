import {
  buildGrayEventSchedule,
  calculateEnergyBalance,
  evaluateGrayFamily,
  evaluateGrayMotor,
  GRAY_MODEL_PROVENANCE,
  GRAY_PRESETS,
  grayInductanceAtAngle,
  grayQuenchTiming,
  grayTorqueAtAngle,
  interpolateAngle,
  poleAngles,
  quenchTimeSeconds,
} from '../../src/edwin-gray/edwinGrayEngine'

describe('Edwin Gray motor engine', () => {
  it('closes the canonical 27-step schedule with three simultaneous sectors', () => {
    const schedule = buildGrayEventSchedule()

    expect(schedule).toHaveLength(27)
    expect(schedule[0]!.angleDeg).toBe(0)
    expect(schedule[26]!.endAngleDeg).toBeCloseTo(360, 12)
    expect(schedule.every((event) => event.sectorCount === 3)).toBe(true)
    expect(schedule.every((event) => event.sectors.length > 0)).toBe(true)
    expect(schedule.every((event) => event.sectors.length === 3)).toBe(true)
    expect(schedule[0]!.stepDeg).toBeCloseTo(13 + 1 / 3, 12)
    expect(schedule[0]!.majorMinorOffsetDeg).toBeCloseTo(13 + 1 / 3, 12)
  })

  it('encodes phase, element selection, unwrapped sector angles, and station mapping', () => {
    const schedule = buildGrayEventSchedule(2)

    expect(schedule.slice(0, 6).map((event) => event.phaseLabel)).toEqual(['A', 'B', 'C', 'A', 'B', 'C'])
    expect(schedule.slice(0, 6).map((event) => event.phase)).toEqual([0, 1, 2, 0, 1, 2])
    expect(schedule.slice(0, 6).map((event) => event.phaseIndex)).toEqual([0, 1, 2, 0, 1, 2])
    expect(schedule.slice(0, 6).map((event) => event.majorMinor)).toEqual([
      'minor', 'major', 'minor', 'minor', 'major', 'minor',
    ])
    expect(schedule[0]!.sectors.map((sector) => sector.statorPairStation)).toEqual([0, 3, 6])
    expect(schedule[0]!.sectors.map((sector) => sector.rotorPairStation)).toEqual([0, 1, 2])
    expect(schedule[3]!.sectors.map((sector) => sector.statorPairStation)).toEqual([1, 4, 7])
    expect(schedule[9]!.sectors.map((sector) => sector.rotorPairStation)).toEqual([1, 2, 0])
    expect(schedule[26]!.sectors[2]!.angleDeg).toBeCloseTo(360 + 226 + 2 / 3, 12)
    expect(schedule[27]!.angleDeg).toBe(360)
    expect(schedule[27]!.sectors[2]!.angleDeg).toBe(600)
    expect(schedule[0]!.sectors.every((sector) => sector.element === sector.majorMinor)).toBe(true)
  })

  it('exposes the patent topology and presenter-reported quench provenance', () => {
    const result = evaluateGrayMotor(GRAY_PRESETS.purple)

    expect(result.topology.statorPairStations).toBe(9)
    expect(result.topology.rotorPairStations).toBe(3)
    expect(result.topology.majorMinorPerStation).toBe(2)
    expect(result.topology.dischargesPerRevolution).toBe(27)
    expect(result.provenance).toEqual(GRAY_MODEL_PROVENANCE)
    expect(result.provenance.quenchStatus).toMatch(/not universal/)
    expect(result.provenance.excludedTerms).toEqual([
      'radiant-event force',
      'free-energy source',
      'non-classical force',
    ])
  })

  it('uses theta over omega for three- and six-degree timing at 500 rpm', () => {
    expect(quenchTimeSeconds(3, 500)).toBeCloseTo(0.001, 12)
    expect(quenchTimeSeconds(6, 500)).toBeCloseTo(0.002, 12)

    const timing = grayQuenchTiming(6, 500)
    expect(timing.timeSeconds).toBeCloseTo(0.002, 12)
    expect(timing.status).toBe('presenter-reported')
    expect(timing.universal).toBe(false)
    expect(timing.reachable).toBe(true)
  })

  it('treats the exact 500 rpm quench boundary as reached and quenchable', () => {
    const result = evaluateGrayMotor({ ...GRAY_PRESETS.purple, startRpm: 500, initialAngleDeg: 0, quenchDeg: 3 })

    expect(result.quenchEventReached).toBe(true)
    expect(result.quenchEventAngleDeg).toBeCloseTo(3, 12)
    expect(result.quenchEventRpm).toBeCloseTo(500, 8)
    expect(result.arcQuenched).toBe(true)
  })

  it('derives angle-dependent torque from co-energy with sign reversal and zero crossings', () => {
    const positive = grayTorqueAtAngle(10, -10, 140, 0.05)
    const negative = grayTorqueAtAngle(10, 10, 140, 0.05)
    const zeroCurrent = grayTorqueAtAngle(0, 10, 140, 0.05)
    const zeroAngle = grayTorqueAtAngle(10, 0, 140, 0.05)

    expect(positive).toBeGreaterThan(0)
    expect(negative).toBeLessThan(0)
    expect(zeroCurrent).toBe(0)
    expect(zeroAngle).toBeCloseTo(0, 8)
    expect(grayInductanceAtAngle(10, 140, 0.05)).not.toBeCloseTo(grayInductanceAtAngle(30, 140, 0.05), 8)
  })

  it('handles periodic angle interpolation without extrapolation', () => {
    expect(interpolateAngle(360, [0, 90, 180, 270], [0, 1, 0, -1])).toBeCloseTo(0, 12)
    expect(interpolateAngle(45, [0, 90, 180, 270], [0, 1, 0, -1])).toBeCloseTo(0.5, 12)
    expect(interpolateAngle(-45, [0, 90, 180, 270], [0, 1, 0, -1])).toBeCloseTo(-0.5, 12)
  })

  it('keeps a zero-source pulse at zero energy and zero current', () => {
    const result = evaluateGrayMotor({ ...GRAY_PRESETS.purple, chargeVoltageV: 0 })

    expect(result.peakCurrentA).toBe(0)
    expect(result.ledger.sourceCapacitorJ).toBe(0)
    expect(result.ledger.shaftWorkJ).toBe(0)
    expect(result.ledger.recoveryJ).toBe(0)
    expect(result.ledger.lossesJ).toBe(0)
    expect(result.ledger.residualJ).toBe(0)
    expect(result.ledger.normalizedResidual).toBe(0)
    expect(result.samples.every((sample) => sample.currentA === 0 && sample.torqueNm === 0)).toBe(true)
  })

  it('caps recovery by the inductor energy available at the arc event', () => {
    const result = evaluateGrayMotor(GRAY_PRESETS.purple)

    expect(result.ledger.recoveredJ).toBeGreaterThan(0)
    expect(result.ledger.recoveredJ).toBeLessThanOrEqual(result.ledger.inductorAtQuenchJ)
    expect(result.ledger.recoveredJ).toBeLessThanOrEqual(result.ledger.stage.recovery.capJ)
    expect(result.ledger.stage.arc.inductorAtEventJ).toBe(result.ledger.inductorAtQuenchJ)
    expect(result.ledger.stage.arc.sparkLossJ + result.ledger.recoveredJ)
      .toBeCloseTo(result.ledger.stage.arc.inductorAtEventJ, 12)
  })

  it('uses the integrated event state for arc energy and exposes actual reach separately', () => {
    const result = evaluateGrayMotor(GRAY_PRESETS.purple)
    const eventSample = result.samples.at(-1)!

    expect(result.quenchEventReached).toBe(true)
    expect(result.quenchEventTimeSeconds).toBeCloseTo(result.quenchTimeSeconds, 9)
    expect(result.quenchEventAngleDeg).toBeCloseTo(result.input.initialAngleDeg + result.input.quenchDeg, 12)
    expect(eventSample.angleDeg).toBeCloseTo(result.quenchEventAngleDeg!, 12)
    expect(eventSample.omegaRadPerSecond).toBeCloseTo(result.quenchEventOmegaRadPerSecond!, 12)
    expect(result.ledger.inductorAtQuenchJ).toBeCloseTo(
      0.5 * eventSample.inductanceH * eventSample.currentA ** 2,
      12,
    )
  })

  it('keeps the 500 rpm reference as a gate while reporting a reachable slow event', () => {
    const result = evaluateGrayMotor({ ...GRAY_PRESETS.purple, startRpm: 120 })

    expect(result.quenchEventReached).toBe(true)
    expect(result.quenchEventRpm).toBeCloseTo(120, 8)
    expect(result.arcQuenched).toBe(false)
    expect(result.finding).toContain('unquenched')
    expect(result.powerRateBasis).toBe('nominal-start-speed')
    expect(result.pulseRateHz).toBe(result.nominalPulseRateHz)
  })

  it('grows arc length from zero and caps it at the event angle', () => {
    const result = evaluateGrayMotor(GRAY_PRESETS.purple)
    const lengths = result.samples.map((sample) => sample.arcLengthM)
    const expectedFinalLength = 0.1524 * result.input.quenchDeg * Math.PI / 180

    expect(lengths[0]).toBe(0)
    expect(lengths[Math.floor(lengths.length / 2)]).toBeGreaterThan(0)
    expect(lengths.at(-1)).toBeCloseTo(expectedFinalLength, 12)
    expect(lengths.every((length, index) => index === 0 || length >= lengths[index - 1]!)).toBe(true)
    expect(lengths.every((length) => length <= expectedFinalLength + 1e-15)).toBe(true)
  })

  it('does not let a heavy dynamic load reach quench by reversing the rotor', () => {
    const result = evaluateGrayMotor({
      ...GRAY_PRESETS.purple,
      speedMode: 'dynamic',
      rotorInertiaKgM2: 0.01,
      loadTorqueNm: 1e6,
    })

    expect(result.stalled).toBe(true)
    expect(result.finalRpm).toBe(0)
    expect(result.quenchEventReached).toBe(false)
    expect(result.arcQuenched).toBe(false)
    expect(result.samples.every((sample) => sample.omegaRadPerSecond >= 0)).toBe(true)
  })

  it('keeps prescribed speed kinematic and excludes prescribed load work', () => {
    const unloaded = evaluateGrayMotor(GRAY_PRESETS.purple)
    const loaded = evaluateGrayMotor({ ...GRAY_PRESETS.purple, loadTorqueNm: 1e3 })

    expect(loaded.mechanicalModel).toBe('kinematic-prescribed')
    expect(loaded.loadWorkJ).toBe(0)
    expect(loaded.ledger.loadWorkJ).toBe(0)
    expect(loaded.mechanicalBalanceResidualJ).toBe(0)
    expect(loaded.finalRpm).toBe(unloaded.finalRpm)
    expect(loaded.ledger.integratedTorqueWorkJ).toBe(unloaded.ledger.integratedTorqueWorkJ)
  })

  it('reports dynamic torque, load, and kinetic terms separately', () => {
    const result = evaluateGrayMotor({
      ...GRAY_PRESETS.purple,
      speedMode: 'dynamic',
      rotorInertiaKgM2: 0.02,
      loadTorqueNm: 0.01,
    })

    expect(result.mechanicalModel).toBe('dynamic-inertial')
    expect(result.electromagneticTorqueWorkJ).toBe(result.integratedTorqueWorkJ)
    expect(result.loadWorkJ).toBeGreaterThan(0)
    expect(result.kineticEnergyChangeJ).toBe(result.rotorKineticDeltaJ)
    expect(result.mechanicalBalanceResidualJ).toBeCloseTo(
      result.integratedTorqueWorkJ - result.loadWorkJ - result.kineticEnergyChangeJ,
      12,
    )
    expect(result.ledger.accountedJ).toBeCloseTo(result.ledger.sourceCapacitorJ, 3)
  })

  it('keeps critical outputs finite for prescribed and dynamic runs', () => {
    const prescribed = evaluateGrayMotor({
      ...GRAY_PRESETS.ema4,
      chargeVoltageV: 200_000,
      capacitanceF: 1e-12,
      startRpm: 0,
    })
    const dynamic = evaluateGrayMotor({
      ...GRAY_PRESETS.purple,
      speedMode: 'dynamic',
      rotorInertiaKgM2: 0.02,
      loadTorqueNm: 0.01,
    })
    const values = [
      ...prescribed.samples.flatMap((sample) => Object.values(sample)),
      ...dynamic.samples.flatMap((sample) => Object.values(sample)),
      prescribed.ledger.normalizedResidual,
      dynamic.ledger.normalizedResidual,
    ]

    expect(values.every((value) => typeof value === 'number' && Number.isFinite(value))).toBe(true)
    expect(dynamic.speedMode).toBe('dynamic')
    expect(dynamic.rotorKineticFinalJ).toBeGreaterThanOrEqual(0)
  })

  it('reports the independent torque integral and its pulse-stage balance residual', () => {
    const result = evaluateGrayMotor(GRAY_PRESETS.purple)
    const ledger = result.ledger

    expect(ledger.classicalCop).toBe(ledger.pulseStageCop)
    expect(ledger.classicalCopScope).toBe('pulse-stage')
    expect(ledger.systemCop).toBeNull()
    expect(ledger.accountedJ).toBeCloseTo(ledger.sourceCapacitorJ - ledger.residualJ, 12)
    expect(ledger.residualJ).not.toBe(0)
    expect(ledger.normalizedResidual).toBeCloseTo(ledger.residualJ / ledger.sourceCapacitorJ, 12)
    expect(ledger.chargeJ).toBe(ledger.sourceCapacitorJ)
    expect(ledger.lossesJ).toBeCloseTo(ledger.ohmicJ + ledger.sparkJ, 12)
    expect(ledger.shaftWorkJ).toBe(ledger.torqueWorkJ)
    expect(ledger.electromagneticTorqueWorkJ).toBe(ledger.integratedTorqueWorkJ)
    expect(ledger.integratedTorqueWorkJ).toBe(result.integratedTorqueWorkJ)
    expect(result.shaftWorkJ).toBe(result.torqueWorkJ)
    expect(result.torqueWorkJ).toBe(ledger.torqueWorkJ)
  })

  it('keeps the standalone balance helper exact and separate from system COP', () => {
    const balance = calculateEnergyBalance({
      sourceCapacitorJ: 10,
      shaftWorkJ: 2,
      recoveredJ: 1,
      lossesJ: 6,
      residualCapacitorJ: 0.5,
      residualInductorJ: 0.5,
    })

    expect(balance.accountedJ).toBe(10)
    expect(balance.residualJ).toBe(0)
    expect(balance.normalizedResidual).toBe(0)
  })

  it('validates energy terms but permits signed torque work', () => {
    expect(calculateEnergyBalance({
      sourceCapacitorJ: 1,
      torqueWorkJ: -0.25,
      recoveredJ: 0.25,
      lossesJ: 0.5,
      residualCapacitorJ: 0.25,
      residualInductorJ: 0.25,
    }).torqueWorkJ).toBe(-0.25)
    expect(() => calculateEnergyBalance({
      sourceCapacitorJ: -1,
      torqueWorkJ: 0,
      recoveredJ: 0,
      lossesJ: 0,
      residualCapacitorJ: 0,
      residualInductorJ: 0,
    })).toThrow(/sourceCapacitorJ/)
    expect(() => calculateEnergyBalance({
      sourceCapacitorJ: 1,
      torqueWorkJ: 0,
      recoveredJ: -1,
      lossesJ: 0,
      residualCapacitorJ: 0,
      residualInductorJ: 0,
    })).toThrow(/recoveredJ/)
  })

  it('resolves invalid speed modes and keeps zero runs finite and unquenched', () => {
    expect(() => evaluateGrayMotor({ ...GRAY_PRESETS.purple, speedMode: 'invalid' as never })).toThrow(/speedMode/)

    const result = evaluateGrayMotor({
      ...GRAY_PRESETS.purple,
      startRpm: 0,
      chargeVoltageV: 0,
    })
    const values = result.samples.flatMap((sample) => Object.values(sample))

    expect(result.quenchEventReached).toBe(false)
    expect(result.arcQuenched).toBe(false)
    expect(result.samples.every((sample) => sample.arcLengthM === 0)).toBe(true)
    expect(values.every((value) => typeof value === 'number' && Number.isFinite(value))).toBe(true)
  })

  it('preserves the catalog, family, and geometry compatibility APIs', () => {
    const gold = evaluateGrayMotor(GRAY_PRESETS.gold)
    const black = evaluateGrayMotor(GRAY_PRESETS.black)
    const rows = evaluateGrayFamily({
      chargeVoltageV: 5000,
      capacitanceF: 8.3e-8,
      startRpm: 500,
      quenchDeg: 3,
      turns: 140,
    })

    expect(gold.ledger.recoveredJ).toBe(0)
    expect(black.motor.statorPoles).toBe(1)
    expect(black.motor.observationWindow).toBe(true)
    expect(poleAngles(3)).toEqual([0, 120, 240])
    expect(rows).toHaveLength(6)
    expect(rows.find((row) => row.motor.id === 'purple')!.ledger.recoveredJ).toBeGreaterThan(0)
    expect(rows.find((row) => row.motor.id === 'white')!.ledger.mechanicalJ)
      .toBeLessThan(rows.find((row) => row.motor.id === 'gold')!.ledger.mechanicalJ)
  })
})
