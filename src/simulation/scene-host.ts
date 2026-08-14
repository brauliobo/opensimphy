import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { diagnostics } from './diagnostics'
import { displayGeometry, type SimulationScene } from './scene'
import { ResultLayer } from './result-layer'
import type { FieldRangeMode } from './results'
import { deformedDisplayPositions, type ClipPlane } from './derived-geometry'

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

export interface SceneSelection {
  sourceTriangle: number
  sourceKey: number
  sourceDimension: 2 | 3
  sourceElementTag?: bigint
  point: [number, number, number]
  referencePoint: [number, number, number]
  barycentric?: [number, number, number]
  derived?: 'section' | 'isosurface'
}

export class SceneHost {
  private renderer: THREE.WebGLRenderer
  private world = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10_000)
  private controls: OrbitControls
  private observer: ResizeObserver
  private frame = 0
  private mesh?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private edges?: THREE.LineSegments
  private source?: SimulationScene
  private display?: ReturnType<typeof displayGeometry>
  private results?: ResultLayer
  private explosion = 0
  private deformation = { fieldId: '', step: 0, scale: 0 }
  private clipPlanes: THREE.Plane[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private measurePoints: THREE.Vector3[] = []
  private disposed = false
  private pointerStart?: { id: number; x: number; y: number }
  private controlsMoved = false
  private pointerDownListener: (event: PointerEvent) => void
  private pointerUpListener: (event: PointerEvent) => void
  private pointerCancelListener: (event: PointerEvent) => void
  private controlsStartListener: () => void
  private controlsEndListener: () => void
  onSelection?: (selection: SceneSelection) => void
  onMeasurement?: (distance?: number) => void

  constructor(private container: HTMLElement) {
    const counters = diagnostics()
    counters.hosts++
    counters.observers++
    counters.canvases++
    counters.contexts++
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setClearColor(0x0c0e0f)
    this.renderer.localClippingEnabled = true
    this.renderer.domElement.tabIndex = 0
    this.renderer.domElement.dataset.testid = 'scene-canvas'
    container.append(this.renderer.domElement)
    this.camera.position.set(42, -48, 38)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = false
    this.controls.addEventListener('change', () => {
      if (this.pointerStart) this.controlsMoved = true
      this.invalidate()
    })
    this.controlsStartListener = () => { /* movement is recorded by change events */ }
    this.controlsEndListener = () => { /* pointerup consumes the movement flag */ }
    this.controls.addEventListener('start', this.controlsStartListener)
    this.controls.addEventListener('end', this.controlsEndListener)
    this.world.add(new THREE.HemisphereLight(0xe8f4f5, 0x202326, 2.2))
    const key = new THREE.DirectionalLight(0xffe1a1, 3.5)
    key.position.set(35, -25, 50)
    this.world.add(key)
    this.observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.max(1, entry.contentRect.width)
      const height = Math.max(1, entry.contentRect.height)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(width, height, false)
      this.invalidate()
    })
    this.observer.observe(container)
    this.pointerDownListener = (event) => {
      if (event.button === 0 && event.isPrimary) {
        this.controlsMoved = false
        this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
      }
    }
    this.pointerUpListener = (event) => {
      const start = this.pointerStart
      this.pointerStart = undefined
      const controlsMoved = this.controlsMoved
      this.controlsMoved = false
      if (!start || start.id !== event.pointerId || controlsMoved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
      this.pick(event)
    }
    this.pointerCancelListener = () => { this.pointerStart = undefined }
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDownListener)
    this.renderer.domElement.addEventListener('pointerup', this.pointerUpListener)
    this.renderer.domElement.addEventListener('pointercancel', this.pointerCancelListener)
    this.invalidate()
  }

  setScene(source: SimulationScene) {
    this.removeGeometry()
    this.clearMeasurement()
    this.source = source
    this.display = displayGeometry(source)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.display.positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(this.display.triangles, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundsTree()
    const material = new THREE.MeshStandardMaterial({ color: source.source === 'gmsh-authoritative' ? 0x63cbd1 : 0xe6b85c, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide })
    this.mesh = new THREE.Mesh(geometry, material)
    diagnostics().geometries += 2
    diagnostics().materials += 2
    this.world.add(this.mesh)
    if (source.fields.length) this.results = new ResultLayer(this.world, this.mesh, source, this.display)
    const edges = new THREE.EdgesGeometry(geometry, 18)
    this.edges = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x101416, transparent: true, opacity: 0.82, clippingPlanes: this.clipPlanes }))
    this.world.add(this.edges)
    this.setExplosion(this.explosion)
    this.fit()
  }

  fit() {
    if (!this.mesh) return
    const box = new THREE.Box3().setFromObject(this.mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3()).length()
    this.controls.target.copy(center)
    this.camera.position.copy(center).add(new THREE.Vector3(1, -1.25, 0.9).normalize().multiplyScalar(size * 1.25))
    this.camera.near = Math.max(size / 1000, 0.01)
    this.camera.far = size * 100
    this.camera.updateProjectionMatrix()
    this.controls.update()
    this.invalidate()
  }

  setClipping(enabled: boolean) {
    this.setClipPlanes(enabled ? [{ normal: [1, 0, 0], constant: 0 }] : [])
  }

  setClipPlanes(planes: readonly ClipPlane[]) {
    if (!this.mesh) return
    this.clipPlanes = planes.map(({ normal, constant }) => {
      const length = Math.hypot(...normal)
      if (!(length > 0) || !Number.isFinite(constant)) throw new Error('clip plane must have a finite nonzero normal and constant')
      return new THREE.Plane(new THREE.Vector3(...normal).multiplyScalar(1 / length), constant / length)
    })
    this.mesh.material.clippingPlanes = this.clipPlanes
    if (this.edges) (this.edges.material as THREE.Material).clippingPlanes = this.clipPlanes
    this.results?.setClipPlanes(this.clipPlanes, planes)
    this.mesh.material.needsUpdate = true
    this.invalidate()
  }

  setExplosion(amount: number) {
    this.explosion = amount
    this.rebuildPositions()
  }

  setDeformation(fieldId: string | undefined, step: number, scale: number) {
    this.deformation = { fieldId: fieldId ?? '', step, scale }
    this.results?.setDeformationScale(scale)
    this.rebuildPositions()
  }

  private rebuildPositions() {
    if (!this.mesh || !this.display || !this.source) return
    const position = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const field = this.source.fields.find(({ id }) => id === this.deformation.fieldId)
    const base = this.deformation.scale && field
      ? deformedDisplayPositions(this.source, this.display, field, this.deformation.step, this.deformation.scale)
      : this.display.positions
    for (let corner = 0; corner < this.display.displayVertexToSourceNode.length; corner++) {
      const sourceNode = this.display.displayVertexToSourceNode[corner]!
      const sourceTriangle = this.display.displayTriangleToSourceTriangle[Math.floor(corner / 3)]!
      const key = this.source.triangleEntityTags[sourceTriangle]!
      const normal = this.source.surfaceSignatures.find(({ sourceKey }) => sourceKey === key)?.normal ?? [0, 0, 0]
      position.setXYZ(corner,
        base[corner * 3]! + normal[0] * this.explosion,
        base[corner * 3 + 1]! + normal[1] * this.explosion,
        base[corner * 3 + 2]! + normal[2] * this.explosion)
    }
    position.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
    this.mesh.geometry.disposeBoundsTree()
    this.mesh.geometry.computeBoundsTree()
    this.edges?.geometry.dispose()
    if (this.edges) this.edges.geometry = new THREE.EdgesGeometry(this.mesh.geometry, 18)
    this.invalidate()
  }

  setResult(fieldId: string | undefined, step = 0, rangeMode: FieldRangeMode = 'global', customRange?: [number, number]) {
    this.results?.set(this.source?.fields.find(({ id }) => id === fieldId), step, rangeMode, customRange)
    this.invalidate()
  }

  renderState() {
    const position = this.mesh?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    return {
      clipped: Boolean(this.mesh?.material.clippingPlanes.length),
      clippingPlanes: this.mesh?.material.clippingPlanes.length ?? 0,
      edgeClippingPlanes: (this.edges?.material as THREE.Material | undefined)?.clippingPlanes?.length ?? 0,
      explosion: this.explosion,
      positionSample: position ? Array.from(position.array.slice(0, 12)) : [],
      sourceSample: this.source ? Array.from(this.source.referencePositions.slice(0, 12)) : [],
      measurements: this.measurePoints.length,
      result: this.results?.getState(),
    }
  }

  clearMeasurement() {
    this.measurePoints = []
    this.onMeasurement?.()
  }

  private pick(event: PointerEvent) {
    if (!this.mesh || !this.source || !this.display || event.button !== 0) return
    const bounds = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    this.raycaster.firstHitOnly = true
    const baseHit = this.raycaster.intersectObject(this.mesh)[0]
    const derivedHit = this.results?.pick(this.raycaster)
    if (derivedHit && (!baseHit || derivedHit.hit.distance < baseHit.distance)) {
      const point = derivedHit.hit.point.toArray() as [number, number, number]
      this.onSelection?.({ sourceTriangle: -1, sourceKey: derivedHit.sourceEntityTag!, sourceDimension: 3, sourceElementTag: derivedHit.sourceElementTag, point, referencePoint: point, derived: derivedHit.kind })
      return
    }
    const hit = baseHit
    if (!hit || hit.faceIndex === undefined) return
    const sourceTriangle = this.display.displayTriangleToSourceTriangle[hit.faceIndex]!
    const point: [number, number, number] = hit.point.toArray() as [number, number, number]
    const attribute = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const displayTriangle = Array.from((this.mesh.geometry.index!.array as ArrayLike<number>).slice(hit.faceIndex * 3, hit.faceIndex * 3 + 3))
    const displayed = displayTriangle.map((index) => new THREE.Vector3().fromBufferAttribute(attribute, index))
    const bary = new THREE.Vector3()
    THREE.Triangle.getBarycoord(hit.point, displayed[0]!, displayed[1]!, displayed[2]!, bary)
    const sourceNodes = Array.from(this.source.surfaceTriangles.slice(sourceTriangle * 3, sourceTriangle * 3 + 3))
    const referencePoint = new THREE.Vector3()
    sourceNodes.forEach((node, corner) => referencePoint.addScaledVector(new THREE.Vector3().fromArray(this.source!.referencePositions, node * 3), bary.getComponent(corner)))
    this.onSelection?.({ sourceTriangle, sourceKey: this.source.triangleEntityTags[sourceTriangle]!, sourceDimension: 2, point, referencePoint: referencePoint.toArray(), barycentric: bary.toArray() })
    this.measurePoints.push(hit.point.clone())
    if (this.measurePoints.length > 2) this.measurePoints.shift()
    this.onMeasurement?.(this.measurePoints.length === 2 ? this.measurePoints[0]!.distanceTo(this.measurePoints[1]!) : undefined)
  }

  private invalidate() {
    if (this.frame || this.disposed) return
    diagnostics().frames++
    this.frame = requestAnimationFrame(() => {
      diagnostics().frames--
      this.frame = 0
      this.renderer.render(this.world, this.camera)
    })
  }

  private removeGeometry() {
    this.results?.dispose()
    this.results = undefined
    if (this.mesh) {
      this.world.remove(this.mesh)
      this.mesh.geometry.disposeBoundsTree()
      this.mesh.geometry.dispose()
      this.mesh.material.dispose()
      diagnostics().geometries--
      diagnostics().materials--
    }
    if (this.edges) {
      this.world.remove(this.edges)
      this.edges.geometry.dispose()
      ;(this.edges.material as THREE.Material).dispose()
      diagnostics().geometries--
      diagnostics().materials--
    }
    this.mesh = undefined
    this.edges = undefined
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    const counters = diagnostics()
    counters.hosts--
    counters.observers--
    counters.canvases--
    counters.contexts--
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      counters.frames--
      this.frame = 0
    }
    this.observer.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDownListener)
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUpListener)
    this.renderer.domElement.removeEventListener('pointercancel', this.pointerCancelListener)
    this.controls.removeEventListener('start', this.controlsStartListener)
    this.controls.removeEventListener('end', this.controlsEndListener)
    this.controls.dispose()
    this.removeGeometry()
    this.world.traverse((object) => {
      if (object instanceof THREE.Light && object.shadow.map) object.shadow.map.dispose()
    })
    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
