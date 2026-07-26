<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const open = ref(false)
const navigation = ref<HTMLElement>()
const toggleButton = ref<HTMLButtonElement>()
const route = useRoute()

watch(() => route.fullPath, () => { open.value = false })

const links = [
  { to: '/', label: 'Tour', code: '00', routes: ['overview', 'topic'] },
  { to: '/atlas', label: 'Formula atlas', code: '01', routes: ['atlas', 'formula'] },
  { to: '/labs', label: 'Labs', code: '02', routes: ['labs', 'core', 'walls'] },
  { to: '/earth', label: 'EARTH', code: '03', routes: ['earth', 'earth-corpus', 'earth-document', 'earth-simulations', 'earth-simulation', 'earth-datasets'] },
  { to: '/sources', label: 'Sources', code: '04', routes: ['sources'] },
]

function isActive(routes: string[]): boolean {
  return routes.includes(String(route.name))
}

function currentState(to: string, routes: string[]): 'page' | 'location' | undefined {
  if (!isActive(routes)) return undefined
  return route.path === to ? 'page' : 'location'
}

function closeMenu(returnFocus = false): void {
  open.value = false
  if (returnFocus) toggleButton.value?.focus()
}

async function toggleMenu(): Promise<void> {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  navigation.value?.querySelector<HTMLAnchorElement>('a')?.focus()
}

function handleNavigationKeydown(event: KeyboardEvent): void {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
    return
  }
  if (event.key !== 'Tab') return

  const links = [...(navigation.value?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
  const focusable = toggleButton.value ? [toggleButton.value, ...links] : links
  if (!focusable.length) return
  const current = focusable.indexOf(document.activeElement as HTMLElement)
  if (!event.shiftKey && current === focusable.length - 1) {
    event.preventDefault()
    focusable[0]?.focus()
  } else if (event.shiftKey && current === 0) {
    event.preventDefault()
    focusable.at(-1)?.focus()
  }
}
</script>

<template lang="pug">
header.app-header(@keydown="handleNavigationKeydown")
  RouterLink.brand(to="/" aria-label="OpenSimPhy overview")
    span.brand-mark(aria-hidden="true") O/SP
    span.brand-copy
      strong OpenSimPhy Atlas
      small Constants, one context at a time
  button.nav-toggle(
    ref="toggleButton"
    type="button"
    data-testid="nav-toggle"
    :aria-expanded="open"
    aria-controls="primary-navigation"
    :aria-label="open ? 'Close primary navigation' : 'Open primary navigation'"
    @click="toggleMenu"
  )
    span.nav-toggle-lines(aria-hidden="true")
  nav#primary-navigation.primary-nav(ref="navigation" :class="{ 'is-open': open }" aria-label="Primary navigation")
    RouterLink.nav-link(
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :class="{ 'router-link-active': isActive(link.routes) }"
      :aria-current="currentState(link.to, link.routes)"
      @click="closeMenu()"
    )
      span.nav-code {{ link.code }}
      span {{ link.label }}
</template>
