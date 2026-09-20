import type { ComplexValue } from '../types/engine'
import { argument, magnitude } from '../engine/complex'
import {
  BRANCH_POINTS,
  SPECIAL_A,
  formatComplex,
  stereographic,
  type MobiusChart,
  type MonodromyResult,
  type PartitionRoot,
} from './partitionEngine'

export type MainTab = 'roots' | 'mobius' | 'cross-ratio' | 'monodromy' | 'riemann'
export type RootsSub = 'roots' | 'angles' | 'magnitudes'
export type RiemannSub = 'surface' | 'planar' | 'root-paths' | 'real-locus' | 'imaginary-locus' | 'sheet-cuts'

const ROOT_COLORS = ['#f5d76e', '#7ad4ff', '#f2a65a', '#c5a7ff']
const AXIS = 'rgba(245, 239, 224, 0.35)'
const GRID = 'rgba(245, 239, 224, 0.12)'
const INK = '#f5efe0'

export interface DrawModel {
  tab: MainTab
  rootsSub: RootsSub
  riemannSub: RiemannSub
  a: number
  roots: readonly PartitionRoot[]
  charts: readonly MobiusChart[]
  unique: readonly ComplexValue[]
  chartIndex: number
  monodromy: MonodromyResult
  locus: readonly { a: number; roots: ComplexValue[] }[]
}

function clear(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#0c0e0f'
  ctx.fillRect(0, 0, width, height)
}

function mapPlane(width: number, height: number, scale: number): (z: ComplexValue) => { x: number; y: number } {
  const cx = width / 2
  const cy = height / 2
  const px = Math.min(width, height) * 0.42 / scale
  return (z) => ({ x: cx + z.re * px, y: cy - z.im * px })
}

function axes(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number): void {
  const at = mapPlane(width, height, scale)
  ctx.strokeStyle = AXIS
  ctx.lineWidth = 1
  ctx.beginPath()
  const left = at({ re: -scale, im: 0 })
  const right = at({ re: scale, im: 0 })
  const down = at({ re: 0, im: -scale })
  const up = at({ re: 0, im: scale })
  ctx.moveTo(left.x, left.y)
  ctx.lineTo(right.x, right.y)
  ctx.moveTo(down.x, down.y)
  ctx.lineTo(up.x, up.y)
  ctx.stroke()
  ctx.strokeStyle = GRID
  for (let tick = -Math.floor(scale); tick <= Math.floor(scale); tick += 1) {
    if (tick === 0) continue
    const x = at({ re: tick, im: 0 })
    const y = at({ re: 0, im: tick })
    ctx.beginPath()
    ctx.moveTo(x.x, x.y - 4)
    ctx.lineTo(x.x, x.y + 4)
    ctx.moveTo(y.x - 4, y.y)
    ctx.lineTo(y.x + 4, y.y)
    ctx.stroke()
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label?: string): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fill()
  if (!label) return
  ctx.fillStyle = INK
  ctx.font = '12px ui-monospace, monospace'
  ctx.fillText(label, x + 8, y - 8)
}

function rootScale(roots: readonly PartitionRoot[]): number {
  const max = Math.max(4, ...roots.map((root) => root.radius), SPECIAL_A.branch)
  return Math.ceil(max + 0.5)
}

export function drawExplorer(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  clear(ctx, width, height)
  if (model.tab === 'roots') drawRoots(ctx, width, height, model)
  else if (model.tab === 'mobius') drawMobius(ctx, width, height, model)
  else if (model.tab === 'cross-ratio') drawCrossRatio(ctx, width, height, model)
  else if (model.tab === 'monodromy') drawMonodromy(ctx, width, height, model)
  else drawRiemann(ctx, width, height, model)
}

function drawRoots(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const scale = rootScale(model.roots)
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  if (model.rootsSub === 'magnitudes') {
    model.roots.forEach((root, index) => {
      ctx.strokeStyle = ROOT_COLORS[index]!
      ctx.beginPath()
      ctx.arc(width / 2, height / 2, (Math.min(width, height) * 0.42 / scale) * root.radius, 0, Math.PI * 2)
      ctx.stroke()
    })
  }
  model.roots.forEach((root, index) => {
    const point = at(root.value)
    if (model.rootsSub === 'angles') {
      ctx.strokeStyle = ROOT_COLORS[index]!
      ctx.beginPath()
      ctx.moveTo(width / 2, height / 2)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
    dot(ctx, point.x, point.y, ROOT_COLORS[index]!, root.label)
  })
}

function drawMobius(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const chart = model.charts[model.chartIndex]
  if (!chart) return
  const scale = Math.max(2, ...model.unique.map((value) => magnitude(value)), magnitude(chart.lambda)) + 0.5
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  const marks = [
    { z: { re: 0, im: 0 }, label: '0' },
    { z: { re: 1, im: 0 }, label: '1' },
    { z: chart.lambda, label: 'λ' },
  ]
  marks.forEach((mark) => {
    const point = at(mark.z)
    dot(ctx, point.x, point.y, mark.label === 'λ' ? ROOT_COLORS[chart.lambdaIndex]! : INK, mark.label)
  })
  ctx.fillStyle = AXIS
  ctx.font = '12px ui-monospace, monospace'
  ctx.fillText('∞ is the missing vertex of the ideal tetrahedron', 16, height - 18)
  model.unique.forEach((value, index) => {
    const point = at(value)
    ctx.strokeStyle = ROOT_COLORS[index % ROOT_COLORS.length]!
    ctx.beginPath()
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2)
    ctx.stroke()
  })
}

function drawCrossRatio(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const scale = Math.max(2, ...model.unique.map((value) => magnitude(value))) + 0.5
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  ctx.strokeStyle = AXIS
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.42 / scale, 0, Math.PI * 2)
  ctx.stroke()
  model.unique.forEach((value, index) => {
    const point = at(value)
    dot(ctx, point.x, point.y, ROOT_COLORS[index % ROOT_COLORS.length]!, `λ${index + 1}`)
  })
}

function drawMonodromy(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const scale = rootScale(model.roots)
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  model.monodromy.trails.forEach((trail, index) => {
    ctx.strokeStyle = ROOT_COLORS[index]!
    ctx.beginPath()
    trail.forEach((point, step) => {
      const mapped = at(point)
      if (step === 0) ctx.moveTo(mapped.x, mapped.y)
      else ctx.lineTo(mapped.x, mapped.y)
    })
    ctx.stroke()
  })
  model.roots.forEach((root, index) => {
    const point = at(root.value)
    dot(ctx, point.x, point.y, ROOT_COLORS[index]!, root.label)
  })
}

function drawRiemann(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  if (model.riemannSub === 'planar' || model.riemannSub === 'sheet-cuts') {
    drawPlanar(ctx, width, height, model)
    return
  }
  if (model.riemannSub === 'root-paths' || model.riemannSub === 'real-locus' || model.riemannSub === 'imaginary-locus') {
    drawLocus(ctx, width, height, model)
    return
  }
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.38
  ctx.strokeStyle = AXIS
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
  BRANCH_POINTS.forEach((point, index) => {
    const sphere = stereographic(point.a)
    const x = cx + sphere.x * radius
    const y = cy - sphere.y * radius
    dot(ctx, x, y, ROOT_COLORS[index]!, point.label)
  })
  const current = stereographic({ re: model.a, im: 0 })
  dot(ctx, cx + current.x * radius, cy - current.y * radius, INK, 'a')
}

function drawPlanar(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const scale = Math.max(4, SPECIAL_A.branch + 1)
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  BRANCH_POINTS.forEach((point, index) => {
    const mapped = at(point.a)
    if (model.riemannSub === 'sheet-cuts') {
      ctx.strokeStyle = ROOT_COLORS[index]!
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(width / 2, height / 2)
      ctx.lineTo(mapped.x, mapped.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    dot(ctx, mapped.x, mapped.y, ROOT_COLORS[index]!, point.label)
  })
  const current = at({ re: model.a, im: 0 })
  dot(ctx, current.x, current.y, INK, 'a')
}

function drawLocus(ctx: CanvasRenderingContext2D, width: number, height: number, model: DrawModel): void {
  const samples = model.riemannSub === 'imaginary-locus'
    ? model.locus.map((row) => ({ a: row.a, roots: row.roots.map((root) => ({ re: argument(root), im: magnitude(root) })) }))
    : model.locus
  const values = samples.flatMap((row) => row.roots)
  const scale = Math.max(4, ...values.map((value) => Math.max(Math.abs(value.re), Math.abs(value.im))))
  const at = mapPlane(width, height, scale)
  axes(ctx, width, height, scale)
  for (let sheet = 0; sheet < 4; sheet += 1) {
    ctx.strokeStyle = ROOT_COLORS[sheet]!
    ctx.beginPath()
    samples.forEach((row, index) => {
      const mapped = at(row.roots[sheet]!)
      if (index === 0) ctx.moveTo(mapped.x, mapped.y)
      else ctx.lineTo(mapped.x, mapped.y)
    })
    ctx.stroke()
  }
}

export { ROOT_COLORS }
