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

<template lang="pug">
fieldset.tour-depth-control(data-testid="depth-control" :aria-describedby="descriptionId")
  legend Reading depth
  p.tour-depth-introduction(:id="descriptionId") Change how much scientific detail is shown without changing your place in the Tour.

  label.tour-depth-option.tour-touch-target
    input(
      :name="radioName"
      type="radio"
      value="guided"
      data-testid="reading-depth-guided"
      :checked="progress.depth.value === 'guided'"
      :aria-describedby="guidedDescriptionId"
      @change="selectDepth('guided')"
    )
    span.tour-depth-option-copy
      strong Guided
      span(:id="guidedDescriptionId") Essential controls and plain-language findings.

  label.tour-depth-option.tour-touch-target
    input(
      :name="radioName"
      type="radio"
      value="technical"
      data-testid="reading-depth-technical"
      :checked="progress.depth.value === 'technical'"
      :aria-describedby="technicalDescriptionId"
      @change="selectDepth('technical')"
    )
    span.tour-depth-option-copy
      strong Technical
      span(:id="technicalDescriptionId") Guided material plus numerical inputs, assumptions, and the full dimension basis.

  p.tour-depth-persistence-error(v-if="progress.persistenceError.value" role="alert") Your reading depth changed for this visit, but it could not be saved in this browser.
</template>
