<script setup lang="ts">
import { computed } from 'vue'
import { useAtlasEngine } from '../composables/atlasEngine'

const props = defineProps<{ id: string }>()
const atlas = useAtlasEngine()
const topic = computed(() => atlas.taxonomy.value?.topics.find((item) => item.id === props.id) ?? null)
const nextTopic = computed(() => {
  const topics = atlas.taxonomy.value?.topics ?? []
  const index = topics.findIndex((item) => item.id === props.id)
  return index < 0 ? null : topics[(index + 1) % topics.length] ?? null
})
</script>

<template lang="pug">
.view.topic-view
  .loading-plate(v-if="!atlas.ready.value") Loading topic…
  .empty-state(v-else-if="!topic")
    strong Topic unavailable
    p This topic is absent from the generated taxonomy.
    RouterLink.text-link(to="/") Return to the tour
  template(v-else)
    RouterLink.context-back(to="/") ← All topics
    header.topic-header
      .topic-header-main
        p.eyebrow Topic {{ String(topic.order).padStart(2, '0') }} / 08 · {{ topic.eyebrow }}
        h1 {{ topic.title }}
        p.lede {{ topic.narrative }}
      dl.topic-meta
        div
          dt Constants
          dd {{ topic.count }}
        div
          dt Categories
          dd {{ topic.categories.length }}
        div
          dt Basis
          dd {{ topic.exactCount }} exact / {{ topic.measuredCount }} measured

    section.topic-focus-section
      .section-heading
        div
          p.eyebrow Categories
          h2 Choose a narrower question
        p {{ topic.description }}
      .topic-category-grid
        RouterLink.topic-category-card(
          v-for="category in topic.categories"
          :key="category.id"
          :to="{ path: '/atlas', query: { topic: topic.id, category: category.id } }"
        )
          span {{ category.count }} constants
          strong {{ category.title }}
          p {{ category.description }}
          small Open filtered atlas →

    section.topic-focus-section
      .section-heading
        div
          p.eyebrow Representative constants
          h2 Four places to start
        RouterLink.text-link(:to="{ path: '/atlas', query: { topic: topic.id } }") View all {{ topic.count }} →
      .topic-featured-grid
        RouterLink(
          v-for="item in topic.featured"
          :key="item.id"
          :to="`/atlas/${item.recipeNumber}`"
        )
          code {{ item.id }}
          strong {{ item.name }}
          span Recipe {{ String(item.recipeNumber).padStart(3, '0') }} →

    RouterLink.topic-next(v-if="nextTopic" :to="`/topics/${nextTopic.id}`")
      span Next topic
      strong {{ nextTopic.shortTitle }} →
</template>
