import { CAD_DIELECTRIC, CAD_ELECTRODE, CAD_GROUND, electrostaticGroupsFromEntities } from '../../src/simulation/cad-groups'
import type { ModelEntity } from '../../src/simulation/scene'

function entity(dimension: 0 | 1 | 2 | 3, tag: number, bounds: [number, number, number, number, number, number]): ModelEntity {
  return { dimension, tag, bounds, physicalTags: new Uint32Array() }
}

describe('CAD electrostatic groups', () => {
  it('assigns unique z-min ground, z-max electrode and the single volume', () => {
    const sidecar = electrostaticGroupsFromEntities('cube', [
      entity(3, 1, [0, 0, 0, 20, 20, 20]),
      entity(2, 10, [0, 0, 0, 20, 20, 0]),
      entity(2, 11, [0, 0, 20, 20, 20, 20]),
      entity(2, 12, [0, 0, 0, 20, 0, 20]),
      entity(2, 13, [0, 20, 0, 20, 20, 20]),
      entity(2, 14, [0, 0, 0, 0, 20, 20]),
      entity(2, 15, [20, 0, 0, 20, 20, 20]),
    ])
    expect(sidecar).toMatchObject({
      schema: 1,
      projectId: 'cube',
      groups: [
        { dimension: 2, tag: CAD_GROUND, name: 'Ground', entityTags: [10] },
        { dimension: 2, tag: CAD_ELECTRODE, name: 'Electrode', entityTags: [11] },
        { dimension: 3, tag: CAD_DIELECTRIC, name: 'Dielectric', entityTags: [1] },
      ],
    })
  })

  it('rejects an ambiguous pair of candidate electrode faces', () => {
    expect(() => electrostaticGroupsFromEntities('cube', [
      entity(3, 1, [0, 0, 0, 1, 1, 1]),
      entity(2, 1, [0, 0, 1, 1, 1, 1]),
      entity(2, 2, [0, 0, 1, 0.5, 1, 1]),
      entity(2, 3, [0, 0, 0, 1, 1, 0]),
    ])).toThrow('could not uniquely identify ground and electrode faces')
  })
})
