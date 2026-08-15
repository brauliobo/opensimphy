export type AwesomePhysicsSourceKind = 'repository' | 'documentation' | 'archive' | 'organization'

export type AwesomePhysicsExecutionKind =
  | 'browser'
  | 'wasm'
  | 'wasm-candidate'
  | 'typescript'
  | 'artifact'
  | 'reference'
  | 'blocked'

export type AwesomePhysicsAvailability = 'available' | 'unavailable' | 'blocked'
export type AwesomePhysicsPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type AwesomePhysicsModelOrigin =
  | 'upstream-adaptation'
  | 'educational-reimplementation'
  | 'source-artifact'
  | 'reference-only'

export type AwesomePhysicsLicenseStatus = 'verified' | 'unclear' | 'restricted' | 'missing'
export type AwesomePhysicsLicenseGate = 'pass' | 'review' | 'blocked'
export type AwesomePhysicsMaintenance = 'active' | 'stale' | 'archived' | 'unknown'

export interface AwesomePhysicsLinkV1 {
  kind: string
  label: string
  url: string
}

export interface AwesomePhysicsEvidenceV1 {
  sourceRefs: string[]
  licenseRefs: string[]
  maintenanceRefs: string[]
}

export interface AwesomePhysicsLicenseV1 {
  status: AwesomePhysicsLicenseStatus
  text: string
  evidenceRefs: string[]
}

export interface AwesomePhysicsArtifactProvenanceV1 {
  sourceRevision: string | null
  acquisitionDate: string
  byteSize: number | null
  sha256: string | null
  transformation: string
  datasetLicense: string | null
  evidenceRefs: string[]
}

export interface AwesomePhysicsLimitsV1 {
  maxGridSize: number
  maxParticles: number
  maxIterations: number
  maxMemoryBytes: number
  maxWorkerTimeMs: number
  maxOutputBytes: number
}

export interface AwesomePhysicsCatalogItemV1 {
  id: string
  canonicalName: string
  aliases: string[]
  category: string
  catalogSection: string
  title: string
  description: string
  catalogUrl: string
  upstreamUrl: string
  catalogRevision: string
  upstreamRevision: string | null
  localPath: string | null
  sourceKind: AwesomePhysicsSourceKind
  language: string[]
  license: AwesomePhysicsLicenseV1
  maintenance: AwesomePhysicsMaintenance
  maintenanceSignal: string
  evidence: AwesomePhysicsEvidenceV1
  links: AwesomePhysicsLinkV1[]
  catalogLine: number
  manifestLine: number | null
  planLine: number | null
  access: {
    status: 'cloned' | 'not-cloned' | 'archived'
    note: string
    attemptedOn: string | null
  }
  accessFailure: {
    attemptedOn: string
    observed: string[]
    note: string
  } | null
  upstreamResolution: {
    kind: 'current-upstream-substitution'
    reason: string
    catalogUrl: string
    canonicalUpstreamUrl: string
  } | null
}

export interface AwesomePhysicsOrganizationV1 {
  id: string
  title: string
  description: string
  url: string
  sourceKind: 'organization'
  maintenance: AwesomePhysicsMaintenance
  status: 'listed' | 'review' | 'moved' | 'official-source-note'
  notes: string
  evidenceRefs: string[]
  catalogLine: number
}

export interface AwesomePhysicsCatalogSummaryV1 {
  totalEntries: number
  projectEntries: number
  archiveEntries: number
  organizationEntries: number
  clonedRepositories: number
  failedAccessEntries: number
  documentationAliases: number
}

export interface AwesomePhysicsCatalogArtifactV1 {
  schemaVersion: 1
  generatedAt: string
  catalogRevision: string
  source: {
    catalogPath: string
    manifestPath: string
    migrationPlanPath: string
    acquisitionDate: string
    evidenceRefs: string[]
  }
  summary: AwesomePhysicsCatalogSummaryV1
  items: AwesomePhysicsCatalogItemV1[]
  organizations: AwesomePhysicsOrganizationV1[]
}

export interface AwesomePhysicsSimulationSummaryV1 {
  sourceCapabilities: number
  runnable: number
  available: number
  unavailable: number
  blocked: number
  adapterCount: number
  executionKinds: Record<AwesomePhysicsExecutionKind, number>
}

export interface AwesomePhysicsSimulationDescriptorV1 {
  id: string
  catalogItemId: string
  title: string
  capability: 'catalog-entry' | 'archive-reference'
  execution: AwesomePhysicsExecutionKind
  executionOptions: AwesomePhysicsExecutionKind[]
  availability: AwesomePhysicsAvailability
  runnable: boolean
  priority: AwesomePhysicsPriority
  modelOrigin: AwesomePhysicsModelOrigin
  adapterId?: string
  numericalMethod: string | null
  inputSchema: string | null
  outputSchema: string | null
  sourceRevision: string | null
  implementationRevision: string
  licenseGate: AwesomePhysicsLicenseGate
  availabilityReason: string
  planDisposition: string
  limits: AwesomePhysicsLimitsV1
  artifactProvenance: AwesomePhysicsArtifactProvenanceV1
  evidenceRefs: string[]
  compatibilityRevision: string
  modelRevision: string
  contentRevision: string
  outputRevision: string
}

export type AwesomePhysicsAdapterProtocolV1 = 'awesome-physics-adapter-v1'

export interface AwesomePhysicsAdapterCompatibilityV1 {
  contentRevision: string
  modelRevision: string
  implementationRevision: string
  outputRevision: string
}

export interface AwesomePhysicsAdapterV1<TInput = unknown, TOutput = unknown> {
  adapterId: string
  protocol: AwesomePhysicsAdapterProtocolV1
  compatibility: AwesomePhysicsAdapterCompatibilityV1
  run: (input: TInput, signal?: AbortSignal) => TOutput | Promise<TOutput>
}

export type AwesomePhysicsAdapterFactoryV1<TInput = unknown, TOutput = unknown> = (
  descriptor: AwesomePhysicsSimulationDescriptorV1,
  signal: AbortSignal,
) => AwesomePhysicsAdapterV1<TInput, TOutput> | Promise<AwesomePhysicsAdapterV1<TInput, TOutput>>

export interface AwesomePhysicsSimulationArtifactV1 {
  schemaVersion: 1
  generatedAt: string
  catalogRevision: string
  source: {
    catalogPath: string
    manifestPath: string
    migrationPlanPath: string
    acquisitionDate: string
    evidenceRefs: string[]
  }
  summary: AwesomePhysicsSimulationSummaryV1
  items: AwesomePhysicsSimulationDescriptorV1[]
}
