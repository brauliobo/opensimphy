<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  BLACKBODY_PRESET_IDS,
  BLACKBODY_PRESETS,
  evaluateBlackbody,
  type BlackbodyEvaluation,
  type BlackbodyInput,
} from '../../tour/blackbodyEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type TemperaturePrediction = '' | 'shorter-t4' | 'longer-linear' | 'unchanged'

interface TemperaturePair {
  referenceInput: BlackbodyInput
  increasedInput: BlackbodyInput
  referenceLabel: string
  increasedLabel: string
}

interface BlackbodyTemperatureComparison {
  reference: BlackbodyEvaluation
  increased: BlackbodyEvaluation
  referenceLabel: string
  increasedLabel: string
}

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: BlackbodyEvaluation]
}>()

const CONTROL_SPECS = Object.freeze([
  { id: 'temperatureKelvin', type: 'range', depth: 'guided', min: 100, max: 20_000, step: 0.01, unit: 'K' },
  { id: 'wavelengthMinimumMetres', type: 'number', depth: 'technical', min: 1e-9, max: 0.01, step: 1e-9, unit: 'm' },
  { id: 'wavelengthMaximumMetres', type: 'number', depth: 'technical', min: 1e-9, max: 0.01, step: 1e-9, unit: 'm' },
  { id: 'sampleCount', type: 'number', depth: 'technical', min: 2, max: 256, step: 1, unit: 'samples' },
] as const)

const OUTPUT_SPECS = Object.freeze([
  { id: 'temperatureKelvin', type: 'number', unit: 'K', nullable: false },
  { id: 'wienPeakWavelengthMetres', type: 'number', unit: 'm', nullable: false },
  { id: 'stefanBoltzmannExitanceWattsPerSquareMetre', type: 'number', unit: 'W/m^2', nullable: false },
] as const)
const EXPECTED_PREDICTION_PROMPT = 'When thermodynamic temperature increases, predict whether the wavelength-form peak shifts shorter, shifts longer, or stays unchanged, and whether ideal radiant exitance follows the fourth power of the temperature ratio, follows it linearly, or stays unchanged.'
const EXPECTED_COMPATIBILITY_KEY = '2b300b53db827cff15c17c36fbd7a01a753f0fe64f07644548a984c936844f33'

function numericControl(simulation: TourGeneratedSimulation, id: string): NumericControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'range' || control?.type === 'number' ? control : null
}

function sameKeys(value: Record<string, number | string | boolean>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index])
}

function presetInput(preset: TourPreset | undefined): BlackbodyInput | null {
  if (!preset || !sameKeys(preset.inputs, CONTROL_SPECS.map(({ id }) => id))) return null
  const { temperatureKelvin, wavelengthMinimumMetres, wavelengthMaximumMetres, sampleCount } = preset.inputs
  if (![temperatureKelvin, wavelengthMinimumMetres, wavelengthMaximumMetres, sampleCount].every((value) => typeof value === 'number')) return null
  return {
    temperatureKelvin: temperatureKelvin as number,
    wavelengthMinimumMetres: wavelengthMinimumMetres as number,
    wavelengthMaximumMetres: wavelengthMaximumMetres as number,
    sampleCount: sampleCount as number,
  }
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'blackbody-spectrum' || simulation.lessonId !== 'blackbody-radiation') {
    return 'The simulation identity is not supported by the black-body instrument.'
  }
  if (!simulation.title.trim() || !simulation.question.trim()
    || simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT
    || simulation.revision.contentRevision !== '2026-07-27'
    || simulation.revision.modelRevision !== 'ideal-planck-wavelength-spectrum-1'
    || simulation.revision.implementationRevision !== 'tour-blackbody-spectrum-engine-v1'
    || simulation.numericalMethod?.kind !== 'direct-evaluation'
    || simulation.numericalMethod.implementationRef !== simulation.revision.implementationRevision
    || simulation.numericalMethod.deterministic !== true
    || simulation.limits.tier !== 'immediate'
    || simulation.limits.maxOperations !== 2
    || simulation.limits.maxDurationMs !== 16) {
    return 'The generated prompt, implementation revision, or runtime limit is incompatible with this instrument.'
  }
  if (simulation.controls.length !== CONTROL_SPECS.length) return 'The generated control set does not match the bounded black-body engine.'

  for (const [index, spec] of CONTROL_SPECS.entries()) {
    const control = simulation.controls[index]
    if (!control || control.id !== spec.id || control.type !== spec.type || control.readingDepth !== spec.depth) {
      return `Control ${spec.id} does not match the black-body input contract.`
    }
    if (!control.label.trim() || !control.description.trim() || control.unit !== spec.unit
      || control.min !== spec.min || control.max !== spec.max || control.step !== spec.step
      || !Number.isFinite(control.default) || control.default < control.min || control.default > control.max) {
      return `Control ${spec.id} has invalid generated bounds, units, copy, or default.`
    }
  }

  if (simulation.presets.length !== BLACKBODY_PRESETS.length) return 'The generated preset catalog is incomplete.'
  for (const [index, enginePreset] of BLACKBODY_PRESETS.entries()) {
    const generatedPreset = simulation.presets[index]
    const input = presetInput(generatedPreset)
    if (!generatedPreset || generatedPreset.id !== BLACKBODY_PRESET_IDS[index]
      || generatedPreset.label !== enginePreset.label || !generatedPreset.description.trim()
      || !generatedPreset.inspectionPrompt.trim() || !input
      || input.temperatureKelvin !== enginePreset.input.temperatureKelvin) {
      return `Preset ${enginePreset.id} does not match the generated black-body contract.`
    }
    try {
      evaluateBlackbody(input)
    } catch {
      return `Preset ${enginePreset.id} is outside the black-body engine bounds.`
    }
  }

  if (simulation.outputSchema.length !== OUTPUT_SPECS.length || OUTPUT_SPECS.some((spec, index) => {
    const output = simulation.outputSchema[index]
    return !output || output.id !== spec.id || output.type !== spec.type || output.unit !== spec.unit
      || output.nullable !== spec.nullable || !output.label.trim() || !output.description.trim()
  })) return 'The generated output schema does not match the black-body result.'

  const alternatives = simulation.visualization.alternatives.map(({ type }) => type)
  if (simulation.visualization.kind !== 'bounded-wavelength-spectrum'
    || !alternatives.includes('text') || !alternatives.includes('table')
    || simulation.datasetState?.state !== 'not-applicable'
    || simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY
    || !simulation.comparison.incompatibleBehavior.trim()
    || simulation.finding.validatesTheory !== false) {
    return 'The generated visualization or evidence boundary is incompatible with this instrument.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const temperatureControl = numericControl(props.simulation, 'temperatureKelvin')
const minimumControl = numericControl(props.simulation, 'wavelengthMinimumMetres')
const maximumControl = numericControl(props.simulation, 'wavelengthMaximumMetres')
const sampleControl = numericControl(props.simulation, 'sampleCount')

const sourceDefaults: BlackbodyInput | null = temperatureControl && minimumControl && maximumControl && sampleControl
  ? {
      temperatureKelvin: temperatureControl.default,
      wavelengthMinimumMetres: minimumControl.default,
      wavelengthMaximumMetres: maximumControl.default,
      sampleCount: sampleControl.default,
    }
  : null
const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const temperatureKelvin = ref(initialInput?.temperatureKelvin ?? Number.NaN)
const wavelengthMinimumMetres = ref(initialInput?.wavelengthMinimumMetres ?? Number.NaN)
const wavelengthMaximumMetres = ref(initialInput?.wavelengthMaximumMetres ?? Number.NaN)
const sampleCount = ref(initialInput?.sampleCount ?? Number.NaN)
const prediction = ref<TemperaturePrediction>('')
const recordedPrediction = ref<TemperaturePrediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<BlackbodyEvaluation | null>(null)
const temperatureComparison = ref<BlackbodyTemperatureComparison | null>(null)
const evaluationError = ref<string | null>(null)

const predictionOptions: Array<{ value: Exclude<TemperaturePrediction, ''>; label: string }> = [
  { value: 'shorter-t4', label: 'Peak shifts shorter; exitance follows the fourth power of the temperature ratio' },
  { value: 'longer-linear', label: 'Peak shifts longer; exitance follows the temperature ratio linearly' },
  { value: 'unchanged', label: 'Peak wavelength and exitance remain unchanged' },
]

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input?.temperatureKelvin === temperatureKelvin.value
    && input.wavelengthMinimumMetres === wavelengthMinimumMetres.value
    && input.wavelengthMaximumMetres === wavelengthMaximumMetres.value
    && input.sampleCount === sampleCount.value
}) ?? null)

const declaredTemperaturePair = computed(() => {
  const input = currentInput()
  return input && Number.isFinite(input.temperatureKelvin) ? temperaturePair(input) : null
})

const predictionComparison = computed(() => {
  const comparison = temperatureComparison.value
  if (!recordedPrediction.value || predictionStale.value || !comparison) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  const temperatureRatio = comparison.increased.temperatureKelvin / comparison.reference.temperatureKelvin
  const peakRatio = comparison.increased.wienPeakWavelengthMetres / comparison.reference.wienPeakWavelengthMetres
  const exitanceRatio = comparison.increased.stefanBoltzmannExitanceWattsPerSquareMetre
    / comparison.reference.stefanBoltzmannExitanceWattsPerSquareMetre
  return `Prediction: ${predicted}. From ${formatNumber(comparison.reference.temperatureKelvin)} K to ${formatNumber(comparison.increased.temperatureKelvin)} K, the wavelength peak ratio is ${formatNumber(peakRatio)} and the peak shifts to shorter wavelength. The exitance ratio is ${formatNumber(exitanceRatio)}, equal to (${formatNumber(temperatureRatio)})^4. ${recordedPrediction.value === 'shorter-t4' ? 'The prediction aligns with the model.' : 'The prediction differs from the model.'}`
})

const plotPoints = computed(() => {
  const series = result.value?.normalizedSeries
  if (!series?.length) return ''
  const logMinimum = Math.log10(series[0]!.wavelengthMetres)
  const logMaximum = Math.log10(series[series.length - 1]!.wavelengthMetres)
  return series.map((point) => {
    const x = 58 + (Math.log10(point.wavelengthMetres) - logMinimum) / (logMaximum - logMinimum) * 642
    const y = 20 + (1 - point.normalizedRadiance) * 238
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
})

const peakMarkerX = computed(() => {
  const series = result.value?.normalizedSeries
  const peak = result.value?.wienPeakWavelengthMetres
  if (!series?.length || peak === undefined || peak < series[0]!.wavelengthMetres || peak > series[series.length - 1]!.wavelengthMetres) return null
  const minimum = Math.log10(series[0]!.wavelengthMetres)
  const maximum = Math.log10(series[series.length - 1]!.wavelengthMetres)
  return 58 + (Math.log10(peak) - minimum) / (maximum - minimum) * 642
})

function currentInput(): BlackbodyInput | null {
  if (contractError) return null
  return {
    temperatureKelvin: temperatureKelvin.value,
    wavelengthMinimumMetres: wavelengthMinimumMetres.value,
    wavelengthMaximumMetres: wavelengthMaximumMetres.value,
    sampleCount: sampleCount.value,
  }
}

function temperaturePair(input: BlackbodyInput): TemperaturePair {
  const presets = props.simulation.presets
    .map((preset) => ({ preset, input: presetInput(preset) }))
    .filter((entry): entry is { preset: TourPreset; input: BlackbodyInput } => entry.input !== null)
    .sort((left, right) => left.input.temperatureKelvin - right.input.temperatureKelvin)
  const cooler = presets.filter(({ input: preset }) => preset.temperatureKelvin < input.temperatureKelvin).at(-1)
  if (cooler) {
    const selected = presets.find(({ input: preset }) => preset.temperatureKelvin === input.temperatureKelvin)
    return {
      referenceInput: { ...input, temperatureKelvin: cooler.input.temperatureKelvin },
      increasedInput: { ...input },
      referenceLabel: cooler.preset.label,
      increasedLabel: selected?.preset.label ?? 'Selected temperature',
    }
  }
  const warmer = presets.find(({ input: preset }) => preset.temperatureKelvin > input.temperatureKelvin)!
  const selected = presets.find(({ input: preset }) => preset.temperatureKelvin === input.temperatureKelvin)
  return {
    referenceInput: { ...input },
    increasedInput: { ...input, temperatureKelvin: warmer.input.temperatureKelvin },
    referenceLabel: selected?.preset.label ?? 'Selected temperature',
    increasedLabel: warmer.preset.label,
  }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateBlackbody(input)
    const pair = temperaturePair(input)
    const reference = pair.referenceInput.temperatureKelvin === output.temperatureKelvin
      ? output
      : evaluateBlackbody(pair.referenceInput)
    const increased = pair.increasedInput.temperatureKelvin === output.temperatureKelvin
      ? output
      : evaluateBlackbody(pair.increasedInput)
    result.value = output
    temperatureComparison.value = {
      reference,
      increased,
      referenceLabel: pair.referenceLabel,
      increasedLabel: pair.increasedLabel,
    }
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    temperatureComparison.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The black-body engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: BlackbodyInput): void {
  temperatureKelvin.value = input.temperatureKelvin
  wavelengthMinimumMetres.value = input.wavelengthMinimumMetres!
  wavelengthMaximumMetres.value = input.wavelengthMaximumMetres!
  sampleCount.value = input.sampleCount!
}

function applyPreset(preset: TourPreset): void {
  const input = presetInput(preset)
  if (input) assignInput(input)
}

function resetInstrument(): void {
  if (sourceDefaults) assignInput(sourceDefaults)
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  temperatureComparison.value = null
  evaluationError.value = null
}

function formatNumber(value: number, significantDigits = 6): string {
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e6 || magnitude < 1e-3) return value.toExponential(significantDigits - 1)
  return Number(value.toPrecision(significantDigits)).toString()
}

function outputLabel(id: string): string {
  return props.simulation.outputSchema.find((field) => field.id === id)?.label ?? id
}

function wavelengthBand(wavelengthMetres: number): string {
  const nanometres = wavelengthMetres * 1e9
  if (nanometres < 380) return 'ultraviolet by the lesson convention'
  if (nanometres <= 750) return 'within the lesson\'s chosen 380-750 nm visible interval'
  return 'infrared by the lesson convention'
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([temperatureKelvin, wavelengthMinimumMetres, wavelengthMaximumMetres, sampleCount], () => {
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
section(class="blackbody", data-testid="blackbody-spectrum", :aria-labelledby="`${simulation.id}-title`")
  header(class="blackbody__heading")
    p(class="blackbody__kicker") Thermal instrument
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", class="blackbody__error", role="alert", data-testid="blackbody-contract-error")  This activity cannot run because its generated contract and black-body engine do not agree. {{ contractError }}
  template(v-else)
    section(aria-labelledby="blackbody-presets-title")
      h3(id="blackbody-presets-title") Temperature presets
      ul(class="blackbody__presets")
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(type="button", :data-testid="`blackbody-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", data-testid="blackbody-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(class="blackbody__controls", aria-labelledby="blackbody-controls-title")
      h3(id="blackbody-controls-title") Model controls
      div(v-if="temperatureControl", class="blackbody__control", data-testid="blackbody-control-temperatureKelvin")
        label(for="blackbody-temperature") {{ temperatureControl.label }}
        input(id="blackbody-temperature", v-model.number="temperatureKelvin", data-testid="blackbody-temperature", :type="temperatureControl.type", :min="temperatureControl.min", :max="temperatureControl.max", :step="temperatureControl.step")
        output(for="blackbody-temperature") {{ formatNumber(temperatureKelvin) }} {{ temperatureControl.unit }}
        p
          | {{ temperatureControl.description }} 
          span(v-if="temperatureControl.playfulPrompt") {{ temperatureControl.playfulPrompt }}
      template(v-if="depth === 'technical'")
        div(v-if="minimumControl", class="blackbody__control", data-testid="blackbody-control-wavelengthMinimumMetres")
          label(for="blackbody-minimum") {{ minimumControl.label }}
          input(id="blackbody-minimum", v-model.number="wavelengthMinimumMetres", data-testid="blackbody-wavelength-minimum", :type="minimumControl.type", :min="minimumControl.min", :max="minimumControl.max", :step="minimumControl.step")
          span {{ minimumControl.unit }}
          p {{ minimumControl.description }}
        div(v-if="maximumControl", class="blackbody__control", data-testid="blackbody-control-wavelengthMaximumMetres")
          label(for="blackbody-maximum") {{ maximumControl.label }}
          input(id="blackbody-maximum", v-model.number="wavelengthMaximumMetres", data-testid="blackbody-wavelength-maximum", :type="maximumControl.type", :min="maximumControl.min", :max="maximumControl.max", :step="maximumControl.step")
          span {{ maximumControl.unit }}
          p {{ maximumControl.description }}
        div(v-if="sampleControl", class="blackbody__control", data-testid="blackbody-control-sampleCount")
          label(for="blackbody-samples") {{ sampleControl.label }}
          input(id="blackbody-samples", v-model.number="sampleCount", data-testid="blackbody-sample-count", :type="sampleControl.type", :min="sampleControl.min", :max="sampleControl.max", :step="sampleControl.step")
          span {{ sampleControl.unit }}
          p {{ sampleControl.description }}
    fieldset(class="blackbody__prediction", data-testid="blackbody-prediction-gate")
      legend Predict the effect of the declared temperature increase
      p(data-testid="blackbody-prediction-prompt") {{ simulation.predictionPrompt }}
      p(v-if="declaredTemperaturePair", data-testid="blackbody-temperature-declaration")  Compare {{ declaredTemperaturePair.referenceLabel }} at {{ formatNumber(declaredTemperaturePair.referenceInput.temperatureKelvin) }} K with {{ declaredTemperaturePair.increasedLabel }} at {{ formatNumber(declaredTemperaturePair.increasedInput.temperatureKelvin) }} K. 
      label(v-for="option in predictionOptions", :key="option.value")
        input(v-model="prediction", type="radio", name="blackbody-prediction", :value="option.value", :data-testid="`blackbody-prediction-${option.value}`")
        |  {{ option.label }}
    div(class="blackbody__actions")
      button(type="button", data-testid="reveal-blackbody-result", :disabled="!prediction", @click="revealResult") Reveal model result
      button(type="button", data-testid="reset-blackbody", @click="resetInstrument") Reset
    p(v-if="evaluationError", class="blackbody__error", role="alert", data-testid="blackbody-evaluation-error") {{ evaluationError }}
    p(v-if="predictionStale", class="blackbody__stale", aria-live="polite", data-testid="blackbody-prediction-stale")  The setup changed, so the previous prediction is not compared with this live result. Make a new prediction for the current setup. 
    section(v-if="revealed && result", class="blackbody__result", data-testid="blackbody-result", aria-labelledby="blackbody-result-title")
      h3(id="blackbody-result-title") Normalized wavelength spectrum
      figure(class="blackbody__figure")
        svg(viewBox="0 0 720 310", role="img", aria-labelledby="blackbody-plot-title blackbody-plot-description", data-testid="blackbody-spectrum-svg")
          title(id="blackbody-plot-title") Normalized ideal black-body wavelength spectrum
          desc(id="blackbody-plot-description") A logarithmic wavelength plot normalized to its maximum. A vertical marker shows the analytic Wien wavelength peak when it lies inside the displayed interval.
          line(class="blackbody__axis", x1="58", y1="258", x2="700", y2="258")
          line(class="blackbody__axis", x1="58", y1="20", x2="58", y2="258")
          polyline(class="blackbody__curve", :points="plotPoints", fill="none", data-testid="blackbody-spectrum-curve")
          g(v-if="peakMarkerX !== null", data-testid="blackbody-peak-marker")
            line(class="blackbody__peak", :x1="peakMarkerX", y1="20", :x2="peakMarkerX", y2="258")
            circle(class="blackbody__peak-dot", :cx="peakMarkerX", cy="20", r="5")
          text(x="58", y="282") {{ formatNumber(wavelengthMinimumMetres) }} m
          text(x="700", y="282", text-anchor="end") {{ formatNumber(wavelengthMaximumMetres) }} m
          text(x="379", y="304", text-anchor="middle") Wavelength (logarithmic axis)
          text(x="16", y="140", text-anchor="middle", transform="rotate(-90 16 140)") Normalized B_lambda
        figcaption(data-testid="blackbody-text-alternative")  At {{ formatNumber(result.temperatureKelvin) }} K with emissivity fixed at 1, the wavelength-form peak is {{ formatNumber(result.wienPeakWavelengthMetres * 1e6) }} um, {{ wavelengthBand(result.wienPeakWavelengthMetres) }}, and ideal all-wavelength radiant exitance is {{ formatNumber(result.stefanBoltzmannExitanceWattsPerSquareMetre) }} W/m^2. This is modeled output, not a measured spectrum or a color inference. 
      dl(class="blackbody__readout")
        dt {{ outputLabel('temperatureKelvin') }}
        dd {{ formatNumber(result.temperatureKelvin) }} K
        dt {{ outputLabel('wienPeakWavelengthMetres') }}
        dd(data-testid="blackbody-peak-value") {{ formatNumber(result.wienPeakWavelengthMetres) }} m
        dt {{ outputLabel('stefanBoltzmannExitanceWattsPerSquareMetre') }}
        dd(data-testid="blackbody-exitance-value") {{ formatNumber(result.stefanBoltzmannExitanceWattsPerSquareMetre) }} W/m^2
      p(data-testid="blackbody-prediction-comparison") {{ predictionComparison }}
      div(v-if="temperatureComparison", class="blackbody__table-wrap")
        table(data-testid="blackbody-temperature-comparison-table")
          caption Compatible temperature-increase comparison computed with the same engine revision and display grid
          thead
            tr
              th(scope="col") Run
              th(scope="col") Temperature (K)
              th(scope="col") Peak wavelength (m)
              th(scope="col") Exitance (W/m^2)
          tbody
            tr
              th(scope="row") {{ temperatureComparison.referenceLabel }}
              td {{ formatNumber(temperatureComparison.reference.temperatureKelvin) }}
              td {{ formatNumber(temperatureComparison.reference.wienPeakWavelengthMetres) }}
              td {{ formatNumber(temperatureComparison.reference.stefanBoltzmannExitanceWattsPerSquareMetre) }}
            tr
              th(scope="row") {{ temperatureComparison.increasedLabel }}
              td {{ formatNumber(temperatureComparison.increased.temperatureKelvin) }}
              td {{ formatNumber(temperatureComparison.increased.wienPeakWavelengthMetres) }}
              td {{ formatNumber(temperatureComparison.increased.stefanBoltzmannExitanceWattsPerSquareMetre) }}
      div(class="blackbody__table-wrap")
        table(data-testid="blackbody-spectrum-table")
          caption Reduced numerical alternative for the modeled wavelength spectrum
          thead
            tr
              th(scope="col") Wavelength (nm)
              th(scope="col") Spectral radiance (W sr^-1 m^-3)
              th(scope="col") Normalized radiance
          tbody
            tr(v-for="row in result.table", :key="row.wavelengthNanometres")
              th(scope="row") {{ formatNumber(row.wavelengthNanometres) }}
              td {{ formatNumber(row.spectralRadianceWattsPerSteradianCubicMetre) }}
              td {{ formatNumber(row.normalizedRadiance) }}
      section(class="blackbody__finding", data-testid="blackbody-finding-panel", aria-labelledby="blackbody-finding-title")
        h3(id="blackbody-finding-title") Live finding
        p(role="status", aria-live="polite", data-testid="blackbody-finding") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="blackbody-finding-result-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd {{ result.finding.claimClass }}
          dt Model origin
          dd {{ result.finding.modelOrigin }}
          dt Method relationship
          dd {{ result.finding.methodRelationship }}
          dt Source revision
          dd(data-testid="blackbody-provenance-revision") {{ result.finding.sourceRevision }}
          dt Source locator
          dd(data-testid="blackbody-provenance-locator") {{ result.finding.sourceLocator }}
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
        p(data-testid="blackbody-does-not-establish") {{ result.finding.doesNotEstablish }}
        h4 Evidence references
        ul(data-testid="blackbody-evidence-refs")
          li(v-for="reference in result.finding.evidenceRefs", :key="reference")
            a(:href="evidenceHref(reference)") {{ reference }}
        p(data-testid="blackbody-validation-boundary") No empirical comparison or theory validation is claimed by this ideal-model calculation.
    section(v-if="depth === 'technical'", class="blackbody__technical", data-testid="blackbody-technical-disclosure")
      h3 Grid, method, and assumptions
      p {{ simulation.numericalMethod?.description }}
      p {{ simulation.visualization.reducedMotionBehavior }}
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
</template>

<style scoped>
.blackbody { display: grid; gap: 1.25rem; }
.blackbody__heading h2, .blackbody h3, .blackbody h4, .blackbody p { margin-top: 0; }
.blackbody__kicker { font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.blackbody__presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .75rem; padding: 0; list-style: none; }
.blackbody__presets li, .blackbody__control, .blackbody__prediction, .blackbody__finding, .blackbody__technical { padding: 1rem; border: 1px solid var(--line, #555); }
.blackbody__presets button { width: 100%; min-height: 2.75rem; }
.blackbody__controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; }
.blackbody__controls h3 { grid-column: 1 / -1; }
.blackbody__control { display: grid; align-content: start; gap: .5rem; }
.blackbody__control label { font-weight: 700; }
.blackbody__control input { width: 100%; min-height: 2.75rem; box-sizing: border-box; }
.blackbody__prediction label { display: flex; align-items: center; min-height: 2.75rem; gap: .5rem; }
.blackbody__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.blackbody__actions button { min-height: 2.75rem; }
.blackbody__error { padding: .85rem; border: 2px solid currentColor; }
.blackbody__stale { padding: .75rem; border-left: 4px solid currentColor; }
.blackbody__figure { margin: 0; }
.blackbody__figure svg { display: block; width: 100%; height: auto; border: 1px solid var(--line, #555); background: var(--surface, transparent); }
.blackbody__axis { stroke: currentColor; stroke-width: 1.5; }
.blackbody__curve { stroke: currentColor; stroke-width: 3; stroke-linejoin: round; }
.blackbody__peak { stroke: currentColor; stroke-width: 2; stroke-dasharray: 7 5; }
.blackbody__peak-dot { fill: var(--surface, Canvas); stroke: currentColor; stroke-width: 3; }
.blackbody__figure text { fill: currentColor; font-size: 12px; }
.blackbody__figure figcaption { padding-block: .75rem; }
.blackbody__readout, .blackbody__finding dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: .4rem 1rem; }
.blackbody__readout dd, .blackbody__finding dd { margin: 0; overflow-wrap: anywhere; }
.blackbody__table-wrap { overflow-x: auto; }
.blackbody table { width: 100%; border-collapse: collapse; }
.blackbody th, .blackbody td { padding: .5rem; border: 1px solid var(--line, #555); text-align: right; }
.blackbody th:first-child { text-align: left; }
.blackbody caption { padding: .5rem; font-weight: 700; text-align: left; }
.blackbody__finding code { overflow-wrap: anywhere; }
@media (max-width: 640px) { .blackbody__readout, .blackbody__finding dl { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .blackbody *, .blackbody *::before, .blackbody *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
@media (forced-colors: active) {
  .blackbody__presets li, .blackbody__control, .blackbody__prediction, .blackbody__finding, .blackbody__technical, .blackbody__figure svg, .blackbody th, .blackbody td { border-color: CanvasText; }
  .blackbody__curve, .blackbody__axis, .blackbody__peak, .blackbody__peak-dot { stroke: CanvasText; }
  .blackbody__peak-dot { fill: Canvas; }
}
</style>
