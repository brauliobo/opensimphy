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

<template>
  <div class="equation-ladder" data-testid="equation-ladder">
    <ol v-if="steps.length" aria-label="Equation steps">
      <li v-for="step in visibleSteps" :key="step.id" :data-equation-id="step.id">
        <span class="equation-step-label">{{ step.label }}</span>
        <code>{{ step.expression }}</code>
        <p>{{ step.explanation }}</p>
        <details class="tour-metadata">
          <summary>Technical metadata</summary>
          <dl>
            <dt>Claim class</dt>
            <dd>{{ step.claimClass }}</dd>
            <dt>Method relationship</dt>
            <dd>{{ step.methodRelationship }}</dd>
            <dt>Model origin</dt>
            <dd>{{ step.modelOrigin }}</dd>
            <dt>Source revision</dt>
            <dd>{{ step.sourceRevision }}</dd>
            <dt>Source locator</dt>
            <dd>{{ step.sourceLocator }}</dd>
          </dl>
          <ul v-if="step.caveats.length">
            <li v-for="caveat in step.caveats" :key="caveat">{{ caveat }}</li>
          </ul>
        </details>
      </li>
    </ol>
    <p v-else class="equation-empty">No equation steps are declared for this path.</p>

    <div v-if="steps.length" class="equation-controls" aria-label="Equation reveal controls">
      <button type="button" :disabled="!hasHiddenSteps" data-testid="equation-reveal-next" @click="revealNext">
        Reveal next
      </button>
      <button type="button" :disabled="!hasHiddenSteps" data-testid="equation-reveal-all" @click="revealAll">
        Reveal all
      </button>
      <button type="button" :disabled="revealedCount <= 1" data-testid="equation-reset" @click="reset">
        Reset ladder
      </button>
      <span aria-live="polite">{{ revealedCount }} of {{ steps.length }} steps shown</span>
    </div>
  </div>
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
