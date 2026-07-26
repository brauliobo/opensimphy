<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import EarthStructuredValue from '../components/EarthStructuredValue.vue'
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
  buildInputFields,
  formatScalar,
  formatToken,
  humanizeKey,
  inferExplicitUnit,
  isJsonObject,
  isScalar,
  type WorkbenchInputField,
} from '../earth/workbench'
import {
  getEarthMethodDefinition,
  isEarthSimulationId,
  type EarthMethodId,
} from '../engine/earth'
import type { EarthWorkerExecution } from '../types/earthWorkers'

type ExecutionStatus = 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed'
type CompletedExecution = Extract<EarthWorkerExecution, { status: 'completed' }>

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

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
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
const completedResults = ref<Record<string, CompletedExecution>>({})
let executionController: AbortController | null = null

const sourceDocuments = computed(() => simulation.value?.sourceDocumentIds.map((id) => (
  bundle.value?.sourceDocuments.get(id)
)).filter((document): document is EarthDocumentRecord => Boolean(document)) ?? [])
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
const selectedResult = computed(() => completedResults.value[selectedMethodId.value] ?? null)
const completedResultEntries = computed(() => methods.value.map((method) => ({
  method,
  result: completedResults.value[method.id] ?? null,
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
  const values = structuredClone(method.defaultInputs)
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
  syncAdvancedFromValues(state)
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
  delete state.fieldErrors[field.key]
  parseJsonField(field, false)
}

function updateAdvancedJson(event: Event): void {
  const state = selectedInputState.value
  if (!state) return
  state.advancedText = (event.target as HTMLTextAreaElement).value
  state.advancedError = ''
  try {
    const parsed = JSON.parse(state.advancedText) as unknown
    if (!isJsonObject(parsed)) return
    state.values = parsed
    state.fieldErrors = {}
    syncFieldsFromValues(state)
  } catch {
    // Keep the in-progress editor text; validation reports the complete parse error.
  }
}

function validateInputs(): Record<string, unknown> | null {
  const state = selectedInputState.value
  if (!state) return null
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
  state.advancedError = ''
  state.values = parsed
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
  syncFieldsFromValues(state)
  return valid ? parsed : null
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

function replaceMethodQuery(methodId: string): void {
  const routeMethod = typeof route.query.method === 'string' ? route.query.method : ''
  if (routeMethod === methodId) return
  void router.replace({ query: { ...route.query, method: methodId } })
}

function selectMethod(methodId: string, syncQuery = true): void {
  const record = simulation.value
  if (!record || !record.executionMethods.some(({ id }) => id === methodId)) methodId = record?.defaultMethodId ?? ''
  if (!methodId) return
  if (selectedMethodId.value !== methodId) {
    abortExecution()
    selectedMethodId.value = methodId
    restoreSelectedStatus()
  }
  if (syncQuery) replaceMethodQuery(methodId)
}

function selectMethodFromEvent(event: Event): void {
  selectMethod((event.target as HTMLSelectElement).value)
}

async function runSelectedMethod(): Promise<void> {
  const record = simulation.value
  const method = selectedMethod.value
  if (!record || !method || !canRunSelected.value || !isEarthSimulationId(record.id)) return
  const inputs = validateInputs()
  if (!inputs) return

  abortExecution()
  const controller = new AbortController()
  executionController = controller
  executionError.value = ''
  progress.value = 0
  executionStatus.value = 'starting'

  try {
    const execution = await runEarthMethodInWorker(record.id, method.id as EarthMethodId, inputs, {
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
      progress.value = 100
      executionStatus.value = 'completed'
      completedResults.value = { ...completedResults.value, [method.id]: execution }
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

function scientificFinding(method: WorkbenchMethod): string {
  if (method.relationship === 'earth-source-reproduction') {
    return 'Source reproduction / audit only. This result evaluates the declared EARTH source expression; scientific validation is not established.'
  }
  if (method.relationship.startsWith('traditional-')) {
    return 'Independent traditional baseline. This result is not an EARTH source reproduction and does not validate EARTH theory; scientific validation is not established.'
  }
  return 'Source-contract audit only. This checks a bounded contract rather than reproducing or validating a physical model; scientific validation is not established.'
}

function ledgerOutput(result: CompletedExecution | null): string {
  const outputs = resultScalarOutputs(result).slice(0, 3)
  if (!outputs.length) return result ? 'Completed · structured output available' : 'Not run'
  return outputs.map(({ key, value, unit }) => `${humanizeKey(key)}: ${formatScalar(value)}${unit ? ` ${unit}` : ''}`).join(' · ')
}

watch(() => props.id, async (id, _previous, onCleanup) => {
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
    const requested = typeof route.query.method === 'string' ? route.query.method : ''
    selectMethod(match.executionMethods.some(({ id: methodId }) => methodId === requested) ? requested : match.defaultMethodId)

    if (loaded.sourceRevision && isEarthSimulationId(match.id)) {
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

watch(() => route.query.method, (method) => {
  const record = simulation.value
  if (!record) return
  const requested = typeof method === 'string' && record.executionMethods.some(({ id }) => id === method)
    ? method
    : record.defaultMethodId
  selectMethod(requested)
})

onUnmounted(abortExecution)
</script>

<template lang="pug">
.view.earth-simulation-detail-view
  EarthLocalNav
  RouterLink.earth-back-link(to="/earth/programs") ← 03/C Program registry
  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!simulation") Loading EARTH program…

  template(v-else)
    header.detail-header.earth-simulation-header
      .detail-index
        code {{ simulation.id }}
        span {{ simulation.prefix }} / {{ simulation.classification }}
      .detail-title
        p.eyebrow 03/C / Program question / intended tier {{ simulation.executionTiers.join(' + ') }}
        h1 {{ simulation.title }}
        p {{ simulation.highLevelGoal }}
      .detail-status.earth-readiness-stack
        strong(:class="{ 'is-source-blocked': simulation.sourceState.status === 'blocked' }") {{ sourceReadinessLabel }}
        span {{ scientificReadinessLabel }}
        span {{ methodAvailabilityLabel }}

    section.simulation-goal-section(aria-labelledby="program-question-heading")
      p.eyebrow 01 / Question
      h2#program-question-heading {{ simulation.highLevelGoal }}
      ul.simulation-minor-goals
        li(v-for="goal in simulation.minorGoals" :key="goal") {{ goal }}

    section.simulation-source-section(aria-labelledby="source-readiness-heading")
      p.eyebrow 02 / Source readiness
      h2#source-readiness-heading {{ sourceReadinessLabel }}
      p.simulation-source-state {{ simulation.sourceState.text }}
      strong.simulation-validation-caveat SCIENTIFIC VALIDATION NOT ESTABLISHED
      h3 Source records
      ul.simulation-source-links(data-testid="simulation-source-links")
        li(v-for="document in sourceDocuments" :key="document.id")
          RouterLink(:to="`/earth/corpus/${document.slug}`") {{ document.title }}

    section.simulation-workbench-section(aria-labelledby="method-workbench-heading" :aria-busy="running")
      p.eyebrow 03 / Declared methods
      h2#method-workbench-heading Method workbench
      p.simulation-run-copy Select one bounded execution method. Method choice changes inputs, provenance, runtime, and retained result independently of source readiness.
      label.simulation-method-mobile-label(for="earth-method-select") Selected execution method
      select#earth-method-select.simulation-method-mobile(
        :value="selectedMethodId"
        data-testid="simulation-method-select"
        @change="selectMethodFromEvent"
      )
        option(v-for="method in methods" :key="method.id" :value="method.id") {{ method.title }}

      .simulation-workbench-layout
        fieldset.simulation-method-rail(data-testid="simulation-method-rail")
          legend Execution methods
          label.simulation-method-option(v-for="method in methods" :key="method.id" :class="{ 'is-selected': method.id === selectedMethodId }")
            input(
              type="radio"
              name="earth-execution-method"
              :value="method.id"
              :checked="method.id === selectedMethodId"
              @change="selectMethod(method.id)"
            )
            strong {{ method.title }}
            span {{ formatToken(method.relationship) }}
            small {{ method.runtime }} · {{ method.runnable ? 'runnable' : 'no local control' }}

        article.simulation-method-sheet(v-if="selectedMethod" data-testid="selected-method-sheet")
          p.eyebrow Selected method
          h3 {{ selectedMethod.title }}
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
            dd {{ selectedMethod.runnable && selectedMethod.runtime === 'browser-worker' ? 'true' : 'false' }}
            dt Numerical precision
            dd {{ selectedMethod.precision }}
            dt Validates EARTH theory
            dd false

          template(v-if="integrityError")
            h4 Execution unavailable
            p.inline-error(role="alert" data-testid="simulation-integrity-error") {{ integrityError }}

          form.simulation-run-form(v-else-if="canRunSelected && selectedInputState" @submit.prevent="runSelectedMethod")
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

            .simulation-run-actions
              button.button-link(type="submit" :disabled="running" data-testid="simulation-run-control") {{ running ? 'Dispatching selected method…' : 'Run selected method' }}
              button.text-button(v-if="running" type="button" data-testid="simulation-cancel" @click="cancelExecution") Cancel dispatch

          p.simulation-method-unavailable(v-else data-testid="simulation-method-unavailable")
            strong Source formulation unavailable.
            |  {{ selectedMethod.model }} No local execution controls are exposed for this registry-only method.

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

    section.simulation-results-section(aria-labelledby="simulation-results-heading")
      p.eyebrow 04 / Results
      h2#simulation-results-heading Method results
      article.simulation-result(v-if="selectedResult && selectedMethod" aria-label="Method result" data-testid="simulation-result")
        .simulation-result-heading
          div
            span Execution status
            strong {{ selectedResult.executionStatus ?? selectedResult.status }}
          div
            span Method
            strong {{ selectedMethod.title }}
        section.simulation-finding
          h3 Scientific finding
          p {{ scientificFinding(selectedMethod) }}
        dl.simulation-result-provenance
          dt Relationship
          dd {{ formatToken(selectedResult.provenance.relationship) }}
          dt Model origin
          dd {{ formatToken(selectedResult.provenance.modelOrigin) }}
          dt Model
          dd {{ selectedResult.provenance.model }}
          dt Precision
          dd {{ selectedResult.provenance.precision }}
          dt EARTH-derived
          dd {{ selectedResult.provenance.earthDerived }}
          dt Validates EARTH theory
          dd false
        section.simulation-scalar-outputs
          h3 Key scalar outputs
          dl(v-if="scalarOutputs.length")
            template(v-for="output in scalarOutputs" :key="output.key")
              dt {{ humanizeKey(output.key) }}
              dd {{ formatScalar(output.value) }}{{ output.unit ? ` ${output.unit}` : '' }}
          p(v-else) No top-level scalar outputs were returned.
        section.simulation-diagnostics
          h3 Diagnostics
          dl
            template(v-for="([key, value]) in resultDiagnostics" :key="key")
              dt {{ humanizeKey(key) }}
              dd {{ formatScalar(value) }}
        section.simulation-structured-outputs(v-if="structuredOutputs.length")
          h3 Structured outputs
          article(v-for="output in structuredOutputs" :key="output.key")
            h4 {{ humanizeKey(output.key) }}
            EarthStructuredValue(:value="output.value")
        details.simulation-raw-result(data-testid="simulation-raw-result")
          summary Raw JSON result
          pre
            code {{ JSON.stringify(selectedResult, null, 2) }}
      p.simulation-result-empty(v-else-if="selectedMethod?.runnable") Run the selected method to create a session result. Completed results remain attached to their methods while this program page is open.
      p.simulation-result-empty(v-else) This unavailable source formulation cannot create a result. Its source blocker remains recorded in the selected method metadata.

      section.simulation-run-ledger(v-if="methods.length > 1 && completedResultEntries.some(({ result }) => result)" data-testid="simulation-run-ledger")
        h3 Session run ledger
        p Completion and scalar outputs are listed by provenance. No residual is inferred between unlike quantities.
        .simulation-run-ledger-row(v-for="entry in completedResultEntries" :key="entry.method.id")
          strong {{ entry.method.title }}
          span {{ formatToken(entry.method.relationship) }} · {{ formatToken(entry.method.modelOrigin) }}
          b {{ entry.result ? 'COMPLETED' : 'NOT RUN' }}
          small {{ ledgerOutput(entry.result) }}

    section.simulation-evidence-section(aria-labelledby="program-evidence-heading")
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
