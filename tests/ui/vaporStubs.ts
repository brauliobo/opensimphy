import { createSlot, defineVaporComponent, insert, renderEffect } from 'vue'
import type { ReadingDepth, TourGeneratedSimulation } from '../../src/types/tour'

export const emptyVaporView = defineVaporComponent({
  name: 'EmptyVaporView',
  setup() {
    return document.createElement('div')
  },
})

export const computeLabRoute = {
  path: '/labs/compute',
  name: 'compute' as const,
  component: emptyVaporView,
  meta: { title: 'Compute Lab' },
}

export const vaporAnchorStub = defineVaporComponent({
  name: 'VaporAnchorStub',
  setup() {
    const el = document.createElement('a')
    insert(createSlot('default'), el)
    return el
  },
})

export const depthControlStub = defineVaporComponent({
  name: 'TourDepthControlStub',
  setup() {
    const el = document.createElement('div')
    el.dataset.testid = 'depth-control-stub'
    el.textContent = 'Reading depth'
    return el
  },
})

export function tourInstrumentStub(testId: string) {
  return defineVaporComponent({
    name: 'TourInstrumentStub',
    props: ['simulation', 'depth', 'initialPresetId'],
    emits: ['evaluated'],
    setup(props: {
      simulation: TourGeneratedSimulation
      depth: ReadingDepth
      initialPresetId?: string
    }, { emit }) {
      const root = document.createElement('div')
      root.dataset.instrumentStub = ''
      const input = document.createElement('input')
      input.dataset.testid = 'instrument-control'
      input.value = 'initial'
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.testid = testId
      renderEffect(() => {
        button.dataset.simulation = props.simulation.id
        button.dataset.depth = props.depth
        if (props.initialPresetId === undefined) delete button.dataset.preset
        else button.dataset.preset = props.initialPresetId
      })
      button.addEventListener('click', () => emit('evaluated', props.simulation.id))
      root.append(input, button)
      return root
    },
  })
}
