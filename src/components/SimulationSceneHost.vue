<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { diagnostics } from '../simulation/diagnostics'
import { SceneHost, type SceneSelection } from '../simulation/scene-host'
import type { SimulationScene } from '../simulation/scene'
import { fieldCsv, fieldPos, fieldRange, probeField, type FieldProbe, type FieldRangeMode } from '../simulation/results'

const props = defineProps<{ scene?: SimulationScene }>()
const emit = defineEmits<{ select: [selection: SceneSelection]; probe: [probe: FieldProbe] }>()
const target = ref<HTMLElement>()
const clipped = ref(false)
const clipCount = ref(0)
const explosion = ref(0)
const measurement = ref<number>()
const renderRevision = ref(0)
const fieldId = ref('')
const step = ref(0)
const rangeMode = ref<FieldRangeMode>('global')
const customMin = ref(0)
const customMax = ref(1)
const probe = ref<FieldProbe>()
const deformationScale = ref(0)
let host: SceneHost | undefined

function applyScene(scene: SimulationScene) {
  clipped.value = false
  clipCount.value = 0
  explosion.value = 0
  measurement.value = undefined
  host?.setScene(scene)
  host?.setClipping(false)
  host?.setExplosion(0)
  fieldId.value = scene.fields[0]?.id ?? ''
  step.value = 0
  rangeMode.value = 'global'
  const range = scene.fields[0]?.globalRange
  if (range) [customMin.value, customMax.value] = range
  applyResult()
  applyDeformation()
}

function setClipping() {
  clipCount.value = (clipCount.value + 1) % 4
  clipped.value = clipCount.value > 0
  const planes = [
    { normal: [1, 0, 0] as [number, number, number], constant: 0 },
    { normal: [0, 1, 0] as [number, number, number], constant: 0 },
    { normal: [0, 0, 1] as [number, number, number], constant: 0 },
  ].slice(0, clipCount.value)
  host?.setClipPlanes(planes)
  renderRevision.value++
}

function clearMeasurement() { host?.clearMeasurement() }
function sceneDebug() { return host?.renderState() }
const activeField = () => props.scene?.fields.find(({ id }) => id === fieldId.value)
function applyResult() {
  const custom: [number, number] | undefined = rangeMode.value === 'custom' ? [customMin.value, customMax.value] : undefined
  host?.setResult(fieldId.value || undefined, step.value, rangeMode.value, custom)
  renderRevision.value++
}
function selectResult() {
  step.value = 0
  const range = activeField()?.globalRange
  if (range) [customMin.value, customMax.value] = range
  applyResult()
  applyDeformation()
}
function selectStep(event: Event) { step.value = Number((event.target as HTMLSelectElement).value) }
function activeRange() {
  const field = activeField()
  return field ? fieldRange(field, step.value, rangeMode.value, rangeMode.value === 'custom' ? [customMin.value, customMax.value] : undefined) : undefined
}
function activeTimes() { return Array.from(activeField()?.times ?? []) }
function displacementFields() { return props.scene?.fields.filter(({ role, components, association }) => role === 'displacement' && components === 3 && association === 'node') ?? [] }
function applyDeformation() {
  const field = displacementFields().find(({ id }) => id === fieldId.value)
  host?.setDeformation(field?.id, step.value, field ? deformationScale.value : 0)
  renderRevision.value++
}
function download(extension: 'csv' | 'pos') {
  const scene = props.scene, field = activeField()
  if (!scene || !field) return
  const text = extension === 'csv' ? fieldCsv(scene, field) : fieldPos(scene, field)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([text], { type: extension === 'csv' ? 'text/csv' : 'text/plain' }))
  link.download = `${field.id}.${extension}`
  link.click()
  URL.revokeObjectURL(link.href)
}

onMounted(() => {
  host = new SceneHost(target.value!)
  host.onSelection = (selection) => {
    emit('select', selection)
    const scene = props.scene, field = activeField()
    if (!scene || !field) return
    try {
      if (selection.sourceTriangle < 0) return
      probe.value = probeField(scene, field, step.value, selection.sourceTriangle, selection.referencePoint)
      emit('probe', probe.value)
    } catch { probe.value = undefined }
  }
  host.onMeasurement = (distance) => { measurement.value = distance }
  if (props.scene) applyScene(props.scene)
  diagnostics().overlays++
})
watch(() => props.scene, (scene) => { if (scene) applyScene(scene) })
watch(explosion, (amount) => { host?.setExplosion(amount); renderRevision.value++ })
watch([step, rangeMode, customMin, customMax], () => { applyResult(); applyDeformation() })
watch(deformationScale, applyDeformation)
onBeforeUnmount(() => {
  diagnostics().overlays--
  host?.dispose()
})
</script>

<template lang="pug">
.scene-shell(data-testid="scene-host")
  .scene-target(ref="target")
  .scene-overlay(data-testid="scene-overlay")
    span Orbit / pan / zoom / tap faces
    strong(v-if="measurement !== undefined" data-testid="measurement-readout") {{ measurement.toFixed(3) }} mm
    output.sr-only(data-testid="viewer-render-summary" :data-revision="renderRevision") {{ JSON.stringify(sceneDebug()) }}
    strong(v-if="probe" data-testid="result-probe") {{ probe.values.map(value => value.toPrecision(6)).join(', ') }} @ t={{ probe.time }}
  .result-controls(v-if="scene?.fields.length" aria-label="Result controls")
    label
      span Field
      select(v-model="fieldId" data-testid="result-field" @change="selectResult")
        option(v-for="field in scene.fields" :key="field.id" :value="field.id") {{ field.name }} / {{ field.association }}
    label
      span Timestep
      select(:value="step" data-testid="result-step" @change="selectStep")
        option(v-for="(time, index) in activeTimes()" :key="index" :value="index") {{ activeField()?.steps[index] }} / t={{ time }}
    label
      span Range
      select(v-model="rangeMode" data-testid="result-range-mode")
        option(value="global") Global
        option(value="step") Per step
        option(value="custom") Custom
    template(v-if="rangeMode === 'custom'")
      input(v-model.number="customMin" data-testid="result-range-min" type="number")
      input(v-model.number="customMax" data-testid="result-range-max" type="number")
    output.result-legend(data-testid="result-legend")
      span {{ activeRange()?.[0] ?? '' }}
      i
      span {{ activeRange()?.[1] ?? '' }}
    button(type="button" data-testid="result-export-csv" @click="download('csv')") CSV
    button(type="button" data-testid="result-export-pos" @click="download('pos')") POS
    label(v-if="displacementFields().some(({ id }) => id === fieldId)")
      span Deformation
      input(v-model.number="deformationScale" data-testid="result-deformation" type="range" min="0" max="5" step="0.25")
  .scene-mobile-controls(aria-label="Scene controls")
    button(type="button" data-testid="scene-fit" @click="host?.fit()") Fit
    button(type="button" data-testid="scene-clip" :aria-pressed="clipped" @click="setClipping") Sections {{ clipCount }}
    button(type="button" data-testid="scene-measure-clear" @click="clearMeasurement") Clear measure
    label
      span Explode
      input(v-model.number="explosion" data-testid="scene-explode" type="range" min="0" max="5" step="1")
</template>
