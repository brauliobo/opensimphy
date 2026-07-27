import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { bindPublishedResults, parseConstantsYaml, parsePublishedOutput } from '../../scripts/lib/source-parser.mjs'

const sourcePath = join(process.cwd(), 'data', 'physics_monastery', 'latest-output.txt')
const constantsPath = join(process.cwd(), 'data', 'physics_monastery', 'constants.yaml')

describe('published source output parser', () => {
  let source: string
  let recipes: ReturnType<typeof parseConstantsYaml>

  beforeAll(async () => {
    source = await readFile(sourcePath, 'utf8')
    recipes = parseConstantsYaml(await readFile(constantsPath, 'utf8'))
  })

  it('parses all preserved exact labels and measured sigma decisions', () => {
    const results = parsePublishedOutput(source)
    const exact = results.filter(({ sourceAudit }) => sourceAudit.kind === 'exact')
    const measured = results.filter(({ sourceAudit }) => sourceAudit.kind === 'measured')

    expect(results).toHaveLength(288)
    expect(exact).toHaveLength(70)
    expect(exact.filter(({ sourceAudit }) => sourceAudit.met)).toHaveLength(68)
    expect(exact.filter(({ sourceAudit }) => sourceAudit.assessment === 'full match')).toHaveLength(50)
    expect(exact.filter(({ sourceAudit }) => sourceAudit.assessment === 'almost-full match')).toHaveLength(18)
    expect(exact.filter(({ sourceAudit }) => sourceAudit.assessment === 'not a match')).toHaveLength(2)
    expect(measured).toHaveLength(218)
    expect(measured.filter(({ sourceAudit }) => sourceAudit.met)).toHaveLength(217)
    expect(results.find(({ constantId }) => constantId === 'V_m_1')?.sourceAudit).toEqual({
      kind: 'exact',
      assessment: 'not a match',
      matchedDigits: 7,
      totalCompared: 10,
      met: false,
    })
    expect(results.find(({ constantId }) => constantId === 'ST_1')?.sourceAudit).toEqual({
      kind: 'measured',
      zScore: -76.64,
      threshold: 5.2,
      met: false,
    })
  })

  it('fails closed for missing, mixed, or malformed exact audits', () => {
    expect(() => parsePublishedOutput(source.replace('digits:   full match (10/10)', 'digits removed: full match (10/10)'))).toThrow(/does not contain one complete source audit/)
    expect(() => parsePublishedOutput(source.replace('digits:   full match (10/10)', 'digits:   full match (11/10)'))).toThrow(/malformed digit counts/)
    expect(() => parsePublishedOutput(source.replace('digits:   full match (10/10)', 'digits:   full match (10/10)\nsigma:    +0.00'))).toThrow(/does not contain one complete source audit/)
  })

  it('fails closed for malformed, inconsistent, or nonfinite measured records', () => {
    expect(() => parsePublishedOutput(source.replace('within 5.2\u03c3: no', 'within 5.2\u03c3: yes'))).toThrow(/disagrees with its 5.2-sigma result/)
    expect(() => parsePublishedOutput(source.replace('sigma:    -76.64', 'sigma:    1e309'))).toThrow(/nonfinite z-score/)
    expect(() => parsePublishedOutput(source.replace('computed: 9192631770.42965 Hz', 'computed: Infinity Hz'))).toThrow(/nonfinite computed value/)
  })

  it('binds audits by exact recipe identity rather than source order', () => {
    const published = parsePublishedOutput(source)
    const bound = bindPublishedResults(recipes, [...published].reverse())

    expect(bound.get(1)?.constantId).toBe('Delta_nu_Cs')
    expect(bound.get(120)?.constantId).toBe('V_m_1')
    expect(bound.get(288)?.recipeNumber).toBe(288)
    expect(() => bindPublishedResults(recipes, published.map((result) => result.recipeNumber === 120
      ? { ...result, constantId: 'V_m_1_changed' }
      : result))).toThrow(/constant ID.*does not exactly match/)
    expect(() => bindPublishedResults(recipes, published.map((result) => result.recipeNumber === 120
      ? { ...result, displayName: `${result.displayName} changed` }
      : result))).toThrow(/display name.*does not exactly match/)
  })

  it('rejects Unicode-normalization differences in source identity', () => {
    const recipe = { recipe_number: 1, constant_id: '\u00e9', display_name: 'label' }
    const result = { recipeNumber: 1, constantId: 'e\u0301', displayName: 'label' }
    expect(() => bindPublishedResults([recipe], [result])).toThrow(/Unicode-normalization mismatch/)
    expect(() => bindPublishedResults(
      [{ ...recipe, constant_id: 'e\u0301' }],
      [{ ...result, constantId: 'e\u0301' }],
    )).toThrow(/not NFC-normalized/)
  })
})
