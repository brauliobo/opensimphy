<script setup lang="ts">
import { computed } from 'vue'
import type { WorkbenchSnapshotV1 } from '../../types/workbench'
import { compareSnapshotPair, type SnapshotPair } from '../../workbench/snapshots'

const props = withDefaults(defineProps<{
  pair: SnapshotPair
  headingLevel?: 'h3' | 'h4' | 'h5'
}>(), { headingLevel: 'h3' })
const comparison = computed(() => props.pair.length === 2 ? compareSnapshotPair(props.pair) : null)

function snapshotLabel(snapshot: WorkbenchSnapshotV1, index: number): string {
  const identity = snapshot.instrumentId ?? snapshot.programId
  return snapshot.label || `${identity} / ${snapshot.methodId}` || `Snapshot ${index + 1}`
}

function findingText(snapshot: WorkbenchSnapshotV1): string {
  return JSON.stringify(snapshot.finding, null, 2)
}
</script>

<template>
  <section class="workbench-compare" aria-label="Snapshot comparison" data-testid="workbench-compare">
    <p v-if="!comparison" class="workbench-compare-pending" role="status" aria-live="polite" aria-atomic="true" data-testid="workbench-compare-pending">
      Freeze two snapshots to compare them. {{ pair.length }} of 2 selected.
    </p>
    <template v-else>
      <p
        class="workbench-compare-status"
        :class="comparison.compatible ? 'is-compatible' : 'is-incompatible'"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="workbench-compare-status"
      >
        <template v-if="comparison.compatible">
          Compatible snapshots. Domain-specific quantities may be compared below.
        </template>
        <template v-else>
          Incompatible snapshots. Findings remain separate and no combined quantity is calculated.
        </template>
      </p>
      <div class="workbench-compare-findings">
        <article v-for="(snapshot, index) in comparison.snapshots" :key="snapshot.timestamp">
          <component :is="headingLevel">{{ snapshotLabel(snapshot, index) }}</component>
          <pre data-testid="workbench-compare-finding">{{ findingText(snapshot) }}</pre>
        </article>
      </div>
      <div v-if="comparison.compatible" class="workbench-domain-comparison" data-testid="workbench-domain-comparison">
        <slot
          name="domain-comparison"
          :comparison="comparison"
          :snapshots="comparison.snapshots"
        />
      </div>
    </template>
  </section>
</template>
