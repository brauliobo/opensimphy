<script setup lang="ts">
defineProps<{
  error?: Error
}>()
</script>

<template lang="pug">
div(role="alert" data-testid="tour-simulation-load-error")
  p The interactive simulation could not be loaded.
  p Reload this lesson to retry. If the problem continues, check the network connection and try again.
</template>
