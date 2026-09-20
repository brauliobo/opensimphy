import { evaluateQuery } from '../../src/compute/kernel'
import { parseComputeIntent } from '../../src/compute/parse'
import { rewriteComputeQuery } from '../../src/compute/rewrite'
import { COMPUTE_EXAMPLE_QUERIES } from '../../src/compute/examples'
import { interpretDimension } from '../../src/compute/quantities'
import { computeBaseSymbols } from '../../src/compute/constants'
import { evaluateExpression } from '../../src/engine/expression'
import { formatBasicDimensions } from '../../src/compute/format'

describe('compute rewrite and intent', () => {
  it('rewrites Planck phrases and Wolfram-style braces', () => {
    expect(rewriteComputeQuery('(Planck mass)/(Planck time)^2')).toBe('(m_P)/(t_P)^2')
    expect(rewriteComputeQuery('{Planck mass}/{Planck length}')).toBe('(m_P)/(l_P)')
  })

  it('rewrites Wolfram scientific notation and plural SI units', () => {
    expect(rewriteComputeQuery('1.573886629 × 10^-18 meters')).toBe('1.573886629e-18 meter')
    expect(rewriteComputeQuery('1.2102526979 × 10^44 newtons')).toBe('1.2102526979e44 N')
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

  it('keeps the shared compute-lab examples classified', () => {
    expect(parseComputeIntent(rewriteComputeQuery(COMPUTE_EXAMPLE_QUERIES[0])).kind).toBe('evaluate')
    expect(parseComputeIntent(rewriteComputeQuery(COMPUTE_EXAMPLE_QUERIES[1])).kind).toBe('evaluate')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[2]).kind).toBe('plot2d')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[3]).kind).toBe('plot3d')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[4]).kind).toBe('integrate')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[5]).kind).toBe('differentiate')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[6]).kind).toBe('solve')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[7]).kind).toBe('matrix')
    expect(parseComputeIntent(COMPUTE_EXAMPLE_QUERIES[8]).kind).toBe('integrate')
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

  it('keeps SI conversion for electronvolt-family units on the compute path only', () => {
    const symbols = computeBaseSymbols()
    expect(symbols.GeV?.value.re).toBeCloseTo(1.602176634e-10, 20)
    expect(formatBasicDimensions(symbols.GeV!.dimension)).toBe('[mass][length]^{2}[time]^{-2}')
  })

  it('keeps the monastery engine dimensions for a derived Planck quantity', () => {
    const symbols = computeBaseSymbols()
    const ratio = evaluateExpression('m_P / t_P^2', symbols)
    expect(formatBasicDimensions(ratio.dimension)).toBe('[mass][time]^{-2}')
    expect(interpretDimension(ratio.dimension).some((entry) => entry.name === 'spring constant')).toBe(true)
  })

  it('integrates, differentiates, solves, and plots in the browser', async () => {
    const integral = await evaluateQuery('integrate x^2 from 0 to 1')
    expect(integral.formatted).toBe('1/3')
    expect(integral.value?.re).toBeCloseTo(1 / 3, 8)
    expect(integral.steps.join('\n')).toMatch(/Giac\/Xcas/)
    expect(integral.steps.join('\n')).not.toMatch(/Simpson|Newton/)

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
  }, 60_000)

  it('evaluates a matrix determinant with Giac', async () => {
    const result = await evaluateQuery('det([[1,2],[3,4]])')
    expect(result.error).toBeUndefined()
    expect(result.formatted).toBe('-2')
    expect(result.steps.join('\n')).toMatch(/Giac\/Xcas/)
  }, 60_000)

  it('keeps monastery dimensional errors and uses Giac only for unknown CAS forms', async () => {
    const blocked = await evaluateQuery('sin(m_P)')
    expect(blocked.error).toMatch(/sin argument must be dimensionless/)
    expect(blocked.steps.join('\n')).not.toMatch(/Giac/)

    const cas = await evaluateQuery('tan(pi/4)')
    expect(cas.error).toBeUndefined()
    expect(cas.value?.re).toBeCloseTo(1, 8)
    expect(cas.steps.join('\n')).toMatch(/Giac\/Xcas/)
  }, 60_000)

  it('returns an indefinite integral from Giac', async () => {
    const result = await evaluateQuery('integrate sin(x)')
    expect(result.error).toBeUndefined()
    expect(result.formatted?.replace(/\s/g, '')).toBe('-cos(x)')
  }, 60_000)

  it('evaluates a mixed-unit GeV / meter^3 / newton radical as inverse length', async () => {
    const query = 'sqrt(((125.37560000 GeV)/(1.573886629 × 10^-18 meters)^3)/(1.2102526979 × 10^44 newtons))'
    const result = await evaluateQuery(query)
    expect(result.error).toBeUndefined()
    expect(result.steps.join('\n')).toMatch(/monastery-compatible dimensional engine/)
    expect(result.basicDimensions).toBe('[length]^{-1}')
    expect(result.siUnit).toBe('m^-1')
    expect(result.value?.re).toBeCloseTo(6.524744509494495, 8)
    expect(result.interpretations.map((entry) => entry.name)).toContain('wavenumber')
  })
})
