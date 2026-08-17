<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FiddleLiveFrame from '../components/fiddles/FiddleLiveFrame.vue'
import { fiddleProfileUrl, useFiddleRegistry } from '../registries/fiddleRegistry'
import type { FiddleFlags } from '../types/fiddle'

const props = defineProps<{ slug: string }>()
const route = useRoute()
const fiddleRegistry = useFiddleRegistry()
type ArchivedFiddle = NonNullable<(typeof fiddleRegistry.records.value)[number]>
const record = ref<ArchivedFiddle | null>(null)
const loading = ref(true)
const error = ref('')

const SAFE_SLUG = /^[A-Za-z0-9_-]{1,128}$/
const archiveQueryKeys = ['q', 'viz', 'runtime', 'page'] as const
const backToArchive = computed(() => ({
  name: 'fiddle-archive',
  query: Object.fromEntries(archiveQueryKeys.flatMap((key) => typeof route.query[key] === 'string' ? [[key, route.query[key]]] : [])),
}))
const source = computed(() => fiddleRegistry.source.value)
const recordProfileUrl = computed(() => record.value && source.value
  ? fiddleProfileUrl(source.value.author, record.value.page)
  : '')
const records = computed(() => fiddleRegistry.records.value)
const runtimeRecord = computed(() => record.value ? fiddleRegistry.getRuntimeBySlug(record.value.slug) : null)
const runtimeLabel = computed(() => runtimeRecord.value?.status === 'verified'
  ? 'rendered without uncaught page errors'
  : runtimeRecord.value?.status)
const previousRecord = computed(() => adjacentRecord(-1))
const nextRecord = computed(() => adjacentRecord(1))
const flagDefinitions = [
  { key: 'three', label: 'Three.js' },
  { key: 'webgl', label: 'WebGL' },
  { key: 'raf', label: 'requestAnimationFrame' },
  { key: 'tim', label: 'timers' },
  { key: 'aud', label: 'audio' },
  { key: 'net', label: 'network' },
  { key: 'anim', label: 'animation' },
  { key: 'math', label: 'math library' },
  { key: 'd3', label: 'D3' },
  { key: 'plot', label: 'Plotly' },
  { key: 'p5', label: 'p5' },
] as const
const activeFlags = computed(() => flagDefinitions.filter(({ key }) => flagEnabled(key)))

watch(() => props.slug, async (slug) => {
  record.value = null
  error.value = ''
  loading.value = true
  if (!SAFE_SLUG.test(slug)) {
    error.value = 'This record identifier is not a permitted archived Fiddle slug.'
    loading.value = false
    return
  }
  await fiddleRegistry.initialize()
  if (fiddleRegistry.error.value) error.value = fiddleRegistry.error.value.message
  else {
    record.value = fiddleRegistry.getBySlug(slug)
    if (!record.value) error.value = 'This Fiddle slug is not present in the checked-in source archive.'
    else if (!fiddleRegistry.getRuntimeBySlug(slug)) error.value = 'This Fiddle record has no associated runtime ledger entry.'
  }
  loading.value = false
}, { immediate: true })

function adjacentRecord(direction: -1 | 1): ArchivedFiddle | null {
  if (!record.value) return null
  const index = records.value.findIndex(({ position }) => position === record.value?.position)
  return records.value[index + direction] ?? null
}

function recordLocation(next: ArchivedFiddle) {
  return {
    name: 'fiddle-record',
    params: { slug: next.slug },
    query: backToArchive.value.query,
  }
}

function flagEnabled(key: keyof FiddleFlags): boolean {
  const value = record.value?.flags[key]
  return typeof value === 'number' ? value > 0 : value === true
}

function formatBytes(value: number): string {
  return `${value.toLocaleString('en-US')} B`
}

function formatFlagValue(key: keyof FiddleFlags): string {
  const value = record.value?.flags[key]
  return typeof value === 'number' ? value.toLocaleString('en-US') : value ? 'yes' : 'no'
}
</script>

<template lang="pug">
.view.fiddle-record-view(:data-testid="record && !error ? 'fiddle-record-ready' : undefined")
  RouterLink.fiddle-back-link(:to="backToArchive") <- Fiddle source archive
  .loading-plate(v-if="loading" data-testid="fiddle-record-loading" aria-live="polite") Loading archived Fiddle metadata...
  .empty-state(v-else-if="error" role="alert" data-testid="fiddle-record-error")
    strong Fiddle record unavailable
    p {{ error }}
    RouterLink.button-link(:to="backToArchive") Return to source archive
  template(v-else-if="record && runtimeRecord")
    header.fiddle-record-header
      .fiddle-record-index
        p.eyebrow Chenopdodium / external source record
        strong Record {{ record.position }} / {{ source?.recordCount }}
        span Profile page {{ record.page }} / {{ source?.profilePages }}
      .fiddle-record-title
        p.eyebrow {{ record.visualization }} / risk {{ record.risk }}
        h1 {{ record.title }}
        p
          code {{ record.slug }} / version {{ record.version }}
      .fiddle-record-status
        span CHENOPDODIUM
        span ARCHIVED METADATA
        span(:data-runtime-status="runtimeRecord.status") RUNTIME: {{ runtimeLabel }}
        span {{ record.documentType }}
        span {{ record.library }}

    section.caveat-banner(data-testid="fiddle-record-boundary")
      strong RECORDED RUNTIME / PREVIEW OPT-IN
      p This indexed external simulation {{ runtimeLabel }} in the recorded Chromium pass. Retained failed requests may still exist. Browser runtime rendering is not scientific validation; scientifically validated by this check: 0.

    section.fiddle-record-section(data-testid="fiddle-runtime-detail")
      .section-heading
        div
          p.eyebrow Chromium runtime evidence
          h2 Recorded status: {{ runtimeLabel }}
        p The published ledger contains normalized summaries for the external iframe, not every raw field. Detailed evidence is retained in data/fiddles/runtime/. This is not a local Vue port or a scientific correctness assessment.
      .fiddle-metadata-grid
        article
          span Final status
          strong(:data-runtime-status="runtimeRecord.status") {{ runtimeLabel }}
        article
          span Attempts
          strong {{ runtimeRecord.attempts }}
        article
          span Tested / batch
          strong {{ runtimeRecord.testedAt }}
          small Batch {{ runtimeRecord.batch }}
        article
          span Page errors / failure
          strong {{ runtimeRecord.pageErrors.length }}
          small {{ runtimeRecord.failureSummary ?? 'No final-attempt failure recorded.' }}
      details.fiddle-disclosure(v-if="runtimeRecord.pageErrors.length || runtimeRecord.failureSummary")
        summary Runtime diagnostics
          span.disclosure-action Open +
        .fiddle-disclosure-body
          .fiddle-list-block
            h3 Uncaught page errors
            ul(v-if="runtimeRecord.pageErrors.length")
              li(v-for="pageError in runtimeRecord.pageErrors" :key="pageError")
                code {{ pageError }}
            p(v-else) No uncaught page errors were recorded on the final attempt.
          .fiddle-list-block
            h3 Failure summary
            p {{ runtimeRecord.failureSummary ?? 'No navigation, frame, or runtime failure was recorded on the final attempt.' }}

    section.fiddle-record-section
      .section-heading
        div
          p.eyebrow Provenance
          h2 Where this record came from
        p The archive retains source identity and acquisition context without treating the external page as scientific evidence.
      .fiddle-provenance-grid
        article
          span Source URL
          a(:href="record.sourceUrl" target="_blank" rel="noreferrer") {{ record.sourceUrl }}
        article
          span Captured profile
          a(:href="recordProfileUrl" target="_blank" rel="noreferrer") {{ recordProfileUrl }}
        article
          span Acquisition
          strong {{ source?.acquiredAt }}
        article
          span Source revision
          code {{ source?.sourceRevision }}

    section.fiddle-record-section
      .section-heading
        div
          p.eyebrow Structural metadata
          h2 What the archive records
        p These fields describe captured panels and inferred browser-facing features. They do not establish that the Fiddle is correct, safe, or scientifically valid.
      .fiddle-metadata-grid
        article
          span Visualization
          strong {{ record.visualization }}
        article
          span Panel bytes
          strong {{ formatBytes(record.panelBytes.html) }} HTML
          small {{ formatBytes(record.panelBytes.js) }} JS / {{ formatBytes(record.panelBytes.css) }} CSS
        article
          span Controls
          strong {{ record.controls.length }} recorded controls
          small(v-if="record.controls.length === 0") No controls captured
        article
          span Assets
          strong {{ record.assets.length }} external references
          small(v-if="record.assets.length === 0") No asset references captured
      details.fiddle-disclosure
        summary Controls and assets
          span.disclosure-action Open +
        .fiddle-disclosure-body
          .fiddle-list-block
            h3 Recorded controls
            ul(v-if="record.controls.length")
              li(v-for="control in record.controls" :key="control")
                code {{ control }}
            p(v-else) No controls were captured in the archive metadata.
          .fiddle-list-block
            h3 Asset references
            ul(v-if="record.assets.length")
              li(v-for="asset in record.assets" :key="asset")
                code {{ asset }}
            p(v-else) No assets were captured in the archive metadata.

    section.fiddle-record-section
      .section-heading
        div
          p.eyebrow Browser capability flags
          h2 Inferred features
        p Flags are archive annotations. They are not a permission grant for this origin and do not predict whether an external preview will load.
      .fiddle-flags-grid
        article
          span Canvas count
          strong {{ record.flags.can }}
        article
          span SVG count
          strong {{ record.flags.svg }}
        article(v-for="flag in flagDefinitions" :key="flag.key")
          span {{ flag.label }}
          strong(:class="{ 'is-flagged': flagEnabled(flag.key) }") {{ formatFlagValue(flag.key) }}
      p.fiddle-active-flags(v-if="activeFlags.length") Active annotations: {{ activeFlags.map(({ label }) => label).join(', ') }}.

    FiddleLiveFrame(:key="record.slug" :record="record")

    nav.fiddle-record-navigation(aria-label="Adjacent archived Fiddle records")
      RouterLink.fiddle-adjacent(v-if="previousRecord" :to="recordLocation(previousRecord)")
        span Previous record
        strong Record {{ previousRecord.position }} / {{ previousRecord.title }}
      span.fiddle-adjacent.fiddle-adjacent-disabled(v-else) This is the first record
      RouterLink.fiddle-adjacent.fiddle-adjacent-next(v-if="nextRecord" :to="recordLocation(nextRecord)")
        span Next record
        strong Record {{ nextRecord.position }} / {{ nextRecord.title }}
      span.fiddle-adjacent.fiddle-adjacent-disabled(v-else) This is the final record
</template>
