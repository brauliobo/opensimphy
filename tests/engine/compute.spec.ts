import { evaluateQuery } from '../../src/compute/kernel'
import { parseComputeIntent } from '../../src/compute/parse'
import { rewriteComputeQuery } from '../../src/compute/rewrite'
import { interpretDimension } from '../../src/compute/quantities'
import { computeBaseSymbols } from '../../src/compute/constants'
import { evaluateExpression } from '../../src/engine/expression'
import { formatBasicDimensions } from '../../src/compute/format'

describe('compute rewrite and intent', () => {
  it('rewrites Planck phrases and Wolfram-style braces', () => {
    expect(rewriteComputeQuery('(Planck mass)/(Planck time)^2')).toBe('(m_P)/(t_P)^2')
    expect(rewriteComputeQuery('{Planck mass}/{Planck length}')).toBe('(m_P)/(l_P)')
  })

  it('classifies calculus, plot, and solve intents', () => {
    expect(parseComputeIntent('d/dx sin(x)').kind).toBe('differentiate')
    expect(parseComputeIntent('derivative of x^2')).toMatchObject({ kind: 'differentiate', expression: 'x^2', variable: 'x' })
    expect(parseComputeIntent('integrate x^2 from 0 to 1')).toMatchObject({ kind: 'integrate', from: '0', to: '1' })
    expect(parseComputeIntent('plot sin(x) from 0 to 6.28').kind).toBe('plot2d')
    expect(parseComputeIntent('plot3d sin(x)*cos(y)').kind).toBe('plot3d')
    expect(parseComputeIntent('solve x^2 - 4 = 0').kind).toBe('solve')
    expect(parseComputeIntent('det([[1,2],[3,4]])').kind).toBe('matrix')
  })
})

describe('compute kernel', () => {
  it('evaluates Planck mass over Planck time squared as a spring-constant dimension', async () => {
    const result = await evaluateQuery('(Planck mass)/(Planck time)^2')
    expect(result.error).toBeUndefined()
    expect(result.basicDimensions).toBe('[mass][time]^{-2}')
    expect(result.interpretations.map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'spring constant',
      'force gradient',
      'linear force density',
      'stiffness',
      'surface tension',
      'tear strength',
      'cleavage',
    ]))
    expect(result.value?.re).toBeGreaterThan(1e34)
    expect(result.siUnit).toBe('kg s^-2')
  })

  it('keeps the monastery engine dimensions for a derived Planck quantity', () => {
    const symbols = computeBaseSymbols()
    const ratio = evaluateExpression('m_P / t_P^2', symbols)
    expect(formatBasicDimensions(ratio.dimension)).toBe('[mass][time]^{-2}')
    expect(interpretDimension(ratio.dimension).some((entry) => entry.name === 'spring constant')).toBe(true)
  })

  it('integrates, differentiates, solves, and plots in the browser', async () => {
    const integral = await evaluateQuery('integrate x^2 from 0 to 1')
    expect(integral.value?.re).toBeCloseTo(1 / 3, 8)

    const derivative = await evaluateQuery('d/dx sin(x)')
    expect(derivative.symbolic?.replace(/\s/g, '')).toMatch(/cos\(x\)/)

    const roots = await evaluateQuery('solve x^2 - 4 = 0')
    expect(roots.formatted).toContain('x = -2')
    expect(roots.formatted).toContain('x = 2')

    const plot = await evaluateQuery('plot sin(x)')
    expect(plot.figure?.series[0]?.kind).toBe('line')
    expect((plot.figure?.series[0]?.x.length ?? 0)).toBeGreaterThan(10)

    const surface = await evaluateQuery('plot3d sin(x)*cos(y)')
    expect(surface.figure?.series[0]?.kind).toBe('surface')
  })

  it('evaluates a matrix determinant with mathjs', async () => {
    const result = await evaluateQuery('det([[1,2],[3,4]])')
    expect(result.error).toBeUndefined()
    expect(result.formatted).toBe('-2')
  })

  it('keeps monastery dimensional errors and uses mathjs only for unknown CAS forms', async () => {
    const blocked = await evaluateQuery('sin(m_P)')
    expect(blocked.error).toMatch(/sin argument must be dimensionless/)

    const cas = await evaluateQuery('tan(pi/4)')
    expect(cas.error).toBeUndefined()
    expect(cas.value?.re).toBeCloseTo(1, 8)
  })
})
