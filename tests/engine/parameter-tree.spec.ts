import { parameterTree } from '../../src/simulation/parameter-tree'
import type { OnelabParameter } from '../../src/simulation/onelab-db'

function number(name: string, value: number): OnelabParameter {
  return { type: 'number', name, values: [value], changedValue: 31, visible: true, readOnly: false, clients: { Gmsh: 0 } }
}

describe('ONELAB parameter tree', () => {
  it('groups nested names and keeps unscoped parameters at the root', () => {
    const tree = parameterTree([
      number('Parameters/Mesh/Size', 1),
      number('Parameters/Label', 0),
      number('standalone', 3),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.label).toBe('ONELAB')
    expect(tree[0]?.parameters.map(({ name }) => name)).toEqual(['standalone'])
    expect(tree[0]?.children.map(({ path }) => path)).toEqual(['Parameters'])
    expect(tree[0]?.children[0]?.parameters.map(({ name }) => name)).toEqual(['Parameters/Label'])
    expect(tree[0]?.children[0]?.children[0]?.parameters.map(({ name }) => name)).toEqual(['Parameters/Mesh/Size'])
  })

  it('omits an empty wrapper when every name is already scoped', () => {
    const tree = parameterTree([number('Parameters/Mesh/Size', 1)])
    expect(tree.map(({ path }) => path)).toEqual(['Parameters'])
    expect(tree[0]?.children[0]?.parameters[0]?.name).toBe('Parameters/Mesh/Size')
  })
})
