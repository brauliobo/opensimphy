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

<template>
  <div class="conclusion-boundary" data-testid="conclusion-boundary">
    <article
      v-for="group in groups"
      :key="group.key"
      class="conclusion-group"
      :data-conclusion-group="group.key"
      :data-scope="group.scope"
    >
      <h3>{{ group.label }}</h3>
      <ul>
        <li v-for="statement in group.statements" :key="`${statement.scope}:${statement.text}`">
          <p>{{ statement.text }}</p>
          <details class="tour-metadata">
            <summary>Scope and attribution</summary>
            <dl>
              <dt>Scope</dt>
              <dd>{{ statement.scope }}</dd>
              <dt>Claim class</dt>
              <dd>{{ statement.attribution.claimClass }}</dd>
              <dt>Method relationship</dt>
              <dd>{{ statement.attribution.methodRelationship }}</dd>
              <dt>Model origin</dt>
              <dd>{{ statement.attribution.modelOrigin }}</dd>
              <dt>Result status</dt>
              <dd data-testid="conclusion-result-status">{{ statement.attribution.resultStatus }}</dd>
              <dt>Evidence references</dt>
              <dd>
                <ul data-testid="conclusion-evidence-refs">
                  <li v-for="evidenceRef in statement.attribution.evidenceRefs" :key="evidenceRef">
                    <a :href="evidenceHref(evidenceRef)">{{ evidenceRef }}</a>
                  </li>
                </ul>
              </dd>
              <dt>Source revision</dt>
              <dd>{{ statement.attribution.sourceRevision }}</dd>
              <dt>Source locator</dt>
              <dd>{{ statement.attribution.sourceLocator }}</dd>
            </dl>
            <ul v-if="statement.attribution.caveats.length">
              <li v-for="caveat in statement.attribution.caveats" :key="caveat">{{ caveat }}</li>
            </ul>
          </details>
        </li>
      </ul>
    </article>
  </div>
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
