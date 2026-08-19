import {
  evaluateGrayPresenterConverterChain,
  GRAY_COP_CLAIM_SCENARIOS,
  GRAY_PRESENTER_CONVERTER_CHAIN,
} from '../../src/edwin-gray/edwinGrayEngine'

describe('Edwin Gray presenter converter-chain accounting', () => {
  it('locks Whisper/Crosby/Hackenberger numbers without endorsing the attributed claim', () => {
    const result = evaluateGrayPresenterConverterChain()
    const runtimeS = 36 * 3600

    expect(GRAY_PRESENTER_CONVERTER_CHAIN.frontEndInputW).toBe(
      GRAY_COP_CLAIM_SCENARIOS.whisperCop280.attributedInputPowerW,
    )
    expect(GRAY_PRESENTER_CONVERTER_CHAIN.mechanicalOutputW).toBe(
      GRAY_COP_CLAIM_SCENARIOS.whisperCop280.attributedOutputPowerW,
    )
    expect(result.presenterApparentCop).toBeCloseTo(279.8507462686567, 12)
    expect(result.hackenbergerApparentCop).toBeCloseTo(3.0303030303030303, 12)
    expect(result.topOffGeneratorW).toBe(360)
    expect(result.unaccountedEnergyJ).toBe((7_500 - 26.8) * runtimeS)
    expect(result.frontEndPlusTopOffCop).toBeCloseTo(7_500 / (26.8 + 360), 12)
    expect(result.requiredCycleReturnEfficiencyForPresenterCop).toBeCloseTo(0.9964266666666667, 12)
    expect(result.validatesTheory).toBe(false)
    expect(result.missingEnergyTerm).toMatch(/front-end-only Crosby metering/i)
  })
})
