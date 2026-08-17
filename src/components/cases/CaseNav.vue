<script setup lang="ts">
import { computed } from 'vue'
import { caseNeighbors } from '../../cases/caseRegistry'
import type { CaseLink } from '../../cases/types'

const props = withDefaults(defineProps<{
  cases: readonly CaseLink[]
  currentId: string
  hubTo?: string
  hubLabel?: string
}>(), {
  hubTo:    '/labs/cases',
  hubLabel: 'All cases',
})

const neighbors = computed(() => caseNeighbors(props.cases, props.currentId))
</script>

<template lang="pug">
nav.case-nav(aria-label="Case pages" data-testid="case-nav")
  RouterLink(:to="hubTo") {{ hubLabel }}
  RouterLink(v-if="neighbors.previous" :to="neighbors.previous.to" data-testid="case-nav-prev") <- {{ neighbors.previous.title }}
  span(v-else data-testid="case-nav-prev-empty") Start of case list
  RouterLink(v-if="neighbors.next" :to="neighbors.next.to" data-testid="case-nav-next") {{ neighbors.next.title }} ->
  span(v-else data-testid="case-nav-next-empty") End of case list
</template>

<style src="../../styles/cases.css"></style>
