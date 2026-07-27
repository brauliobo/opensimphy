<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  SCALE_QUANTITY_FAMILY_IDS,
  SCALE_RULER_CATALOG,
  SCALE_RULER_DEFAULT_PRESETS,
  SCALE_RULER_PRESET_IDS,
  evaluateScaleRuler,
  projectScaleRulerSeries,
  projectScaleRulerTable,
  type ScaleQuantityFamilyId,
  type ScaleRulerEvaluation,
  type ScaleRulerInput,
  type ScaleRulerPresetId,
} from '../../tour/scaleRulerEngine'
import type { ReadingDepth, TourGeneratedSimulation, TourPreset, TourSelectControl } from '../../types/tour'

type Prediction = '' | 'negative' | 'near-zero' | 'positive'

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [result: ScaleRulerEvaluation]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'bounded-physical-scale-catalog-1',
  implementationRevision: 'tour-scale-ruler-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'Choose one family and a matching labeled scale, predict its base-10 exponent, then inspect whether the entry is defined, derived, measured, or illustrative.'
const EXPECTED_PRESETS = Object.freeze([
  ['human-height', 'Start at human height'],
  ['planck-length', 'Inspect the Planck length'],
  ['caesium-period', 'Invert the clock anchor'],
  ['planck-mass', 'Inspect the Planck mass'],
] as const)
const EXPECTED_OUTPUTS = Object.freeze([
  ['selectedSiValue', 'number', null, false],
  ['selectedUnit', 'string', null, false],
  ['selectedLog10', 'number', null, false],
  ['selectedStatus', 'string', null, false],
  ['selectedSourceLabel', 'string', null, false],
] as const)
const EXPECTED_CONTROL_PRESET_IDS = SCALE_RULER_PRESET_IDS
const EXPECTED_COMPATIBILITY_KEY = 'c87bed7832b1e0eff330a25ad429de073be89497a2ab2bcc35a101b5831769db'

function sameOrderedValues(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

function selectControl(simulation: TourGeneratedSimulation, id: string): TourSelectControl | null {
  const control = simulation.controls.find((candidate) => candidate.id === id)
  return control?.type === 'select' ? control : null
}

function isScaleInput(value: Record<string, number | string | boolean>): value is Record<'quantityFamily' | 'presetId', string> {
  return sameOrderedValues(Object.keys(value).sort(), ['presetId', 'quantityFamily'])
    && (SCALE_QUANTITY_FAMILY_IDS as readonly unknown[]).includes(value.quantityFamily)
    && (SCALE_RULER_PRESET_IDS as readonly unknown[]).includes(value.presetId)
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'physical-scale-ruler' || simulation.lessonId !== 'clocks-action-light-gravity') {
    return 'The simulation identity is not the supported physical-scale-ruler contract.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The generated simulation revision does not match the scale-ruler implementation.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the scale-ruler choices.'
  }
  if (simulation.numericalMethod?.implementationRef !== 'src/tour/scaleRulerEngine.ts'
    || simulation.numericalMethod.kind !== 'direct-evaluation'
    || simulation.numericalMethod.deterministic !== true
    || simulation.limits.tier !== 'immediate'
    || simulation.limits.maxOperations !== 1
    || simulation.limits.maxDurationMs !== 10
    || simulation.visualization.kind !== 'status-labeled-logarithmic-ruler'
    || simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY) {
    return 'The generated runtime contract does not match the scale-ruler engine.'
  }

  const familyControl = selectControl(simulation, 'quantityFamily')
  const presetControl = selectControl(simulation, 'presetId')
  if (simulation.controls.length !== 2 || !familyControl || !presetControl) {
    return 'The simulation controls do not match the two scale-ruler inputs.'
  }
  if (familyControl.readingDepth !== 'guided' || presetControl.readingDepth !== 'guided') {
    return 'The scale-ruler control depth contract has changed.'
  }
  if (!sameOrderedValues(familyControl.options.map(({ value }) => value), SCALE_QUANTITY_FAMILY_IDS)
    || !sameOrderedValues(presetControl.options.map(({ value }) => value), EXPECTED_CONTROL_PRESET_IDS)
    || familyControl.inputRole !== 'target-quantity'
    || presetControl.inputRole !== 'preset-selection'
    || familyControl.default !== 'length'
    || presetControl.default !== 'human-height') {
    return 'The generated control catalogs do not match the bounded scale catalog.'
  }
  if ([...simulation.controls, ...simulation.presets].some((item) => !item.label.trim() || !item.description.trim())) {
    return 'The generated controls or presets are missing required copy.'
  }
  if (simulation.presets.length !== EXPECTED_PRESETS.length
    || EXPECTED_PRESETS.some(([id, label], index) => simulation.presets[index]?.id !== id || simulation.presets[index]?.label !== label)) {
    return 'The generated presets do not match the scale-ruler preset contract.'
  }
  for (const preset of simulation.presets) {
    if (!isScaleInput(preset.inputs)) return `Preset ${preset.id} does not provide one complete scale-ruler input.`
    try {
      evaluateScaleRuler(preset.inputs as unknown as ScaleRulerInput)
    } catch {
      return `Preset ${preset.id} is outside the scale-ruler engine contract.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length
    || EXPECTED_OUTPUTS.some(([id, type, unit, nullable], index) => {
      const output = simulation.outputSchema[index]
      return !output || output.id !== id || output.type !== type || output.unit !== unit || output.nullable !== nullable
    })) {
    return 'The generated output schema does not match the scale-ruler result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const familyControl = selectControl(props.simulation, 'quantityFamily')
const presetControl = selectControl(props.simulation, 'presetId')

function presetInput(preset: TourPreset | undefined): ScaleRulerInput | null {
  return preset && isScaleInput(preset.inputs)
    ? preset.inputs as unknown as ScaleRulerInput
    : null
}

const sourceDefaults: ScaleRulerInput | null = familyControl && presetControl
  ? {
      quantityFamily: familyControl.default as ScaleQuantityFamilyId,
      presetId: presetControl.default as ScaleRulerPresetId,
    }
  : null
const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const quantityFamily = ref<ScaleQuantityFamilyId | ''>(initialInput?.quantityFamily ?? '')
const presetId = ref<ScaleRulerPresetId | ''>(initialInput?.presetId ?? '')
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<ScaleRulerEvaluation | null>(null)
const evaluationError = ref<string | null>(null)

const familyOptions = computed(() => presetControl?.options.filter(({ value }) => {
  return SCALE_RULER_CATALOG.find(({ id }) => id === value)?.family === quantityFamily.value
}) ?? [])
const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input?.quantityFamily === quantityFamily.value && input.presetId === presetId.value
}) ?? null)
const tableRows = computed(() => result.value ? projectScaleRulerTable(result.value) : [])
const series = computed(() => result.value ? projectScaleRulerSeries(result.value) : [])
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'negative', label: 'Below 10^0 SI units' },
  { value: 'near-zero', label: 'Near 10^0 SI units' },
  { value: 'positive', label: 'Above 10^0 SI units' },
]
const actualOutcome = computed<Exclude<Prediction, ''> | null>(() => {
  if (!result.value) return null
  if (result.value.selectedLog10 < -0.5) return 'negative'
  if (result.value.selectedLog10 > 0.5) return 'positive'
  return 'near-zero'
})
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value || !actualOutcome.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  const computed = predictionOptions.find(({ value }) => value === actualOutcome.value)?.label
  return `Prediction: ${predicted}. Computed position shown in this activity: ${computed}.`
})

function currentInput(): ScaleRulerInput | null {
  if (contractError || !quantityFamily.value || !presetId.value) return null
  return { quantityFamily: quantityFamily.value, presetId: presetId.value }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateScaleRuler(input)
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The scale-ruler engine could not evaluate this input.'
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
  const input = presetInput(preset)
  if (!input) return
  quantityFamily.value = input.quantityFamily
  presetId.value = input.presetId
}

function resetRuler(): void {
  if (sourceDefaults) {
    quantityFamily.value = sourceDefaults.quantityFamily
    presetId.value = sourceDefaults.presetId
  }
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  evaluationError.value = null
}

function rulerX(logValue: number): number {
  if (!result.value) return 6
  const { minimumExponent, maximumExponent } = result.value.axis
  return 6 + ((logValue - minimumExponent) / (maximumExponent - minimumExponent)) * 88
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

function sourceLabel(row: { id: ScaleRulerPresetId; sourceLabel: string }): string {
  switch (row.id) {
    case 'astronomical-unit': return 'Astronomical unit definition (149,597,870,700 m exact)'
    case 'light-year': return 'Exact SI speed of light and Julian-year convention'
    case 'parsec': return 'Parsec geometry (648,000/pi astronomical units)'
    case 'julian-year': return 'Julian year convention (365.25 days exact)'
    case 'solar-mass': return 'IAU 2015 Resolution B3 nominal solar mass parameter with CODATA 2022 G'
    default: return row.sourceLabel
  }
}

watch([quantityFamily, presetId], () => {
  if (quantityFamily.value && presetId.value) {
    const entry = SCALE_RULER_CATALOG.find(({ id }) => id === presetId.value)
    if (entry?.family !== quantityFamily.value) {
      presetId.value = SCALE_RULER_DEFAULT_PRESETS[quantityFamily.value]
      return
    }
  }
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

<template>
  <section class="dimension-builder scale-ruler" data-testid="scale-ruler" :aria-labelledby="`${simulation.id}-title`">
    <header class="dimension-builder-heading scale-ruler-heading">
      <p class="dimension-builder-kicker">Logarithmic scale instrument</p>
      <h2 :id="`${simulation.id}-title`">{{ simulation.title }}</h2>
      <p>{{ simulation.question }}</p>
    </header>

    <p v-if="contractError" class="dimension-builder-error" role="alert" data-testid="scale-ruler-error">
      This activity cannot run because its generated contract and scale-ruler engine do not agree. {{ contractError }}
    </p>

    <template v-else>
      <section class="dimension-builder-presets" aria-labelledby="scale-ruler-presets-title">
        <h3 id="scale-ruler-presets-title">Try a scale</h3>
        <ul class="dimension-builder-preset-list">
          <li v-for="preset in simulation.presets" :key="preset.id">
            <button class="dimension-builder-preset tour-touch-target" type="button" :data-testid="`scale-preset-${preset.id}`" @click="applyPreset(preset)">
              {{ preset.label }}
            </button>
            <p>{{ preset.description }}</p>
          </li>
        </ul>
        <p v-if="selectedPreset" class="scale-ruler-inspection" data-testid="scale-inspection-prompt">{{ selectedPreset.inspectionPrompt }}</p>
      </section>

      <section class="dimension-builder-controls" aria-labelledby="scale-ruler-controls-title">
        <h3 id="scale-ruler-controls-title">Choose the ruler</h3>
        <div v-if="familyControl" class="dimension-builder-control" data-testid="scale-control-family">
          <label for="scale-ruler-family">{{ familyControl.label }}</label>
          <select id="scale-ruler-family" v-model="quantityFamily" data-testid="scale-family">
            <option v-for="option in familyControl.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <p>{{ familyControl.description }} <span>{{ familyControl.playfulPrompt }}</span></p>
        </div>
        <div v-if="presetControl" class="dimension-builder-control" data-testid="scale-control-preset">
          <label for="scale-ruler-preset">{{ presetControl.label }}</label>
          <select id="scale-ruler-preset" v-model="presetId" data-testid="scale-selection">
            <option v-for="option in familyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <p>{{ presetControl.description }} <span>{{ presetControl.playfulPrompt }}</span></p>
        </div>
      </section>

      <fieldset class="dimension-builder-prediction" data-testid="scale-prediction-gate">
        <legend>Predict before revealing the ruler</legend>
        <p>{{ simulation.predictionPrompt }}</p>
        <label v-for="option in predictionOptions" :key="option.value" class="dimension-builder-prediction-option tour-touch-target">
          <input v-model="prediction" type="radio" name="scale-ruler-prediction" :value="option.value" :data-testid="`scale-prediction-${option.value}`">
          <span>{{ option.label }}</span>
        </label>
      </fieldset>

      <div class="dimension-builder-actions">
        <button class="dimension-builder-reveal tour-touch-target" type="button" data-testid="reveal-scale-ruler" :disabled="!prediction" @click="revealResult">Reveal ruler</button>
        <button class="tour-touch-target" type="button" data-testid="reset-scale-ruler" @click="resetRuler">Reset</button>
      </div>

      <p v-if="evaluationError" class="dimension-builder-error" role="alert">{{ evaluationError }}</p>
      <p v-if="predictionStale" class="dimension-builder-caveat" aria-live="polite" data-testid="scale-prediction-stale">
        The scale changed. The live ruler has updated, but the previous prediction is stale and is not compared with this result.
      </p>

      <section v-if="revealed && result" class="dimension-builder-stage scale-ruler-stage" data-testid="scale-ruler-result" aria-labelledby="scale-ruler-result-title">
        <header>
          <p>Selected scale</p>
          <h3 id="scale-ruler-result-title">{{ result.selected.label }}</h3>
          <p data-testid="scale-selected-value">{{ result.selectedSiDisplay }} at {{ result.selectedLog10.toFixed(6) }} on {{ result.axis.label }}</p>
        </header>

        <svg class="scale-ruler-graphic" viewBox="0 0 100 34" role="img" aria-labelledby="scale-ruler-svg-title scale-ruler-svg-description" data-testid="scale-ruler-svg">
          <title id="scale-ruler-svg-title">{{ result.quantityFamily }} logarithmic ruler</title>
          <desc id="scale-ruler-svg-description">Every {{ result.quantityFamily }} catalog marker is placed at its computed base-10 SI logarithm. {{ result.selected.label }} is selected.</desc>
          <line class="scale-ruler-axis" x1="6" y1="17" x2="94" y2="17" />
          <g v-for="point in series" :key="point.id" :class="['scale-ruler-marker', `scale-ruler-marker-${result.entries.find(({ id }) => id === point.id)?.status}`, { 'is-selected': point.selected }]">
            <line :x1="rulerX(point.xLog10Si)" y1="12" :x2="rulerX(point.xLog10Si)" y2="22" />
            <circle :cx="rulerX(point.xLog10Si)" cy="17" :r="point.selected ? 2.5 : 1.35"><title>{{ point.accessibleLabel }}</title></circle>
          </g>
          <text x="6" y="30">10^{{ result.axis.minimumExponent }}</text>
          <text x="94" y="30" text-anchor="end">10^{{ result.axis.maximumExponent }} {{ result.unit }}</text>
        </svg>

        <ul class="scale-ruler-legend" aria-label="Scale evidence status legend">
          <li><span class="scale-ruler-key is-exact-defined"></span>Exact defined reference</li>
          <li><span class="scale-ruler-key is-exact-derived"></span>Exact derived value</li>
          <li><span class="scale-ruler-key is-measured"></span>Measured or adjusted</li>
          <li><span class="scale-ruler-key is-derived-from-measured"></span>Derived from measured value</li>
          <li><span class="scale-ruler-key is-illustrative"></span>Illustrative scale</li>
        </ul>

        <p class="dimension-builder-comparison" data-testid="scale-prediction-comparison">{{ predictionComparison }}</p>
        <p class="dimension-builder-caveat" data-testid="scale-normalization-caveat">
          The coordinate is normalized to 1 {{ result.unit }}. Changing that reference unit shifts every coordinate; proximity and normalization are not predictions or physical relationships.
        </p>

        <div class="dimension-builder-table-wrap">
          <table data-testid="scale-ruler-table">
            <caption>Accessible {{ result.quantityFamily }} scale catalog corresponding to the logarithmic ruler</caption>
            <thead><tr><th scope="col">Scale</th><th scope="col">SI value</th><th scope="col">log10</th><th scope="col">Status</th><th scope="col">Source</th><th scope="col">Evidence</th></tr></thead>
            <tbody>
              <tr v-for="row in tableRows" :key="row.id" :aria-current="row.selected ? 'true' : undefined">
                <th scope="row">{{ row.label }}<span v-if="row.selected"> (selected)</span></th>
                <td>{{ row.siDisplay }}</td><td>{{ row.log10Si.toFixed(6) }}</td><td>{{ row.statusLabel }}</td><td>{{ sourceLabel(row) }}</td>
                <td><ul class="scale-ruler-row-evidence"><li v-for="evidenceRef in row.evidenceRefs" :key="evidenceRef"><a :href="evidenceHref(evidenceRef)">{{ evidenceRef }}</a></li></ul></td>
              </tr>
            </tbody>
          </table>
        </div>

        <section class="dimension-builder-finding scale-ruler-finding" aria-labelledby="scale-ruler-finding-title" data-testid="scale-ruler-finding">
          <h3 id="scale-ruler-finding-title">Live finding</h3>
          <p role="status" aria-live="polite">{{ result.finding.establishes }}</p>
          <dl>
            <dt>Runtime result status</dt><dd data-testid="scale-result-status">{{ result.finding.resultStatus.toUpperCase() }}</dd>
            <dt>Claim class</dt><dd>{{ result.finding.claimClass }}</dd>
            <dt>Model origin</dt><dd>{{ result.finding.modelOrigin }}</dd>
            <dt>Method relationship</dt><dd>{{ result.finding.methodRelationship }}</dd>
            <dt>Validates theory</dt><dd>{{ result.finding.validatesTheory ? 'Yes' : 'No' }}</dd>
            <dt>Source revision</dt><dd>{{ result.finding.sourceRevision }}</dd>
            <dt>Source locator</dt><dd>{{ result.finding.sourceLocator }}</dd>
          </dl>
          <h4>What changed</h4><p>{{ result.finding.changed }}</p>
          <h4>Why</h4><p>{{ result.finding.cause }}</p>
          <h4>Equation</h4><p><code>{{ result.finding.equation }}</code></p>
          <h4>Assumptions</h4><ul><li v-for="assumption in result.finding.assumptions" :key="assumption">{{ assumption }}</li></ul>
          <h4>Establishes</h4><p>{{ result.finding.establishes }}</p>
          <h4>Does not establish</h4><p>{{ result.finding.doesNotEstablish }}</p>
          <h4>Caveats</h4><ul><li v-for="caveat in result.finding.caveats" :key="caveat">{{ caveat }}</li></ul>
          <h4>Evidence references</h4><ul data-testid="scale-evidence-refs"><li v-for="evidenceRef in result.finding.evidenceRefs" :key="evidenceRef"><a :href="evidenceHref(evidenceRef)">{{ evidenceRef }}</a></li></ul>
          <p data-testid="scale-validation-boundary">No empirical comparison, inferred residual, or theory validation is claimed by this catalog projection.</p>
        </section>
      </section>

      <section v-if="depth === 'technical'" class="dimension-builder-disclosure" data-testid="scale-technical-disclosure">
        <h3>Technical assumptions and source boundary</h3>
        <ul><li v-for="assumption in simulation.assumptions" :key="assumption">{{ assumption }}</li></ul>
        <p>{{ simulation.numericalMethod?.description }}</p>
        <p>{{ simulation.visualization.reducedMotionBehavior }}</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.scale-ruler-inspection { padding: 1rem; color: var(--paper-dim); font-family: var(--mono); font-size: .875rem; }
.scale-ruler-stage { grid-column: 1 / -1; }
.scale-ruler-graphic { width: 100%; min-height: 220px; margin: 1.5rem 0; color: var(--paper); border: 1px solid var(--rule-bright); background: var(--ink-1); }
.scale-ruler-axis, .scale-ruler-marker line { stroke: currentColor; stroke-width: .35; }
.scale-ruler-marker circle { fill: var(--paper-dim); stroke: var(--ink-0); stroke-width: .4; }
.scale-ruler-marker-exact-defined circle { fill: var(--paper); }
.scale-ruler-marker-exact-derived circle { fill: var(--cyan); }
.scale-ruler-marker-measured circle { fill: var(--green); }
.scale-ruler-marker-derived-from-measured circle { fill: color-mix(in srgb, var(--green) 55%, var(--cyan)); }
.scale-ruler-marker-illustrative circle { fill: var(--amber); }
.scale-ruler-marker.is-selected circle { stroke: var(--paper); stroke-width: .9; }
.scale-ruler-graphic text { fill: currentColor; font-family: var(--mono); font-size: 3px; }
.scale-ruler-legend { display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; padding: 0; list-style: none; font-family: var(--mono); font-size: .8rem; }
.scale-ruler-key { display: inline-block; width: .8rem; height: .8rem; margin-right: .35rem; border: 1px solid currentColor; background: var(--paper-dim); }
.scale-ruler-key.is-exact-defined { background: var(--paper); }.scale-ruler-key.is-exact-derived { background: var(--cyan); }.scale-ruler-key.is-measured { background: var(--green); }.scale-ruler-key.is-derived-from-measured { background: color-mix(in srgb, var(--green) 55%, var(--cyan)); }.scale-ruler-key.is-illustrative { background: var(--amber); }
.scale-ruler-row-evidence { padding-left: 1rem; margin: 0; }
.scale-ruler-finding dl { display: grid; grid-template-columns: minmax(150px, .4fr) minmax(0, 1.6fr); gap: .25rem 1rem; }
.scale-ruler-finding dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 420px) { .scale-ruler :deep(.dimension-builder-preset), .scale-ruler :deep(button), .scale-ruler :deep(select), .scale-ruler :deep(input:not([type='radio'])) { min-height: 44px; }.scale-ruler :deep(.dimension-builder-controls) { grid-template-columns: minmax(0, 1fr); } }
@media (forced-colors: active) { .scale-ruler-graphic { forced-color-adjust: auto; }.scale-ruler-marker circle { fill: Canvas; stroke: CanvasText; }.scale-ruler-marker.is-selected circle { fill: Highlight; stroke: HighlightText; } }
</style>
