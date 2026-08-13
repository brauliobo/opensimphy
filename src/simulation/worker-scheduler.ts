export class OnelabWorkerScheduler {
  private initialization: Promise<void> | undefined
  private queue = Promise.resolve()

  initialize(start: () => Promise<void>) {
    if (!this.initialization) {
      this.initialization = start().catch((error) => {
        this.initialization = undefined
        throw error
      })
    }
    return this.initialization
  }

  enqueue<T>(task: () => Promise<T>) {
    const result = this.queue.then(task)
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}
