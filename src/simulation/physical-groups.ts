import type { PhysicalGroup, SimulationScene } from './scene'

export interface PhysicalGroupDraft {
  id: string
  dimension: 0 | 1 | 2 | 3
  tag: number
  name: string
  entityTags: number[]
}

export interface PhysicalGroupSidecar {
  schema: 1
  projectId: string
  groups: PhysicalGroupDraft[]
}

export class PhysicalGroupEditor {
  private groups: PhysicalGroupDraft[]

  constructor(readonly projectId: string, initial: PhysicalGroupDraft[] = []) {
    this.groups = initial.map((group) => ({ ...group, entityTags: [...group.entityTags] }))
  }

  add(dimension: PhysicalGroupDraft['dimension'], name: string, entityTags: number[]) {
    const used = new Set(this.groups.filter((group) => group.dimension === dimension).map(({ tag }) => tag))
    let tag = 10_000
    while (used.has(tag)) tag++
    const group = { id: crypto.randomUUID(), dimension, tag, name: name.trim(), entityTags: [...new Set(entityTags)].sort((a, b) => a - b) }
    this.validate(group)
    this.validateConflicts(group)
    this.groups.push(group)
    return group.id
  }

  rename(id: string, name: string) {
    const group = this.get(id)
    group.name = name.trim()
    this.validate(group)
    this.validateConflicts(group)
  }

  setMembership(id: string, entityTags: number[]) {
    const group = this.get(id)
    group.entityTags = [...new Set(entityTags)].sort((a, b) => a - b)
    this.validate(group)
  }

  delete(id: string) { this.groups = this.groups.filter((group) => group.id !== id) }
  reset() { this.groups = [] }
  sidecar(): PhysicalGroupSidecar { return { schema: 1, projectId: this.projectId, groups: this.groups.map((group) => ({ ...group, entityTags: [...group.entityTags] })) } }

  apply(scene: SimulationScene): PhysicalGroup[] {
    const entities = new Set(scene.entities.map(({ dimension, tag }) => `${dimension}:${tag}`))
    return this.groups.map((group) => {
      for (const tag of group.entityTags) if (!entities.has(`${group.dimension}:${tag}`)) throw new Error(`physical group ${group.name} references absent entity ${group.dimension}:${tag}`)
      if (scene.groups.some((native) => native.dimension === group.dimension && (native.tag === group.tag || native.name === group.name))) throw new Error(`physical group ${group.dimension}:${group.tag} conflicts with native group ${group.name}`)
      return { dimension: group.dimension, tag: group.tag, name: group.name, entityTags: Uint32Array.from(group.entityTags) }
    })
  }

  static load(source: string, projectId: string) {
    const sidecar = JSON.parse(source) as PhysicalGroupSidecar
    if (sidecar.schema !== 1 || sidecar.projectId !== projectId || !Array.isArray(sidecar.groups)) throw new Error('physical-group sidecar identity is invalid')
    const editor = new PhysicalGroupEditor(projectId)
    for (const group of sidecar.groups) {
      editor.validate(group)
      editor.validateConflicts(group)
      editor.groups.push({ ...group, entityTags: [...new Set(group.entityTags)].sort((a, b) => a - b) })
    }
    return editor
  }

  private get(id: string) {
    const group = this.groups.find((candidate) => candidate.id === id)
    if (!group) throw new Error(`unknown physical group ${id}`)
    return group
  }

  private validate(group: PhysicalGroupDraft) {
    if (!group.id || !group.name || ![0, 1, 2, 3].includes(group.dimension) || !Number.isInteger(group.tag) || group.tag <= 0 || !group.entityTags.length || group.entityTags.some((tag) => !Number.isInteger(tag) || tag <= 0)) throw new Error('physical group requires a stable id, name, dimension, positive tag and entity membership')
  }

  private validateConflicts(group: PhysicalGroupDraft) {
    if (this.groups.some((candidate) => candidate !== group && (candidate.id === group.id || (candidate.dimension === group.dimension && (candidate.tag === group.tag || candidate.name === group.name))))) throw new Error(`physical group ${group.name} conflicts in dimension ${group.dimension}`)
  }
}
