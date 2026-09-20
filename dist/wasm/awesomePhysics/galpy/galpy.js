export const GALPY_EXPORTS = Object.freeze([
  'galpy_orbit_init',
  'galpy_orbit_step',
  'galpy_orbit_R',
  'galpy_orbit_z',
  'galpy_orbit_phi',
  'galpy_orbit_vR',
  'galpy_orbit_vT',
  'galpy_orbit_vz',
  'galpy_orbit_energy',
  'galpy_orbit_Lz',
  'galpy_rforce',
  'galpy_zforce',
  'galpy_circular_velocity',
])

export function initSync(options) {
  const module = options === null || options === undefined ? undefined : options.module
  if (!(module instanceof WebAssembly.Module)) {
    throw new Error('galpy companion requires a verified WebAssembly.Module')
  }
  return module
}
