import * as THREE from 'three'
import { deterministicGlyphIndices, fieldMagnitudes, fieldRange, fieldSampleCount, uniqueTagMap, type FieldRangeMode } from './results'
import type { DisplayGeometry, ResultField, SimulationScene } from './scene'

export function turbo(value: number) {
  const x = Math.min(1, Math.max(0, value))
  return new THREE.Color().setRGB(
    Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 3))),
    Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 2))),
    Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 1))),
  )
}

export interface ResultLayerState {
  fieldId?: string
  step: number
  time?: number
  range?: [number, number]
  glyphs: number
  deformationScale: 0
  colorSample?: number[]
  glyphMatrices?: number[][]
  glyphColors?: number[][]
  sceneDiagonal?: number
  glyphLengthRange?: [number, number]
  glyphRadiusRange?: [number, number]
}

export class ResultLayer {
  private glyphs?: THREE.InstancedMesh
  private field?: ResultField
  private step = 0
  private rangeMode: FieldRangeMode = 'global'
  private customRange?: [number, number]
  private state: ResultLayerState = { step: 0, glyphs: 0, deformationScale: 0 }
  private nodeByTag: Map<bigint, number>
  private elementCenters: Map<bigint, THREE.Vector3>
  private elementScales: Map<bigint, number>
  private sceneDiagonal: number

  constructor(
    private world: THREE.Scene,
    private mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
    private scene: SimulationScene,
    private display: DisplayGeometry,
  ) {
    this.nodeByTag = uniqueTagMap(scene.nodeTags, 'scene node')
    this.elementCenters = new Map()
    this.elementScales = new Map()
    const bounds = new THREE.Box3()
    for (let node = 0; node < scene.referencePositions.length / 3; node++) bounds.expandByPoint(new THREE.Vector3().fromArray(scene.referencePositions, node * 3))
    this.sceneDiagonal = bounds.getSize(new THREE.Vector3()).length()
    if (!(this.sceneDiagonal > 0)) throw new Error('result scene has zero spatial extent')
    for (const block of scene.elementBlocks) {
      if (!block.elementTags.length || block.connectivity.length % block.elementTags.length) throw new Error(`element block ${block.elementType} has invalid connectivity`)
      const nodes = block.connectivity.length / block.elementTags.length
      block.elementTags.forEach((tag, element) => {
        if (this.elementCenters.has(tag)) throw new Error(`scene contains duplicate element tag ${tag}`)
        const center = new THREE.Vector3()
        const points: THREE.Vector3[] = []
        for (let node = 0; node < nodes; node++) {
          const nodeTag = block.connectivity[element * nodes + node]!
          const index = this.nodeByTag.get(nodeTag)
          if (index === undefined) throw new Error(`element ${tag} references absent node ${nodeTag}`)
          const point = new THREE.Vector3().fromArray(scene.referencePositions, index * 3)
          points.push(point)
          center.add(point)
        }
        this.elementCenters.set(tag, center.multiplyScalar(1 / nodes))
        let localScale = 0
        for (let left = 0; left < points.length; left++) for (let right = left + 1; right < points.length; right++) localScale = Math.max(localScale, points[left]!.distanceTo(points[right]!))
        this.elementScales.set(tag, localScale)
      })
    }
  }

  set(field: ResultField | undefined, step: number, rangeMode: FieldRangeMode, customRange?: [number, number]) {
    this.field = field
    this.step = step
    this.rangeMode = rangeMode
    this.customRange = customRange
    this.removeGlyphs()
    this.mesh.geometry.deleteAttribute('color')
    this.mesh.material.vertexColors = false
    this.mesh.material.color.set(this.scene.source === 'gmsh-authoritative' ? 0x63cbd1 : 0xe6b85c)
    if (!field) {
      this.mesh.material.needsUpdate = true
      this.state = { step: 0, glyphs: 0, deformationScale: 0 }
      return
    }
    const range = fieldRange(field, step, rangeMode, customRange)
    this.state = { fieldId: field.id, step: field.steps[step]!, time: field.times[step]!, range, glyphs: 0, deformationScale: 0 }
    if (field.components === 1) this.applyScalar(field, range)
    if (field.components === 3) this.applyVectors(field, range)
    this.state.glyphs = this.glyphs?.count ?? 0
  }

  private applyScalar(field: ResultField, range: [number, number]) {
    const samples = fieldSampleCount(field)
    const values = fieldMagnitudes(field, this.step)
    const colors = new Float32Array(this.display.displayVertexToSourceNode.length * 3)
    const span = range[1] - range[0] || 1
    const tagIndex = uniqueTagMap(field.tags, `field ${field.id}`)
    for (let corner = 0; corner < this.display.displayVertexToSourceNode.length; corner++) {
      let sample = 0
      if (field.association === 'node') {
        const source = this.display.displayVertexToSourceNode[corner]!
        const tag = this.scene.nodeTags?.[source]
        if (tag === undefined || !tagIndex.has(tag)) throw new Error(`display node ${source} is absent from field ${field.id}`)
        sample = tagIndex.get(tag)!
      } else if (field.association === 'element') {
        const triangle = this.display.displayTriangleToSourceTriangle[Math.floor(corner / 3)]!
        const tag = this.scene.triangleElementTags?.[triangle]
        if (tag === undefined || !tagIndex.has(tag)) throw new Error(`display triangle ${triangle} is absent from field ${field.id}`)
        sample = tagIndex.get(tag)!
      } else continue
      if (sample < 0 || sample >= samples) continue
      const color = turbo((values[sample]! - range[0]) / span)
      color.toArray(colors, corner * 3)
    }
    this.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.mesh.material.vertexColors = true
    this.mesh.material.color.set(0xffffff)
    this.mesh.material.needsUpdate = true
    this.state.colorSample = Array.from(colors.slice(0, 12))
  }

  private applyVectors(field: ResultField, range: [number, number]) {
    if (field.association !== 'element' || !field.tags) return
    const samples = fieldSampleCount(field)
    const selected = deterministicGlyphIndices(samples, matchMedia('(max-width: 760px)').matches)
    const geometry = new THREE.ConeGeometry(1, 1, 6)
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, 0, 0.5)
    const material = new THREE.MeshBasicMaterial({ vertexColors: false })
    this.glyphs = new THREE.InstancedMesh(geometry, material, selected.length)
    uniqueTagMap(field.tags, `field ${field.id}`)
    const dummy = new THREE.Object3D()
    const direction = new THREE.Vector3()
    const color = new THREE.Color()
    const magnitudes = fieldMagnitudes(field, this.step)
    const span = range[1] - range[0] || 1
    let minLength = Infinity, maxLength = 0, minRadius = Infinity, maxRadius = 0
    for (let instance = 0; instance < selected.length; instance++) {
      const sample = selected[instance]!
      const offset = (this.step * samples + sample) * 3
      direction.set(field.values[offset]!, field.values[offset + 1]!, field.values[offset + 2]!)
      const magnitude = direction.length()
      const center = this.elementCenters.get(field.tags[sample]!)
      const localScale = this.elementScales.get(field.tags[sample]!)
      if (!center || localScale === undefined) throw new Error(`field element ${field.tags[sample]} is absent from the scene`)
      const relativeMagnitude = 0.35 + 0.65 * Math.min(1, Math.max(0, (magnitude - range[0]) / span))
      const nominalLength = Math.min(this.sceneDiagonal * 0.04, Math.max(this.sceneDiagonal * 0.006, localScale * 0.55))
      const length = Math.min(this.sceneDiagonal * 0.04, Math.max(this.sceneDiagonal * 0.003, nominalLength * relativeMagnitude))
      const radius = length * 0.12
      dummy.position.copy(center)
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), magnitude ? direction.normalize() : new THREE.Vector3(0, 0, 1))
      dummy.scale.set(radius, radius, length)
      dummy.updateMatrix()
      this.glyphs.setMatrixAt(instance, dummy.matrix)
      this.glyphs.setColorAt(instance, color.copy(turbo((magnitudes[sample]! - range[0]) / span)))
      minLength = Math.min(minLength, length); maxLength = Math.max(maxLength, length)
      minRadius = Math.min(minRadius, radius); maxRadius = Math.max(maxRadius, radius)
    }
    this.world.add(this.glyphs)
    const matrix = new THREE.Matrix4(), instanceColor = new THREE.Color()
    this.state.glyphMatrices = Array.from({ length: this.glyphs.count }, (_, index) => { this.glyphs!.getMatrixAt(index, matrix); return matrix.toArray() })
    this.state.glyphColors = Array.from({ length: this.glyphs.count }, (_, index) => { this.glyphs!.getColorAt(index, instanceColor); return instanceColor.toArray() })
    this.state.sceneDiagonal = this.sceneDiagonal
    this.state.glyphLengthRange = [minLength, maxLength]
    this.state.glyphRadiusRange = [minRadius, maxRadius]
  }

  getState() { return this.state }

  dispose() {
    this.removeGlyphs()
    this.mesh.geometry.deleteAttribute('color')
  }

  private removeGlyphs() {
    if (!this.glyphs) return
    this.world.remove(this.glyphs)
    this.glyphs.geometry.dispose()
    ;(this.glyphs.material as THREE.Material).dispose()
    this.glyphs = undefined
  }
}
