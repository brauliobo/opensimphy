<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PlotFigure } from '../composables/atlasEngine'

const props = withDefaults(defineProps<{
  figure: PlotFigure
  label: string
  testId?: string
}>(), { testId: 'plot-ready' })

const emit = defineEmits<{ ready: []; error: [reason: Error] }>()
const target = ref<HTMLDivElement | null>(null)
const status = ref<'loading' | 'ready' | 'error'>('loading')
let plotly: typeof import('plotly.js-dist-min').default | null = null

async function render(): Promise<void> {
  if (!target.value) return
  status.value = 'loading'
  try {
    plotly ??= (await import('plotly.js-dist-min')).default
    await nextTick()
    await plotly.react(
      target.value,
      props.figure.data,
      {
        autosize: true,
        paper_bgcolor: '#15191b',
        plot_bgcolor: '#15191b',
        font: { color: '#d8d1bf', family: 'ui-monospace, SFMono-Regular, Menlo, monospace', size: 11 },
        margin: { l: 56, r: 24, t: 42, b: 48 },
        ...props.figure.layout,
      },
      {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        ...props.figure.config,
      },
    )
    status.value = 'ready'
    emit('ready')
  } catch (reason) {
    status.value = 'error'
    emit('error', reason instanceof Error ? reason : new Error(String(reason)))
  }
}

watch(() => props.figure, render, { deep: true })
onMounted(render)
onBeforeUnmount(() => {
  if (target.value && plotly) plotly.purge(target.value)
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
