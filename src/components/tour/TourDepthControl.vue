<script setup lang="ts">
import { useId } from 'vue'
import { useTourProgress } from '../../registries/tourProgress'
import type { ReadingDepth } from '../../types/tour'

const progress = useTourProgress()
const descriptionId = useId()
const guidedDescriptionId = useId()
const technicalDescriptionId = useId()
const radioName = `tour-reading-depth-${useId()}`

if (!progress.hydrated.value) progress.hydrate()

function selectDepth(depth: ReadingDepth): void {
  progress.setDepth(depth)
}
</script>

<template>
  <fieldset
    class="tour-depth-control"
    data-testid="depth-control"
    :aria-describedby="descriptionId"
  >
    <legend>Reading depth</legend>
    <p :id="descriptionId" class="tour-depth-introduction">
      Change how much scientific detail is shown without changing your place in the Tour.
    </p>

    <label class="tour-depth-option tour-touch-target">
      <input
        :name="radioName"
        type="radio"
        value="guided"
        data-testid="reading-depth-guided"
        :checked="progress.depth.value === 'guided'"
        :aria-describedby="guidedDescriptionId"
        @change="selectDepth('guided')"
      >
      <span class="tour-depth-option-copy">
        <strong>Guided</strong>
        <span :id="guidedDescriptionId">Essential controls and plain-language findings.</span>
      </span>
    </label>

    <label class="tour-depth-option tour-touch-target">
      <input
        :name="radioName"
        type="radio"
        value="technical"
        data-testid="reading-depth-technical"
        :checked="progress.depth.value === 'technical'"
        :aria-describedby="technicalDescriptionId"
        @change="selectDepth('technical')"
      >
      <span class="tour-depth-option-copy">
        <strong>Technical</strong>
        <span :id="technicalDescriptionId">Guided material plus numerical inputs, assumptions, and the full dimension basis.</span>
      </span>
    </label>

    <p v-if="progress.persistenceError.value" class="tour-depth-persistence-error" role="alert">
      Your reading depth changed for this visit, but it could not be saved in this browser.
    </p>
  </fieldset>
</template>
