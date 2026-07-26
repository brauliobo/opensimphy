<script setup lang="ts">
import { computed } from 'vue'
import { formatScalar, humanizeKey, isJsonObject } from '../earth/workbench'

const props = defineProps<{ value: unknown }>()
const entries = computed(() => isJsonObject(props.value) ? Object.entries(props.value) : [])
</script>

<template lang="pug">
ol.earth-structured-list(v-if="Array.isArray(value)")
  li(v-for="(item, index) in value" :key="index")
    span.earth-structured-index {{ index + 1 }}
    EarthStructuredValue(:value="item")
dl.earth-structured-object(v-else-if="entries.length")
  template(v-for="([key, item]) in entries" :key="key")
    dt {{ humanizeKey(key) }}
    dd
      EarthStructuredValue(:value="item")
span.earth-structured-empty(v-else-if="value && typeof value === 'object'") Empty structure
span.earth-structured-scalar(v-else) {{ formatScalar(value) }}
</template>
