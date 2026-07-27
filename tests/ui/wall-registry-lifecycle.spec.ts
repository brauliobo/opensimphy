import { vi } from 'vitest'
import { wall } from './fixtures'

const workerModule = vi.hoisted(() => {
  let resolve!: () => void
  const ready = new Promise<void>((done) => { resolve = done })
  return { ready, resolve, requested: false, constructions: 0 }
})

vi.mock('../../src/engine/numberWall', () => ({
  loadWallPayload: vi.fn(async () => ({ id: 'catalan', title: 'Catalan', kind: 'terms', sequence: ['1', '1', '2', '5'] })),
}))

vi.mock('../../src/workers/numberWall.worker?worker', async () => {
  workerModule.requested = true
  await workerModule.ready
  return {
    default: class NumberWallWorkerMock {
      constructor() {
        workerModule.constructions += 1
      }

      addEventListener(): void {}
      postMessage(): void {}
      terminate(): void {}
    },
  }
})

import { resetWallRegistryForTests, setWallRegistryForTests, useWallRegistry } from '../../src/registries/wallRegistry'

describe('number-wall registry cancellation', () => {
  afterEach(() => {
    resetWallRegistryForTests()
  })

  it('settles AbortError without constructing a worker when aborted during dynamic import', async () => {
    setWallRegistryForTests([wall])
    const controller = new AbortController()
    const progress: number[] = []
    const pending = useWallRegistry().runWall(wall, {
      depth: 3,
      width: 4,
      mode: 'signed_log',
      modulus: 7,
    }, controller.signal, (value) => progress.push(value))
    await vi.waitFor(() => expect(workerModule.requested).toBe(true))

    controller.abort()
    workerModule.resolve()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(workerModule.constructions).toBe(0)
    expect(progress).toEqual([5, 15])
  })
})
