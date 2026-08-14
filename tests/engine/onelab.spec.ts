import { summarizeView, withinTolerance } from '../../src/simulation/reference'
import { OnelabClient } from '../../src/simulation/client'
import { OnelabWorkerScheduler } from '../../src/simulation/worker-scheduler'
import { callGetdpWithDatabase, canonicalizeOnelab, mergeValidatedValues, parameterChanged, parseOnelab, restoreReadOnlyValues, setParameterValue, validateEnvelopeValues, validateReadOnlyValues } from '../../src/simulation/onelab-db'
import { ProjectSession } from '../../src/simulation/project-session'
import { canonicalMshRecords } from '../../src/simulation/msh'
import { certifyConvergence } from '../../src/simulation/convergence'
import type { ConvergenceCriteria } from '../../src/simulation/types'

const database = canonicalizeOnelab({ onelab: { version: '1.3', parameters: [
  { type: 'string', name: 'Parameters/Label', values: ['default'], changedValue: 31, visible: true, readOnly: false, clients: { Gmsh: 0, GetDP: 0 } },
  { type: 'number', name: 'Parameters/Mesh', values: [1], min: 0.5, max: 2, step: 0.5, changedValue: 31, visible: true, readOnly: false, clients: { Gmsh: 0, GetDP: 0 } },
] } })

describe('ONELAB canonical project state', () => {
  it('canonicalizes MSH2 topology independently of whitespace and record order', () => {
    const left = '$Nodes\n2\n2 1 0 0\n1 0 0 0\n$EndNodes\n$Elements\n1\n1 15 0 1\n$EndElements\n'
    const right = '$Nodes 2\n1   0 0 0\n2 1 0 0\n$EndNodes\n$Elements 1\n1 15 0 1\n$EndElements\n'
    expect(canonicalMshRecords(left)).toBe(canonicalMshRecords(right))
  })

  it('canonicalizes native parameters and applies bounded typed edits', () => {
    expect(parseOnelab(database).onelab.parameters.map(({ name }) => name)).toEqual(['Parameters/Label', 'Parameters/Mesh'])
    const edited = parseOnelab(setParameterValue(database, 'Parameters/Mesh', 2))
    expect(edited.onelab.parameters[1]).toMatchObject({ values: [2], changedValue: 31, clients: { Gmsh: 31, GetDP: 31 } })
    expect(parameterChanged(edited.onelab.parameters[1]!)).toBe(31)
    expect(() => setParameterValue(database, 'Parameters/Mesh', 3)).toThrow('between 0.5 and 2')
  })

  it('sends reconstructible envelopes and rejects stale or foreign commits', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'project-1' })
    const session = new ProjectSession()
    session.open([{ path: '/model.geo', bytes: new Uint8Array([1, 2]) }], database)
    session.edit('Parameters/Mesh', 2)
    const envelope = session.envelope('compute')
    expect(envelope).toMatchObject({ schema: 3, projectId: 'project-1', revision: 1, action: 'compute', database: session.database, defaults: database })
    expect(envelope.files[0]?.bytes).not.toBe(session.files[0]?.bytes)
    expect(session.commit({ action: 'check', projectId: 'foreign', revision: 1, database })).toEqual({ committed: false, reason: 'foreign-project' })
    expect(session.commit({ action: 'check', projectId: 'project-1', revision: 0, database })).toEqual({ committed: false, reason: 'stale-revision' })
    expect(session.database).toBe(envelope.database)
    vi.unstubAllGlobals()
  })

  it('validates envelope values against parser-native declarations', () => {
    const declarations = parseOnelab(database)
    declarations.onelab.parameters.push({ type: 'number', name: 'GetDP/Action', values: [0], min: 0, max: 1, step: 1, changedValue: 31, visible: false, readOnly: true, clients: { GetDP: 0 } })
    const declared = canonicalizeOnelab(declarations)
    const edited = setParameterValue(database, 'Parameters/Mesh', 2)
    expect(validateEnvelopeValues(declared, edited)).toEqual([{ name: 'Parameters/Mesh', type: 'number', values: [2] }])
    expect(parseOnelab(mergeValidatedValues(declared, edited)).onelab.parameters.find(({ name }) => name === 'GetDP/Action')).toBeTruthy()
    const unknown = parseOnelab(edited); unknown.onelab.parameters.push({ type: 'string', name: 'Injected', values: ['x'], changedValue: 31, visible: true, readOnly: false })
    expect(() => validateEnvelopeValues(declared, canonicalizeOnelab(unknown))).toThrow('unknown ONELAB parameter Injected')
    const wrongType = parseOnelab(edited); Object.assign(wrongType.onelab.parameters.find(({ name }) => name === 'Parameters/Mesh')!, { type: 'string', values: ['2'] })
    expect(() => validateEnvelopeValues(declared, canonicalizeOnelab(wrongType))).toThrow('has type string; expected number')
    const readonly = parseOnelab(declared); (readonly.onelab.parameters.find(({ name }) => name === 'GetDP/Action') as any).values = [1]
    expect(() => validateReadOnlyValues(declared, canonicalizeOnelab(readonly), declared)).toThrow('GetDP/Action is read-only')
  })

  it('restores parser defaults for read-only values in outbound envelopes', () => {
    const defaults = parseOnelab(database)
    defaults.onelab.parameters.push({ type: 'number', name: 'Parameters/Derived', values: [0.1], min: 0, max: 1, step: 0, changedValue: 0, visible: true, readOnly: true })
    const current = parseOnelab(canonicalizeOnelab(defaults))
    ;(current.onelab.parameters.find(({ name }) => name === 'Parameters/Derived') as any).values = [0.2]
    expect(parseOnelab(restoreReadOnlyValues(canonicalizeOnelab(current), canonicalizeOnelab(defaults))).onelab.parameters.find(({ name }) => name === 'Parameters/Derived')?.values).toEqual([0.1])
  })

  it('exports GetDP changes after the native call without reapplying stale input', () => {
    let native = database
    const onelab = {
      clear: vi.fn(() => { native = canonicalizeOnelab({ onelab: { version: '1.3', parameters: [] } }) }),
      set: vi.fn((json: string) => { native = json }),
      get: vi.fn(() => native),
      getChanged: vi.fn(() => 31),
      setChanged: vi.fn(),
    }
    const result = callGetdpWithDatabase(onelab, database, () => {
      const updated = parseOnelab(native)
      const mesh = updated.onelab.parameters.find(({ name }) => name === 'Parameters/Mesh')!
      mesh.values = [2]
      mesh.label = 'Updated by GetDP'
      native = canonicalizeOnelab(updated)
      return 0
    })
    expect(parseOnelab(result.database).onelab.parameters[1]).toMatchObject({ values: [2], label: 'Updated by GetDP' })
    expect(onelab.set).toHaveBeenCalledTimes(1)
  })
})

describe('ONELAB numerical comparison helpers', () => {
  it('summarizes scalar and vector data without reducing vectors component-wise', () => {
    expect(summarizeView({
      name: 'v', dataType: 'scalar', numElements: 1, components: 1,
      values: new Float64Array([0, 1, 2]),
    })).toEqual({ min: 0, max: 2, mean: 1, samples: 3 })
    expect(summarizeView({
      name: 'e', dataType: 'vector', numElements: 1, components: 3,
      values: new Float64Array([3, 4, 0, 0, 0, 2]),
    })).toEqual({ min: 2, max: 5, mean: 3.5, samples: 2 })
  })

  it('uses combined absolute and relative tolerance', () => {
    expect(withinTolerance(1.000001, 1, 1e-8, 1e-5)).toBe(true)
    expect(withinTolerance(1.001, 1, 1e-8, 1e-5)).toBe(false)
  })
})

describe('fail-closed convergence certification', () => {
  const fixed = {
    linear: { absoluteTolerance: 1e-8, relativeTolerance: 1e-6, residualCount: 2 },
    structure: { kind: 'fixed', groups: [{ kind: 'linear', systemName: 'Sys_A' }] },
  } satisfies ConvergenceCriteria
  const solve = (system: string, initial: string, final: string, reason = '') => [
    `Info : System '${system}' : Real`, `Info : Solve[${system}]`, `Info : 0 KSP Residual norm ${initial}`, `Info : 1 KSP Residual norm ${final}`, reason,
  ].filter(Boolean)
  const pinnedReasons = [
    [-12, 'DIVERGED_USER', 'diverged'], [-11, 'DIVERGED_PC_FAILED', 'diverged'], [-10, 'DIVERGED_INDEFINITE_MAT', 'diverged'],
    [-9, 'DIVERGED_NANORINF', 'diverged'], [-8, 'DIVERGED_INDEFINITE_PC', 'diverged'], [-7, 'DIVERGED_NONSYMMETRIC', 'diverged'],
    [-6, 'DIVERGED_BREAKDOWN_BICG', 'diverged'], [-5, 'DIVERGED_BREAKDOWN', 'diverged'], [-4, 'DIVERGED_DTOL', 'diverged'],
    [-3, 'DIVERGED_ITS', 'diverged'], [-2, 'DIVERGED_NULL', 'diverged'], [0, 'CONVERGED_ITERATING', 'iterating'],
    [1, 'CONVERGED_RTOL_NORMAL_EQUATIONS', 'converged'], [2, 'CONVERGED_RTOL', 'converged'], [3, 'CONVERGED_ATOL', 'converged'],
    [4, 'CONVERGED_ITS', 'converged'], [5, 'CONVERGED_NEG_CURVE', 'converged'], [6, 'CONVERGED_STEP_LENGTH', 'converged'],
    [7, 'CONVERGED_HAPPY_BREAKDOWN', 'converged'], [8, 'CONVERGED_USER', 'converged'], [9, 'CONVERGED_ATOL_NORMAL_EQUATIONS', 'converged'],
  ] as const

  it('rejects residual decrease without convergence, missing reason evidence, divergence and NaN', () => {
    const decrease = certifyConvergence(solve('Sys_A', '10', '1'), fixed, {})
    expect(decrease.converged).toBe(false)
    expect(decrease.issues).toContain('Sys_A solve 1 did not meet PETSc reason or residual criteria')
    const missing = certifyConvergence(solve('Sys_A', '1', '0.01'), fixed, {})
    expect(missing.converged).toBe(false)
    const diverged = certifyConvergence(solve('Sys_A', '1', '1e-12', 'Info : KSP Diverged reason -3'), fixed, {})
    expect(diverged.groups[0]).toMatchObject({ reason: -3, converged: false })
    expect(diverged.converged).toBe(false)
    const conflicting = certifyConvergence([...solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason 4'), 'Info : Linear solve diverged due to DIVERGED_BREAKDOWN'], fixed, {})
    expect(conflicting.issues).toContain('Sys_A solve 1 has conflicting PETSc reason evidence')
    expect(conflicting.converged).toBe(false)
    const nan = certifyConvergence(solve('Sys_A', '1', 'NaN'), fixed, {})
    expect(nan.issues).toContain('Sys_A solve 1 has non-finite or negative residual evidence')
    expect(nan.converged).toBe(false)
  })

  it('rejects partial, malformed and non-finite numeric tokens', () => {
    for (const token of ['1e-12junk', '1e-', 'NaN', 'Inf', '-Infinity', '1e999']) {
      const certification = certifyConvergence(solve('Sys_A', '1', token), fixed, {})
      expect(certification.converged, token).toBe(false)
    }
    const partialReason = certifyConvergence(solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason 4junk'), fixed, {})
    expect(partialReason.issues).toContain('malformed numeric PETSc reason evidence: Info : KSP Converged reason 4junk')
    expect(partialReason.converged).toBe(false)
    for (const token of ['NaN', 'Inf', '999999999999999999999999999999']) {
      expect(certifyConvergence(solve('Sys_A', '1', '1e-12', `Info : KSP Converged reason ${token}`), fixed, {}).converged, token).toBe(false)
    }
    const malformedNonlinear = certifyConvergence([...solve('Sys_A', '1', '1e-12'), 'Info : Residual 000: abs 1e-12junk rel 1e-12'], fixed, {})
    expect(malformedNonlinear.issues).toContain('malformed nonlinear residual evidence: Info : Residual 000: abs 1e-12junk rel 1e-12')
    expect(malformedNonlinear.converged).toBe(false)
  })

  it('rejects repeated and cross-form PETSc reason contradictions', () => {
    const numeric = certifyConvergence([...solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason: 4'), 'Info : KSP Diverged reason = -3'], fixed, {})
    expect(numeric.issues).toContain('Sys_A solve 1 has conflicting numeric PETSc reasons')
    const named = certifyConvergence([...solve('Sys_A', '1', '1e-12', 'Info : Linear solve converged due to CONVERGED_RTOL'), 'Info : Linear solve diverged due to DIVERGED_BREAKDOWN'], fixed, {})
    expect(named.issues).toContain('Sys_A solve 1 has conflicting named PETSc reasons')
    const crossForm = certifyConvergence([...solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason: 4'), 'Info : Linear solve diverged due to DIVERGED_BREAKDOWN'], fixed, {})
    expect(crossForm.issues).toContain('Sys_A solve 1 has conflicting PETSc reason evidence')
    const mislabeled = certifyConvergence(solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason: -3'), fixed, {})
    expect(mislabeled.issues).toContain('Sys_A solve 1 has invalid numeric PETSc reason evidence')
    expect([numeric, named, crossForm, mislabeled].every(({ converged }) => !converged)).toBe(true)
  })

  it('uses the complete pinned PETSc reason table without sign or prefix inference', () => {
    for (const [code, name, outcome] of pinnedReasons) {
      const numericLabel = outcome === 'diverged' ? 'Diverged' : 'Converged'
      const namedLabel = outcome === 'diverged' ? 'did not converge' : 'converged'
      const certification = certifyConvergence([...solve('Sys_A', '1', '1e-12', `Info : KSP ${numericLabel} reason: ${code}`), `Info : Linear solve ${namedLabel} due to ${name} iterations 1`], fixed, {})
      expect(certification.converged, `${code}:${name}`).toBe(outcome === 'converged')
    }
  })

  it('fails closed for unknown reasons and requires exact numeric/name mapping', () => {
    const cases = [
      solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason: 999'),
      solve('Sys_A', '1', '1e-12', 'Info : KSP Diverged reason: -999'),
      [...solve('Sys_A', '1', '1e-12'), 'Info : Linear solve converged due to CONVERGED_BOGUS iterations 1'],
      [...solve('Sys_A', '1', '1e-12'), 'Info : Linear solve converged due to CONVERGED_RTOL_NORMAL iterations 1'],
      [...solve('Sys_A', '1', '1e-12', 'Info : KSP Converged reason: 2'), 'Info : Linear solve converged due to CONVERGED_ATOL iterations 1'],
    ]
    for (const lines of cases) expect(certifyConvergence(lines, fixed, {}).converged).toBe(false)
    expect(certifyConvergence(cases.at(-1)!, fixed, {}).issues).toContain('Sys_A solve 1 has conflicting PETSc reason evidence')
  })

  it('accepts complete residual and reason tokens with valid whitespace and punctuation', () => {
    const numeric = certifyConvergence([
      "Info : System 'Sys_A' : Real", 'Info : Solve[Sys_A]', '\x1b[34mInfo : 0 KSP Residual norm   +1.0e+0 \x1b[0m', 'Info : 1 KSP Residual norm .1e-11\t', 'Info : KSP Converged reason \t = 4  ',
    ], fixed, {})
    expect(numeric.converged).toBe(true)
    const named = certifyConvergence([...solve('Sys_A', '1', '1e-12'), 'Info : Linear solve converged due to CONVERGED_RTOL iterations 1   '], fixed, {})
    expect(named.converged).toBe(true)
    expect(certifyConvergence([solve('Sys_A', '1', '1e-12').join('\n')], fixed, {}).converged).toBe(true)
  })

  it('accepts explicit PETSc convergence and validates fixed multiple-system structure', () => {
    const criteria = {
      ...fixed,
      structure: { kind: 'fixed', groups: [{ kind: 'linear', systemName: 'Sys_Proj' }, { kind: 'linear', systemName: 'Sys_Wav' }] },
    } satisfies ConvergenceCriteria
    const certification = certifyConvergence([
      ...solve('Sys_Proj', '2', '0', 'Info : KSP Converged reason: 4'),
      ...solve('Sys_Wav', '5e8', '7e-6', 'Info : Linear solve converged due to CONVERGED_ATOL'),
    ], criteria, {})
    expect(certification.converged).toBe(true)
    expect(certification.groups).toMatchObject([{ reason: 4, converged: true }, { reasonText: 'converged:CONVERGED_ATOL', converged: true }])
  })

  it('derives transient structure from edited parameters and rejects missing edited steps', () => {
    const criteria = {
      linear: fixed.linear,
      structure: { kind: 'transient', systemName: 'Sys_The', endParameter: 'tmax', stepParameter: 'dt' },
    } satisfies ConvergenceCriteria
    const logs = [
      "Info : System 'Sys_The' : Real", 'Info : Theta Time = 2 TimeStep 1', ...solve('Sys_The', '1', '1e-12'),
      'Info : Theta Time = 4 TimeStep 2', ...solve('Sys_The', '2', '1e-12'),
    ]
    expect(certifyConvergence(logs, criteria, { tmax: 4, dt: 2 }).converged).toBe(true)
    const edited = certifyConvergence(logs, criteria, { tmax: 6, dt: 2 })
    expect(edited.converged).toBe(false)
    expect(edited.issues).toContain('transient convergence structure does not contain 3 ordered Sys_The time steps')
  })

  it('requires finite contiguous monotone nonlinear evidence and explicit final criteria', () => {
    const criteria = {
      linear: fixed.linear,
      nonlinear: { absoluteTolerance: 1e-6, relativeTolerance: 1e-6, minIterations: 2, maxIterations: 5 },
      structure: { kind: 'nonlinear', systemName: 'Sys_Mag' },
    } satisfies ConvergenceCriteria
    const iteration = (index: number, absolute: string, relative: string) => [
      ...solve('Sys_Mag', '100', '1e-12'), `Info : Residual ${index.toString().padStart(3, '0')}: abs ${absolute} rel ${relative}`,
    ]
    const valid = certifyConvergence([...iteration(0, '1', '1'), ...iteration(1, '1e-8', '1e-8')], criteria, {})
    expect(valid.converged).toBe(true)
    expect(valid.groups.filter(({ kind }) => kind === 'nonlinear').every(({ converged }) => converged)).toBe(true)
    const weak = certifyConvergence([...iteration(0, '1', '1'), ...iteration(1, '0.1', '0.1')], criteria, {})
    expect(weak.issues).toContain('nonlinear final absolute and relative criteria were not met')
    const nonmonotone = certifyConvergence([...iteration(0, '1', '1'), ...iteration(1, '2', '0.5')], criteria, {})
    expect(nonmonotone.issues).toContain('nonlinear absolute and relative residuals must be monotone')
    const nonfinite = certifyConvergence([...iteration(0, '1', '1'), ...iteration(1, 'NaN', 'NaN')], criteria, {})
    expect(nonfinite.issues).toContain('nonlinear residual evidence is non-finite or negative')
  })
})

describe('ONELAB request cancellation', () => {
  it('cancels only the targeted request and reports collateral requests as worker-restarted', async () => {
    class WorkerStub extends EventTarget {
      static instances: WorkerStub[] = []
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor() { super(); WorkerStub.instances.push(this) }
    }
    vi.stubGlobal('Worker', WorkerStub)
    const client = new OnelabClient()
    const envelope = { schema: 1, action: 'compute', projectId: 'p', revision: 2, files: [], database, defaults: database } as const
    const targeted = client.startProject(envelope)
    const collateral = client.startProject(envelope)

    expect(client.cancel('missing')).toBe(false)
    expect(WorkerStub.instances[0]?.terminate).not.toHaveBeenCalled()
    expect(client.cancel(targeted.requestId)).toBe(true)
    await expect(targeted.promise).rejects.toThrow(`request ${targeted.requestId} cancelled`)
    await expect(collateral.promise).rejects.toThrow(`request ${collateral.requestId} failed because the ONELAB worker restarted`)
    expect(WorkerStub.instances).toHaveLength(2)
    const retry = client.startProject(envelope)
    expect(WorkerStub.instances[1]?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'project', envelope }))
    client.cancel(retry.requestId)
    await expect(retry.promise).rejects.toThrow('cancelled')
    client.dispose()
    vi.unstubAllGlobals()
  })

  it('rejects pending and subsequent requests when disposed', async () => {
    class WorkerStub extends EventTarget {
      postMessage = vi.fn()
      terminate = vi.fn()
    }
    vi.stubGlobal('Worker', WorkerStub)
    const client = new OnelabClient()
    const pending = client.startMicrostrip()
    client.dispose()
    await expect(pending.promise).rejects.toThrow('ONELAB client disposed')
    await expect(client.startMicrostrip().promise).rejects.toThrow('ONELAB client is disposed')
    vi.unstubAllGlobals()
  })
})

describe('ONELAB worker scheduling', () => {
  it('serializes concurrent runs behind one shared initialization', async () => {
    const scheduler = new OnelabWorkerScheduler()
    const events: string[] = []
    let initializations = 0
    let active = 0
    let maximumActive = 0
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const initialize = async () => { initializations++; events.push('initialize') }
    const run = (id: string, gate?: Promise<void>) => scheduler.enqueue(async () => {
      await scheduler.initialize(initialize)
      active++
      maximumActive = Math.max(maximumActive, active)
      events.push(`start-${id}`)
      await gate
      events.push(`end-${id}`)
      active--
      return id
    })

    const first = run('1', firstGate)
    const second = run('2')
    await vi.waitFor(() => expect(events).toEqual(['initialize', 'start-1']))
    expect(initializations).toBe(1)
    releaseFirst()
    await expect(Promise.all([first, second])).resolves.toEqual(['1', '2'])
    expect(events).toEqual(['initialize', 'start-1', 'end-1', 'start-2', 'end-2'])
    expect(maximumActive).toBe(1)
    expect(initializations).toBe(1)
  })
})
