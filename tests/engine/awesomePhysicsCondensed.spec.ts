import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import {
  calculateTightBindingBandEnergyEv,
  calculateTightBindingOccupancy,
  createTightBindingAdapter,
  TIGHT_BINDING_ADAPTER_ID,
  TIGHT_BINDING_BOUNDS,
  TIGHT_BINDING_CATALOG_ITEM_ID,
  TIGHT_BINDING_SOURCE_CAVEATS,
  type TightBindingInputV1,
  type TightBindingOutputV1,
} from '../../src/awesomePhysics/adapters/typescript/tightBinding'
import {
  calculateSpectrumPeakFwhm,
  createScikitSpectraAdapter,
  resampleSpectrum,
  SCIKIT_SPECTRA_ADAPTER_ID,
  SCIKIT_SPECTRA_BOUNDS,
  SCIKIT_SPECTRA_CATALOG_ITEM_ID,
  SCIKIT_SPECTRA_SOURCE_CAVEATS,
  type ScikitSpectraInputV1,
  type ScikitSpectraOutputV1,
} from '../../src/awesomePhysics/adapters/typescript/scikitSpectra'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptorFor(catalogItemId: string, adapterId: string): AwesomePhysicsSimulationDescriptorV1 {
  const source = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  if (!source) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return { ...source, adapterId }
}

function expectFiniteJson(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toBeUndefined()
  const visit = (entry: unknown): void => {
    if (typeof entry === 'number') {
      expect(Number.isFinite(entry)).toBe(true)
      return
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }
    if (entry !== null && typeof entry === 'object') Object.values(entry).forEach(visit)
  }
  visit(value)
  expect(JSON.parse(serialized!)).toEqual(value)
}

function expectCompatibility(
  adapter: { adapterId: string; protocol: string; compatibility: Record<string, string> },
  descriptor: AwesomePhysicsSimulationDescriptorV1,
): void {
  expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
  expect(adapter.adapterId).toBe(descriptor.adapterId)
  expect(adapter.compatibility).toEqual({
    contentRevision: descriptor.contentRevision,
    modelRevision: descriptor.modelRevision,
    implementationRevision: descriptor.implementationRevision,
    outputRevision: descriptor.outputRevision,
  })
}

describe('Awesome Physics condensed-matter TypeScript adapters', () => {
  it('exports stable descriptor-compatible factories without changing availability gates', () => {
    const tightDescriptor = descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID)
    const spectraDescriptor = descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID)
    const tight = createTightBindingAdapter(tightDescriptor, new AbortController().signal)
    const spectra = createScikitSpectraAdapter(spectraDescriptor, new AbortController().signal)

    expectCompatibility(tight, tightDescriptor)
    expectCompatibility(spectra, spectraDescriptor)
    expect(spectraDescriptor.availability).toBe('unavailable')
    expect(spectraDescriptor.licenseGate).toBe('review')
    expect(SCIKIT_SPECTRA_SOURCE_CAVEATS.license).toContain('discrepant')
    expect(TIGHT_BINDING_SOURCE_CAVEATS.data).toContain('No NumPy')
  })

  it('evaluates a symmetric 1D cosine band with bounded Fermi occupancy', () => {
    const adapter = createTightBindingAdapter(
      descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID),
      new AbortController().signal,
    )
    const input: TightBindingInputV1 = {
      onsiteEnergyEv: 0,
      hoppingEnergyEv: 1,
      latticeSpacingM: 3e-10,
      chemicalPotentialEv: 0,
      temperatureK: 300,
      kPointCount: 17,
    }
    const output = adapter.run(input) as TightBindingOutputV1

    expect(output.model).toBe('tight-binding-1d-cosine-v1')
    expect(output.units).toMatchObject({ energy: 'eV', waveVector: 'rad/m', occupancy: '1' })
    expect(output.band).toHaveLength(input.kPointCount)
    expect(output.bandMinimumEv).toBeCloseTo(-2, 14)
    expect(output.bandMaximumEv).toBeCloseTo(2, 14)
    for (let index = 0; index < output.band.length; index += 1) {
      const mirror = output.band[output.band.length - index - 1]!
      expect(output.band[index]!.energyEv).toBeCloseTo(mirror.energyEv, 14)
      expect(output.band[index]!.occupancy).toBeGreaterThanOrEqual(0)
      expect(output.band[index]!.occupancy).toBeLessThanOrEqual(1)
    }
    expect(output.fillingElectronsPerCell).toBeCloseTo(1, 12)
    expect(calculateTightBindingBandEnergyEv(0, input.latticeSpacingM, 0, 1)).toBe(-2)
    expect(calculateTightBindingOccupancy(-2, 0, 0)).toBe(1)
    expectFiniteJson(output)
  })

  it('bounds empty and full band occupancy at zero temperature', () => {
    const adapter = createTightBindingAdapter(
      descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID),
      new AbortController().signal,
    )
    const base: TightBindingInputV1 = {
      onsiteEnergyEv: 0,
      hoppingEnergyEv: 0.5,
      latticeSpacingM: 4e-10,
      chemicalPotentialEv: 0,
      temperatureK: 0,
      kPointCount: TIGHT_BINDING_BOUNDS.kPointCount.min,
    }
    const empty = adapter.run({ ...base, chemicalPotentialEv: -100 }) as TightBindingOutputV1
    const full = adapter.run({ ...base, chemicalPotentialEv: 100 }) as TightBindingOutputV1

    expect(empty.band.every(({ occupancy }) => occupancy === 0)).toBe(true)
    expect(empty.fillingElectronsPerCell).toBe(0)
    expect(full.band.every(({ occupancy }) => occupancy === 1)).toBe(true)
    expect(full.fillingElectronsPerCell).toBe(2)
    expect(calculateTightBindingOccupancy(0, 0, 300)).toBeCloseTo(0.5, 14)
  })

  it('resamples a triangular spectrum and recovers its peak and FWHM', () => {
    const input: ScikitSpectraInputV1 = {
      axis: [0, 2, 4, 5, 6, 8, 10],
      intensity: [0, 0, 0, 1, 0, 0, 0],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: 101,
    }
    const adapter = createScikitSpectraAdapter(
      descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID),
      new AbortController().signal,
    )
    const output = adapter.run(input) as ScikitSpectraOutputV1

    expect(output.resampledAxis).toHaveLength(101)
    expect(output.resampledAxis[0]).toBe(0)
    expect(output.resampledAxis.at(-1)).toBe(10)
    expect(output.peak).toMatchObject({ axis: 5, intensity: 1, halfMaximum: 0.5 })
    expect(output.peak?.fwhm).toBeCloseTo(1, 12)
    expect(output.fwhm).toBeCloseTo(1, 12)
    expect(calculateSpectrumPeakFwhm(output.resampledAxis, output.resampledIntensity)?.fwhm).toBeCloseTo(1, 12)
    expect(resampleSpectrum(input.axis, input.intensity, input.sampleCount)).toEqual({
      axis: output.resampledAxis,
      intensity: output.resampledIntensity,
    })
    expectFiniteJson(output)
  })

  it('preserves descending spectral axes and deterministic peak widths', () => {
    const ascending: ScikitSpectraInputV1 = {
      axis: [0, 2, 4, 5, 6, 8, 10],
      intensity: [0, 0, 0, 1, 0, 0, 0],
      axisUnit: 'eV',
      intensityUnit: 'counts',
      sampleCount: 51,
    }
    const descending: ScikitSpectraInputV1 = {
      ...ascending,
      axis: [...ascending.axis].reverse(),
      intensity: [...ascending.intensity].reverse(),
    }
    const adapter = createScikitSpectraAdapter(
      descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID),
      new AbortController().signal,
    )
    const first = adapter.run(descending) as ScikitSpectraOutputV1
    const second = adapter.run(JSON.parse(JSON.stringify(descending))) as ScikitSpectraOutputV1

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(first.resampledAxis[0]).toBe(10)
    expect(first.resampledAxis.at(-1)).toBe(0)
    expect(first.peak).toMatchObject({ axis: 5 })
    expect(first.peak?.fwhm).toBeCloseTo(1, 12)
    expectFiniteJson(first)
  })

  it('rejects malformed and out-of-domain condensed inputs', () => {
    const tight = createTightBindingAdapter(
      descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID),
      new AbortController().signal,
    )
    const spectra = createScikitSpectraAdapter(
      descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID),
      new AbortController().signal,
    )

    expect(() => tight.run({
      onsiteEnergyEv: 0,
      hoppingEnergyEv: 1,
      latticeSpacingM: 0,
      chemicalPotentialEv: 0,
      temperatureK: 300,
      kPointCount: 9,
    })).toThrow(/latticeSpacingM.*between/)
    expect(() => tight.run({
      onsiteEnergyEv: Number.NaN,
      hoppingEnergyEv: 1,
      latticeSpacingM: 3e-10,
      chemicalPotentialEv: 0,
      temperatureK: 300,
      kPointCount: 9,
      unexpected: true,
    } as never)).toThrow(/unknown properties|finite number/)
    expect(() => tight.run({
      onsiteEnergyEv: 0,
      hoppingEnergyEv: 1,
      latticeSpacingM: 3e-10,
      chemicalPotentialEv: 0,
      temperatureK: 300,
      kPointCount: TIGHT_BINDING_BOUNDS.kPointCount.max + 1,
    })).toThrow(/kPointCount.*between/)

    expect(() => spectra.run({
      axis: [0, 1, 1],
      intensity: [0, 1, 0],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: 9,
    })).toThrow(/strictly monotonic/)
    expect(() => spectra.run({
      axis: [0, 1],
      intensity: [0],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: 9,
    })).toThrow(/equal lengths/)
    expect(() => spectra.run({
      axis: [0, Number.POSITIVE_INFINITY],
      intensity: [0, 1],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: SCIKIT_SPECTRA_BOUNDS.outputSamples.min,
    })).toThrow(/finite number/)
    expect(() => spectra.run({
      axis: [0, 1],
      intensity: [0, 1],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: SCIKIT_SPECTRA_BOUNDS.outputSamples.max + 1,
    })).toThrow(/sampleCount.*between/)
  })

  it('checks cancellation at factory and run boundaries', () => {
    const tightDescriptor = descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID)
    const spectraDescriptor = descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID)
    const cancelledFactory = new AbortController()
    cancelledFactory.abort()
    expect(() => createTightBindingAdapter(tightDescriptor, cancelledFactory.signal)).toThrow(/aborted/i)
    expect(() => createScikitSpectraAdapter(spectraDescriptor, cancelledFactory.signal)).toThrow(/aborted/i)

    const tight = createTightBindingAdapter(tightDescriptor, new AbortController().signal)
    const spectra = createScikitSpectraAdapter(spectraDescriptor, new AbortController().signal)
    const cancelledRun = new AbortController()
    cancelledRun.abort()
    expect(() => tight.run({
      onsiteEnergyEv: 0,
      hoppingEnergyEv: 1,
      latticeSpacingM: 3e-10,
      chemicalPotentialEv: 0,
      temperatureK: 300,
      kPointCount: 9,
    }, cancelledRun.signal)).toThrow(/aborted/i)
    expect(() => spectra.run({
      axis: [0, 1, 2],
      intensity: [0, 1, 0],
      axisUnit: 'nm',
      intensityUnit: 'a.u.',
      sampleCount: 9,
    }, cancelledRun.signal)).toThrow(/aborted/i)
  })

  it('rejects incompatible descriptors instead of silently adapting them', () => {
    const tightDescriptor = descriptorFor(TIGHT_BINDING_CATALOG_ITEM_ID, TIGHT_BINDING_ADAPTER_ID)
    const spectraDescriptor = descriptorFor(SCIKIT_SPECTRA_CATALOG_ITEM_ID, SCIKIT_SPECTRA_ADAPTER_ID)
    expect(() => createTightBindingAdapter({ ...tightDescriptor, execution: 'browser' }, new AbortController().signal)).toThrow(/TypeScript execution/)
    expect(() => createScikitSpectraAdapter({ ...spectraDescriptor, catalogItemId: 'other' }, new AbortController().signal)).toThrow(/simulation descriptor/)
  })
})
