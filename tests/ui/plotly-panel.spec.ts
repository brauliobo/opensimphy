import { flushPromises, mount } from '@vue/test-utils'
import Plotly from 'plotly.js-dist-min'
import { isProxy, isReadonly, readonly } from 'vue'
import PlotlyPanel from '../../src/components/PlotlyPanel.vue'
import type { PlotFigure, PlotSurfaceSeries } from '../../src/types/plot'
import { figure } from './fixtures'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

function surfaceFigure(color: string, ratio: number): PlotFigure {
  const series: PlotSurfaceSeries = {
    kind:       'surface',
    x:          new Float64Array([0]),
    y:          [0],
    z:          [1],
    custom:     [[new Date('2026-01-01T00:00:00Z'), null]],
    colorScale: [{ at: 0, color }, { at: 1, color: '#ffffff' }],
  }
  return {
    series: [series],
    layout: { scene: { aspect: { x: ratio, y: 1, z: 1 } } },
  }
}

function immutableFigure(color: string, ratio: number): PlotFigure {
  return deepFreeze(surfaceFigure(color, ratio))
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('PlotlyPanel', () => {
  beforeEach(() => {
    vi.mocked(Plotly.react).mockReset().mockImplementation((renderTarget) => (
      Promise.resolve(renderTarget as Plotly.PlotlyHTMLElement)
    ))
    vi.mocked(Plotly.purge).mockReset()
  })

  it('publishes readiness only after the asynchronous renderer resolves', async () => {
    const wrapper = mount(PlotlyPanel, { props: { figure, label: 'Test sweep', testId: 'formula-graph-ready' } })
    expect(wrapper.find('[data-testid="formula-graph-ready"]').exists()).toBe(false)

    await flushPromises()

    expect(wrapper.get('[data-testid="formula-graph-ready"]').attributes('data-plot-state')).toBe('ready')
    expect(wrapper.emitted('ready')).toHaveLength(1)
  })

  it('detaches readonly figure inputs before Plotly mutates them', async () => {
    const react = vi.mocked(Plotly.react)
    const purge = vi.mocked(Plotly.purge)
    react.mockClear()
    purge.mockClear()

    const mutateNestedInputs = (...args: Parameters<typeof Plotly.react>): ReturnType<typeof Plotly.react> => {
      const data = args[1] as unknown as Array<{
        x: Float64Array
        customdata: unknown[][]
        colorscale: Array<[number, string]>
      }>
      const layout = args[2] as unknown as { scene: { aspectratio: { x: number } } }
      const config = args[3] as unknown as { scrollZoom: boolean }
      expect(ArrayBuffer.isView(data[0]?.x)).toBe(true)
      expect(data[0]?.x.constructor.name).toBe('Float64Array')
      expect(Object.prototype.toString.call(data[0]?.x.buffer)).toBe('[object ArrayBuffer]')
      expect(data[0]?.customdata[0]?.[0]).toBeInstanceOf(Date)
      expect(data[0]?.customdata[0]?.[1]).toBeNull()
      data[0]!.x[0] = 7
      data[0]!.colorscale[0]![1] = '#plotly-normalized'
      layout.scene.aspectratio.x = 9
      config.scrollZoom = false
      expect(data[0]!.colorscale[0]![1]).toBe('#plotly-normalized')
      expect(layout.scene.aspectratio.x).toBe(9)
      return Promise.resolve(args[0] as Plotly.PlotlyHTMLElement)
    }
    react.mockImplementationOnce(mutateNestedInputs).mockImplementationOnce(mutateNestedInputs)

    const firstSource = immutableFigure('#111111', 1)
    const secondSource = surfaceFigure('#222222', 2)
    const nestedReadonlyFigure = {
      ...secondSource,
      series: [readonly(secondSource.series[0]!)],
      layout: { ...secondSource.layout, scene: readonly(secondSource.layout!.scene!) },
    } as unknown as PlotFigure
    expect(isProxy(nestedReadonlyFigure)).toBe(false)
    expect(isReadonly(nestedReadonlyFigure.series[0])).toBe(true)
    expect(isReadonly(nestedReadonlyFigure.layout?.scene)).toBe(true)
    const wrapper = mount(PlotlyPanel, {
      props: { figure: readonly(firstSource) as unknown as PlotFigure, label: 'Readonly surface' },
    })
    await flushPromises()

    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.get('[data-testid="plot-ready"]').attributes('data-plot-state')).toBe('ready')
    expect(firstSource.series[0]).toMatchObject({
      kind:       'surface',
      colorScale: [{ at: 0, color: '#111111' }, { at: 1, color: '#ffffff' }],
    })
    expect(firstSource.series[0]?.x[0]).toBe(0)
    expect(firstSource.layout?.scene?.aspect?.x).toBe(1)

    await wrapper.setProps({ figure: nestedReadonlyFigure })
    await flushPromises()

    expect(wrapper.get('[data-testid="plot-ready"]').attributes('data-plot-state')).toBe('ready')
    expect(wrapper.emitted('ready')).toHaveLength(2)
    expect(secondSource.series[0]).toMatchObject({
      kind:       'surface',
      colorScale: [{ at: 0, color: '#222222' }, { at: 1, color: '#ffffff' }],
    })
    expect(secondSource.series[0]?.x[0]).toBe(0)
    expect(secondSource.layout?.scene?.aspect?.x).toBe(2)
    expect(react).toHaveBeenCalledTimes(2)
    expect(react.mock.calls[0]?.[1]).not.toBe(firstSource.series)
    expect(react.mock.calls[1]?.[1]).not.toBe(react.mock.calls[0]?.[1])

    const target = wrapper.get('.plot-target').element
    wrapper.unmount()
    expect(purge).toHaveBeenCalledWith(target)
  })

  it('publishes only the newest overlapping render', async () => {
    const react = vi.mocked(Plotly.react)
    const firstRender = deferred<Plotly.PlotlyHTMLElement>()
    const secondRender = deferred<Plotly.PlotlyHTMLElement>()
    react.mockReturnValueOnce(firstRender.promise).mockReturnValueOnce(secondRender.promise)
    const wrapper = mount(PlotlyPanel, {
      props: { figure: surfaceFigure('#111111', 1), label: 'Overlapping surface' },
    })
    await vi.waitFor(() => expect(react).toHaveBeenCalledTimes(1))

    await wrapper.setProps({ figure: surfaceFigure('#222222', 2) })
    await vi.waitFor(() => expect(react).toHaveBeenCalledTimes(2))
    const target = wrapper.get('.plot-target').element as Plotly.PlotlyHTMLElement
    secondRender.resolve(target)
    await flushPromises()

    expect(wrapper.emitted('ready')).toHaveLength(1)
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.get('[data-testid="plot-ready"]').attributes('data-plot-state')).toBe('ready')

    firstRender.resolve(target)
    await flushPromises()

    expect(wrapper.emitted('ready')).toHaveLength(1)
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(vi.mocked(Plotly.purge)).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores a stale error after a newer render succeeds', async () => {
    const react = vi.mocked(Plotly.react)
    const staleRender = deferred<Plotly.PlotlyHTMLElement>()
    const currentRender = deferred<Plotly.PlotlyHTMLElement>()
    react.mockReturnValueOnce(staleRender.promise).mockReturnValueOnce(currentRender.promise)
    const wrapper = mount(PlotlyPanel, {
      props: { figure: surfaceFigure('#111111', 1), label: 'Recovering surface' },
    })
    await vi.waitFor(() => expect(react).toHaveBeenCalledTimes(1))

    await wrapper.setProps({ figure: surfaceFigure('#222222', 2) })
    await vi.waitFor(() => expect(react).toHaveBeenCalledTimes(2))
    const target = wrapper.get('.plot-target').element as Plotly.PlotlyHTMLElement
    currentRender.resolve(target)
    await flushPromises()
    staleRender.reject(new Error('stale Plotly failure'))
    await flushPromises()

    expect(wrapper.emitted('ready')).toHaveLength(1)
    expect(wrapper.emitted('error')).toBeUndefined()
    expect(wrapper.get('[data-testid="plot-ready"]').attributes('data-plot-state')).toBe('ready')
    expect(vi.mocked(Plotly.purge)).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not render or emit when unmounted during the dynamic import', async () => {
    const wrapper = mount(PlotlyPanel, {
      props: { figure: surfaceFigure('#111111', 1), label: 'Unmounted surface' },
    })
    wrapper.unmount()
    await flushPromises()

    expect(Plotly.react).not.toHaveBeenCalled()
    expect(Plotly.purge).not.toHaveBeenCalled()
    expect(wrapper.emitted('ready')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
  })

  it('purges once and does not emit when unmounted during Plotly.react', async () => {
    const react = vi.mocked(Plotly.react)
    const pendingRender = deferred<Plotly.PlotlyHTMLElement>()
    react.mockReturnValueOnce(pendingRender.promise)
    const wrapper = mount(PlotlyPanel, {
      props: { figure: surfaceFigure('#111111', 1), label: 'Pending surface' },
    })
    await vi.waitFor(() => expect(react).toHaveBeenCalledTimes(1))
    const target = wrapper.get('.plot-target').element as Plotly.PlotlyHTMLElement

    wrapper.unmount()
    expect(Plotly.purge).toHaveBeenCalledTimes(1)
    expect(Plotly.purge).toHaveBeenCalledWith(target)

    pendingRender.resolve(target)
    await flushPromises()

    expect(Plotly.purge).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('ready')).toBeUndefined()
    expect(wrapper.emitted('error')).toBeUndefined()
  })
})
