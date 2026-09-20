import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { BASIS_COLORS, type SliceAxis, type Vec3 } from './cliffordSpaceEngine'

export interface CliffordSpaceHostModel {
  cube: {
    vertices: readonly Vec3[]
    edges: readonly [Vec3, Vec3][]
  }
  dodecahedron: {
    vertices: readonly Vec3[]
    edges: readonly [Vec3, Vec3][]
    faces: readonly (readonly Vec3[])[]
  } | null
  honeycomb: readonly [Vec3, Vec3][]
  families: readonly { family: { color: string }; a: Vec3; b: Vec3 }[]
  dots: readonly Vec3[]
  labels: readonly { point: Vec3; text: string; name: string }[]
  point: Vec3
  sliceAxis: SliceAxis
  showPlane: boolean
  showLabels: boolean
  showCube: boolean
  plane: {
    origin: Vec3
    u: Vec3
    v: Vec3
    corners: readonly Vec3[]
  }
}

export interface CliffordCameraPose {
  position: Vec3
  up: Vec3
  target: Vec3
}

const HONEYCOMB = 0xc4b48a
const CUBE = 0xe6b85c
const CLEAR = 0x0c0e0f
const MIN_SPAN = 2.15

export class CliffordSpaceScene {
  private renderer: THREE.WebGLRenderer
  private labels: CSS2DRenderer
  private world = new THREE.Scene()
  private content = new THREE.Group()
  private persp: THREE.PerspectiveCamera
  private ortho: THREE.OrthographicCamera
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  private controls: OrbitControls
  private observer: ResizeObserver
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pickPlane = new THREE.Plane()
  private frame = 0
  private disposed = false
  private width = 1
  private height = 1
  private span = MIN_SPAN
  private pointerStart?: { id: number; x: number; y: number }
  private controlsMoved = false
  private readonly pointerDownListener: (event: PointerEvent) => void
  private readonly pointerUpListener: (event: PointerEvent) => void
  private readonly pointerCancelListener: () => void
  onPick?: (point: Vec3) => void

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setClearColor(CLEAR)
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.touchAction = 'none'
    this.renderer.domElement.tabIndex = 0
    container.append(this.renderer.domElement)

    this.labels = new CSS2DRenderer()
    this.labels.domElement.style.position = 'absolute'
    this.labels.domElement.style.inset = '0'
    this.labels.domElement.style.pointerEvents = 'none'
    container.append(this.labels.domElement)

    this.persp = new THREE.PerspectiveCamera(38, 1, 0.05, 400)
    this.ortho = new THREE.OrthographicCamera(-MIN_SPAN, MIN_SPAN, MIN_SPAN, -MIN_SPAN, 0.05, 400)
    this.persp.up.set(0, 0, 1)
    this.ortho.up.set(0, 0, 1)
    this.camera = this.ortho

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = false
    this.controls.minZoom = 0.25
    this.controls.maxZoom = 12
    this.controls.maxDistance = 80
    this.controls.addEventListener('change', () => {
      if (this.pointerStart) this.controlsMoved = true
      this.invalidate()
    })

    this.world.add(this.content)
    this.world.add(new THREE.HemisphereLight(0xe8f4f5, 0x202326, 2.2))
    const key = new THREE.DirectionalLight(0xffe1a1, 3.5)
    key.position.set(35, -25, 50)
    this.world.add(key)

    this.observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      this.resize(Math.max(1, entry.contentRect.width), Math.max(1, entry.contentRect.height))
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
      const hit = this.pick(event)
      if (hit) this.onPick?.(hit)
    }
    this.pointerCancelListener = () => { this.pointerStart = undefined }
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDownListener)
    this.renderer.domElement.addEventListener('pointerup', this.pointerUpListener)
    this.renderer.domElement.addEventListener('pointercancel', this.pointerCancelListener)
    this.invalidate()
  }

  setModel(model: CliffordSpaceHostModel): void {
    this.clearContent()
    this.setPickPlane(model.plane)
    this.span = modelSpan(model)
    this.syncProjection()
    if (model.honeycomb.length) this.content.add(lineSegments(model.honeycomb, HONEYCOMB, 0.88))
    if (model.families.length) this.content.add(familyLines(model.families))
    if (model.showCube) {
      this.content.add(lineSegments(model.cube.edges, CUBE, 1))
      this.content.add(unitCubeMesh())
    }
    if (model.dodecahedron) {
      this.content.add(lineSegments(model.dodecahedron.edges, CUBE, 0.7))
      this.content.add(faceMesh(model.dodecahedron.faces, CUBE, 0.16))
    }
    if (model.dots.length) this.content.add(dotCloud(model.dots))
    if (model.showLabels) {
      for (const label of model.labels) this.content.add(textLabel(label))
    }
    if (model.showPlane) this.content.add(planeMesh(model.plane.corners))
    this.content.add(probeMesh(model.point))
    this.invalidate()
  }

  setCamera(pose: CliffordCameraPose): void {
    this.applyPose(this.persp, pose)
    this.applyPose(this.ortho, pose)
    this.controls.target.set(pose.target[0], pose.target[1], pose.target[2])
    this.controls.update()
    this.invalidate()
  }

  setPerspective(perspective: boolean): void {
    const previous = this.camera
    this.camera = perspective ? this.persp : this.ortho
    this.camera.position.copy(previous.position)
    this.camera.quaternion.copy(previous.quaternion)
    this.camera.up.copy(previous.up)
    this.controls.object = this.camera
    this.syncProjection()
    this.controls.update()
    this.invalidate()
  }

  pick(event: PointerEvent): Vec3 | null {
    const bounds = this.renderer.domElement.getBoundingClientRect()
    if (!(bounds.width > 0) || !(bounds.height > 0)) return null
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.pickPlane, hit)) return null
    return Object.freeze([hit.x, hit.y, hit.z]) as Vec3
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.frame) {
      cancelAnimationFrame(this.frame)
      this.frame = 0
    }
    this.observer.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDownListener)
    this.renderer.domElement.removeEventListener('pointerup', this.pointerUpListener)
    this.renderer.domElement.removeEventListener('pointercancel', this.pointerCancelListener)
    this.controls.dispose()
    this.clearContent()
    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }

  private applyPose(camera: THREE.Camera, pose: CliffordCameraPose): void {
    camera.up.set(pose.up[0], pose.up[1], pose.up[2])
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
  }

  private setPickPlane(plane: CliffordSpaceHostModel['plane']): void {
    const origin = new THREE.Vector3(plane.origin[0], plane.origin[1], plane.origin[2])
    const u = new THREE.Vector3(plane.u[0], plane.u[1], plane.u[2])
    const v = new THREE.Vector3(plane.v[0], plane.v[1], plane.v[2])
    const normal = new THREE.Vector3().crossVectors(u, v)
    if (normal.lengthSq() === 0) normal.set(0, 0, 1)
    else normal.normalize()
    this.pickPlane.setFromNormalAndCoplanarPoint(normal, origin)
  }

  private resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.syncProjection()
    this.renderer.setSize(width, height, false)
    this.labels.setSize(width, height)
    this.invalidate()
  }

  private syncProjection(): void {
    const aspect = this.width / this.height
    this.persp.aspect = aspect
    this.persp.updateProjectionMatrix()
    this.ortho.left = -this.span * aspect
    this.ortho.right = this.span * aspect
    this.ortho.top = this.span
    this.ortho.bottom = -this.span
    this.ortho.updateProjectionMatrix()
  }

  private invalidate(): void {
    if (this.frame || this.disposed) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (this.disposed) return
      this.renderer.render(this.world, this.camera)
      this.labels.render(this.world, this.camera)
    })
  }

  private clearContent(): void {
    const children = [...this.content.children]
    for (const child of children) {
      this.content.remove(child)
      child.traverse((node) => {
        if (node instanceof CSS2DObject) node.element.remove()
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments || node instanceof THREE.Points) {
          node.geometry.dispose()
          const material = node.material
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
    }
  }
}

function modelSpan(model: CliffordSpaceHostModel): number {
  let max = 1.15
  const consider = (point: Vec3) => {
    max = Math.max(max, Math.abs(point[0] - 0.5), Math.abs(point[1] - 0.5), Math.abs(point[2] - 0.5))
  }
  for (const vertex of model.cube.vertices) consider(vertex)
  if (model.dodecahedron) {
    for (const vertex of model.dodecahedron.vertices) consider(vertex)
  }
  consider(model.point)
  return Math.max(MIN_SPAN, max + 1.55)
}

function flattenEdges(edges: readonly [Vec3, Vec3][]): Float32Array {
  const positions = new Float32Array(edges.length * 6)
  edges.forEach(([a, b], index) => {
    positions.set(a, index * 6)
    positions.set(b, index * 6 + 3)
  })
  return positions
}

function lineSegments(edges: readonly [Vec3, Vec3][], color: number, opacity: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(flattenEdges(edges), 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  })
  return new THREE.LineSegments(geometry, material)
}

function familyLines(segments: readonly { family: { color: string }; a: Vec3; b: Vec3 }[]): THREE.LineSegments {
  const positions = new Float32Array(segments.length * 6)
  const colors = new Float32Array(segments.length * 6)
  const color = new THREE.Color()
  segments.forEach((segment, index) => {
    positions.set(segment.a, index * 6)
    positions.set(segment.b, index * 6 + 3)
    color.set(segment.family.color)
    color.toArray(colors, index * 6)
    color.toArray(colors, index * 6 + 3)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent:  true,
    opacity:      0.72,
  }))
}

function unitCubeMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: CUBE,
      emissive: CUBE,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: 0.14,
      roughness: 0.62,
      metalness: 0.08,
      depthWrite: false,
    }),
  )
  mesh.position.set(0.5, 0.5, 0.5)
  return mesh
}

function faceMesh(faces: readonly (readonly Vec3[])[], color: number, opacity: number): THREE.Mesh {
  const positions = new Float32Array(faces.length * 18)
  faces.forEach((face, index) => {
    const a = face[0]!
    const b = face[1]!
    const c = face[2]!
    const d = face[3]!
    positions.set([...a, ...b, ...c, ...a, ...c, ...d], index * 18)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  }))
}

function planeMesh(corners: readonly Vec3[]): THREE.Mesh {
  const a = corners[0]!
  const b = corners[1]!
  const c = corners[2]!
  const d = corners[3]!
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]), 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x63cbd1,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  }))
}

function dotCloud(points: readonly Vec3[]): THREE.Points {
  const positions = new Float32Array(points.length * 3)
  points.forEach((point, index) => positions.set(point, index * 3))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xd8d4cc,
    size: 5,
    sizeAttenuation: false,
  }))
}

function probeMesh(point: Vec3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x63cbd1 }),
  )
  mesh.position.set(point[0], point[1], point[2])
  return mesh
}

function textLabel(label: { point: Vec3; text: string; name: string }): CSS2DObject {
  const element = document.createElement('span')
  element.className = 'clifford-space-label'
  element.textContent = label.text
  element.style.color = BASIS_COLORS[label.name as keyof typeof BASIS_COLORS]
  const object = new CSS2DObject(element)
  object.position.set(label.point[0], label.point[1], label.point[2])
  return object
}
