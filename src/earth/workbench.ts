import type {
  JsonObject,
  JsonValue,
  WorkbenchFindingV1,
  WorkbenchSnapshotV1,
} from '../types/workbench'
import { cloneJsonValue } from '../workbench/snapshots'
import { sha256 } from '../workbench/sha256'

export type WorkbenchInputKind = 'number' | 'text' | 'checkbox' | 'json'

export interface WorkbenchInputField {
  key: string
  label: string
  kind: WorkbenchInputKind
  unit: string
  defaultValue: unknown
  jsonType: 'array' | 'object' | null
}

const UNIT_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ['KilometresPerSecond', 'km/s'],
  ['KilogramsPerCubicMetre', 'kg/m³'],
  ['KgPerCubicMetre', 'kg/m³'],
  ['MetresPerSecondSquared', 'm/s²'],
  ['MetresPerSecond', 'm/s'],
  ['RadiansPerSecond', 'rad/s'],
  ['ElectronVolts', 'eV'],
  ['Kilometres', 'km'],
  ['Centimetres', 'cm'],
  ['Millimetres', 'mm'],
  ['Micrometres', 'µm'],
  ['Nanometres', 'nm'],
  ['Metres', 'm'],
  ['Kilograms', 'kg'],
  ['Kelvin', 'K'],
  ['Pascals', 'Pa'],
  ['Joules', 'J'],
  ['Seconds', 's'],
  ['Hertz', 'Hz'],
  ['Radians', 'rad'],
  ['Degrees', '°'],
  ['Coulombs', 'C'],
  ['Volts', 'V'],
  ['Tesla', 'T'],
  ['Solar', 'M☉'],
]

export const EARTH_WORKER_ADAPTER_REVISION = 'earth-browser-worker-adapter-v1'
export const EARTH_OUTPUT_SCHEMA_REVISION = 'earth-worker-result-schema-v2'

export interface EarthWorkbenchMethodIdentity {
  readonly id: string
  readonly relationship: string
  readonly modelOrigin: string
  readonly model: string
}

export interface EarthWorkbenchFindingContext {
  readonly programId: string
  readonly method: EarthWorkbenchMethodIdentity
  readonly sourceRevision: string
  readonly sourceLocator: string
  readonly resultStatus: string
  readonly output: unknown
  readonly evidenceRefs: readonly string[]
}

export interface EarthParallelScalarDelta {
  readonly key: string
  readonly left: number
  readonly right: number
  readonly delta: number
  readonly unit: string
}

export class EarthWorkbenchInputError extends TypeError {
  constructor(path: string, message: string) {
    super(`Invalid EARTH workbench inputs at ${path}: ${message}`)
    this.name = 'EarthWorkbenchInputError'
  }
}

function inputType(value: unknown): 'null' | 'array' | 'object' | 'number' | 'string' | 'boolean' | 'unsupported' {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return typeof value
  return 'unsupported'
}

function validateFiniteNumbers(value: JsonValue, path: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new EarthWorkbenchInputError(path, 'expected a finite number')
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateFiniteNumbers(item, `${path}[${index}]`))
  } else if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => validateFiniteNumbers(item, `${path}.${key}`))
  }
}

export function validateEarthWorkbenchInputs(value: unknown, defaults: Record<string, unknown>): JsonObject {
  const cloned = cloneJsonValue(value, 'earth.inputs')
  if (cloned === null || Array.isArray(cloned) || typeof cloned !== 'object') {
    throw new EarthWorkbenchInputError('inputs', 'expected an object')
  }
  const actualKeys = Object.keys(cloned).sort()
  const defaultKeys = Object.keys(defaults).sort()
  if (actualKeys.length !== defaultKeys.length || actualKeys.some((key, index) => key !== defaultKeys[index])) {
    throw new EarthWorkbenchInputError('inputs', `expected exactly these fields: ${defaultKeys.join(', ')}`)
  }
  for (const key of defaultKeys) {
    const expectedType = inputType(defaults[key])
    const actualType = inputType(cloned[key])
    if (actualType !== expectedType) {
      throw new EarthWorkbenchInputError(`inputs.${key}`, `expected ${expectedType}, received ${actualType}`)
    }
    validateFiniteNumbers(cloned[key]!, `inputs.${key}`)
  }
  return cloned
}

export function earthInputsEqual(left: unknown, right: unknown): boolean {
  try {
    const canonicalize = (value: JsonValue): JsonValue => {
      if (Array.isArray(value)) return value.map(canonicalize)
      if (value === null || typeof value !== 'object') return value
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key]!)]))
    }
    return JSON.stringify(canonicalize(cloneJsonValue(left))) === JSON.stringify(canonicalize(cloneJsonValue(right)))
  } catch {
    return false
  }
}

export function earthModelRevision(programId: string, methodId: string): string {
  return `earth-program-method-contract:${programId}:${methodId}:v1`
}

export function earthCompatibilityKey(
  programId: string,
  method: Pick<EarthWorkbenchMethodIdentity, 'id' | 'relationship' | 'modelOrigin'>,
  sourceRevision: string,
): string {
  return sha256(JSON.stringify({
    implementationRevision: EARTH_WORKER_ADAPTER_REVISION,
    methodId: method.id,
    modelOrigin: method.modelOrigin,
    modelRevision: earthModelRevision(programId, method.id),
    outputSchemaRevision: EARTH_OUTPUT_SCHEMA_REVISION,
    programId,
    relationship: method.relationship,
    sourceRevision,
  }))
}

function outputKeys(output: unknown): string {
  if (!isJsonObject(output)) return 'a structured result'
  const keys = Object.keys(output)
  return keys.length ? keys.map(humanizeKey).join(', ') : 'an empty output object'
}

export function buildEarthWorkbenchFinding(context: EarthWorkbenchFindingContext): WorkbenchFindingV1 {
  const { method, programId } = context
  const modelRevision = earthModelRevision(programId, method.id)
  const common = {
    schemaVersion: 1 as const,
    equation: method.model,
    provenance: {
      claimClass: method.relationship === 'earth-source-reproduction'
        ? 'bounded-source-audit'
        : method.relationship.startsWith('traditional-')
          ? 'independent-traditional-comparator'
          : 'bounded-contract-audit',
      evidenceRefs: [...context.evidenceRefs],
      sourceRevision: context.sourceRevision,
      sourceLocator: context.sourceLocator,
      methodRelationship: method.relationship,
      modelOrigin: method.modelOrigin,
      resultStatus: context.resultStatus,
      caveats: ['Scientific validation is not established.', 'The result is bounded to the dispatched inputs and declared method contract.'],
      implementationRevision: EARTH_WORKER_ADAPTER_REVISION,
      modelRevision,
      outputSchemaRevision: EARTH_OUTPUT_SCHEMA_REVISION,
    },
    validatesTheory: false as const,
  }
  if (method.relationship === 'earth-source-reproduction') {
    return {
      ...common,
      changed: `Source reproduction / audit only. The bounded source audit returned ${outputKeys(context.output)}.`,
      cause: 'The selected EARTH source expression was evaluated with the dispatched inputs.',
      assumptions: ['The preserved source expression is reproduced literally.', 'No independent physical model or dataset validation is introduced.'],
      establishes: 'A bounded reproduction of the declared EARTH source expression for these inputs.',
      doesNotEstablish: 'It does not establish physical correctness, empirical agreement, or scientific validation of EARTH theory.',
    }
  }
  if (method.relationship.startsWith('traditional-')) {
    return {
      ...common,
      changed: `Independent traditional baseline. The comparator returned ${outputKeys(context.output)}.`,
      cause: 'The selected standard-physics comparator was evaluated independently of an EARTH-derived model.',
      assumptions: ['The comparator uses its own declared traditional model.', 'The comparison does not substitute an EARTH source expression.'],
      establishes: 'A bounded independent traditional baseline for the dispatched inputs.',
      doesNotEstablish: 'It does not reproduce or validate EARTH theory, and it is not evidence of scientific agreement.',
    }
  }
  return {
    ...common,
    changed: `Source-contract audit only. The bounded validator returned ${outputKeys(context.output)}.`,
    cause: 'The selected validator checked only the declared source contract and audit conditions.',
    assumptions: ['The audit is limited to the explicit source contract.', 'No unavailable physical formulation is inferred or reconstructed.'],
    establishes: 'A bounded contract audit for the dispatched inputs and declared checks.',
    doesNotEstablish: 'It does not reproduce a physical model or establish scientific validation of EARTH theory.',
  }
}

function snapshotOutput(snapshot: WorkbenchSnapshotV1): Record<string, unknown> | null {
  if (!isJsonObject(snapshot.outputs)) return null
  return isJsonObject(snapshot.outputs.output) ? snapshot.outputs.output : null
}

export function earthParallelScalarDeltas(
  left: WorkbenchSnapshotV1,
  right: WorkbenchSnapshotV1,
): EarthParallelScalarDelta[] {
  const leftOutput = snapshotOutput(left)
  const rightOutput = snapshotOutput(right)
  if (!leftOutput || !rightOutput) return []
  return Object.keys(leftOutput).sort().flatMap((key) => {
    const leftValue = leftOutput[key]
    const rightValue = rightOutput[key]
    if (typeof leftValue !== 'number' || typeof rightValue !== 'number') return []
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return []
    const unit = inferExplicitUnit(key)
    if (!unit) return []
    return [{ key, left: leftValue, right: rightValue, delta: rightValue - leftValue, unit }]
  })
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

export function formatToken(value: string): string {
  return value.replaceAll('-', ' ')
}

export function inferExplicitUnit(key: string): string {
  return UNIT_SUFFIXES.find(([suffix]) => key.endsWith(suffix))?.[1] ?? ''
}

export function buildInputFields(defaults: Record<string, unknown>): WorkbenchInputField[] {
  return Object.entries(defaults).map(([key, defaultValue]) => {
    const valueType = typeof defaultValue
    const kind: WorkbenchInputKind = valueType === 'number'
      ? 'number'
      : valueType === 'boolean'
        ? 'checkbox'
        : valueType === 'string' ? 'text' : 'json'
    return {
      key,
      label: humanizeKey(key),
      kind,
      unit: inferExplicitUnit(key),
      defaultValue,
      jsonType: kind === 'json' ? (Array.isArray(defaultValue) ? 'array' : 'object') : null,
    }
  })
}

export function formatScalar(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    return value.toLocaleString('en-US', { maximumSignificantDigits: 10 })
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null) return 'null'
  return String(value)
}

export function isScalar(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}
