export const CANTERA_EXPORTS = Object.freeze([
  'cantera_run',
  'cantera_out',
  'cantera_status',
])

export function initSync(options) {
  const module = options === null || options === undefined ? undefined : options.module
  if (!(module instanceof WebAssembly.Module)) {
    throw new Error('Cantera companion requires a verified WebAssembly.Module')
  }
  return module
}
