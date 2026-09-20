<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ALGEBRA_IDENTITIES,
  BASIS,
  BASIS_COLORS,
  cameraPose,
  evaluateCliffordField,
  formatAllCombination,
  formatPrincipalCombination,
  sceneModel,
  setSliceCoordinate,
  slicePlane,
  snapPoint,
  type CameraView,
  type LabelSet,
  type SliceAxis,
  type SnapMode,
  type SpaceMode,
  type Vec3,
} from '../../clifford-space/cliffordSpaceEngine'
import { CliffordSpaceScene } from '../../clifford-space/cliffordSpaceScene'
import type { ReadingDepth } from '../../types/tour'

defineProps<{ depth?: ReadingDepth }>()

const ORIGIN: Vec3 = Object.freeze([0, 0, 0])
const CUBE_CENTER: Vec3 = Object.freeze([0.5, 0.5, 0.5])

const point = ref<Vec3>(CUBE_CENTER)
const mode = ref<SpaceMode>('tiling')
const view = ref<CameraView>('oblique')
const extent = ref(3)
const sliceAxis = ref<SliceAxis>('z')
const showPlane = ref(false)
const snapMode = ref<SnapMode>('nothing')
const labelSet = ref<LabelSet>('inside-dodecahedron')
const showLabels = ref(false)
const showGrid = ref(true)
const showDodecahedron = ref(true)
const orthographic = ref(true)
const showDots = ref(true)
const canvas = ref<HTMLElement>()
let host: CliffordSpaceScene | undefined

const field = computed(() => evaluateCliffordField(point.value[0], point.value[1], point.value[2]))
const principal = computed(() => formatPrincipalCombination(field.value))
const combination = computed(() => formatAllCombination(field.value))
const plane = computed(() => slicePlane(point.value, sliceAxis.value, Math.max(6, extent.value * 2 + 2)))

const spaceModes = Object.freeze([
  Object.freeze({ value: 'whole-space' as const, label: 'Whole space, with the dodecahedron' }),
  Object.freeze({ value: 'one-cube' as const,    label: 'One cube, 0 to 1' }),
  Object.freeze({ value: 'tiling' as const,      label: 'Tiling of space' }),
])

const cameraViews = Object.freeze([
  Object.freeze({ value: 'oblique' as const, label: 'Oblique' }),
  Object.freeze({ value: 'x' as const,       label: 'Along x' }),
  Object.freeze({ value: 'y' as const,       label: 'Along y' }),
  Object.freeze({ value: 'z' as const,       label: 'Along z' }),
])

function barStyle(value: number, color: string): { width: string; left: string; background: string } {
  const width = Math.min(50, Math.abs(value) * 50)
  return {
    width:      `${width}%`,
    left:       value >= 0 ? '50%' : `${50 - width}%`,
    background: color,
  }
}

function formatSigned(value: number): string {
  return value.toFixed(4)
}

function goOrigin(): void {
  point.value = ORIGIN
  pushCamera()
}

function chooseMode(value: SpaceMode): void {
  mode.value = value
}

function chooseView(value: CameraView): void {
  view.value = value
}

function applyHit(hit: Vec3): void {
  const axis = sliceAxis.value
  const next = axis === 'x'
    ? setSliceCoordinate(point.value, axis, hit[1], hit[2])
    : axis === 'y'
      ? setSliceCoordinate(point.value, axis, hit[0], hit[2])
      : setSliceCoordinate(point.value, axis, hit[0], hit[1])
  point.value = snapPoint(next, snapMode.value)
}

function pushModel(): void {
  if (!host) return
  const model = sceneModel({
    point:            point.value,
    mode:             mode.value,
    extent:           extent.value,
    showGrid:         showGrid.value,
    showDodecahedron: showDodecahedron.value,
    showDots:         showDots.value,
    labels:           labelSet.value,
  })
  host.setModel({
    cube:         model.cube,
    dodecahedron: model.dodecahedron,
    honeycomb:    model.honeycomb,
    families:     model.families,
    dots:         model.dots,
    labels:       model.labels,
    point:        point.value,
    sliceAxis:    sliceAxis.value,
    showPlane:    showPlane.value,
    showLabels:   showLabels.value,
    showCube:     showGrid.value,
    plane:        plane.value,
  })
}

function pushCamera(): void {
  host?.setCamera(cameraPose(view.value, CUBE_CENTER))
}

function pushPerspective(): void {
  host?.setPerspective(!orthographic.value)
}

onMounted(() => {
  host = new CliffordSpaceScene(canvas.value!)
  host.onPick = applyHit
  pushModel()
  pushCamera()
  pushPerspective()
})

watch([point, mode, extent, showGrid, showDodecahedron, showDots, labelSet, showLabels, showPlane, sliceAxis], pushModel)
watch(view, pushCamera)
watch(orthographic, pushPerspective)

onBeforeUnmount(() => {
  host?.dispose()
  host = undefined
})
</script>

<template lang="pug">
article.quantum-instrument.clifford-space-instrument(data-testid="clifford-space-instrument")
  header.quantum-instrument__header
    p.quantum-kicker Instrument 01 / space tiling
    h3 Cube, rhombic dodecahedron, and the eight Cl(3) blades
    p Click the picture to move the probe. The right-hand bars are the field at that point. Parallel projection is the default, so the honeycomb edges stay parallel.

  .clifford-space-viewer
    aside.clifford-space-controls
      label.clifford-field
        span Range of cells
        input(
          v-model.number="extent"
          type="range"
          min="1"
          max="5"
          step="1"
          data-testid="tiling-extent"
        )
        output {{ extent }}
      button.clifford-origin(type="button" data-testid="go-origin" @click="goOrigin") Go to the origin
      fieldset.clifford-radios(data-testid="slice-axis")
        legend Slice plane through the point
        label(v-for="axis in ['x', 'y', 'z']" :key="axis")
          input(v-model="sliceAxis" type="radio" name="clifford-slice-axis" :value="axis")
          span {{ axis }}
      label.clifford-check
        input(v-model="showPlane" type="checkbox" data-testid="show-plane")
        span Show that plane
      label.clifford-field
        span Snap clicks to
        select(v-model="snapMode" data-testid="snap-mode")
          option(value="nothing") Nothing
          option(value="integer") Integer points
          option(value="half-points") Half-points
      label.clifford-field
        span Labels at integer points
        select(v-model="labelSet" data-testid="label-set")
          option(value="none") Nothing
          option(value="cube-corners") Cube corners (8)
          option(value="inside-dodecahedron") Inside the dodecahedron (33)
      label.clifford-check
        input(v-model="showLabels" type="checkbox" data-testid="show-labels")
        span Show the labels in the picture
      label.clifford-check
        input(v-model="showGrid" type="checkbox" data-testid="show-grid")
        span Show the unit grid and cube
      label.clifford-check
        input(v-model="showDodecahedron" type="checkbox" data-testid="show-dodecahedron")
        span The rhombic dodecahedron
      label.clifford-check
        input(v-model="orthographic" type="checkbox" data-testid="orthographic")
        span No perspective, so parallel lines stay parallel
      label.clifford-check
        input(v-model="showDots" type="checkbox" data-testid="show-dots")
        span Dots at the integer points

    .clifford-space-stage
      .clifford-tabs(role="tablist" aria-label="Space mode" data-testid="space-mode")
        button(
          v-for="item in spaceModes"
          :key="item.value"
          type="button"
          role="tab"
          :value="item.value"
          :class="{ 'is-selected': mode === item.value }"
          :aria-selected="mode === item.value"
          @click="chooseMode(item.value)"
        ) {{ item.label }}
      .clifford-tabs(role="tablist" aria-label="Camera" data-testid="camera-view")
        button(
          v-for="item in cameraViews"
          :key="item.value"
          type="button"
          role="tab"
          :value="item.value"
          :class="{ 'is-selected': view === item.value }"
          :aria-selected="view === item.value"
          @click="chooseView(item.value)"
        ) {{ item.label }}
      .clifford-canvas(ref="canvas" data-testid="clifford-canvas")

    aside.clifford-space-readout
      p.eyebrow Principal combination
      h4(data-testid="principal-combination") {{ principal }}
      p.clifford-all {{ combination }}
      .clifford-basis-list
        .clifford-basis-bar(
          v-for="spec in BASIS"
          :key="spec.name"
          :data-testid="`basis-bar-${spec.name}`"
        )
          span.clifford-basis-bar__name(:style="{ color: BASIS_COLORS[spec.name] }") {{ spec.name }}
          span.clifford-basis-bar__track
            span.clifford-basis-bar__fill(:style="barStyle(field.components[spec.name], BASIS_COLORS[spec.name])")
          span.clifford-basis-bar__value {{ formatSigned(field.components[spec.name]) }}
      ul.clifford-formulas
        li(v-for="spec in BASIS" :key="spec.formula")
          span(:style="{ color: BASIS_COLORS[spec.name] }") {{ spec.name }}
          |  = {{ spec.formula }}
      ul.clifford-identities
        li(v-for="identity in ALGEBRA_IDENTITIES" :key="identity") {{ identity }}
      p.clifford-norm(data-testid="basis-norm") |0| = {{ field.norm.toFixed(4) }}
      p.quantum-boundary The eight-component Euclidean norm is the whole-system conservation. Two large blades are an apparent readout. This reconstruction does not validate a physical field theory.
</template>
