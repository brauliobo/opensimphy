<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useLink, type RouteLocationRaw } from 'vue-router'

defineOptions({ name: 'RouterLink', inheritAttrs: false })

const props = withDefaults(defineProps<{
  to: RouteLocationRaw
  replace?: boolean
  activeClass?: string
  exactActiveClass?: string
  ariaCurrentValue?: string
}>(), {
  ariaCurrentValue: 'page',
})

const link = reactive(useLink(props))
const elClass = computed(() => ({
  [props.activeClass ?? 'router-link-active']: link.isActive,
  [props.exactActiveClass ?? 'router-link-exact-active']: link.isExactActive,
}))
</script>

<template lang="pug">
a(
  :href="link.href"
  :class="elClass"
  :aria-current="link.isExactActive ? ariaCurrentValue : undefined"
  v-bind="$attrs"
  @click="link.navigate"
)
  slot
</template>
