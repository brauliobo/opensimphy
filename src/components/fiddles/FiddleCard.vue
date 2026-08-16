<script setup lang="ts">
import { computed } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import type { FiddleRecord, FiddleRuntimeRecord } from '../../types/fiddle'

const props = defineProps<{
  record: FiddleRecord
  runtime: FiddleRuntimeRecord
  archiveQuery?: LocationQueryRaw
}>()

const detailLocation = computed(() => ({
  name: 'fiddle-record',
  params: { slug: props.record.slug },
  query: props.archiveQuery ?? {},
}))

const runtimeLabel = computed(() => props.runtime.status === 'verified'
  ? 'rendered without uncaught page errors'
  : props.runtime.status)
</script>

<template lang="pug">
article.fiddle-card(:data-testid="`fiddle-card-${record.position}`")
  .fiddle-card-index
    span Chenopdodium / Fiddle {{ record.position }} / source page {{ record.page }}
    span {{ record.position.toString().padStart(4, '0') }}
  h3
    RouterLink.fiddle-card-title(:to="detailLocation") {{ record.title }}
  p.fiddle-card-slug
    code {{ record.slug }} / v{{ record.version }}
  dl.fiddle-card-meta
    div
      dt Visualization
      dd {{ record.visualization }}
    div
      dt Risk flags
      dd {{ record.risk || 'none reported' }}
    div
      dt Source panels
      dd {{ record.panelBytes.html.toLocaleString('en-US') }} HTML / {{ record.panelBytes.js.toLocaleString('en-US') }} JS / {{ record.panelBytes.css.toLocaleString('en-US') }} CSS
  .fiddle-card-footer
    span(:data-runtime-status="runtime.status") Runtime: {{ runtimeLabel }} / {{ runtime.attempts }} attempt{{ runtime.attempts === 1 ? '' : 's' }}
    RouterLink.text-link(:to="detailLocation") View metadata ->
</template>
