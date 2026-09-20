<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
import { COMPUTE_CONTEXT_KEY } from '../../compute/context'
import { COMPUTE_EXAMPLE_QUERIES, COMPUTE_LAB_PATH } from '../../compute/examples'
import { evaluateQuery } from '../../compute/kernel'
import { EMPTY_COMPUTE_CONTEXT, type ComputeContext, type ComputeResult } from '../../compute/types'
import '../../styles/compute.css'

const props = withDefaults(defineProps<{
  context?: ComputeContext
  initialQuery?: string
  examples?: boolean
}>(), {
  examples: false,
})

const injected = inject(COMPUTE_CONTEXT_KEY, EMPTY_COMPUTE_CONTEXT)
const context = computed(() => props.context ?? (unref(injected) as ComputeContext))
const query = ref(props.initialQuery ?? '')
const result = ref<ComputeResult | null>(null)
const running = ref(false)

watch(() => props.initialQuery, async (value) => {
  if (!value) return
  query.value = value
  await submit()
}, { immediate: true })

const katexHtml = ref('')
watch(() => result.value?.latex, async (latex) => {
  if (!latex) {
    katexHtml.value = ''
    return
  }
  const [{ default: katex }] = await Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css'),
  ])
  katexHtml.value = katex.renderToString(latex, { throwOnError: false, output: 'html' })
})

const graphHref = computed(() => {
  const text = result.value?.query || query.value
  return text ? { path: COMPUTE_LAB_PATH, query: { q: text } } : { path: COMPUTE_LAB_PATH }
})

async function submit(): Promise<void> {
  running.value = true
  result.value = await evaluateQuery(query.value, context.value)
  running.value = false
}

async function useExample(example: string): Promise<void> {
  query.value = example
  await submit()
}

defineExpose({ submit, result })
</script>

<template lang="pug">
section.compute-prompt(data-testid="compute-prompt" :aria-label="context.sourceLabel")
  header.compute-prompt-header
    div
      p.eyebrow Compute
      h2 Ask the local kernel
    p.compute-context {{ context.sourceLabel }}
  form.compute-form(@submit.prevent="submit")
    label.field
      span Query
      textarea(
        v-model="query"
        data-testid="compute-query"
        name="compute-query"
        rows="3"
        spellcheck="false"
        placeholder="(Planck mass)/(Planck time)^2"
      )
    .compute-actions
      button.button-link(type="submit" data-testid="compute-run" :disabled="running") {{ running ? 'Evaluating…' : 'Evaluate' }}
      RouterLink.text-link(:to="graphHref" data-testid="compute-open-lab") Open in Compute lab
    .compute-examples(v-if="examples")
      button(
        v-for="example in COMPUTE_EXAMPLE_QUERIES"
        :key="example"
        type="button"
        data-testid="compute-example"
        @click="useExample(example)"
      ) {{ example }}
  p.compute-error(v-if="result?.error" data-testid="compute-error" role="alert") {{ result.error }}
  .compute-result(v-else-if="result" data-testid="compute-result")
    .compute-value(v-if="result.formatted")
      span Result
      strong(data-testid="compute-formatted") {{ result.formatted }}
    p(v-if="result.basicDimensions" data-testid="compute-dimensions") Basic unit dimensions: {{ result.basicDimensions }}
    p(v-if="result.siUnit" data-testid="compute-si-unit") SI: {{ result.siUnit }}
    .compute-katex(v-if="katexHtml" data-testid="compute-latex" v-html="katexHtml")
    section.compute-interpretations(v-if="result.interpretations.length" data-testid="compute-interpretations")
      h3 Interpretations
      ul
        li(v-for="entry in result.interpretations" :key="entry.name") {{ entry.name }}
      p.compute-caveat {{ result.interpretationCaveat }}
    slot(name="plot" :figure="result.figure")
    details(v-if="result.steps.length")
      summary Steps
      ol
        li(v-for="step in result.steps" :key="step") {{ step }}
</template>
