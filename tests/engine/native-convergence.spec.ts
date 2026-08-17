import { nativeConvergenceOracle } from '../../tools/wasm/native-convergence.mjs'

describe('independent native convergence oracle', () => {
  const project = {
    id: 'adversarial-native',
    setNumbers: {},
    convergence: {
      linear: { absoluteTolerance: 1e-8, relativeTolerance: 1e-6, residualCount: 2 },
      structure: { kind: 'fixed', groups: [{ kind: 'linear', systemName: 'Sys_A' }] },
    },
  }
  const log = (final: string, ...reasons: string[]) => [
    "Info : System 'Sys_A' : Real",
    'Info : Solve[Sys_A]',
    'Info : 0 KSP Residual norm 1',
    `Info : 1 KSP Residual norm ${final}`,
    ...reasons,
  ].join('\n')
  const pinnedReasons = [
    [-12, 'DIVERGED_USER', 'diverged'], [-11, 'DIVERGED_PC_FAILED', 'diverged'], [-10, 'DIVERGED_INDEFINITE_MAT', 'diverged'],
    [-9, 'DIVERGED_NANORINF', 'diverged'], [-8, 'DIVERGED_INDEFINITE_PC', 'diverged'], [-7, 'DIVERGED_NONSYMMETRIC', 'diverged'],
    [-6, 'DIVERGED_BREAKDOWN_BICG', 'diverged'], [-5, 'DIVERGED_BREAKDOWN', 'diverged'], [-4, 'DIVERGED_DTOL', 'diverged'],
    [-3, 'DIVERGED_ITS', 'diverged'], [-2, 'DIVERGED_NULL', 'diverged'], [0, 'CONVERGED_ITERATING', 'iterating'],
    [1, 'CONVERGED_RTOL_NORMAL_EQUATIONS', 'converged'], [2, 'CONVERGED_RTOL', 'converged'], [3, 'CONVERGED_ATOL', 'converged'],
    [4, 'CONVERGED_ITS', 'converged'], [5, 'CONVERGED_NEG_CURVE', 'converged'], [6, 'CONVERGED_STEP_LENGTH', 'converged'],
    [7, 'CONVERGED_HAPPY_BREAKDOWN', 'converged'], [8, 'CONVERGED_USER', 'converged'], [9, 'CONVERGED_ATOL_NORMAL_EQUATIONS', 'converged'],
  ] as const

  it('rejects incomplete, malformed and non-finite native numeric evidence', () => {
    for (const token of ['1e-12junk', '1e-', 'NaN', 'Inf', '-Infinity', '1e999']) {
      expect(() => nativeConvergenceOracle(log(token), project), token).toThrow('native convergence certification failed')
    }
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : KSP Converged reason 4junk'), project)).toThrow('malformed native numeric PETSc reason evidence')
    for (const token of ['NaN', 'Inf', '999999999999999999999999999999']) {
      expect(() => nativeConvergenceOracle(log('1e-12', `Info : KSP Converged reason ${token}`), project), token).toThrow('native convergence certification failed')
    }
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : Residual 000: abs 1e-12junk rel 1e-12'), project)).toThrow('malformed native nonlinear residual evidence')
  })

  it('rejects repeated and cross-form native reason contradictions', () => {
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : KSP Converged reason: 4', 'Info : KSP Diverged reason = -3'), project)).toThrow('conflicting native numeric PETSc reasons')
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : Linear solve converged due to CONVERGED_RTOL', 'Info : Linear solve diverged due to DIVERGED_BREAKDOWN'), project)).toThrow('conflicting native named PETSc reasons')
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : KSP Converged reason: 4', 'Info : Linear solve diverged due to DIVERGED_BREAKDOWN'), project)).toThrow('conflicting native PETSc reason evidence')
    expect(() => nativeConvergenceOracle(log('1e-12', 'Info : Linear solve converged due to DIVERGED_BREAKDOWN'), project)).toThrow('invalid native named PETSc reason')
  })

  it('uses every canonical reason from the pinned native PETSc table', () => {
    for (const [code, name, outcome] of pinnedReasons) {
      const numericLabel = outcome === 'diverged' ? 'Diverged' : 'Converged'
      const namedLabel = outcome === 'diverged' ? 'did not converge' : 'converged'
      const certify = () => nativeConvergenceOracle(log('1e-12', `Info : KSP ${numericLabel} reason: ${code}`, `Info : Linear solve ${namedLabel} due to ${name} iterations 1`), project)
      if (outcome === 'converged') expect(certify(), `${code}:${name}`).toMatchObject([{ converged: true }])
      else expect(certify, `${code}:${name}`).toThrow('native convergence certification failed')
    }
  })

  it('rejects unknown native reasons and mismatched canonical aliases without residual fallback', () => {
    const cases = [
      log('1e-12', 'Info : KSP Converged reason: 999'),
      log('1e-12', 'Info : KSP Diverged reason: -999'),
      log('1e-12', 'Info : Linear solve converged due to CONVERGED_BOGUS iterations 1'),
      log('1e-12', 'Info : Linear solve converged due to CONVERGED_RTOL_NORMAL iterations 1'),
      log('1e-12', 'Info : KSP Converged reason: 2', 'Info : Linear solve converged due to CONVERGED_ATOL iterations 1'),
    ]
    for (const source of cases) expect(() => nativeConvergenceOracle(source, project)).toThrow('native convergence certification failed')
    expect(() => nativeConvergenceOracle(cases.at(-1)!, project)).toThrow('conflicting native PETSc reason evidence')
  })

  it('accepts complete native tokens with valid whitespace and punctuation', () => {
    const numeric = log('.1e-11\t', 'Info : KSP Converged reason \t = 4  ').replace('Info : 0 KSP Residual norm 1\n', '\x1b[34mInfo : 0 KSP Residual norm   +1.0e+0 \x1b[0m\r')
    expect(nativeConvergenceOracle(numeric, project)).toMatchObject([{ reason: 4, converged: true }])
    expect(nativeConvergenceOracle(log('1e-12', 'Info : Linear solve converged due to CONVERGED_RTOL iterations 1   '), project)).toMatchObject([{ reasonText: 'converged:CONVERGED_RTOL', converged: true }])
  })
})
