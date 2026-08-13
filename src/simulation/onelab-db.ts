export interface OnelabParameterBase {
  type: 'number' | 'string'
  name: string
  label?: string
  help?: string
  changedValue: number
  visible: boolean
  readOnly: boolean
  attributes?: Record<string, string>
  clients?: Record<string, number>
}

export interface OnelabNumberParameter extends OnelabParameterBase {
  type: 'number'
  values: number[]
  min: number
  max: number
  step: number
  choices?: number[]
  valueLabels?: Record<string, number>
}

export interface OnelabStringParameter extends OnelabParameterBase {
  type: 'string'
  values: string[]
  kind?: string
  choices?: string[]
}

export type OnelabParameter = OnelabNumberParameter | OnelabStringParameter

export interface OnelabDatabase {
  onelab: {
    version: string
    parameters: OnelabParameter[]
  }
}

export function canonicalizeOnelab(input: string | OnelabDatabase): string {
  const parsed = typeof input === 'string' ? JSON.parse(input) as OnelabDatabase : input
  if (!parsed.onelab || !Array.isArray(parsed.onelab.parameters) || typeof parsed.onelab.version !== 'string') throw new Error('invalid ONELAB JSON database')
  const parameters = [...parsed.onelab.parameters].sort((left, right) => left.name.localeCompare(right.name))
  return JSON.stringify({ onelab: { version: parsed.onelab.version, parameters } })
}

export function parseOnelab(json: string) {
  return JSON.parse(canonicalizeOnelab(json)) as OnelabDatabase
}

export function parameterChanged(parameter: OnelabParameter) {
  return Math.max(0, ...Object.values(parameter.clients ?? {}))
}

function sameValues(left: OnelabParameter, right: OnelabParameter) {
  return JSON.stringify(left.values) === JSON.stringify(right.values)
}

export function setParameterValue(json: string, name: string, value: number | string) {
  const database = parseOnelab(json)
  const parameter = database.onelab.parameters.find((candidate) => candidate.name === name)
  if (!parameter) throw new Error(`unknown ONELAB parameter ${name}`)
  if (parameter.readOnly) throw new Error(`ONELAB parameter ${name} is read-only`)
  if (parameter.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} requires a finite number`)
    if (value < parameter.min || value > parameter.max) throw new Error(`${name} must be between ${parameter.min} and ${parameter.max}`)
    parameter.values = [value]
  } else {
    if (typeof value !== 'string') throw new Error(`${name} requires a string`)
    parameter.values = [value]
  }
  parameter.clients = Object.fromEntries(Object.keys(parameter.clients ?? {}).map((client) => [client, parameter.changedValue]))
  return canonicalizeOnelab(database)
}

export interface OnelabValueEdit {
  name: string
  type: OnelabParameter['type']
  values: number[] | string[]
}

export function validateEnvelopeValues(declarationsJson: string, envelopeJson: string): OnelabValueEdit[] {
  const declarations = parseOnelab(declarationsJson)
  const envelope = parseOnelab(envelopeJson)
  const known = new Map(declarations.onelab.parameters.map((parameter) => [parameter.name, parameter]))
  const edits: OnelabValueEdit[] = []
  for (const supplied of envelope.onelab.parameters) {
    const declaration = known.get(supplied.name)
    if (!declaration) throw new Error(`unknown ONELAB parameter ${supplied.name}`)
    if (declaration.type !== supplied.type) throw new Error(`ONELAB parameter ${supplied.name} has type ${supplied.type}; expected ${declaration.type}`)
    if (declaration.readOnly || sameValues(declaration, supplied)) continue
    if (declaration.type === 'number') {
      if (!supplied.values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= declaration.min && value <= declaration.max)) throw new Error(`invalid value for ONELAB parameter ${supplied.name}`)
      edits.push({ name: supplied.name, type: 'number', values: supplied.values })
    } else {
      if (!supplied.values.every((value) => typeof value === 'string')) throw new Error(`invalid value for ONELAB parameter ${supplied.name}`)
      edits.push({ name: supplied.name, type: 'string', values: supplied.values })
    }
  }
  return edits
}

export function validateReadOnlyValues(declarationsJson: string, envelopeJson: string, baselineJson: string) {
  const declarations = new Map(parseOnelab(declarationsJson).onelab.parameters.map((parameter) => [parameter.name, parameter]))
  const baseline = new Map(parseOnelab(baselineJson).onelab.parameters.map((parameter) => [parameter.name, parameter]))
  for (const supplied of parseOnelab(envelopeJson).onelab.parameters) {
    const declaration = declarations.get(supplied.name)
    if (!declaration || !declaration.readOnly) continue
    const original = baseline.get(supplied.name) ?? declaration
    if (original.type !== supplied.type || !sameValues(original, supplied)) throw new Error(`ONELAB parameter ${supplied.name} is read-only`)
  }
}

export function restoreReadOnlyValues(databaseJson: string, defaultsJson: string) {
  const database = parseOnelab(databaseJson)
  const defaults = new Map(parseOnelab(defaultsJson).onelab.parameters.map((parameter) => [parameter.name, parameter]))
  for (const parameter of database.onelab.parameters) {
    const original = defaults.get(parameter.name)
    if (!parameter.readOnly || !original || original.type !== parameter.type) continue
    if (parameter.type === 'number' && original.type === 'number') parameter.values = [...original.values]
    if (parameter.type === 'string' && original.type === 'string') parameter.values = [...original.values]
  }
  return canonicalizeOnelab(database)
}

export function mergeValidatedValues(declarationsJson: string, envelopeJson: string) {
  const declarations = parseOnelab(declarationsJson)
  const edits = new Map(validateEnvelopeValues(declarationsJson, envelopeJson).map((edit) => [edit.name, edit]))
  for (const parameter of declarations.onelab.parameters) {
    const edit = edits.get(parameter.name)
    if (!edit) continue
    if (parameter.type === 'number' && edit.type === 'number') parameter.values = edit.values as number[]
    if (parameter.type === 'string' && edit.type === 'string') parameter.values = edit.values as string[]
    parameter.clients = Object.fromEntries(Object.keys(parameter.clients ?? {}).map((client) => [client, parameter.changedValue]))
  }
  return canonicalizeOnelab(declarations)
}

export interface GetdpOnelabRuntime {
  clear(): void
  set(json: string): void
  get(): string
  getChanged(): number
  setChanged(value: number): void
}

export function importGetdpDatabase(onelab: GetdpOnelabRuntime, database: string) {
  onelab.clear()
  onelab.set(canonicalizeOnelab(database))
}

export function exportGetdpDatabase(onelab: GetdpOnelabRuntime) {
  return canonicalizeOnelab(onelab.get())
}

export function callGetdpWithDatabase(onelab: GetdpOnelabRuntime, database: string, invoke: () => number) {
  importGetdpDatabase(onelab, database)
  const changedBefore = onelab.getChanged()
  const status = invoke()
  return { status, changedBefore, changedAfter: onelab.getChanged(), database: exportGetdpDatabase(onelab) }
}
