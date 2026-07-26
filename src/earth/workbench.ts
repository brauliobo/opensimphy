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
