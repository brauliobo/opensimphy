<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  DIMENSION_AXES,
  DIMENSION_COORDINATE_SYSTEM_IDS,
  DIMENSION_EXPRESSION_PRESET_IDS,
  DIMENSION_EXPRESSION_PRESETS,
  DIMENSION_TARGET_IDS,
  DIMENSION_TARGETS,
  evaluateDimensionBuilder,
  formatDimensionVector,
  projectDimensionAxisTable,
  type DimensionBuilderEvaluation,
  type DimensionBuilderInput,
  type DimensionCoordinateSystem,
  type DimensionExpressionPresetId,
  type DimensionTargetId,
} from '../../tour/dimensionEngine'
import type {
  ReadingDepth,
  TourControl,
  TourGeneratedSimulation,
  TourPreset,
  TourSelectControl,
} from '../../types/tour'

type Prediction = '' | 'matches-target' | 'different-dimension' | 'operation-undefined'
type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: DimensionBuilderEvaluation]
}>()

const EXPECTED_PRESETS = Object.freeze([
  { id: 'average-speed-from-path', label: 'Race the clock' },
  { id: 'force-from-motion', label: 'Push a mass' },
  { id: 'energy-or-torque', label: 'Same dimension, different kind' },
  { id: 'unlike-sum', label: 'Break the equation' },
] as const)

const EXPECTED_OUTPUTS = Object.freeze([
  { id: 'operationStatus', type: 'operation-status', nullable: false },
  { id: 'resultDimension', type: 'rational-dimension-vector', nullable: true },
  { id: 'targetDimension', type: 'rational-dimension-vector', nullable: false },
  { id: 'targetMatch', type: 'boolean', nullable: false },
  { id: 'quantityKindCaveat', type: 'string', nullable: false },
  { id: 'coordinateValue', type: 'number', nullable: true },
  { id: 'coordinateUnit', type: 'string', nullable: true },
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

function isDimensionInput(value: Record<string, number | string | boolean>): boolean {
  const keys = Object.keys(value).sort()
  return sameOrderedValues(keys, ['coordinateSystem', 'expressionPreset', 'sampleSiMagnitude', 'target'])
    && (DIMENSION_TARGET_IDS as readonly unknown[]).includes(value.target)
    && (DIMENSION_EXPRESSION_PRESET_IDS as readonly unknown[]).includes(value.expressionPreset)
    && (DIMENSION_COORDINATE_SYSTEM_IDS as readonly unknown[]).includes(value.coordinateSystem)
    && typeof value.sampleSiMagnitude === 'number'
    && Number.isFinite(value.sampleSiMagnitude)
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  const targetControl = selectControl(simulation, 'target')
  const expressionControl = selectControl(simulation, 'expressionPreset')
  const coordinateControl = selectControl(simulation, 'coordinateSystem')
  const magnitudeControl = numericControl(simulation, 'sampleSiMagnitude')

  if (simulation.controls.length !== 4 || !targetControl || !expressionControl || !coordinateControl || !magnitudeControl) {
    return 'The simulation controls do not match the four inputs supported by the dimension engine.'
  }
  if ([targetControl, expressionControl, coordinateControl].some((control) => control.readingDepth !== 'guided') || magnitudeControl.readingDepth !== 'technical') {
    return 'The simulation reading-depth contract does not match the dimension builder.'
  }
  if (!sameOrderedValues(targetControl.options.map(({ value }) => value), DIMENSION_TARGET_IDS)
    || !sameOrderedValues(expressionControl.options.map(({ value }) => value), DIMENSION_EXPRESSION_PRESET_IDS)
    || !sameOrderedValues(coordinateControl.options.map(({ value }) => value), DIMENSION_COORDINATE_SYSTEM_IDS)) {
    return 'The simulation option catalogs do not match the bounded dimension engine catalogs.'
  }
  if (!(DIMENSION_TARGET_IDS as readonly string[]).includes(targetControl.default)
    || !(DIMENSION_EXPRESSION_PRESET_IDS as readonly string[]).includes(expressionControl.default)
    || !(DIMENSION_COORDINATE_SYSTEM_IDS as readonly string[]).includes(coordinateControl.default)) {
    return 'A simulation source default is not supported by the dimension engine.'
  }
  if (!Number.isFinite(magnitudeControl.default)
    || magnitudeControl.default < magnitudeControl.min
    || magnitudeControl.default > magnitudeControl.max
    || magnitudeControl.min < 0.1
    || magnitudeControl.max > 100
    || magnitudeControl.step <= 0) {
    return 'The sample SI magnitude contract is outside the dimension engine bounds.'
  }
  if ([...simulation.controls, ...simulation.presets].some((item) => !item.label.trim() || !item.description.trim())) {
    return 'The simulation contract is missing required control or preset copy.'
  }

  const basis = simulation.dimensionBasis
  if (!basis
    || basis.system !== 'ISQ'
    || basis.exponentType !== 'rational'
    || basis.activityExponentSubset !== 'integer'
    || basis.axes.length !== DIMENSION_AXES.length
    || basis.axes.some((axis, index) => axis.id !== DIMENSION_AXES[index]?.id || axis.symbol !== DIMENSION_AXES[index]?.symbol)) {
    return 'The declared dimension basis does not match the engine ISQ axis order.'
  }

  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length
    || EXPECTED_OUTPUTS.some((expected, index) => {
      const field = simulation.outputSchema[index]
      return !field || field.id !== expected.id || field.type !== expected.type || field.nullable !== expected.nullable
    })) {
    return 'The simulation output schema does not match the dimension engine output.'
  }

  if (simulation.presets.length !== EXPECTED_PRESETS.length
    || EXPECTED_PRESETS.some((expected, index) => {
      const preset = simulation.presets[index]
      return !preset || preset.id !== expected.id || preset.label !== expected.label
    })) {
    return 'The dimension builder presets do not match the generated simulation contract.'
  }
  for (const preset of simulation.presets) {
    if (!isDimensionInput(preset.inputs)) return `Preset ${preset.id} does not provide a complete dimension-engine input.`
    try {
      evaluateDimensionBuilder(preset.inputs as unknown as DimensionBuilderInput)
    } catch {
      return `Preset ${preset.id} is outside the dimension engine bounds.`
    }
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const targetControl = selectControl(props.simulation, 'target')
const expressionControl = selectControl(props.simulation, 'expressionPreset')
const coordinateControl = selectControl(props.simulation, 'coordinateSystem')
const magnitudeControl = numericControl(props.simulation, 'sampleSiMagnitude')

function presetInput(preset: TourPreset | undefined): DimensionBuilderInput | null {
  return preset && isDimensionInput(preset.inputs)
    ? preset.inputs as unknown as DimensionBuilderInput
    : null
}

const sourceDefaults = targetControl && expressionControl && coordinateControl && magnitudeControl
  ? {
      target: targetControl.default as DimensionTargetId,
      expressionPreset: expressionControl.default as DimensionExpressionPresetId,
      coordinateSystem: coordinateControl.default as DimensionCoordinateSystem,
      sampleSiMagnitude: magnitudeControl.default,
    }
  : null
const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const target = ref<DimensionTargetId | ''>(initialInput?.target ?? '')
const expressionPreset = ref<DimensionExpressionPresetId | ''>(initialInput?.expressionPreset ?? '')
const coordinateSystem = ref<DimensionCoordinateSystem | ''>(initialInput?.coordinateSystem ?? '')
const sampleSiMagnitude = ref(initialInput?.sampleSiMagnitude ?? Number.NaN)
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<DimensionBuilderEvaluation | null>(null)
const evaluationError = ref<string | null>(null)

const selectedExpression = computed(() => expressionControl?.options.find(({ value }) => value === expressionPreset.value) ?? null)
const selectedCoordinate = computed(() => coordinateControl?.options.find(({ value }) => value === coordinateSystem.value) ?? null)
const selectedExpressionCatalog = computed(() => DIMENSION_EXPRESSION_PRESETS.find(({ id }) => id === expressionPreset.value) ?? null)
const selectedTargetCatalog = computed(() => DIMENSION_TARGETS.find(({ id }) => id === target.value) ?? null)
const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input
    && input.target === target.value
    && input.expressionPreset === expressionPreset.value
    && input.coordinateSystem === coordinateSystem.value
    && input.sampleSiMagnitude === sampleSiMagnitude.value
}) ?? null)
const axisRows = computed(() => result.value ? projectDimensionAxisTable(result.value) : [])
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'matches-target', label: 'Matches target' },
  { value: 'different-dimension', label: 'Different dimension' },
  { value: 'operation-undefined', label: 'Operation undefined' },
]

const actualOutcome = computed<Exclude<Prediction, ''> | null>(() => {
  if (!result.value) return null
  if (result.value.operationStatus === 'undefined-unlike-addition') return 'operation-undefined'
  return result.value.targetMatch ? 'matches-target' : 'different-dimension'
})

const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value || !actualOutcome.value) return ''
  const predictedLabel = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  const actualLabel = predictionOptions.find(({ value }) => value === actualOutcome.value)?.label
  return `Prediction: ${predictedLabel}. Result: ${actualLabel}. ${recordedPrediction.value === actualOutcome.value ? 'The two align.' : 'The two differ.'}`
})

const operationStatusText = computed(() => result.value?.operationStatus === 'undefined-unlike-addition'
  ? 'Undefined: addition of unlike quantity kinds'
  : 'Defined')

const targetMatchText = computed(() => {
  if (!result.value) return ''
  if (result.value.operationStatus === 'undefined-unlike-addition') return 'Not applicable: the operation is undefined'
  return result.value.targetMatch
    ? 'Dimensions match; quantity-kind identity is not established'
    : 'Different dimension from the target'
})

const coordinateText = computed(() => {
  if (!result.value) return ''
  if (result.value.coordinateValue !== null && result.value.coordinateUnit) {
    return `${result.value.coordinateValue} ${result.value.coordinateUnit}`
  }
  return result.value.operationStatus === 'undefined-unlike-addition'
    ? 'Unavailable because the operation is undefined'
    : 'Unavailable because the result dimension differs from the target'
})

function currentInput(): DimensionBuilderInput | null {
  if (contractError || !target.value || !expressionPreset.value || !coordinateSystem.value) return null
  return {
    target: target.value,
    expressionPreset: expressionPreset.value,
    coordinateSystem: coordinateSystem.value,
    sampleSiMagnitude: sampleSiMagnitude.value,
  }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateDimensionBuilder(input)
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The dimension engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: DimensionBuilderInput): void {
  target.value = input.target
  expressionPreset.value = input.expressionPreset
  coordinateSystem.value = input.coordinateSystem
  sampleSiMagnitude.value = input.sampleSiMagnitude
}

function applyPreset(preset: TourPreset): void {
  const input = presetInput(preset)
  if (input) assignInput(input)
}

function resetBuilder(): void {
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

function coordinateOptionLabel(value: string, label: string): string {
  if (value === 'si') return `${label}, International System of Units (SI)`
  if (value === 'mechanical-cgs') return 'Mechanical centimetre-gram-second (CGS)'
  return label
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([target, expressionPreset, coordinateSystem, sampleSiMagnitude], () => {
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
section.dimension-builder(data-testid="dimension-builder" :aria-labelledby="`${simulation.id}-title`")
  header.dimension-builder-heading
    p.dimension-builder-kicker Dimension workshop
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}

  p.dimension-builder-error(v-if="contractError" role="alert" data-testid="dimension-builder-error") This activity cannot run because its generated contract and dimension engine do not agree. {{ contractError }}

  template(v-else)
    section.dimension-builder-presets(aria-labelledby="dimension-builder-presets-title")
      h3#dimension-builder-presets-title Try a setup
      ul.dimension-builder-preset-list
        li(v-for="preset in simulation.presets" :key="preset.id")
          button.dimension-builder-preset.tour-touch-target(
            type="button"
            :data-testid="`preset-${preset.id}`"
            :aria-describedby="`preset-${preset.id}-description`"
            @click="applyPreset(preset)"
          ) {{ preset.label }}
          p(:id="`preset-${preset.id}-description`") {{ preset.description }}
      p.dimension-builder-inspection-prompt(v-if="selectedPreset" data-testid="preset-inspection-prompt") {{ selectedPreset.inspectionPrompt }}

    section.dimension-builder-controls(aria-labelledby="dimension-builder-controls-title")
      h3#dimension-builder-controls-title Build an expression

      .dimension-builder-control(v-if="targetControl" data-testid="builder-control-target")
        label(for="dimension-builder-target") {{ targetControl.label }}
        select#dimension-builder-target(
          v-model="target"
          data-testid="dimension-target"
          :aria-describedby="'dimension-builder-target-description'"
        )
          option(v-for="option in targetControl.options" :key="option.value" :value="option.value") {{ option.label }}
        p#dimension-builder-target-description
          | {{ targetControl.description }}
          | {{ targetControl.options.find(({ value }) => value === target)?.description }}
          span.dimension-builder-playful-prompt(v-if="targetControl.playfulPrompt") {{ targetControl.playfulPrompt }}

      .dimension-builder-control(v-if="expressionControl" data-testid="builder-control-expression")
        label(for="dimension-builder-expression") {{ expressionControl.label }}
        select#dimension-builder-expression(
          v-model="expressionPreset"
          data-testid="dimension-expression"
          :aria-describedby="'dimension-builder-expression-description'"
        )
          option(v-for="option in expressionControl.options" :key="option.value" :value="option.value") {{ option.label }}
        p#dimension-builder-expression-description
          | {{ expressionControl.description }}
          | {{ expressionControl.options.find(({ value }) => value === expressionPreset)?.description }}
          span.dimension-builder-playful-prompt(v-if="expressionControl.playfulPrompt") {{ expressionControl.playfulPrompt }}

      .dimension-builder-control(v-if="coordinateControl" data-testid="builder-control-coordinate")
        label(for="dimension-builder-coordinate") {{ coordinateControl.label }}
        select#dimension-builder-coordinate(
          v-model="coordinateSystem"
          data-testid="dimension-coordinate"
          :aria-describedby="'dimension-builder-coordinate-description'"
        )
          option(v-for="option in coordinateControl.options" :key="option.value" :value="option.value") {{ coordinateOptionLabel(option.value, option.label) }}
        p#dimension-builder-coordinate-description
          | {{ coordinateControl.description }}
          | {{ coordinateControl.options.find(({ value }) => value === coordinateSystem)?.description }}
          span.dimension-builder-playful-prompt(v-if="coordinateControl.playfulPrompt") {{ coordinateControl.playfulPrompt }}

      p.dimension-builder-coordinate-disclosure(v-if="depth === 'guided'" data-testid="guided-coordinate-disclosure")
        | The displayed coordinate uses the activity's fixed target-bound sample value of
        | {{ sampleSiMagnitude }} {{ selectedTargetCatalog?.coordinates.si.unit }} in the International System of Units (SI).
        | This supplied value is not produced from measurements of the expression operands. Technical depth exposes it as a parameter.

      .dimension-builder-control.dimension-builder-control-technical(
        v-if="depth === 'technical' && magnitudeControl"
        data-testid="builder-control-magnitude"
      )
        label(for="dimension-builder-magnitude") {{ magnitudeControl.label }}
        input#dimension-builder-magnitude(
          v-model.number="sampleSiMagnitude"
          data-testid="dimension-magnitude"
          :type="magnitudeControl.type"
          :min="magnitudeControl.min"
          :max="magnitudeControl.max"
          :step="magnitudeControl.step"
          :aria-describedby="'dimension-builder-magnitude-description'"
        )
        output(for="dimension-builder-magnitude") {{ sampleSiMagnitude }}
        p#dimension-builder-magnitude-description
          | {{ magnitudeControl.description }}
          span.dimension-builder-playful-prompt(v-if="magnitudeControl.playfulPrompt") {{ magnitudeControl.playfulPrompt }}

    fieldset.dimension-builder-prediction(data-testid="prediction-gate")
      legend Make a prediction before revealing the trace
      p {{ simulation.predictionPrompt }}
      label.dimension-builder-prediction-option.tour-touch-target(v-for="option in predictionOptions" :key="option.value")
        input(
          v-model="prediction"
          type="radio"
          name="dimension-builder-prediction"
          :value="option.value"
          :data-testid="`prediction-${option.value}`"
        )
        span {{ option.label }}

    .dimension-builder-actions
      button.dimension-builder-reveal.tour-touch-target(
        type="button"
        data-testid="reveal-dimension-result"
        :disabled="!prediction"
        @click="revealResult"
      ) Reveal result
      button.dimension-builder-reset.tour-touch-target(type="button" data-testid="reset-dimension-builder" @click="resetBuilder") Reset

    p.dimension-builder-error(v-if="evaluationError" role="alert" data-testid="dimension-evaluation-error") The dimension engine could not produce a result. {{ evaluationError }}

    p.dimension-builder-prediction-stale(v-if="predictionStale" aria-live="polite" data-testid="prediction-stale") The setup changed, so the previous prediction is not compared with this live result. Choose a new prediction and reveal it for the current setup.

    section.dimension-builder-stage(v-if="revealed && result" data-testid="dimension-result" aria-labelledby="dimension-result-title")
      header
        p Selected expression
        h3#dimension-result-title(data-testid="dimension-expression-stage") {{ selectedExpression?.label }}
        p(v-if="selectedExpressionCatalog")
          | {{ selectedExpressionCatalog.left.label }}
          | {{ selectedExpressionCatalog.operation === 'multiply' ? 'multiplied by' : selectedExpressionCatalog.operation === 'divide' ? 'divided by' : 'added to' }}
          | {{ selectedExpressionCatalog.right.label }}

      dl.dimension-builder-readout
        dt {{ outputLabel('operationStatus') }}
        dd(data-testid="operation-status") {{ operationStatusText }}
        dt {{ outputLabel('targetMatch') }}
        dd(data-testid="target-match") {{ targetMatchText }}
        dt Result dimension
        dd(data-testid="result-dimension") {{ formatDimensionVector(result.resultDimension) }}
        dt Target dimension
        dd(data-testid="target-dimension") {{ formatDimensionVector(result.targetDimension) }}
        dt {{ selectedCoordinate?.label }} coordinate
        dd(data-testid="coordinate-value") {{ coordinateText }}

      p.dimension-builder-comparison(data-testid="prediction-comparison") {{ predictionComparison }}
      p.dimension-builder-caveat(data-testid="quantity-kind-caveat") {{ result.quantityKindCaveat }}

      .dimension-builder-table-wrap
        table(data-testid="dimension-axis-table")
          caption Result and target exponents in the seven-axis International System of Quantities (ISQ) dimension basis
          thead
            tr
              th(scope="col") Base quantity
              th(scope="col") Symbol
              th(scope="col") Result exponent
              th(scope="col") Target exponent
          tbody
            tr(v-for="row in axisRows" :key="row.axisId")
              th(scope="row") {{ row.axisLabel }}
              td {{ row.axisSymbol }}
              td {{ row.resultText }}
              td {{ row.targetText }}

      section.dimension-builder-finding(data-testid="dimension-finding-panel" aria-labelledby="dimension-finding-title")
        h3#dimension-finding-title Live finding
        p(role="status" aria-live="polite" data-testid="dimension-finding") {{ result.finding.establishes }}
        dl.dimension-builder-finding-summary
          dt Runtime result status
          dd(data-testid="finding-result-status") {{ result.finding.resultStatus.toUpperCase() }}
          dt Claim class
          dd(data-testid="finding-claim-class") {{ result.finding.claimClass }}
          dt Model origin
          dd(data-testid="finding-model-origin") {{ result.finding.modelOrigin }}
          dt Method relationship
          dd(data-testid="finding-method-relationship") {{ result.finding.methodRelationship }}
        section
          h4 What changed
          p(data-testid="finding-changed") {{ result.finding.changed }}
        section
          h4 Why
          p(data-testid="finding-cause") {{ result.finding.cause }}
        section
          h4 Equation
          p(data-testid="finding-equation")
            code {{ result.finding.equation }}
        section
          h4 Assumptions
          ul(data-testid="finding-assumptions")
            li(v-for="assumption in result.finding.assumptions" :key="assumption") {{ assumption }}
        section
          h4 Establishes
          p(data-testid="finding-establishes") {{ result.finding.establishes }}
        section
          h4 Does not establish
          p(data-testid="finding-does-not-establish") {{ result.finding.doesNotEstablish }}
        section
          h4 Evidence references
          ul(data-testid="finding-evidence-refs")
            li(v-for="evidenceRef in result.finding.evidenceRefs" :key="evidenceRef")
              a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
        p(data-testid="finding-validation-boundary") No empirical comparison or theory validation is claimed by this dimension-contract result.

    section.dimension-builder-disclosure(v-if="depth === 'technical'" data-testid="technical-disclosure")
      h3 Assumptions and dimension basis
      ul
        li(v-for="assumption in simulation.assumptions" :key="assumption") {{ assumption }}
      dl(v-if="simulation.dimensionBasis")
        dt System
        dd International System of Quantities ({{ simulation.dimensionBasis.system }})
        dt Exponent type
        dd {{ simulation.dimensionBasis.exponentType }}
        dt Activity exponent subset
        dd {{ simulation.dimensionBasis.activityExponentSubset }}
        dt Ordered axes
        dd
          ol
            li(v-for="axis in simulation.dimensionBasis.axes" :key="axis.id") {{ DIMENSION_AXES.find(({ id }) => id === axis.id)?.label }} ({{ axis.symbol }})
</template>
