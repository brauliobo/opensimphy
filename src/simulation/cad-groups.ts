import type { ModelEntity } from './scene'
import type { PhysicalGroupDraft, PhysicalGroupSidecar } from './physical-groups'

export const CAD_GROUND = 1001
export const CAD_ELECTRODE = 1002
export const CAD_DIELECTRIC = 1003

function nearly(value: number, target: number, span: number) {
  return Math.abs(value - target) <= Math.max(1e-9, span * 1e-6)
}

export function electrostaticGroupsFromEntities(projectId: string, entities: readonly ModelEntity[]): PhysicalGroupSidecar {
  const volumes = entities.filter(({ dimension }) => dimension === 3)
  const surfaces = entities.filter(({ dimension }) => dimension === 2)
  if (volumes.length !== 1 || surfaces.length < 2) throw new Error('electrostatic CAD assignment needs one volume and at least two surfaces')
  const volume = volumes[0]!
  const z0 = Math.min(...surfaces.map(({ bounds }) => bounds[2]))
  const z1 = Math.max(...surfaces.map(({ bounds }) => bounds[5]))
  const span = Math.max(z1 - z0, 1e-12)
  const ground = surfaces.filter(({ bounds }) => nearly(bounds[2], z0, span) && nearly(bounds[5], z0, span))
  const electrode = surfaces.filter(({ bounds }) => nearly(bounds[2], z1, span) && nearly(bounds[5], z1, span))
  if (ground.length !== 1 || electrode.length !== 1) throw new Error('could not uniquely identify ground and electrode faces from bounding boxes')
  const groups: PhysicalGroupDraft[] = [
    { id: `${projectId}-ground`, dimension: 2, tag: CAD_GROUND, name: 'Ground', entityTags: [ground[0]!.tag] },
    { id: `${projectId}-electrode`, dimension: 2, tag: CAD_ELECTRODE, name: 'Electrode', entityTags: [electrode[0]!.tag] },
    { id: `${projectId}-dielectric`, dimension: 3, tag: CAD_DIELECTRIC, name: 'Dielectric', entityTags: [volume.tag] },
  ]
  return { schema: 1, projectId, groups }
}
