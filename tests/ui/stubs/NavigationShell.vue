<script setup lang="ts">
import { ref } from 'vue'
import AppNav from '../../../src/components/AppNav.vue'

defineProps<{
  showNavigation: boolean
}>()

const menuOpen = ref(false)
</script>

<template lang="pug">
div
  AppNav(v-if="showNavigation" @menu-state-change="menuOpen = $event")
  main(data-testid="shell-main" :inert="menuOpen ? '' : undefined" :aria-hidden="menuOpen ? 'true' : undefined")
    button(data-testid="shell-control") Background control
  footer(data-testid="shell-footer" :inert="menuOpen ? '' : undefined" :aria-hidden="menuOpen ? 'true' : undefined")
</template>
