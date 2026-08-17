import { DEFAULT_PLOT_VIEWPORT, boundsOf, seriesFromPoints } from '../../src/simphy/plot'
import { seriesPoints, toSvgCircles, toSvgPolylines } from '../../src/render/svg'

describe('SVG adapter', () => {
  it('projects generic line series and skips surfaces', () => {
    const line = seriesFromPoints('curve', [{ x: 0, y: 0 }, { x: 2, y: 2 }], { testId: 'curve' })
    const surface = {
      kind: 'surface' as const,
      x:    [0, 1],
      y:    [0, 1],
      z:    [1, 2],
    }
    const points = seriesPoints([line, surface])
    const bounds = boundsOf(points)
    const polylines = toSvgPolylines([line, surface], bounds, DEFAULT_PLOT_VIEWPORT)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 2, y: 2 }])
    expect(polylines).toHaveLength(1)
    expect(polylines[0]).toMatchObject({ id: 'curve', testId: 'curve' })
    expect(polylines[0]?.points.split(' ')).toHaveLength(2)
  })

  it('projects overlay circles into the same viewport', () => {
    const bounds = boundsOf([{ x: 0, y: 0 }, { x: 2, y: 2 }])
    const [circle] = toSvgCircles([{ id: 'ball', x: 1, y: 1, r: 0.2, testId: 'ball' }], bounds)
    expect(circle).toMatchObject({ id: 'ball', testId: 'ball' })
    expect(circle?.cx).toBeCloseTo(320)
    expect(circle?.cy).toBeCloseTo(140)
  })
})
