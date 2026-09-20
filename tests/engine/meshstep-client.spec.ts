import { MeshstepClient } from '../../src/simulation/viewer-client'

class WorkerStub extends EventTarget {
  static instances: WorkerStub[] = []
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { super(); WorkerStub.instances.push(this) }
}

describe('MeshstepClient lifecycle', () => {
  beforeEach(() => { WorkerStub.instances = []; vi.stubGlobal('Worker', WorkerStub) })
  afterEach(() => vi.unstubAllGlobals())

  it('rejects pending conversion on worker error', async () => {
    const client = new MeshstepClient()
    const pending = client.convertCube()
    WorkerStub.instances[0]!.dispatchEvent(Object.assign(new Event('error'), { message: 'parser crashed' }))
    await expect(pending).rejects.toThrow('parser crashed')
    expect(WorkerStub.instances[0]!.terminate).toHaveBeenCalledOnce()
    client.dispose()
  })

  it('rejects active import and later requests when route disposal terminates the worker', async () => {
    const client = new MeshstepClient()
    const pending = client.convertCube()
    client.dispose()
    await expect(pending).rejects.toThrow('disposed during conversion')
    await expect(client.convertCube()).rejects.toThrow('is disposed')
    expect(WorkerStub.instances[0]!.terminate).toHaveBeenCalledOnce()
  })

  it('posts convert-step with the provided source text', async () => {
    const client = new MeshstepClient()
    const pending = client.convertStep('ISO-10303-21;')
    expect(WorkerStub.instances[0]!.postMessage).toHaveBeenCalledWith({ type: 'convert-step', requestId: '1', source: 'ISO-10303-21;' })
    client.dispose()
    await expect(pending).rejects.toThrow('disposed during conversion')
  })
})
