import { mount } from '@vue/test-utils'
import WorkbenchCompare from '../../src/components/workbench/WorkbenchCompare.vue'
import WorkbenchFinding from '../../src/components/workbench/WorkbenchFinding.vue'
import WorkbenchShell from '../../src/components/workbench/WorkbenchShell.vue'
import type {
  WorkbenchFindingV1,
  WorkbenchSnapshotInputV1,
} from '../../src/types/workbench'
import { createSnapshotPair, createWorkbenchSnapshot } from '../../src/workbench/snapshots'

const provenance = {
  claimClass:        'established-model',
  evidenceRefs:      ['source-one'],
  sourceRevision:    'source-v1',
  sourceLocator:     'Source table 1',
  methodRelationship: 'traditional-baseline',
  modelOrigin:       'established-physics',
  resultStatus:      'computed',
  caveats:           ['Bounded inputs only.'],
} as const

const finding: WorkbenchFindingV1 = {
  schemaVersion:       1,
  changed:             'The output increased by 2.',
  cause:               'The input radius increased.',
  equation:            'A = pi r^2',
  assumptions:         ['Euclidean geometry', 'Finite radius'],
  establishes:         'The declared model output changed.',
  doesNotEstablish:    'The model is empirically validated.',
  provenance,
  validatesTheory:     false,
}

function shellProps(overrides: Record<string, unknown> = {}) {
  return {
    title:          'Bounded instrument',
    identity:       'instrument-one',
    provenance,
    conclusion:     'This result is conditional on the declared model.',
    executionMode:  'manual' as const,
    status:         'completed' as const,
    progress:       100,
    capabilities:   { save: true, compare: true },
    snapshotCount:  1 as const,
    hasResult:      true,
    ...overrides,
  }
}

function snapshot(
  label: string,
  timestamp: string,
  compatibilityKey = 'a'.repeat(64),
): ReturnType<typeof createWorkbenchSnapshot> {
  const input: WorkbenchSnapshotInputV1 = {
    instrumentId:          'instrument-one',
    methodId:              'method-one',
    inputs:                { radius: 2 },
    outputs:               { area: 4 },
    finding:               { changed: `${label} changed` },
    provenance:            { source: '<script>inert</script>' },
    sourceRevision:        'source-v1',
    implementationRevision: 'implementation-v1',
    compatibilityKey,
    label,
  }
  return createWorkbenchSnapshot(input, timestamp)
}

describe('WorkbenchShell', () => {
  it('emits manual actions and exposes capability-driven snapshot actions', async () => {
    const wrapper = mount(WorkbenchShell, { props: shellProps() })

    await wrapper.get('[data-testid="workbench-run"]').trigger('click')
    await wrapper.get('[data-testid="workbench-reset"]').trigger('click')
    await wrapper.get('[data-testid="workbench-save"]').trigger('click')
    await wrapper.get('[data-testid="workbench-freeze"]').trigger('click')
    await wrapper.get('[data-testid="workbench-clear-compare"]').trigger('click')

    expect(wrapper.emitted('run')).toHaveLength(1)
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('freeze')).toHaveLength(1)
    expect(wrapper.emitted('clear-compare')).toHaveLength(1)
    expect(wrapper.get('[data-testid="workbench-conclusion"]').text()).toContain('conditional')
    expect(wrapper.get('.workbench-instrument-title').element.tagName).toBe('H1')
  })

  it('shows cancel only while a manual execution is running and reports bounded progress', async () => {
    const wrapper = mount(WorkbenchShell, {
      props: shellProps({ status: 'running', progress: 37, hasResult: false }),
    })

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('37')
    expect(wrapper.get('[role="status"]').text()).toBe('Running, 37% complete.')
    await wrapper.get('[data-testid="workbench-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('uses honest non-button states for route evaluation and unavailable execution', () => {
    const routeEvaluated = mount(WorkbenchShell, {
      props: shellProps({ executionMode: 'route-evaluated', status: 'idle', hasResult: false }),
    })
    expect(routeEvaluated.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(routeEvaluated.get('[data-testid="workbench-mode-status"]').text()).toContain('evaluates the result')
    expect(routeEvaluated.find('[data-testid="workbench-reset"]').exists()).toBe(true)

    const unavailable = mount(WorkbenchShell, {
      props: shellProps({
        executionMode:    'unavailable',
        status:           'unavailable',
        unavailableReason: 'Required source inputs are unavailable.',
        hasResult:        false,
      }),
    })
    expect(unavailable.find('[data-testid="workbench-run"]').exists()).toBe(false)
    expect(unavailable.find('[data-testid="workbench-cancel"]').exists()).toBe(false)
    expect(unavailable.get('[data-testid="workbench-mode-status"]').text()).toContain('source inputs')
  })

  it('keeps reset explicit and explains disabled save and comparison actions', () => {
    const noResult = mount(WorkbenchShell, {
      props: shellProps({
        status:        'idle',
        capabilities:  { save: false, compare: false },
        snapshotCount: 0,
        hasResult:     false,
      }),
    })

    expect(noResult.get('[data-testid="workbench-reset"]').attributes('disabled')).toBeUndefined()
    expect(noResult.get('[data-testid="workbench-save"]').attributes()).toHaveProperty('disabled')
    expect(noResult.get('[data-testid="workbench-freeze"]').attributes()).toHaveProperty('disabled')
    expect(noResult.text()).toContain('Saving is not available')
    expect(noResult.text()).toContain('Comparison is not available')

    const fullPair = mount(WorkbenchShell, { props: shellProps({ snapshotCount: 2 }) })
    expect(fullPair.get('[data-testid="workbench-freeze"]').attributes()).toHaveProperty('disabled')
    expect(fullPair.text()).toContain('already contains two snapshots')

    const error = mount(WorkbenchShell, { props: shellProps({ actionErrors: { save: 'Storage failed.' } }) })
    expect(error.get('.workbench-action-errors').attributes('role')).toBe('alert')
  })

  it('announces rejected URL state outside the scientific result', () => {
    const wrapper = mount(WorkbenchShell, {
      props: shellProps({ stateWarning: 'Requested URL state was rejected. Canonical defaults were restored.' }),
    })

    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="workbench-url-state-warning"]').text()).toContain('rejected')
  })

  it('keeps nested instrument and section heading levels ordered', () => {
    const wrapper = mount(WorkbenchShell, { props: shellProps({ headingLevel: 'h3' }) })
    expect(wrapper.get('.workbench-instrument-title').element.tagName).toBe('H3')
    expect(wrapper.findAll('.workbench-section-title').every((heading) => heading.element.tagName === 'H4')).toBe(true)
  })

  it('keeps the mobile semantic region DOM order without JavaScript movement', () => {
    const wrapper = mount(WorkbenchShell, {
      props: shellProps(),
      slots: {
        stage:                '<div>stage</div>',
        'essential-controls': '<label>essential <input /></label>',
        findings:             '<div>findings</div>',
        controls:             '<label>full <input /></label>',
        evidence:             '<div>evidence</div>',
        raw:                  '<pre>raw</pre>',
      },
    })
    const order = wrapper.findAll('.workbench-region').map((region) => (
      [...region.element.classList].find((name) => name.startsWith('workbench-region-'))
    ))

    expect(order).toEqual([
      'workbench-region-stage',
      'workbench-region-essential',
      'workbench-region-actions',
      'workbench-region-findings',
      'workbench-region-controls',
      'workbench-region-evidence',
      'workbench-region-raw',
    ])
  })
})

describe('WorkbenchFinding', () => {
  it('renders the full structured conclusion boundary and explicit theory-validation state', () => {
    const wrapper = mount(WorkbenchFinding, { props: { finding } })

    expect(wrapper.get('[data-testid="finding-changed"]').text()).toBe(finding.changed)
    expect(wrapper.get('[data-testid="finding-cause"]').text()).toBe(finding.cause)
    expect(wrapper.get('[data-testid="finding-equation"]').text()).toBe(finding.equation)
    expect(wrapper.get('[data-testid="finding-assumptions"]').text()).toContain('Euclidean geometry')
    expect(wrapper.get('[data-testid="finding-establishes"]').text()).toBe(finding.establishes)
    expect(wrapper.get('[data-testid="finding-does-not-establish"]').text()).toBe(finding.doesNotEstablish)
    expect(wrapper.get('[data-testid="finding-validates-theory"]').text()).toBe('false')
  })

  it('supports nested finding heading levels', () => {
    const wrapper = mount(WorkbenchFinding, { props: { finding, headingLevel: 'h5' } })
    expect(wrapper.findAll('h5')).toHaveLength(4)
    expect(wrapper.find('h3').exists()).toBe(false)
  })
})

describe('WorkbenchCompare', () => {
  it('announces comparison snapshot progress', () => {
    const wrapper = mount(WorkbenchCompare, { props: { pair: createSnapshotPair() } })
    expect(wrapper.get('[data-testid="workbench-compare-pending"]').attributes('role')).toBe('status')
  })

  it('shows compatible findings and renders only the domain comparison slot', () => {
    const pair = createSnapshotPair([
      snapshot('Baseline', '2026-07-27T10:00:00.000Z'),
      snapshot('Variant', '2026-07-27T10:01:00.000Z'),
    ])
    const wrapper = mount(WorkbenchCompare, {
      props: { pair },
      slots: { 'domain-comparison': '<output data-testid="domain-output">Domain difference: 2</output>' },
    })

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Compatible')
    expect(wrapper.get('[data-testid="workbench-compare-status"]').attributes('role')).toBe('status')
    expect(wrapper.findAll('[data-testid="workbench-compare-finding"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Baseline')
    expect(wrapper.text()).toContain('Variant')
    expect(wrapper.get('[data-testid="domain-output"]').text()).toContain('Domain difference')
    expect(wrapper.text().toLowerCase()).not.toContain('residual')
  })

  it('supports nested comparison heading levels', () => {
    const pair = createSnapshotPair([
      snapshot('Baseline', '2026-07-27T10:00:00.000Z'),
      snapshot('Variant', '2026-07-27T10:01:00.000Z'),
    ])
    const wrapper = mount(WorkbenchCompare, { props: { pair, headingLevel: 'h5' } })
    expect(wrapper.findAll('h5')).toHaveLength(2)
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('keeps incompatible findings parallel and does not render a merged domain quantity', () => {
    const pair = createSnapshotPair([
      snapshot('Baseline', '2026-07-27T10:00:00.000Z'),
      snapshot('Other method', '2026-07-27T10:01:00.000Z', 'b'.repeat(64)),
    ])
    const wrapper = mount(WorkbenchCompare, {
      props: { pair },
      slots: { 'domain-comparison': '<output data-testid="domain-output">Must not render</output>' },
    })

    expect(wrapper.get('[data-testid="workbench-compare-status"]').text()).toContain('Incompatible')
    expect(wrapper.findAll('[data-testid="workbench-compare-finding"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="domain-output"]').exists()).toBe(false)
    expect(wrapper.text().toLowerCase()).not.toContain('residual')
    expect(wrapper.find('script').exists()).toBe(false)
  })
})
