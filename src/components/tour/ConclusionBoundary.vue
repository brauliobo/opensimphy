<script setup lang="ts">
import { computed } from 'vue'
import type { ConclusionStatement, ConclusionScope } from '../../types/tour'

const props = defineProps<{
  seenInActivity: Array<ConclusionStatement<'activity'>>
  computedHere: Array<ConclusionStatement<'computation'>>
  reproducedFromSource: Array<ConclusionStatement<'source'>>
  comparedWithEvidence: Array<ConclusionStatement<'empirical-evidence'>>
  establishes: Array<ConclusionStatement<'scientific-conclusion'>>
  doesNotEstablish: Array<ConclusionStatement<'scientific-conclusion'>>
}>()

interface ConclusionGroup {
  key: string
  label: string
  scope: ConclusionScope
  statements: ConclusionStatement[]
}

const groups = computed<ConclusionGroup[]>(() => [
  { key: 'seen', label: 'Seen in this activity', scope: 'activity', statements: props.seenInActivity },
  { key: 'computed', label: 'Computed here', scope: 'computation', statements: props.computedHere },
  { key: 'reproduced', label: 'Reproduced from source', scope: 'source', statements: props.reproducedFromSource },
  { key: 'evidence', label: 'Compared with evidence', scope: 'empirical-evidence', statements: props.comparedWithEvidence },
  { key: 'establishes', label: 'Establishes', scope: 'scientific-conclusion', statements: props.establishes },
  { key: 'limits', label: 'Does not establish', scope: 'scientific-conclusion', statements: props.doesNotEstablish },
])

function evidenceHref(evidenceRef: string): string {
  return `#reference-${evidenceRef}`
}
</script>

<template lang="pug">
.conclusion-boundary(data-testid="conclusion-boundary")
  article.conclusion-group(
    v-for="group in groups"
    :key="group.key"
    :data-conclusion-group="group.key"
    :data-scope="group.scope"
  )
    h3 {{ group.label }}
    ul
      li(v-for="statement in group.statements" :key="`${statement.scope}:${statement.text}`")
        p {{ statement.text }}
        details.tour-metadata
          summary Scope and attribution
          dl
            dt Scope
            dd {{ statement.scope }}
            dt Claim class
            dd {{ statement.attribution.claimClass }}
            dt Method relationship
            dd {{ statement.attribution.methodRelationship }}
            dt Model origin
            dd {{ statement.attribution.modelOrigin }}
            dt Result status
            dd(data-testid="conclusion-result-status") {{ statement.attribution.resultStatus }}
            dt Evidence references
            dd
              ul(data-testid="conclusion-evidence-refs")
                li(v-for="evidenceRef in statement.attribution.evidenceRefs" :key="evidenceRef")
                  a(:href="evidenceHref(evidenceRef)") {{ evidenceRef }}
            dt Source revision
            dd {{ statement.attribution.sourceRevision }}
            dt Source locator
            dd {{ statement.attribution.sourceLocator }}
          ul(v-if="statement.attribution.caveats.length")
            li(v-for="caveat in statement.attribution.caveats" :key="caveat") {{ caveat }}
</template>

<style scoped>
.conclusion-boundary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.conclusion-group {
  padding: 1rem;
  border: 1px solid var(--line, #494949);
}

.conclusion-group h3 {
  margin-top: 0;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}

.conclusion-group > ul {
  margin-bottom: 0;
  padding-left: 1.15rem;
}

.tour-metadata {
  font-size: 0.8rem;
  opacity: 0.82;
}

.tour-metadata dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 0.65rem;
}

.tour-metadata dd {
  margin: 0;
}

@media (max-width: 720px) {
  .conclusion-boundary {
    grid-template-columns: 1fr;
  }
}
</style>
