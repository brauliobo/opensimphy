import { fail, finiteNumber, jsonRecord, record, requireRatio, requireSafeIntegerBetween, throwIfAborted } from '../../src/simphy/contract'
import { GOLDEN_RATIO, SPEED_OF_LIGHT_M_PER_S } from '../../src/simphy/constants'
import { rk4Step } from '../../src/simphy/integrate'
import { boundedNumber as assertBounded, finiteNumber as assertFinite, logarithmicSamples, relativeError, requireInteger } from '../../src/simphy/numbers'
import { phenomenonCatalog } from '../../src/simphy/phenomenon'
import { boundsOf } from '../../src/simphy/plot'
import { add3, cross3, dot3, vec3 } from '../../src/simphy/vec'
import { awesomePhysicsCaseView } from '../../src/awesomePhysics/caseView'

describe('simphy contract', () => {
  it('parses plain JSON objects and rejects extras', () => {
    const value = record({ a: 1 }, 'input')
    expect(value.a).toBe(1)
    expect(() => jsonRecord([], 'input')).toThrow('input must be a JSON object')
    expect(() => fail('path', 'broke')).toThrow(TypeError)
    expect(finiteNumber(2, 'n')).toBe(2)
    expect(requireRatio(0.5, 'r')).toBe(0.5)
    expect(() => requireRatio(1.2, 'r')).toThrow('r must be between zero and one')
    expect(requireSafeIntegerBetween(3, 'i', 1, 4)).toBe(3)
    expect(() => requireSafeIntegerBetween(8, 'i', 1, 4)).toThrow('i must be a safe integer between 1 and 4')
  })

  it('aborts with AbortError', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrow('The operation was aborted')
  })
})

describe('simphy numbers and constants', () => {
  it('owns SI values used by EARTH and Tour', () => {
    expect(SPEED_OF_LIGHT_M_PER_S).toBe(299_792_458)
    expect(GOLDEN_RATIO).toBeCloseTo((1 + Math.sqrt(5)) / 2)
    expect(assertFinite(1, 'x')).toBe(1)
    expect(() => assertFinite(Number.NaN, 'x')).toThrow('x must be finite')
    expect(assertBounded(2, 'x', 0, 4)).toBe(2)
    expect(() => assertBounded(5, 'x', 0, 4)).toThrow('x must be within [0, 4]')
    expect(requireInteger(3, 'n')).toBe(3)
    expect(() => requireInteger(1.5, 'n')).toThrow('n must be an integer')
    expect(logarithmicSamples(1, 100, 3)[1]).toBeCloseTo(10)
    expect(relativeError(2, 1)).toBe(1)
  })
})

describe('simphy integrate and vec', () => {
  it('integrates y\' = y with RK4', () => {
    let state = [1]
    const step = 0.01
    for (let i = 0; i < 100; i += 1) state = rk4Step(state, step, ([y]) => [y ?? 0])
    expect(state[0]).toBeCloseTo(Math.exp(1), 5)
  })

  it('computes 3-vector products', () => {
    expect(dot3(add3(vec3(1, 0, 0), vec3(0, 1, 0)), vec3(1, 1, 0))).toBe(2)
    expect(cross3(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual([0, 0, 1])
  })
})

describe('simphy plot and phenomenon', () => {
  it('bounds a polyline', () => {
    expect(boundsOf([{ x: 0, y: 0 }, { x: 2, y: 2 }])).toEqual({ minX: 0, maxX: 2, minY: 0, maxY: 2 })
  })

  it('indexes phenomenon specs', () => {
    const catalog = phenomenonCatalog([{
      id: 'demo',
      title: 'Demo',
      kernel: { id: 'demo-kernel', run: (input: number) => input + 1 },
    }])
    expect(catalog.get('demo')?.kernel.run(2)).toBe(3)
    expect(catalog.get('missing')).toBeNull()
  })
})

describe('awesome physics case view', () => {
  it('projects a Chipmunk snapshot onto the shared case body', () => {
    const view = awesomePhysicsCaseView('awesome-pymunk', {
      operation: 'step',
      snapshot: { x: 0, y: 0.47, angle: 0.1, steps: 60 },
    })
    expect(view?.testId).toBe('awesome-case-pymunk')
    expect(view?.plot?.extraCircles?.[0]?.testId).toBe('awesome-case-pymunk-ball')
  })

  it('returns null for an unmatched payload', () => {
    expect(awesomePhysicsCaseView('awesome-pymunk', { operation: 'nope' })).toBeNull()
  })
})
