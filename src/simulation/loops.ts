import { parseOnelab, type OnelabNumberParameter } from './onelab-db'

export interface LoopHistoryPoint {
  index: number
  values: Record<string, number>
  database: string
  outputs: Record<string, number[]>
}

export const maximumLoopPoints = 10_000

function loopLevel(parameter: OnelabNumberParameter) {
  const value = parameter.attributes?.Loop
  return value === '1' || value === '2' || value === '3' ? value : undefined
}

export function onelabLoopValues(database: string): Record<string, number> {
  const entries = parseOnelab(database).onelab.parameters
    .filter((parameter): parameter is OnelabNumberParameter => parameter.type === 'number' && Boolean(loopLevel(parameter)))
    .map(({ name, values }) => {
      const value = values[0]
      if (values.length !== 1 || value === undefined || !Number.isFinite(value)) throw new Error(`loop parameter ${name} has no finite scalar value`)
      return [name, value] as const
    })
  if (!entries.length) throw new Error('ONELAB database has no numeric Loop parameters')
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
}

export function onelabOutputs(database: string): Record<string, number[]> {
  return Object.fromEntries(parseOnelab(database).onelab.parameters
    .filter((parameter): parameter is OnelabNumberParameter => parameter.type === 'number' && parameter.name.includes('Output/'))
    .map(({ name, values }) => [name, [...values]]))
}
