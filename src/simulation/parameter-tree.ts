import type { OnelabParameter } from './onelab-db'

export interface ParameterTreeNode {
  path: string
  label: string
  parameters: OnelabParameter[]
  children: ParameterTreeNode[]
}

export function parameterTree(parameters: OnelabParameter[]): ParameterTreeNode[] {
  const root: ParameterTreeNode = { path: '', label: '', parameters: [], children: [] }
  for (const parameter of parameters) {
    const parts = parameter.name.split('/').filter(Boolean)
    if (parts.length < 2) {
      root.label = root.label || 'ONELAB'
      root.parameters.push(parameter)
      continue
    }
    let node = root
    for (let depth = 0; depth < parts.length - 1; depth++) {
      const path = parts.slice(0, depth + 1).join('/')
      let child = node.children.find((candidate) => candidate.path === path)
      if (!child) {
        child = { path, label: parts[depth]!, parameters: [], children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.parameters.push(parameter)
  }
  const sorted = sortTree(root)
  if (sorted.parameters.length) {
    sorted.label = sorted.label || 'ONELAB'
    sorted.path = sorted.path || 'ONELAB'
    return [sorted]
  }
  return sorted.children
}

function sortTree(node: ParameterTreeNode): ParameterTreeNode {
  node.children.sort((left, right) => left.path.localeCompare(right.path))
  node.children.forEach(sortTree)
  return node
}
