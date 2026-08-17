<script setup lang="ts">
import { computed } from 'vue'
import AwesomePhysicsCaseBody from './AwesomePhysicsCaseBody.vue'
import { awesomePhysicsCasePage } from '../../awesomePhysics/casePages'

const props = defineProps<{
  catalogItemId: string
  result: unknown
}>()

const page = computed(() => awesomePhysicsCasePage(props.catalogItemId))
</script>

<template lang="pug">
section.awesome-case-page(v-if="page" :data-testid="`awesome-case-page-${page.catalogItemId}`" aria-labelledby="awesome-case-page-title")
  p.eyebrow Lesson figure
  h2#awesome-case-page-title {{ page.title }}
  p.awesome-case-lesson {{ page.lesson }}
  p.awesome-case-idle(v-if="result === null" data-testid="awesome-case-idle") Run the bounded adapter to fill this figure. The JSON payload remains the worker contract.
  AwesomePhysicsCaseBody(v-else :catalog-item-id="page.catalogItemId" :result="result")
</template>
