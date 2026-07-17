<script setup lang="ts">
import { computed } from 'vue'
import { useAtlasEngine } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const topics = computed(() => atlas.taxonomy.value?.topics ?? [])
</script>

<template lang="pug">
.view.overview-view
  section.home-hero
    p.eyebrow A field guide to 288 constants
    h1 The constants, in context.
    p.lede Start with a physical question, not a wall of formulas. Eight short journeys connect clocks and natural scales to fields, atoms, particles, heat, and bulk matter.
    .hero-actions
      a.button-link(href="#choose-topic") Choose a topic
      RouterLink.text-link(to="/atlas") Or search the full atlas →
    .home-signals(aria-label="Atlas summary")
      span 8 topics
      span 31 categories
      span 288 local reproductions

  section#choose-topic.topic-door-section(aria-labelledby="topic-door-title")
    .section-heading
      div
        p.eyebrow Choose one context
        h2#topic-door-title Where do you want to begin?
      p Each topic opens its own small map. Categories, representative constants, and formula links appear only after you choose.
    .topic-door-grid
      RouterLink.topic-door(
        v-for="topic in topics"
        :key="topic.id"
        :to="`/topics/${topic.id}`"
        :data-testid="`topic-${topic.id}`"
      )
        span.topic-door-number {{ String(topic.order).padStart(2, '0') }}
        span.topic-door-count {{ topic.count }} constants / {{ topic.categories.length }} families
        strong {{ topic.shortTitle }}
        p {{ topic.description }}
        span.topic-door-action Enter topic →

  section.home-method(aria-labelledby="method-title")
    header
      p.eyebrow A quiet reading path
      h2#method-title Three steps, then the evidence
    ol
      li
        span 01
        strong Tour
        p Choose the part of physics you recognize.
      li
        span 02
        strong Inspect
        p Open one constant and its reproduction recipe.
      li
        span 03
        strong Audit
        p Compare the source value, result, residual, and provenance.
    aside
      strong Reproduction is not validation.
      p Numerical agreement does not establish a derivation, physical mechanism, independent prediction, or theory validity.
</template>
