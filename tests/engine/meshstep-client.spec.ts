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
})
