<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { WallResult } from '../composables/atlasEngine'

const props = defineProps<{ result: WallResult }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const selected = ref<{ row: number; column: number; value: string | number | null } | null>(null)
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
const cssWidth = 960
const cssHeight = computed(() => Math.max(280, Math.min(680, props.result.depth * 12)))

function numeric(value: string | number | null): number {
  if (value === null) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return Math.sign(parsed) * Number.MAX_VALUE
  return parsed
}

function color(value: string | number | null): string {
  const numberValue = numeric(value)
  if (props.result.mode === 'zero_windows') return numberValue === 1 ? '#63cbd1' : '#22282b'
  if (props.result.mode === 'mod') {
    const range = Math.max(1, props.result.max - props.result.min)
    const ratio = (numberValue - props.result.min) / range
    return `hsl(${Math.round(30 + ratio * 160)} 58% ${Math.round(30 + ratio * 32)}%)`
  }
  const range = Math.max(Math.abs(props.result.min), Math.abs(props.result.max), 1)
  const ratio = Math.max(-1, Math.min(1, numberValue / range))
  if (ratio < 0) return `rgb(${Math.round(45 + Math.abs(ratio) * 45)} ${Math.round(92 + Math.abs(ratio) * 100)} ${Math.round(102 + Math.abs(ratio) * 105)})`
  return `rgb(${Math.round(74 + ratio * 166)} ${Math.round(64 + ratio * 115)} ${Math.round(42 + ratio * 48)})`
}

async function draw(): Promise<void> {
  await nextTick()
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return
  const height = cssHeight.value
  element.width = cssWidth * pixelRatio
  element.height = height * pixelRatio
  element.style.aspectRatio = `${cssWidth} / ${height}`
  context.scale(pixelRatio, pixelRatio)
  context.fillStyle = '#111315'
  context.fillRect(0, 0, cssWidth, height)
  const rowHeight = height / props.result.values.length
  props.result.values.forEach((row, rowIndex) => {
    const columnWidth = cssWidth / Math.max(row.length, 1)
    row.forEach((value, columnIndex) => {
      context.fillStyle = color(value)
      context.fillRect(columnIndex * columnWidth, rowIndex * rowHeight, Math.ceil(columnWidth), Math.ceil(rowHeight))
    })
  })
}

function selectCell(event: MouseEvent): void {
  const element = canvas.value
  if (!element || props.result.values.length === 0) return
  const bounds = element.getBoundingClientRect()
  const row = Math.min(props.result.values.length - 1, Math.max(0, Math.floor((event.offsetY / bounds.height) * props.result.values.length)))
  const values = props.result.values[row] ?? []
  const column = Math.min(values.length - 1, Math.max(0, Math.floor((event.offsetX / bounds.width) * values.length)))
  selected.value = { row, column, value: values[column] ?? null }
}

watch(() => props.result, draw, { deep: true })
onMounted(draw)
</script>

<template lang="pug">
.wall-figure
  .wall-canvas-wrap
    canvas(
      ref="canvas"
      data-testid="wall-canvas"
      tabindex="0"
      role="img"
      :aria-label="`Number wall, ${result.depth} rows by ${result.width} columns`"
      @click="selectCell"
    )
  .wall-legend
    span {{ result.min }}
    i(aria-hidden="true")
    span {{ result.max }}
    span Zero cells: {{ result.zeroCount }}
  output.cell-readout(aria-live="polite")
    template(v-if="selected") Cell [{{ selected.row }}, {{ selected.column }}] = {{ selected.value }}
    template(v-else) Select a cell to inspect its exact value.
</template>
