import { registerAwesomePhysicsAdapterFactory } from '../registries/awesomePhysicsRegistry'
import {
  awesomePhysicsAdapterFactoryMap,
  type LazyAwesomePhysicsAdapterFactoryV1,
} from './adapterFactories'

let activeCleanup: (() => void) | null = null

/**
 * Catalog surfaces call this explicitly when they need runnable adapters.
 * Importing this module never imports an adapter kernel.
 */
export function registerAwesomePhysicsAdapters(): () => void {
  if (activeCleanup) return activeCleanup

  const cleanups: Array<() => void> = []
  for (const [adapterId, factory] of awesomePhysicsAdapterFactoryMap) {
    cleanups.push(registerAwesomePhysicsAdapterFactory(adapterId, factory as LazyAwesomePhysicsAdapterFactoryV1))
  }

  let active = true
  const cleanup = (): void => {
    if (!active) return
    active = false
    for (const unregister of cleanups.reverse()) unregister()
    if (activeCleanup === cleanup) activeCleanup = null
  }
  activeCleanup = cleanup
  return cleanup
}

export function resetAwesomePhysicsAdapterRegistrationsForTests(): void {
  activeCleanup?.()
}
