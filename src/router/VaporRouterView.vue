<script setup lang="ts">
import { computed, inject, provide, unref, useAttrs, type Component } from 'vue'
import {
  matchedRouteKey,
  routerViewLocationKey,
  useRoute,
  viewDepthKey,
  type RouteLocationNormalizedLoaded,
  type RouteRecordNormalized,
} from 'vue-router'

defineOptions({ name: 'RouterView', inheritAttrs: false })

const props = defineProps<{
  name?: string
  route?: RouteLocationNormalizedLoaded
}>()

const attrs = useAttrs()
const injectedRoute = inject(routerViewLocationKey)
const fallbackRoute = useRoute()
const viewName = computed(() => props.name ?? 'default')
const routeToDisplay = computed(() => props.route ?? injectedRoute?.value ?? fallbackRoute)
const injectedDepth = inject(viewDepthKey, 0)
const depth = computed(() => {
  let initialDepth = unref(injectedDepth)
  const matched = routeToDisplay.value.matched
  while (matched[initialDepth] && !matched[initialDepth]?.components) initialDepth += 1
  return initialDepth
})
const matchedRouteRef = computed(() => routeToDisplay.value.matched[depth.value] as RouteRecordNormalized | undefined)
provide(viewDepthKey, computed(() => depth.value + 1))
provide(matchedRouteKey, matchedRouteRef)
provide(routerViewLocationKey, routeToDisplay)

const viewComponent = computed(() => matchedRouteRef.value?.components?.[viewName.value] as Component | undefined)
const boundProps = computed(() => {
  const matched = matchedRouteRef.value
  const route = routeToDisplay.value
  const option = matched?.props?.[viewName.value]
  const routeProps = option === true
    ? route.params
    : typeof option === 'function'
      ? option(route)
      : option ?? {}
  return { ...routeProps, ...attrs }
})
</script>

<template lang="pug">
component(v-if="viewComponent" :is="viewComponent" v-bind="boundProps")
</template>
