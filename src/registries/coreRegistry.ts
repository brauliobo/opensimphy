import { readonly, shallowRef } from 'vue'
import type { CoreEvaluation } from '../engine/core'
import type { PlotFigure } from '../types/plot'
import type { CoreWorkerResponse } from '../types/workers'
import CoreWorker from '../workers/core.worker?worker'
import { clearRuntimeAuditDomain, publishRuntimeAudit } from './runtimeAudit'

export const EXPECTED_CORE_CASES = 37

export interface CoreRecord {
  id: string
  title: string
  family: string
  description: string
  graphs: Array<{ id: string; label: string; figure: PlotFigure }>
  graphReady: boolean
  formula?: string
  result?: string
  residual?: string
  sourceUrl?: string
  provenance?: string
}

const coreCases = shallowRef<CoreRecord[]>([])
const ready = shallowRef(false)
const error = shallowRef<Error | null>(null)
let initialization: Promise<void> | null = null
let controller: AbortController | null = null
let generation = 0
let owners = 0
let ownershipGeneration = 0

function scientific(value: number): string {
  if (value === 0) return '0'
  return value.toExponential(12)
}

export function coreFromEvaluation(evaluation: CoreEvaluation): CoreRecord {
  const sweep: PlotFigure = {
    data: [{
      x: evaluation.graph.map((point) => point.x),
      y: evaluation.graph.map((point) => point.y),
      customdata: evaluation.graph.map((point) => [point.magnitude, point.log10Abs]),
      type: 'scatter',
      mode: 'lines+markers',
      name: evaluation.title,
      line: { color: '#63cbd1', width: 2 },
      marker: { color: '#e6b85c', size: 4 },
      hovertemplate: 'parameter %{x:.4f}<br>metric %{y:.8e}<br>|metric| %{customdata[0]:.8e}<extra></extra>',
    }],
    layout: {
      xaxis: { title: { text: 'case parameter / scale' } },
      yaxis: { title: { text: 'engine metric' } },
    },
  }
  const graphs: CoreRecord['graphs'] = [{ id: 'sweep-2d', label: '2D parameter sweep', figure: sweep }]
  if (evaluation.surface.length > 0) {
    const isPlanckSurface = evaluation.id.startsWith('planck-')
    graphs.push({
      id: 'complex-surface-3d',
      label: isPlanckSurface ? '3D complex magnitude' : '3D root locus',
      figure: {
        data: [{
          x: evaluation.surface.map((point) => point.x),
          y: evaluation.surface.map((point) => isPlanckSurface ? point.y : point.real),
          z: evaluation.surface.map((point) => isPlanckSurface ? point.magnitude : point.imaginary),
          type: 'mesh3d',
          intensity: evaluation.surface.map((point) => point.magnitude),
          colorscale: [[0, '#213c42'], [0.5, '#63cbd1'], [1, '#e6b85c']],
          showscale: true,
          name: evaluation.title,
          hovertemplate: isPlanckSurface
            ? 'Re(z) %{x:.3f}<br>Im(z) %{y:.3f}<br>|S(z)| %{z:.6e}<extra></extra>'
            : 'parameter %{x:.3f}<br>Re(root) %{y:.6f}<br>Im(root) %{z:.6f}<extra></extra>',
        }],
        layout: {
          scene: {
            xaxis: { title: { text: isPlanckSurface ? 'Re(z)' : 'parameter' } },
            yaxis: { title: { text: isPlanckSurface ? 'Im(z)' : 'Re(root)' } },
            zaxis: { title: { text: isPlanckSurface ? '|S(z)|' : 'Im(root)' } },
          },
        },
      },
    })
  }
  return {
    id: evaluation.id,
    title: evaluation.title,
    family: evaluation.category,
    description: `${evaluation.formula} [${evaluation.provenance}]`,
    graphs,
    graphReady: evaluation.graphReady && graphs.length > 0,
    formula: evaluation.formula,
    result: JSON.stringify(evaluation.result),
    residual: evaluation.residual === null ? 'not applicable' : scientific(evaluation.residual),
    sourceUrl: evaluation.sourceUrl,
    provenance: evaluation.provenance,
  }
}

function evaluateInWorker(signal: AbortSignal): Promise<CoreEvaluation[]> {
  if (signal.aborted) return Promise.reject(new DOMException('Core evaluation was cancelled', 'AbortError'))
  const worker = new CoreWorker()
  const requestId = `core-${Date.now()}`
  return new Promise((resolve, reject) => {
    const stop = () => {
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => {
      stop()
      reject(new DOMException('Core evaluation was cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    worker.addEventListener('error', (event) => {
      stop()
      reject(new Error(event.message || 'Core worker failed'))
    }, { once: true })
    worker.addEventListener('message', (event: MessageEvent<CoreWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestId) return
      stop()
      if (response.type === 'error') reject(new Error(response.error))
      else if (response.type === 'cancelled') reject(new DOMException('Core evaluation was cancelled', 'AbortError'))
      else resolve(response.result)
    })
    worker.postMessage({ type: 'evaluate-core', requestId })
  })
}

function publishSuccess(items: CoreRecord[]): void {
  publishRuntimeAudit({
    core: {
      status: 'ready',
      expected: EXPECTED_CORE_CASES,
      evaluated: items.length,
      graphed: items.filter(({ graphReady }) => graphReady).length,
    },
  })
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
    coreCases.value = []
    clearRuntimeAuditDomain('core')
    try {
      const evaluations = await evaluateInWorker(attemptController.signal)
      if (evaluations.length !== EXPECTED_CORE_CASES) throw new Error(`Core registry evaluated ${evaluations.length}/${EXPECTED_CORE_CASES} cases`)
      const next = evaluations.map(coreFromEvaluation)
      if (next.some(({ graphReady }) => !graphReady)) throw new Error('Core registry did not produce every required graph')
      if (attempt !== generation) return
      coreCases.value = next
      publishSuccess(next)
      ready.value = true
      successful = true
    } catch (reason) {
      if (attempt !== generation) return
      coreCases.value = []
      if (attemptController.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) {
        ready.value = false
        error.value = null
        clearRuntimeAuditDomain('core')
      } else {
        error.value = reason instanceof Error ? reason : new Error(String(reason))
        publishRuntimeAudit({ core: { status: 'error', error: error.value.message } })
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

async function coreCaseById(id: string): Promise<CoreRecord | null> {
  await initialize()
  return coreCases.value.find((item) => item.id === id) ?? null
}

export function useCoreRegistry() {
  return {
    coreCases: readonly(coreCases),
    ready: readonly(ready),
    error: readonly(error),
    initialize,
    acquire,
    coreCaseById,
  }
}

function acquire(): () => void {
  owners += 1
  ownershipGeneration += 1
  void initialize()
  let released = false
  return () => {
    if (released) return
    released = true
    owners = Math.max(0, owners - 1)
    const releaseGeneration = ++ownershipGeneration
    queueMicrotask(() => {
      if (owners === 0 && ownershipGeneration === releaseGeneration && initialization && !ready.value) controller?.abort()
    })
  }
}

export function setCoreRegistryForTests(value: CoreRecord[] | null): void {
  generation += 1
  controller?.abort()
  controller = null
  initialization = null
  owners = 0
  ownershipGeneration += 1
  coreCases.value = []
  ready.value = false
  error.value = null
  clearRuntimeAuditDomain('core')
  if (!value) return
  coreCases.value = value
  publishSuccess(value)
  ready.value = true
  initialization = Promise.resolve()
}

export function resetCoreRegistryForTests(): void {
  generation += 1
  controller?.abort()
  controller = null
  owners = 0
  ownershipGeneration += 1
  coreCases.value = []
  ready.value = false
  error.value = null
  initialization = null
  clearRuntimeAuditDomain('core')
}
