<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow: string
  title: string
  description: string
  identity?: string
  status?: string
}>(), {
  identity: '',
  status:   '',
})
</script>

<template lang="pug">
header.case-header(data-testid="case-header")
  .case-header__identity
    code(v-if="identity") {{ identity }}
    span {{ eyebrow }}
    span(v-if="status") {{ status }}
  div
    p.eyebrow {{ eyebrow }}
    h1 {{ title }}
    p {{ description }}
</template>

<style src="../../styles/cases.css"></style>
