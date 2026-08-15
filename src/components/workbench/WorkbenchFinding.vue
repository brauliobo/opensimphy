<script setup lang="ts">
import type { WorkbenchFindingV1 } from '../../types/workbench'

withDefaults(defineProps<{
  finding: WorkbenchFindingV1
  headingLevel?: 'h3' | 'h4' | 'h5'
}>(), { headingLevel: 'h3' })
</script>

<template lang="pug">
article.workbench-finding(data-testid="workbench-finding")
  dl.workbench-finding-summary
    div
      dt What changed
      dd(data-testid="finding-changed") {{ finding.changed }}
    div
      dt Cause
      dd(data-testid="finding-cause") {{ finding.cause }}
    div
      dt Equation
      dd
        code(data-testid="finding-equation") {{ finding.equation }}

  section
    component(:is="headingLevel") Assumptions
    ul(data-testid="finding-assumptions")
      li(v-for="assumption in finding.assumptions" :key="assumption") {{ assumption }}

  .workbench-finding-boundary
    section
      component(:is="headingLevel") Establishes
      p(data-testid="finding-establishes") {{ finding.establishes }}
    section
      component(:is="headingLevel") Does not establish
      p(data-testid="finding-does-not-establish") {{ finding.doesNotEstablish }}

  details.workbench-disclosure.workbench-finding-provenance
    summary Finding provenance
    .workbench-disclosure-body
      dl
        div
          dt Claim class
          dd {{ finding.provenance.claimClass }}
        div
          dt Source
          dd {{ finding.provenance.sourceLocator }}
        div
          dt Source revision
          dd {{ finding.provenance.sourceRevision }}
        div
          dt Method relationship
          dd {{ finding.provenance.methodRelationship }}
        div
          dt Model origin
          dd {{ finding.provenance.modelOrigin }}
        div
          dt Result status
          dd {{ finding.provenance.resultStatus }}
        div
          dt Validates theory
          dd
            code(data-testid="finding-validates-theory") false
        div
          dt Evidence references
          dd {{ finding.provenance.evidenceRefs.join(', ') }}
        div(v-if="finding.provenance.implementationRevision")
          dt Implementation revision
          dd {{ finding.provenance.implementationRevision }}
        div(v-if="finding.provenance.modelRevision")
          dt Model revision
          dd {{ finding.provenance.modelRevision }}
        div(v-if="finding.provenance.contentRevision")
          dt Content revision
          dd {{ finding.provenance.contentRevision }}
        div(v-if="finding.provenance.outputSchemaRevision")
          dt Output schema revision
          dd {{ finding.provenance.outputSchemaRevision }}
      component(v-if="finding.provenance.caveats.length" :is="headingLevel") Caveats
      ul(v-if="finding.provenance.caveats.length")
        li(v-for="caveat in finding.provenance.caveats" :key="caveat") {{ caveat }}
</template>
