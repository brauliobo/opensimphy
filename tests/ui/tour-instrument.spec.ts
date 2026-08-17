import { mount } from '@vue/test-utils'
import ConclusionBoundary from '../../src/components/tour/ConclusionBoundary.vue'
import DimensionBuilder from '../../src/components/tour/DimensionBuilder.vue'
import TourDepthControl from '../../src/components/tour/TourDepthControl.vue'
import {
  createTourProgressStorageKey,
  resetTourProgressForTests,
  setTourProgressDependenciesForTests,
  useTourProgress,
} from '../../src/registries/tourProgress'
import type { DimensionBuilderEvaluation } from '../../src/tour/dimensionEngine'
import type { ReadingDepth, TourGeneratedLessonRecord, TourGeneratedSimulation } from '../../src/types/tour'
import lessonJson from '../../public/data/generated/tour/lessons/physical-quantities.json'
import simulationJson from '../../public/data/generated/tour/simulations/dimensional-equation-builder.json'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function freshSimulation(): TourGeneratedSimulation {
  return structuredClone(simulationJson) as unknown as TourGeneratedSimulation
}

function mountBuilder(depth: ReadingDepth = 'guided', initialPresetId?: string) {
  return mount(DimensionBuilder, {
    props: {
      simulation: freshSimulation(),
      depth,
      ...(initialPresetId ? { initialPresetId } : {}),
    },
  })
}

async function reveal(wrapper: ReturnType<typeof mountBuilder>, prediction = 'matches-target'): Promise<void> {
  await wrapper.get(`[data-testid="prediction-${prediction}"]`).setValue(true)
  await wrapper.get('[data-testid="reveal-dimension-result"]').trigger('click')
}

describe('Tour interaction components', () => {
  afterEach(() => {
    resetTourProgressForTests()
    window.localStorage.clear()
  })

  it('hydrates, persists depth switches, and retains the current Tour position', async () => {
    const storage = new MemoryStorage()
    setTourProgressDependenciesForTests({ storage, baseUrl: '/physics/', now: () => '2026-07-26T12:00:00.000Z' })
    const progress = useTourProgress()
    progress.hydrate()
    progress.visitLesson('units', 'physical-quantities', '/tour/units/physical-quantities#builder')
    progress.setLastAnchor('physical-quantities', '#builder')

    const wrapper = mount(TourDepthControl)
    expect(wrapper.get('[data-testid="depth-control"]').attributes('aria-describedby')).toBeTruthy()
    expect((wrapper.get('[data-testid="reading-depth-guided"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="reading-depth-technical"]').attributes('aria-describedby')).toBeTruthy()

    await wrapper.get('[data-testid="reading-depth-technical"]').setValue(true)

    expect(progress.depth.value).toBe('technical')
    expect(progress.resume.value).toBe('/tour/units/physical-quantities#builder')
    expect(progress.state.value.lessons['physical-quantities']?.lastAnchor).toBe('#builder')
    expect(JSON.parse(storage.getItem(createTourProgressStorageKey('/physics/'))!).readingDepth).toBe('technical')
  })

  it('shows three contract-guided controls and adds magnitude plus full disclosure at Technical depth', async () => {
    const wrapper = mountBuilder()

    expect(wrapper.findAll('[data-testid^="builder-control-"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="builder-control-magnitude"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="technical-disclosure"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Target quantity kind')
    expect(wrapper.text()).toContain('Selects one bounded expression')
    expect(wrapper.get('[data-testid="guided-coordinate-disclosure"]').text()).toContain('fixed target-bound sample value of 2 m/s')
    expect(wrapper.get('[data-testid="guided-coordinate-disclosure"]').text()).toContain('International System of Units (SI)')
    expect(wrapper.get('[data-testid="guided-coordinate-disclosure"]').text()).toContain('not produced from measurements of the expression operands')
    expect(wrapper.get('[data-testid="dimension-coordinate"]').text()).toContain('centimetre-gram-second (CGS)')

    await wrapper.setProps({ depth: 'technical' })

    expect(wrapper.findAll('[data-testid^="builder-control-"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="guided-coordinate-disclosure"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="dimension-magnitude"]').attributes('min')).toBe('0.1')
    expect(wrapper.get('[data-testid="technical-disclosure"]').text()).toContain('International System of Quantities (ISQ)')
    expect(wrapper.get('[data-testid="technical-disclosure"]').findAll('ol li')).toHaveLength(7)
  })

  it('discloses the current hidden sample and target unit after returning to Guided depth', async () => {
    const wrapper = mountBuilder('technical')

    await wrapper.get('[data-testid="dimension-target"]').setValue('force')
    await wrapper.get('[data-testid="dimension-magnitude"]').setValue(7)
    await wrapper.setProps({ depth: 'guided' })

    const disclosure = wrapper.get('[data-testid="guided-coordinate-disclosure"]')
    expect(disclosure.text()).toContain('fixed target-bound sample value of 7 N')
    expect(disclosure.text()).not.toContain('sample value of 2')
  })

  it('requires a prediction, reveals without scoring, and exposes an accessible seven-axis result', async () => {
    const wrapper = mountBuilder()
    const revealButton = wrapper.get('[data-testid="reveal-dimension-result"]')

    expect(revealButton.attributes()).toHaveProperty('disabled')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.get('[data-testid="prediction-matches-target"]').setValue(true)
    expect(revealButton.attributes()).not.toHaveProperty('disabled')
    await revealButton.trigger('click')

    const emissions = wrapper.emitted<DimensionBuilderEvaluation[]>('evaluated')
    expect(emissions).toHaveLength(1)
    expect(emissions?.[0]?.[0]).toMatchObject({ operationStatus: 'defined', targetMatch: true })
    expect(wrapper.get('[data-testid="prediction-comparison"]').text()).toContain('The two align')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[data-testid="dimension-axis-table"]').find('caption').text()).toContain('International System of Quantities (ISQ)')
    expect(wrapper.get('[data-testid="dimension-axis-table"]').findAll('tbody tr')).toHaveLength(7)
    expect(wrapper.get('[data-testid="dimension-axis-table"]').findAll('tbody th[scope="row"]')).toHaveLength(7)
    expect(wrapper.text().toLowerCase()).not.toMatch(/score|mastery|points|streak/)
  })

  it('applies all scientific presets and supports an initial preset', async () => {
    const wrapper = mountBuilder()
    const cases = [
      ['average-speed-from-path', 'average-speed', 'path-length-over-elapsed-time'],
      ['force-from-motion', 'force', 'mass-times-acceleration'],
      ['energy-or-torque', 'torque', 'force-times-path-length'],
      ['unlike-sum', 'average-speed', 'length-plus-time'],
    ] as const

    for (const [presetId, target, expression] of cases) {
      await wrapper.get(`[data-testid="preset-${presetId}"]`).trigger('click')
      expect((wrapper.get('[data-testid="dimension-target"]').element as HTMLSelectElement).value).toBe(target)
      expect((wrapper.get('[data-testid="dimension-expression"]').element as HTMLSelectElement).value).toBe(expression)
    }
    expect(wrapper.text()).toContain('Race the clock')
    expect(wrapper.text()).toContain('Push a mass')
    expect(wrapper.text()).toContain('Same dimension, different kind')
    expect(wrapper.text()).toContain('Break the equation')
    expect(wrapper.get('[data-testid="preset-inspection-prompt"]').text()).toBe(simulationJson.presets[3]!.inspectionPrompt)
    expect(wrapper.text()).toContain(simulationJson.controls[0]!.playfulPrompt)

    const initial = mountBuilder('technical', 'energy-or-torque')
    expect((initial.get('[data-testid="dimension-target"]').element as HTMLSelectElement).value).toBe('torque')
    expect((initial.get('[data-testid="dimension-coordinate"]').element as HTMLSelectElement).value).toBe('mechanical-cgs')
  })

  it('updates immediately while making control and preset changes stale until a fresh prediction is revealed', async () => {
    const wrapper = mountBuilder()
    await reveal(wrapper)

    await wrapper.get('[data-testid="dimension-target"]').setValue('force')
    expect(wrapper.emitted('evaluated')).toHaveLength(2)
    expect(wrapper.get('[data-testid="target-match"]').text()).toContain('Different dimension')
    expect(wrapper.get('[data-testid="prediction-stale"]').text()).toContain('previous prediction is not compared')
    expect(wrapper.get('[data-testid="prediction-comparison"]').text()).toBe('')
    expect(wrapper.findAll('[data-testid^="prediction-"]:checked')).toHaveLength(0)

    await wrapper.get('[data-testid="dimension-expression"]').setValue('mass-times-acceleration')
    let emissions = wrapper.emitted<DimensionBuilderEvaluation[]>('evaluated')!
    expect(emissions).toHaveLength(3)
    expect(emissions[2]?.[0]).toMatchObject({ operationStatus: 'defined', targetMatch: true })
    expect(wrapper.get('[data-testid="target-match"]').text()).toContain('Dimensions match')

    await reveal(wrapper)
    emissions = wrapper.emitted<DimensionBuilderEvaluation[]>('evaluated')!
    expect(emissions).toHaveLength(4)
    expect(wrapper.find('[data-testid="prediction-stale"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="prediction-comparison"]').text()).toContain('The two align')

    await wrapper.get('[data-testid="preset-unlike-sum"]').trigger('click')
    emissions = wrapper.emitted<DimensionBuilderEvaluation[]>('evaluated')!
    expect(emissions).toHaveLength(5)
    expect(emissions[4]?.[0]).toMatchObject({ operationStatus: 'undefined-unlike-addition', targetMatch: false })
    expect(wrapper.find('[data-testid="prediction-stale"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="prediction-comparison"]').text()).toBe('')
  })

  it('renders the full live finding and runtime provenance without an empirical validation claim', async () => {
    const wrapper = mountBuilder()
    await reveal(wrapper)
    const finding = wrapper.get('[data-testid="dimension-finding-panel"]')

    expect(finding.findAll('h4').map((heading) => heading.text())).toEqual([
      'What changed',
      'Why',
      'Equation',
      'Assumptions',
      'Establishes',
      'Does not establish',
      'Evidence references',
    ])
    expect(wrapper.get('[data-testid="finding-result-status"]').text()).toBe('COMPUTED')
    expect(wrapper.get('[data-testid="finding-claim-class"]').text()).toBe('identity')
    expect(wrapper.get('[data-testid="finding-model-origin"]').text()).toBe('established-physics')
    expect(wrapper.get('[data-testid="finding-method-relationship"]').text()).toBe('contract-validator')
    expect(wrapper.get('[data-testid="finding-changed"]').text()).toContain('path length / elapsed time')
    expect(wrapper.get('[data-testid="finding-cause"]').text()).toContain('subtracts')
    expect(wrapper.get('[data-testid="finding-equation"]').text()).toContain('dim(A / B)')
    expect(wrapper.get('[data-testid="finding-assumptions"]').findAll('li')).toHaveLength(3)
    expect(wrapper.get('[data-testid="finding-establishes"]').text()).toContain('matches')
    expect(wrapper.get('[data-testid="finding-does-not-establish"]').text()).toContain('empirical validity')
    const emittedFinding = wrapper.emitted<DimensionBuilderEvaluation[]>('evaluated')![0]![0]!.finding
    expect(wrapper.get('[data-testid="finding-evidence-refs"]').findAll('li').map((item) => item.text())).toEqual(emittedFinding.evidenceRefs)
    expect(wrapper.get('[data-testid="finding-evidence-refs"]').findAll('a').map((link) => link.attributes('href')))
      .toEqual(emittedFinding.evidenceRefs.map((evidenceRef) => `#reference-${evidenceRef}`))
    expect(wrapper.get('[data-testid="finding-validation-boundary"]').text()).toContain('No empirical comparison or theory validation')
  })

  it('distinguishes invalid unlike addition from a defined dimension mismatch', async () => {
    const wrapper = mountBuilder('guided', 'unlike-sum')
    await reveal(wrapper, 'operation-undefined')

    expect(wrapper.get('[data-testid="operation-status"]').text()).toContain('Undefined')
    expect(wrapper.get('[data-testid="target-match"]').text()).toContain('Not applicable')
    expect(wrapper.get('[data-testid="coordinate-value"]').text()).toContain('operation is undefined')
    expect(wrapper.get('[data-testid="quantity-kind-caveat"]').text()).toContain('cannot rescue')
    expect(wrapper.get('[data-testid="dimension-axis-table"]').findAll('tbody td:nth-child(3)'))
      .toSatisfy((cells: ReturnType<typeof wrapper.findAll>) => cells.every((cell) => cell.text() === 'undefined'))
  })

  it('states that the shared energy and torque dimension does not establish quantity-kind identity', async () => {
    const wrapper = mountBuilder('guided', 'energy-or-torque')
    await reveal(wrapper)

    expect(wrapper.get('[data-testid="target-match"]').text()).toContain('quantity-kind identity is not established')
    expect(wrapper.get('[data-testid="quantity-kind-caveat"]').text()).toContain('energy and torque')
    expect(wrapper.get('[data-testid="quantity-kind-caveat"]').text()).toContain('cannot identify')
  })

  it('resets source defaults and clears both prediction and result', async () => {
    const wrapper = mountBuilder('technical', 'energy-or-torque')
    await reveal(wrapper)
    await wrapper.get('[data-testid="dimension-magnitude"]').setValue(8)
    expect(wrapper.emitted('evaluated')).toHaveLength(2)

    await wrapper.get('[data-testid="reset-dimension-builder"]').trigger('click')

    expect((wrapper.get('[data-testid="dimension-target"]').element as HTMLSelectElement).value).toBe('average-speed')
    expect((wrapper.get('[data-testid="dimension-expression"]').element as HTMLSelectElement).value).toBe('path-length-over-elapsed-time')
    expect((wrapper.get('[data-testid="dimension-coordinate"]').element as HTMLSelectElement).value).toBe('si')
    expect((wrapper.get('[data-testid="dimension-magnitude"]').element as HTMLInputElement).value).toBe('2')
    expect(wrapper.find('[data-testid="dimension-result"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="reveal-dimension-result"]').attributes()).toHaveProperty('disabled')
    expect(wrapper.findAll('[data-testid^="prediction-"]:checked')).toHaveLength(0)
  })

  it('fails closed on contract drift and never mutates source inputs', async () => {
    const simulation = freshSimulation()
    const original = structuredClone(simulation)
    const wrapper = mount(DimensionBuilder, { props: { simulation, depth: 'technical' } })
    await wrapper.get('[data-testid="preset-force-from-motion"]').trigger('click')
    await reveal(wrapper)
    await wrapper.get('[data-testid="dimension-magnitude"]').setValue(7)
    expect(simulation).toEqual(original)

    const incompatible = freshSimulation()
    const target = incompatible.controls.find((control) => control.id === 'target')
    if (target?.type === 'select') target.options.pop()
    const failed = mount(DimensionBuilder, { props: { simulation: incompatible, depth: 'guided' } })

    expect(failed.get('[role="alert"]').text()).toContain('cannot run')
    expect(failed.find('[data-testid="dimension-result"]').exists()).toBe(false)
    expect(failed.emitted('evaluated')).toBeUndefined()
  })

  it('keeps all six conclusion groups and exposes result status plus safe evidence links for every statement', () => {
    const lesson = lessonJson as unknown as TourGeneratedLessonRecord
    const statements = [
      ...lesson.seenInActivity,
      ...lesson.computedHere,
      ...lesson.reproducedFromSource,
      ...lesson.comparedWithEvidence,
      ...lesson.establishes,
      ...lesson.doesNotEstablish,
    ]
    const wrapper = mount(ConclusionBoundary, {
      props: {
        seenInActivity: lesson.seenInActivity,
        computedHere: lesson.computedHere,
        reproducedFromSource: lesson.reproducedFromSource,
        comparedWithEvidence: lesson.comparedWithEvidence,
        establishes: lesson.establishes,
        doesNotEstablish: lesson.doesNotEstablish,
      },
    })

    expect(wrapper.findAll('.conclusion-group')).toHaveLength(6)
    expect(wrapper.findAll('[data-testid="conclusion-result-status"]').map((status) => status.text()))
      .toEqual(statements.map(({ attribution }) => attribution.resultStatus))
    expect(wrapper.findAll('[data-testid="conclusion-evidence-refs"] a').map((link) => link.text()))
      .toEqual(statements.flatMap(({ attribution }) => attribution.evidenceRefs))
    expect(wrapper.findAll('[data-testid="conclusion-evidence-refs"] a').map((link) => link.attributes('href')))
      .toEqual(statements.flatMap(({ attribution }) => attribution.evidenceRefs.map((evidenceRef) => `#reference-${evidenceRef}`)))
    expect(wrapper.text()).toContain(lesson.seenInActivity[0]!.text)
  })
})
