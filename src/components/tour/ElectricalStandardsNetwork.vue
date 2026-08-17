<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ELECTRICAL_CHARGE_CARRIER_BOUNDS,
  ELECTRICAL_FREQUENCY_BOUNDS_HZ,
  ELECTRICAL_STANDARD_PRESET_IDS,
  ELECTRICAL_VOLTAGE_BOUNDS_V,
  evaluateElectricalStandards,
  projectElectricalStandardsTable,
  type ElectricalNetworkNode,
  type ElectricalNodeId,
  type ElectricalStandardPresetId,
  type ElectricalStandardsEvaluation,
  type ElectricalStandardsInput,
} from '../../tour/electricalStandardsEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset, TourSelectControl } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type Prediction = '' | 'mixed-status' | 'all-exact' | 'historical-current'
type EditableInput = {
  presetId: ElectricalStandardPresetId
  chargeCarriers: number
  voltageV: number
  frequencyHz: number
}

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [result: ElectricalStandardsEvaluation]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'quantum-electrical-identity-network-1',
  implementationRevision: 'tour-electrical-standards-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'Choose whether exact, input-dependent, and historical nodes remain distinct; the Josephson view can evaluate both f = K_J V and V = f/K_J from separate stated inputs.'
const EXPECTED_PRESETS = Object.freeze([
  ['single-electron', 'Single electron at one volt'],
  ['josephson', 'Josephson voltage path'],
  ['hall', 'Quantum Hall identity path'],
] as const)
const EXPECTED_OUTPUTS = Object.freeze([
  ['totalChargeC', 'number', 'C', false],
  ['carrierEnergyJ', 'number', 'J', true],
  ['josephsonFrequencyFromVoltageHz', 'number', 'Hz', true],
  ['josephsonVoltageFromFrequencyV', 'number', 'V', true],
  ['kj90DifferencePpm', 'number', 'ppm', false],
  ['rk90DifferencePpm', 'number', 'ppm', false],
  ['networkStatus', 'string', null, false],
] as const)
const EXPECTED_COMPATIBILITY_KEY = 'e97c4f6a7886840a1e1b3039154b38226bf93e01843cc4cf11c35d6e8484863c'
const NODE_POSITIONS: Readonly<Record<ElectricalNodeId, readonly [number, number]>> = Object.freeze({
  h: [12, 8],
  e: [31, 8],
  KJ: [10, 25],
  RK: [27, 25],
  G0: [44, 25],
  Phi0: [61, 25],
  eV: [78, 25],
  'KJ-90': [10, 43],
  'RK-90': [29, 43],
  'carrier-charge': [48, 43],
  'carrier-energy': [67, 43],
  'josephson-frequency': [48, 58],
  'josephson-voltage': [72, 58],
})

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

function isElectricalPresetInput(
  value: Record<string, number | string | boolean>,
): value is ElectricalStandardsInput & Record<string, number | string | boolean> {
  return sameOrderedValues(Object.keys(value).sort(), ['chargeCarriers', 'frequencyHz', 'presetId', 'voltageV'])
    && (ELECTRICAL_STANDARD_PRESET_IDS as readonly unknown[]).includes(value.presetId)
    && typeof value.chargeCarriers === 'number'
    && typeof value.voltageV === 'number'
    && typeof value.frequencyHz === 'number'
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'electrical-standards-network' || simulation.lessonId !== 'quantum-electrical-standards') {
    return 'The simulation identity is not the supported electrical-standards-network contract.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The generated simulation revision does not match the electrical-standards implementation.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the electrical-standards choices.'
  }
  if (simulation.numericalMethod?.implementationRef !== 'src/tour/electricalStandardsEngine.ts'
    || simulation.numericalMethod.kind !== 'direct-evaluation'
    || simulation.numericalMethod.deterministic !== true
    || simulation.limits.tier !== 'immediate'
    || simulation.limits.maxOperations !== 1
    || simulation.limits.maxDurationMs !== 10
    || simulation.visualization.kind !== 'status-labeled-electrical-identity-network'
    || simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY) {
    return 'The generated runtime contract does not match the electrical standards engine.'
  }

  const presetControl = selectControl(simulation, 'presetId')
  const carrierControl = numericControl(simulation, 'chargeCarriers')
  const voltageControl = numericControl(simulation, 'voltageV')
  const frequencyControl = numericControl(simulation, 'frequencyHz')
  if (simulation.controls.length !== 4 || !presetControl || !carrierControl || !voltageControl || !frequencyControl) {
    return 'The simulation controls do not match the four generated standards inputs.'
  }
  if ([presetControl, carrierControl, voltageControl].some(({ readingDepth }) => readingDepth !== 'guided') || frequencyControl.readingDepth !== 'technical') {
    return 'The electrical standards control depth contract has changed.'
  }
  if (!sameOrderedValues(presetControl.options.map(({ value }) => value), ELECTRICAL_STANDARD_PRESET_IDS)
    || presetControl.default !== 'single-electron'
    || presetControl.inputRole !== 'preset-selection'
    || carrierControl.type !== 'number'
    || voltageControl.type !== 'number'
    || frequencyControl.type !== 'number'
    || carrierControl.inputRole !== 'parameter'
    || voltageControl.inputRole !== 'parameter'
    || frequencyControl.inputRole !== 'parameter'
    || carrierControl.min !== ELECTRICAL_CHARGE_CARRIER_BOUNDS.minimum
    || carrierControl.max !== ELECTRICAL_CHARGE_CARRIER_BOUNDS.maximum
    || carrierControl.default !== 1
    || carrierControl.step !== 1
    || carrierControl.unit !== 'count'
    || voltageControl.min !== ELECTRICAL_VOLTAGE_BOUNDS_V.minimum
    || voltageControl.max !== ELECTRICAL_VOLTAGE_BOUNDS_V.maximum
    || voltageControl.default !== 1
    || voltageControl.step !== 0.001
    || voltageControl.unit !== 'V'
    || frequencyControl.min !== ELECTRICAL_FREQUENCY_BOUNDS_HZ.minimum
    || frequencyControl.max !== ELECTRICAL_FREQUENCY_BOUNDS_HZ.maximum
    || frequencyControl.default !== 0
    || frequencyControl.step !== 1_000_000
    || frequencyControl.unit !== 'Hz'
    || carrierControl.default < carrierControl.min
    || carrierControl.default > carrierControl.max
    || voltageControl.default < voltageControl.min
    || voltageControl.default > voltageControl.max) {
    return 'The generated standards control catalogs or bounds do not match the engine.'
  }
  if ([...simulation.controls, ...simulation.presets].some((item) => !item.label.trim() || !item.description.trim())) {
    return 'The generated controls or presets are missing required copy.'
  }
  if (simulation.presets.length !== EXPECTED_PRESETS.length
    || EXPECTED_PRESETS.some(([id, label], index) => simulation.presets[index]?.id !== id || simulation.presets[index]?.label !== label)) {
    return 'The generated presets do not match the electrical standards views.'
  }
  for (const preset of simulation.presets) {
    if (!preset.inspectionPrompt.trim() || !isElectricalPresetInput(preset.inputs)) {
      return `Preset ${preset.id} does not provide one complete generated standards input.`
    }
    try {
      evaluateElectricalStandards(preset.inputs)
    } catch {
      return `Preset ${preset.id} is outside the electrical standards engine contract.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length
    || EXPECTED_OUTPUTS.some(([id, type, unit, nullable], index) => {
      const output = simulation.outputSchema[index]
      return !output || output.id !== id || output.type !== type || output.unit !== unit || output.nullable !== nullable
    })) {
    return 'The generated output schema does not match the electrical standards result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const presetControl = selectControl(props.simulation, 'presetId')
const carrierControl = numericControl(props.simulation, 'chargeCarriers')
const voltageControl = numericControl(props.simulation, 'voltageV')
const frequencyControl = numericControl(props.simulation, 'frequencyHz')

function presetInput(preset: TourPreset | undefined): EditableInput | null {
  return preset && isElectricalPresetInput(preset.inputs)
    ? {
        presetId:        preset.inputs.presetId,
        chargeCarriers:  preset.inputs.chargeCarriers,
        voltageV:        preset.inputs.voltageV,
        frequencyHz:     preset.inputs.frequencyHz,
      }
    : null
}

const sourceDefaults: EditableInput | null = presetControl && carrierControl && voltageControl && frequencyControl
  ? {
      presetId: presetControl.default as ElectricalStandardPresetId,
      chargeCarriers: carrierControl.default,
      voltageV: voltageControl.default,
      frequencyHz: frequencyControl.default,
    }
  : null
const initialPreset = props.initialPresetId
  ? props.simulation.presets.find(({ id }) => id === props.initialPresetId)
  : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults
const josephsonPresetFrequency = presetInput(props.simulation.presets.find(({ id }) => id === 'josephson'))?.frequencyHz ?? Number.NaN

const presetId = ref<ElectricalStandardPresetId | ''>(initialInput?.presetId ?? '')
const chargeCarriers = ref(initialInput?.chargeCarriers ?? Number.NaN)
const voltageV = ref(initialInput?.voltageV ?? Number.NaN)
const frequencyHz = ref(initialInput?.frequencyHz ?? Number.NaN)
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<ElectricalStandardsEvaluation | null>(null)
const evaluationError = ref<string | null>(null)

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input?.presetId === presetId.value && input.chargeCarriers === chargeCarriers.value && input.voltageV === voltageV.value && input.frequencyHz === frequencyHz.value
}) ?? null)
const tableRows = computed(() => result.value ? projectElectricalStandardsTable(result.value) : [])
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'mixed-status', label: 'Exact, input-dependent, and historical layers remain distinct' },
  { value: 'all-exact', label: 'Every displayed node is exact current SI' },
  { value: 'historical-current', label: '1990 values replace current SI identities' },
]
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  return `Prediction: ${predicted}. Computed network: exact defining and derived SI nodes, input-dependent calculations, and historical 1990 comparison nodes remain separately labeled.`
})

function currentInput(): ElectricalStandardsInput | null {
  if (contractError || !presetId.value) return null
  return {
    presetId: presetId.value,
    chargeCarriers: chargeCarriers.value,
    voltageV: voltageV.value,
    frequencyHz: frequencyHz.value,
  }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateElectricalStandards(input)
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The electrical standards engine could not evaluate this input.'
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
  presetId.value = input.presetId
  chargeCarriers.value = input.chargeCarriers
  voltageV.value = input.voltageV
  frequencyHz.value = input.frequencyHz
}

function resetNetwork(): void {
  if (sourceDefaults) {
    presetId.value = sourceDefaults.presetId
    chargeCarriers.value = sourceDefaults.chargeCarriers
    voltageV.value = sourceDefaults.voltageV
  }
  if (sourceDefaults) frequencyHz.value = sourceDefaults.frequencyHz
  prediction.value = ''
  recordedPrediction.value = ''
  predictionStale.value = false
  revealed.value = false
  result.value = null
  evaluationError.value = null
}

function position(nodeId: ElectricalNodeId): readonly [number, number] {
  return NODE_POSITIONS[nodeId]
}

function nodeClass(node: ElectricalNetworkNode): Record<string, boolean> {
  const active = node.id === 'h' || node.id === 'e'
    || (presetId.value === 'single-electron' && ['eV', 'carrier-charge', 'carrier-energy'].includes(node.id))
    || (presetId.value === 'josephson' && ['KJ', 'Phi0', 'carrier-charge', 'carrier-energy', 'josephson-frequency', 'josephson-voltage'].includes(node.id))
    || (presetId.value === 'hall' && ['RK', 'G0', 'carrier-charge'].includes(node.id))
  return { 'is-active': active, 'is-historical': node.status === 'historical-conventional-1990', 'is-computed': node.status === 'computed' }
}

function comparisonText(nodeId: ElectricalNodeId): string {
  if (!result.value) return ''
  const comparison = result.value.historicalComparisons.find(({ historicalNodeId, currentNodeId }) => historicalNodeId === nodeId || currentNodeId === nodeId)
  if (!comparison) return ''
  return `${comparison.partsPerMillion.toExponential(6)} ppm, (1990 conventional - current exact SI) / current exact SI`
}

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}

watch([presetId, chargeCarriers, voltageV, frequencyHz], () => {
  if (presetId.value !== 'josephson' && frequencyHz.value !== 0) {
    frequencyHz.value = 0
    return
  }
  if (presetId.value === 'josephson' && frequencyHz.value === 0) {
    frequencyHz.value = josephsonPresetFrequency
    return
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

<template lang="pug">
section(class="dimension-builder electrical-standards", data-testid="electrical-standards-network", :aria-labelledby="`${simulation.id}-title`")
  header(class="dimension-builder-heading")
    p(class="dimension-builder-kicker") Quantum standards network
    h2(:id="`${simulation.id}-title`") {{ simulation.title }}
    p {{ simulation.question }}
  p(v-if="contractError", class="dimension-builder-error", role="alert", data-testid="electrical-standards-error")  This activity cannot run because its generated contract and electrical standards engine do not agree. {{ contractError }}
  template(v-else)
    section(class="dimension-builder-presets", aria-labelledby="electrical-presets-title")
      h3(id="electrical-presets-title") Standards paths
      ul(class="dimension-builder-preset-list")
        li(v-for="preset in simulation.presets", :key="preset.id")
          button(class="dimension-builder-preset tour-touch-target", type="button", :data-testid="`electrical-preset-${preset.id}`", @click="applyPreset(preset)") {{ preset.label }}
          p {{ preset.description }}
      p(v-if="selectedPreset", class="electrical-standards-inspection", data-testid="electrical-inspection-prompt") {{ selectedPreset.inspectionPrompt }}
    section(class="dimension-builder-controls", aria-labelledby="electrical-controls-title")
      h3(id="electrical-controls-title") Trace bounded inputs
      div(v-if="presetControl", class="dimension-builder-control", data-testid="electrical-control-preset")
        label(for="electrical-view") {{ presetControl.label }}
        select(id="electrical-view", v-model="presetId", data-testid="electrical-view")
          option(v-for="option in presetControl.options", :key="option.value", :value="option.value") {{ option.label }}
        p
          | {{ presetControl.description }} 
          span {{ presetControl.playfulPrompt }}
      div(v-if="carrierControl", class="dimension-builder-control", data-testid="electrical-control-carriers")
        label(for="electrical-carriers") {{ carrierControl.label }}
        output(for="electrical-carriers") {{ chargeCarriers }}
        input(id="electrical-carriers", v-model.number="chargeCarriers", data-testid="electrical-carriers", :type="carrierControl.type", :min="carrierControl.min", :max="carrierControl.max", :step="carrierControl.step")
        p
          | {{ carrierControl.description }} 
          span {{ carrierControl.playfulPrompt }}
      div(v-if="voltageControl", class="dimension-builder-control", data-testid="electrical-control-voltage")
        label(for="electrical-voltage") {{ voltageControl.label }}
        output(for="electrical-voltage") {{ voltageV }} V
        input(id="electrical-voltage", v-model.number="voltageV", data-testid="electrical-voltage", :type="voltageControl.type", :min="voltageControl.min", :max="voltageControl.max", :step="voltageControl.step")
        p
          | {{ voltageControl.description }} 
          span {{ voltageControl.playfulPrompt }}
      div(v-if="depth === 'technical' && frequencyControl", class="dimension-builder-control electrical-frequency-control", data-testid="electrical-control-frequency")
        label(for="electrical-frequency") {{ frequencyControl.label }}
        output(for="electrical-frequency") {{ presetId === 'josephson' ? `${frequencyHz.toExponential(6)} Hz` : '0 Hz (inactive)' }}
        input(id="electrical-frequency", v-model.number="frequencyHz", data-testid="electrical-frequency", :type="frequencyControl.type", :min="frequencyControl.min", :max="frequencyControl.max", :step="frequencyControl.step", :disabled="presetId !== 'josephson'")
        p
          | {{ frequencyControl.description }} 
          span(v-if="presetId !== 'josephson'") This complete input is currently inactive and fixed at zero.
    fieldset(class="dimension-builder-prediction", data-testid="electrical-prediction-gate")
      legend Predict before revealing the network
      p {{ simulation.predictionPrompt }}
      label(v-for="option in predictionOptions", :key="option.value", class="dimension-builder-prediction-option tour-touch-target")
        input(v-model="prediction", type="radio", name="electrical-standards-prediction", :value="option.value", :data-testid="`electrical-prediction-${option.value}`")
        span {{ option.label }}
    div(class="dimension-builder-actions")
      button(class="dimension-builder-reveal tour-touch-target", type="button", data-testid="reveal-electrical-standards", :disabled="!prediction", @click="revealResult") Reveal network
      button(class="tour-touch-target", type="button", data-testid="reset-electrical-standards", @click="resetNetwork") Reset
    p(v-if="evaluationError", class="dimension-builder-error", role="alert") {{ evaluationError }}
    p(v-if="predictionStale", class="dimension-builder-caveat", aria-live="polite", data-testid="electrical-prediction-stale")  The standards inputs changed. The live network has updated, but the previous prediction is stale and is not compared with this result. 
    section(v-if="revealed && result", class="dimension-builder-stage electrical-standards-stage", data-testid="electrical-standards-result", aria-labelledby="electrical-result-title")
      header
        p Selected path
        h3(id="electrical-result-title") {{ presetControl?.options.find(({ value }) => value === result.presetId)?.label }}
        p(data-testid="electrical-charge-result") q = {{ result.totalChargeC.toExponential(6) }} C for {{ result.chargeCarriers }} carrier{{ result.chargeCarriers === 1 ? '' : 's' }}
      svg(class="electrical-network-graphic", viewBox="0 0 90 66", role="img", aria-labelledby="electrical-svg-title electrical-svg-description", data-testid="electrical-standards-svg")
        title(id="electrical-svg-title") Electrical standards identity network
        desc(id="electrical-svg-description") Planck constant h and elementary charge e feed current exact derived SI nodes, bounded input calculations, and separately styled historical 1990 conventional comparison nodes.
        g(class="electrical-network-edges")
          template(v-for="edge in result.edges", :key="edge.id")
            line(v-for="from in edge.from", :key="`${edge.id}-${from}`", :x1="position(from)[0]", :y1="position(from)[1]", :x2="position(edge.to)[0]", :y2="position(edge.to)[1]")
              title {{ edge.equation }}. {{ edge.note }}
        g(v-for="node in result.nodes", :key="node.id", :class="['electrical-network-node', nodeClass(node)]", :transform="`translate(${position(node.id)[0]} ${position(node.id)[1]})`")
          rect(x="-7", y="-3.4", width="14", height="6.8", rx="1")
          text(text-anchor="middle", y=".8") {{ node.symbol }}
          title {{ node.label }}: {{ node.value.toExponential(6) }} {{ node.unit }}. {{ node.statusLabel }}. {{ node.note }}
      p(class="dimension-builder-comparison", data-testid="electrical-prediction-comparison") {{ predictionComparison }}
      p(class="dimension-builder-caveat", data-testid="electrical-realization-caveat")  Exact h/e identities do not make a practical Josephson or quantum Hall realization uncertainty-free. No device state, calibration certificate, plateau, filling factor, or channel count is inferred. 
      dl(class="dimension-builder-readout", data-testid="electrical-direction-results")
        dt {{ simulation.outputSchema.find(({ id }) => id === 'josephsonFrequencyFromVoltageHz')?.label }}
        dd {{ result.josephsonFrequencyFromVoltageHz === null ? 'Not computed outside the Josephson view' : `${result.josephsonFrequencyFromVoltageHz.toExponential(6)} Hz` }}
        dt {{ simulation.outputSchema.find(({ id }) => id === 'josephsonVoltageFromFrequencyV')?.label }}
        dd {{ result.josephsonVoltageFromFrequencyV === null ? 'Not computed outside the Josephson view' : `${result.josephsonVoltageFromFrequencyV.toExponential(6)} V` }}
        dt {{ simulation.outputSchema.find(({ id }) => id === 'networkStatus')?.label }}
        dd(data-testid="electrical-network-status") {{ result.networkStatus }}
      div(class="dimension-builder-table-wrap")
        table(data-testid="electrical-standards-table")
          caption Accessible electrical network nodes, including current exact SI and historical 1990 comparisons
          thead
            tr
              th(scope="col") Node
              th(scope="col") Value
              th(scope="col") Status
              th(scope="col") Historical comparison
              th(scope="col") Boundary note
          tbody
            tr(v-for="row in tableRows", :key="row.id")
              th(scope="row") {{ row.label }} ({{ row.symbol }})
              td {{ row.value.toExponential(6) }} {{ row.unit }}
              td {{ row.statusLabel }}
              td {{ comparisonText(row.id) || 'Not applicable' }}
              td {{ row.note }}
      section(class="dimension-builder-finding electrical-standards-finding", aria-labelledby="electrical-finding-title", data-testid="electrical-standards-finding")
        h3(id="electrical-finding-title") Live finding
        p(role="status", aria-live="polite") {{ result.finding.establishes }}
        dl
          dt Runtime result status
          dd(data-testid="electrical-result-status") {{ result.finding.resultStatus.toUpperCase() }}
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
        h4 Caveats
        ul
          li(v-for="caveat in result.finding.caveats", :key="caveat") {{ caveat }}
        h4 Evidence references
        ul(data-testid="electrical-evidence-refs")
          li(v-for="evidenceRef in result.finding.evidenceRefs", :key="evidenceRef")
            a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
        p(data-testid="electrical-validation-boundary") No inferred residual, empirical device comparison, practical-realization validation, or theory validation is claimed by this identity network.
    section(v-if="depth === 'technical'", class="dimension-builder-disclosure", data-testid="electrical-technical-disclosure")
      h3 Technical assumptions and realization boundary
      ul
        li(v-for="assumption in simulation.assumptions", :key="assumption") {{ assumption }}
      p {{ simulation.numericalMethod?.description }}
      p {{ simulation.visualization.reducedMotionBehavior }}
</template>

<style scoped>
.electrical-standards-inspection { padding: 1rem; color: var(--paper-dim); font-family: var(--mono); font-size: .875rem; }
.electrical-frequency-control { grid-column: 1 / -1; }
.electrical-standards-stage { grid-column: 1 / -1; }
.electrical-network-graphic { width: 100%; min-height: 340px; margin: 1.5rem 0; color: var(--paper); border: 1px solid var(--rule-bright); background: var(--ink-1); }
.electrical-network-edges line { stroke: var(--rule-bright); stroke-width: .35; }
.electrical-network-node rect { fill: var(--ink-0); stroke: var(--paper-dim); stroke-width: .4; }
.electrical-network-node text { fill: currentColor; font-family: var(--mono); font-size: 2.2px; }
.electrical-network-node.is-active rect { stroke: var(--cyan); stroke-width: .9; }
.electrical-network-node.is-computed rect { fill: color-mix(in srgb, var(--cyan) 18%, var(--ink-0)); }
.electrical-network-node.is-historical rect { stroke: var(--amber); stroke-dasharray: 1 1; }
.electrical-standards-finding dl { display: grid; grid-template-columns: minmax(150px, .4fr) minmax(0, 1.6fr); gap: .25rem 1rem; }
.electrical-standards-finding dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 420px) { .electrical-standards :deep(.dimension-builder-preset), .electrical-standards :deep(button), .electrical-standards :deep(select), .electrical-standards :deep(input:not([type='radio'])) { min-height: 44px; }.electrical-standards :deep(.dimension-builder-controls) { grid-template-columns: minmax(0, 1fr); } }
@media (forced-colors: active) { .electrical-network-graphic { forced-color-adjust: auto; }.electrical-network-node rect { fill: Canvas; stroke: CanvasText; }.electrical-network-node.is-active rect { fill: Highlight; stroke: HighlightText; }.electrical-network-edges line { stroke: CanvasText; } }
</style>
