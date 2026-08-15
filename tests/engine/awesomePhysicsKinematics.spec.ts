import simulationsJson from '../../public/data/generated/awesomePhysics/simulations.json'
import type {
  AwesomePhysicsSimulationArtifactV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../src/types/awesomePhysics'
import {
  createScikitKinematicsAdapter,
  evaluateScikitKinematics,
  SCIKIT_KINEMATICS_ADAPTER_ID,
  SCIKIT_KINEMATICS_BOUNDS,
  SCIKIT_KINEMATICS_SOURCE_CAVEATS,
  type ScikitKinematicsInputV1,
} from '../../src/awesomePhysics/adapters/typescript/scikitKinematics'
import {
  createPydyAdapter,
  evaluatePydy,
  PYDY_ADAPTER_ID,
  PYDY_BOUNDS,
  PYDY_SOURCE_CAVEATS,
  type PydyInputV1,
} from '../../src/awesomePhysics/adapters/typescript/pydy'
import {
  createPythonAcousticsAdapter,
  evaluatePythonAcoustics,
  PYTHON_ACOUSTICS_ADAPTER_ID,
  PYTHON_ACOUSTICS_BOUNDS,
  PYTHON_ACOUSTICS_SOURCE_CAVEATS,
  type PythonAcousticsInputV1,
} from '../../src/awesomePhysics/adapters/typescript/pythonAcoustics'

const simulations = simulationsJson as AwesomePhysicsSimulationArtifactV1

function descriptorFor(catalogItemId: string): AwesomePhysicsSimulationDescriptorV1 {
  const descriptor = simulations.items.find((item) => item.catalogItemId === catalogItemId)
  if (!descriptor) throw new Error(`Missing descriptor for ${catalogItemId}`)
  return descriptor
}

function expectFiniteJson(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toBeUndefined()
  const visit = (entry: unknown): void => {
    if (typeof entry === 'number') {
      expect(Number.isFinite(entry)).toBe(true)
      expect(Math.abs(entry)).toBeLessThanOrEqual(1e12)
      return
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }
    if (entry !== null && typeof entry === 'object') Object.values(entry).forEach(visit)
  }
  visit(value)
}

function expectCompatibility(
  adapter: { adapterId: string; protocol: string; compatibility: Record<string, string> },
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  adapterId: string,
): void {
  expect(adapter.adapterId).toBe(adapterId)
  expect(adapter.protocol).toBe('awesome-physics-adapter-v1')
  expect(adapter.compatibility).toEqual({
    contentRevision: descriptor.contentRevision,
    modelRevision: descriptor.modelRevision,
    implementationRevision: descriptor.implementationRevision,
    outputRevision: descriptor.outputRevision,
  })
}

const scikitDescriptor = descriptorFor('awesome-scikit-kinematics')
const pydyDescriptor = descriptorFor('awesome-pydy')
const acousticsDescriptor = descriptorFor('awesome-python-acoustics')

const scikitInput: ScikitKinematicsInputV1 = {
  operation: 'rotate-vector',
  vector: [1, 0, 0],
  quaternion: [Math.cos(Math.PI / 4), 0, 0, Math.sin(Math.PI / 4)],
}

const pydyInput: PydyInputV1 = {
  operation: 'two-link-pendulum-step',
  q1Rad: 0.3,
  q2Rad: -0.2,
  u1RadPerS: 0.1,
  u2RadPerS: -0.05,
  length1M: 1,
  length2M: 0.8,
  mass1Kg: 1,
  mass2Kg: 0.7,
  gravityMPerS2: 9.81,
  timeStepS: 0.001,
  steps: 48,
  sampleCount: 7,
}

describe('Awesome Physics TypeScript kinematics and dynamics adapters', () => {
  it('matches the still-unavailable, later-gated descriptors without claiming availability', () => {
    expect(scikitDescriptor).toMatchObject({ availability: 'unavailable', runnable: false, licenseGate: 'review' })
    expect(pydyDescriptor).toMatchObject({ availability: 'unavailable', runnable: false, licenseGate: 'review' })
    expect(acousticsDescriptor).toMatchObject({ availability: 'unavailable', runnable: false, licenseGate: 'review' })

    const scikit = createScikitKinematicsAdapter(scikitDescriptor, new AbortController().signal)
    const pydy = createPydyAdapter(pydyDescriptor, new AbortController().signal)
    const acoustics = createPythonAcousticsAdapter(acousticsDescriptor, new AbortController().signal)

    expectCompatibility(scikit, scikitDescriptor, SCIKIT_KINEMATICS_ADAPTER_ID)
    expectCompatibility(pydy, pydyDescriptor, PYDY_ADAPTER_ID)
    expectCompatibility(acoustics, acousticsDescriptor, PYTHON_ACOUSTICS_ADAPTER_ID)
    expect(SCIKIT_KINEMATICS_SOURCE_CAVEATS.license).toContain('BSD-2-Clause')
    expect(SCIKIT_KINEMATICS_SOURCE_CAVEATS.license).toContain('BSD-3-Clause')
    expect(PYDY_SOURCE_CAVEATS.license).toContain('later gate')
    expect(PYTHON_ACOUSTICS_SOURCE_CAVEATS.license).toContain('{organization}')
  })

  it('rotates vectors in space-fixed and body-fixed frames and applies a rigid transform', () => {
    const adapter = createScikitKinematicsAdapter(scikitDescriptor, new AbortController().signal)
    const rotated = adapter.run(scikitInput)
    if (rotated.operation !== 'rotate-vector') throw new Error('Expected a vector rotation output')
    expect(rotated.rotatedVector[0]).toBeCloseTo(0, 12)
    expect(rotated.rotatedVector[1]).toBeCloseTo(1, 12)
    expect(rotated.rotatedVector[2]).toBeCloseTo(0, 12)
    expect(rotated.rotationMatrix[0][0]).toBeCloseTo(0, 12)
    expect(rotated.rotationMatrix[1][0]).toBeCloseTo(1, 12)

    const bodyFixed = adapter.run({ ...scikitInput, coordinateFrame: 'body-fixed' })
    if (bodyFixed.operation !== 'rotate-vector') throw new Error('Expected a vector rotation output')
    expect(bodyFixed.rotatedVector[0]).toBeCloseTo(0, 12)
    expect(bodyFixed.rotatedVector[1]).toBeCloseTo(-1, 12)
    expect(bodyFixed.rotatedVector[2]).toBeCloseTo(0, 12)

    const rigid = adapter.run({
      operation: 'rigid-transform',
      vector: [1, 0, 0],
      quaternion: scikitInput.quaternion,
      translation: [1, 2, 3],
    })
    if (rigid.operation !== 'rigid-transform') throw new Error('Expected a rigid transform output')
    expect(rigid.transformedVector[0]).toBeCloseTo(1, 12)
    expect(rigid.transformedVector[1]).toBeCloseTo(3, 12)
    expect(rigid.transformedVector[2]).toBeCloseTo(3, 12)
    expect(rigid.transformMatrix[3]).toEqual([0, 0, 0, 1])
    expectFiniteJson(rigid)
  })

  it('rejects non-finite, malformed, and out-of-bound kinematics inputs', () => {
    expect(() => evaluateScikitKinematics({ ...scikitInput, vector: [Number.NaN, 0, 0] })).toThrow(/finite/)
    expect(() => evaluateScikitKinematics({ ...scikitInput, quaternion: [0, 0, 0, 0] })).toThrow(/zero quaternion/)
    expect(() => evaluateScikitKinematics({ ...scikitInput, vector: [SCIKIT_KINEMATICS_BOUNDS.vectorComponent + 1, 0, 0] })).toThrow(/between/)
    expect(() => evaluateScikitKinematics({ ...scikitInput, unexpected: true } as ScikitKinematicsInputV1 & { unexpected: boolean })).toThrow(/unknown properties/)
    expect(() => evaluateScikitKinematics({ ...scikitInput, quaternion: [0, 0, 2] })).toThrow(/length no greater/)
  })

  it('is deterministic and preserves quaternion norm for repeated kinematics runs', () => {
    const first = evaluateScikitKinematics(scikitInput)
    const second = evaluateScikitKinematics(JSON.parse(JSON.stringify(scikitInput)))
    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    if (first.operation !== 'rotate-vector') throw new Error('Expected a vector rotation output')
    expect(Math.hypot(...first.quaternion)).toBeCloseTo(1, 15)
    expectFiniteJson(first)
  })

  it('returns finite Lagrangian two-link dynamics with bounded energy drift', async () => {
    const adapter = createPydyAdapter(pydyDescriptor, new AbortController().signal)
    const result = await adapter.run(pydyInput)
    expect(result.samples).toHaveLength(7)
    expect(result.final.step).toBe(48)
    expect(result.final.timeS).toBeCloseTo(0.048, 14)
    expect(result.energy.absoluteDriftJ).toBeLessThan(1e-8)
    expect(result.samples.every((sample) => [
      sample.q1Rad,
      sample.q2Rad,
      sample.u1RadPerS,
      sample.u2RadPerS,
      sample.acceleration1RadPerS2,
      sample.acceleration2RadPerS2,
      sample.totalJ,
    ].every(Number.isFinite))).toBe(true)
    expectFiniteJson(result)
  })

  it('keeps a downward rest state at rest and rejects invalid dynamics domains', async () => {
    const rest: PydyInputV1 = {
      ...pydyInput,
      q1Rad: 0,
      q2Rad: 0,
      u1RadPerS: 0,
      u2RadPerS: 0,
      steps: 4,
      sampleCount: 5,
    }
    const result = await evaluatePydy(rest)
    expect(result.final.q1Rad).toBe(0)
    expect(result.final.q2Rad).toBe(0)
    expect(result.final.u1RadPerS).toBe(0)
    expect(result.final.u2RadPerS).toBe(0)
    expect(result.energy.absoluteDriftJ).toBe(0)

    await expect(evaluatePydy({ ...pydyInput, mass1Kg: 0 })).rejects.toThrow(/between/)
    await expect(evaluatePydy({ ...pydyInput, timeStepS: PYDY_BOUNDS.timeStepS.max + 1 })).rejects.toThrow(/between/)
    await expect(evaluatePydy({ ...pydyInput, steps: PYDY_BOUNDS.steps.max + 1 })).rejects.toThrow(/safe integer/)
    await expect(evaluatePydy({ ...pydyInput, timeStepS: Number.NaN })).rejects.toThrow(/finite/)
    await expect(evaluatePydy({ ...pydyInput, extra: true } as PydyInputV1 & { extra: boolean })).rejects.toThrow(/unknown properties/)
    await expect(evaluatePydy({ ...pydyInput, steps: PYDY_BOUNDS.steps.max, timeStepS: 0.01 })).rejects.toThrow(/no greater/)
  })

  it('produces byte-identical dynamics and observes cancellation during iteration', async () => {
    const first = await evaluatePydy(pydyInput)
    const second = await evaluatePydy(JSON.parse(JSON.stringify(pydyInput)))
    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))

    const controller = new AbortController()
    const pending = evaluatePydy({ ...pydyInput, steps: 10_000, sampleCount: 2 }, controller.signal)
    setTimeout(() => controller.abort(), 0)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('evaluates sound speed, impedance, Sabine reverberation, and atmospheric attenuation', () => {
    const adapter = createPythonAcousticsAdapter(acousticsDescriptor, new AbortController().signal)
    const speed = adapter.run({ operation: 'speed-of-sound', temperatureK: 293.15 })
    expect(speed).toMatchObject({ operation: 'speed-of-sound', units: 'm/s' })
    expect(speed.valueMPerS).toBeCloseTo(343.2, 12)

    const impedance = adapter.run({
      operation: 'impedance',
      frequencyHz: 1000,
      flowResistivityPaSPerM2: 10_000,
      model: 'delany-bazley',
    })
    expect(impedance).toMatchObject({ operation: 'impedance', model: 'delany-bazley' })
    expect(impedance.impedance.re).toBeCloseTo(1 + 9.08 * 100 ** -0.75, 12)
    expect(impedance.impedance.im).toBeCloseTo(-11.9 * 100 ** -0.73, 12)

    const reverberation = adapter.run({
      operation: 'reverberation',
      surfaceAreasM2: [100, 100],
      absorptionCoefficients: [0.2, 0.3],
      volumeM3: 1000,
      speedOfSoundMPerS: 343.2,
      method: 'sabine',
    })
    expect(reverberation.reverberationTimeS).toBeCloseTo(24 * Math.log(10) * 1000 / (343.2 * 50), 12)
    expect(reverberation.equivalentAbsorptionAreaM2).toBe(50)

    const attenuation = adapter.run({
      operation: 'attenuation',
      frequencyHz: 1000,
      temperatureK: 293.15,
      pressureKPa: 101.325,
      relativeHumidity: 0.5,
    })
    expect(attenuation.attenuationDbPerM).toBeGreaterThan(0)
    expect(attenuation.speedOfSoundMPerS).toBeCloseTo(343.2, 12)
    expectFiniteJson({ speed, impedance, reverberation, attenuation })
  })

  it('rejects acoustics unit/domain failures, respects bounds, and is deterministic', () => {
    const speedInput: PythonAcousticsInputV1 = { operation: 'speed-of-sound', temperatureK: 293.15 }
    const first = evaluatePythonAcoustics(speedInput)
    const second = evaluatePythonAcoustics(JSON.parse(JSON.stringify(speedInput)))
    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))

    expect(() => evaluatePythonAcoustics({ operation: 'speed-of-sound', temperatureK: 0 })).toThrow(/between/)
    expect(() => evaluatePythonAcoustics({ operation: 'speed-of-sound', temperatureK: Number.NaN })).toThrow(/finite/)
    expect(() => evaluatePythonAcoustics({ operation: 'impedance', frequencyHz: 1000, flowResistivityPaSPerM2: 0 })).toThrow(/between/)
    expect(() => evaluatePythonAcoustics({ operation: 'impedance', frequencyHz: 1000, flowResistivityPaSPerM2: 1000, model: 'other' } as never)).toThrow(/delany-bazley/)
    expect(() => evaluatePythonAcoustics({
      operation: 'reverberation',
      surfaceAreasM2: [1],
      absorptionCoefficients: [0],
      volumeM3: 10,
    })).toThrow(/absorption area/)
    expect(() => evaluatePythonAcoustics({
      operation: 'reverberation',
      surfaceAreasM2: [1, 2],
      absorptionCoefficients: [0.2],
      volumeM3: 10,
    })).toThrow(/equal lengths/)
    expect(() => evaluatePythonAcoustics({
      operation: 'reverberation',
      surfaceAreasM2: Array.from({ length: PYTHON_ACOUSTICS_BOUNDS.maximumArrayLength + 1 }, () => 1),
      absorptionCoefficients: Array.from({ length: PYTHON_ACOUSTICS_BOUNDS.maximumArrayLength + 1 }, () => 0.2),
      volumeM3: 10,
    })).toThrow(/between 1 and 32/)
    expect(() => evaluatePythonAcoustics({
      operation: 'attenuation',
      frequencyHz: 1000,
      temperatureK: 293.15,
      pressureKPa: 101.325,
      relativeHumidity: 2,
    })).toThrow(/between/)
    expect(() => evaluatePythonAcoustics({ ...speedInput, extra: true } as PythonAcousticsInputV1 & { extra: boolean })).toThrow(/unknown properties/)
    expectFiniteJson(first)
  })

  it('honors factory and run abort signals for all adapters', async () => {
    const factoryController = new AbortController()
    factoryController.abort()
    expect(() => createScikitKinematicsAdapter(scikitDescriptor, factoryController.signal)).toThrow(/aborted/i)
    expect(() => createPythonAcousticsAdapter(acousticsDescriptor, factoryController.signal)).toThrow(/aborted/i)
    expect(() => createPydyAdapter(pydyDescriptor, factoryController.signal)).toThrow(/aborted/i)

    const scikit = createScikitKinematicsAdapter(scikitDescriptor, new AbortController().signal)
    const acoustics = createPythonAcousticsAdapter(acousticsDescriptor, new AbortController().signal)
    const pydy = createPydyAdapter(pydyDescriptor, new AbortController().signal)
    const runController = new AbortController()
    runController.abort()
    expect(() => scikit.run(scikitInput, runController.signal)).toThrow(/aborted/i)
    expect(() => acoustics.run({ operation: 'speed-of-sound', temperatureK: 293.15 }, runController.signal)).toThrow(/aborted/i)
    await expect(Promise.resolve().then(() => pydy.run(pydyInput, runController.signal))).rejects.toMatchObject({ name: 'AbortError' })
  })
})
