import { readonly, shallowRef } from 'vue'
import { parseCompletionReport } from '../engine/completionReport'
import type { CompletionReport } from '../types/engine'

export interface CoverageRow {
  key: 'recipes' | 'core' | 'walls'
  label: string
  expected: number
  implemented: number
  evaluated: number
  graphed: number
  simulatable: number
}

const report = shallowRef<CompletionReport | null>(null)
const coverage = shallowRef<CoverageRow[]>([])
const complete = shallowRef(false)
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0

function coverageFromReport(value: CompletionReport): CoverageRow[] {
  return [
    {
      key: 'recipes',
      label: 'Formula recipes',
      expected: value.recipes.source,
      implemented: value.recipes.implemented,
      evaluated: value.recipes.evaluated ?? 0,
      graphed: value.recipes.graphed,
      simulatable: value.recipes.simulatable ?? 0,
    },
    {
      key: 'core',
      label: 'Core cases',
      expected: value.core.source,
      implemented: value.core.implemented,
      evaluated: value.core.evaluated ?? 0,
      graphed: value.core.graphed,
      simulatable: value.core.simulatable ?? 0,
    },
    {
      key: 'walls',
      label: 'Number-wall inputs',
      expected: value.walls.source,
      implemented: value.walls.implemented,
      evaluated: value.walls.evaluated ?? 0,
      graphed: value.walls.graphed,
      simulatable: value.walls.simulatable ?? 0,
    },
  ]
}

function setReport(value: CompletionReport | null): void {
  report.value = value
  coverage.value = value ? coverageFromReport(value) : []
  complete.value = value?.complete === true && value.errors.length === 0 && value.unresolved.length === 0
}

async function initialize(): Promise<void> {
  if (initialization) return initialization
  const attempt = ++generation
  const attemptController = new AbortController()
  controller = attemptController
  let successful = false
  const pending = Promise.resolve().then(async () => {
    ready.value = false
    error.value = null
    setReport(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/generated/completion.json`, { signal: attemptController.signal })
      if (!response.ok) throw new Error(`Completion report failed to load (${response.status})`)
      const next = parseCompletionReport(await response.json())
      if (attempt !== generation) return
      setReport(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      setReport(null)
      if (attemptController.signal.aborted) {
        ready.value = false
        error.value = null
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        ready.value = true
      }
    } finally {
      if (attempt === generation) {
        controller = null
        if (!successful) initialization = null
      }
    }
  })
  initialization = pending
  return pending
}

export function useCompletionRegistry() {
  return {
    report: readonly(report),
    coverage: readonly(coverage),
    complete: readonly(complete),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
  }
}

export function setCompletionRegistryForTests(value: CompletionReport | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  setReport(null)
  ready.value = false
  error.value = null
  if (!value) return
  try {
    setReport(parseCompletionReport(value))
    ready.value = true
    initialization = Promise.resolve()
  } catch (reason) {
    error.value = reason instanceof Error ? reason : new Error(String(reason))
    ready.value = true
  }
}

export function resetCompletionRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  setReport(null)
  ready.value = false
  error.value = null
  initialization = null
}
