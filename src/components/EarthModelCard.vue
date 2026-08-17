<script setup lang="ts">
import type { EarthModelCardRecord } from '../earth/particleCampaign'

defineProps<{ card: EarthModelCardRecord }>()
</script>

<template lang="pug">
article.earth-model-card(
  :data-testid="`earth-model-card-${card.slug}`"
  :data-status="card.status"
)
  header
    code {{ card.slug }}
    strong {{ card.title }}
    span(:class="card.status === 'blocked' ? 'is-blocked' : 'is-runnable'") {{ card.status === 'blocked' ? 'Blocked' : 'Runnable' }}
  dl
    div
      dt What it is
      dd {{ card.whatItIs }}
    div
      dt What it is not
      dd {{ card.whatItIsNot }}
    div
      dt Status
      dd {{ card.statusNote }}
        |  validatesEarthTheory: false
</template>
