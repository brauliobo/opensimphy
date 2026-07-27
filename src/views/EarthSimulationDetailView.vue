<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import EarthStructuredValue from '../components/EarthStructuredValue.vue'
import WorkbenchCompare from '../components/workbench/WorkbenchCompare.vue'
import WorkbenchFinding from '../components/workbench/WorkbenchFinding.vue'
import WorkbenchShell from '../components/workbench/WorkbenchShell.vue'
import type { EarthDocumentRecord } from '../earth/corpus'
import { loadEarthDatasetRegistry, type EarthDatasetRegistry } from '../earth/datasets'
import {
  loadEarthEvidenceManifest,
  loadEarthProgramEvidence,
  type EarthProgramEvidenceShard,
} from '../earth/evidence'
import { runEarthMethodInWorker } from '../earth/runSimulation'
import {
  hasSimulationRunControl,
  isSimulationBlocked,
  loadScientificSimulationBundle,
  type ScientificSimulationBundle,
  type ScientificSimulationRecord,
  type SimulationExecutionMethod,
  type SimulationMethodValue,
} from '../earth/simulations'
import {
  buildEarthWorkbenchFinding,
  buildInputFields,
  EARTH_OUTPUT_SCHEMA_REVISION,
  EARTH_WORKER_ADAPTER_REVISION,
  earthCompatibilityKey,
  earthInputsEqual,
  earthModelRevision,
  earthParallelScalarDeltas,
  formatScalar,
  formatToken,
  humanizeKey,
  inferExplicitUnit,
  isJsonObject,
  isScalar,
  validateEarthWorkbenchInputs,
  type WorkbenchInputField,
} from '../earth/workbench'
import {
  getEarthMethodDefinition,
  isEarthSimulationId,
  type EarthMethodId,
} from '../engine/earth'
import type { EarthWorkerExecution } from '../types/earthWorkers'
import { useSavedRunRegistry } from '../registries/savedRunRegistry'
import type {
  JsonObject,
  WorkbenchActionErrors,
  WorkbenchExecutionMode,
  WorkbenchExecutionStatus,
  WorkbenchFindingV1,
  WorkbenchSnapshotCount,
  WorkbenchSnapshotInputV1,
} from '../types/workbench'
import {
  addSnapshot,
  cloneJsonValue,
  compareSnapshotPair,
  createSnapshotPair,
  createWorkbenchSnapshot,
  type SnapshotPair,
} from '../workbench/snapshots'
import {
  decodeWorkbenchInputEnvelope,
  encodeWorkbenchInputEnvelope,
  mergeOwnedQuery,
} from '../workbench/urlState'

type ExecutionStatus = 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed'
type CompletedExecution = Extract<EarthWorkerExecution, { status: 'completed' }>
interface CompletedRun {
  readonly execution: CompletedExecution
  readonly dispatchedInputs: JsonObject
  readonly finding: WorkbenchFindingV1
  readonly sourceRevision: string
  readonly implementationRevision: string
  readonly modelRevision: string
  readonly outputSchemaRevision: string
  readonly compatibilityKey: string
}

interface WorkbenchMethod extends SimulationExecutionMethod {
  kind: string
  precision: string
  model: string
  defaultInputs: Record<string, unknown> | null
}

interface MethodInputState {
  values: Record<string, unknown>
  fieldTexts: Record<string, string>
  fieldErrors: Record<string, string>
  advancedText: string
  advancedError: string
}

const props = withDefaults(defineProps<{
  id: string
  surface?: 'evidence' | 'workbench'
}>(), { surface: 'evidence' })
const route = useRoute()
const router = useRouter()
const savedRunRegistry = useSavedRunRegistry()
const bundle = ref<ScientificSimulationBundle | null>(null)
const simulation = ref<ScientificSimulationRecord | null>(null)
const datasetRegistry = ref<EarthDatasetRegistry | null>(null)
const programEvidence = ref<EarthProgramEvidenceShard | null>(null)
const evidenceError = ref('')
const evidenceLoading = ref(false)
const evidenceLimit = ref(18)
const error = ref('')
const selectedMethodId = ref('')
const inputStates = ref<Record<string, MethodInputState>>({})
const executionError = ref('')
const executionStatus = ref<ExecutionStatus>('idle')
const progress = ref(0)
const completedResults = ref<Record<string, CompletedRun>>({})
const comparisonPair = ref<SnapshotPair>(createSnapshotPair())
const actionErrors = ref<WorkbenchActionErrors>({})
const saveResult = ref('')
const urlStateWarning = ref('')
let executionController: AbortController | null = null
let retainRejectedUrlWarning = false

if (!savedRunRegistry.hydrated.value) savedRunRegistry.hydrate()

const sourceDocuments = computed(() => simulation.value?.sourceDocumentIds.map((id) => (
  bundle.value?.sourceDocuments.get(id)
)).filter((document): document is EarthDocumentRecord => Boolean(document)) ?? [])
const isWorkbenchSurface = computed(() => props.surface === 'workbench')
const evidenceDocuments = computed(() => programEvidence.value?.linkedDocumentIds.map((id) => (
  bundle.value?.sourceDocuments.get(id)
)).filter((document): document is EarthDocumentRecord => Boolean(document)) ?? [])
const datasetRequirements = computed(() => {
  const ids = new Set(programEvidence.value?.linkedDatasetIds ?? [])
  return datasetRegistry.value?.datasets.filter(({ datasetId }) => ids.has(datasetId)) ?? []
})
const disputedClaims = computed(() => {
  const ids = new Set(programEvidence.value?.disputedClaimIds ?? [])
  return datasetRegistry.value?.disputedClaims.filter(({ claimId }) => ids.has(claimId)) ?? []
})
const visibleEvidenceAssignments = computed(() => programEvidence.value?.assignments.slice(0, evidenceLimit.value) ?? [])
const methodSections = computed(() => {
  const method = simulation.value?.method
  if (!method) return []
  if (typeof method === 'string' || Array.isArray(method)) return [['Method', method] as const]
  return Object.entries(method)
})
const methods = computed<WorkbenchMethod[]>(() => simulation.value?.executionMethods.map((method) => {
  if (!method.runnable) {
    return {
      ...method,
      kind: 'unavailable',
      precision: method.precision ?? 'unavailable',
      model: method.model,
      defaultInputs: null,
    }
  }
  if (!isEarthSimulationId(simulation.value!.id)) {
    return { ...method, kind: 'unavailable', precision: 'unavailable', model: 'No engine method definition is available.', defaultInputs: null }
  }
  const definition = getEarthMethodDefinition(simulation.value!.id, method.id)
  return {
    ...method,
    kind: definition.kind,
    precision: definition.precision,
    model: definition.model,
    defaultInputs: isJsonObject(definition.defaultInputs) ? structuredClone(definition.defaultInputs) : null,
  }
}) ?? [])
const selectedMethod = computed(() => methods.value.find(({ id }) => id === selectedMethodId.value) ?? null)
const selectedInputState = computed(() => inputStates.value[selectedMethodId.value] ?? null)
const inputFields = computed(() => buildInputFields(selectedMethod.value?.defaultInputs ?? {}))
const running = computed(() => executionStatus.value === 'starting' || executionStatus.value === 'running')
const integrityError = computed(() => {
  const record = simulation.value
  if (!record || !hasSimulationRunControl(record) || isEarthSimulationId(record.id)) return ''
  return `Registry integrity error: runnable program ${record.id} is not supported by the EARTH execution engine.`
})
const canRunSelected = computed(() => Boolean(
  selectedMethod.value?.runnable
  && selectedMethod.value.runtime === 'browser-worker'
  && simulation.value
  && hasSimulationRunControl(simulation.value)
  && isEarthSimulationId(simulation.value.id),
))
const selectedCompletedRun = computed(() => completedResults.value[selectedMethodId.value] ?? null)
const selectedResult = computed(() => selectedCompletedRun.value?.execution ?? null)
const completedResultEntries = computed(() => methods.value.map((method) => ({
  method,
  result: completedResults.value[method.id]?.execution ?? null,
})))
const progressStage = computed(() => {
  if (executionStatus.value === 'completed') return 'Result received'
  if (executionStatus.value === 'cancelled') return 'Dispatch cancelled'
  if (executionStatus.value === 'failed') return 'Dispatch failed'
  if (progress.value >= 20) return 'Kernel execution requested'
  if (progress.value >= 5) return 'Worker dispatched'
  return 'Inputs ready'
})
const sourceReadinessLabel = computed(() => {
  const status = simulation.value?.sourceState.status ?? 'unknown'
  return status === 'blocked' ? 'SOURCE MODEL BLOCKED' : `SOURCE MODEL ${status.toUpperCase()}`
})
const scientificReadinessLabel = computed(() => {
  const status = simulation.value?.scientificStatus
  if (status === 'blocked-source') return 'SCIENTIFIC VALIDATION NOT ESTABLISHED · SOURCE MODEL BLOCKED'
  if (status === 'blocked') return 'SCIENTIFIC VALIDATION NOT ESTABLISHED · PROGRAM EXECUTION BLOCKED'
  return `SCIENTIFIC VALIDATION NOT ESTABLISHED · ${String(status ?? 'unresolved').toUpperCase()}`
})
const methodAvailabilityLabel = computed(() => {
  const count = methods.value.length
  const runnableCount = methods.value.filter(({ runnable, runtime }) => runnable && runtime === 'browser-worker').length
  const unavailableCount = count - runnableCount
  const readyKinds = methods.value
    .filter(({ runnable, runtime }) => runnable && runtime === 'browser-worker')
    .map(({ relationship }) => relationship.startsWith('traditional-')
      ? 'LOCAL TRADITIONAL BASELINE READY'
      : relationship === 'earth-source-reproduction'
        ? 'LOCAL SOURCE REPRODUCTION READY'
        : 'LOCAL CONTRACT AUDIT READY')
  return `${count} DECLARED ${count === 1 ? 'METHOD' : 'METHODS'} · ${runnableCount} RUNNABLE · ${unavailableCount} UNAVAILABLE${readyKinds.length ? ` · ${[...new Set(readyKinds)].join(' · ')}` : ''}`
})
const scalarOutputs = computed(() => resultScalarOutputs(selectedResult.value))
const structuredOutputs = computed(() => resultStructuredOutputs(selectedResult.value))
const resultDiagnostics = computed(() => Object.entries(selectedResult.value?.diagnostics ?? {}))
const workbenchExecutionMode = computed<WorkbenchExecutionMode>(() => canRunSelected.value ? 'manual' : 'unavailable')
const workbenchStatus = computed<WorkbenchExecutionStatus>(() => {
  if (!canRunSelected.value) return 'unavailable'
  if (executionStatus.value === 'starting' || executionStatus.value === 'running') return 'running'
  return executionStatus.value
})
const snapshotCount = computed(() => comparisonPair.value.length as WorkbenchSnapshotCount)
const selectedFinding = computed(() => selectedCompletedRun.value?.finding ?? null)
const selectedResultStale = computed(() => {
  const run = selectedCompletedRun.value
  const state = selectedInputState.value
  const method = selectedMethod.value
  if (!run || !state || !method?.defaultInputs) return false
  if (inputFields.value.some((field) => field.kind === 'json'
    && state.fieldTexts[field.key] !== JSON.stringify(run.dispatchedInputs[field.key], null, 2))) return true
  try {
    const current = validateEarthWorkbenchInputs(JSON.parse(state.advancedText) as unknown, method.defaultInputs)
    return !earthInputsEqual(current, run.dispatchedInputs)
  } catch {
    return true
  }
})
const comparison = computed(() => comparisonPair.value.length === 2 ? compareSnapshotPair(comparisonPair.value) : null)
const parallelScalarDeltas = computed(() => {
  if (!comparison.value?.compatible) return []
  return earthParallelScalarDeltas(comparison.value.snapshots[0], comparison.value.snapshots[1])
})
function methodEvidenceRefs(method: WorkbenchMethod): string[] {
  if (method.relationship.startsWith('traditional-')) {
    return [`src/engine/earth/index.ts#getEarthMethodDefinition:${simulation.value?.id ?? props.id}:${method.id}`]
  }
  return simulation.value?.sourceDocumentIds.length
    ? [...simulation.value.sourceDocumentIds]
    : ['public/data/generated/earth/manifest.json#sourceRevision']
}

function methodSourceLocator(method: WorkbenchMethod): string {
  if (method.relationship.startsWith('traditional-')) {
    return `src/engine/earth/index.ts#getEarthMethodDefinition:${simulation.value?.id ?? props.id}:${method.id}`
  }
  return methodEvidenceRefs(method).join(', ')
}

function methodSourceRevision(method: WorkbenchMethod): string {
  return method.relationship.startsWith('traditional-')
    ? earthModelRevision(simulation.value?.id ?? props.id, method.id)
    : bundle.value?.sourceRevision ?? 'source-revision-unavailable'
}

const evidenceRefs = computed(() => selectedMethod.value ? methodEvidenceRefs(selectedMethod.value) : [])
const workbenchProvenance = computed(() => selectedMethod.value ? {
  claimClass: selectedMethod.value.relationship === 'earth-source-reproduction'
    ? 'bounded-source-audit'
    : selectedMethod.value.relationship.startsWith('traditional-')
      ? 'independent-traditional-comparator'
      : 'bounded-contract-audit',
  evidenceRefs: methodEvidenceRefs(selectedMethod.value),
  sourceRevision: methodSourceRevision(selectedMethod.value),
  sourceLocator: methodSourceLocator(selectedMethod.value),
  methodRelationship: selectedMethod.value.relationship,
  modelOrigin: selectedMethod.value.modelOrigin,
  resultStatus: workbenchStatus.value,
  caveats: ['Scientific validation is not established.'],
  implementationRevision: EARTH_WORKER_ADAPTER_REVISION,
  modelRevision: earthModelRevision(simulation.value?.id ?? props.id, selectedMethod.value.id),
  outputSchemaRevision: EARTH_OUTPUT_SCHEMA_REVISION,
} : undefined)
const workbenchExecutionMessage = computed(() => {
  if (!canRunSelected.value) return ''
  if (running.value) return `${progressStage.value}. Worker dispatch is ${progress.value}% complete.`
  if (selectedResultStale.value) return 'Execution completed. The retained result is stale because controls have changed.'
  return ''
})

function methodLines(value: SimulationMethodValue): string[] {
  return typeof value === 'string' ? [value] : value
}

function isEquationSection(name: string): boolean {
  const normalized = name.toLocaleLowerCase()
  return normalized.includes('equation') || normalized.includes('formula')
}

function dependencyRecord(id: string): ScientificSimulationRecord | null {
  return bundle.value?.registry.records.find((record) => record.id === id) ?? null
}

function evidenceDocument(id: string): EarthDocumentRecord | null {
  return bundle.value?.sourceDocuments.get(id) ?? null
}

function showMoreEvidence(): void {
  evidenceLimit.value += 24
}

function inputId(key: string): string {
  return `earth-method-input-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function inputDescriptionId(field: WorkbenchInputField): string {
  return `${inputId(field.key)}-description`
}

function inputErrorId(field: WorkbenchInputField): string {
  return `${inputId(field.key)}-error`
}

function inputDescribedBy(field: WorkbenchInputField): string {
  return [inputDescriptionId(field), selectedInputState.value?.fieldErrors[field.key] ? inputErrorId(field) : ''].filter(Boolean).join(' ')
}

function initializeInputState(method: WorkbenchMethod): MethodInputState | null {
  if (!method.defaultInputs) return null
  return inputStateFromValues(method.defaultInputs)
}

function inputStateFromValues(inputs: Record<string, unknown>): MethodInputState {
  const values = structuredClone(inputs)
  return {
    values,
    fieldTexts: Object.fromEntries(Object.entries(values)
      .filter(([, value]) => typeof value === 'object' && value !== null)
      .map(([key, value]) => [key, JSON.stringify(value, null, 2)])),
    fieldErrors: {},
    advancedText: JSON.stringify(values, null, 2),
    advancedError: '',
  }
}

function queriesEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && JSON.stringify(left[key]) === JSON.stringify(right[key]))
}

function canonicalWorkbenchQuery(methodId: string, inputs: Record<string, unknown> | null) {
  const record = simulation.value
  const method = methods.value.find(({ id }) => id === methodId)
  const encodedInputs = method?.defaultInputs && inputs && !earthInputsEqual(inputs, method.defaultInputs)
    ? encodeWorkbenchInputEnvelope(inputs)
    : null
  return mergeOwnedQuery(
    route.query,
    ['method', 'inputs'],
    { method: methodId, inputs: encodedInputs },
    { method: record?.defaultMethodId ?? '', inputs: null },
  )
}

function replaceWorkbenchQuery(methodId: string, inputs: Record<string, unknown> | null, force = false): void {
  try {
    const query = canonicalWorkbenchQuery(methodId, inputs)
    if (force || !queriesEqual(route.query, query)) void router.replace({ query })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    actionErrors.value = { ...actionErrors.value, reset: message }
  }
}

function syncSelectedInputsToUrl(): void {
  const state = selectedInputState.value
  const method = selectedMethod.value
  if (!state || !method?.defaultInputs) return
  try {
    const parsed = JSON.parse(state.advancedText) as unknown
    const validated = validateEarthWorkbenchInputs(parsed, method.defaultInputs)
    replaceWorkbenchQuery(method.id, validated)
  } catch {
    // Invalid in-progress controls remain local and never replace canonical URL state.
  }
}

function syncAdvancedFromValues(state: MethodInputState): void {
  state.advancedText = JSON.stringify(state.values, null, 2)
  state.advancedError = ''
}

function syncFieldsFromValues(state: MethodInputState): void {
  inputFields.value.forEach((field) => {
    if (field.kind === 'json') state.fieldTexts[field.key] = JSON.stringify(state.values[field.key], null, 2)
  })
}

function updatePrimitiveField(field: WorkbenchInputField, event: Event): void {
  const state = selectedInputState.value
  const target = event.target as HTMLInputElement
  if (!state) return
  if (field.kind === 'checkbox') state.values[field.key] = target.checked
  else if (field.kind === 'number') state.values[field.key] = target.value === '' ? '' : target.valueAsNumber
  else state.values[field.key] = target.value
  delete state.fieldErrors[field.key]
  urlStateWarning.value = ''
  syncAdvancedFromValues(state)
  syncSelectedInputsToUrl()
}

function parseJsonField(field: WorkbenchInputField, reportError = true): boolean {
  const state = selectedInputState.value
  if (!state) return false
  try {
    const parsed = JSON.parse(state.fieldTexts[field.key] ?? '') as unknown
    const matches = field.jsonType === 'array' ? Array.isArray(parsed) : isJsonObject(parsed)
    if (!matches) throw new TypeError(`must be a JSON ${field.jsonType}`)
    state.values[field.key] = parsed
    delete state.fieldErrors[field.key]
    syncAdvancedFromValues(state)
    syncSelectedInputsToUrl()
    return true
  } catch (reason) {
    if (reportError) state.fieldErrors[field.key] = `${field.label} ${reason instanceof Error ? reason.message : String(reason)}.`
    return false
  }
}

function updateJsonField(field: WorkbenchInputField, event: Event): void {
  const state = selectedInputState.value
  if (!state) return
  state.fieldTexts[field.key] = (event.target as HTMLTextAreaElement).value
  urlStateWarning.value = ''
  delete state.fieldErrors[field.key]
  parseJsonField(field, false)
}

function updateAdvancedJson(event: Event): void {
  const state = selectedInputState.value
  if (!state) return
  state.advancedText = (event.target as HTMLTextAreaElement).value
  urlStateWarning.value = ''
  state.advancedError = ''
  try {
    const parsed = JSON.parse(state.advancedText) as unknown
    if (!isJsonObject(parsed)) return
    const method = selectedMethod.value
    if (!method?.defaultInputs) return
    const validated = validateEarthWorkbenchInputs(parsed, method.defaultInputs)
    state.values = structuredClone(validated)
    state.fieldErrors = {}
    syncFieldsFromValues(state)
    syncSelectedInputsToUrl()
  } catch {
    // Keep the in-progress editor text; validation reports the complete parse error.
  }
}

function validateInputs(): Record<string, unknown> | null {
  const state = selectedInputState.value
  const method = selectedMethod.value
  if (!state || !method?.defaultInputs) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(state.advancedText) as unknown
  } catch (reason) {
    state.advancedError = `Advanced input JSON is invalid: ${reason instanceof Error ? reason.message : String(reason)}`
    return null
  }
  if (!isJsonObject(parsed)) {
    state.advancedError = 'Advanced input JSON must be an object.'
    return null
  }
  const actualKeys = Object.keys(parsed).sort()
  const expectedKeys = Object.keys(method.defaultInputs).sort()
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    state.advancedError = `Advanced input JSON must contain exactly these fields: ${expectedKeys.join(', ')}.`
    return null
  }
  state.advancedError = ''
  state.values = structuredClone(parsed)
  let valid = true
  inputFields.value.forEach((field) => {
    const value = state.values[field.key]
    let message = ''
    if (field.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) message = `${field.label} must be a finite number.`
    if (field.kind === 'text' && typeof value !== 'string') message = `${field.label} must be text.`
    if (field.kind === 'checkbox' && typeof value !== 'boolean') message = `${field.label} must be true or false.`
    if (field.kind === 'json') {
      const matches = field.jsonType === 'array' ? Array.isArray(value) : isJsonObject(value)
      if (!matches) message = `${field.label} must be a JSON ${field.jsonType}.`
    }
    if (message) {
      state.fieldErrors[field.key] = message
      valid = false
    } else {
      delete state.fieldErrors[field.key]
    }
  })
  if (valid) {
    try {
      parsed = validateEarthWorkbenchInputs(parsed, method.defaultInputs)
    } catch (reason) {
      state.advancedError = reason instanceof Error ? reason.message : String(reason)
      valid = false
    }
  }
  syncFieldsFromValues(state)
  return valid ? structuredClone(parsed) : null
}

function abortExecution(): void {
  executionController?.abort()
  executionController = null
}

function restoreSelectedStatus(): void {
  executionError.value = ''
  if (completedResults.value[selectedMethodId.value]) {
    executionStatus.value = 'completed'
    progress.value = 100
  } else {
    executionStatus.value = 'idle'
    progress.value = 0
  }
}

function resetMethodInputs(method: WorkbenchMethod): void {
  const state = initializeInputState(method)
  if (state) inputStates.value = { ...inputStates.value, [method.id]: state }
}

function selectMethod(methodId: string, syncQuery = true): void {
  const record = simulation.value
  if (!record || !record.executionMethods.some(({ id }) => id === methodId)) methodId = record?.defaultMethodId ?? ''
  if (!methodId) return
  if (selectedMethodId.value !== methodId) {
    abortExecution()
    selectedMethodId.value = methodId
    const method = methods.value.find(({ id }) => id === methodId)
    if (method) resetMethodInputs(method)
    restoreSelectedStatus()
  }
  if (syncQuery) {
    urlStateWarning.value = ''
    replaceWorkbenchQuery(methodId, selectedInputState.value?.values ?? null)
  }
}

function selectMethodFromEvent(event: Event): void {
  selectMethod((event.target as HTMLSelectElement).value)
}

function restoreMethodDefaults(): void {
  const method = selectedMethod.value
  if (!method) return
  resetMethodInputs(method)
  urlStateWarning.value = ''
  actionErrors.value = {}
  replaceWorkbenchQuery(method.id, selectedInputState.value?.values ?? null, true)
}

function resetSelectedMethod(): void {
  const method = selectedMethod.value
  if (!method) return
  abortExecution()
  resetMethodInputs(method)
  const { [method.id]: _removed, ...retained } = completedResults.value
  completedResults.value = retained
  executionError.value = ''
  executionStatus.value = 'idle'
  progress.value = 0
  comparisonPair.value = createSnapshotPair()
  actionErrors.value = {}
  saveResult.value = ''
  urlStateWarning.value = ''
  replaceWorkbenchQuery(method.id, selectedInputState.value?.values ?? null, true)
}

async function runSelectedMethod(): Promise<void> {
  const record = simulation.value
  const method = selectedMethod.value
  if (!record || !method || !canRunSelected.value || !isEarthSimulationId(record.id)) return
  const inputs = validateInputs()
  if (!inputs) return
  const dispatchedInputs = cloneJsonValue(inputs, 'earth.dispatchedInputs')
  if (!isJsonObject(dispatchedInputs)) return

  abortExecution()
  const controller = new AbortController()
  executionController = controller
  executionError.value = ''
  progress.value = 0
  executionStatus.value = 'starting'

  try {
    const execution = await runEarthMethodInWorker(record.id, method.id as EarthMethodId, structuredClone(dispatchedInputs), {
      signal: controller.signal,
      onProgress(value) {
        if (executionController !== controller) return
        progress.value = value
        executionStatus.value = value >= 20 && value < 100 ? 'running' : 'starting'
      },
    })
    if (executionController !== controller) return
    executionController = null
    if (execution.status === 'completed') {
      const sourceRevision = methodSourceRevision(method)
      const finding = buildEarthWorkbenchFinding({
        programId: record.id,
        method,
        sourceRevision,
        sourceLocator: methodSourceLocator(method),
        resultStatus: execution.executionStatus ?? execution.status,
        output: execution.output,
        evidenceRefs: methodEvidenceRefs(method),
      })
      progress.value = 100
      executionStatus.value = 'completed'
      completedResults.value = {
        ...completedResults.value,
        [method.id]: {
          execution,
          dispatchedInputs,
          finding,
          sourceRevision,
          implementationRevision: EARTH_WORKER_ADAPTER_REVISION,
          modelRevision: earthModelRevision(record.id, method.id),
          outputSchemaRevision: EARTH_OUTPUT_SCHEMA_REVISION,
          compatibilityKey: earthCompatibilityKey(record.id, method, sourceRevision),
        },
      }
    } else if (execution.status === 'cancelled') {
      executionStatus.value = 'cancelled'
    } else {
      executionStatus.value = 'failed'
      executionError.value = execution.error
    }
  } catch (reason) {
    if (executionController !== controller) return
    executionController = null
    executionStatus.value = 'failed'
    executionError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function cancelExecution(): void {
  if (!executionController) return
  abortExecution()
  executionStatus.value = 'cancelled'
}

function snapshotInput(run: CompletedRun): WorkbenchSnapshotInputV1 {
  const method = methods.value.find(({ id }) => id === run.execution.methodId)
  const record = simulation.value
  if (!record || !method) throw new Error('The completed EARTH method is no longer available.')
  return {
    programId: record.id,
    methodId: method.id,
    inputs: run.dispatchedInputs,
    outputs: {
      output: cloneJsonValue(run.execution.output, 'earth.result.output'),
      diagnostics: cloneJsonValue(run.execution.diagnostics, 'earth.result.diagnostics'),
      executionStatus: run.execution.executionStatus ?? run.execution.status,
      method: run.execution.method,
    },
    finding: cloneJsonValue(run.finding, 'earth.result.finding') as JsonObject,
    provenance: cloneJsonValue({
      ...run.execution.provenance,
      programId: record.id,
      methodId: method.id,
      relationship: method.relationship,
      modelOrigin: method.modelOrigin,
      validatesEarthTheory: false,
    }, 'earth.result.provenance') as JsonObject,
    sourceRevision: run.sourceRevision,
    implementationRevision: run.implementationRevision,
    modelRevision: run.modelRevision,
    compatibilityKey: run.compatibilityKey,
    label: `${record.id} / ${method.title}`,
  }
}

function saveSelectedRun(): void {
  const run = selectedCompletedRun.value
  if (!run) return
  actionErrors.value = {}
  saveResult.value = ''
  try {
    const saved = savedRunRegistry.save(snapshotInput(run))
    if (savedRunRegistry.persistenceError.value) {
      actionErrors.value = { save: 'The run is retained for this session, but browser storage could not save it.' }
    } else {
      saveResult.value = `Saved EARTH run at ${saved.timestamp}.`
    }
  } catch (reason) {
    actionErrors.value = { save: reason instanceof Error ? reason.message : String(reason) }
  }
}

function freezeSelectedRun(): void {
  const run = selectedCompletedRun.value
  if (!run || comparisonPair.value.length === 2) return
  actionErrors.value = {}
  try {
    const timestamp = new Date(Date.now() + comparisonPair.value.length).toISOString()
    const snapshot = createWorkbenchSnapshot(snapshotInput(run), timestamp)
    comparisonPair.value = addSnapshot(comparisonPair.value, snapshot)
  } catch (reason) {
    actionErrors.value = { freeze: reason instanceof Error ? reason.message : String(reason) }
  }
}

function clearComparison(): void {
  comparisonPair.value = createSnapshotPair()
  actionErrors.value = {}
}

function resultScalarOutputs(result: CompletedExecution | null): Array<{ key: string, value: unknown, unit: string }> {
  if (!result || !isJsonObject(result.output)) return []
  return Object.entries(result.output)
    .filter(([, value]) => isScalar(value))
    .map(([key, value]) => ({ key, value, unit: inferExplicitUnit(key) }))
}

function resultStructuredOutputs(result: CompletedExecution | null): Array<{ key: string, value: unknown }> {
  if (!result) return []
  if (!isJsonObject(result.output)) return [{ key: 'Output', value: result.output }]
  return Object.entries(result.output)
    .filter(([, value]) => !isScalar(value))
    .map(([key, value]) => ({ key, value }))
}

function ledgerOutput(result: CompletedExecution | null): string {
  const outputs = resultScalarOutputs(result).slice(0, 3)
  if (!outputs.length) return result ? 'Completed · structured output available' : 'Not run'
  return outputs.map(({ key, value, unit }) => `${humanizeKey(key)}: ${formatScalar(value)}${unit ? ` ${unit}` : ''}`).join(' · ')
}

function applyRouteWorkbenchState(): void {
  const record = simulation.value
  if (!record) return
  const requestedMethod = typeof route.query.method === 'string'
    && record.executionMethods.some(({ id }) => id === route.query.method)
    ? route.query.method
    : record.defaultMethodId
  const rejected: string[] = []
  if (route.query.method !== undefined && requestedMethod !== route.query.method) rejected.push('method')
  selectMethod(requestedMethod, false)

  const method = selectedMethod.value
  let inputs = method?.defaultInputs ? structuredClone(method.defaultInputs) : null
  if (method?.defaultInputs && route.query.inputs !== undefined) {
    try {
      inputs = structuredClone(validateEarthWorkbenchInputs(
        decodeWorkbenchInputEnvelope(route.query.inputs),
        method.defaultInputs,
      ))
    } catch (reason) {
      inputs = structuredClone(method.defaultInputs)
      rejected.push(`inputs (${reason instanceof Error ? reason.message : String(reason)})`)
    }
  } else if (route.query.inputs !== undefined) {
    rejected.push('inputs (the selected method has no local input contract)')
  }
  if (rejected.length) {
    urlStateWarning.value = `Requested EARTH URL state was rejected for ${rejected.join(', ')}. Canonical method defaults were restored.`
    retainRejectedUrlWarning = true
  } else if (retainRejectedUrlWarning) {
    retainRejectedUrlWarning = false
  } else {
    urlStateWarning.value = ''
  }
  if (method && inputs) inputStates.value = { ...inputStates.value, [method.id]: inputStateFromValues(inputs) }
  replaceWorkbenchQuery(requestedMethod, inputs)
}

watch(() => [props.id, props.surface] as const, async ([id], _previous, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => {
    controller.abort()
    abortExecution()
  })
  abortExecution()
  bundle.value = null
  simulation.value = null
  datasetRegistry.value = null
  programEvidence.value = null
  evidenceError.value = ''
  evidenceLoading.value = false
  evidenceLimit.value = 18
  error.value = ''
  selectedMethodId.value = ''
  inputStates.value = {}
  completedResults.value = {}
  comparisonPair.value = createSnapshotPair()
  actionErrors.value = {}
  saveResult.value = ''
  urlStateWarning.value = ''
  executionError.value = ''
  executionStatus.value = 'idle'
  progress.value = 0
  try {
    const loaded = await loadScientificSimulationBundle(controller.signal)
    const match = loaded.registry.records.find((record) => record.id === id)
    if (!match) throw new Error(`Unknown EARTH program: ${id}`)
    bundle.value = loaded
    simulation.value = match
    inputStates.value = Object.fromEntries(methods.value.flatMap((method) => {
      const state = initializeInputState(method)
      return state ? [[method.id, state]] : []
    }))
    applyRouteWorkbenchState()

    if (!isWorkbenchSurface.value && loaded.sourceRevision && isEarthSimulationId(match.id)) {
      evidenceLoading.value = true
      try {
        const loadedDatasets = await loadEarthDatasetRegistry(controller.signal)
        const evidenceManifest = await loadEarthEvidenceManifest(loaded.sourceRevision, {
          programIds: loaded.registry.records.map(({ id: programId }) => programId),
          documentIds: loaded.sourceDocuments.keys(),
        }, controller.signal)
        if (evidenceManifest.sourcePlan.sha256 !== loadedDatasets.sourcePlan.sha256
          || evidenceManifest.datasetRegistry.sha256 !== loadedDatasets.sourceRegistry.sha256) {
          throw new Error('EARTH evidence integrity error: dataset registry revision mismatch')
        }
        const entry = evidenceManifest.programs.find(({ id: programId }) => programId === match.id)
        if (!entry) throw new Error(`Missing EARTH program evidence: ${match.id}`)
        const loadedEvidence = await loadEarthProgramEvidence(entry, evidenceManifest, {
          documentIds: loaded.sourceDocuments.keys(),
          datasetIds: loadedDatasets.datasets.map(({ datasetId }) => datasetId),
          disputedClaimIds: loadedDatasets.disputedClaims.map(({ claimId }) => claimId),
        }, controller.signal)
        datasetRegistry.value = loadedDatasets
        programEvidence.value = loadedEvidence
      } catch (reason) {
        if (!controller.signal.aborted) evidenceError.value = reason instanceof Error ? reason.message : String(reason)
      } finally {
        if (!controller.signal.aborted) evidenceLoading.value = false
      }
    }
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}, { immediate: true })

watch(() => [route.query.method, route.query.inputs], applyRouteWorkbenchState)

onUnmounted(abortExecution)
</script>

<template lang="pug">
.view.earth-simulation-detail-view(:data-surface="props.surface")
  EarthLocalNav(v-if="!isWorkbenchSurface")
  RouterLink.earth-back-link(v-if="isWorkbenchSurface" to="/labs") ← Workbench index
  RouterLink.earth-back-link(v-else to="/earth/programs") ← 03/C Program registry
  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!simulation") Loading EARTH program…

  template(v-else)
    header.detail-header.earth-simulation-header(:data-testid="isWorkbenchSurface ? 'earth-workbench-header' : 'earth-evidence-header'")
      .detail-index
        code {{ simulation.id }}
        span {{ simulation.prefix }} / {{ simulation.classification }}
      .detail-title
        p.eyebrow {{ isWorkbenchSurface ? 'Workbench / EARTH bounded method' : '03/C / Program question' }} / intended tier {{ simulation.executionTiers.join(' + ') }}
        h1 {{ simulation.title }}
        p {{ simulation.highLevelGoal }}
      .detail-status.earth-readiness-stack
        strong(:class="{ 'is-source-blocked': simulation.sourceState.status === 'blocked' }") {{ sourceReadinessLabel }}
        span {{ scientificReadinessLabel }}
        span {{ methodAvailabilityLabel }}

    section.simulation-goal-section(v-if="!isWorkbenchSurface" aria-labelledby="program-question-heading")
      p.eyebrow 01 / Question
      h2#program-question-heading {{ simulation.highLevelGoal }}
      ul.simulation-minor-goals
        li(v-for="goal in simulation.minorGoals" :key="goal") {{ goal }}

    section.simulation-source-section(v-if="!isWorkbenchSurface" aria-labelledby="source-readiness-heading")
      p.eyebrow 02 / Source readiness
      h2#source-readiness-heading {{ sourceReadinessLabel }}
      p.simulation-source-state {{ simulation.sourceState.text }}
      strong.simulation-validation-caveat SCIENTIFIC VALIDATION NOT ESTABLISHED
      h3 Source records
      ul.simulation-source-links(data-testid="simulation-source-links")
        li(v-for="document in sourceDocuments" :key="document.id")
          RouterLink(:to="`/earth/corpus/${document.slug}`") {{ document.title }}

    section.simulation-workbench-section(aria-labelledby="method-workbench-heading")
      p.eyebrow 03 / Declared methods
      h2#method-workbench-heading Method workbench
      p.simulation-run-copy Select one bounded execution method. Method choice changes inputs, provenance, runtime, and retained result independently of source readiness.
      WorkbenchShell(
        v-if="selectedMethod"
        :title="selectedMethod.title"
        :identity="`${simulation.id} / ${selectedMethod.id}`"
        :provenance="workbenchProvenance"
        conclusion="Scientific validation is not established. Each result is bounded to its exact method relationship and dispatched inputs."
        :execution-mode="workbenchExecutionMode"
        :status="workbenchStatus"
        :progress="progress"
        :capabilities="{ save: canRunSelected, compare: canRunSelected }"
        :snapshot-count="snapshotCount"
        :has-result="Boolean(selectedResult)"
        :action-errors="actionErrors"
        :state-warning="urlStateWarning"
        heading-level="h3"
        :execution-message="workbenchExecutionMessage"
        :unavailable-reason="integrityError || selectedMethod.model"
        :action-labels="{ run: 'Run selected method', cancel: 'Cancel dispatch', reset: 'Reset selected method' }"
        @run="runSelectedMethod"
        @cancel="cancelExecution"
        @reset="resetSelectedMethod"
        @save="saveSelectedRun"
        @freeze="freezeSelectedRun"
        @clear-compare="clearComparison"
      )
        template(#identity)
          p {{ simulation.id }} / {{ selectedMethod.id }}
          small {{ selectedMethod.title }}

        template(#essential-controls)
          label.simulation-method-mobile-label(for="earth-method-select") Selected execution method
          select#earth-method-select.simulation-method-mobile(
            :value="selectedMethodId"
            data-testid="simulation-method-select"
            @change="selectMethodFromEvent"
          )
            option(v-for="method in methods" :key="method.id" :value="method.id") {{ method.title }}
          button.text-button(
            v-if="selectedMethod.defaultInputs"
            type="button"
            data-testid="simulation-method-defaults"
            :disabled="running"
            @click="restoreMethodDefaults"
          ) Restore method-default preset

        template(#stage)
          article.simulation-result(v-if="selectedResult" aria-label="Method result" data-testid="simulation-result")
            .simulation-result-heading
              div
                span Execution status
                strong {{ selectedResult.executionStatus ?? selectedResult.status }}
              div
                span Method
                strong {{ selectedMethod.title }}
            p.simulation-result-stale(v-if="selectedResultStale" role="status" data-testid="simulation-result-stale") Result stale: controls differ from the dispatched inputs frozen with this result.
            p.simulation-finding-summary(v-if="selectedFinding") {{ selectedFinding.changed }}
            section.simulation-scalar-outputs
              h4 Key scalar outputs
              dl(v-if="scalarOutputs.length")
                template(v-for="output in scalarOutputs" :key="output.key")
                  dt {{ humanizeKey(output.key) }}
                  dd {{ formatScalar(output.value) }}{{ output.unit ? ` ${output.unit}` : '' }}
              p(v-else) No top-level scalar outputs were returned.
            section.simulation-diagnostics
              h4 Diagnostics
              dl
                template(v-for="([key, value]) in resultDiagnostics" :key="key")
                  dt {{ humanizeKey(key) }}
                  dd {{ formatScalar(value) }}
            section.simulation-structured-outputs(v-if="structuredOutputs.length")
              h4 Structured outputs
              article(v-for="output in structuredOutputs" :key="output.key")
                h5 {{ humanizeKey(output.key) }}
                EarthStructuredValue(:value="output.value")
          p.simulation-result-empty(v-else-if="canRunSelected") Run the selected method to create a session result. Completed results remain method-addressed while this program page is open.
          p.simulation-result-empty(v-else) This unavailable source formulation cannot create a result.

        template(#findings)
          WorkbenchFinding(v-if="selectedFinding" :finding="selectedFinding" heading-level="h5")
          p(v-else) No finding has been evaluated for this method. Scientific validation remains unestablished.
          p.save-result(v-if="saveResult" role="status" data-testid="earth-save-result") {{ saveResult }}
          WorkbenchCompare(:pair="comparisonPair" heading-level="h5")
            template(#domain-comparison)
              dl(v-if="parallelScalarDeltas.length" data-testid="earth-parallel-scalar-deltas")
                template(v-for="delta in parallelScalarDeltas" :key="delta.key")
                  dt {{ humanizeKey(delta.key) }} delta (snapshot 2 − snapshot 1)
                  dd {{ formatScalar(delta.delta) }}{{ delta.unit ? ` ${delta.unit}` : '' }}
              p(v-else data-testid="earth-parallel-findings-only") No declared parallel scalar keys with matching inferred units are available. Findings remain parallel; no generic residual is inferred.

        template(#controls)
          .simulation-run-form(v-if="canRunSelected && selectedInputState")
            fieldset.simulation-input-controls(:disabled="running")
              legend Method inputs
              p.simulation-input-empty(v-if="!inputFields.length") This method has no configurable inputs.
              .simulation-input-grid(v-else)
                .simulation-input-control(v-for="field in inputFields" :key="field.key" :class="{ 'is-json-field': field.kind === 'json' }")
                  template(v-if="field.kind === 'checkbox'")
                    label.simulation-checkbox-field(:for="inputId(field.key)")
                      input(
                        :id="inputId(field.key)"
                        type="checkbox"
                        :checked="Boolean(selectedInputState.values[field.key])"
                        :aria-describedby="inputDescribedBy(field)"
                        :aria-invalid="Boolean(selectedInputState.fieldErrors[field.key])"
                        :data-testid="`simulation-input-${field.key}`"
                        @change="updatePrimitiveField(field, $event)"
                      )
                      span {{ field.label }}
                  template(v-else-if="field.kind === 'json'")
                    label(:for="inputId(field.key)") {{ field.label }}
                    textarea(
                      :id="inputId(field.key)"
                      :value="selectedInputState.fieldTexts[field.key]"
                      rows="6"
                      spellcheck="false"
                      :aria-describedby="inputDescribedBy(field)"
                      :aria-invalid="Boolean(selectedInputState.fieldErrors[field.key])"
                      :data-testid="`simulation-input-${field.key}`"
                      @input="updateJsonField(field, $event)"
                      @blur="parseJsonField(field)"
                    )
                  template(v-else)
                    label(:for="inputId(field.key)") {{ field.label }}
                    .simulation-input-with-unit
                      input(
                        :id="inputId(field.key)"
                        :type="field.kind === 'number' ? 'number' : 'text'"
                        :step="field.kind === 'number' ? 'any' : undefined"
                        :value="selectedInputState.values[field.key]"
                        :aria-describedby="inputDescribedBy(field)"
                        :aria-invalid="Boolean(selectedInputState.fieldErrors[field.key])"
                        :data-testid="`simulation-input-${field.key}`"
                        @input="updatePrimitiveField(field, $event)"
                      )
                      span(v-if="field.unit") {{ field.unit }}
                  small(:id="inputDescriptionId(field)") Default: {{ field.kind === 'json' ? `${field.jsonType} JSON` : formatScalar(field.defaultValue) }}{{ field.unit ? ` ${field.unit}` : '' }}
                  p.inline-error(v-if="selectedInputState.fieldErrors[field.key]" :id="inputErrorId(field)" role="alert") {{ selectedInputState.fieldErrors[field.key] }}
            details.simulation-advanced-inputs(data-testid="simulation-advanced-inputs")
              summary Advanced JSON editor
              p Edit the complete method input object. Valid edits synchronize the field controls above.
              label.simulation-input-field(for="earth-simulation-inputs") Complete method input / JSON
              textarea#earth-simulation-inputs(
                :value="selectedInputState.advancedText"
                data-testid="simulation-inputs"
                rows="12"
                spellcheck="false"
                :disabled="running"
                :aria-describedby="selectedInputState.advancedError ? 'earth-advanced-input-error' : undefined"
                :aria-invalid="Boolean(selectedInputState.advancedError)"
                @input="updateAdvancedJson"
              )
              p#earth-advanced-input-error.inline-error(v-if="selectedInputState.advancedError" role="alert" data-testid="simulation-input-error") {{ selectedInputState.advancedError }}
          .simulation-execution-status(v-if="canRunSelected" aria-live="polite" data-testid="simulation-status")
            span Dispatch status
            strong {{ executionStatus }}
            small {{ progressStage }}
          .simulation-progress(
            v-if="canRunSelected"
            role="progressbar"
            aria-label="Worker dispatch state"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            data-testid="simulation-progress"
          )
            i(:style="{ width: `${progress}%` }")
            span Dispatch checkpoint {{ progress }} / 100 · {{ progressStage }}
          p.inline-error(v-if="executionError" role="alert" data-testid="simulation-execution-error") {{ executionError }}

        template(#method)
          fieldset.simulation-method-rail(data-testid="simulation-method-rail")
            legend Execution methods
            label.simulation-method-option(v-for="method in methods" :key="method.id" :class="{ 'is-selected': method.id === selectedMethodId }")
              input(type="radio" name="earth-execution-method" :value="method.id" :checked="method.id === selectedMethodId" @change="selectMethod(method.id)")
              strong {{ method.title }}
              span {{ formatToken(method.relationship) }}
              small {{ method.runtime }} · {{ method.runnable ? 'runnable' : 'no local control' }}
          article.simulation-method-sheet(data-testid="selected-method-sheet")
            p.simulation-method-model {{ selectedMethod.model }}
            dl.simulation-provenance-grid(data-testid="method-provenance")
              dt Relationship
              dd {{ formatToken(selectedMethod.relationship) }}
              dt Model origin
              dd {{ formatToken(selectedMethod.modelOrigin) }}
              dt EARTH-derived
              dd {{ selectedMethod.earthDerived }}
              dt Intended program tier
              dd {{ simulation.executionTiers.join(' + ') }}{{ simulation.tierSource ? ` · source ${simulation.tierSource}` : '' }}
              dt Actual adapter runtime
              dd {{ formatToken(selectedMethod.runtime) }}
              dt Runnable here
              dd {{ canRunSelected }}
              dt Numerical precision
              dd {{ selectedMethod.precision }}
              dt Validates EARTH theory
              dd false
            p.inline-error(v-if="integrityError" role="alert" data-testid="simulation-integrity-error") {{ integrityError }}
            p.simulation-method-unavailable(v-if="!canRunSelected" data-testid="simulation-method-unavailable")
              strong Source formulation unavailable.
              |  {{ selectedMethod.model }} No local execution controls are exposed for this registry-only method.

        template(#evidence)
          p(v-if="isWorkbenchSurface") This bounded method links to the canonical Evidence record; the Workbench does not load or reproduce its dossier.
          p(v-else) The complete evidence dossier remains below with exact assignments, linked documents, datasets, disputed claims, gates, and blockers.
          p {{ evidenceRefs.length }} source or assignment references currently linked to this method finding.
          RouterLink.text-link(v-if="isWorkbenchSurface" :to="`/earth/programs/${simulation.id}`") Open canonical Evidence record

        template(#raw)
          section.simulation-raw-result(v-if="selectedResult" data-testid="simulation-raw-result")
            h4 Raw JSON result
            pre
              code {{ JSON.stringify({ dispatchedInputs: selectedCompletedRun?.dispatchedInputs, result: selectedResult }, null, 2) }}
          p(v-else) No raw result is available for this method.

    section.simulation-results-section(v-if="!isWorkbenchSurface" aria-labelledby="simulation-results-heading")
      p.eyebrow 04 / Results
      h2#simulation-results-heading Method-addressed session ledger
      p Current structured output, diagnostics, finding, and raw result are shown in the shared workbench stage above. Frozen comparison snapshots remain immutable across reruns.

      section.simulation-run-ledger(v-if="methods.length > 1 && completedResultEntries.some(({ result }) => result)" data-testid="simulation-run-ledger")
        h3 Session run ledger
        p Completion and scalar outputs are listed by provenance. No residual is inferred between unlike quantities.
        .simulation-run-ledger-row(v-for="entry in completedResultEntries" :key="entry.method.id")
          strong {{ entry.method.title }}
          span {{ formatToken(entry.method.relationship) }} · {{ formatToken(entry.method.modelOrigin) }}
          b {{ entry.result ? 'COMPLETED' : 'NOT RUN' }}
          small {{ ledgerOutput(entry.result) }}

    section.simulation-evidence-section(v-if="!isWorkbenchSurface" aria-labelledby="program-evidence-heading")
      p.eyebrow 05 / Program and source evidence
      h2#program-evidence-heading Evidence ledger
      p.inline-error(v-if="evidenceError" role="alert" data-testid="program-evidence-error") {{ evidenceError }}
      p.earth-loading(v-else-if="evidenceLoading" aria-live="polite") Loading exact program evidence shard…
      template(v-else-if="programEvidence")
        section.program-evidence-summary(data-testid="program-evidence-summary")
          article
            span Formula records
            strong {{ programEvidence.counts.bySourceType.formula }}
          article
            span Code blocks
            strong {{ programEvidence.counts.bySourceType['code-block'] }}
          article
            span Simulation candidates
            strong {{ programEvidence.counts.bySourceType['simulation-candidate'] }}
          article
            span Confidence
            strong {{ programEvidence.counts.byConfidence.high }}H / {{ programEvidence.counts.byConfidence.medium }}M / {{ programEvidence.counts.byConfidence.low }}L

        section.program-source-evidence
          p.eyebrow Exact source coverage
          h3 Assigned source records
          p These are program-level coverage assignments. A simulation candidate record is not an executable method, and no source record is silently attributed to the selected runtime method.
          .program-evidence-records(data-testid="program-evidence-records")
            article(v-for="assignment in visibleEvidenceAssignments" :key="assignment.sourceId")
              div
                code {{ assignment.sourceType }}
                span confidence {{ assignment.confidence }}
              strong {{ assignment.sourceId }}
              RouterLink(v-if="evidenceDocument(assignment.documentId)" :to="`/earth/corpus/${evidenceDocument(assignment.documentId)?.slug}`") {{ evidenceDocument(assignment.documentId)?.title }}
              details
                summary Assignment basis and source identities
                ul
                  li(v-for="basis in assignment.assignmentBasis" :key="basis") {{ basis }}
                pre {{ JSON.stringify(assignment.sourceIds, null, 2) }}
          button.text-button(
            v-if="programEvidence.assignments.length > visibleEvidenceAssignments.length"
            type="button"
            data-testid="program-evidence-more"
            @click="showMoreEvidence"
          ) Show 24 more source records ({{ programEvidence.assignments.length - visibleEvidenceAssignments.length }} remain)

        .program-evidence-relations
          section.program-linked-documents
            p.eyebrow Source and plan links
            h3 Linked documents
            ul
              li(v-for="document in evidenceDocuments" :key="document.id")
                RouterLink(:to="`/earth/corpus/${document.slug}`") {{ document.title }}
          section.program-dataset-requirements(data-testid="program-dataset-requirements")
            p.eyebrow Dataset registry requirements
            h3 {{ datasetRequirements.length }} linked datasets
            p Dataset-to-method assignment is not frozen. The source registry identifies this canonical program, not an execution method, unless separate source evidence says otherwise.
            ul(v-if="datasetRequirements.length")
              li(v-for="dataset in datasetRequirements" :key="dataset.datasetId")
                RouterLink(:to="{ path: '/earth/datasets', query: { dataset: dataset.datasetId, program: simulation.id } }") {{ dataset.name }}
                span {{ dataset.priority }} · G0b {{ dataset.g0bState }} · {{ dataset.acquisitionStatus }}
            p(v-else) No dataset requirement is registered for this program.
            div.program-disputed-links(v-if="disputedClaims.length")
              strong Disputed source claims
              RouterLink(
                v-for="claim in disputedClaims"
                :key="claim.claimId"
                :to="{ path: '/earth/datasets', query: { program: simulation.id, claim: claim.claimId } }"
              ) {{ claim.claimId }}

      section.simulation-method-section
        p.eyebrow Program plan method
        h3 Source plan method, not selected runtime evidence
        article.simulation-method-block(v-for="([name, value]) in methodSections" :key="name")
          h4 {{ name }}
          ul
            li(v-for="line in methodLines(value)" :key="line")
              code(v-if="isEquationSection(name)") {{ line }}
              span(v-else) {{ line }}

      section.simulation-observables-section
        p.eyebrow Declared outputs
        h3 Outputs
        ul
          li(v-for="output in simulation.outputs" :key="output") {{ output }}

      .simulation-ledger-layout
        section.simulation-dependencies-section
          p.eyebrow Program dependency ledger
          h3 Dependencies
          ul(v-if="simulation.dependencies.length")
            li(v-for="dependency in simulation.dependencies" :key="dependency")
              RouterLink(v-if="dependencyRecord(dependency)" :to="`/earth/programs/${encodeURIComponent(dependency)}`") {{ dependencyRecord(dependency)?.title }}
              span(v-else) {{ dependency }}
          p(v-else) No dependencies declared.

        section.simulation-gates-section
          p.eyebrow Program / source scope gates
          h3 Gate states
          p These gates describe the program or source record, not evidence produced by the selected method.
          dl(data-testid="simulation-gates")
            template(v-for="(gateState, gate) in simulation.gateStates" :key="gate")
              dt {{ gate }}
              dd {{ gateState === 'blocked' ? 'program/source blocked' : gateState }}

      section.simulation-blockers-section(:class="{ 'is-blocked': isSimulationBlocked(simulation), 'has-scientific-blockers': simulation.blockers.length > 0 }")
        p.eyebrow Program / source scope blockers
        h3 {{ isSimulationBlocked(simulation) ? 'Program execution blocked' : simulation.blockers.length ? 'Scientific limitations' : 'No active program blockers' }}
        ul(v-if="simulation.blockers.length")
          li(v-for="blocker in simulation.blockers" :key="blocker") {{ blocker }}
        p(v-else-if="isSimulationBlocked(simulation)") Program registry execution is blocked without a separate blocker note.
        p(v-else) All declared program blockers are clear.
</template>
