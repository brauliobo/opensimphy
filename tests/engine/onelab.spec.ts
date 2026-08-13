import { summarizeView, withinTolerance } from '../../src/simulation/reference'
import { OnelabClient } from '../../src/simulation/client'
import { OnelabWorkerScheduler } from '../../src/simulation/worker-scheduler'
import { callGetdpWithDatabase, canonicalizeOnelab, mergeValidatedValues, parameterChanged, parseOnelab, restoreReadOnlyValues, setParameterValue, validateEnvelopeValues, validateReadOnlyValues } from '../../src/simulation/onelab-db'
import { ProjectSession } from '../../src/simulation/project-session'
import { canonicalMshRecords } from '../../src/simulation/msh'

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
    expect(envelope).toMatchObject({ schema: 1, projectId: 'project-1', revision: 1, action: 'compute', database: session.database, defaults: database })
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
