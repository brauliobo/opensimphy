<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TourDepthControl from './tour/TourDepthControl.vue'
import { useTourProgress } from '../registries/tourProgress'

const emit = defineEmits<{
  'menu-state-change': [open: boolean]
}>()

const open = ref(false)
const header = ref<HTMLElement>()
const navigation = ref<HTMLElement>()
const toggleButton = ref<HTMLButtonElement>()
const route = useRoute()
const progress = useTourProgress()
let outsideActivationPending = false
let outsideActivationCleanup: number | undefined

if (!progress.hydrated.value) progress.hydrate()

const links = [
  { to: '/tour', label: 'Tour', code: '00', routes: ['overview', 'tour', 'tour-chapter', 'tour-lesson'] },
  { to: '/atlas', label: 'Atlas', code: '01', routes: ['atlas', 'formula'] },
  { to: '/labs', label: 'Workbench', code: '02', routes: ['labs', 'fiddle-archive', 'fiddle-record', 'core', 'walls', 'earth-workbench'] },
  {
    to: '/evidence',
    label: 'Evidence',
    code: '03',
    routes: ['evidence', 'sources', 'earth', 'earth-corpus', 'earth-document', 'earth-simulations', 'earth-simulation', 'earth-datasets'],
  },
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
  if (returnFocus) void nextTick(() => toggleButton.value?.focus())
}

async function toggleMenu(): Promise<void> {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  navigation.value?.querySelector<HTMLAnchorElement>('a')?.focus()
}

function focusableItems(): HTMLElement[] {
  const items = [...(navigation.value?.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])]
    .filter((item) => !item.hasAttribute('disabled') && item.tabIndex >= 0)

  const tabbableItems = items.filter((item) => {
    if (!(item instanceof HTMLInputElement) || item.type !== 'radio' || !item.name) return true
    const group = items.filter((candidate) => candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.name === item.name) as HTMLInputElement[]
    return item === (group.find((candidate) => candidate.checked) ?? group[0])
  })

  return toggleButton.value ? [toggleButton.value, ...tabbableItems] : tabbableItems
}

function focusFirstMenuItem(): void {
  navigation.value?.querySelector<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
    return
  }
  if (event.key !== 'Tab') return

  const focusable = focusableItems()
  if (!focusable.length) return
  const current = focusable.indexOf(document.activeElement as HTMLElement)
  if (current === -1) {
    event.preventDefault()
    focusable[event.shiftKey ? focusable.length - 1 : 0]?.focus()
  } else if (!event.shiftKey && current === focusable.length - 1) {
    event.preventDefault()
    focusable[0]?.focus()
  } else if (event.shiftKey && current === 0) {
    event.preventDefault()
    focusable.at(-1)?.focus()
  }
}

function handleDocumentFocusin(event: FocusEvent): void {
  if (!open.value || header.value?.contains(event.target as Node)) return
  focusFirstMenuItem()
}

function clearOutsideActivation(): void {
  outsideActivationPending = false
  if (outsideActivationCleanup !== undefined) window.clearTimeout(outsideActivationCleanup)
  outsideActivationCleanup = undefined
  document.removeEventListener('pointerup', handleDocumentPointerEnd, true)
  document.removeEventListener('pointercancel', handleDocumentPointerCancel, true)
  if (!open.value) document.removeEventListener('click', handleDocumentClick, true)
}

function handleDocumentPointerEnd(event: PointerEvent): void {
  if (!outsideActivationPending) return
  event.preventDefault()
  event.stopImmediatePropagation()
  outsideActivationCleanup = window.setTimeout(clearOutsideActivation, 0)
}

function handleDocumentPointerCancel(event: PointerEvent): void {
  if (!outsideActivationPending) return
  event.preventDefault()
  event.stopImmediatePropagation()
  clearOutsideActivation()
}

function handleDocumentPointerdown(event: PointerEvent): void {
  if (!open.value || header.value?.contains(event.target as Node)) return
  event.preventDefault()
  event.stopImmediatePropagation()
  outsideActivationPending = true
  document.addEventListener('pointerup', handleDocumentPointerEnd, true)
  document.addEventListener('pointercancel', handleDocumentPointerCancel, true)
  closeMenu(true)
}

function handleDocumentClick(event: MouseEvent): void {
  if (!outsideActivationPending && (!open.value || header.value?.contains(event.target as Node))) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (outsideActivationPending) {
    clearOutsideActivation()
    return
  }
  closeMenu(true)
}

function addDocumentListeners(): void {
  document.addEventListener('click', handleDocumentClick, true)
  document.addEventListener('focusin', handleDocumentFocusin, true)
  document.addEventListener('keydown', handleDocumentKeydown, true)
  document.addEventListener('pointerdown', handleDocumentPointerdown, true)
}

function removeDocumentListeners(): void {
  if (!outsideActivationPending) document.removeEventListener('click', handleDocumentClick, true)
  document.removeEventListener('focusin', handleDocumentFocusin, true)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
  document.removeEventListener('pointerdown', handleDocumentPointerdown, true)
}

watch(open, (isOpen) => {
  emit('menu-state-change', isOpen)
  if (isOpen) addDocumentListeners()
  else removeDocumentListeners()
}, { flush: 'sync' })
watch(() => route.fullPath, () => closeMenu(), { flush: 'sync' })
onBeforeUnmount(() => {
  clearOutsideActivation()
  removeDocumentListeners()
  emit('menu-state-change', false)
})
</script>

<template lang="pug">
header.app-header(ref="header")
  RouterLink.brand(to="/" aria-label="OpenSimPhy Tour orientation")
    span.brand-mark(aria-hidden="true") O/SP
    span.brand-copy
      strong OpenSimPhy Field Course
      small From observation to justified conclusion
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
    .nav-utilities(aria-label="Tour utilities")
      RouterLink.text-link(v-if="progress.resume.value" :to="progress.resume.value" data-testid="nav-resume") Resume Tour
      RouterLink.text-link(to="/saved") Saved
      TourDepthControl
</template>
