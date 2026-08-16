<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTourProgress } from '../registries/tourProgress'
import TourDepthControl from '../components/tour/TourDepthControl.vue'
import GeometryInstrument from '../components/edwin-gray/GeometryInstrument.vue'
import CircuitInstrument from '../components/edwin-gray/CircuitInstrument.vue'
import PulseCycleInstrument from '../components/edwin-gray/PulseCycleInstrument.vue'
import EnergyLedgerInstrument from '../components/edwin-gray/EnergyLedgerInstrument.vue'
import FamilyInstrument from '../components/edwin-gray/FamilyInstrument.vue'
import {
  GRAY_FEM_PROVENANCE,
  GRAY_GUIDE_SECTIONS,
  GRAY_LEARNING_PROMISE,
  GRAY_RELATED_LINKS,
  GRAY_TERMS,
  GRAY_VIDEO,
  GRAY_VIDEO_TIMELINE,
} from '../edwin-gray/edwinGrayGuide'
import { grayEvidenceRecord } from '../edwin-gray/edwinGrayEvidence'
import { loadGrayMagneticLookup } from '../edwin-gray/edwinGrayFem'
import {
  GRAY_CALIBRATION_TRANSFER_PROXY,
  loadGrayCalibrationMagneticLookup,
  type GrayCalibrationMagneticLookup,
} from '../edwin-gray/edwinGrayCalibration'
import {
  GRAY_MACHINE_CONTRACTS,
  GRAY_MACHINE_IDS,
  GRAY_PATENT_MACHINE_ID,
} from '../edwin-gray/edwinGrayMachines'
import {
  evaluateGrayCopClaim,
  GRAY_COP_CLAIM_SCENARIOS,
  type GrayFullMotorResult,
  type GrayMagneticLookup,
} from '../edwin-gray/edwinGrayEngine'
import {
  createGraySubmittedInput,
  defaultGrayWorkbenchInput,
  freezeGrayFullMotorResult,
  freezeGrayValue,
  grayFemCompatibilityReason,
  grayFemCanBeRequested,
  graySubmittedInputIdentity,
  GrayWorkbenchRevisionError,
  GRAY_WORKBENCH_QUERY_KEYS,
  parseGrayWorkbenchQuery,
  serializeGrayWorkbenchInput,
  type GrayWorkbenchInputState,
} from '../edwin-gray/edwinGrayWorkbench'
import { resetGrayWorker, runGrayInWorker } from '../edwin-gray/edwinGrayWorkerProtocol'
import {
  createGraySnapshot,
  compareGraySnapshots,
  exportGraySnapshot,
  importGraySnapshot,
  loadGraySnapshotsWithRecovery,
  saveGraySnapshot,
} from '../edwin-gray/edwinGrayPersistence'
import type { WorkbenchSnapshotV1 } from '../types/workbench'
import type { ReadingDepth } from '../types/tour'

const progress = useTourProgress()
if (!progress.hydrated.value) progress.hydrate()

const depth = computed<ReadingDepth>(() => progress.depth.value)
const route = useRoute()
const router = useRouter()
let initialRevisionError = ''
let initialInput: GrayWorkbenchInputState
try {
  initialInput = parseGrayWorkbenchQuery(route.query)
} catch (reason) {
  initialInput = defaultGrayWorkbenchInput()
  initialRevisionError = reason instanceof Error ? reason.message : String(reason)
}
const input = ref<GrayWorkbenchInputState>(initialInput)
const revisionError = ref(initialRevisionError)
const result = ref<Readonly<GrayFullMotorResult> | null>(null)
const resultInputIdentity = ref<string | null>(null)
const runStatus = ref<'idle' | 'running' | 'completed' | 'cancelled' | 'failed'>('idle')
const runProgress = ref(0)
const runStage = ref('Ready to run')
const runError = ref('')
const stale = ref(false)
const activeEventIndex = ref(0)
const timelinePlaying = ref(false)
const motionNotice = ref('')
const femStatus = ref<'unavailable' | 'loading' | 'invalid' | 'ready'>('unavailable')
const femMessage = ref('The selected machine contract has no compatible FEM lookup.')
const femLookup = ref<GrayMagneticLookup | null>(null)
const calibrationStatus = ref<'absent' | 'loading' | 'invalid' | 'ready'>('absent')
const calibrationMessage = ref('The limited FEM calibration pack has not been loaded.')
const calibrationLookup = ref<GrayCalibrationMagneticLookup | null>(null)
const calibrationAcknowledged = ref(false)
const snapshots = ref<readonly WorkbenchSnapshotV1[]>([])
const selectedSnapshotTimes = ref<string[]>([])
const snapshotMessage = ref('')
const snapshotError = ref('')
let abortController: AbortController | null = null
let femAbortController: AbortController | null = null
let calibrationAbortController: AbortController | null = null
let femRequestToken = 0
let calibrationRequestToken = 0
let timelineTimer: ReturnType<typeof setInterval> | null = null
const videoActivated = ref(false)
const originalStarterEvidence = grayEvidenceRecord('gray-caption-original-500-rpm-starter')
const modifiedWindingEvidence = grayEvidenceRecord('gray-caption-schloff-awg14-rewind')
const modifiedPowerEvidence = grayEvidenceRecord('gray-caption-schloff-ten-kw-no-load')
const recoveryEvidence = grayEvidenceRecord('gray-caption-purple-recovery-coils')
const claimEvidence = freezeGrayValue({
  diagramCop282: evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.diagramCop282),
  retainedTranscriptCop282: null,
  retainedTranscriptCop300: evaluateGrayCopClaim(GRAY_COP_CLAIM_SCENARIOS.transcriptCop300),
})
const instrumentComponents = {
  geometry: GeometryInstrument,
  circuit: CircuitInstrument,
  pulse: PulseCycleInstrument,
  energy: EnergyLedgerInstrument,
  family: FamilyInstrument,
} as const

const activeEvent = computed(() => result.value?.events[activeEventIndex.value] ?? result.value?.events[0] ?? null)
const selectedSnapshots = computed(() => selectedSnapshotTimes.value
  .map((timestamp) => snapshots.value.find((snapshot) => snapshot.timestamp === timestamp))
  .filter((snapshot): snapshot is WorkbenchSnapshotV1 => Boolean(snapshot)))
const snapshotComparison = computed(() => selectedSnapshots.value.length === 2
  ? compareGraySnapshots(selectedSnapshots.value[0]!, selectedSnapshots.value[1]!)
  : null)
const currentInputIdentity = computed(() => graySubmittedInputIdentity(
  input.value,
  selectedMagneticLookup(),
))
const calibrationDisplayStatus = computed(() => calibrationStatus.value === 'ready'
  && input.value.magneticModel === 'limited-fem-calibration'
  && calibrationAcknowledged.value
  ? 'active'
  : calibrationStatus.value)
const calibrationAvailable = computed(() => input.value.machineContractId === GRAY_PATENT_MACHINE_ID)
const calibrationRunBlocked = computed(() => input.value.magneticModel === 'limited-fem-calibration'
  && (!calibrationAcknowledged.value || calibrationStatus.value !== 'ready'))

function selectedMagneticLookup(): GrayMagneticLookup | undefined {
  if (input.value.magneticModel === 'fem-lookup') return femLookup.value ?? undefined
  if (input.value.magneticModel === 'limited-fem-calibration'
    && calibrationAcknowledged.value && calibrationStatus.value === 'ready') {
    return calibrationLookup.value ?? undefined
  }
  return undefined
}
const canSaveSnapshot = computed(() => Boolean(result.value)
  && !stale.value
  && resultInputIdentity.value === currentInputIdentity.value)

function instrumentComponent(moduleId: string | undefined) {
  if (!moduleId) return undefined
  return instrumentComponents[moduleId as keyof typeof instrumentComponents]
}

function instrumentProps(moduleId: string | undefined) {
  if (!result.value) return {}
  return moduleId === 'geometry' || moduleId === 'circuit' || moduleId === 'pulse'
    ? { depth: depth.value, result: result.value, activeEventIndex: activeEventIndex.value }
    : moduleId === 'energy'
      ? { depth: depth.value, result: result.value, claimEvidence }
      : { depth: depth.value, result: result.value }
}

const shortcutSteps = Object.freeze([
  Object.freeze({ label: 'Name', title: 'Topology', body: 'Start with the patent-described 9 stator / 3 rotor station layout.' }),
  Object.freeze({ label: 'Switch', title: 'Schedule', body: 'Charge, pulse-charge, then follow the 27-event sector schedule.' }),
  Object.freeze({ label: 'Break', title: 'Arc', body: 'Use the presenter-reported 500 rpm reference without treating it as universal.' }),
  Object.freeze({ label: 'Count', title: 'Ledger', body: 'Put capacitor energy into R, spark, torque, and recovery.' }),
  Object.freeze({ label: 'Compare', title: 'Prototypes', body: 'Compare later colored evidence claims without rewriting the patent topology.' }),
])

function videoAt(seconds: number): string {
  return `${GRAY_VIDEO.url}&t=${seconds}s`
}

function activateVideo(): void {
  videoActivated.value = true
}

function stopTimeline(): void {
  timelinePlaying.value = false
  if (timelineTimer) clearInterval(timelineTimer)
  timelineTimer = null
}

function toggleTimeline(): void {
  if (timelinePlaying.value) {
    stopTimeline()
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    motionNotice.value = 'Rotor animation is disabled because reduced motion is preferred.'
    return
  }
  if (!result.value?.events.length) return
  motionNotice.value = ''
  timelinePlaying.value = true
  timelineTimer = setInterval(() => {
    const count = result.value?.events.length ?? 0
    if (!count) return stopTimeline()
    activeEventIndex.value = (activeEventIndex.value + 1) % count
  }, 180)
}

function cancelRun(): void {
  abortController?.abort()
  abortController = null
  if (runStatus.value === 'running') {
    runStatus.value = 'cancelled'
    runStage.value = 'Cancelled; the prior result remains available and stale.'
  }
}

async function runWorkbench(): Promise<void> {
  cancelRun()
  if (revisionError.value) {
    runStatus.value = 'failed'
    runError.value = revisionError.value
    runStage.value = 'Unsupported URL input revision'
    return
  }
  runError.value = ''
  runProgress.value = 0
  runStatus.value = 'running'
  runStage.value = 'Starting worker'
  const controller = new AbortController()
  abortController = controller
  try {
    if (input.value.magneticModel === 'limited-fem-calibration' && !calibrationAcknowledged.value) {
      throw new Error('Acknowledge the limited, non-validation calibration boundary before running it.')
    }
    const lookup = selectedMagneticLookup()
    const submitted = createGraySubmittedInput(input.value, lookup)
    const completed = await runGrayInWorker(submitted.engineInput, {
      signal: controller.signal,
      inputIdentity: submitted.identity,
      onProgress(progressValue, stage) {
        if (currentInputIdentity.value !== submitted.identity) return
        runProgress.value = progressValue
        runStage.value = stage
      },
    })
    if (controller.signal.aborted) return
    if (currentInputIdentity.value !== submitted.identity) {
      stale.value = true
      runStatus.value = 'cancelled'
      runStage.value = 'Discarded a late result because inputs changed after submission.'
      return
    }
    result.value = freezeGrayFullMotorResult(completed)
    resultInputIdentity.value = submitted.identity
    runStatus.value = 'completed'
    runProgress.value = 1
    runStage.value = `Completed ${completed.completedEventCount} events`
    stale.value = false
    activeEventIndex.value = 0
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return
    runStatus.value = 'failed'
    runError.value = reason instanceof Error ? reason.message : String(reason)
    runStage.value = 'Worker run failed'
  } finally {
    if (abortController === controller) abortController = null
  }
}

async function refreshCalibration(): Promise<void> {
  calibrationAbortController?.abort()
  const requestToken = ++calibrationRequestToken
  const requestedMachineContractId = input.value.machineContractId
  const controller = new AbortController()
  calibrationAbortController = controller
  if (requestedMachineContractId !== GRAY_PATENT_MACHINE_ID) {
    calibrationLookup.value = null
    calibrationStatus.value = 'absent'
    calibrationMessage.value = 'Limited FEM calibration is offered only for the patent illustrative machine.'
    if (calibrationAbortController === controller) calibrationAbortController = null
    return
  }
  calibrationStatus.value = 'loading'
  calibrationMessage.value = 'Loading and strictly validating the separate limited calibration contract.'
  try {
    const lookup = await loadGrayCalibrationMagneticLookup(requestedMachineContractId, fetch, controller.signal)
    if (controller.signal.aborted || requestToken !== calibrationRequestToken
      || input.value.machineContractId !== requestedMachineContractId) return
    const incompatibility = grayFemCompatibilityReason(input.value, lookup)
    calibrationLookup.value = lookup
    if (incompatibility) {
      calibrationStatus.value = 'invalid'
      calibrationMessage.value = incompatibility.replace('FEM disabled:', 'Limited calibration invalid:')
      return
    }
    calibrationStatus.value = 'ready'
    calibrationMessage.value = '27-point L/W/W′ relation ready. Class 0 transfer proxy is measured; classes 1–2 transfer it by assumption.'
  } catch (reason) {
    if (controller.signal.aborted || requestToken !== calibrationRequestToken) return
    const message = reason instanceof Error ? reason.message : String(reason)
    calibrationLookup.value = null
    calibrationStatus.value = /request failed with 404/.test(message) ? 'absent' : 'invalid'
    calibrationMessage.value = message
  } finally {
    if (calibrationAbortController === controller) calibrationAbortController = null
  }
}

function refreshMagneticSources(): void {
  void refreshFem()
  void refreshCalibration()
}

async function refreshFem(): Promise<void> {
  femAbortController?.abort()
  const requestToken = ++femRequestToken
  const requestedMachineContractId = input.value.machineContractId
  const controller = new AbortController()
  femAbortController = controller
  if (!grayFemCanBeRequested(input.value)) {
    femLookup.value = null
    femStatus.value = 'unavailable'
    femMessage.value = GRAY_MACHINE_CONTRACTS[input.value.machineContractId].femBlocker
    if (input.value.magneticModel === 'fem-lookup') input.value.magneticModel = 'illustrative-surrogate'
    if (femAbortController === controller) femAbortController = null
    return
  }
  femStatus.value = 'loading'
  femMessage.value = 'Loading and validating the generated FEM lookup contract.'
  try {
    const lookup = await loadGrayMagneticLookup(requestedMachineContractId, fetch, controller.signal)
    if (controller.signal.aborted || requestToken !== femRequestToken
      || input.value.machineContractId !== requestedMachineContractId) return
    const incompatibility = grayFemCompatibilityReason(input.value, lookup)
    femLookup.value = lookup
    if (incompatibility) {
      femStatus.value = 'invalid'
      femMessage.value = incompatibility
      if (input.value.magneticModel === 'fem-lookup') input.value.magneticModel = 'illustrative-surrogate'
      return
    }
    femStatus.value = 'ready'
    femMessage.value = `Compatible lookup ${femLookup.value.caseId} is ready; only its magnetic relation will be activated.`
  } catch (reason) {
    if (controller.signal.aborted || requestToken !== femRequestToken) return
    const message = reason instanceof Error ? reason.message : String(reason)
    femStatus.value = /request failed with 404/.test(message) ? 'unavailable' : 'invalid'
    femMessage.value = message
    if (input.value.magneticModel === 'fem-lookup') input.value.magneticModel = 'illustrative-surrogate'
  } finally {
    if (femAbortController === controller) femAbortController = null
  }
}

function selectMachine(): void {
  const machineContractId = input.value.machineContractId
  input.value = defaultGrayWorkbenchInput(machineContractId)
  calibrationAcknowledged.value = false
  refreshMagneticSources()
}

async function resetWorkbench(): Promise<void> {
  cancelRun()
  stopTimeline()
  try {
    await resetGrayWorker()
  } catch (reason) {
    runError.value = reason instanceof Error ? reason.message : String(reason)
  }
  input.value = defaultGrayWorkbenchInput()
  result.value = null
  resultInputIdentity.value = null
  stale.value = false
  runStatus.value = 'idle'
  runProgress.value = 0
  runStage.value = 'Reset to canonical defaults'
  calibrationAcknowledged.value = false
  refreshMagneticSources()
  await runWorkbench()
}

function saveSnapshot(): void {
  snapshotError.value = ''
  snapshotMessage.value = ''
  if (!result.value || !canSaveSnapshot.value) {
    snapshotError.value = 'Snapshot rejected: the visible result identity does not match the current submitted input.'
    return
  }
  try {
    const snapshot = createGraySnapshot(input.value, result.value, new Date().toISOString(), GRAY_MACHINE_CONTRACTS[input.value.machineContractId].label)
    snapshots.value = saveGraySnapshot(snapshot)
    snapshotMessage.value = `Saved snapshot ${snapshot.timestamp}.`
  } catch (reason) {
    snapshotError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function toggleSnapshot(timestamp: string): void {
  selectedSnapshotTimes.value = selectedSnapshotTimes.value.includes(timestamp)
    ? selectedSnapshotTimes.value.filter((value) => value !== timestamp)
    : [...selectedSnapshotTimes.value, timestamp].slice(-2)
}

function downloadSnapshot(snapshot: WorkbenchSnapshotV1): void {
  const blob = new Blob([exportGraySnapshot(snapshot)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `edwin-gray-${snapshot.timestamp.replaceAll(':', '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function importSnapshot(event: Event): Promise<void> {
  snapshotError.value = ''
  snapshotMessage.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const snapshot = importGraySnapshot(await file.text())
    snapshots.value = saveGraySnapshot(snapshot)
    snapshotMessage.value = `Imported snapshot ${snapshot.timestamp}.`
  } catch (reason) {
    snapshotError.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    ;(event.target as HTMLInputElement).value = ''
  }
}

watch(input, (next) => {
  if (result.value || runStatus.value === 'running') stale.value = true
  stopTimeline()
  if (femLookup.value) {
    const incompatibility = grayFemCompatibilityReason(next, femLookup.value)
    if (incompatibility) {
      femStatus.value = 'invalid'
      femMessage.value = incompatibility
      if (next.magneticModel === 'fem-lookup') next.magneticModel = 'illustrative-surrogate'
    }
  }
  if (calibrationLookup.value) {
    const incompatibility = grayFemCompatibilityReason(next, calibrationLookup.value)
    if (incompatibility) {
      calibrationStatus.value = 'invalid'
      calibrationMessage.value = incompatibility.replace('FEM disabled:', 'Limited calibration invalid:')
    }
  }
  if (revisionError.value) return
  const serialized = serializeGrayWorkbenchInput(next)
  const alreadyCanonical = GRAY_WORKBENCH_QUERY_KEYS.every((key) => route.query[key] === serialized[key])
  if (alreadyCanonical) return
  const query = { ...route.query }
  for (const key of GRAY_WORKBENCH_QUERY_KEYS) delete query[key]
  Object.assign(query, serialized)
  void router.replace({ query })
}, { deep: true, immediate: true })

watch(() => route.query, (query) => {
  try {
    const parsed = parseGrayWorkbenchQuery(query)
    revisionError.value = ''
    if (JSON.stringify(serializeGrayWorkbenchInput(parsed))
      !== JSON.stringify(serializeGrayWorkbenchInput(input.value))) {
      input.value = parsed
      refreshMagneticSources()
    }
  } catch (reason) {
    revisionError.value = reason instanceof GrayWorkbenchRevisionError
      ? reason.message
      : `Invalid Gray workbench URL: ${reason instanceof Error ? reason.message : String(reason)}`
    cancelRun()
    stale.value = Boolean(result.value)
  }
})

onMounted(async () => {
  document.title = 'Edwin Gray Motor Lab | OpenSimPhy Atlas'
  try {
    const loaded = loadGraySnapshotsWithRecovery()
    snapshots.value = loaded.snapshots
    if (loaded.rejectedEntryCount > 0) {
      snapshotError.value = `Recovered ${loaded.snapshots.length} valid snapshots and rejected ${loaded.rejectedEntryCount} corrupt entries.`
    }
  } catch (reason) {
    snapshotError.value = reason instanceof Error ? reason.message : String(reason)
  }
  await Promise.all([refreshFem(), refreshCalibration()])
  await runWorkbench()
})

onBeforeUnmount(() => {
  cancelRun()
  femAbortController?.abort()
  calibrationAbortController?.abort()
  stopTimeline()
})
</script>

<template lang="pug">
.quantum-lab-view(data-testid="edwin-gray-lab-ready")
  header.quantum-lab-header
    .quantum-lab-header__index
      span OpenSimPhy / Lab 05
      span source → model → simulation
    .quantum-lab-header__copy
      p.eyebrow A reconstruction of the Gray pulsed-capacitor motors
      h1 What did the purple motor actually switch?
      p.lede {{ GRAY_LEARNING_PROMISE }}
      .quantum-lab-depth
        TourDepthControl
    aside.quantum-lab-header__source
      p.eyebrow Reference media / {{ GRAY_VIDEO.duration }}
      h2 {{ GRAY_VIDEO.title }}
      p Uploader: {{ GRAY_VIDEO.uploader }}. Uploaded {{ GRAY_VIDEO.uploaded }}. Local notes live in {{ GRAY_VIDEO.transcript }}. Historical COP 300 remains a source-claim.
      a(:href="GRAY_VIDEO.url" target="_blank" rel="noreferrer") Open the original video on YouTube

  .quantum-lab-promise
    strong Teacher's shortcut
    p Do not treat "cold electricity" as a second Maxwell term. Establish the patent topology, schedule the participating sectors, quench an arc, and keep the energy ledger classical.

  section.gray-workbench(aria-labelledby="gray-workbench-title" data-testid="gray-workbench")
    header.gray-workbench__header
      div
        p.eyebrow Unified worker instrument
        h2#gray-workbench-title Edwin Gray Workbench
        p One URL-serializable input contract produces one immutable full-run result for every panel below.
      .gray-workbench__signal(
        id="gray-worker-status"
        :data-status="runStatus"
        :aria-busy="runStatus === 'running'"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      )
        strong {{ runStatus }}
        span {{ runStage }}
    .gray-workbench__controls
      fieldset
        legend Identity and run
        label
          span Machine contract
          select(v-model="input.machineContractId" data-testid="gray-machine-contract" @change="selectMachine")
            option(v-for="id in GRAY_MACHINE_IDS" :key="id" :value="id") {{ GRAY_MACHINE_CONTRACTS[id].label }}
        p.gray-fem-state(data-testid="gray-scenario-contract") Contract {{ input.machineContractId }}. Prototype contracts run only as illustrative surrogate scenarios and are never patent-FEM compatible.
        label
          span Full-run mode
          select(v-model="input.mode" data-testid="gray-run-mode")
            option(value="dynamic") Dynamic inertial
            option(value="prescribed-diagnostic") Prescribed diagnostic
        label
          span Revolutions
          input(v-model.number="input.revolutions" type="number" min="1" max="100" step="1" data-testid="gray-revolutions")
        label
          span Contact contract
          select(v-model="input.machineMode" data-testid="gray-contact-mode")
            option(value="original-500rpm-contact-v1") Original 500 rpm contact v1
            option(value="modified-electronic-v1") Modified electronic v1
      fieldset
        legend Mechanical state
        label
          span Start speed / rpm
          input(v-model.number="input.startRpm" type="number" min="0" max="20000" step="10" data-testid="gray-rpm")
        label
          span Rotor inertia / kg m2
          input(v-model.number="input.rotorInertiaKgM2" type="number" min="0.000001" max="1000" step="0.001" data-testid="gray-inertia")
        label
          span Load torque / Nm
          input(v-model.number="input.loadTorqueNm" type="number" min="0" max="1000000" step="0.01" data-testid="gray-load")
        label
          span Quench angle / deg
          input(v-model.number="input.quenchDeg" type="number" min="0" max="40" step="1" data-testid="gray-quench")
      fieldset
        legend Circuit and storage
        label
          span Charge voltage / V
          input(v-model.number="input.chargeVoltageV" type="number" min="0" max="200000" step="100" data-testid="gray-voltage")
        label
          span Holding capacitance / F
          input(v-model.number="input.capacitanceF" type="number" min="0.000000000001" max="0.01" step="0.00000001" data-testid="gray-capacitance")
        label
          span Turns
          input(v-model.number="input.turns" type="number" min="1" max="2000" step="1" data-testid="gray-turns")
        label
          span Source resistance / ohm
          input(v-model.number="input.sourceResistanceOhm" type="number" min="0.000001" max="1000000000" step="1" data-testid="gray-source-resistance")
        label
          span Dump capacitance / F
          input(v-model.number="input.dumpCapacitanceF" type="number" min="0.000000000001" max="0.01" step="0.00000001" data-testid="gray-dump-capacitance")
        label
          span Recovery capacitance / F
          input(v-model.number="input.recoveryCapacitanceF" type="number" min="0.000000000001" max="0.1" step="0.00000001" data-testid="gray-recovery-capacitance")
        label
          span Initial recovery voltage / V
          input(v-model.number="input.initialRecoveryVoltageV" type="number" min="0" :max="input.chargeVoltageV * 2" step="10" data-testid="gray-recovery-voltage")
      fieldset
        legend Magnetic relation
        label
          span Magnetic model
          select(v-model="input.magneticModel" data-testid="gray-magnetic-model")
            option(value="illustrative-surrogate") Illustrative lumped surrogate
            option(value="fem-lookup" :disabled="femStatus !== 'ready'") Compatible FEM lookup
            option(
              v-if="calibrationAvailable"
              value="limited-fem-calibration"
              :disabled="calibrationStatus !== 'ready' || !calibrationAcknowledged"
            ) Limited FEM calibration (exploratory)
        p.gray-fem-state(:data-state="femStatus" role="status" data-testid="gray-fem-runtime-status")
          strong {{ femStatus }}
          |  / Production FEM: {{ femMessage }}
        button(type="button" :disabled="!grayFemCanBeRequested(input) || femStatus === 'loading'" @click="refreshFem") Recheck FEM lookup
        template(v-if="calibrationAvailable")
          label.gray-calibration-ack
            input(
              v-model="calibrationAcknowledged"
              type="checkbox"
              data-testid="gray-calibration-acknowledgement"
            )
            span I acknowledge this is limited illustrative calibration, not physical validation.
          p.gray-fem-state(
            :data-state="calibrationDisplayStatus"
            role="status"
            data-testid="gray-calibration-runtime-status"
          )
            strong {{ calibrationDisplayStatus }}
            |  / {{ calibrationMessage }}
          button(
            type="button"
            :disabled="calibrationStatus === 'loading'"
            data-testid="gray-calibration-recheck"
            @click="refreshCalibration"
          ) Recheck limited calibration
          .gray-calibration-boundary(data-testid="gray-calibration-boundary")
            strong ±{{ (GRAY_CALIBRATION_TRANSFER_PROXY * 100).toFixed(4) }}% transfer proxy for L / W / W′ only
            span Class 0 measured; classes 1–2 assumed transfer. Torque has no validated bound.
            span Illustrative patent topology, not physical validation. Dynamic torque and mechanical results are exploratory and unbounded.
    .gray-workbench__actions
      button(type="button" :disabled="runStatus === 'running' || Boolean(revisionError) || calibrationRunBlocked" data-testid="gray-run" @click="runWorkbench") Run full motor
      button(type="button" :disabled="runStatus !== 'running'" data-testid="gray-cancel" @click="cancelRun") Cancel
      button(type="button" data-testid="gray-reset" @click="resetWorkbench") Reset
      progress(:value="runProgress" max="1" aria-label="Gray worker progress" aria-describedby="gray-worker-status gray-worker-progress-value")
      span#gray-worker-progress-value {{ Math.round(runProgress * 100) }}%
    p.quantum-stale(v-if="stale" role="status" data-testid="gray-stale") Inputs changed. The visible result is stale until the worker completes another run.
    p.quantum-boundary(v-if="revisionError" role="alert" data-testid="gray-revision-error") {{ revisionError }}
    p.quantum-boundary(v-if="runError" role="alert") {{ runError }}

    .gray-shared-timeline(v-if="result" data-testid="gray-shared-timeline")
      .gray-shared-timeline__readout(
        role="status"
        :aria-live="timelinePlaying ? 'off' : 'polite'"
        aria-atomic="true"
        data-testid="gray-event-summary"
      )
        strong Event {{ (activeEvent?.eventIndex ?? 0) + 1 }} / {{ result.completedEventCount }}
        span {{ activeEvent?.scheduledAbsoluteAngleDeg.toFixed(2) }} deg / phase {{ activeEvent?.phaseLabel }} / {{ activeEvent?.after.arcState }}
      input(v-model.number="activeEventIndex" type="range" min="0" :max="Math.max(0, result.events.length - 1)" step="1" aria-label="Active motor event" data-testid="gray-event-slider")
      button(type="button" data-testid="gray-timeline-play" @click="toggleTimeline") {{ timelinePlaying ? 'Pause rotor' : 'Animate rotor' }}
      p.quantum-stale(v-if="motionNotice" role="status" data-testid="gray-motion-notice") {{ motionNotice }}

    section.gray-snapshots(aria-labelledby="gray-snapshot-title")
      header
        div
          p.eyebrow Revisioned records
          h3#gray-snapshot-title Save, compare, import, and export
        .gray-snapshot-actions
          button(type="button" :disabled="!canSaveSnapshot" data-testid="gray-snapshot-save" @click="saveSnapshot") Save snapshot
          label.gray-import-button
            span Import JSON
            input(type="file" accept="application/json" data-testid="gray-snapshot-import" @change="importSnapshot")
      p.gray-status(v-if="snapshotMessage" role="status") {{ snapshotMessage }}
      p.quantum-boundary(v-if="snapshotError" role="alert") {{ snapshotError }}
      .gray-table-scroll(v-if="snapshots.length")
        table(data-testid="gray-snapshot-table")
          caption Saved revisioned Gray snapshots; select two to compare
          thead
            tr
              th(scope="col") Compare
              th(scope="col") Timestamp
              th(scope="col") Label
              th(scope="col") Revision
              th(scope="col") Export
          tbody
            tr(v-for="snapshot in snapshots" :key="snapshot.timestamp")
              td
                input(type="checkbox" :checked="selectedSnapshotTimes.includes(snapshot.timestamp)" :aria-label="`Compare ${snapshot.timestamp}`" @change="toggleSnapshot(snapshot.timestamp)")
              td {{ snapshot.timestamp }}
              td {{ snapshot.label }}
              td {{ snapshot.modelRevision }} / {{ snapshot.compatibilityKey.slice(0, 8) }}
              td
                button(type="button" @click="downloadSnapshot(snapshot)") Export
      .gray-snapshot-comparison(v-if="snapshotComparison" data-testid="gray-snapshot-comparison")
        strong {{ snapshotComparison.compatible ? 'Compatible comparison' : 'Incompatible comparison' }}
        p {{ snapshotComparison.reason }}
        .gray-table-scroll
          table(data-testid="gray-comparison-inputs")
            caption Input and model differences
            thead
              tr
                th(scope="col") Field
                th(scope="col") Earlier
                th(scope="col") Later
            tbody
              tr(v-for="difference in [...snapshotComparison.modelDifferences, ...snapshotComparison.inputDifferences]" :key="difference.field")
                th(scope="row") {{ difference.field }}
                td {{ difference.left }}
                td {{ difference.right }}
              tr(v-if="!snapshotComparison.modelDifferences.length && !snapshotComparison.inputDifferences.length")
                td(colspan="3") No input or model differences.
        .gray-table-scroll(v-if="snapshotComparison.numericalDeltas")
          table(data-testid="gray-comparison-deltas")
            caption Numerical deltas for compatible machine and model revisions
            thead
              tr
                th(scope="col") Metric
                th(scope="col") Earlier
                th(scope="col") Later
                th(scope="col") Delta
            tbody
              tr(v-for="delta in snapshotComparison.numericalDeltas" :key="delta.metric")
                th(scope="row") {{ delta.metric }}
                td {{ delta.left }}
                td {{ delta.right }}
                td {{ delta.delta }}

  .quantum-lab-layout
    main.quantum-lab-main
      section.quantum-shortcut(aria-labelledby="gray-shortcut-title")
        .quantum-shortcut__heading
          p.eyebrow The route / five moves
          h2#gray-shortcut-title A shorter explanation than the talk
          p Use the numbered instruments below in order. Each one answers one question and leaves its assumptions visible.
        .quantum-shortcut__steps
          article(v-for="step in shortcutSteps" :key="step.label")
            span {{ step.label }}
            h3 {{ step.title }}
            p {{ step.body }}
        details.quantum-disclosure.quantum-vocabulary
          summary Open the essential vocabulary
          dl
            template(v-for="term in GRAY_TERMS" :key="term.term")
              dt {{ term.term }}
              dd {{ depth === 'technical' ? term.technical : term.plain }}

      section.quantum-lab-section(
        v-for="section in GRAY_GUIDE_SECTIONS"
        :id="section.moduleId ?? section.id"
        :key="section.id"
        :aria-labelledby="`${section.id}-heading`"
      )
        .quantum-lab-section__heading
          span {{ section.number }} / {{ section.id }}
          div
            h2(:id="`${section.id}-heading`") {{ section.title }}
            p
              strong Question:
              |  {{ section.question }}
            p.gray-evidence-label
              strong {{ section.evidenceLabel }}
            p.gray-assumption-label
              strong {{ section.assumptionLabel }}
            .quantum-lab-section__answer
              strong Short answer
              p {{ section.answer }}
            .quantum-lab-section__teacher-note
              strong Teacher note
              p {{ section.teacherNote }}
            p.quantum-lab-section__equation
              code {{ section.equation }}
        component(
          :is="instrumentComponent(section.moduleId)"
          v-if="section.moduleId && result"
          v-bind="instrumentProps(section.moduleId)"
        )
        p.quantum-stale(v-else-if="section.moduleId") Run the full motor to populate this instrument.

      section.gray-machine-evidence(aria-labelledby="gray-machine-evidence-title" data-testid="gray-machine-evidence")
        .gray-machine-evidence__heading
          p.eyebrow Transcript evidence / do not merge states
          h2#gray-machine-evidence-title Original and modified machine reports
          p These exported evidence records describe different machine states. They are source and presenter reports, not measured performance validation or simulation inputs.
        .gray-machine-evidence__grid
          article(data-testid="gray-original-evidence")
            span Original configuration / {{ originalStarterEvidence.validationStatus }}
            h3 500 RPM starter claim
            p {{ originalStarterEvidence.text }}
            small {{ originalStarterEvidence.implications[0] }}
          article(data-testid="gray-modified-evidence")
            span Modified configuration / {{ modifiedWindingEvidence.validationStatus }}
            h3 AWG 14 rewind and 10 kW report
            p {{ modifiedWindingEvidence.text }}
            p {{ modifiedPowerEvidence.text }}
            small These secondhand reports characterize the modified state only, not original-machine efficiency.
          article(data-testid="gray-recovery-evidence")
            span Recovery boundary / {{ recoveryEvidence.validationStatus }}
            h3 Recovery remains unknown
            p {{ recoveryEvidence.text }}
            small {{ recoveryEvidence.implications[1] }}

      section#gray-source-map.quantum-source-map(aria-labelledby="gray-source-map-title")
        .quantum-source-map__heading
          p.eyebrow Media / talk sequence
          h2#gray-source-map-title The frame map behind this lab
          p Every card is a checkpoint from the source talk and the local transcript. The app redraws the machines in SVG instead of copying video frames.
        .quantum-timeline
          a(v-for="entry in GRAY_VIDEO_TIMELINE" :key="entry.id" :href="videoAt(entry.seconds)" target="_blank" rel="noreferrer")
            time(:datetime="`PT${entry.seconds}S`") {{ entry.timestamp }}
            strong {{ entry.title }}
            small
              | {{ entry.frame }}
              br
              | {{ entry.lesson }}
            small Open source timestamp ↗
        details.quantum-media
          summary Optional source video player
          .gray-video-gate(v-if="!videoActivated")
            p The external player is unloaded until you explicitly activate it.
            button(type="button" data-testid="gray-video-activate" @click="activateVideo") Load external video
          .quantum-media__frame(v-else)
            iframe(
              :src="`https://www.youtube-nocookie.com/embed/${GRAY_VIDEO.id}?rel=0`"
              title="Reference video: Ed Gray purple motor presentation"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            )
          p(role="status" aria-live="polite") {{ videoActivated ? 'External YouTube player loaded by user request.' : 'External YouTube player is not loaded.' }} Close it for an entirely local lesson; the five instruments run without a network request.
        p.quantum-provenance
          strong Reproducibility note.
          |  Transcript: {{ GRAY_VIDEO.transcript }}. Downloaded media, when present: {{ GRAY_VIDEO.downloadedSource }}.

      section.gray-fem-card(aria-labelledby="gray-fem-title" data-testid="gray-fem-status")
        div
          p.eyebrow Local finite-element workspace
          h2#gray-fem-title Runtime FEM status: {{ femStatus }}
          p {{ femMessage }} FEM is activated only for an exact machine compatibility match. The surrogate remains explicitly labeled and is never relabeled FEM.
          p(v-if="calibrationAvailable" data-testid="gray-calibration-summary") Limited calibration: {{ calibrationDisplayStatus }}. It is separate from production FEM, limited-not-validated, non-production, and never enabled by default. Torque and all dynamic mechanical outputs have no validated bound.
        .gray-fem-card__links
          a(:href="GRAY_FEM_PROVENANCE.workspace" target="_blank" rel="noreferrer") Open fem/edwin-gray provenance
          a(:href="GRAY_FEM_PROVENANCE.sourceLedger" target="_blank" rel="noreferrer") Open source ledger

      section.quantum-related(aria-labelledby="gray-related-title")
        .quantum-related__heading
          p.eyebrow Keep exploring
          h2#gray-related-title Connect this reconstruction to the rest of OpenSimPhy
          p Running the ledger is a computation, not empirical validation of Gray’s claims.
        .quantum-related-grid
          RouterLink(v-for="link in GRAY_RELATED_LINKS" :key="link.to" :to="link.to")
            strong {{ link.label }}
            span {{ link.note }} →

      section.quantum-provenance(aria-label="Scope boundary")
        strong Scope boundary:
        |  these are original, bounded teaching models of a pulsed-capacitor open-core machine. They do not establish over-unity, cold electricity, or a radiant force. See 
        RouterLink(to="/evidence") Evidence
        |  for claim vocabulary.

    aside.quantum-lab-rail(aria-label="Edwin Gray lab contents")
      span.quantum-lab-rail__label Instrument index
      nav
        a(href="#geometry") 01 / Patent topology
        a(href="#circuit") 02 / Circuit
        a(href="#pulse") 03 / Pulse
        a(href="#energy") 04 / Energy
        a(href="#family") 05 / Colored comparisons
        a(href="#gray-source-map") Media / Frame map
      RouterLink.text-link(to="/labs") ← Back to all laboratories
</template>

<style src="../styles/quantum-wave.css"></style>
<style src="../styles/edwin-gray.css"></style>
