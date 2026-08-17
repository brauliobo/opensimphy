import type { CaseMetric } from '../cases/types'
import { seriesFromPoints, type PlotPoint } from '../simphy/plot'
import type { PlotLineSeries } from '../types/plot'
import {
  astropyFigure,
  canteraFigure,
  fluidEngineDevFigure,
  galpyFigure,
  ncollideFigure,
  newtonFigure,
  physxFigure,
  pymunkFigure,
  quantumOpticsJlFigure,
  raysectFigure,
  scikitBeamFigure,
  type CaseFigureTable,
} from './caseFigures'
import type { AwesomePhysicsCasePageId } from './casePages'

const MISMATCH_NAMES: Record<AwesomePhysicsCasePageId, string> = {
  'awesome-scikit-beam':        'the scikit-beam lesson figure',
  'awesome-raysect':            'the raysect lesson figure',
  'awesome-quantumoptics-jl':   'the QuantumOptics.jl lesson figure',
  'awesome-astropy':            'the astropy lesson figure',
  'awesome-pymunk':             'the pymunk lesson figure',
  'awesome-galpy':              'the galpy lesson figure',
  'awesome-physx-3-4':          'the PhysX lesson figure',
  'awesome-newton-dynamics':    'the Newton Dynamics lesson figure',
  'awesome-ncollide':           'the ncollide lesson figure',
  'awesome-fluid-engine-dev':   'the fluid-engine-dev lesson figure',
  'awesome-cantera':            'the Cantera lesson figure',
}

export function awesomePhysicsCaseMismatchName(catalogItemId: string): string {
  return MISMATCH_NAMES[catalogItemId as AwesomePhysicsCasePageId] ?? 'the lesson figure'
}

export interface CasePlotCircle {
  id: string
  x: number
  y: number
  r: number
  testId?: string
}

export interface CasePlotPolygon {
  id: string
  points: readonly PlotPoint[]
  testId?: string
}

export interface CasePlotView {
  title: string
  description: string
  xLabel: string
  yLabel: string
  series: readonly PlotLineSeries[]
  extraPolygons?: readonly CasePlotPolygon[]
  extraCircles?: readonly CasePlotCircle[]
  equalAspect?: boolean
  testId: string
}

export interface CaseView {
  testId: string
  metricsTestId: string
  mismatchName: string
  metrics: readonly CaseMetric[]
  plot?: CasePlotView
  table?: CaseFigureTable
}

function view(
  slug: string,
  mismatchName: string,
  metrics: readonly CaseMetric[],
  extras: { plot?: CasePlotView, table?: CaseFigureTable } = {},
): CaseView {
  return {
    testId:         `awesome-case-${slug}`,
    metricsTestId:  `awesome-case-${slug}-metrics`,
    mismatchName,
    metrics,
    plot:           extras.plot,
    table:          extras.table,
  }
}

function sphereDropPlot(
  slug: string,
  title: string,
  description: string,
  groundId: string,
  ground: readonly PlotPoint[],
  circle: CasePlotCircle,
  y: number | null,
): CasePlotView | undefined {
  if (typeof y !== 'number') return undefined
  return {
    title,
    description,
    xLabel:        'x',
    yLabel:        'y',
    series:        [seriesFromPoints(groundId, ground, { testId: `awesome-case-${slug}-${groundId}` })],
    extraCircles:  [{ ...circle, y }],
    equalAspect:   true,
    testId:        `awesome-case-${slug}-plot`,
  }
}

export function awesomePhysicsCaseView(catalogItemId: string, result: unknown): CaseView | null {
  if (catalogItemId === 'awesome-scikit-beam') {
    const figure = scikitBeamFigure(result)
    if (!figure) return null
    return view('scikit-beam', 'the scikit-beam lesson figure', figure.metrics, {
      plot: {
        title:       figure.operation === 'lag-correlation' ? 'Lag correlation' : 'Sphere form factor I(q)',
        description: figure.operation === 'lag-correlation'
          ? 'Normalized linear lag correlation C(k) with C(0) = 1.'
          : 'Rayleigh-Gans sphere intensity I(q) = |F(q)|² on the declared q grid.',
        xLabel: figure.xLabel,
        yLabel: figure.yLabel,
        series: figure.series,
        testId: 'awesome-case-scikit-beam-plot',
      },
      table: figure.table,
    })
  }
  if (catalogItemId === 'awesome-raysect') {
    const figure = raysectFigure(result)
    if (!figure) return null
    return view('raysect', 'the raysect lesson figure', figure.metrics, {
      plot: {
        title:           'Cauchy prism Snell trace',
        description:     'Four-point 2D polyline through an isosceles prism. Total internal reflection is rejected, not approximated.',
        xLabel:          'x',
        yLabel:          'y',
        series:          [seriesFromPoints('ray', figure.ray, { testId: 'awesome-case-raysect-ray' })],
        extraPolygons:   [{ id: 'prism', points: figure.prism, testId: 'awesome-case-raysect-prism' }],
        equalAspect:     true,
        testId:          'awesome-case-raysect-plot',
      },
    })
  }
  if (catalogItemId === 'awesome-quantumoptics-jl') {
    const figure = quantumOpticsJlFigure(result)
    if (!figure) return null
    return view('quantumoptics-jl', 'the QuantumOptics.jl lesson figure', figure.metrics, {
      plot: {
        title:       'Jaynes-Cummings excited population',
        description: 'Closed-form single-excitation vacuum Rabi oscillation. This TypeScript stand-in is not Julia or QuantumOptics.jl.',
        xLabel:      'time',
        yLabel:      'P_e',
        series:      figure.series,
        testId:      'awesome-case-quantumoptics-jl-plot',
      },
      table: figure.table,
    })
  }
  if (catalogItemId === 'awesome-astropy') {
    const figure = astropyFigure(result)
    if (!figure) return null
    const marker = figure.marker
    return view('astropy', 'the astropy lesson figure', figure.metrics, {
      plot: marker ? {
        title:          'ICRS to Galactic',
        description:    'Reid and Brunthaler NGP rotation. No precession, proper motion, or observer location is applied.',
        xLabel:         'l (deg)',
        yLabel:         'b (deg)',
        series:         [],
        extraPolygons:  [{ id: 'frame', points: [{ x: 0, y: -90 }, { x: 360, y: -90 }, { x: 360, y: 90 }, { x: 0, y: 90 }] }],
        extraCircles:   [{ id: 'galactic', x: marker.x, y: marker.y, r: 8, testId: 'awesome-case-astropy-marker' }],
        testId:         'awesome-case-astropy-plot',
      } : undefined,
    })
  }
  if (catalogItemId === 'awesome-pymunk') {
    const figure = pymunkFigure(result)
    if (!figure) return null
    return view('pymunk', 'the pymunk lesson figure', figure.metrics, {
      plot: {
        title:         'Chipmunk headless ball',
        description:   'Verified pymunk WASM snapshot. Ground is y = 0. A finite fixture is not a physical-theory validation.',
        xLabel:        'x',
        yLabel:        'y',
        series:        [seriesFromPoints('ground', [{ x: -1.5, y: 0 }, { x: 1.5, y: 0 }], { testId: 'awesome-case-pymunk-ground' })],
        extraCircles:  [{ id: 'ball', x: figure.x, y: figure.y, r: 0.2, testId: 'awesome-case-pymunk-ball' }],
        equalAspect:   true,
        testId:        'awesome-case-pymunk-plot',
      },
    })
  }
  if (catalogItemId === 'awesome-galpy') {
    const figure = galpyFigure(result)
    if (!figure) return null
    return view('galpy', 'the galpy lesson figure', figure.metrics, {
      plot: figure.series.length ? {
        title:       'MWPotential2014 meridional orbit',
        description: 'Leapfrog samples in natural units. Energy and Lz drifts are finite-run diagnostics, not observational agreement.',
        xLabel:      'R',
        yLabel:      'z',
        series:      figure.series,
        testId:      'awesome-case-galpy-plot',
      } : undefined,
      table: figure.table ?? undefined,
    })
  }
  if (catalogItemId === 'awesome-physx-3-4') {
    const figure = physxFigure(result)
    if (!figure) return null
    return view('physx', 'the PhysX lesson figure', figure.metrics, {
      plot: sphereDropPlot(
        'physx',
        'PhysX 3.4 headless sphere',
        'Verified PhysX 3.4 WASM snapshot. Ground is the y = 0 plane. A finite fixture is not a physical-theory validation.',
        'ground',
        [{ x: -4, y: 0 }, { x: 4, y: 0 }],
        { id: 'sphere', x: 0, y: 0, r: 1, testId: 'awesome-case-physx-sphere' },
        figure.y,
      ),
    })
  }
  if (catalogItemId === 'awesome-newton-dynamics') {
    const figure = newtonFigure(result)
    if (!figure) return null
    return view('newton', 'the Newton Dynamics lesson figure', figure.metrics, {
      plot: sphereDropPlot(
        'newton',
        'Newton Dynamics headless sphere',
        'Verified Newton Dynamics WASM snapshot. Origin is y = 0. A finite fixture is not a physical-theory validation.',
        'origin',
        [{ x: -4, y: 0 }, { x: 4, y: 0 }],
        { id: 'sphere', x: 0, y: 0, r: 1, testId: 'awesome-case-newton-sphere' },
        figure.y,
      ),
    })
  }
  if (catalogItemId === 'awesome-ncollide') {
    const figure = ncollideFigure(result)
    if (!figure) return null
    return view('ncollide', 'the ncollide lesson figure', figure.metrics, {
      plot: sphereDropPlot(
        'ncollide',
        'ncollide2d CCD plane settle',
        'Verified ncollide2d WASM snapshot. Plane is y = -0.75. A finite CCD fixture is not a physical-theory validation.',
        'plane',
        [{ x: -2, y: -0.75 }, { x: 2, y: -0.75 }],
        { id: 'ball', x: 0, y: 0, r: 0.25, testId: 'awesome-case-ncollide-ball' },
        figure.y,
      ),
    })
  }
  if (catalogItemId === 'awesome-fluid-engine-dev') {
    const figure = fluidEngineDevFigure(result)
    if (!figure) return null
    return view('fluid-engine-dev', 'the fluid-engine-dev lesson figure', figure.metrics, {
      plot: sphereDropPlot(
        'fluid-engine-dev',
        'Jet 2D SPH step',
        'Verified fluid-engine-dev WASM snapshot. Origin is y = 0. A finite SPH fixture is not a physical-theory validation.',
        'origin',
        [{ x: -4, y: 0 }, { x: 4, y: 0 }],
        { id: 'jet', x: 0, y: 0, r: 0.25, testId: 'awesome-case-fluid-engine-dev-jet' },
        figure.y,
      ),
    })
  }
  if (catalogItemId === 'awesome-cantera') {
    const figure = canteraFigure(result)
    if (!figure) return null
    const title = figure.operation === 'thermo'
      ? 'Cantera ohmech thermo'
      : figure.operation === 'reactor'
        ? 'Cantera zero-D reactor'
        : 'Cantera HP equilibrium'
    return view('cantera', 'the Cantera lesson figure', figure.metrics, {
      plot: {
        title,
        description:   'Verified Cantera WASM snapshot. A finite H2/O2 fixture is not a kinetics or mechanism validation.',
        xLabel:        figure.xLabel,
        yLabel:        figure.yLabel,
        series:        [],
        extraCircles:  [{ id: 'state', x: figure.marker.x, y: figure.marker.y, r: 8, testId: 'awesome-case-cantera-marker' }],
        testId:        'awesome-case-cantera-plot',
      },
    })
  }
  return null
}
