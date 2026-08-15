<script setup lang="ts">
import { ref } from 'vue'
import type { FiddleRecord } from '../../types/fiddle'

defineProps<{
  record: FiddleRecord
}>()

const activated = ref(false)

function activate(): void {
  activated.value = true
}
</script>

<template lang="pug">
section.fiddle-live-frame(data-testid="fiddle-live-frame" aria-labelledby="fiddle-live-title")
  .fiddle-live-heading
    div
      p.eyebrow External live preview
      h2#fiddle-live-title Third-party execution boundary
    span.status-chip.is-pending(v-if="!activated") INACTIVE
    span.status-chip.is-met(v-else) REQUESTED
  p This preview is an opt-in request to JSFiddle. It executes third-party network content in a sandboxed frame; it is not a local OpenSimPhy reproduction, and reproduction is not validation.
  button.fiddle-live-activate(
    v-if="!activated"
    type="button"
    data-testid="fiddle-live-activate"
    @click="activate"
  ) Load external live preview
  .fiddle-live-stage(v-if="activated")
    iframe(
      :src="record.embedUrl"
      sandbox="allow-scripts"
      loading="lazy"
      referrerpolicy="no-referrer"
      :title="`External JSFiddle preview for ${record.title}`"
      data-testid="fiddle-live-iframe"
    )
    p.fiddle-live-note If the external frame is blocked or unavailable, the archived metadata remains authoritative for this page.
  a.fiddle-editor-link(
    :href="record.sourceUrl"
    target="_blank"
    rel="noreferrer"
  ) Open the external JSFiddle editor ->
</template>
