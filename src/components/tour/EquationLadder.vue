<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EquationStep } from '../../types/tour'

const props = defineProps<{ steps: EquationStep[] }>()

const revealedCount = ref(props.steps.length ? 1 : 0)
const visibleSteps = computed(() => props.steps.slice(0, revealedCount.value))
const hasHiddenSteps = computed(() => revealedCount.value < props.steps.length)

function revealNext(): void {
  if (hasHiddenSteps.value) revealedCount.value += 1
}

function revealAll(): void {
  revealedCount.value = props.steps.length
}

function reset(): void {
  revealedCount.value = props.steps.length ? 1 : 0
}

watch(() => props.steps, reset)
</script>

<template lang="pug">
.equation-ladder(data-testid="equation-ladder")
  ol(v-if="steps.length" aria-label="Equation steps")
    li(v-for="step in visibleSteps" :key="step.id" :data-equation-id="step.id")
      span.equation-step-label {{ step.label }}
      code {{ step.expression }}
      p {{ step.explanation }}
      details.tour-metadata
        summary Technical metadata
        dl
          dt Claim class
          dd {{ step.claimClass }}
          dt Method relationship
          dd {{ step.methodRelationship }}
          dt Model origin
          dd {{ step.modelOrigin }}
          dt Source revision
          dd {{ step.sourceRevision }}
          dt Source locator
          dd {{ step.sourceLocator }}
        ul(v-if="step.caveats.length")
          li(v-for="caveat in step.caveats" :key="caveat") {{ caveat }}
  p.equation-empty(v-else) No equation steps are declared for this path.

  .equation-controls(v-if="steps.length" aria-label="Equation reveal controls")
    button(type="button" :disabled="!hasHiddenSteps" data-testid="equation-reveal-next" @click="revealNext") Reveal next
    button(type="button" :disabled="!hasHiddenSteps" data-testid="equation-reveal-all" @click="revealAll") Reveal all
    button(type="button" :disabled="revealedCount <= 1" data-testid="equation-reset" @click="reset") Reset ladder
    span(aria-live="polite") {{ revealedCount }} of {{ steps.length }} steps shown
</template>

<style scoped>
.equation-ladder ol {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding-left: 1.5rem;
}

.equation-ladder li {
  padding: 1rem;
  border-left: 2px solid var(--line, #494949);
  background: color-mix(in srgb, currentColor 4%, transparent);
}

.equation-step-label,
.equation-ladder code {
  display: block;
}

.equation-step-label {
  margin-bottom: 0.45rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.equation-ladder code {
  overflow-wrap: anywhere;
  font-size: 1rem;
}

.equation-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
}

.equation-controls span {
  font-size: 0.8rem;
  opacity: 0.75;
}

.tour-metadata {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  opacity: 0.82;
}

.tour-metadata dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 0.75rem;
}

.tour-metadata dd {
  margin: 0;
}
</style>
