<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  evaluateSpinPrecession,
  projectSpinPrecessionTable,
  SPIN_PRECESSION_BOUNDS,
  SPIN_PRECESSION_PARTICLE_IDS,
  type SpinPrecessionInput,
  type SpinPrecessionParticleId,
  type SpinPrecessionResult,
} from '../../tour/spinPrecessionEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset, TourSelectControl } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type Prediction = '' | 'clockwise' | 'counterclockwise'

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: SpinPrecessionResult]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'signed-free-particle-moment-field-phase-1',
  implementationRevision: 'tour-spin-precession-engine-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'Under phi = -omega t with B along positive z, predict clockwise or counterclockwise rotation for the selected signed gamma; keep omega = 2 pi f explicit.'
const EXPECTED_COMPATIBILITY_KEY = '1b01bcdccd5827cfff17da710b1f5e3da5876ffd51eb82a0f6e4311a313b92c5'
const EXPECTED_PARTICLE_OPTIONS = Object.freeze([
  { value: 'electron', label: 'Electron' },
  { value: 'proton', label: 'Free proton' },
  { value: 'muon', label: 'Negative muon' },
] as const)
const EXPECTED_CONTROLS = Object.freeze([
  { id: 'magneticFieldTesla', inputRole: 'parameter', readingDepth: 'guided', default: 1, min: 1e-6, max: 20, step: 1e-6, unit: 'T' },
  { id: 'timeSeconds', inputRole: 'parameter', readingDepth: 'guided', default: 1e-6, min: 0, max: 10, step: 1e-9, unit: 's' },
  { id: 'sampleCount', inputRole: 'display-option', readingDepth: 'technical', default: 64, min: 2, max: 128, step: 1, unit: 'samples' },
] as const)
const EXPECTED_PRESETS = Object.freeze([
  { id: 'proton-nmr-1t', label: 'Free proton at 1 T', inputs: { particle: 'proton', magneticFieldTesla: 1, timeSeconds: 1e-6, sampleCount: 64 } },
  { id: 'proton-nmr-3t', label: 'Free proton at 3 T', inputs: { particle: 'proton', magneticFieldTesla: 3, timeSeconds: 1e-6, sampleCount: 64 } },
  { id: 'electron-resonance', label: 'Electron reference at 0.34 T', inputs: { particle: 'electron', magneticFieldTesla: 0.34, timeSeconds: 1e-9, sampleCount: 64 } },
  { id: 'earth-ish', label: 'Earth-ish free-proton field', inputs: { particle: 'proton', magneticFieldTesla: 5e-5, timeSeconds: 1e-3, sampleCount: 64 } },
] as const)
const EXPECTED_OUTPUTS = Object.freeze([
  ['signedCyclicGammaHzPerTesla', 'number', 'Hz T^-1', false],
  ['signedCyclicFrequencyHz', 'number', 'Hz', false],
  ['cyclicFrequencyMagnitudeHz', 'number', 'Hz', false],
  ['angularFrequencyRadPerSecond', 'number', 'rad s^-1', false],
  ['angularFrequencyMagnitudeRadPerSecond', 'number', 'rad s^-1', false],
  ['periodSeconds', 'number', 's', false],
  ['phaseRadians', 'number', 'rad', false],
  ['phaseCycles', 'number', 'cycles', false],
  ['rotationSense', 'string', null, false],
] as const)

function sameOrderedValues(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function selectControl(simulation: TourGeneratedSimulation, id: string): TourSelectControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'select' ? control : null
}

function numericControl(simulation: TourGeneratedSimulation, id: string): NumericControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'range' || control?.type === 'number' ? control : null
}

function isSpinInput(value: Record<string, number | string | boolean>): boolean {
  return sameOrderedValues(Object.keys(value).sort(), ['magneticFieldTesla', 'particle', 'sampleCount', 'timeSeconds'])
    && (SPIN_PRECESSION_PARTICLE_IDS as readonly unknown[]).includes(value.particle)
    && typeof value.magneticFieldTesla === 'number'
    && typeof value.timeSeconds === 'number'
    && typeof value.sampleCount === 'number'
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'spin-precession-visualizer') {
    return 'The simulation ID or schema version does not identify the spin-precession instrument.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The simulation revision does not match the spin-precession engine revision.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the phi = -omega t phase convention.'
  }
  if (simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY
    || !simulation.comparison.incompatibleBehavior.trim()) {
    return 'The generated comparison compatibility contract does not match this spin-precession revision.'
  }
  if (simulation.numericalMethod?.kind !== 'direct-evaluation' || !simulation.numericalMethod.deterministic
    || simulation.numericalMethod.implementationRef !== 'src/tour/spinPrecessionEngine.ts') {
    return 'The generated numerical-method contract does not identify the spin-precession engine.'
  }
  if (simulation.limits.tier !== 'immediate' || simulation.limits.maxOperations !== 1 || simulation.limits.maxDurationMs !== 16) {
    return 'The simulation does not declare the required bounded immediate runtime.'
  }
  if (simulation.visualization.kind !== 'signed-unit-circle-phase'
    || !sameOrderedValues(simulation.visualization.alternatives.map(({ type }) => type), ['text', 'table'])) {
    return 'The visualization contract does not provide the required unit-circle alternatives.'
  }

  const particleControl = selectControl(simulation, 'particle')
  const fieldControl = numericControl(simulation, 'magneticFieldTesla')
  const timeControl = numericControl(simulation, 'timeSeconds')
  const sampleControl = numericControl(simulation, 'sampleCount')
  if (simulation.controls.length !== 4
    || !sameOrderedValues(simulation.controls.map(({ id }) => id), ['particle', 'magneticFieldTesla', 'timeSeconds', 'sampleCount'])
    || !particleControl || !fieldControl || !timeControl || !sampleControl) {
    return 'The generated controls do not match the four spin-precession engine inputs.'
  }
  if (particleControl.inputRole !== 'preset-selection' || particleControl.readingDepth !== 'guided' || particleControl.default !== 'proton'
    || particleControl.type !== 'select'
    || particleControl.options.length !== EXPECTED_PARTICLE_OPTIONS.length
    || EXPECTED_PARTICLE_OPTIONS.some((expected, index) => {
      const option = particleControl.options[index]
      return !option || option.value !== expected.value || option.label !== expected.label || !option.description?.trim()
    })) {
    return 'The generated particle selector does not match the signed engine catalog.'
  }
  const numericControls = [fieldControl, timeControl, sampleControl]
  if (EXPECTED_CONTROLS.some((expected, index) => {
    const control = numericControls[index]
    return !control || control.id !== expected.id || control.type !== 'range'
      || control.inputRole !== expected.inputRole || control.readingDepth !== expected.readingDepth || control.default !== expected.default
      || control.min !== expected.min || control.max !== expected.max || control.step !== expected.step || control.unit !== expected.unit
  })) {
    return 'A generated numeric control is outside the spin-precession engine contract.'
  }
  if ([...simulation.controls, ...simulation.presets].some((item) => !item.label.trim() || !item.description.trim())
    || simulation.presets.some((preset) => !preset.inspectionPrompt.trim())) {
    return 'The generated controls or presets are missing required labels, descriptions, or prompts.'
  }
  if (simulation.presets.length !== EXPECTED_PRESETS.length || EXPECTED_PRESETS.some((expected, index) => {
    const preset = simulation.presets[index]
    return !preset || preset.id !== expected.id || preset.label !== expected.label
      || JSON.stringify(preset.inputs) !== JSON.stringify(expected.inputs)
  })) {
    return 'The spin-precession preset catalog does not match the generated contract.'
  }
  for (const preset of simulation.presets) {
    if (!isSpinInput(preset.inputs)) return `Preset ${preset.id} does not provide a complete spin-precession input.`
    try {
      evaluateSpinPrecession(preset.inputs as unknown as SpinPrecessionInput)
    } catch {
      return `Preset ${preset.id} is outside the spin-precession engine bounds.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length || EXPECTED_OUTPUTS.some((expected, index) => {
    const output = simulation.outputSchema[index]
    return !output || output.id !== expected[0] || output.type !== expected[1] || output.unit !== expected[2] || output.nullable !== expected[3]
  })) {
    return 'The generated output schema does not match the spin-precession result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const particleControl = selectControl(props.simulation, 'particle')
const fieldControl = numericControl(props.simulation, 'magneticFieldTesla')
const timeControl = numericControl(props.simulation, 'timeSeconds')
const sampleControl = numericControl(props.simulation, 'sampleCount')

function presetInput(preset: TourPreset | undefined): Required<SpinPrecessionInput> | null {
  return preset && isSpinInput(preset.inputs) ? preset.inputs as unknown as Required<SpinPrecessionInput> : null
}

const sourceDefaults: Required<SpinPrecessionInput> | null = particleControl && fieldControl && timeControl && sampleControl
  ? {
      particle: particleControl.default as SpinPrecessionParticleId,
      magneticFieldTesla: fieldControl.default,
      timeSeconds: timeControl.default,
      sampleCount: sampleControl.default,
    }
  : null
const initialPreset = props.initialPresetId ? props.simulation.presets.find(({ id }) => id === props.initialPresetId) : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const particle = ref<SpinPrecessionParticleId | ''>(initialInput?.particle ?? '')
const magneticFieldTesla = ref(initialInput?.magneticFieldTesla ?? Number.NaN)
const timeSeconds = ref(initialInput?.timeSeconds ?? Number.NaN)
const sampleCount = ref(initialInput?.sampleCount ?? Number.NaN)
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<SpinPrecessionResult | null>(null)
const evaluationError = ref<string | null>(null)

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input && input.particle === particle.value && input.magneticFieldTesla === magneticFieldTesla.value
    && input.timeSeconds === timeSeconds.value && input.sampleCount === sampleCount.value
}) ?? null)
const sampleRows = computed(() => result.value ? projectSpinPrecessionTable(result.value) : [])
const endpoint = computed(() => result.value?.samples.at(-1) ?? null)
const vectorX = computed(() => 160 + (endpoint.value?.x ?? 1) * 92)
const vectorY = computed(() => 130 - (endpoint.value?.y ?? 0) * 92)
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'counterclockwise', label: 'Counterclockwise' },
  { value: 'clockwise', label: 'Clockwise' },
]
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value || !result.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  return `Prediction: ${predicted}. Result: ${result.value.rotationSense} under phi = -omega t, x=cos(phi), y=sin(phi), with B along positive z. ${recordedPrediction.value === result.value.rotationSense ? 'The two align.' : 'The two differ.'}`
})

function formatNumber(value: number, precision = 7): string {
  return Number.isFinite(value) ? value.toPrecision(precision) : 'unavailable'
}

function currentInput(): SpinPrecessionInput | null {
  if (contractError || !particle.value) return null
  return {
    particle: particle.value,
    magneticFieldTesla: magneticFieldTesla.value,
    timeSeconds: timeSeconds.value,
    sampleCount: sampleCount.value,
  }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateSpinPrecession(input)
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The spin-precession engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: Required<SpinPrecessionInput>): void {
  particle.value = input.particle
  magneticFieldTesla.value = input.magneticFieldTesla
  timeSeconds.value = input.timeSeconds
  sampleCount.value = input.sampleCount
}

function applyPreset(preset: TourPreset): void {
  const input = presetInput(preset)
  if (input) assignInput(input)
}

function resetVisualizer(): void {
  if (sourceDefaults) assignInput(sourceDefaults)
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  evaluationError.value = null
}

function outputLabel(id: string): string {
  return props.simulation.outputSchema.find((field) => field.id === id)?.label ?? id
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([particle, magneticFieldTesla, timeSeconds, sampleCount], () => {
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
section(data-testid="spin-precession-visualizer", :aria-labelledby="`${simulation.id}-title`")
  header
    p Spin phase instrument
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", role="alert", data-testid="spin-contract-error")  This activity cannot run because its generated contract and spin-precession engine do not agree. {{ contractError }}
  template(v-else)
    section(aria-labelledby="spin-presets-title")
      h3(id="spin-presets-title") Try a generated setup
      ul
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(class="spin-hit-target", type="button", :data-testid="`spin-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", data-testid="spin-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(aria-labelledby="spin-controls-title")
      h3(id="spin-controls-title") Set the signed phase model
      div(v-if="particleControl", data-testid="spin-control-particle")
        label(for="spin-particle") {{ particleControl.label }}
        select(id="spin-particle", v-model="particle", class="spin-hit-target", data-testid="spin-particle", aria-describedby="spin-particle-description")
          option(v-for="option in particleControl.options", :key="option.value", :value="option.value") {{ option.label }}
        p(id="spin-particle-description") {{ particleControl.description }} {{ particleControl.options.find(({ value }) => value === particle)?.description }} {{ particleControl.playfulPrompt }}
      div(v-if="fieldControl", data-testid="spin-control-magneticFieldTesla")
        label(for="spin-field") {{ fieldControl.label }}
        input(id="spin-field", v-model.number="magneticFieldTesla", class="spin-hit-target", data-testid="spin-field", :type="fieldControl.type", :min="fieldControl.min", :max="fieldControl.max", :step="fieldControl.step", aria-describedby="spin-field-description")
        output(for="spin-field") {{ magneticFieldTesla }} {{ fieldControl.unit }}
        p(id="spin-field-description") {{ fieldControl.description }} {{ fieldControl.playfulPrompt }}
      div(v-if="timeControl", data-testid="spin-control-timeSeconds")
        label(for="spin-time") {{ timeControl.label }}
        input(id="spin-time", v-model.number="timeSeconds", class="spin-hit-target", data-testid="spin-time", :type="timeControl.type", :min="timeControl.min", :max="timeControl.max", :step="timeControl.step", aria-describedby="spin-time-description")
        output(for="spin-time") {{ timeSeconds }} {{ timeControl.unit }}
        p(id="spin-time-description") {{ timeControl.description }} {{ timeControl.playfulPrompt }}
      div(v-if="depth === 'technical' && sampleControl", data-testid="spin-control-sampleCount")
        label(for="spin-samples") {{ sampleControl.label }}
        input(id="spin-samples", v-model.number="sampleCount", class="spin-hit-target", data-testid="spin-samples", :type="sampleControl.type", :min="sampleControl.min", :max="sampleControl.max", :step="sampleControl.step", aria-describedby="spin-samples-description")
        output(for="spin-samples") {{ sampleCount }}
        p(id="spin-samples-description") {{ sampleControl.description }} {{ sampleControl.playfulPrompt }}
      p(v-if="depth === 'guided'", data-testid="spin-guided-sample-disclosure") The static visualization and accessible table use {{ sampleCount }} deterministic phase samples. Technical depth exposes this display-resolution control; it does not change the endpoint phase.
    fieldset(data-testid="spin-prediction-gate")
      legend Make a prediction before revealing the phase vector
      p {{ simulation.predictionPrompt }}
      label(v-for="option in predictionOptions", :key="option.value", class="spin-prediction-target")
        input(v-model="prediction", type="radio", name="spin-prediction", :value="option.value", :data-testid="`spin-prediction-${option.value}`")
        |  {{ option.label }}
    button(class="spin-hit-target", type="button", data-testid="reveal-spin-result", :disabled="!prediction", @click="revealResult") Reveal result
    button(class="spin-hit-target", type="button", data-testid="reset-spin-visualizer", @click="resetVisualizer") Reset
    p(v-if="evaluationError", role="alert", data-testid="spin-evaluation-error") The spin-precession engine could not produce a result. {{ evaluationError }}
    p(v-if="predictionStale", aria-live="polite", data-testid="spin-prediction-stale") The setup changed, so the previous prediction is not compared with this live result. Make a fresh prediction for the current setup.
    section(v-if="revealed && result", data-testid="spin-result", aria-labelledby="spin-result-title")
      h3(id="spin-result-title") Static endpoint phase vector
      svg(class="spin-phase-stage", viewBox="0 0 640 270", role="img", aria-labelledby="spin-svg-title spin-svg-description", data-testid="spin-svg")
        title(id="spin-svg-title") Signed unit-circle endpoint phase
        desc(id="spin-svg-description") Static final unit vector for {{ result.particleLabel }} at {{ result.magneticFieldTesla }} tesla and {{ result.timeSeconds }} seconds. Rotation sense is {{ result.rotationSense }} under the declared phase convention.
        circle(class="spin-unit-circle", cx="160", cy="130", r="92")
        line(class="spin-axis", x1="52", x2="268", y1="130", y2="130")
        line(class="spin-axis", x1="160", x2="160", y1="22", y2="238")
        line(class="spin-vector", x1="160", y1="130", :x2="vectorX", :y2="vectorY", marker-end="url(#spin-arrow)")
        circle(class="spin-endpoint", :cx="vectorX", :cy="vectorY", r="7")
        defs
          marker(id="spin-arrow", markerWidth="8", markerHeight="8", refX="5", refY="4", orient="auto")
            path(d="M0,0 L8,4 L0,8 z")
        text(x="306", y="66") signed cyclic f = {{ formatNumber(result.signedCyclicFrequencyHz) }} Hz
        text(x="306", y="102") signed angular ω = {{ formatNumber(result.angularFrequencyRadPerSecond) }} rad s^-1
        text(x="306", y="138") T = {{ formatNumber(result.periodSeconds) }} s
        text(x="306", y="174") φ = {{ formatNumber(result.phaseRadians) }} rad
        text(x="306", y="210") {{ result.rotationSense }}
      p(data-testid="spin-text-alternative")  Static final vector for {{ result.particleLabel }}: signed cyclic frequency {{ formatNumber(result.signedCyclicFrequencyHz) }} Hz, signed angular frequency {{ formatNumber(result.angularFrequencyRadPerSecond) }} rad s^-1, positive period {{ formatNumber(result.periodSeconds) }} s, and signed endpoint phase {{ formatNumber(result.phaseRadians) }} rad. This is model phase, not a measured spin trajectory or detector signal. 
      dl
        dt {{ outputLabel('signedCyclicGammaHzPerTesla') }}
        dd(data-testid="spin-gamma") {{ formatNumber(result.signedCyclicGammaHzPerTesla) }} Hz T^-1
        dt {{ outputLabel('signedCyclicFrequencyHz') }}
        dd(data-testid="spin-cyclic-frequency") {{ formatNumber(result.signedCyclicFrequencyHz) }} Hz
        dt {{ outputLabel('angularFrequencyRadPerSecond') }}
        dd(data-testid="spin-angular-frequency") {{ formatNumber(result.angularFrequencyRadPerSecond) }} rad s^-1
        dt {{ outputLabel('periodSeconds') }}
        dd(data-testid="spin-period") {{ formatNumber(result.periodSeconds) }} s
        dt {{ outputLabel('phaseRadians') }}
        dd {{ formatNumber(result.phaseRadians) }} rad
        dt {{ outputLabel('rotationSense') }}
        dd {{ result.rotationSense }}
      p(data-testid="spin-frequency-distinction") Signed cyclic frequency f is in cycles per second (Hz). Signed angular frequency omega is in radians per second and equals exactly 2 pi f. Coordinate phase is phi = -omega t, so its rotation direction has the opposite sign; the positive period is 1/|f|.
      p(data-testid="spin-prediction-comparison") {{ predictionComparison }}
      table(data-testid="spin-sample-table")
        caption Bounded deterministic phase-model samples including both endpoints; coordinates are visualization state, not measurements
        thead
          tr
            th(scope="col") Sample
            th(scope="col") Model time (s)
            th(scope="col") Signed phase (rad)
            th(scope="col") x
            th(scope="col") y
        tbody
          tr(v-for="row in sampleRows", :key="row.sample")
            th(scope="row") {{ row.sample }}
            td {{ formatNumber(row.timeSeconds) }}
            td {{ formatNumber(row.phaseRadians) }}
            td {{ formatNumber(row.x) }}
            td {{ formatNumber(row.y) }}
      section(data-testid="spin-finding-panel", aria-labelledby="spin-finding-title")
        h3(id="spin-finding-title") Live finding
        p(role="status", aria-live="polite") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="spin-finding-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd {{ result.finding.claimClass }}
          dt Model origin
          dd {{ result.finding.modelOrigin }}
          dt Method relationship
          dd {{ result.finding.methodRelationship }}
          dt Source revision
          dd(data-testid="spin-source-revision") {{ result.finding.sourceRevision }}
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
        p(data-testid="spin-does-not-establish") {{ result.finding.doesNotEstablish }}
        h4 Scientific caveats
        ul(data-testid="spin-caveats")
          li(v-for="caveat in result.finding.caveats", :key="caveat") {{ caveat }}
        h4 Evidence references
        ul(data-testid="spin-evidence")
          li(v-for="evidenceRef in result.finding.evidenceRefs", :key="evidenceRef")
            a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
        p(data-testid="spin-validation-boundary")
          | No resonance measurement, relaxation fit, material response, detector comparison, or theory validation is claimed; 
          code validatesTheory
          |  is {{ result.finding.validatesTheory }}.
    section(v-if="depth === 'technical'", data-testid="spin-technical-disclosure")
      h3 Technical sign and model boundary
      p The catalog input is signed cyclic gamma/(2 pi), not angular gamma. The coordinate convention is phi = -omega t, so signed frequency and coordinate-phase direction must not be conflated. The vector is rendered directly at its final bounded phase with no animated motion.
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
      h4 Generated model components
      dl(v-for="component in simulation.modelComponents", :key="component.id")
        dt {{ component.label }}
        dd {{ component.description }} Source: {{ component.attribution.sourceLocator }}
</template>

<style scoped>
.spin-hit-target {
  min-block-size: 44px;
  min-inline-size: 44px;
  max-inline-size: 100%;
}

input.spin-hit-target[type='range'] {
  inline-size: min(100%, 24rem);
}

button.spin-hit-target {
  white-space: normal;
}

.spin-prediction-target {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 44px;
  max-inline-size: 100%;
}

.spin-phase-stage {
  display: block;
  width: min(100%, 46rem);
  min-height: 17rem;
  color: currentColor;
}

.spin-unit-circle,
.spin-axis {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.spin-vector {
  stroke: #2b699a;
  stroke-width: 4;
}

.spin-endpoint,
.spin-phase-stage path {
  fill: #2b699a;
  stroke: currentColor;
  stroke-width: 1;
}

.spin-phase-stage text {
  fill: currentColor;
  font-size: 13px;
}

@media (forced-colors: active) {
  .spin-hit-target {
    border: 1px solid ButtonText;
  }

  input.spin-hit-target[type='range'] {
    accent-color: Highlight;
  }

  .spin-prediction-target {
    outline: 1px solid CanvasText;
  }

  .spin-vector {
    stroke: Highlight;
  }

  .spin-endpoint,
  .spin-phase-stage path {
    fill: Highlight;
  }
}
</style>
