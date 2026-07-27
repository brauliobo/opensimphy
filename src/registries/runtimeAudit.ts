export type RuntimeAuditError = {
  status: 'error'
  error: string
}

export interface TourRuntimeAudit {
  status: 'ready'
  manifest: {
    chapters: number
    lessons: number
    simulations: number
    quickStations: number
  }
  taxonomy: {
    total: number
    topics: Array<{ id: string; count: number }>
  }
}

export interface FormulaRuntimeAudit {
  status: 'ready'
  expected: number
  evaluated: number
  graphed: number
}

export interface CoreRuntimeAudit {
  status: 'ready'
  expected: number
  evaluated: number
  graphed: number
}

export interface WallRuntimeAudit {
  status: 'ready'
  registered: number
}

export type AppRuntimeAudit = RuntimeAuditError | ({ status: 'ready' } & Record<string, unknown>)

// Domains are populated independently as routes load during the current browser session.
export interface RuntimeAudit {
  schemaVersion: 2
  tour?: TourRuntimeAudit | RuntimeAuditError
  formulas?: FormulaRuntimeAudit | RuntimeAuditError
  core?: CoreRuntimeAudit | RuntimeAuditError
  walls?: WallRuntimeAudit | RuntimeAuditError
  app?: AppRuntimeAudit
}

export type RuntimeAuditUpdate = Partial<Omit<RuntimeAudit, 'schemaVersion'>>
export type RuntimeAuditDomain = keyof RuntimeAuditUpdate

type AuditWindow = Window & { __OPENSIMPHY_AUDIT__?: RuntimeAudit }

export function publishRuntimeAudit(update: RuntimeAuditUpdate): RuntimeAudit | null {
  if (typeof window === 'undefined') return null
  const target = window as AuditWindow
  const current = target.__OPENSIMPHY_AUDIT__?.schemaVersion === 2
    ? target.__OPENSIMPHY_AUDIT__
    : { schemaVersion: 2 as const }
  const next = { ...current, ...update }
  target.__OPENSIMPHY_AUDIT__ = next
  return next
}

export function clearRuntimeAuditDomain(domain: RuntimeAuditDomain): void {
  if (typeof window === 'undefined') return
  const target = window as AuditWindow
  if (target.__OPENSIMPHY_AUDIT__?.schemaVersion !== 2) return
  const next = { ...target.__OPENSIMPHY_AUDIT__ }
  delete next[domain]
  target.__OPENSIMPHY_AUDIT__ = next
}
