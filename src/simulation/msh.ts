export function canonicalMshRecords(source: string) {
  const section = (name: string) => {
    const match = new RegExp(`\\$${name}\\s+(\\d+)\\s+([\\s\\S]*?)\\$End${name}`).exec(source)
    if (!match) throw new Error(`MSH2 ${name} section is missing`)
    const records = match[2]!.trim().split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).sort((left, right) => Number(left.split(' ', 1)[0]) - Number(right.split(' ', 1)[0]))
    if (records.length !== Number(match[1])) throw new Error(`MSH2 ${name} record count mismatch`)
    return records
  }
  const nodeRecords = section('Nodes')
  const nodeCoordinates = new Map(nodeRecords.map((record) => {
    const [tag, ...coordinates] = record.split(' ')
    return [tag!, coordinates.map((value) => Number(value).toPrecision(12)).join(',')]
  }))
  const nodes = [...nodeCoordinates.values()].sort()
  const elements = section('Elements').map((record) => {
    const fields = record.split(' ')
    const type = fields[1]!
    const tagCount = Number(fields[2])
    const tags = fields.slice(3, 3 + tagCount)
    const connectivity = fields.slice(3 + tagCount).map((tag) => {
      const coordinate = nodeCoordinates.get(tag)
      if (!coordinate) throw new Error(`MSH2 element references unknown node ${tag}`)
      return coordinate
    }).sort()
    return JSON.stringify({ type, tags, connectivity })
  }).sort()
  return JSON.stringify({ nodes, elements })
}
