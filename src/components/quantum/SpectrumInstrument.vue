<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QuantumTooltip from './QuantumTooltip.vue'
import { evaluateSpectrum, SPECTRAL_REFERENCE_LINE_COUNTS, type SpectralElement, type SpectrumResult } from '../../quantum-wave/quantumWaveEngine'
import type { ReadingDepth } from '../../types/tour'

const props = defineProps<{ depth: ReadingDepth }>()

const element = ref<SpectralElement>('hydrogen')
const upperLevel = ref(3)
const lowerLevel = ref(2)
const catalogIndex = ref(0)
const prediction = ref('')
const revealed = ref(false)
const result = ref<SpectrumResult | null>(null)
const stale = ref(false)
const error = ref('')

const lowerMaximum = computed(() => element.value === 'hydrogen' ? Math.max(1, upperLevel.value - 1) : 7)
const catalogMaximum = computed(() => element.value === 'hydrogen'
  ? 0
  : (element.value === 'sodium' ? SPECTRAL_REFERENCE_LINE_COUNTS.sodium : SPECTRAL_REFERENCE_LINE_COUNTS.calcium) - 1)
const predictionChoices = computed(() => element.value === 'hydrogen'
  ? [
      { value: 'longer', label: 'Longer' },
      { value: 'shorter', label: 'Shorter' },
      { value: 'unchanged', label: 'Unchanged' },
    ]
  : [
      { value: 'discrete', label: 'Discrete lines' },
      { value: 'continuous', label: 'A continuum' },
    ])
const predictionPrompt = computed(() => element.value === 'hydrogen'
  ? 'For hydrogen, if the upper level increases while the lower level stays fixed, will the photon wavelength be longer, shorter, or unchanged?'
  : 'For this compact reference catalog, will the element contribute discrete signature lines or a continuous spectrum?')
const predictionComparison = computed(() => {
  if (!result.value) return ''
  const predicted = prediction.value || 'no prediction recorded'
  if (element.value !== 'hydrogen') return `Prediction: ${predicted}. The compact ${element.value} catalog contains discrete reference lines; it is not a continuum model.`
  if (upperLevel.value >= 8) return `Prediction: ${predicted}. The upper-level control is at its bounded maximum, so no higher comparison is available.`
  const comparisonUpper = upperLevel.value + 1
  const comparison = evaluateSpectrum({ element: 'hydrogen', upperLevel: comparisonUpper, lowerLevel: lowerLevel.value }).selected
  const direction = comparison.wavelengthNm < result.value.selected.wavelengthNm ? 'shorter' : 'longer'
  return `Prediction: ${predicted}. Raising n from ${upperLevel.value} to ${comparisonUpper} changes the model wavelength from ${format(result.value.selected.wavelengthNm, 6)} nm to ${format(comparison.wavelengthNm, 6)} nm: ${direction}.`
})

function levelY(n: number): number {
  return 250 - 180 * (1 - 1 / n ** 2)
}

function format(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return 'unavailable'
  if (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3) return value.toExponential(digits - 1)
  return Number(value.toPrecision(digits)).toString()
}

function spectrumX(wavelengthNm: number): number {
  const lines = result.value?.lines ?? []
  const minimum = Math.log10(Math.min(...lines.map(({ wavelengthNm: value }) => value), 380))
  const maximum = Math.log10(Math.max(...lines.map(({ wavelengthNm: value }) => value), 700))
  return 382 + (Math.log10(wavelengthNm) - minimum) / (maximum - minimum) * 340
}

function evaluate(): void {
  try {
    result.value = evaluateSpectrum({ element: element.value, upperLevel: upperLevel.value, lowerLevel: lowerLevel.value, catalogIndex: catalogIndex.value })
    error.value = ''
  } catch (reason) {
    result.value = null
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function reveal(): void {
  if (!prediction.value) return
  revealed.value = true
  stale.value = false
  evaluate()
}

function reset(): void {
  element.value = 'hydrogen'
  upperLevel.value = 3
  lowerLevel.value = 2
  catalogIndex.value = 0
  prediction.value = ''
  revealed.value = false
  stale.value = false
  result.value = null
  error.value = ''
}

watch(upperLevel, (value) => {
  if (lowerLevel.value >= value && element.value === 'hydrogen') lowerLevel.value = Math.max(1, value - 1)
})
watch(element, () => {
  catalogIndex.value = 0
  if (element.value === 'hydrogen') {
    upperLevel.value = Math.max(3, upperLevel.value)
    lowerLevel.value = Math.min(lowerLevel.value, upperLevel.value - 1)
  }
})
watch([element, upperLevel, lowerLevel, catalogIndex], () => {
  prediction.value = ''
  if (revealed.value) {
    stale.value = true
    result.value = null
    error.value = ''
  }
})
</script>

<template lang="pug">
article.quantum-instrument.spectrum-instrument(data-testid="quantum-spectrum-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 01 / spectral lines
    h3 See the atom leave a line-shaped clue
    p A spectrometer does not show an electron orbit. It shows wavelengths. Use a simple #[QuantumTooltip(term="energy level" plain="One allowed model energy for a bound system." technical="The energy eigenvalue of a declared Hamiltonian model." :depth="props.depth")] model to connect a level difference to a photon.

  .quantum-controls.quantum-controls--three
    label
      span Element signature
      select(v-model="element" data-testid="spectrum-element")
        option(value="hydrogen") Hydrogen-like
        option(value="sodium") Sodium reference
        option(value="calcium") Calcium reference
      small Hydrogen is calculated from the Rydberg relation. Sodium and calcium use compact reference line catalogs.
    label(v-if="element === 'hydrogen'")
      span Upper level n
      input(v-model.number="upperLevel" type="range" min="2" max="8" step="1" data-testid="spectrum-upper")
      output {{ upperLevel }}
    label(v-if="element === 'hydrogen'")
      span Lower level n
      input(v-model.number="lowerLevel" type="range" min="1" :max="lowerMaximum" step="1" data-testid="spectrum-lower")
      output {{ lowerLevel }}
    label(v-else)
      span Catalog line
      input(v-model.number="catalogIndex" type="range" min="0" :max="catalogMaximum" step="1" data-testid="spectrum-catalog-index")
      output {{ catalogIndex + 1 }} / {{ catalogMaximum + 1 }}

  fieldset.quantum-prediction(data-testid="spectrum-prediction")
    legend Predict before revealing
    p {{ predictionPrompt }}
    label(v-for="choice in predictionChoices" :key="choice.value")
      input(v-model="prediction" type="radio" :value="choice.value" name="spectrum-prediction")
      |  {{ choice.label }}
  .quantum-actions
    button(type="button" :disabled="!prediction" data-testid="spectrum-reveal" @click="reveal") Reveal line
    button(type="button" data-testid="spectrum-reset" @click="reset") Reset
  p.quantum-error(v-if="error" role="alert") {{ error }}
  p.quantum-stale(v-if="stale" aria-live="polite") The controls changed. Make a new prediction to compare the new line.

  section.quantum-result(v-if="revealed && result" data-testid="spectrum-result")
    figure
      svg(viewBox="0 0 760 330" role="img" aria-labelledby="spectrum-title spectrum-description")
        title#spectrum-title Energy levels and a spectral line
        desc#spectrum-description A downward transition from the selected upper level to the selected lower level, with reference spectral lines below.
        template(v-if="result.element === 'hydrogen'")
          g(v-for="level in result.levels" :key="level.n")
            line.spectrum-level(x1="70" x2="300" :y1="levelY(level.n)" :y2="levelY(level.n)")
            text(x="20" :y="levelY(level.n) + 4") n={{ level.n }}
        line.spectrum-transition(v-if="result.element === 'hydrogen'" x1="220" x2="220" :y1="levelY(result.upperLevel)" :y2="levelY(result.lowerLevel)" marker-end="url(#spectrum-arrow)")
        defs
          marker#spectrum-arrow(markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto")
            path(d="M0,0 L8,4 L0,8 z")
        text(x="70" y="285") {{ result.element === 'hydrogen' ? 'energy-level model' : 'reference catalog' }}
        line.spectrum-axis(x1="380" x2="730" y1="250" y2="250")
        g(v-for="(line, index) in result.lines" :key="`${line.label}-${index}`")
          line.spectrum-line(:style="{ stroke: line.color }" :x1="spectrumX(line.wavelengthNm)" :x2="spectrumX(line.wavelengthNm)" y1="180" y2="250")
          text(v-if="index < 5" :x="spectrumX(line.wavelengthNm)" y="270" text-anchor="middle") {{ line.wavelengthNm.toFixed(0) }}
        text(x="555" y="310" text-anchor="middle") wavelength / nm (log-positioned)
      figcaption Selected line: #[strong {{ result.selected.label }}], {{ format(result.selected.wavelengthNm, 6) }} nm, {{ format(result.selected.frequencyHz, 5) }} Hz, {{ format(result.selected.energyEv, 5) }} eV.

    p.quantum-finding(role="status") {{ result.finding }}
    p.quantum-prediction-result(v-if="predictionComparison") {{ predictionComparison }}
    table
      caption Line table: calculated hydrogen-like lines or compact reference lines
      thead
        tr
          th Line
          th Wavelength (nm)
          th Frequency (Hz)
          th Energy (eV)
      tbody
        tr(v-for="line in result.lines" :key="line.label")
          th(scope="row") {{ line.label }}
          td {{ format(line.wavelengthNm, 6) }}
          td {{ format(line.frequencyHz, 5) }}
          td {{ format(line.energyEv, 5) }}
    p.quantum-boundary Computed here: a model mapping. It does not identify a unique atom, line strength, selection rule, detector calibration, or empirical validation.
</template>

<style scoped>
.spectrum-level,
.spectrum-axis { stroke: currentColor; stroke-width: 1.5; }
.spectrum-transition,
.spectrum-line { stroke-width: 3; }
.spectrum-transition { stroke: var(--red); }
.spectrum-level-stage path { fill: var(--red); }
.spectrum-instrument svg { display: block; width: 100%; height: auto; margin-top: 1.5rem; border: 1px solid var(--rule-bright); background: var(--ink-0); }
.spectrum-instrument svg text { fill: currentColor; font-size: 12px; }
</style>
