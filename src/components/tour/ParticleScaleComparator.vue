<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  evaluateParticleScale,
  PARTICLE_SCALE_BOUNDS,
  PARTICLE_SCALE_CATALOG,
  PARTICLE_SCALE_IDS,
  projectParticleScaleTable,
  type ParticleScaleId,
  type ParticleScaleInput,
  type ParticleScaleResult,
} from '../../tour/particleScaleEngine'
import type { ReadingDepth, TourControl, TourGeneratedSimulation, TourPreset, TourSelectControl } from '../../types/tour'

type NumericControl = Extract<TourControl, { type: 'range' | 'number' }>
type Prediction = '' | 'mass-derived' | 'state-derived' | 'all-scales'

const props = defineProps<{
  simulation: TourGeneratedSimulation
  depth: ReadingDepth
  initialPresetId?: string
}>()

const emit = defineEmits<{
  evaluated: [output: ParticleScaleResult]
}>()

const EXPECTED_REVISION = Object.freeze({
  contentRevision: '2026-07-27',
  modelRevision: 'free-particle-mass-momentum-scales-1',
  implementationRevision: 'tour-particle-scale-engine-v1',
})
const EXPECTED_PREDICTION_PROMPT = 'Choose one particle and predict which outputs change when its momentum multiplier changes while its catalog mass stays fixed.'
const EXPECTED_COMPATIBILITY_KEY = '2218016a97bd050646f64ece70e33e1753e56cdca87e1b97576d674b5b69db43'
const EXPECTED_PARTICLE_OPTIONS = Object.freeze([
  { value: 'electron', label: 'Electron' },
  { value: 'muon', label: 'Muon' },
  { value: 'proton', label: 'Proton' },
  { value: 'neutron', label: 'Neutron' },
] as const)
const EXPECTED_PRESETS = Object.freeze([
  { id: 'electron', label: 'Electron at p = m c', inputs: { particle: 'electron', momentumMultiplier: 1 } },
  { id: 'proton', label: 'Proton at p = m c', inputs: { particle: 'proton', momentumMultiplier: 1 } },
  { id: 'proton-fast', label: 'Proton at p = 2 m c', inputs: { particle: 'proton', momentumMultiplier: 2 } },
] as const)
const EXPECTED_OUTPUTS = Object.freeze([
  ['massKg', 'number', 'kg', false],
  ['massRatioToElectron', 'number', null, false],
  ['massRatioToProton', 'number', null, false],
  ['restEnergyJ', 'number', 'J', false],
  ['restEnergyEv', 'number', 'eV', false],
  ['comptonWavelengthM', 'number', 'm', false],
  ['reducedComptonWavelengthM', 'number', 'm', false],
  ['momentumKgMPerS', 'number', 'kg m s^-1', false],
  ['deBroglieWavelengthM', 'number', 'm', false],
  ['relativisticTotalEnergyJ', 'number', 'J', false],
  ['relativisticKineticEnergyJ', 'number', 'J', false],
  ['particleLabel', 'string', null, false],
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

function isParticleInput(value: Record<string, number | string | boolean>): boolean {
  return sameOrderedValues(Object.keys(value).sort(), ['momentumMultiplier', 'particle'])
    && (PARTICLE_SCALE_IDS as readonly unknown[]).includes(value.particle)
    && typeof value.momentumMultiplier === 'number'
    && Number.isFinite(value.momentumMultiplier)
}

function validateContract(simulation: TourGeneratedSimulation, initialPresetId?: string): string | null {
  if (simulation.schemaVersion !== 1 || simulation.id !== 'particle-scale-comparator') {
    return 'The simulation ID or schema version does not identify the particle-scale instrument.'
  }
  if (Object.entries(EXPECTED_REVISION).some(([key, value]) => simulation.revision[key as keyof typeof EXPECTED_REVISION] !== value)) {
    return 'The simulation revision does not match the particle-scale engine revision.'
  }
  if (simulation.predictionPrompt !== EXPECTED_PREDICTION_PROMPT) {
    return 'The generated prediction prompt does not match the fixed-mass momentum task.'
  }
  if (simulation.comparison.compatibility !== 'same-simulation-revision-and-output-schema'
    || simulation.comparison.compatibilityKey !== EXPECTED_COMPATIBILITY_KEY
    || !simulation.comparison.incompatibleBehavior.trim()) {
    return 'The generated comparison compatibility contract does not match this particle-scale revision.'
  }
  if (simulation.numericalMethod?.kind !== 'direct-evaluation' || !simulation.numericalMethod.deterministic
    || simulation.numericalMethod.implementationRef !== 'src/tour/particleScaleEngine.ts') {
    return 'The generated numerical-method contract does not identify the particle-scale engine.'
  }
  if (simulation.limits.tier !== 'immediate' || simulation.limits.maxOperations !== 1 || simulation.limits.maxDurationMs !== 16) {
    return 'The simulation does not declare the required bounded immediate runtime.'
  }
  if (simulation.visualization.kind !== 'linked-particle-scale-axes'
    || !sameOrderedValues(simulation.visualization.alternatives.map(({ type }) => type), ['text', 'table'])) {
    return 'The visualization contract does not provide the required linked-axis alternatives.'
  }

  const particleControl = selectControl(simulation, 'particle')
  const momentumControl = numericControl(simulation, 'momentumMultiplier')
  if (simulation.controls.length !== 2
    || !sameOrderedValues(simulation.controls.map(({ id }) => id), ['particle', 'momentumMultiplier'])
    || !particleControl || !momentumControl) {
    return 'The generated controls do not match the particle-scale engine inputs.'
  }
  if (particleControl.inputRole !== 'preset-selection' || particleControl.readingDepth !== 'guided' || particleControl.default !== 'electron'
    || particleControl.type !== 'select'
    || particleControl.options.length !== EXPECTED_PARTICLE_OPTIONS.length
    || EXPECTED_PARTICLE_OPTIONS.some((expected, index) => {
      const option = particleControl.options[index]
      return !option || option.value !== expected.value || option.label !== expected.label || !option.description?.trim()
    })) {
    return 'The generated particle selector does not match the bounded engine catalog.'
  }
  if (momentumControl.type !== 'range' || momentumControl.inputRole !== 'parameter' || momentumControl.readingDepth !== 'guided' || momentumControl.default !== 1
    || momentumControl.min !== PARTICLE_SCALE_BOUNDS.momentumMultiplier.min
    || momentumControl.max !== PARTICLE_SCALE_BOUNDS.momentumMultiplier.max
    || momentumControl.step !== 1e-6 || momentumControl.unit !== '1') {
    return 'The generated momentum control is outside the particle-scale engine bounds.'
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
    return 'The particle-scale preset catalog does not match the generated contract.'
  }
  for (const preset of simulation.presets) {
    if (!isParticleInput(preset.inputs)) return `Preset ${preset.id} does not provide a complete particle-scale input.`
    try {
      evaluateParticleScale({
        particle: preset.inputs.particle as ParticleScaleId,
        momentumMode: 'mass-times-c',
        momentumMultiplier: preset.inputs.momentumMultiplier as number,
      })
    } catch {
      return `Preset ${preset.id} is outside the particle-scale engine bounds.`
    }
  }
  if (simulation.outputSchema.length !== EXPECTED_OUTPUTS.length || EXPECTED_OUTPUTS.some((expected, index) => {
    const output = simulation.outputSchema[index]
    return !output || output.id !== expected[0] || output.type !== expected[1] || output.unit !== expected[2] || output.nullable !== expected[3]
  })) {
    return 'The generated output schema does not match the particle-scale result.'
  }
  if (initialPresetId && !simulation.presets.some(({ id }) => id === initialPresetId)) {
    return `Initial preset ${initialPresetId} is not declared by this simulation.`
  }
  return null
}

const contractError = validateContract(props.simulation, props.initialPresetId)
const particleControl = selectControl(props.simulation, 'particle')
const momentumControl = numericControl(props.simulation, 'momentumMultiplier')

function presetInput(preset: TourPreset | undefined): { particle: ParticleScaleId; momentumMultiplier: number } | null {
  return preset && isParticleInput(preset.inputs)
    ? { particle: preset.inputs.particle as ParticleScaleId, momentumMultiplier: preset.inputs.momentumMultiplier as number }
    : null
}

const sourceDefaults = particleControl && momentumControl
  ? { particle: particleControl.default as ParticleScaleId, momentumMultiplier: momentumControl.default }
  : null
const initialPreset = props.initialPresetId ? props.simulation.presets.find(({ id }) => id === props.initialPresetId) : undefined
const initialInput = presetInput(initialPreset) ?? sourceDefaults

const particle = ref<ParticleScaleId | ''>(initialInput?.particle ?? '')
const momentumMultiplier = ref(initialInput?.momentumMultiplier ?? Number.NaN)
const prediction = ref<Prediction>('')
const recordedPrediction = ref<Prediction>('')
const predictionStale = ref(false)
const revealed = ref(false)
const result = ref<ParticleScaleResult | null>(null)
const evaluationError = ref<string | null>(null)

const selectedPreset = computed(() => props.simulation.presets.find((preset) => {
  const input = presetInput(preset)
  return input && input.particle === particle.value && input.momentumMultiplier === momentumMultiplier.value
}) ?? null)
const selectedCatalogParticle = computed(() => PARTICLE_SCALE_CATALOG.find(({ id }) => id === particle.value) ?? null)
const scaleRows = computed(() => result.value ? projectParticleScaleTable(result.value) : [])
const predictionOptions: Array<{ value: Exclude<Prediction, ''>; label: string }> = [
  { value: 'state-derived', label: 'Only momentum-state-derived outputs' },
  { value: 'mass-derived', label: 'Only mass-derived outputs' },
  { value: 'all-scales', label: 'Every displayed scale' },
]
const predictionComparison = computed(() => {
  if (!recordedPrediction.value || predictionStale.value || !result.value) return ''
  const predicted = predictionOptions.find(({ value }) => value === recordedPrediction.value)?.label
  return `Prediction: ${predicted}. Result: changing momentum at fixed catalog mass changes the momentum-state-derived outputs, not the mass-derived outputs. ${recordedPrediction.value === 'state-derived' ? 'The two align.' : 'The two differ.'}`
})

function logPosition(value: number, min: number, max: number): number {
  const fraction = (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))
  return 154 + Math.max(0, Math.min(1, fraction)) * 420
}

const linkedMassX = computed(() => result.value
  ? logPosition(result.value.massKg, PARTICLE_SCALE_CATALOG[0].massKg, PARTICLE_SCALE_CATALOG.at(-1)!.massKg)
  : 154)
const stateWavelengthX = computed(() => result.value ? logPosition(result.value.deBroglieWavelengthM, 1e-22, 1e-6) : 154)

function formatNumber(value: number, precision = 7): string {
  return Number.isFinite(value) ? value.toPrecision(precision) : 'unavailable'
}

function currentInput(): ParticleScaleInput | null {
  if (contractError || !particle.value) return null
  return { particle: particle.value, momentumMode: 'mass-times-c', momentumMultiplier: momentumMultiplier.value }
}

function evaluateCurrentInput(): void {
  const input = currentInput()
  if (!input) return
  try {
    const output = evaluateParticleScale(input)
    result.value = output
    evaluationError.value = null
    emit('evaluated', output)
  } catch (error) {
    result.value = null
    evaluationError.value = error instanceof Error ? error.message : 'The particle-scale engine could not evaluate this input.'
  }
}

function revealResult(): void {
  if (!prediction.value || contractError) return
  revealed.value = true
  evaluateCurrentInput()
  recordedPrediction.value = prediction.value
  predictionStale.value = false
}

function assignInput(input: { particle: ParticleScaleId; momentumMultiplier: number }): void {
  particle.value = input.particle
  momentumMultiplier.value = input.momentumMultiplier
}

function applyPreset(preset: TourPreset): void {
  const input = presetInput(preset)
  if (input) assignInput(input)
}

function resetComparator(): void {
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

watch([particle, momentumMultiplier], () => {
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
  <section data-testid="particle-scale-comparator" :aria-labelledby="`${simulation.id}-title`">
    <header>
      <p>Particle scale instrument</p>
      <h2 :id="`${simulation.id}-title`">{{ simulation.title }}</h2>
      <p>{{ simulation.question }}</p>
    </header>

    <p v-if="contractError" role="alert" data-testid="particle-contract-error">
      This activity cannot run because its generated contract and particle-scale engine do not agree. {{ contractError }}
    </p>

    <template v-else>
      <section aria-labelledby="particle-presets-title">
        <h3 id="particle-presets-title">Try a generated setup</h3>
        <ul>
          <li v-for="preset in simulation.presets" :key="preset.id">
            <button class="particle-hit-target" type="button" :data-testid="`particle-preset-${preset.id}`" @click="applyPreset(preset)">{{ preset.label }}</button>
            <p>{{ preset.description }}</p>
          </li>
        </ul>
        <p v-if="selectedPreset" data-testid="particle-inspection-prompt">{{ selectedPreset.inspectionPrompt }}</p>
      </section>

      <section aria-labelledby="particle-controls-title">
        <h3 id="particle-controls-title">Select a particle and momentum state</h3>
        <div v-if="particleControl" data-testid="particle-control-particle">
          <label for="particle-choice">{{ particleControl.label }}</label>
          <select id="particle-choice" v-model="particle" class="particle-hit-target" data-testid="particle-choice" aria-describedby="particle-choice-description">
            <option v-for="option in particleControl.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <p id="particle-choice-description">{{ particleControl.description }} {{ particleControl.options.find(({ value }) => value === particle)?.description }} {{ particleControl.playfulPrompt }}</p>
        </div>
        <div v-if="momentumControl" data-testid="particle-control-momentumMultiplier">
          <label for="particle-momentum">{{ momentumControl.label }}</label>
          <input id="particle-momentum" v-model.number="momentumMultiplier" class="particle-hit-target" data-testid="particle-momentum" :type="momentumControl.type" :min="momentumControl.min" :max="momentumControl.max" :step="momentumControl.step" aria-describedby="particle-momentum-description">
          <output for="particle-momentum">{{ momentumMultiplier }}</output>
          <p id="particle-momentum-description">{{ momentumControl.description }} {{ momentumControl.playfulPrompt }}</p>
        </div>
      </section>

      <fieldset data-testid="particle-prediction-gate">
        <legend>Make a prediction before revealing the linked scales</legend>
        <p>{{ simulation.predictionPrompt }}</p>
        <label v-for="option in predictionOptions" :key="option.value" class="particle-prediction-target">
          <input v-model="prediction" type="radio" name="particle-prediction" :value="option.value" :data-testid="`particle-prediction-${option.value}`">
          {{ option.label }}
        </label>
      </fieldset>
      <button class="particle-hit-target" type="button" data-testid="reveal-particle-result" :disabled="!prediction" @click="revealResult">Reveal result</button>
      <button class="particle-hit-target" type="button" data-testid="reset-particle-comparator" @click="resetComparator">Reset</button>

      <p v-if="evaluationError" role="alert" data-testid="particle-evaluation-error">The particle-scale engine could not produce a result. {{ evaluationError }}</p>
      <p v-if="predictionStale" aria-live="polite" data-testid="particle-prediction-stale">The setup changed, so the previous prediction is not compared with this live result. Make a fresh prediction for the current setup.</p>

      <section v-if="revealed && result" data-testid="particle-result" aria-labelledby="particle-result-title">
        <h3 id="particle-result-title">Linked logarithmic particle scales</h3>
        <svg class="particle-scale-stage" viewBox="0 0 680 300" role="img" aria-labelledby="particle-svg-title particle-svg-description" data-testid="particle-svg">
          <title id="particle-svg-title">Linked logarithmic mass, energy, and wavelength axes</title>
          <desc id="particle-svg-description">{{ result.particleLabel }} catalog mass links the mass, rest-energy, and Compton axes. The separately selected momentum state sets the de Broglie wavelength marker.</desc>
          <g class="particle-mass-linked">
            <line x1="154" x2="574" y1="58" y2="58" /><text x="18" y="63">mass (kg, log)</text>
            <line x1="154" x2="574" y1="112" y2="112" /><text x="18" y="117">rest energy (J, log)</text>
            <line x1="154" x2="574" y1="166" y2="166" /><text x="18" y="171">Compton λ (m, inverse log)</text>
            <line class="particle-linked-marker" :x1="linkedMassX" :x2="linkedMassX" y1="40" y2="184" />
          </g>
          <g class="particle-state-axis">
            <line x1="154" x2="574" y1="238" y2="238" /><text x="18" y="243">de Broglie λ (m, log)</text>
            <circle class="particle-state-marker" :cx="stateWavelengthX" cy="238" r="8" />
          </g>
          <text x="154" y="284">catalog / mass-derived marker</text>
          <text x="410" y="284">momentum-state marker</text>
        </svg>
        <p data-testid="particle-text-alternative">
          {{ result.particleLabel }} ({{ selectedCatalogParticle?.composition }}): invariant mass {{ formatNumber(result.massKg) }} kg links rest energy {{ formatNumber(result.restEnergyJ) }} J and Compton wavelength {{ formatNumber(result.comptonWavelengthM) }} m. The selected p={{ formatNumber(result.momentumMultiplier) }} m c state gives de Broglie wavelength {{ formatNumber(result.deBroglieWavelengthM) }} m.
        </p>
        <dl>
          <dt>{{ outputLabel('massKg') }}</dt><dd data-testid="particle-mass">{{ formatNumber(result.massKg) }} kg</dd>
          <dt>{{ outputLabel('restEnergyEv') }}</dt><dd data-testid="particle-rest-energy">{{ formatNumber(result.restEnergyEv) }} eV</dd>
          <dt>{{ outputLabel('comptonWavelengthM') }}</dt><dd data-testid="particle-compton">{{ formatNumber(result.comptonWavelengthM) }} m</dd>
          <dt>{{ outputLabel('momentumKgMPerS') }}</dt><dd>{{ formatNumber(result.momentumKgMPerS) }} kg m s^-1</dd>
          <dt>{{ outputLabel('deBroglieWavelengthM') }}</dt><dd data-testid="particle-de-broglie">{{ formatNumber(result.deBroglieWavelengthM) }} m</dd>
          <dt>{{ outputLabel('relativisticTotalEnergyJ') }}</dt><dd>{{ formatNumber(result.relativisticTotalEnergyJ) }} J</dd>
        </dl>
        <p data-testid="particle-prediction-comparison">{{ predictionComparison }}</p>

        <table data-testid="particle-scale-table">
          <caption>Linked catalog, mass-derived, and momentum-state-derived quantities; rows are dependent representations, not independent observations</caption>
          <thead><tr><th scope="col">Quantity</th><th scope="col">Symbol</th><th scope="col">Value</th><th scope="col">Unit</th><th scope="col">Dependency</th></tr></thead>
          <tbody><tr v-for="row in scaleRows" :key="row.quantity"><th scope="row">{{ row.quantity }}</th><td>{{ row.symbol }}</td><td>{{ formatNumber(row.value) }}</td><td>{{ row.unit }}</td><td>{{ row.dependency }}</td></tr></tbody>
        </table>

        <section data-testid="particle-finding-panel" aria-labelledby="particle-finding-title">
          <h3 id="particle-finding-title">Live finding</h3>
          <p role="status" aria-live="polite">{{ result.finding.establishes }}</p>
          <dl>
            <dt>Runtime result status</dt><dd data-testid="particle-finding-status">{{ result.finding.resultStatus.toUpperCase() }}</dd>
            <dt>Claim class</dt><dd>{{ result.finding.claimClass }}</dd>
            <dt>Model origin</dt><dd>{{ result.finding.modelOrigin }}</dd>
            <dt>Method relationship</dt><dd>{{ result.finding.methodRelationship }}</dd>
            <dt>Source revision</dt><dd data-testid="particle-source-revision">{{ result.finding.sourceRevision }}</dd>
            <dt>Source locator</dt><dd>{{ result.finding.sourceLocator }}</dd>
          </dl>
          <h4>What changed</h4><p>{{ result.finding.changed }}</p>
          <h4>Why</h4><p>{{ result.finding.cause }}</p>
          <h4>Equation</h4><p><code>{{ result.finding.equation }}</code></p>
          <h4>Assumptions</h4><ul><li v-for="assumption in result.finding.assumptions" :key="assumption">{{ assumption }}</li></ul>
          <h4>Establishes</h4><p>{{ result.finding.establishes }}</p>
          <h4>Does not establish</h4><p data-testid="particle-does-not-establish">{{ result.finding.doesNotEstablish }}</p>
          <h4>Scientific caveats</h4><ul data-testid="particle-caveats"><li v-for="caveat in result.finding.caveats" :key="caveat">{{ caveat }}</li></ul>
          <h4>Evidence references</h4><ul data-testid="particle-evidence"><li v-for="evidenceRef in result.finding.evidenceRefs" :key="evidenceRef"><a :href="evidenceHref(evidenceRef)">{{ evidenceRef }}</a></li></ul>
          <p data-testid="particle-validation-boundary">No empirical particle-scale comparison or theory validation is claimed; <code>validatesTheory</code> is {{ result.finding.validatesTheory }}.</p>
        </section>
      </section>

      <section v-if="depth === 'technical'" data-testid="particle-technical-disclosure">
        <h3>Technical dependency and model boundary</h3>
        <p>The ordinary and reduced Compton values, and joule and electron-volt energies, are dependent representations. Proton and neutron entries are composite particles represented only by total catalog invariant mass.</p>
        <ul><li v-for="assumption in simulation.assumptions" :key="assumption">{{ assumption }}</li></ul>
        <h4>Generated model components</h4>
        <dl v-for="component in simulation.modelComponents" :key="component.id"><dt>{{ component.label }}</dt><dd>{{ component.description }} Source: {{ component.attribution.sourceLocator }}</dd></dl>
      </section>
    </template>
  </section>
</template>

<style scoped>
.particle-hit-target {
  min-block-size: 44px;
  min-inline-size: 44px;
  max-inline-size: 100%;
}

input.particle-hit-target[type='range'] {
  inline-size: min(100%, 24rem);
}

button.particle-hit-target {
  white-space: normal;
}

.particle-prediction-target {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 44px;
  max-inline-size: 100%;
}

.particle-scale-stage {
  display: block;
  width: min(100%, 48rem);
  min-height: 18rem;
  color: currentColor;
}

.particle-scale-stage line {
  stroke: currentColor;
  stroke-width: 1.5;
}

.particle-scale-stage .particle-linked-marker {
  stroke: #285f9e;
  stroke-width: 4;
}

.particle-state-marker {
  fill: #a13f72;
  stroke: currentColor;
  stroke-width: 2;
}

.particle-scale-stage text {
  fill: currentColor;
  font-size: 13px;
}

@media (forced-colors: active) {
  .particle-hit-target {
    border: 1px solid ButtonText;
  }

  input.particle-hit-target[type='range'] {
    accent-color: Highlight;
  }

  .particle-prediction-target {
    outline: 1px solid CanvasText;
  }

  .particle-scale-stage .particle-linked-marker {
    stroke: Highlight;
  }

  .particle-state-marker {
    fill: Highlight;
  }
}
</style>
