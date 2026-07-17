<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAtlasEngine } from '../composables/atlasEngine'

const atlas = useAtlasEngine()
const route = useRoute()
const query = ref('')
const topic = ref(typeof route.query.topic === 'string' ? route.query.topic : 'all')
const category = ref(typeof route.query.category === 'string' ? route.query.category : 'all')
const column = ref('all')
const island = ref('all')
const classification = ref('all')
const status = ref('all')
const page = ref(1)
const pageSize = 24

const topics = computed(() => atlas.taxonomy.value?.topics ?? [])
const categories = computed(() => topic.value === 'all' ? [] : topics.value.find((item) => item.id === topic.value)?.categories ?? [])
const columns = computed(() => [...new Set(atlas.formulas.value.map((item) => item.column))].sort())
const islands = computed(() => [...new Set(atlas.formulas.value.map((item) => item.island))].sort())
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return atlas.formulas.value.filter((item) => {
    const matchesSearch = !search || [item.ordinal, item.symbol, item.name, item.equation, item.dependencies.join(' ')].join(' ').toLocaleLowerCase().includes(search)
    return matchesSearch
      && (column.value === 'all' || item.column === column.value)
      && (island.value === 'all' || item.island === island.value)
      && (topic.value === 'all' || item.topic === topic.value)
      && (category.value === 'all' || item.category === category.value)
      && (classification.value === 'all' || item.classification === classification.value)
      && (status.value === 'all' || item.status === status.value)
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(topic, () => {
  if (!categories.value.some((item) => item.id === category.value)) category.value = 'all'
})
watch(() => [route.query.topic, route.query.category], ([nextTopic, nextCategory]) => {
  topic.value = typeof nextTopic === 'string' ? nextTopic : 'all'
  category.value = typeof nextCategory === 'string' ? nextCategory : 'all'
})
watch([query, topic, category, column, island, classification, status], () => { page.value = 1 })

function topicTitle(id: string): string {
  return topics.value.find((item) => item.id === id)?.shortTitle ?? id
}

function categoryTitle(topicId: string, categoryId: string): string {
  return topics.value.find((item) => item.id === topicId)?.categories.find((item) => item.id === categoryId)?.title ?? categoryId
}
</script>

<template lang="pug">
.view
  header.view-header
    div
      p.eyebrow Instrument 01 / formula registry
      h1 Formula Atlas
    .header-stat
      strong {{ filtered.length }} / {{ atlas.formulas.value.length }}
      span visible recipes

  section.filter-console(aria-label="Formula filters")
    label.field.field-search
      span Search registry
      input(v-model="query" data-testid="formula-search" type="search" placeholder="symbol, equation, dependency…")
    label.field
      span Topic
      select(v-model="topic" data-testid="formula-topic")
        option(value="all") all topics
        option(v-for="item in topics" :key="item.id" :value="item.id") {{ item.shortTitle }} ({{ item.count }})
    label.field
      span Category
      select(v-model="category" data-testid="formula-category" :disabled="topic === 'all'")
        option(value="all") all categories
        option(v-for="item in categories" :key="item.id" :value="item.id") {{ item.title }} ({{ item.count }})
    label.field
      span Column
      select(v-model="column" data-testid="formula-column")
        option(value="all") all columns
        option(v-for="item in columns" :key="item" :value="item") {{ item }}
    label.field
      span Island
      select(v-model="island" data-testid="formula-island")
        option(value="all") all islands
        option(v-for="item in islands" :key="item" :value="item") {{ item }}
    label.field
      span Basis
      select(v-model="classification" data-testid="formula-classification")
        option(value="all") exact + measured
        option(value="exact") exact
        option(value="measured") measured
    label.field
      span Audit
      select(v-model="status" data-testid="formula-status")
        option(value="all") all states
        option(value="pass") pass
        option(value="fail") fail
        option(value="pending") pending

  .atlas-key(aria-label="Table key")
    span # / symbol
    span equation / name
    span topic / category
    span expected → computed
    span audit

  section.formula-list(aria-live="polite")
    RouterLink.formula-row(
      v-for="formula in visible"
      :key="formula.id"
      :to="`/atlas/${formula.ordinal}`"
      :data-testid="`formula-row-${formula.ordinal}`"
    )
      .formula-identity
        span {{ String(formula.ordinal).padStart(3, '0') }}
        strong {{ formula.symbol }}
      .formula-expression
        code {{ formula.equation }}
        small {{ formula.name }}
      .formula-location
        span {{ topicTitle(formula.topic) }}
        small {{ categoryTitle(formula.topic, formula.category) }}
        small col {{ formula.column }} / island {{ formula.island }}
      .formula-values
        span {{ formula.expected }}
        small → {{ formula.computed }} {{ formula.units }}
        small residual {{ formula.residual }} / {{ formula.dependencies.length }} deps
      .formula-audit
        span.status-chip(:class="`is-${formula.status}`") {{ formula.status }}
        small {{ formula.classification }}
    .empty-state(v-if="visible.length === 0")
      strong No matching registry entries
      p Adjust the query or filters. Missing engine entries are not synthesized.

  nav.pagination(v-if="filtered.length > pageSize" aria-label="Formula pages")
    button(type="button" :disabled="page === 1" @click="page--") Previous
    span Page {{ page }} / {{ pages }}
    button(type="button" :disabled="page === pages" @click="page++") Next
</template>
