<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  PHOTON_FREQUENCY_BOUNDS_HZ,
  PHOTON_SOURCE_PRESET_IDS,
  PHOTON_SOURCE_PRESETS,
  evaluatePhotonBridge,
  projectPhotonBridgeSeries,
  projectPhotonBridgeTable,
  type PhotonBridgeEvaluation,
  type PhotonBridgeTableRow,
} from '../../tour/photonBridgeEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type Prediction = '' | 'wavelength-falls' | 'all-rise' | 'all-fall'

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [result: PhotonBridgeEvaluation]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'photon-vacuum-equivalent-scale-map-1',
  implementationRevision: 'tour-photon-bridge-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'Choose an illustrative source frequency, predict which outputs rise or fall with frequency, and name the two equivalent scales without turning them into rest-mass or thermal-state claims.'
const EXPECTED_PRESET_LABELS = Object.freeze(['Radio', 'Microwave', 'Visible blue', 'X-ray', 'Gamma ray'])
const EXPECTED_OUTPUTS = Object.freeze([
  ['frequencyHz', 'number', 'Hz', false],
  ['photonEnergyJ', 'number', 'J', false],
  ['vacuumWavelengthM', 'number', 'm', false],
  ['equivalentMassKg', 'number', 'kg', false],
  ['equivalentTemperatureK', 'number', 'K', false],
  ['relationStatus', 'string', null, false],
] as const)
const EXPECTED_COMPATIBILITY_KEY = 'd0089e0d7d0c1ba5b40d11cd1231ed16c3186a5968952d7cf2f15ff1e5684685'
const LOG_BOUNDS: Readonly<Record<PhotonBridgeTableRow['id'], readonly [number, number]>> = Object.freeze({
  frequency: [3, 25],
  'photon-energy': [-31, -8],
  'vacuum-wavelength': [-17, 6],
  'equivalent-mass': [-48, -25],
  'equivalent-temperature': [-8, 15],
})

function sameOrderedValues(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function numericControl(simulation: TourGeneratedSimulation, id: string): NumericControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'range' || control?.type === 'number' ? control : null
}

function isPhotonPresetInput(value: Record<string, number | string | boolean>): value is Record<'frequencyHz', number> {
  return sameOrderedValues(Object.keys(value), ['frequencyHz'])
    && typeof value.frequencyHz === 'number'
    && Number.isFinite(value.frequencyHz)
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'photon-scale-converter' || simulation.lessonId !== 'photon-equivalent-scales') {
    return 'The simulation identity is not the supported photon-scale-converter contract.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The generated simulation revision does not match the photon-bridge implementation.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the photon-bridge choices.'
  }
  if (simulation.numericalMethod?.implementationRef !== 'src/tour/photonBridgeEngine.ts'
    || simulation.numericalMethod.kind !== 'direct-evaluation'
    || simulation.numericalMethod.deterministic !== true
    || simulation.limits.tier !== 'immediate'
    || simulation.limits.maxOperations !== 1
    || simulation.limits.maxDurationMs !== 10
    || simulation.visualization.kind !== 'linked-photon-scale-map'
    || simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY) {
    return 'The generated runtime contract does not match the photon-bridge engine.'
  }

  const frequencyControl = numericControl(simulation, 'frequencyHz')
  if (simulation.controls.length !== 1 || !frequencyControl || frequencyControl.type !== 'number' || frequencyControl.readingDepth !== 'guided') {
    return 'The simulation controls do not match the one Guided photon-frequency input.'
  }
  if (frequencyControl.min !== PHOTON_FREQUENCY_BOUNDS_HZ.minimum
    || frequencyControl.max !== PHOTON_FREQUENCY_BOUNDS_HZ.maximum
    || frequencyControl.default !== 5e14
    || frequencyControl.step !== 0.1
    || frequencyControl.unit !== 'Hz'
    || frequencyControl.inputRole !== 'parameter') {
    return 'The generated frequency bounds do not match the photon engine.'
  }
  if (!frequencyControl.label.trim() || !frequencyControl.description.trim()) return 'The generated frequency control is missing required copy.'
  if (simulation.presets.length !== PHOTON_SOURCE_PRESET_IDS.length
    || !sameOrderedValues(simulation.presets.map(({ id }) => id), PHOTON_SOURCE_PRESET_IDS)
    || !sameOrderedValues(simulation.presets.map(({ label }) => label), EXPECTED_PRESET_LABELS)) {
    return 'The generated presets do not match the photon source catalog.'
  }
  for (const [index, preset] of simulation.presets.entries()) {
    if (!preset.description.trim() || !preset.inspectionPrompt.trim() || !isPhotonPresetInput(preset.inputs)) {
      return `Preset ${preset.id} does not provide a complete generated photon input.`
    }
    if (preset.inputs.frequencyHz !== PHOTON_SOURCE_PRESETS[index]?.frequencyHz) {
      return `Preset ${preset.id} has drifted from the photon engine source frequency.`
    }
    try {
      evaluatePhotonBridge({ frequencyHz: preset.inputs.frequencyHz })
    } catch {
      return `Preset ${preset.id} is outside the photon engine bounds.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length
    || EXPECTED_OUTPUTS.some(([id, type, unit, nullable], index) => {
      const output = simulation.outputSchema[index]
      return !output || output.id !== id || output.type !== type || output.unit !== unit || output.nullable !== nullable
    })) {
    return 'The generated output schema does not match the photon-bridge result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const frequencyControl = numericControl(props.simulation, 'frequencyHz')

function presetFrequency(preset: TourPreset | undefined): number | null {
  return preset && isPhotonPresetInput(preset.inputs) ? preset.inputs.frequencyHz : null
}

const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const sourceDefault = frequencyControl?.default ?? Number.NaN
const frequencyHz = ref(presetFrequency(initialPreset) ?? sourceDefault)
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<PhotonBridgeEvaluation | null>(null)
const evaluationError = ref<string | null>(null)

const selectedPreset = computed(() => props.simulation.presets.find((preset) => presetFrequency(preset) === frequencyHz.value) ?? null)
const tableRows = computed(() => result.value ? projectPhotonBridgeTable(result.value) : [])
const series = computed(() => result.value ? projectPhotonBridgeSeries(result.value) : [])
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'wavelength-falls', label: 'Energy scales rise; wavelength falls' },
  { value: 'all-rise', label: 'All linked values rise' },
  { value: 'all-fall', label: 'All linked values fall' },
]
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  return `Prediction: ${predicted}. Identity direction: energy, equivalent mass, and equivalent temperature increase with frequency; vacuum wavelength decreases.`
})

function evaluateCurrentInput(): void {
  if (contractError) return
  try {
    const output = evaluatePhotonBridge({ frequencyHz: frequencyHz.value })
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The photon engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function applyPreset(preset: TourPreset): void {
  const value = presetFrequency(preset)
  if (value !== null) frequencyHz.value = value
}

function resetBridge(): void {
  frequencyHz.value = sourceDefault
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  evaluationError.value = null
}

function bridgeX(id: PhotonBridgeTableRow['id'], logValue: number): number {
  const [minimum, maximum] = LOG_BOUNDS[id]
  return 39 + ((logValue - minimum) / (maximum - minimum)) * 55
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch(frequencyHz, () => {
  if (revealed.value) {
    prediction.value = ''
    recordedPrediction.value = ''
    predictionStale.value = true
    evaluateCurrentInput()
  } else if (prediction.value) {
    prediction.value = ''
  }
})
</script>

<template lang="pug">
section(class="dimension-builder photon-bridge", data-testid="photon-bridge", :aria-labelledby="`${simulation.id}-title`")
  header(class="dimension-builder-heading")
    p(class="dimension-builder-kicker") Photon identity bridge
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", class="dimension-builder-error", role="alert", data-testid="photon-bridge-error")  This activity cannot run because its generated contract and photon engine do not agree. {{ contractError }}
  template(v-else)
    section(class="dimension-builder-presets", aria-labelledby="photon-presets-title")
      h3(id="photon-presets-title") Illustrative sources
      ul(class="dimension-builder-preset-list")
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(class="dimension-builder-preset tour-touch-target", type="button", :data-testid="`photon-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", class="photon-bridge-inspection", data-testid="photon-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(class="dimension-builder-controls", aria-labelledby="photon-controls-title")
      h3(id="photon-controls-title") Set one frequency
      div(v-if="frequencyControl", class="dimension-builder-control photon-bridge-frequency-control", data-testid="photon-control-frequency")
        label(for="photon-frequency") {{ frequencyControl.label }}
        output(for="photon-frequency") {{ frequencyHz.toExponential(6) }} Hz
        input(id="photon-frequency", v-model.number="frequencyHz", data-testid="photon-frequency", :type="frequencyControl.type", :min="frequencyControl.min", :max="frequencyControl.max", :step="frequencyControl.step")
        p
          | {{ frequencyControl.description }} 
          span {{ frequencyControl.playfulPrompt }}
    fieldset(class="dimension-builder-prediction", data-testid="photon-prediction-gate")
      legend Predict before revealing the bridge
      p {{ simulation.predictionPrompt }}
      label(v-for="option in predictionOptions", :key="option.value", class="dimension-builder-prediction-option tour-touch-target")
        input(v-model="prediction", type="radio", name="photon-bridge-prediction", :value="option.value", :data-testid="`photon-prediction-${option.value}`")
        span {{ option.label }}
    div(class="dimension-builder-actions")
      button(class="dimension-builder-reveal tour-touch-target", type="button", data-testid="reveal-photon-bridge", :disabled="!prediction", @click="revealResult") Reveal bridge
      button(class="tour-touch-target", type="button", data-testid="reset-photon-bridge", @click="resetBridge") Reset
    p(v-if="evaluationError", class="dimension-builder-error", role="alert") {{ evaluationError }}
    p(v-if="predictionStale", class="dimension-builder-caveat", aria-live="polite", data-testid="photon-prediction-stale")  The frequency changed. The live identities have updated, but the previous prediction is stale and is not compared with this result. 
    section(v-if="revealed && result", class="dimension-builder-stage photon-bridge-stage", data-testid="photon-bridge-result", aria-labelledby="photon-result-title")
      header
        p Stated frequency
        h3(id="photon-result-title", data-testid="photon-frequency-result") {{ result.frequencyHz.toExponential(6) }} Hz
        p {{ result.relationStatus }}
      svg(class="photon-bridge-graphic", viewBox="0 0 100 62", role="img", aria-labelledby="photon-svg-title photon-svg-description", data-testid="photon-bridge-svg")
        title(id="photon-svg-title") Linked photon scale map
        desc(id="photon-svg-description") Five logarithmic lanes show algebraically dependent representations linked to one stated frequency: photon energy, vacuum wavelength, equivalent mass, and equivalent temperature. They are equation outputs, not separate measurements, and no correlation is estimated.
        g(v-for="(point, index) in series", :key="point.id", class="photon-bridge-lane")
          text(x="2", :y="9 + index * 12") {{ point.label }}
          line(x1="39", :y1="7 + index * 12", x2="94", :y2="7 + index * 12")
          circle(:cx="bridgeX(point.id, point.log10Value)", :cy="7 + index * 12", r="2.2")
            title {{ point.accessibleLabel }}; log10 value {{ point.log10Value.toFixed(6) }}
          text(x="39", :y="11 + index * 12") 10^{{ LOG_BOUNDS[point.id][0] }}
          text(x="94", :y="11 + index * 12", text-anchor="end") 10^{{ LOG_BOUNDS[point.id][1] }} {{ point.unit }}
      p(class="dimension-builder-comparison", data-testid="photon-prediction-comparison") {{ predictionComparison }}
      p(class="dimension-builder-caveat", data-testid="photon-equivalence-caveat")  These are algebraically dependent linked representations of one stated frequency, not separate measurements; no correlation is estimated. Equivalent mass is not photon rest mass. Equivalent temperature is not a thermodynamic state. The wavelength is in vacuum, and no source-frequency uncertainty is propagated. 
      div(class="dimension-builder-table-wrap")
        table(data-testid="photon-bridge-table")
          caption Accessible numerical alternative to the five logarithmic lanes
          thead
            tr
              th(scope="col") Representation
              th(scope="col") Value
              th(scope="col") Equation
              th(scope="col") Interpretation
          tbody
            tr(v-for="row in tableRows", :key="row.id")
              th(scope="row") {{ row.label }}
              td {{ row.value.toExponential(6) }} {{ row.unit }}
              td
                code {{ row.equation }}
              td {{ row.interpretation }}
      section(class="dimension-builder-finding photon-bridge-finding", aria-labelledby="photon-finding-title", data-testid="photon-bridge-finding")
        h3(id="photon-finding-title") Live finding
        p(role="status", aria-live="polite") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="photon-result-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd {{ result.finding.claimClass }}
          dt Model origin
          dd {{ result.finding.modelOrigin }}
          dt Method relationship
          dd {{ result.finding.methodRelationship }}
          dt Validates theory
          dd {{ result.finding.validatesTheory ? 'Yes' : 'No' }}
          dt Source revision
          dd {{ result.finding.sourceRevision }}
          dt Source locator
          dd {{ result.finding.sourceLocator }}
        h4 What changed
        p {{ result.finding.changed }}
        h4 Why
        p {{ result.finding.cause }}
        h4 Equation
        p
          code {{ result.finding.equation }}
        h4 Assumptions
        ul
          li(v-for="assumption in result.finding.assumptions", :key="assumption") {{ assumption }}
        h4 Establishes
        p {{ result.finding.establishes }}
        h4 Does not establish
        p {{ result.finding.doesNotEstablish }}
        h4 Definition notes
        ul
          li(v-for="note in result.definitionNotes", :key="note") {{ note }}
        h4 Uncertainty notes
        ul
          li(v-for="note in result.uncertaintyNotes", :key="note") {{ note }}
        h4 Caveats
        ul
          li(v-for="caveat in result.finding.caveats", :key="caveat") {{ caveat }}
        h4 Evidence references
        ul(data-testid="photon-evidence-refs")
          li(v-for="evidenceRef in result.finding.evidenceRefs", :key="evidenceRef")
            a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
        p(data-testid="photon-validation-boundary") No empirical comparison, residual test, source measurement validation, or theory validation is claimed by this identity conversion.
    section(v-if="depth === 'technical'", class="dimension-builder-disclosure", data-testid="photon-technical-disclosure")
      h3 Technical assumptions and method
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
      p {{ simulation.numericalMethod?.description }}
      p {{ simulation.visualization.reducedMotionBehavior }}
</template>

<style scoped>
.photon-bridge-inspection { padding: 1rem; color: var(--paper-dim); font-family: var(--mono); font-size: .875rem; }
.photon-bridge-frequency-control { grid-column: 1 / -1; }
.photon-bridge-stage { grid-column: 1 / -1; }
.photon-bridge-graphic { width: 100%; min-height: 300px; margin: 1.5rem 0; color: var(--paper); border: 1px solid var(--rule-bright); background: var(--ink-1); }
.photon-bridge-lane line { stroke: var(--rule-bright); stroke-width: .35; }
.photon-bridge-lane circle { fill: var(--cyan); stroke: var(--paper); stroke-width: .5; }
.photon-bridge-lane text { fill: currentColor; font-family: var(--mono); font-size: 2.6px; }
.photon-bridge-lane text:nth-of-type(n+2) { fill: var(--paper-dim); font-size: 2px; }
.photon-bridge-finding dl { display: grid; grid-template-columns: minmax(150px, .4fr) minmax(0, 1.6fr); gap: .25rem 1rem; }
.photon-bridge-finding dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 420px) { .photon-bridge :deep(.dimension-builder-preset), .photon-bridge :deep(button), .photon-bridge :deep(select), .photon-bridge :deep(input:not([type='radio'])) { min-height: 44px; }.photon-bridge :deep(.dimension-builder-controls) { grid-template-columns: minmax(0, 1fr); } }
@media (forced-colors: active) { .photon-bridge-graphic { forced-color-adjust: auto; }.photon-bridge-lane circle { fill: Highlight; stroke: HighlightText; }.photon-bridge-lane line { stroke: CanvasText; } }
</style>
