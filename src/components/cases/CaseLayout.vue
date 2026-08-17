<script setup lang="ts">
import CaseNav from './CaseNav.vue'
import type { CaseLink } from '../../cases/types'

withDefaults(defineProps<{
  cases: readonly CaseLink[]
  currentId: string
  testId?: string
}>(), {
  testId: 'case-layout',
})
</script>

<template lang="pug">
.case-layout(:data-testid="testId")
  CaseNav(:cases="cases" :current-id="currentId")
  slot
</template>

<style src="../../styles/cases.css"></style>
