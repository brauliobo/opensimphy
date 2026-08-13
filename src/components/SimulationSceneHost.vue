<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { diagnostics } from '../simulation/diagnostics'
import { SceneHost, type SceneSelection } from '../simulation/scene-host'
import type { SimulationScene } from '../simulation/scene'

const props = defineProps<{ scene?: SimulationScene }>()
const emit = defineEmits<{ select: [selection: SceneSelection] }>()
const target = ref<HTMLElement>()
const clipped = ref(false)
const explosion = ref(0)
const measurement = ref<number>()
const renderRevision = ref(0)
let host: SceneHost | undefined

function applyScene(scene: SimulationScene) {
  clipped.value = false
  explosion.value = 0
  measurement.value = undefined
  host?.setScene(scene)
  host?.setClipping(false)
  host?.setExplosion(0)
}

function setClipping() {
  clipped.value = !clipped.value
  host?.setClipping(clipped.value)
  renderRevision.value++
}

function clearMeasurement() { host?.clearMeasurement() }
function sceneDebug() { return host?.renderState() }

onMounted(() => {
  host = new SceneHost(target.value!)
  host.onSelection = (selection) => emit('select', selection)
  host.onMeasurement = (distance) => { measurement.value = distance }
  if (props.scene) applyScene(props.scene)
  diagnostics().overlays++
})
watch(() => props.scene, (scene) => { if (scene) applyScene(scene) })
watch(explosion, (amount) => { host?.setExplosion(amount); renderRevision.value++ })
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
  .scene-mobile-controls(aria-label="Scene controls")
    button(type="button" data-testid="scene-fit" @click="host?.fit()") Fit
    button(type="button" data-testid="scene-clip" :aria-pressed="clipped" @click="setClipping") Section
    button(type="button" data-testid="scene-measure-clear" @click="clearMeasurement") Clear measure
    label
      span Explode
      input(v-model.number="explosion" data-testid="scene-explode" type="range" min="0" max="5" step="1")
</template>
