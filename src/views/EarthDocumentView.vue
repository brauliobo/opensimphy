<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EarthLocalNav from '../components/EarthLocalNav.vue'
import { loadEarthDocument, loadEarthManifest, type EarthDocumentRecord, type EarthDocumentShard } from '../earth/corpus'
import { loadEarthDocumentEvidence, loadEarthEvidenceManifest, type EarthDocumentEvidenceShard } from '../earth/evidence'
import { earthReadingBlocks, sourceLineLabel } from '../earth/reading'

const props = defineProps<{ slug: string }>()
const route = useRoute()
const router = useRouter()
const record = ref<EarthDocumentRecord | null>(null)
const shard = ref<EarthDocumentShard | null>(null)
const evidence = ref<EarthDocumentEvidenceShard | null>(null)
const error = ref('')
const viewMode = computed(() => route.query.view === 'source' ? 'source' : 'reading')
const readingBlocks = computed(() => shard.value ? earthReadingBlocks(shard.value.document) : [])

const sourceLines = computed(() => {
  if (!shard.value) return []
  const headings = new Map(shard.value.document.structure.headings.map((heading) => [heading.line, `source-${heading.id}`]))
  return (shard.value.document.sanitizedMarkdown.match(/[^\n]*\n|[^\n]+$/g) ?? []).map((text, index) => ({
    text,
    anchor: headings.get(index + 1),
  }))
})

function formatBytes(value: number): string {
  return `${value.toLocaleString('en-US')} B`
}

function currentHeadingAnchor(): string | null {
  const hashAnchor = route.hash.slice(1)
  if (hashAnchor && document.getElementById(hashAnchor)) return hashAnchor
  const anchors = [...document.querySelectorAll<HTMLElement>('[data-heading-anchor]')]
  let nearest: HTMLElement | null = null
  for (const anchor of anchors) {
    if (anchor.getBoundingClientRect().top <= 180) nearest = anchor
    else break
  }
  return nearest?.id || null
}

async function revealAnchor(anchor: string, focus = false): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else resolve()
  })
  const target = document.getElementById(anchor)
  if (!target) return
  if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' })
  if (focus) target.focus({ preventScroll: true })
}

async function setViewMode(mode: 'reading' | 'source'): Promise<void> {
  if (viewMode.value === mode && route.query.view === mode) return
  const anchor = currentHeadingAnchor()
  const scrollTop = window.scrollY
  await router.replace({
    query: { ...route.query, view: mode },
    hash:  anchor ? `#${anchor}` : route.hash,
  })
  if (anchor) await revealAnchor(anchor)
  else if (scrollTop > 0) window.scrollTo({ top: scrollTop })
}

async function navigateToHeading(anchor: string): Promise<void> {
  await router.replace({ query: route.query, hash: `#${anchor}` })
  await revealAnchor(anchor, true)
}

watch(() => route.query.view, (view) => {
  if (view !== 'reading' && view !== 'source') {
    void router.replace({ query: { ...route.query, view: 'reading' }, hash: route.hash })
  }
}, { immediate: true })

watch([shard, () => route.hash], ([loaded, hash]) => {
  if (loaded && hash) void revealAnchor(hash.slice(1))
})

watch(() => props.slug, async (slug, _previous, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  record.value = null
  shard.value = null
  evidence.value = null
  error.value = ''
  try {
    const manifest = await loadEarthManifest(controller.signal)
    const match = manifest.documents.find((document) => document.slug === slug)
    if (!match) throw new Error(`Unknown locked EARTH document: ${slug}`)
    record.value = match
    const evidenceManifest = await loadEarthEvidenceManifest(manifest.sourceRevision, {
      documentIds: manifest.documents.map(({ id }) => id),
    }, controller.signal)
    const evidenceEntry = evidenceManifest.documents.find(({ id }) => id === match.id)
    if (!evidenceEntry) throw new Error(`Missing EARTH evidence document: ${match.id}`)
    const [loadedShard, loadedEvidence] = await Promise.all([
      loadEarthDocument(match, controller.signal),
      loadEarthDocumentEvidence(evidenceEntry, evidenceManifest, controller.signal),
    ])
    shard.value = loadedShard
    evidence.value = loadedEvidence
  } catch (reason) {
    if (controller.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}, { immediate: true })
</script>

<template lang="pug">
.view.earth-document-view
  EarthLocalNav
  RouterLink.earth-back-link(to="/earth/corpus") ← 03/B EARTH corpus index
  p.inline-error(v-if="error" role="alert") {{ error }}
  p.earth-loading(v-else-if="!record || !shard" aria-live="polite") Loading locked document shard…

  template(v-else)
    header.earth-document-header
      .earth-document-heading
        p.eyebrow 03/B / {{ record.classification.collection }} / read-only source
        h1 {{ record.title }}
        p {{ record.source.path }}
      .earth-document-audit
        strong UNREVIEWED SOURCE CLAIMS
        span SHA256 {{ record.source.sha256 }}
        span {{ formatBytes(record.source.bytes) }} / {{ record.source.lineCount }} lines
        span {{ record.counts.formulas }} formula records / {{ record.counts.codeBlocks }} inert code blocks

    section.caveat-banner(data-testid="earth-document-caveat")
      strong TEXT-ONLY / NO EXECUTION
      p Exact source is authoritative for source wording and line positions; reading view is only a derived structural aid. Raw HTML remains escaped, remote images remain omitted, and fenced code is text only. SHA256 identifies the locked original Markdown, not this sanitized display shard.

    section.earth-reading-controls(aria-label="Document view")
      .earth-view-toggle(role="group" aria-label="Reading mode")
        button(
          type="button"
          data-testid="earth-reading-mode"
          :aria-pressed="viewMode === 'reading'"
          @click="setViewMode('reading')"
        ) Reading view
        button(
          type="button"
          data-testid="earth-source-mode"
          :aria-pressed="viewMode === 'source'"
          @click="setViewMode('source')"
        ) Exact source
      p {{ viewMode === 'reading' ? 'Text-only structure derived from the sanitized shard.' : 'Authoritative source wording and line positions in an inert text display.' }}

    section.document-evidence-ledger(data-testid="document-evidence-ledger")
      header
        div
          p.eyebrow Canonical program relations
          h2 {{ evidence?.summary.relatedCanonicalPrograms ?? 0 }} related programs
        p A candidate source record is not an executable method. Counts below describe source-to-program coverage assignments, not successful runs or scientific validation.
      .document-program-links
        RouterLink(v-for="program in evidence?.canonicalPrograms" :key="program.programId" :to="`/earth/programs/${encodeURIComponent(program.programId)}`")
          strong {{ program.programId }}
          span {{ program.counts.total }} assignments · {{ program.counts.bySourceType.formula }} formula / {{ program.counts.bySourceType['code-block'] }} code / {{ program.counts.bySourceType['simulation-candidate'] }} simulation
          small confidence {{ program.counts.byConfidence.high }} high / {{ program.counts.byConfidence.medium }} medium / {{ program.counts.byConfidence.low }} low
      p.document-classification-note(v-if="evidence?.summary.classifiedAssignments")
        strong {{ evidence.summary.classifiedAssignments }} classified records retained:
        |  {{ evidence.summary.classificationCounts.duplicate }} duplicate / {{ evidence.summary.classificationCounts['blocked-source-fragment'] }} blocked source / {{ evidence.summary.classificationCounts['non-scientific-example'] }} non-scientific example

    .earth-reader-layout
      aside.earth-outline
        p.eyebrow Source outline
        ol
          li(v-for="heading in shard.document.structure.headings" :key="heading.id" :class="`level-${heading.level}`")
            span L{{ heading.line }}
            a(:href="`#source-${heading.id}`" @click.prevent="navigateToHeading(`source-${heading.id}`)") {{ heading.text }}
        .earth-diagnostics(v-if="shard.document.diagnostics.length")
          p.eyebrow Preserved diagnostics
          p(v-for="diagnostic in shard.document.diagnostics" :key="`${diagnostic.code}-${diagnostic.line}`")
            code {{ diagnostic.code }} at L{{ diagnostic.line }}:{{ diagnostic.column }}
      article.earth-reading-panel(v-if="viewMode === 'reading'" data-testid="earth-document-reading")
        .earth-source-label
          span Structural reading view
          code text nodes only / derived
        .earth-reading-content
          template(v-for="(block, index) in readingBlocks" :key="`${block.kind}-${block.startLine}-${index}`")
            component.earth-reading-heading(
              v-if="block.kind === 'heading'"
              :is="`h${block.level}`"
              :id="block.anchor"
              tabindex="-1"
              data-heading-anchor="true"
            )
              small {{ sourceLineLabel(block.startLine, block.endLine) }}
              span {{ block.text }}
            .earth-reading-block(v-else-if="block.kind === 'paragraph'")
              small {{ sourceLineLabel(block.startLine, block.endLine) }}
              p {{ block.text }}
            .earth-reading-block.is-list(v-else-if="block.kind === 'list'")
              small {{ sourceLineLabel(block.startLine, block.endLine) }}
              component(:is="block.ordered ? 'ol' : 'ul'")
                li(v-for="item in block.items" :key="item.line")
                  span {{ item.text }}
                  small L{{ item.line }}
            .earth-reading-block.is-code(v-else-if="block.kind === 'code'")
              small {{ sourceLineLabel(block.startLine, block.endLine) }} · inert code{{ block.language ? ` / ${block.language}` : '' }}
              pre
                code {{ block.text }}
            .earth-reading-block.is-formula(v-else)
              small {{ sourceLineLabel(block.startLine, block.endLine) }} · displayed formula text
              pre {{ block.text }}
      article.earth-source-panel(v-else)
        .earth-source-label
          span Exact source / inert sanitized display
          code {{ record.source.encoding }} / rev locked
        pre.earth-source-text(
          data-testid="earth-document-source"
          :data-source-sha256="record.source.sha256"
        )
          span(
            v-for="(line, index) in sourceLines"
            :id="line.anchor"
            :key="index"
            :data-heading-anchor="line.anchor ? 'true' : undefined"
            :tabindex="line.anchor ? -1 : undefined"
          ) {{ line.text }}
</template>
