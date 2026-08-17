<script setup lang="ts">
import type { SchematicRef } from '../../cases/types'

withDefaults(defineProps<{
  entries: readonly SchematicRef[]
  title?: string
}>(), {
  title: 'Schematics and source frames',
})

const base = import.meta.env.BASE_URL

function frameSrc(src: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(src) || src.startsWith('/') || src.startsWith(base)) return src
  return `${base}${src}`
}
</script>

<template lang="pug">
section.schematic-viewer(data-testid="case-schematics" aria-labelledby="case-schematics-title")
  p.eyebrow Frames / captions / references
  h2#case-schematics-title {{ title }}
  .schematic-viewer__grid
    component.schematic-card(
      v-for="entry in entries"
      :key="entry.id"
      :is="entry.href ? 'a' : 'article'"
      :href="entry.href"
      :target="entry.href ? '_blank' : undefined"
      :rel="entry.href ? 'noreferrer' : undefined"
      :data-testid="`case-schematic-${entry.id}`"
    )
      img(v-if="entry.src" :src="frameSrc(entry.src)" :alt="entry.caption")
      .schematic-card__body
        time(v-if="entry.timestamp") {{ entry.timestamp }}
        strong {{ entry.title }}
        small {{ entry.caption }}
        small(v-if="entry.subtitle") {{ entry.subtitle }}
</template>

<style src="../../styles/cases.css"></style>
