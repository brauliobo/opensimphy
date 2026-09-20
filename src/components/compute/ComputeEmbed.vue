<script setup lang="ts">
import { computed } from 'vue'
import { labComputeContext, labeledComputeContext } from '../../compute/context'
import ComputePrompt from './ComputePrompt.vue'

const props = defineProps<{
  sourceId: string
  sourceLabel: string
  beside?: string
  note?: string
}>()

const context = computed(() => props.note
  ? labeledComputeContext(props.sourceId, props.sourceLabel, props.note)
  : labComputeContext(props.sourceId, props.sourceLabel, props.beside ?? 'this instrument'))
</script>

<template lang="pug">
ComputePrompt(:context="context")
</template>
