<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  message: string
  testId?: string
}>(), { testId: '' })
</script>

<template lang="pug">
.fail-closed-graph(:data-testid="testId || undefined")
  strong {{ title }}
  p {{ message }}
</template>
