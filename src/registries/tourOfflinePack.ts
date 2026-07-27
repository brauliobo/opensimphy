import { readonly, shallowRef } from 'vue'
import type { TourGeneratedManifest } from '../types/tour'
import { validateTourOfflinePackResources } from './tourRegistry'
import {
  clearTourOfflinePacks,
  inspectTourOfflinePack,
  installTourOfflinePack,
  type TourOfflinePackEnvironment,
} from '../tour/offlinePack'

export type TourOfflinePackStatus = 'idle' | 'installing' | 'installed' | 'error'

const status = shallowRef<TourOfflinePackStatus>('idle')
const revision = shallowRef<string | null>(null)
const itemCount = shallowRef(0)
const bytes = shallowRef(0)
const error = shallowRef<Error | null>(null)
let environment: TourOfflinePackEnvironment = {}
let operationGeneration = 0
let operationQueue: Promise<void> = Promise.resolve()
let activeDownload: AbortController | null = null

function resetState(): void {
  status.value = 'idle'
  revision.value = null
  itemCount.value = 0
  bytes.value = 0
  error.value = null
}

function publishInstalled(installed: Awaited<ReturnType<typeof inspectTourOfflinePack>>): void {
  if (!installed) {
    resetState()
    return
  }
  status.value = 'installed'
  revision.value = installed.metadata.revision
  itemCount.value = installed.metadata.urls.length
  bytes.value = installed.metadata.bytes
  error.value = null
}

function validatedEnvironment(): TourOfflinePackEnvironment {
  return { ...environment, validateResources: validateTourOfflinePackResources }
}

function enqueue(operation: () => Promise<void>): Promise<void> {
  const pending = operationQueue.then(operation, operation)
  operationQueue = pending.catch(() => {})
  return pending
}

async function hydrate(manifest: TourGeneratedManifest): Promise<void> {
  const attempt = ++operationGeneration
  return enqueue(async () => {
    try {
      const installed = await inspectTourOfflinePack(manifest.contentRevision, validatedEnvironment())
      if (attempt === operationGeneration) publishInstalled(installed)
    } catch (reason) {
      if (attempt !== operationGeneration) return
      resetState()
      status.value = 'error'
      error.value = reason instanceof Error ? reason : new Error(String(reason))
    }
  })
}

async function download(manifest: TourGeneratedManifest): Promise<void> {
  const attempt = ++operationGeneration
  status.value = 'installing'
  error.value = null
  return enqueue(async () => {
    if (attempt !== operationGeneration) return
    const controller = new AbortController()
    activeDownload = controller
    try {
      const installed = await installTourOfflinePack(manifest, validatedEnvironment(), controller.signal)
      if (attempt === operationGeneration) publishInstalled(installed)
    } catch (reason) {
      if (attempt !== operationGeneration) return
      status.value = 'error'
      error.value = reason instanceof Error ? reason : new Error(String(reason))
    } finally {
      if (activeDownload === controller) activeDownload = null
    }
  })
}

async function clear(): Promise<void> {
  const attempt = ++operationGeneration
  activeDownload?.abort()
  return enqueue(async () => {
    try {
      await clearTourOfflinePacks(validatedEnvironment())
      if (attempt === operationGeneration) resetState()
    } catch (reason) {
      if (attempt !== operationGeneration) return
      status.value = 'error'
      error.value = reason instanceof Error ? reason : new Error(String(reason))
    }
  })
}

export function useTourOfflinePack() {
  return {
    status: readonly(status),
    revision: readonly(revision),
    itemCount: readonly(itemCount),
    bytes: readonly(bytes),
    error: readonly(error),
    download,
    clear,
    hydrate,
  }
}

export function setTourOfflinePackDependenciesForTests(next: TourOfflinePackEnvironment): void {
  environment = next
}

export function resetTourOfflinePackForTests(): void {
  operationGeneration += 1
  activeDownload?.abort()
  activeDownload = null
  environment = {}
  resetState()
}
