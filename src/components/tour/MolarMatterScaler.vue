<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  evaluateMolarMatter,
  type MolarMatterEvaluation,
  type MolarMatterInput,
} from '../../tour/molarMatterEngine'
import type {
  ReadingDepth,
  TourControl,
  TourGeneratedSimulation,
  TourPreset,
  TourSelectControl,
} from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type DoublingPrediction = '' | 'all-linear' | 'count-mass-only' | 'none'

interface MolarDoublingComparison {
  base: MolarMatterEvaluation
  doubled: MolarMatterEvaluation
}

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: MolarMatterEvaluation]
}>()

const CONTROL_SPECS = Object.freeze([
  { id: 'substancePreset', type: 'select', depth: 'guided' },
  { id: 'amountMol', type: 'range', depth: 'guided', min: 1e-12, max: 1_000, step: 1e-12, unit: 'mol' },
  { id: 'gasModel', type: 'select', depth: 'guided' },
  { id: 'temperatureKelvin', type: 'number', depth: 'technical', min: 1, max: 5_000, step: 0.01, unit: 'K' },
  { id: 'pressurePascal', type: 'number', depth: 'technical', min: 1, max: 1e8, step: 1, unit: 'Pa' },
  { id: 'chargeNumber', type: 'number', depth: 'technical', min: -100, max: 100, step: 1, unit: 'elementary charges/entity' },
  { id: 'molarMassKgPerMol', type: 'number', depth: 'technical', min: 1e-12, max: 1_000, step: 1e-12, unit: 'kg/mol' },
] as const)

const OUTPUT_SPECS = Object.freeze([
  ['amountOfSubstanceMol', 'mol', false], ['entityCount', null, false], ['molarMassKgPerMol', 'kg/mol', false],
  ['bulkMassKg', 'kg', false], ['idealGasVolumeCubicMetres', 'm^3', true], ['faradayChargeCoulombs', 'C', false],
  ['perParticleEnergyJoule', 'J', true], ['molarEnergyJoulePerMol', 'J/mol', true],
  ['sampleEnergyJoule', 'J', true], ['standardAtmospherePascal', 'Pa', false],
] as const)
const EXPECTED_PREDICTION_PROMPT = 'If amount of substance doubles while molar mass, temperature, pressure, and signed charge number remain fixed, predict which dependent count, mass, ideal-gas volume, and Faraday charge outputs double.'
const EXPECTED_COMPATIBILITY_KEY = '67e4b110368f67d803e04456b9bc3c8a5c2b30c640892c593a79d5e4190dbf0d'

function selectControl(simulation: TourGeneratedSimulation, id: string): TourSelectControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'select' ? control : null
}

function numericControl(simulation: TourGeneratedSimulation, id: string): NumericControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'range' || control?.type === 'number' ? control : null
}

function sameKeys(value: Record<string, number | string | boolean>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index])
}

function presetInput(preset: TourPreset | undefined): MolarMatterInput | null {
  if (!preset || !sameKeys(preset.inputs, CONTROL_SPECS.map(({ id }) => id))) return null
  const { substancePreset, amountMol, gasModel, temperatureKelvin, pressurePascal, chargeNumber, molarMassKgPerMol } = preset.inputs
  if (typeof substancePreset !== 'string' || typeof gasModel !== 'string'
    || ![amountMol, temperatureKelvin, pressurePascal, chargeNumber, molarMassKgPerMol].every((value) => typeof value === 'number')) return null
  return {
    substancePreset: substancePreset as MolarMatterInput['substancePreset'],
    amountMol: amountMol as number,
    gasModel: gasModel as MolarMatterInput['gasModel'],
    temperatureKelvin: temperatureKelvin as number,
    pressurePascal: pressurePascal as number,
    chargeNumber: chargeNumber as number,
    molarMassKgPerMol: molarMassKgPerMol as number,
  }
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'particle-to-mole-scaler' || simulation.lessonId !== 'particle-to-mole') {
    return 'The simulation identity is not supported by the molar-matter instrument.'
  }
  if (!simulation.title.trim() || !simulation.question.trim()
    || simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT
    || simulation.revision.contentRevision !== '2026-07-27'
    || simulation.revision.modelRevision !== 'molar-dependent-conversions-1'
    || simulation.revision.implementationRevision !== 'tour-particle-to-mole-scaler-engine-v1'
    || simulation.numericalMethod?.kind !== 'direct-evaluation'
    || simulation.numericalMethod.implementationRef !== simulation.revision.implementationRevision
    || simulation.numericalMethod.deterministic !== true
    || simulation.limits.tier !== 'immediate'
    || simulation.limits.maxOperations !== 2
    || simulation.limits.maxDurationMs !== 16) {
    return 'The generated prompt, implementation revision, or runtime limit is incompatible with this instrument.'
  }
  if (simulation.controls.length !== CONTROL_SPECS.length) return 'The generated controls do not match the bounded molar-matter engine.'
  for (const [index, spec] of CONTROL_SPECS.entries()) {
    const control = simulation.controls[index]
    if (!control || control.id !== spec.id || control.type !== spec.type || control.readingDepth !== spec.depth
      || !control.label.trim() || !control.description.trim()) return `Control ${spec.id} does not match the molar-matter contract.`
    if (control.type === 'select') {
      const expectedOption = control.id === 'substancePreset' ? 'generic-particle' : 'ideal'
      const option = control.options[0]
      if (!option || control.options.length !== 1 || option.value !== expectedOption
        || !option.label.trim() || !option.description?.trim()
        || control.default !== expectedOption) {
        return `Control ${spec.id} exposes an unsupported option catalog.`
      }
    } else if (!('min' in spec) || control.unit !== spec.unit || control.min !== spec.min || control.max !== spec.max
      || control.step !== spec.step || !Number.isFinite(control.default) || control.default < control.min || control.default > control.max) {
      return `Control ${spec.id} has invalid generated bounds, units, or default.`
    }
  }
  if (simulation.controls.filter(({ readingDepth }) => readingDepth === 'guided').length > 3) {
    return 'Guided depth exceeds the three-control molar-matter limit.'
  }
  if (simulation.presets.length !== 1 || simulation.presets[0]?.id !== 'standard-ideal-gas'
    || !simulation.presets[0].label.trim() || !simulation.presets[0].description.trim() || !simulation.presets[0].inspectionPrompt.trim()) {
    return 'The generated molar-matter preset catalog is incompatible.'
  }
  const generatedPresetInput = presetInput(simulation.presets[0])
  if (!generatedPresetInput) return 'The generated molar-matter preset is incomplete.'
  try {
    evaluateMolarMatter(generatedPresetInput)
  } catch {
    return 'The generated molar-matter preset is outside the engine bounds.'
  }
  if (simulation.outputSchema.length !== OUTPUT_SPECS.length || OUTPUT_SPECS.some(([id, unit, nullable], index) => {
    const output = simulation.outputSchema[index]
    return !output || output.id !== id || output.type !== 'number' || output.unit !== unit || output.nullable !== nullable
      || !output.label.trim() || !output.description.trim()
  })) return 'The generated output schema does not match the molar-matter result.'
  const alternatives = simulation.visualization.alternatives.map(({ type }) => type)
  if (simulation.visualization.kind !== 'molar-dependency-scaler' || !alternatives.includes('text')
    || !alternatives.includes('table') || simulation.datasetState?.state !== 'not-applicable'
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
const substanceControl = selectControl(props.simulation, 'substancePreset')
const amountControl = numericControl(props.simulation, 'amountMol')
const gasControl = selectControl(props.simulation, 'gasModel')
const temperatureControl = numericControl(props.simulation, 'temperatureKelvin')
const pressureControl = numericControl(props.simulation, 'pressurePascal')
const chargeControl = numericControl(props.simulation, 'chargeNumber')
const molarMassControl = numericControl(props.simulation, 'molarMassKgPerMol')

const sourceDefaults: MolarMatterInput | null = substanceControl && amountControl && gasControl && temperatureControl
  && pressureControl && chargeControl && molarMassControl
  ? {
      substancePreset: substanceControl.default as MolarMatterInput['substancePreset'],
      amountMol: amountControl.default,
      gasModel: gasControl.default as MolarMatterInput['gasModel'],
      temperatureKelvin: temperatureControl.default,
      pressurePascal: pressureControl.default,
      chargeNumber: chargeControl.default,
      molarMassKgPerMol: molarMassControl.default,
    }
  : null
const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const substancePreset = ref<MolarMatterInput['substancePreset'] | ''>(initialInput?.substancePreset ?? '')
const amountMol = ref(initialInput?.amountMol ?? Number.NaN)
const gasModel = ref<MolarMatterInput['gasModel'] | ''>(initialInput?.gasModel ?? '')
const temperatureKelvin = ref(initialInput?.temperatureKelvin ?? Number.NaN)
const pressurePascal = ref(initialInput?.pressurePascal ?? Number.NaN)
const chargeNumber = ref(initialInput?.chargeNumber ?? Number.NaN)
const molarMassKgPerMol = ref(initialInput?.molarMassKgPerMol ?? Number.NaN)
const prediction = ref<DoublingPrediction>('')
const recordedPrediction = ref<DoublingPrediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<MolarMatterEvaluation | null>(null)
const doublingComparison = ref<MolarDoublingComparison | null>(null)
const evaluationError = ref<string | null>(null)

const predictionOptions: Array<{ value: Exclude<DoublingPrediction, ''>; label: string }> = [
  { value: 'all-linear', label: 'Entity count, mass, ideal-gas volume, and Faraday charge all follow linear amount scaling' },
  { value: 'count-mass-only', label: 'Only entity count and mass double' },
  { value: 'none', label: 'None of the dependent outputs double' },
]

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input?.substancePreset === substancePreset.value && input.amountMol === amountMol.value
    && input.gasModel === gasModel.value && input.temperatureKelvin === temperatureKelvin.value
    && input.pressurePascal === pressurePascal.value && input.chargeNumber === chargeNumber.value
    && input.molarMassKgPerMol === molarMassKgPerMol.value
}) ?? null)

const declaredDoublingAmounts = computed(() => {
  if (!Number.isFinite(amountMol.value) || !amountControl) return null
  const base = amountMol.value <= amountControl.max / 2 ? amountMol.value : amountMol.value / 2
  return { base, doubled: base * 2 }
})

const predictionComparison = computed(() => {
  const comparison = doublingComparison.value
  if (!recordedPrediction.value || predictionStale.value || !comparison) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  const volumeRatio = comparison.base.idealGasVolumeCubicMetres === null || comparison.doubled.idealGasVolumeCubicMetres === null
    ? 'not applicable'
    : formatNumber(comparison.doubled.idealGasVolumeCubicMetres / comparison.base.idealGasVolumeCubicMetres)
  const chargeResult = comparison.base.faradayChargeCoulombs === 0
    ? '0 C to 0 C because z = 0; the identity remains linear with a zero coefficient'
    : `ratio ${formatNumber(comparison.doubled.faradayChargeCoulombs / comparison.base.faradayChargeCoulombs)}`
  return `Prediction: ${predicted}. Doubling amount gives entity-count ratio ${formatNumber(comparison.doubled.entityCount / comparison.base.entityCount)}, mass ratio ${formatNumber(comparison.doubled.bulkMassKg / comparison.base.bulkMassKg)}, ideal-gas-volume ratio ${volumeRatio} at the same temperature and pressure, and Faraday charge ${chargeResult}. ${recordedPrediction.value === 'all-linear' ? 'The prediction aligns with the dependent identities.' : 'The prediction differs from the dependent identities.'}`
})

const flowRows = computed(() => result.value?.table.filter(({ quantity }) => [
  'entity-count', 'bulk-mass', 'ideal-gas-volume', 'faraday-charge',
].includes(quantity)) ?? [])

function currentInput(): MolarMatterInput | null {
  if (contractError || !substancePreset.value || !gasModel.value) return null
  return {
    substancePreset: substancePreset.value,
    amountMol: amountMol.value,
    gasModel: gasModel.value,
    temperatureKelvin: temperatureKelvin.value,
    pressurePascal: pressurePascal.value,
    chargeNumber: chargeNumber.value,
    molarMassKgPerMol: molarMassKgPerMol.value,
  }
}

function doublingInputs(input: MolarMatterInput): { base: MolarMatterInput; doubled: MolarMatterInput } {
  const maximumAmount = amountControl!.max
  const baseAmount = input.amountMol <= maximumAmount / 2 ? input.amountMol : input.amountMol / 2
  return {
    base: { ...input, amountMol: baseAmount },
    doubled: { ...input, amountMol: baseAmount * 2 },
  }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateMolarMatter(input)
    const pair = doublingInputs(input)
    const base = pair.base.amountMol === output.amountOfSubstanceMol ? output : evaluateMolarMatter(pair.base)
    const doubled = pair.doubled.amountMol === output.amountOfSubstanceMol ? output : evaluateMolarMatter(pair.doubled)
    result.value = output
    doublingComparison.value = { base, doubled }
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    doublingComparison.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The molar-matter engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: MolarMatterInput): void {
  substancePreset.value = input.substancePreset
  amountMol.value = input.amountMol
  gasModel.value = input.gasModel
  temperatureKelvin.value = input.temperatureKelvin
  pressurePascal.value = input.pressurePascal
  chargeNumber.value = input.chargeNumber
  molarMassKgPerMol.value = input.molarMassKgPerMol!
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
  doublingComparison.value = null
  evaluationError.value = null
}

function formatNumber(value: number, significantDigits = 6): string {
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e6 || magnitude < 1e-3) return value.toExponential(significantDigits - 1)
  return Number(value.toPrecision(significantDigits)).toString()
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([substancePreset, amountMol, gasModel, temperatureKelvin, pressurePascal, chargeNumber, molarMassKgPerMol], () => {
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
section(class="molar", data-testid="molar-matter-scaler", :aria-labelledby="`${simulation.id}-title`")
  header(class="molar__heading")
    p(class="molar__kicker") Matter instrument
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", class="molar__error", role="alert", data-testid="molar-contract-error")  This activity cannot run because its generated contract and molar-matter engine do not agree. {{ contractError }}
  template(v-else)
    section(aria-labelledby="molar-presets-title")
      h3(id="molar-presets-title") Scenario preset
      ul(class="molar__presets")
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(type="button", :data-testid="`molar-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", data-testid="molar-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(class="molar__controls", aria-labelledby="molar-controls-title")
      h3(id="molar-controls-title") Declared inputs
      div(v-if="substanceControl", class="molar__control", data-testid="molar-control-substancePreset")
        label(for="molar-substance") {{ substanceControl.label }}
        select(id="molar-substance", v-model="substancePreset", data-testid="molar-substance")
          option(v-for="option in substanceControl.options", :key="option.value", :value="option.value") {{ option.label }}
        p
          | {{ substanceControl.description }} 
          span(v-if="substanceControl.playfulPrompt") {{ substanceControl.playfulPrompt }}
      div(v-if="amountControl", class="molar__control", data-testid="molar-control-amountMol")
        label(for="molar-amount") {{ amountControl.label }}
        input(id="molar-amount", v-model.number="amountMol", data-testid="molar-amount", :type="amountControl.type", :min="amountControl.min", :max="amountControl.max", :step="amountControl.step")
        output(for="molar-amount") {{ formatNumber(amountMol) }} {{ amountControl.unit }}
        p
          | {{ amountControl.description }} 
          span(v-if="amountControl.playfulPrompt") {{ amountControl.playfulPrompt }}
      div(v-if="gasControl", class="molar__control", data-testid="molar-control-gasModel")
        label(for="molar-gas-model") {{ gasControl.label }}
        select(id="molar-gas-model", v-model="gasModel", data-testid="molar-gas-model")
          option(v-for="option in gasControl.options", :key="option.value", :value="option.value") {{ option.label }}
        p
          | {{ gasControl.description }} 
          span(v-if="gasControl.playfulPrompt") {{ gasControl.playfulPrompt }}
      template(v-if="depth === 'technical'")
        div(v-if="temperatureControl", class="molar__control", data-testid="molar-control-temperatureKelvin")
          label(for="molar-temperature") {{ temperatureControl.label }}
          input(id="molar-temperature", v-model.number="temperatureKelvin", data-testid="molar-temperature", :type="temperatureControl.type", :min="temperatureControl.min", :max="temperatureControl.max", :step="temperatureControl.step")
          span {{ temperatureControl.unit }}
          p {{ temperatureControl.description }}
        div(v-if="pressureControl", class="molar__control", data-testid="molar-control-pressurePascal")
          label(for="molar-pressure") {{ pressureControl.label }}
          input(id="molar-pressure", v-model.number="pressurePascal", data-testid="molar-pressure", :type="pressureControl.type", :min="pressureControl.min", :max="pressureControl.max", :step="pressureControl.step")
          span {{ pressureControl.unit }}
          p {{ pressureControl.description }}
        div(v-if="chargeControl", class="molar__control", data-testid="molar-control-chargeNumber")
          label(for="molar-charge") {{ chargeControl.label }}
          input(id="molar-charge", v-model.number="chargeNumber", data-testid="molar-charge", :type="chargeControl.type", :min="chargeControl.min", :max="chargeControl.max", :step="chargeControl.step")
          span {{ chargeControl.unit }}
          p {{ chargeControl.description }}
        div(v-if="molarMassControl", class="molar__control", data-testid="molar-control-molarMassKgPerMol")
          label(for="molar-mass") {{ molarMassControl.label }}
          input(id="molar-mass", v-model.number="molarMassKgPerMol", data-testid="molar-molar-mass", :type="molarMassControl.type", :min="molarMassControl.min", :max="molarMassControl.max", :step="molarMassControl.step")
          span {{ molarMassControl.unit }}
          p {{ molarMassControl.description }}
    p(v-if="depth === 'guided'", class="molar__guided-state", data-testid="molar-guided-state")  The Guided setup keeps the generated state fixed at {{ formatNumber(temperatureKelvin) }} K and {{ formatNumber(pressurePascal) }} Pa, with charge number {{ chargeNumber }} and declared molar mass {{ formatNumber(molarMassKgPerMol) }} kg/mol. Technical depth exposes these dependent-branch inputs. 
    fieldset(class="molar__prediction", data-testid="molar-prediction-gate")
      legend Predict what changes when amount doubles
      p(data-testid="molar-prediction-prompt") {{ simulation.predictionPrompt }}
      p(v-if="declaredDoublingAmounts", data-testid="molar-doubling-declaration")  Compare {{ formatNumber(declaredDoublingAmounts.base) }} mol with {{ formatNumber(declaredDoublingAmounts.doubled) }} mol while holding substance, molar mass, gas model, temperature, pressure, and charge number fixed. 
      label(v-for="option in predictionOptions", :key="option.value")
        input(v-model="prediction", type="radio", name="molar-prediction", :value="option.value", :data-testid="`molar-prediction-${option.value}`")
        |  {{ option.label }}
    div(class="molar__actions")
      button(type="button", data-testid="reveal-molar-result", :disabled="!prediction", @click="revealResult") Reveal conversions
      button(type="button", data-testid="reset-molar", @click="resetInstrument") Reset
    p(v-if="evaluationError", class="molar__error", role="alert", data-testid="molar-evaluation-error") {{ evaluationError }}
    p(v-if="predictionStale", class="molar__stale", aria-live="polite", data-testid="molar-prediction-stale") The inputs changed, so the previous prediction is not compared with this live result. Make a new prediction for the current inputs.
    section(v-if="revealed && result", class="molar__result", data-testid="molar-result", aria-labelledby="molar-result-title")
      h3(id="molar-result-title") Particle-to-mole dependency flow
      figure(class="molar__figure")
        svg(viewBox="0 0 760 360", role="img", aria-labelledby="molar-flow-title molar-flow-description", data-testid="molar-flow-svg")
          title(id="molar-flow-title") Amount of substance and its applicable dependent conversions
          desc(id="molar-flow-description") The selected amount of substance is the root. Lines lead to entity count, bulk mass, ideal-gas volume when selected, and signed Faraday charge.
          rect(class="molar__node", x="25", y="128", width="205", height="96", rx="8")
          text(x="128", y="158", text-anchor="middle") Amount of substance
          text(x="128", y="190", text-anchor="middle") {{ formatNumber(result.amountOfSubstanceMol) }} mol
          g(v-for="(row, index) in flowRows", :key="row.quantity", :data-flow-quantity="row.quantity")
            line(class="molar__link", x1="230", y1="176", x2="390", :y2="45 + index * 86")
            rect(class="molar__node", x="390", :y="10 + index * 86", width="340", height="70", rx="8")
            text(x="410", :y="37 + index * 86") {{ row.label }}
            text(x="410", :y="62 + index * 86") {{ formatNumber(row.value) }} {{ row.unit }}
        figcaption(data-testid="molar-text-alternative") {{ formatNumber(result.amountOfSubstanceMol) }} mol of {{ result.substance.label }} maps to {{ formatNumber(result.entityCount) }} specified entities and {{ formatNumber(result.bulkMassKg) }} kg. Only branches selected by the declared inputs appear.
      p(data-testid="molar-prediction-comparison") {{ predictionComparison }}
      div(v-if="doublingComparison", class="molar__table-wrap")
        table(data-testid="molar-doubling-table")
          caption Compatible base and doubled-amount comparison with all other model inputs held fixed
          thead
            tr
              th(scope="col") Quantity
              th(scope="col") At {{ formatNumber(doublingComparison.base.amountOfSubstanceMol) }} mol
              th(scope="col") At {{ formatNumber(doublingComparison.doubled.amountOfSubstanceMol) }} mol
              th(scope="col") Scaling statement
          tbody
            tr
              th(scope="row") Entity count
              td {{ formatNumber(doublingComparison.base.entityCount) }}
              td {{ formatNumber(doublingComparison.doubled.entityCount) }}
              td 2x
            tr
              th(scope="row") Bulk mass (kg)
              td {{ formatNumber(doublingComparison.base.bulkMassKg) }}
              td {{ formatNumber(doublingComparison.doubled.bulkMassKg) }}
              td 2x
            tr(v-if="doublingComparison.base.idealGasVolumeCubicMetres !== null && doublingComparison.doubled.idealGasVolumeCubicMetres !== null")
              th(scope="row") Ideal-gas volume (m^3)
              td {{ formatNumber(doublingComparison.base.idealGasVolumeCubicMetres) }}
              td {{ formatNumber(doublingComparison.doubled.idealGasVolumeCubicMetres) }}
              td 2x at the same T and p
            tr
              th(scope="row") Faraday charge (C)
              td {{ formatNumber(doublingComparison.base.faradayChargeCoulombs) }}
              td {{ formatNumber(doublingComparison.doubled.faradayChargeCoulombs) }}
              td {{ doublingComparison.base.faradayChargeCoulombs === 0 ? '0 to 0; linear identity with z = 0' : '2x' }}
      div(class="molar__table-wrap")
        table(data-testid="molar-output-table")
          caption Applicable dependent conversions for the declared amount and model inputs
          thead
            tr
              th(scope="col") Quantity
              th(scope="col") Value
              th(scope="col") Unit
          tbody
            tr(v-for="row in result.table", :key="row.quantity", :data-quantity="row.quantity")
              th(scope="row") {{ row.label }}
              td {{ formatNumber(row.value) }}
              td {{ row.unit }}
      p(data-testid="molar-substance-basis") {{ result.substance.wording }}
      section(class="molar__finding", data-testid="molar-finding-panel", aria-labelledby="molar-finding-title")
        h3(id="molar-finding-title") Live finding
        p(role="status", aria-live="polite", data-testid="molar-finding") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="molar-finding-result-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd {{ result.finding.claimClass }}
          dt Model origin
          dd {{ result.finding.modelOrigin }}
          dt Method relationship
          dd {{ result.finding.methodRelationship }}
          dt Source revision
          dd(data-testid="molar-provenance-revision") {{ result.finding.sourceRevision }}
          dt Source locator
          dd(data-testid="molar-provenance-locator") {{ result.finding.sourceLocator }}
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
        p(data-testid="molar-does-not-establish") {{ result.finding.doesNotEstablish }}
        h4 Runtime caveats
        ul(data-testid="molar-runtime-caveats")
          li(v-for="caveat in result.finding.caveats", :key="caveat") {{ caveat }}
        h4 Evidence references
        ul(data-testid="molar-evidence-refs")
          li(v-for="reference in result.finding.evidenceRefs", :key="reference")
            a(:href="evidenceHref(reference)") {{ reference }}
        p(data-testid="molar-validation-boundary") No empirical comparison or theory validation is claimed by these dependent conversions.
    section(v-if="depth === 'technical'", class="molar__technical", data-testid="molar-technical-disclosure")
      h3 State, ideal-gas, and SI caveats
      p {{ simulation.numericalMethod?.description }}
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
        li(v-for="caveat in simulation.finding.caveats", :key="caveat") {{ caveat }}
</template>

<style scoped>
.molar { display: grid; gap: 1.25rem; }
.molar__heading h2, .molar h3, .molar h4, .molar p { margin-top: 0; }
.molar__kicker { font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.molar__presets { padding: 0; list-style: none; }
.molar__presets li, .molar__control, .molar__prediction, .molar__finding, .molar__technical, .molar__guided-state { padding: 1rem; border: 1px solid var(--line, #555); }
.molar__presets button { min-height: 2.75rem; }
.molar__controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; }
.molar__controls h3 { grid-column: 1 / -1; }
.molar__control { display: grid; align-content: start; gap: .5rem; }
.molar__control label { font-weight: 700; }
.molar__control input, .molar__control select { width: 100%; min-height: 2.75rem; box-sizing: border-box; }
.molar__prediction label { display: flex; align-items: center; min-height: 2.75rem; gap: .5rem; }
.molar__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.molar__actions button { min-height: 2.75rem; }
.molar__error { padding: .85rem; border: 2px solid currentColor; }
.molar__stale { padding: .75rem; border-left: 4px solid currentColor; }
.molar__figure { margin: 0; }
.molar__figure svg { display: block; width: 100%; height: auto; border: 1px solid var(--line, #555); }
.molar__node { fill: var(--surface, transparent); stroke: currentColor; stroke-width: 2; }
.molar__link { stroke: currentColor; stroke-width: 2; }
.molar__figure text { fill: currentColor; font-size: 16px; }
.molar__figure figcaption { padding-block: .75rem; }
.molar__table-wrap { overflow-x: auto; }
.molar table { width: 100%; border-collapse: collapse; }
.molar th, .molar td { padding: .55rem; border: 1px solid var(--line, #555); text-align: left; }
.molar__finding dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: .4rem 1rem; }
.molar__finding dd { margin: 0; overflow-wrap: anywhere; }
.molar__finding code { overflow-wrap: anywhere; }
@media (max-width: 640px) { .molar__finding dl { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .molar *, .molar *::before, .molar *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; } }
@media (forced-colors: active) {
  .molar__presets li, .molar__control, .molar__prediction, .molar__finding, .molar__technical, .molar__guided-state, .molar__figure svg, .molar th, .molar td { border-color: CanvasText; }
  .molar__node, .molar__link { stroke: CanvasText; }
  .molar__node { fill: Canvas; }
}
</style>
