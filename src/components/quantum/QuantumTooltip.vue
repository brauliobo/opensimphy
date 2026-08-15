<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue'
import type { ReadingDepth } from '../../types/tour'

withDefaults(defineProps<{
  term: string
  plain: string
  technical?: string
  depth?: ReadingDepth
}>(), {
  technical: '',
  depth: 'guided',
})

const open = ref(false)
const tooltipId = `quantum-tip-${useId()}`

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function handleDocumentPointerdown(event: PointerEvent): void {
  const target = event.target
  if (target instanceof Node && !(event.currentTarget as Document).querySelector(`#${CSS.escape(tooltipId)}`)?.parentElement?.contains(target)) close()
}

function attachDocumentListener(): void {
  document.addEventListener('pointerdown', handleDocumentPointerdown)
}

function detachDocumentListener(): void {
  document.removeEventListener('pointerdown', handleDocumentPointerdown)
}

if (typeof document !== 'undefined') attachDocumentListener()
onBeforeUnmount(detachDocumentListener)
</script>

<template>
  <span class="quantum-tooltip">
    <button
      type="button"
      class="quantum-tooltip__button"
       :aria-expanded="open"
       :aria-controls="tooltipId"
       :aria-describedby="open ? tooltipId : undefined"
       :aria-label="`Explain ${term}`"
      @click="toggle"
      @keydown.esc="close"
    >
      ?
    </button>
    <span v-if="open" :id="tooltipId" class="quantum-tooltip__panel" role="tooltip">
      <strong>{{ term }}</strong>
      <span>{{ plain }}</span>
      <span v-if="depth === 'technical' && technical">{{ technical }}</span>
    </span>
  </span>
</template>

<style scoped>
.quantum-tooltip {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
}

.quantum-tooltip__button {
  display: inline-grid;
  width: 1.35rem;
  min-width: 1.35rem;
  height: 1.35rem;
  min-height: 1.35rem;
  padding: 0;
  margin-left: 0.25rem;
  place-items: center;
  color: var(--ink-0);
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid var(--cyan);
  border-radius: 50%;
  background: var(--cyan);
  cursor: pointer;
}

.quantum-tooltip__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.55rem);
  left: 0;
  display: grid;
  width: min(20rem, calc(100vw - 2rem));
  padding: 0.8rem;
  gap: 0.45rem;
  color: var(--paper);
  font-family: var(--sans);
  font-size: 0.82rem;
  line-height: 1.45;
  border: 1px solid var(--cyan);
  background: var(--ink-0);
  box-shadow: 0 0.6rem 1.4rem rgb(0 0 0 / 35%);
}

.quantum-tooltip__panel strong {
  color: var(--amber);
  font-family: var(--mono);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@media (max-width: 520px) {
  .quantum-tooltip__panel {
    position: fixed;
    top: auto;
    right: 1rem;
    bottom: 1rem;
    left: 1rem;
    width: auto;
  }
}
</style>
