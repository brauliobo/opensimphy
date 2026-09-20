<script setup lang="ts">
import { computed } from 'vue'
import { parameterTree, type ParameterTreeNode } from '../../simulation/parameter-tree'
import { parameterChanged, type OnelabParameter } from '../../simulation/onelab-db'

defineOptions({ name: 'OnelabParameterTree' })

const props = withDefaults(defineProps<{
  parameters?: OnelabParameter[]
  nodes?: ParameterTreeNode[]
  running: boolean
  nested?: boolean
}>(), { nested: false })

const emit = defineEmits<{
  edit: [parameter: OnelabParameter, event: Event]
}>()

const tree = computed(() => props.nodes ?? parameterTree(props.parameters ?? []))

function choiceLabel(parameter: Extract<OnelabParameter, { type: 'number' }>, value: number) {
  return Object.entries(parameter.valueLabels ?? {}).find(([, candidate]) => candidate === value)?.[0] ?? String(value)
}

function testId(name: string) {
  return `parameter-${name.split('/').at(-1)?.toLowerCase().replaceAll(' ', '-')}`
}
</script>

<template lang="pug">
component(:is="nested ? 'div' : 'section'" :class="nested ? 'onelab-tree-children' : 'onelab-parameters'" :data-testid="nested ? undefined : 'onelab-parameters'")
  details.onelab-tree(v-for="node in tree" :key="node.path" open)
    summary {{ node.label }}
    label.onelab-parameter(
      v-for="parameter in node.parameters"
      v-show="parameter.visible"
      :key="parameter.name"
      :class="{ 'is-changed': parameterChanged(parameter) > 0, 'is-readonly': parameter.readOnly }"
      :data-testid="testId(parameter.name)"
      :data-name="parameter.name"
      :data-changed="parameterChanged(parameter)"
    )
      span {{ parameter.label ?? parameter.name }}
      select(
        v-if="parameter.type === 'number' && parameter.choices?.length"
        :value="parameter.values[0]"
        :disabled="parameter.readOnly || running"
        @change="emit('edit', parameter, $event)"
      )
        option(v-for="choice in parameter.choices" :key="choice" :value="choice") {{ choiceLabel(parameter, choice) }}
      select(
        v-else-if="parameter.type === 'string' && parameter.choices?.length"
        :value="parameter.values[0]"
        :disabled="parameter.readOnly || running"
        @change="emit('edit', parameter, $event)"
      )
        option(v-for="choice in parameter.choices" :key="choice" :value="choice") {{ choice }}
      input(
        v-else-if="parameter.type === 'number'"
        type="number"
        :value="parameter.values[0]"
        :min="parameter.min"
        :max="parameter.max"
        :step="parameter.step || 'any'"
        :readonly="parameter.readOnly"
        :disabled="running"
        @change="emit('edit', parameter, $event)"
      )
      input(
        v-else
        type="text"
        :value="parameter.values[0]"
        :readonly="parameter.readOnly"
        :disabled="running"
        @change="emit('edit', parameter, $event)"
      )
      small(v-if="parameter.help") {{ parameter.help }}
    OnelabParameterTree(v-if="node.children.length" nested :nodes="node.children" :running="running" @edit="(parameter, event) => emit('edit', parameter, event)")
</template>
