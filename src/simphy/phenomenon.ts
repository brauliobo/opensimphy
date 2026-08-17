export interface DelegatedKernel<TInput = unknown, TOutput = unknown> {
  readonly id: string
  run(input: TInput, signal?: AbortSignal): TOutput | Promise<TOutput>
}

export interface PhenomenonSpec<TInput = unknown, TOutput = unknown> {
  readonly id: string
  readonly title: string
  readonly kernel: DelegatedKernel<TInput, TOutput>
}

export interface PhenomenonCatalog {
  get(id: string): PhenomenonSpec | null
  list(): readonly PhenomenonSpec[]
}

export function phenomenonCatalog(specs: readonly PhenomenonSpec[]): PhenomenonCatalog {
  const byId = new Map(specs.map((spec) => [spec.id, spec]))
  return {
    get: (id) => byId.get(id) ?? null,
    list: () => specs,
  }
}
