import type {
  AwesomePhysicsAdapterFactoryV1,
  AwesomePhysicsAdapterV1,
  AwesomePhysicsSimulationDescriptorV1,
} from '../../../types/awesomePhysics'

/**
 * Bounded educational reimplementation of the local particle-clicker model.
 * The upstream checkout is provenance only; this module imports no upstream
 * code, fonts, icons, or other assets.
 */

export const PARTICLE_CLICKER_CATALOG_ITEM_ID = 'awesome-particle-clicker' as const
export const PARTICLE_CLICKER_DESCRIPTOR_ID = 'awesome-particle-clicker-capability' as const
export const PARTICLE_CLICKER_ADAPTER_ID = 'awesome-particle-clicker-browser-v1' as const
export const PARTICLE_CLICKER_MODEL = 'particle-clicker-bounded-progression-v1' as const
export const PARTICLE_CLICKER_SOURCE_REVISION = 'd6762d54eced' as const

export const PARTICLE_CLICKER_PROVENANCE = Object.freeze({
  sourcePath: 'awesome-physics-repos/particle-clicker',
  sourceRevision: PARTICLE_CLICKER_SOURCE_REVISION,
  modelOrigin: 'bounded-local-reimplementation',
  assetPolicy: 'no-upstream-assets-redistributed',
} as const)

export const PARTICLE_CLICKER_BOUNDS = Object.freeze({
  maxActions: 128,
  maxClicks: 10_000,
  maxUpgradePurchases: 64,
  maxWorkerHires: 256,
  maxElapsedSeconds: 86_400,
  maxParticles: 1_000_000_000_000_000,
  maxFunding: 1_000_000_000_000_000,
  maxReputation: 1_000_000_000,
  maxDetectorPower: 1_000_000_000,
  maxProductionRate: 10_000_000_000,
  maxOutputBytes: 65_536,
} as const)

export const PARTICLE_CLICKER_WORKER_IDS = Object.freeze([
  'workers-masterstudents',
  'workers-phdstudents',
  'workers-postdocs',
  'workers-fellows',
  'workers-permanent',
  'workers-profs',
  'workers-nobel',
  'workers-summies',
] as const)

export type ParticleClickerWorkerId = typeof PARTICLE_CLICKER_WORKER_IDS[number]

export interface ParticleClickerWorkerDefinition {
  readonly id: ParticleClickerWorkerId
  readonly baseCost: number
  readonly costIncrease: number
  readonly rate: number
}

export const PARTICLE_CLICKER_WORKERS: readonly ParticleClickerWorkerDefinition[] = Object.freeze([
  Object.freeze({ id: 'workers-masterstudents', baseCost: 40, costIncrease: 1.5, rate: 1 }),
  Object.freeze({ id: 'workers-phdstudents', baseCost: 600, costIncrease: 1.45, rate: 8 }),
  Object.freeze({ id: 'workers-postdocs', baseCost: 7_500, costIncrease: 1.4, rate: 25 }),
  Object.freeze({ id: 'workers-fellows', baseCost: 80_000, costIncrease: 1.35, rate: 100 }),
  Object.freeze({ id: 'workers-permanent', baseCost: 700_000, costIncrease: 1.3, rate: 9_000 }),
  Object.freeze({ id: 'workers-profs', baseCost: 5_000_000, costIncrease: 1.25, rate: 120_000 }),
  Object.freeze({ id: 'workers-nobel', baseCost: 30_000_000, costIncrease: 1.2, rate: 1_500_000 }),
  Object.freeze({ id: 'workers-summies', baseCost: 125_000_000, costIncrease: 1.15, rate: 20_000_000 }),
] as const satisfies readonly ParticleClickerWorkerDefinition[])

export const PARTICLE_CLICKER_UPGRADE_IDS = Object.freeze([
  'upgrade-energy1',
  'upgrade-energy2',
  'upgrade-energy3',
  'upgrade-lumi1',
  'upgrade-lumi2',
  'upgrade-lumi3',
  'upgrade-sps',
] as const)

export type ParticleClickerUpgradeId = typeof PARTICLE_CLICKER_UPGRADE_IDS[number]
type ParticleClickerUpgradeEffect = 'detector-multiplier' | 'detector-bonus'

export interface ParticleClickerUpgradeDefinition {
  readonly id: ParticleClickerUpgradeId
  readonly cost: number
  readonly effect: ParticleClickerUpgradeEffect
  readonly amount: number
  readonly prerequisites: readonly ParticleClickerUpgradeId[]
}

export const PARTICLE_CLICKER_UPGRADES: readonly ParticleClickerUpgradeDefinition[] = Object.freeze([
  Object.freeze({ id: 'upgrade-energy1', cost: 200, effect: 'detector-multiplier', amount: 2, prerequisites: Object.freeze([]) }),
  Object.freeze({ id: 'upgrade-energy2', cost: 2_000, effect: 'detector-multiplier', amount: 2, prerequisites: Object.freeze(['upgrade-energy1']) }),
  Object.freeze({ id: 'upgrade-energy3', cost: 20_000, effect: 'detector-multiplier', amount: 2, prerequisites: Object.freeze(['upgrade-energy2']) }),
  Object.freeze({ id: 'upgrade-lumi1', cost: 800, effect: 'detector-bonus', amount: 3, prerequisites: Object.freeze([]) }),
  Object.freeze({ id: 'upgrade-lumi2', cost: 8_000, effect: 'detector-bonus', amount: 15, prerequisites: Object.freeze(['upgrade-energy1']) }),
  Object.freeze({ id: 'upgrade-lumi3', cost: 80_000, effect: 'detector-bonus', amount: 75, prerequisites: Object.freeze(['upgrade-energy2']) }),
  Object.freeze({ id: 'upgrade-sps', cost: 500_000, effect: 'detector-multiplier', amount: 10, prerequisites: Object.freeze(['upgrade-energy3', 'upgrade-lumi3']) }),
] as const satisfies readonly ParticleClickerUpgradeDefinition[])

export interface ParticleClickerInitialState {
  readonly particles?: number
  readonly funding?: number
  readonly reputation?: number
  readonly clicks?: number
  readonly elapsedSeconds?: number
  readonly workers?: Partial<Readonly<Record<ParticleClickerWorkerId, number>>>
  readonly upgrades?: readonly ParticleClickerUpgradeId[]
}

export interface ParticleClickerClickAction {
  readonly type: 'click'
  readonly count: number
}

export interface ParticleClickerAdvanceAction {
  readonly type: 'advance'
  readonly seconds: number
}

export interface ParticleClickerHireWorkerAction {
  readonly type: 'hire-worker'
  readonly workerId: ParticleClickerWorkerId
  readonly count: number
}

export interface ParticleClickerBuyUpgradeAction {
  readonly type: 'buy-upgrade'
  readonly upgradeId: ParticleClickerUpgradeId
}

export type ParticleClickerAction =
  | ParticleClickerClickAction
  | ParticleClickerAdvanceAction
  | ParticleClickerHireWorkerAction
  | ParticleClickerBuyUpgradeAction

export interface ParticleClickerInput {
  readonly initial?: ParticleClickerInitialState
  readonly actions: readonly ParticleClickerAction[]
}

export type ParticleClickerInputV1 = ParticleClickerInput

export interface ParticleClickerState {
  readonly particles: number
  readonly funding: number
  readonly reputation: number
  readonly clicks: number
  readonly elapsedSeconds: number
  readonly detectorPower: number
  readonly productionRate: number
  readonly workers: Readonly<Record<ParticleClickerWorkerId, number>>
  readonly workerCosts: Readonly<Record<ParticleClickerWorkerId, number>>
  readonly upgrades: readonly ParticleClickerUpgradeId[]
}

export type ParticleClickerActionReason =
  | 'applied'
  | 'partially-applied'
  | 'already-purchased'
  | 'insufficient-funding'
  | 'requirements-not-met'

export interface ParticleClickerActionResult {
  readonly index: number
  readonly type: ParticleClickerAction['type']
  readonly applied: boolean
  readonly purchased: number
  readonly particlesAdded: number
  readonly fundingAdded: number
  readonly cost: number
  readonly reason: ParticleClickerActionReason
}

export interface ParticleClickerTotals {
  readonly clicks: number
  readonly upgradesPurchased: number
  readonly workerHires: number
  readonly particlesFromClicks: number
  readonly particlesFromWorkers: number
  readonly fundingFromGrants: number
  readonly fundingSpent: number
}

export interface ParticleClickerOutput {
  readonly schemaVersion: 1
  readonly model: typeof PARTICLE_CLICKER_MODEL
  readonly state: ParticleClickerState
  readonly actions: readonly ParticleClickerActionResult[]
  readonly totals: ParticleClickerTotals
  readonly limits: typeof PARTICLE_CLICKER_BOUNDS
  readonly provenance: typeof PARTICLE_CLICKER_PROVENANCE
}

export type ParticleClickerOutputV1 = ParticleClickerOutput

export type ParticleClickerAdapter = AwesomePhysicsAdapterV1<ParticleClickerInput, ParticleClickerOutput>
export type ParticleClickerAdapterInput = ParticleClickerInput
export type ParticleClickerAdapterOutput = ParticleClickerOutput
export type ParticleClickerAdapterFactory = AwesomePhysicsAdapterFactoryV1<ParticleClickerInput, ParticleClickerOutput>

interface MutableParticleClickerState {
  particles: number
  funding: number
  reputation: number
  clicks: number
  elapsedSeconds: number
  detectorPower: number
  productionRate: number
  workers: Record<ParticleClickerWorkerId, number>
  workerCosts: Record<ParticleClickerWorkerId, number>
  upgrades: ParticleClickerUpgradeId[]
}

interface MutableParticleClickerTotals {
  clicks: number
  upgradesPurchased: number
  workerHires: number
  particlesFromClicks: number
  particlesFromWorkers: number
  fundingFromGrants: number
  fundingSpent: number
}

type JsonRecord = Record<string, unknown>

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const GRANT_FACTOR = 5

function fail(path: string, message: string): never {
  throw new TypeError(`Particle Clicker ${path} ${message}`)
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function assertJsonSafe(value: unknown, path: string, ancestors = new WeakSet<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'must contain only finite numbers')
    return
  }
  if (!isObject(value)) fail(path, 'must be JSON-safe')
  if (ancestors.has(value)) fail(path, 'must not contain cycles')

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail(path, 'arrays must use the standard array prototype')
      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1 || !keys.includes('length')) fail(path, 'arrays must not contain extra properties')
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'must not be sparse')
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${path}[${index}]`, 'must be a data property')
        assertJsonSafe(descriptor.value, `${path}[${index}]`, ancestors)
      }
      return
    }

    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      fail(path, 'objects must use a plain object prototype')
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail(path, 'must not contain symbol keys')
      if (UNSAFE_KEYS.has(key)) fail(`${path}.${key}`, 'uses an unsafe key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(`${path}.${key}`, 'must be an enumerable data property')
      assertJsonSafe(descriptor.value, `${path}.${key}`, ancestors)
    }
  } finally {
    ancestors.delete(value)
  }
}

function asRecord(value: unknown, path: string): JsonRecord {
  if (!isObject(value) || Array.isArray(value)) fail(path, 'must be a plain object')
  return value as JsonRecord
}

function exactKeys(value: JsonRecord, required: readonly string[], optional: readonly string[], path: string): void {
  const allowed = new Set([...required, ...optional])
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function nonNegativeFinite(value: unknown, path: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`Particle Clicker ${path} must be finite and within [0, ${maximum}]`)
  }
  return value
}

function safeInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`Particle Clicker ${path} must be a safe integer within [${minimum}, ${maximum}]`)
  }
  return value
}

function knownId<T extends string>(value: unknown, ids: readonly T[], path: string): T {
  if (typeof value !== 'string' || !ids.includes(value as T)) fail(path, 'has an unsupported value')
  return value as T
}

function countRecord<T extends string>(ids: readonly T[]): Record<T, number> {
  return Object.fromEntries(ids.map((id) => [id, 0])) as Record<T, number>
}

function optionalField(object: JsonRecord, key: string, defaultValue: unknown): unknown {
  return Object.hasOwn(object, key) ? object[key] : defaultValue
}

function workerDefinition(id: ParticleClickerWorkerId): ParticleClickerWorkerDefinition {
  const definition = PARTICLE_CLICKER_WORKERS.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Particle Clicker worker definition is missing: ${id}`)
  return definition
}

function upgradeDefinition(id: ParticleClickerUpgradeId): ParticleClickerUpgradeDefinition {
  const definition = PARTICLE_CLICKER_UPGRADES.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Particle Clicker upgrade definition is missing: ${id}`)
  return definition
}

function nextWorkerCost(cost: number, definition: ParticleClickerWorkerDefinition): number {
  const next = Math.floor(cost * definition.costIncrease)
  if (!Number.isFinite(next)) throw new RangeError('Particle Clicker worker cost became non-finite')
  return Math.min(PARTICLE_CLICKER_BOUNDS.maxFunding, next)
}

function computeProductionRate(state: MutableParticleClickerState): number {
  const rate = PARTICLE_CLICKER_WORKERS.reduce(
    (total, definition) => total + state.workers[definition.id] * definition.rate,
    0,
  )
  if (!Number.isFinite(rate) || rate > PARTICLE_CLICKER_BOUNDS.maxProductionRate) {
    throw new RangeError(`Particle Clicker production rate exceeded ${PARTICLE_CLICKER_BOUNDS.maxProductionRate}`)
  }
  return rate
}

function applyUpgradeEffect(state: MutableParticleClickerState, definition: ParticleClickerUpgradeDefinition): void {
  state.detectorPower = definition.effect === 'detector-multiplier'
    ? state.detectorPower * definition.amount
    : state.detectorPower + definition.amount
  if (!Number.isFinite(state.detectorPower) || state.detectorPower > PARTICLE_CLICKER_BOUNDS.maxDetectorPower) {
    throw new RangeError(`Particle Clicker detector power exceeded ${PARTICLE_CLICKER_BOUNDS.maxDetectorPower}`)
  }
}

function addBounded(current: number, amount: number, maximum: number, path: string): number {
  const next = current + amount
  if (!Number.isFinite(next) || next < 0 || next > maximum) {
    throw new RangeError(`Particle Clicker ${path} exceeded ${maximum}`)
  }
  return next
}

function throwIfAborted(...signals: readonly (AbortSignal | undefined)[]): void {
  if (!signals.some((signal) => signal?.aborted)) return
  throw new DOMException('Particle Clicker run was cancelled', 'AbortError')
}

async function yieldToAbort(signals: readonly (AbortSignal | undefined)[], iteration: number): Promise<void> {
  if (iteration % 256 !== 0) return
  await Promise.resolve()
  throwIfAborted(...signals)
}

function parseInitialState(value: unknown): MutableParticleClickerState {
  const object = value === undefined ? {} : asRecord(value, 'input.initial')
  exactKeys(object, [], ['particles', 'funding', 'reputation', 'clicks', 'elapsedSeconds', 'workers', 'upgrades'], 'input.initial')

  const workers = countRecord(PARTICLE_CLICKER_WORKER_IDS)
  if (Object.hasOwn(object, 'workers')) {
    const workerObject = asRecord(object.workers, 'input.initial.workers')
    exactKeys(workerObject, [], PARTICLE_CLICKER_WORKER_IDS, 'input.initial.workers')
    for (const id of PARTICLE_CLICKER_WORKER_IDS) {
      workers[id] = safeInteger(optionalField(workerObject, id, 0), `input.initial.workers.${id}`, 0, PARTICLE_CLICKER_BOUNDS.maxWorkerHires)
    }
  }

  const upgrades: ParticleClickerUpgradeId[] = []
  if (Object.hasOwn(object, 'upgrades')) {
    if (!Array.isArray(object.upgrades)) fail('input.initial.upgrades', 'must be an array')
    if (object.upgrades.length > PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases) {
      throw new RangeError(`Particle Clicker input.initial.upgrades must contain at most ${PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases} entries`)
    }
    for (const [index, valueAtIndex] of object.upgrades.entries()) {
      const id = knownId(valueAtIndex, PARTICLE_CLICKER_UPGRADE_IDS, `input.initial.upgrades[${index}]`)
      if (upgrades.includes(id)) fail(`input.initial.upgrades[${index}]`, 'must not repeat an upgrade')
      upgrades.push(id)
    }
  }
  const upgradeSet = new Set(upgrades)
  for (const id of upgrades) {
    const missing = upgradeDefinition(id).prerequisites.find((prerequisite) => !upgradeSet.has(prerequisite))
    if (missing) fail(`input.initial.upgrades`, `is missing prerequisite ${missing} for ${id}`)
  }

  const totalWorkers = PARTICLE_CLICKER_WORKER_IDS.reduce((total, id) => total + workers[id], 0)
  if (totalWorkers > PARTICLE_CLICKER_BOUNDS.maxWorkerHires) {
    throw new RangeError(`Particle Clicker input.initial.workers must contain at most ${PARTICLE_CLICKER_BOUNDS.maxWorkerHires} hires`)
  }

  const state: MutableParticleClickerState = {
    particles: nonNegativeFinite(optionalField(object, 'particles', 0), 'input.initial.particles', PARTICLE_CLICKER_BOUNDS.maxParticles),
    funding: nonNegativeFinite(optionalField(object, 'funding', 0), 'input.initial.funding', PARTICLE_CLICKER_BOUNDS.maxFunding),
    reputation: nonNegativeFinite(optionalField(object, 'reputation', 0), 'input.initial.reputation', PARTICLE_CLICKER_BOUNDS.maxReputation),
    clicks: safeInteger(optionalField(object, 'clicks', 0), 'input.initial.clicks', 0, PARTICLE_CLICKER_BOUNDS.maxClicks),
    elapsedSeconds: nonNegativeFinite(optionalField(object, 'elapsedSeconds', 0), 'input.initial.elapsedSeconds', PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds),
    detectorPower: 1,
    productionRate: 0,
    workers,
    workerCosts: countRecord(PARTICLE_CLICKER_WORKER_IDS),
    upgrades,
  }

  for (const id of upgrades) applyUpgradeEffect(state, upgradeDefinition(id))
  for (const definition of PARTICLE_CLICKER_WORKERS) {
    let cost = definition.baseCost
    for (let index = 0; index < state.workers[definition.id]; index += 1) cost = nextWorkerCost(cost, definition)
    state.workerCosts[definition.id] = cost
  }
  state.productionRate = computeProductionRate(state)
  return state
}

interface ParsedActions {
  actions: ParticleClickerAction[]
  clickCount: number
  upgradeCount: number
  workerHireCount: number
  elapsedSeconds: number
}

function parseActions(value: unknown): ParsedActions {
  if (!Array.isArray(value)) fail('input.actions', 'must be an array')
  if (value.length > PARTICLE_CLICKER_BOUNDS.maxActions) {
    throw new RangeError(`Particle Clicker input.actions must contain at most ${PARTICLE_CLICKER_BOUNDS.maxActions} entries`)
  }

  const parsed: ParsedActions = {
    actions: [],
    clickCount: 0,
    upgradeCount: 0,
    workerHireCount: 0,
    elapsedSeconds: 0,
  }
  for (const [index, valueAtIndex] of value.entries()) {
    const object = asRecord(valueAtIndex, `input.actions[${index}]`)
    if (typeof object.type !== 'string') fail(`input.actions[${index}].type`, 'must be a string')
    switch (object.type) {
      case 'click': {
        exactKeys(object, ['type', 'count'], [], `input.actions[${index}]`)
        const count = safeInteger(object.count, `input.actions[${index}].count`, 1, PARTICLE_CLICKER_BOUNDS.maxClicks)
        parsed.clickCount += count
        if (parsed.clickCount > PARTICLE_CLICKER_BOUNDS.maxClicks) {
          throw new RangeError(`Particle Clicker actions must contain at most ${PARTICLE_CLICKER_BOUNDS.maxClicks} clicks`)
        }
        parsed.actions.push({ type: 'click', count })
        break
      }
      case 'advance': {
        exactKeys(object, ['type', 'seconds'], [], `input.actions[${index}]`)
        const seconds = nonNegativeFinite(object.seconds, `input.actions[${index}].seconds`, PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds)
        parsed.elapsedSeconds += seconds
        if (parsed.elapsedSeconds > PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds) {
          throw new RangeError(`Particle Clicker actions must advance at most ${PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds} seconds`)
        }
        parsed.actions.push({ type: 'advance', seconds })
        break
      }
      case 'hire-worker': {
        exactKeys(object, ['type', 'workerId', 'count'], [], `input.actions[${index}]`)
        const workerId = knownId(object.workerId, PARTICLE_CLICKER_WORKER_IDS, `input.actions[${index}].workerId`)
        const count = safeInteger(object.count, `input.actions[${index}].count`, 1, PARTICLE_CLICKER_BOUNDS.maxWorkerHires)
        parsed.workerHireCount += count
        if (parsed.workerHireCount > PARTICLE_CLICKER_BOUNDS.maxWorkerHires) {
          throw new RangeError(`Particle Clicker actions must contain at most ${PARTICLE_CLICKER_BOUNDS.maxWorkerHires} hires`)
        }
        parsed.actions.push({ type: 'hire-worker', workerId, count })
        break
      }
      case 'buy-upgrade': {
        exactKeys(object, ['type', 'upgradeId'], [], `input.actions[${index}]`)
        const upgradeId = knownId(object.upgradeId, PARTICLE_CLICKER_UPGRADE_IDS, `input.actions[${index}].upgradeId`)
        parsed.upgradeCount += 1
        if (parsed.upgradeCount > PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases) {
          throw new RangeError(`Particle Clicker actions must contain at most ${PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases} upgrades`)
        }
        parsed.actions.push({ type: 'buy-upgrade', upgradeId })
        break
      }
      default:
        fail(`input.actions[${index}].type`, 'has an unsupported value')
    }
  }
  return parsed
}

function parseInput(input: unknown): { state: MutableParticleClickerState; actions: ParticleClickerAction[] } {
  assertJsonSafe(input, 'input')
  const object = asRecord(input, 'input')
  exactKeys(object, ['actions'], ['initial'], 'input')
  const state = parseInitialState(object.initial)
  const parsedActions = parseActions(object.actions)
  if (state.clicks + parsedActions.clickCount > PARTICLE_CLICKER_BOUNDS.maxClicks) {
    throw new RangeError(`Particle Clicker total clicks must not exceed ${PARTICLE_CLICKER_BOUNDS.maxClicks}`)
  }
  const initialWorkers = PARTICLE_CLICKER_WORKER_IDS.reduce((total, id) => total + state.workers[id], 0)
  if (initialWorkers + parsedActions.workerHireCount > PARTICLE_CLICKER_BOUNDS.maxWorkerHires) {
    throw new RangeError(`Particle Clicker total worker hires must not exceed ${PARTICLE_CLICKER_BOUNDS.maxWorkerHires}`)
  }
  if (state.upgrades.length + parsedActions.upgradeCount > PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases) {
    throw new RangeError(`Particle Clicker total upgrades must not exceed ${PARTICLE_CLICKER_BOUNDS.maxUpgradePurchases}`)
  }
  if (state.elapsedSeconds + parsedActions.elapsedSeconds > PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds) {
    throw new RangeError(`Particle Clicker total elapsed time must not exceed ${PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds} seconds`)
  }
  return { state, actions: parsedActions.actions }
}

function snapshotState(state: MutableParticleClickerState): ParticleClickerState {
  return {
    particles: state.particles,
    funding: state.funding,
    reputation: state.reputation,
    clicks: state.clicks,
    elapsedSeconds: state.elapsedSeconds,
    detectorPower: state.detectorPower,
    productionRate: state.productionRate,
    workers: { ...state.workers },
    workerCosts: { ...state.workerCosts },
    upgrades: [...state.upgrades],
  }
}

function actionResult(
  index: number,
  type: ParticleClickerAction['type'],
  applied: boolean,
  purchased: number,
  particlesAdded: number,
  fundingAdded: number,
  cost: number,
  reason: ParticleClickerActionReason,
): ParticleClickerActionResult {
  return { index, type, applied, purchased, particlesAdded, fundingAdded, cost, reason }
}

async function applyAction(
  action: ParticleClickerAction,
  index: number,
  state: MutableParticleClickerState,
  totals: MutableParticleClickerTotals,
  signals: readonly (AbortSignal | undefined)[],
): Promise<ParticleClickerActionResult> {
  throwIfAborted(...signals)
  if (action.type === 'click') {
    const startingParticles = state.particles
    for (let click = 0; click < action.count; click += 1) {
      throwIfAborted(...signals)
      state.particles = addBounded(state.particles, state.detectorPower, PARTICLE_CLICKER_BOUNDS.maxParticles, 'particles')
      state.clicks += 1
      await yieldToAbort(signals, click + 1)
    }
    const particlesAdded = state.particles - startingParticles
    totals.clicks += action.count
    totals.particlesFromClicks += particlesAdded
    return actionResult(index, action.type, true, 0, particlesAdded, 0, 0, 'applied')
  }

  if (action.type === 'advance') {
    const particlesAdded = state.productionRate * action.seconds
    const fundingAdded = state.reputation * GRANT_FACTOR * action.seconds
    state.particles = addBounded(state.particles, particlesAdded, PARTICLE_CLICKER_BOUNDS.maxParticles, 'particles')
    state.funding = addBounded(state.funding, fundingAdded, PARTICLE_CLICKER_BOUNDS.maxFunding, 'funding')
    state.elapsedSeconds = addBounded(state.elapsedSeconds, action.seconds, PARTICLE_CLICKER_BOUNDS.maxElapsedSeconds, 'elapsed time')
    totals.particlesFromWorkers += particlesAdded
    totals.fundingFromGrants += fundingAdded
    throwIfAborted(...signals)
    return actionResult(index, action.type, true, 0, particlesAdded, fundingAdded, 0, 'applied')
  }

  if (action.type === 'hire-worker') {
    const definition = workerDefinition(action.workerId)
    let purchased = 0
    let cost = 0
    for (let hire = 0; hire < action.count; hire += 1) {
      throwIfAborted(...signals)
      const nextCost = state.workerCosts[action.workerId]
      if (state.funding < nextCost) break
      state.funding -= nextCost
      cost += nextCost
      state.workers[action.workerId] += 1
      state.workerCosts[action.workerId] = nextWorkerCost(nextCost, definition)
      state.productionRate = computeProductionRate(state)
      purchased += 1
      await yieldToAbort(signals, hire + 1)
    }
    totals.workerHires += purchased
    totals.fundingSpent += cost
    const reason: ParticleClickerActionReason = purchased === action.count
      ? 'applied'
      : purchased > 0
        ? 'partially-applied'
        : 'insufficient-funding'
    return actionResult(index, action.type, purchased > 0, purchased, 0, 0, cost, reason)
  }

  const definition = upgradeDefinition(action.upgradeId)
  if (state.upgrades.includes(action.upgradeId)) {
    return actionResult(index, action.type, false, 0, 0, 0, 0, 'already-purchased')
  }
  const missing = definition.prerequisites.find((prerequisite) => !state.upgrades.includes(prerequisite))
  if (missing) return actionResult(index, action.type, false, 0, 0, 0, 0, 'requirements-not-met')
  if (state.funding < definition.cost) {
    return actionResult(index, action.type, false, 0, 0, 0, 0, 'insufficient-funding')
  }
  state.funding -= definition.cost
  state.upgrades.push(action.upgradeId)
  applyUpgradeEffect(state, definition)
  totals.upgradesPurchased += 1
  totals.fundingSpent += definition.cost
  return actionResult(index, action.type, true, 1, 0, 0, definition.cost, 'applied')
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function outputByteLength(value: ParticleClickerOutput): number {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError('Particle Clicker output is not JSON-safe')
  return new TextEncoder().encode(serialized).byteLength
}

async function runParticleClickerWithSignals(
  input: ParticleClickerInput,
  signals: readonly (AbortSignal | undefined)[],
): Promise<ParticleClickerOutput> {
  throwIfAborted(...signals)
  const parsed = parseInput(input)
  const totals: MutableParticleClickerTotals = {
    clicks: 0,
    upgradesPurchased: 0,
    workerHires: 0,
    particlesFromClicks: 0,
    particlesFromWorkers: 0,
    fundingFromGrants: 0,
    fundingSpent: 0,
  }
  const actions: ParticleClickerActionResult[] = []
  for (const [index, action] of parsed.actions.entries()) {
    actions.push(await applyAction(action, index, parsed.state, totals, signals))
    await yieldToAbort(signals, index + 1)
  }
  throwIfAborted(...signals)

  const output = {
    schemaVersion: 1 as const,
    model: PARTICLE_CLICKER_MODEL,
    state: snapshotState(parsed.state),
    actions,
    totals: { ...totals },
    limits: PARTICLE_CLICKER_BOUNDS,
    provenance: PARTICLE_CLICKER_PROVENANCE,
  } satisfies ParticleClickerOutput
  if (outputByteLength(output) > PARTICLE_CLICKER_BOUNDS.maxOutputBytes) {
    throw new RangeError(`Particle Clicker output exceeded ${PARTICLE_CLICKER_BOUNDS.maxOutputBytes} bytes`)
  }
  return deepFreeze(output)
}

export function runParticleClicker(input: ParticleClickerInput, signal?: AbortSignal): Promise<ParticleClickerOutput> {
  return runParticleClickerWithSignals(input, [signal])
}

function descriptorText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`Particle Clicker ${path} must be a non-empty string`)
  return value
}

interface AdapterDescriptorData {
  readonly adapterId: string
  readonly contentRevision: string
  readonly modelRevision: string
  readonly implementationRevision: string
  readonly outputRevision: string
}

function descriptorData(
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
): AdapterDescriptorData {
  throwIfAborted(signal)
  if (!descriptor || typeof descriptor !== 'object') throw new TypeError('Particle Clicker descriptor must be an object')
  if (descriptor.catalogItemId !== PARTICLE_CLICKER_CATALOG_ITEM_ID || descriptor.title !== 'particle-clicker') {
    throw new TypeError('Particle Clicker adapter requires the particle-clicker simulation descriptor')
  }
  if (descriptor.execution !== 'browser') throw new TypeError('Particle Clicker adapter requires browser execution')
  const adapterId = descriptor.adapterId ?? PARTICLE_CLICKER_ADAPTER_ID
  if (typeof adapterId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(adapterId)) {
    throw new TypeError('Particle Clicker descriptor adapterId must be a safe ID')
  }
  return {
    adapterId,
    contentRevision: descriptorText(descriptor.contentRevision, 'descriptor.contentRevision'),
    modelRevision: descriptorText(descriptor.modelRevision, 'descriptor.modelRevision'),
    implementationRevision: descriptorText(descriptor.implementationRevision, 'descriptor.implementationRevision'),
    outputRevision: descriptorText(descriptor.outputRevision, 'descriptor.outputRevision'),
  }
}

export const createParticleClickerAdapter: ParticleClickerAdapterFactory = (
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  factorySignal: AbortSignal = new AbortController().signal,
): ParticleClickerAdapter => {
  const data = descriptorData(descriptor, factorySignal)
  return {
    adapterId: data.adapterId,
    protocol: 'awesome-physics-adapter-v1',
    compatibility: {
      contentRevision: data.contentRevision,
      modelRevision: data.modelRevision,
      implementationRevision: data.implementationRevision,
      outputRevision: data.outputRevision,
    },
    run: (input, runSignal) => {
      throwIfAborted(factorySignal, runSignal)
      return runParticleClickerWithSignals(input, [factorySignal, runSignal])
    },
  }
}

export const particleClickerAdapterFactory = createParticleClickerAdapter
export const createParticleClickerAdapterFactory: ParticleClickerAdapterFactory = createParticleClickerAdapter
