<script setup lang="ts">
import type { WorkbenchFindingV1 } from '../../types/workbench'

withDefaults(defineProps<{
  finding: WorkbenchFindingV1
  headingLevel?: 'h3' | 'h4' | 'h5'
}>(), { headingLevel: 'h3' })
</script>

<template>
  <article class="workbench-finding" data-testid="workbench-finding">
    <dl class="workbench-finding-summary">
      <div>
        <dt>What changed</dt>
        <dd data-testid="finding-changed">{{ finding.changed }}</dd>
      </div>
      <div>
        <dt>Cause</dt>
        <dd data-testid="finding-cause">{{ finding.cause }}</dd>
      </div>
      <div>
        <dt>Equation</dt>
        <dd><code data-testid="finding-equation">{{ finding.equation }}</code></dd>
      </div>
    </dl>

    <section>
      <component :is="headingLevel">Assumptions</component>
      <ul data-testid="finding-assumptions">
        <li v-for="assumption in finding.assumptions" :key="assumption">{{ assumption }}</li>
      </ul>
    </section>

    <div class="workbench-finding-boundary">
      <section>
        <component :is="headingLevel">Establishes</component>
        <p data-testid="finding-establishes">{{ finding.establishes }}</p>
      </section>
      <section>
        <component :is="headingLevel">Does not establish</component>
        <p data-testid="finding-does-not-establish">{{ finding.doesNotEstablish }}</p>
      </section>
    </div>

    <details class="workbench-disclosure workbench-finding-provenance">
      <summary>Finding provenance</summary>
      <div class="workbench-disclosure-body">
        <dl>
          <div>
            <dt>Claim class</dt>
            <dd>{{ finding.provenance.claimClass }}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{{ finding.provenance.sourceLocator }}</dd>
          </div>
          <div>
            <dt>Source revision</dt>
            <dd>{{ finding.provenance.sourceRevision }}</dd>
          </div>
          <div>
            <dt>Method relationship</dt>
            <dd>{{ finding.provenance.methodRelationship }}</dd>
          </div>
          <div>
            <dt>Model origin</dt>
            <dd>{{ finding.provenance.modelOrigin }}</dd>
          </div>
          <div>
            <dt>Result status</dt>
            <dd>{{ finding.provenance.resultStatus }}</dd>
          </div>
          <div>
            <dt>Validates theory</dt>
            <dd><code data-testid="finding-validates-theory">false</code></dd>
          </div>
          <div>
            <dt>Evidence references</dt>
            <dd>{{ finding.provenance.evidenceRefs.join(', ') }}</dd>
          </div>
          <div v-if="finding.provenance.implementationRevision">
            <dt>Implementation revision</dt>
            <dd>{{ finding.provenance.implementationRevision }}</dd>
          </div>
          <div v-if="finding.provenance.modelRevision">
            <dt>Model revision</dt>
            <dd>{{ finding.provenance.modelRevision }}</dd>
          </div>
          <div v-if="finding.provenance.contentRevision">
            <dt>Content revision</dt>
            <dd>{{ finding.provenance.contentRevision }}</dd>
          </div>
          <div v-if="finding.provenance.outputSchemaRevision">
            <dt>Output schema revision</dt>
            <dd>{{ finding.provenance.outputSchemaRevision }}</dd>
          </div>
        </dl>
        <component :is="headingLevel" v-if="finding.provenance.caveats.length">Caveats</component>
        <ul v-if="finding.provenance.caveats.length">
          <li v-for="caveat in finding.provenance.caveats" :key="caveat">{{ caveat }}</li>
        </ul>
      </div>
    </details>
  </article>
</template>
