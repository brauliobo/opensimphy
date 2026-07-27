<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import type { PlotFigure } from '../types/plot'

function unwrapVueProxies<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value

  const raw = toRaw(value)
  const cached = seen.get(raw as object)
  if (cached) return cached as T

  if (Array.isArray(raw)) {
    const unwrapped = new Array<unknown>(raw.length)
    seen.set(raw, unwrapped)
    raw.forEach((item, index) => {
      unwrapped[index] = unwrapVueProxies(item, seen)
    })
    return unwrapped as T
  }

  const prototype = Object.getPrototypeOf(raw)
  if (prototype !== Object.prototype && prototype !== null) return raw

  const unwrapped = Object.create(prototype) as Record<string, unknown>
  seen.set(raw as object, unwrapped)
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    unwrapped[key] = unwrapVueProxies(item, seen)
  }
  return unwrapped as T
}

const props = withDefaults(defineProps<{
  figure: PlotFigure
  label: string
  testId?: string
}>(), { testId: 'plot-ready' })

const emit = defineEmits<{ ready: []; error: [reason: Error] }>()
const target = ref<HTMLDivElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
let plotly: typeof import('plotly.js-dist-min').default | null = null
let renderGeneration = 0
let mounted = false
let unmounted = false
const plottedTargets = new Set<HTMLDivElement>()

function isCurrentRender(generation: number, renderTarget: HTMLDivElement): boolean {
  return mounted && !unmounted && generation === renderGeneration && target.value === renderTarget
}

function purgeTarget(currentPlotly: typeof import('plotly.js-dist-min').default, renderTarget: HTMLDivElement): void {
  if (!plottedTargets.delete(renderTarget)) return
  currentPlotly.purge(renderTarget)
}

function purgeDetachedTarget(currentPlotly: typeof import('plotly.js-dist-min').default, renderTarget: HTMLDivElement): void {
  if (unmounted || target.value !== renderTarget) purgeTarget(currentPlotly, renderTarget)
}

async function render(): Promise<void> {
  const renderTarget = target.value
  if (!mounted || unmounted || !renderTarget) return

  const generation = ++renderGeneration
  status.value = 'loading'
  let currentPlotly = plotly
  try {
    const figure = structuredClone(unwrapVueProxies(props.figure))
    if (!currentPlotly) {
      currentPlotly = (await import('plotly.js-dist-min')).default
      plotly ??= currentPlotly
      if (!isCurrentRender(generation, renderTarget)) {
        purgeDetachedTarget(currentPlotly, renderTarget)
        return
      }
    }

    await nextTick()
    if (!isCurrentRender(generation, renderTarget)) {
      purgeDetachedTarget(currentPlotly, renderTarget)
      return
    }

    for (const plottedTarget of plottedTargets) {
      if (plottedTarget !== renderTarget) purgeTarget(currentPlotly, plottedTarget)
    }
    plottedTargets.add(renderTarget)
    const reaction = currentPlotly.react(
      renderTarget,
      figure.data,
      {
        autosize: true,
        paper_bgcolor: '#15191b',
        plot_bgcolor: '#15191b',
        font: { color: '#d8d1bf', family: 'ui-monospace, SFMono-Regular, Menlo, monospace', size: 11 },
        margin: { l: 56, r: 24, t: 42, b: 48 },
        ...figure.layout,
      },
      {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        ...figure.config,
      },
    )
    if (reaction && typeof (reaction as PromiseLike<unknown>).then === 'function') await reaction
    if (!isCurrentRender(generation, renderTarget)) {
      purgeDetachedTarget(currentPlotly, renderTarget)
      return
    }

    status.value = 'ready'
    emit('ready')
  } catch (reason) {
    if (!isCurrentRender(generation, renderTarget)) {
      if (currentPlotly) purgeDetachedTarget(currentPlotly, renderTarget)
      return
    }
    status.value = 'error'
    emit('error', reason instanceof Error ? reason : new Error(String(reason)))
  }
}

watch(() => props.figure, render, { deep: true })
onMounted(() => {
  mounted = true
  void render()
})
onBeforeUnmount(() => {
  mounted = false
  unmounted = true
  renderGeneration += 1
  if (plotly) {
    for (const plottedTarget of plottedTargets) purgeTarget(plotly, plottedTarget)
  }
})
</script>

<template lang="pug">
.plot-panel(:aria-busy="status === 'loading'")
  .plot-header
    span {{ label }}
    span.plot-state(:class="`is-${status}`") {{ status }}
  .plot-target(
    ref="target"
    role="img"
    :aria-label="label"
    :data-testid="status === 'ready' ? testId : undefined"
    :data-plot-state="status"
  )
  p.inline-error(v-if="status === 'error'") Interactive plot failed to initialize.
</template>
