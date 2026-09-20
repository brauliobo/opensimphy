import { certifySlepcEigenSolve, parseSlepcEigenpairs } from '../../src/simulation/slepc-log'

const sample = `
Info    : Solving linear eigenvalue problem
Info    : SLEPc solution method: krylovschur
Info    : SLEPc number of requested eigenvalues: 8
Info    : SLEPc stopping condition: tol=1e-06, maxit=100
Info    : SLEPc solving...
Info    : SLEPc converged in 12 iterations
Info    : SLEPc number of converged eigenpairs: 8
Info    :                Re                      Im                      Relative error
Info    : EIG 000 w^2 =  7.4022033007985802e-02  0.0000000000000000e+00  1.234567e-09
Info    :           w =  2.7206983101784121e-01  0.0000000000000000e+00
Info    : EIG 001 w^2 =  1.4804406601597160e-01  0.0000000000000000e+00  2.345678e-09
`

describe('SLEPc GetDP eigen log', () => {
  it('parses linear EVP w^2 eigenpairs and relative errors', () => {
    const modes = parseSlepcEigenpairs([sample])
    expect(modes).toHaveLength(2)
    expect(modes[0]).toEqual({ index: 0, value: 7.4022033007985802e-2, residual: 1.234567e-9 })
    expect(modes[1]!.value).toBeGreaterThan(modes[0]!.value)
  })

  it('certifies a converged SLEPc solve', () => {
    const modes = certifySlepcEigenSolve([sample], 8)
    expect(modes).toHaveLength(2)
    expect(modes[0]!.residual).toBeLessThan(1e-8)
  })

  it('accepts extra Krylov-subspace eigenpairs above the requested count', () => {
    const extra = sample.replace('SLEPc number of converged eigenpairs: 8', 'SLEPc number of converged eigenpairs: 11')
    expect(certifySlepcEigenSolve([extra], 8)).toHaveLength(2)
  })

  it('rejects a diverged SLEPc solve', () => {
    expect(() => certifySlepcEigenSolve(['SLEPc diverged after 100 iterations'], 8)).toThrow(/diverged/)
  })
})
