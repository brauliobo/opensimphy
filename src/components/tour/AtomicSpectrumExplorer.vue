<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ATOMIC_NUCLEUS_MODEL_IDS,
  ATOMIC_SPECTRUM_BOUNDS,
  evaluateAtomicSpectrum,
  projectAtomicSpectrumTable,
  type AtomicNucleusModelId,
  type AtomicSpectrumInput,
  type AtomicSpectrumResult,
} from '../../tour/atomicSpectrumEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset, TourSelectControl } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type Prediction = '' | 'longer' | 'shorter' | 'unchanged'
type AtomicMassComparison = {
  proton: AtomicSpectrumResult
  infinite: AtomicSpectrumResult
  outcome: Exclude<Prediction, ''>
}

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: AtomicSpectrumResult]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'hydrogen-like-rydberg-reduced-mass-1',
  implementationRevision: 'tour-atomic-spectrum-engine-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'For the selected transition, use the finite-proton reduced-mass factor below one to predict whether its wavelength is longer, shorter, or unchanged relative to the same infinite-mass state.'
const EXPECTED_COMPATIBILITY_KEY = 'ad0957023e1656a45003c137207e8a18031e3060ce8a099a297516c3895389b7'
const EXPECTED_NUCLEUS_OPTIONS = Object.freeze([
  { value: 'infinite', label: 'Infinite nuclear mass' },
  { value: 'proton', label: 'Finite proton mass' },
] as const)
const EXPECTED_CONTROLS = Object.freeze([
  { id: 'atomicNumber', type: 'range', inputRole: 'parameter', readingDepth: 'technical', default: 1, min: 1, max: 10, step: 1, unit: '1' },
  { id: 'nUpper', type: 'range', inputRole: 'parameter', readingDepth: 'guided', default: 3, min: 2, max: 12, step: 1, unit: '1' },
  { id: 'nLower', type: 'range', inputRole: 'parameter', readingDepth: 'guided', default: 2, min: 1, max: 11, step: 1, unit: '1' },
] as const)
const EXPECTED_PRESETS = Object.freeze([
  { id: 'balmer-alpha', label: 'Balmer-alpha', inputs: { atomicNumber: 1, nUpper: 3, nLower: 2, nucleusModel: 'proton' } },
  { id: 'lyman-alpha', label: 'Lyman-alpha', inputs: { atomicNumber: 1, nUpper: 2, nLower: 1, nucleusModel: 'proton' } },
  { id: 'balmer-alpha-infinite', label: 'Balmer-alpha, infinite nucleus', inputs: { atomicNumber: 1, nUpper: 3, nLower: 2, nucleusModel: 'infinite' } },
] as const)
const EXPECTED_OUTPUTS = Object.freeze([
  ['reducedMassFactor', 'number', null, false],
  ['effectiveRydbergMInverse', 'number', 'm^-1', false],
  ['energyJ', 'number', 'J', false],
  ['energyEv', 'number', 'eV', false],
  ['frequencyHz', 'number', 'Hz', false],
  ['vacuumWavelengthM', 'number', 'm', false],
  ['vacuumWavelengthNm', 'number', 'nm', false],
  ['series', 'string', null, true],
  ['spectralRegion', 'string', null, false],
  ['visible', 'boolean', null, false],
] as const)

function sameOrderedValues(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function numericControl(simulation: TourGeneratedSimulation, id: string): NumericControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'range' || control?.type === 'number' ? control : null
}

function selectControl(simulation: TourGeneratedSimulation, id: string): TourSelectControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'select' ? control : null
}

function isAtomicInput(value: Record<string, number | string | boolean>): boolean {
  return sameOrderedValues(Object.keys(value).sort(), ['atomicNumber', 'nLower', 'nUpper', 'nucleusModel'])
    && typeof value.atomicNumber === 'number'
    && typeof value.nUpper === 'number'
    && typeof value.nLower === 'number'
    && (ATOMIC_NUCLEUS_MODEL_IDS as readonly unknown[]).includes(value.nucleusModel)
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'hydrogen-spectrum-explorer' || simulation.lessonId !== 'hydrogen-spectra') {
    return 'The simulation ID or schema version does not identify the atomic-spectrum instrument.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The simulation revision does not match the atomic-spectrum engine revision.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the finite-proton comparison task.'
  }
  if (simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY
    || !simulation.comparison.incompatibleBehavior.trim()) {
    return 'The generated comparison compatibility contract does not match this atomic-spectrum revision.'
  }
  if (simulation.numericalMethod?.kind !== 'direct-evaluation' || !simulation.numericalMethod.deterministic
    || simulation.numericalMethod.implementationRef !== 'src/tour/atomicSpectrumEngine.ts') {
    return 'The generated numerical-method contract does not identify the atomic-spectrum engine.'
  }
  if (simulation.limits.tier !== 'immediate' || simulation.limits.maxOperations !== 2 || simulation.limits.maxDurationMs !== 16) {
    return 'The simulation does not declare the required bounded immediate runtime.'
  }
  if (simulation.visualization.kind !== 'hydrogen-like-level-and-spectrum'
    || !sameOrderedValues(simulation.visualization.alternatives.map(({ type }) => type), ['text', 'table'])) {
    return 'The visualization contract does not provide the required atomic stage alternatives.'
  }

  const atomicNumberControl = numericControl(simulation, 'atomicNumber')
  const upperControl = numericControl(simulation, 'nUpper')
  const lowerControl = numericControl(simulation, 'nLower')
  const nucleusControl = selectControl(simulation, 'nucleusModel')
  if (simulation.controls.length !== 4
    || !sameOrderedValues(simulation.controls.map(({ id }) => id), ['atomicNumber', 'nUpper', 'nLower', 'nucleusModel'])
    || !atomicNumberControl || !upperControl || !lowerControl || !nucleusControl) {
    return 'The generated controls do not match the four atomic-spectrum engine inputs.'
  }
  const numericControls = [atomicNumberControl, upperControl, lowerControl]
  if (EXPECTED_CONTROLS.some((expected, index) => {
    const control = numericControls[index]
    return !control || control.id !== expected.id || control.type !== expected.type
      || control.inputRole !== expected.inputRole || control.readingDepth !== expected.readingDepth || control.default !== expected.default
      || control.min !== expected.min || control.max !== expected.max || control.step !== expected.step || control.unit !== expected.unit
  })) {
    return 'A generated numeric control is outside the atomic-spectrum engine contract.'
  }
  if (nucleusControl.inputRole !== 'preset-selection' || nucleusControl.readingDepth !== 'guided' || nucleusControl.default !== 'proton'
    || nucleusControl.type !== 'select'
    || nucleusControl.options.length !== EXPECTED_NUCLEUS_OPTIONS.length
    || EXPECTED_NUCLEUS_OPTIONS.some((expected, index) => {
      const option = nucleusControl.options[index]
      return !option || option.value !== expected.value || option.label !== expected.label || !option.description?.trim()
    })) {
    return 'The nuclear-mass control does not match the bounded engine catalog.'
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
    return 'The atomic-spectrum preset catalog does not match the generated contract.'
  }
  for (const preset of simulation.presets) {
    if (!isAtomicInput(preset.inputs)) return `Preset ${preset.id} does not provide a complete atomic-spectrum input.`
    try {
      evaluateAtomicSpectrum(preset.inputs as unknown as AtomicSpectrumInput)
    } catch {
      return `Preset ${preset.id} is outside the atomic-spectrum engine bounds.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length || EXPECTED_OUTPUTS.some((expected, index) => {
    const output = simulation.outputSchema[index]
    return !output || output.id !== expected[0] || output.type !== expected[1] || output.unit !== expected[2] || output.nullable !== expected[3]
  })) {
    return 'The generated output schema does not match the atomic-spectrum result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const atomicNumberControl = numericControl(props.simulation, 'atomicNumber')
const upperControl = numericControl(props.simulation, 'nUpper')
const lowerControl = numericControl(props.simulation, 'nLower')
const nucleusControl = selectControl(props.simulation, 'nucleusModel')

function presetInput(preset: TourPreset | undefined): AtomicSpectrumInput | null {
  return preset && isAtomicInput(preset.inputs) ? preset.inputs as unknown as AtomicSpectrumInput : null
}

const sourceDefaults: AtomicSpectrumInput | null = atomicNumberControl && upperControl && lowerControl && nucleusControl
  ? {
      atomicNumber: atomicNumberControl.default,
      nUpper: upperControl.default,
      nLower: lowerControl.default,
      nucleusModel: nucleusControl.default as AtomicNucleusModelId,
    }
  : null
const initialPreset = props.initialPresetId ? props.simulation.presets.find(({ id }) => id === props.initialPresetId) : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const atomicNumber = ref(initialInput?.atomicNumber ?? Number.NaN)
const nUpper = ref(initialInput?.nUpper ?? Number.NaN)
const nLower = ref(initialInput?.nLower ?? Number.NaN)
const nucleusModel = ref<AtomicNucleusModelId | ''>(initialInput?.nucleusModel ?? '')
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<AtomicSpectrumResult | null>(null)
const massComparison = ref<AtomicMassComparison | null>(null)
const evaluationError = ref<string | null>(null)

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input && input.atomicNumber === atomicNumber.value && input.nUpper === nUpper.value
    && input.nLower === nLower.value && input.nucleusModel === nucleusModel.value
}) ?? null)
const seriesRows = computed(() => result.value ? projectAtomicSpectrumTable(result.value) : [])
const levelNumbers = computed(() => Array.from({ length: Math.max(4, nUpper.value || 4) }, (_, index) => index + 1))
const transitionX = computed(() => 128 + Math.min(atomicNumber.value || 1, 10) * 4)
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'longer', label: 'Longer wavelength' },
  { value: 'shorter', label: 'Shorter wavelength' },
  { value: 'unchanged', label: 'No wavelength change' },
]
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value || !result.value || !massComparison.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  const comparison = massComparison.value
  return `Prediction: ${predicted}. Result: finite proton mass gives ${formatNumber(comparison.proton.vacuumWavelengthNm)} nm versus ${formatNumber(comparison.infinite.vacuumWavelengthNm)} nm for the same infinite-mass state, so it is ${comparison.outcome}. ${recordedPrediction.value === comparison.outcome ? 'The two align.' : 'The two differ.'}`
})

function levelY(level: number): number {
  return 214 - 176 * (1 - 1 / level ** 2)
}

function formatNumber(value: number, precision = 7): string {
  return Number.isFinite(value) ? value.toPrecision(precision) : 'unavailable'
}

function currentInput(): AtomicSpectrumInput | null {
  if (contractError || !nucleusModel.value) return null
  return { atomicNumber: atomicNumber.value, nUpper: nUpper.value, nLower: nLower.value, nucleusModel: nucleusModel.value }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateAtomicSpectrum(input)
    const counterpart = evaluateAtomicSpectrum({
      ...input,
      nucleusModel: input.nucleusModel === 'proton' ? 'infinite' : 'proton',
    })
    const proton = input.nucleusModel === 'proton' ? output : counterpart
    const infinite = input.nucleusModel === 'infinite' ? output : counterpart
    result.value = output
    massComparison.value = {
      proton,
      infinite,
      outcome: proton.vacuumWavelengthNm > infinite.vacuumWavelengthNm
        ? 'longer'
        : proton.vacuumWavelengthNm < infinite.vacuumWavelengthNm ? 'shorter' : 'unchanged',
    }
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    massComparison.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The atomic-spectrum engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: AtomicSpectrumInput): void {
  atomicNumber.value = input.atomicNumber
  nUpper.value = input.nUpper
  nLower.value = input.nLower
  nucleusModel.value = input.nucleusModel
}

function applyPreset(preset: TourPreset): void {
  const input = presetInput(preset)
  if (input) assignInput(input)
}

function resetExplorer(): void {
  if (sourceDefaults) assignInput(sourceDefaults)
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  massComparison.value = null
  evaluationError.value = null
}

function outputLabel(id: string): string {
  return props.simulation.outputSchema.find((field) => field.id === id)?.label ?? id
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([atomicNumber, nUpper, nLower, nucleusModel], () => {
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
section(data-testid="atomic-spectrum-explorer", :aria-labelledby="`${simulation.id}-title`")
  header
    p Atomic spectrum instrument
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", role="alert", data-testid="atomic-contract-error")  This activity cannot run because its generated contract and atomic-spectrum engine do not agree. {{ contractError }}
  template(v-else)
    section(aria-labelledby="atomic-presets-title")
      h3(id="atomic-presets-title") Try a generated setup
      ul
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(class="atomic-hit-target", type="button", :data-testid="`atomic-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", data-testid="atomic-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(aria-labelledby="atomic-controls-title")
      h3(id="atomic-controls-title") Set the model transition
      div(v-if="depth === 'technical' && atomicNumberControl", data-testid="atomic-control-atomicNumber")
        label(for="atomic-number") {{ atomicNumberControl.label }}
        input(id="atomic-number", v-model.number="atomicNumber", class="atomic-hit-target", data-testid="atomic-number", :type="atomicNumberControl.type", :min="atomicNumberControl.min", :max="atomicNumberControl.max", :step="atomicNumberControl.step", aria-describedby="atomic-number-description")
        output(for="atomic-number") {{ atomicNumber }}
        p(id="atomic-number-description") {{ atomicNumberControl.description }} {{ atomicNumberControl.playfulPrompt }}
      p(v-if="depth === 'guided'", data-testid="atomic-guided-z-disclosure")  Atomic number Z remains fixed at {{ atomicNumber }} in Guided depth. Technical depth exposes this bounded hydrogen-like-ion parameter. 
      div(v-if="upperControl", data-testid="atomic-control-nUpper")
        label(for="atomic-upper") {{ upperControl.label }}
        input(id="atomic-upper", v-model.number="nUpper", class="atomic-hit-target", data-testid="atomic-upper", :type="upperControl.type", :min="Math.max(upperControl.min, nLower + 1)", :max="upperControl.max", :step="upperControl.step", aria-describedby="atomic-upper-description")
        output(for="atomic-upper") {{ nUpper }}
        p(id="atomic-upper-description") {{ upperControl.description }} {{ upperControl.playfulPrompt }}
      div(v-if="lowerControl", data-testid="atomic-control-nLower")
        label(for="atomic-lower") {{ lowerControl.label }}
        input(id="atomic-lower", v-model.number="nLower", class="atomic-hit-target", data-testid="atomic-lower", :type="lowerControl.type", :min="lowerControl.min", :max="Math.min(lowerControl.max, nUpper - 1)", :step="lowerControl.step", aria-describedby="atomic-lower-description")
        output(for="atomic-lower") {{ nLower }}
        p(id="atomic-lower-description") {{ lowerControl.description }} {{ lowerControl.playfulPrompt }}
      div(v-if="nucleusControl", data-testid="atomic-control-nucleusModel")
        label(for="atomic-nucleus") {{ nucleusControl.label }}
        select(id="atomic-nucleus", v-model="nucleusModel", class="atomic-hit-target", data-testid="atomic-nucleus", aria-describedby="atomic-nucleus-description")
          option(v-for="option in nucleusControl.options", :key="option.value", :value="option.value") {{ option.label }}
        p(id="atomic-nucleus-description") {{ nucleusControl.description }} {{ nucleusControl.options.find(({ value }) => value === nucleusModel)?.description }} {{ nucleusControl.playfulPrompt }}
    fieldset(data-testid="atomic-prediction-gate")
      legend Make a prediction before revealing the spectrum
      p {{ simulation.predictionPrompt }}
      label(v-for="option in predictionOptions", :key="option.value", class="atomic-prediction-target")
        input(v-model="prediction", type="radio", name="atomic-prediction", :value="option.value", :data-testid="`atomic-prediction-${option.value}`")
        |  {{ option.label }}
    button(class="atomic-hit-target", type="button", data-testid="reveal-atomic-result", :disabled="!prediction", @click="revealResult") Reveal result
    button(class="atomic-hit-target", type="button", data-testid="reset-atomic-explorer", @click="resetExplorer") Reset
    p(v-if="evaluationError", role="alert", data-testid="atomic-evaluation-error") The atomic-spectrum engine could not produce a result. {{ evaluationError }}
    p(v-if="predictionStale", aria-live="polite", data-testid="atomic-prediction-stale") The setup changed, so the previous prediction is not compared with this live result. Make a fresh prediction for the current setup.
    section(v-if="revealed && result", data-testid="atomic-result", aria-labelledby="atomic-result-title")
      h3(id="atomic-result-title") Energy levels and selected transition
      svg(class="atomic-level-stage", viewBox="0 0 640 250", role="img", aria-labelledby="atomic-svg-title atomic-svg-description", data-testid="atomic-svg")
        title(id="atomic-svg-title") Hydrogen-like energy levels and transition
        desc(id="atomic-svg-description") Atomic number {{ result.atomicNumber }}, downward transition from n={{ result.nUpper }} to n={{ result.nLower }}, {{ result.vacuumWavelengthNm }} nanometres in vacuum.
        g(v-for="level in levelNumbers", :key="level")
          line(class="atomic-level", x1="52", x2="286", :y1="levelY(level)", :y2="levelY(level)")
          text(x="18", :y="levelY(level) + 4") n={{ level }}
        line(class="atomic-transition", :x1="transitionX", :x2="transitionX", :y1="levelY(result.nUpper)", :y2="levelY(result.nLower)", marker-end="url(#atomic-arrow)")
        defs
          marker(id="atomic-arrow", markerWidth="8", markerHeight="8", refX="4", refY="4", orient="auto")
            path(d="M0,0 L8,4 L0,8 z")
        line(class="atomic-spectrum-axis", x1="350", x2="606", y1="174", y2="174")
        line(class="atomic-spectrum-marker", x1="478", x2="478", y1="142", y2="192")
        text(x="350", y="214") {{ formatNumber(result.vacuumWavelengthNm, 6) }} nm, {{ result.spectralRegion }}
        text(x="350", y="235") {{ result.label }}
      p(data-testid="atomic-text-alternative")  Z={{ result.atomicNumber }}, n={{ result.nUpper }} to n={{ result.nLower }}, {{ result.nucleusModel }} nuclear-mass model: {{ result.label }}, {{ formatNumber(result.energyEv) }} eV, {{ formatNumber(result.frequencyHz) }} Hz, {{ formatNumber(result.vacuumWavelengthNm) }} nm in vacuum, {{ result.spectralRegion }} region. 
      dl
        dt {{ outputLabel('reducedMassFactor') }}
        dd(data-testid="atomic-reduced-mass") {{ formatNumber(result.reducedMassFactor, 10) }}
        dt {{ outputLabel('energyEv') }}
        dd(data-testid="atomic-energy-ev") {{ formatNumber(result.energyEv) }} eV
        dt {{ outputLabel('frequencyHz') }}
        dd(data-testid="atomic-frequency") {{ formatNumber(result.frequencyHz) }} Hz
        dt {{ outputLabel('vacuumWavelengthNm') }}
        dd(data-testid="atomic-wavelength") {{ formatNumber(result.vacuumWavelengthNm) }} nm
        dt {{ outputLabel('series') }}
        dd {{ result.series ?? 'No named Lyman, Balmer, or Paschen series' }}
        dt {{ outputLabel('spectralRegion') }}
        dd {{ result.spectralRegion }}
      p(data-testid="atomic-prediction-comparison") {{ predictionComparison }}
      table(v-if="massComparison", data-testid="atomic-mass-comparison-table")
        caption Compatible finite-proton and infinite-nuclear-mass evaluations for the same Z and principal-level transition
        thead
          tr
            th(scope="col") Nuclear-mass model
            th(scope="col") Reduced-mass factor
            th(scope="col") Energy (eV)
            th(scope="col") Cyclic frequency (Hz)
            th(scope="col") Vacuum wavelength (nm)
        tbody
          tr
            th(scope="row") Finite proton mass
            td {{ formatNumber(massComparison.proton.reducedMassFactor, 10) }}
            td {{ formatNumber(massComparison.proton.energyEv) }}
            td {{ formatNumber(massComparison.proton.frequencyHz) }}
            td(data-testid="atomic-proton-comparison-wavelength") {{ formatNumber(massComparison.proton.vacuumWavelengthNm) }}
          tr
            th(scope="row") Infinite nuclear mass
            td {{ formatNumber(massComparison.infinite.reducedMassFactor, 10) }}
            td {{ formatNumber(massComparison.infinite.energyEv) }}
            td {{ formatNumber(massComparison.infinite.frequencyHz) }}
            td(data-testid="atomic-infinite-comparison-wavelength") {{ formatNumber(massComparison.infinite.vacuumWavelengthNm) }}
      table(data-testid="atomic-series-table")
        caption Bounded same-lower-level hydrogen-like series; listed energy differences are not transition-strength or observation claims
        thead
          tr
            th(scope="col") Transition
            th(scope="col") Series
            th(scope="col") Energy (eV)
            th(scope="col") Cyclic frequency (Hz)
            th(scope="col") Vacuum wavelength (nm)
            th(scope="col") Region
            th(scope="col") Visible
        tbody
          tr(v-for="row in seriesRows", :key="row.transition")
            th(scope="row") {{ row.transition }}
            td {{ row.series }}
            td {{ formatNumber(row.energyEv) }}
            td {{ formatNumber(row.frequencyHz) }}
            td {{ formatNumber(row.vacuumWavelengthNm) }}
            td {{ row.spectralRegion }}
            td {{ row.visible ? 'yes' : 'no' }}
      section(data-testid="atomic-finding-panel", aria-labelledby="atomic-finding-title")
        h3(id="atomic-finding-title") Live finding
        p(role="status", aria-live="polite") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="atomic-finding-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd {{ result.finding.claimClass }}
          dt Model origin
          dd {{ result.finding.modelOrigin }}
          dt Method relationship
          dd {{ result.finding.methodRelationship }}
          dt Source revision
          dd(data-testid="atomic-source-revision") {{ result.finding.sourceRevision }}
          dt Source locator
          dd {{ result.finding.sourceLocator }}
        h4 What changed
        p {{ result.finding.changed }}
        dl(v-if="massComparison", data-testid="atomic-comparison-finding")
          dt Finite-proton wavelength
          dd {{ formatNumber(massComparison.proton.vacuumWavelengthNm) }} nm
          dt Infinite-mass wavelength
          dd {{ formatNumber(massComparison.infinite.vacuumWavelengthNm) }} nm
          dt Computed comparison
          dd Finite-proton wavelength is {{ massComparison.outcome }}.
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
        p(data-testid="atomic-does-not-establish") {{ result.finding.doesNotEstablish }}
        h4 Scientific caveats
        ul(data-testid="atomic-caveats")
          li(v-for="caveat in result.finding.caveats", :key="caveat") {{ caveat }}
        h4 Evidence references
        ul(data-testid="atomic-evidence")
          li(v-for="evidenceRef in result.finding.evidenceRefs", :key="evidenceRef")
            a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
        p(data-testid="atomic-validation-boundary")
          | No empirical spectrum comparison or theory validation is claimed; 
          code validatesTheory
          |  is {{ result.finding.validatesTheory }}.
    section(v-if="depth === 'technical'", data-testid="atomic-technical-disclosure")
      h3 Technical model boundary
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
      h4 Generated model components
      dl(v-for="component in simulation.modelComponents", :key="component.id")
        dt {{ component.label }}
        dd {{ component.description }} Source: {{ component.attribution.sourceLocator }}
</template>

<style scoped>
.atomic-hit-target {
  min-block-size: 44px;
  min-inline-size: 44px;
  max-inline-size: 100%;
}

input.atomic-hit-target[type='range'] {
  inline-size: min(100%, 24rem);
}

button.atomic-hit-target {
  white-space: normal;
}

.atomic-prediction-target {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 44px;
  max-inline-size: 100%;
}

.atomic-level-stage {
  display: block;
  width: min(100%, 46rem);
  min-height: 16rem;
  color: currentColor;
}

.atomic-level,
.atomic-spectrum-axis {
  stroke: currentColor;
  stroke-width: 1.5;
}

.atomic-transition,
.atomic-spectrum-marker {
  stroke: #b33a2b;
  stroke-width: 3;
}

.atomic-level-stage path {
  fill: #b33a2b;
}

.atomic-level-stage text {
  fill: currentColor;
  font-size: 13px;
}

@media (forced-colors: active) {
  .atomic-hit-target {
    border: 1px solid ButtonText;
  }

  input.atomic-hit-target[type='range'] {
    accent-color: Highlight;
  }

  .atomic-prediction-target {
    outline: 1px solid CanvasText;
  }

  .atomic-transition,
  .atomic-spectrum-marker {
    stroke: Highlight;
  }

  .atomic-level-stage path {
    fill: Highlight;
  }
}
</style>
