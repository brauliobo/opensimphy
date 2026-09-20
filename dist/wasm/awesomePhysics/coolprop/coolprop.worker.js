importScripts('./coolprop.js')

const COOLPROP_ADAPTER_ID = 'awesome-coolprop-wasm'
const SOURCE_REVISION = '4db89c1ce8d0b0d98ba7f03594f58a845351cf6a'
const IMPLEMENTATION_REVISION = 'coolprop-classic-worker-v1'
const MAX_ERROR_LENGTH = 2048
const MAX_INPUT_STRING_LENGTH = 128
const MAX_ABSOLUTE_VALUE = 1e12
const MAX_INPUT_BYTES = 64 * 1024
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const MAX_ABSTRACT_STATE_OUTPUTS = 16
const F2K_MIN_CELSIUS = -10000
const F2K_MAX_CELSIUS = 1000000
const ABSTRACT_STATE_OUTPUTS = new Set([
  'T',
  'rhomolar',
  'rhomass',
  'p',
  'Q',
  'tau',
  'delta',
  'molar_mass',
  'acentric_factor',
  'gas_constant',
  'Bvirial',
  'Cvirial',
  'compressibility_factor',
  'hmolar',
  'hmass',
  'smolar',
  'smass',
  'umolar',
  'umass',
  'cpmolar',
  'cpmass',
  'cvmolar',
  'cvmass',
  'gibbsmolar',
  'gibbsmass',
  'helmholtzmolar',
  'helmholtzmass',
  'speed_sound',
  'isothermal_compressibility',
  'isobaric_expansion_coefficient',
  'isentropic_expansion_coefficient',
  'viscosity',
  'conductivity',
  'surface_tension',
  'Prandtl',
  'T_critical',
  'p_critical',
  'rhomolar_critical',
  'rhomass_critical',
  'p_triple',
  'Ttriple',
  'Tmin',
  'Tmax',
  'pmax',
  'dipole_moment',
])
const ABSTRACT_STATE_METHODS = Object.freeze({
  T: 'T',
  rhomolar: 'rhomolar',
  rhomass: 'rhomass',
  p: 'p',
  Q: 'Q',
  tau: 'tau',
  delta: 'delta',
  molar_mass: 'molar_mass',
  acentric_factor: 'acentric_factor',
  gas_constant: 'gas_constant',
  Bvirial: 'Bvirial',
  Cvirial: 'Cvirial',
  compressibility_factor: 'compressibility_factor',
  hmolar: 'hmolar',
  hmass: 'hmass',
  smolar: 'smolar',
  smass: 'smass',
  umolar: 'umolar',
  umass: 'umass',
  cpmolar: 'cpmolar',
  cpmass: 'cpmass',
  cvmolar: 'cvmolar',
  cvmass: 'cvmass',
  gibbsmolar: 'gibbsmolar',
  gibbsmass: 'gibbsmass',
  helmholtzmolar: 'helmholtzmolar',
  helmholtzmass: 'helmholtzmass',
  speed_sound: 'speed_sound',
  isothermal_compressibility: 'isothermal_compressibility',
  isobaric_expansion_coefficient: 'isobaric_expansion_coefficient',
  isentropic_expansion_coefficient: 'isentropic_expansion_coefficient',
  viscosity: 'viscosity',
  conductivity: 'conductivity',
  surface_tension: 'surface_tension',
  Prandtl: 'Prandtl',
  T_critical: 'T_critical',
  p_critical: 'p_critical',
  rhomolar_critical: 'rhomolar_critical',
  rhomass_critical: 'rhomass_critical',
  p_triple: 'p_triple',
  Ttriple: 'Ttriple',
  Tmin: 'Tmin',
  Tmax: 'Tmax',
  pmax: 'pmax',
  dipole_moment: 'dipole_moment',
})
const PROVENANCE = Object.freeze({
  source: 'CoolProp',
  sourceRevision: SOURCE_REVISION,
  implementationRevision: IMPLEMENTATION_REVISION,
  execution: 'verified-local-classic-worker',
  license: 'MIT',
  validatesTheory: false,
  doesNotEstablish: 'A property-library evaluation is not a validation of a physical theory, model, or experimental result.',
  artifact: Object.freeze({
    javascript: Object.freeze({
      path: 'wasm/awesomePhysics/coolprop/coolprop.js',
      sha256: '0ffde908dc61430b78e02f5b60a1eee04d4b80f69af72739235b3ecb16eac7f6',
      byteSize: 171012,
    }),
    wasm: Object.freeze({
      path: 'wasm/awesomePhysics/coolprop/coolprop.wasm',
      sha256: '14a7efa251ea9bd443d37a6629206434689894d12f123202dc9d698a5607f762',
      byteSize: 9352503,
    }),
  }),
})

const worker = self
const activeRequests = new Map()
const cancelledBeforeStart = new Map()
const wasmUrl = new URL('./coolprop.wasm', self.location.href).href
let coolpropInitialization = null

function errorMessage(reason) {
  let message
  try {
    message = reason instanceof Error ? reason.message : String(reason)
  } catch {
    message = 'Unknown CoolProp worker failure'
  }
  if (typeof message !== 'string' || message.trim().length === 0) message = 'Unknown CoolProp worker failure'
  return message.slice(0, MAX_ERROR_LENGTH)
}

function fail(path, message) {
  throw new TypeError(`${path} ${message}`)
}

function isPlainRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertJson(value, path, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'must contain finite numbers')
    return
  }
  if (typeof value !== 'object' || depth > 16 || seen.has(value)) fail(path, 'must be bounded JSON')
  if (!Array.isArray(value) && !isPlainRecord(value)) fail(path, 'must be bounded JSON')
  seen.add(value)
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'must be present')
      assertJson(value[index], `${path}[${index}]`, depth + 1, seen)
    }
  } else {
    for (const [key, entry] of Object.entries(value)) assertJson(entry, `${path}.${key}`, depth + 1, seen)
  }
  seen.delete(value)
}

function exactKeys(value, required, path) {
  const allowed = new Set(required)
  const unknown = Object.keys(value).filter((key) => !allowed.has(key))
  const missing = required.filter((key) => !Object.hasOwn(value, key))
  if (unknown.length > 0) fail(path, `has unknown properties: ${unknown.join(', ')}`)
  if (missing.length > 0) fail(path, `is missing properties: ${missing.join(', ')}`)
}

function finiteNumber(value, path, minimum = -MAX_ABSOLUTE_VALUE, maximum = MAX_ABSOLUTE_VALUE) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number')
  if (value < minimum || value > maximum) fail(path, `must be between ${minimum} and ${maximum}`)
  return value
}

function boundedString(value, path) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_INPUT_STRING_LENGTH) {
    fail(path, `must be a non-empty string of at most ${MAX_INPUT_STRING_LENGTH} characters`)
  }
  return value
}

function parseInput(value) {
  assertJson(value, 'CoolProp input')
  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > MAX_INPUT_BYTES) {
    fail('CoolProp input', `must be at most ${MAX_INPUT_BYTES} UTF-8 bytes`)
  }
  if (!isPlainRecord(value)) fail('CoolProp input', 'must be a JSON object')
  if (value.operation === 'F2K') {
    exactKeys(value, ['operation', 'celsius'], 'CoolProp input')
    return {
      operation: 'F2K',
      celsius: finiteNumber(value.celsius, 'CoolProp input.celsius', F2K_MIN_CELSIUS, F2K_MAX_CELSIUS),
    }
  }
  if (value.operation === 'PropsSI') {
    exactKeys(value, ['operation', 'output', 'input1', 'value1', 'input2', 'value2', 'fluid'], 'CoolProp input')
    return {
      operation: 'PropsSI',
      output: boundedString(value.output, 'CoolProp input.output'),
      input1: boundedString(value.input1, 'CoolProp input.input1'),
      value1: finiteNumber(value.value1, 'CoolProp input.value1'),
      input2: boundedString(value.input2, 'CoolProp input.input2'),
      value2: finiteNumber(value.value2, 'CoolProp input.value2'),
      fluid: boundedString(value.fluid, 'CoolProp input.fluid'),
    }
  }
  if (value.operation === 'AbstractState') {
    exactKeys(value, ['operation', 'backend', 'fluid', 'inputPair', 'value1', 'value2', 'outputs'], 'CoolProp input')
    if (!Array.isArray(value.outputs) || value.outputs.length < 1 || value.outputs.length > MAX_ABSTRACT_STATE_OUTPUTS) {
      fail('CoolProp input.outputs', `must contain between 1 and ${MAX_ABSTRACT_STATE_OUTPUTS} entries`)
    }
    const outputs = value.outputs.map((output, index) => {
      const name = boundedString(output, `CoolProp input.outputs[${index}]`)
      if (!ABSTRACT_STATE_OUTPUTS.has(name)) fail(`CoolProp input.outputs[${index}]`, 'is not supported')
      return name
    })
    if (new Set(outputs).size !== outputs.length) fail('CoolProp input.outputs', 'must contain unique output names')
    return {
      operation: 'AbstractState',
      backend: boundedString(value.backend, 'CoolProp input.backend'),
      fluid: boundedString(value.fluid, 'CoolProp input.fluid'),
      inputPair: boundedString(value.inputPair, 'CoolProp input.inputPair'),
      value1: finiteNumber(value.value1, 'CoolProp input.value1'),
      value2: finiteNumber(value.value2, 'CoolProp input.value2'),
      outputs,
    }
  }
  fail('CoolProp input.operation', 'must be F2K, PropsSI, or AbstractState')
}

function checkCancelled(controller) {
  if (!controller.cancelled) return
  const error = new Error('The CoolProp operation was cancelled')
  error.name = 'AbortError'
  throw error
}

function finiteOutput(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'returned a non-finite number')
  return value
}

function getCoolProp() {
  if (coolpropInitialization === null) {
    const factory = self.Module
    if (typeof factory !== 'function') throw new Error('CoolProp classic Module factory is missing')
    coolpropInitialization = Promise.resolve(factory({
      locateFile(file) {
        if (file === 'coolprop.wasm') return wasmUrl
        return new URL(file, self.location.href).href
      },
    }))
  }
  return coolpropInitialization
}

function provenance() {
  return PROVENANCE
}

function evaluateF2K(coolprop, input, controller) {
  checkCancelled(controller)
  const kelvin = finiteOutput(coolprop.F2K(input.celsius), 'CoolProp F2K')
  checkCancelled(controller)
  return {
    schemaVersion: 1,
    operation: 'F2K',
    input,
    kelvin,
    units: { celsius: 'degC', kelvin: 'K' },
    provenance: provenance(),
  }
}

function evaluatePropsSI(coolprop, input, controller) {
  checkCancelled(controller)
  const value = finiteOutput(
    coolprop.PropsSI(input.output, input.input1, input.value1, input.input2, input.value2, input.fluid),
    'CoolProp PropsSI',
  )
  checkCancelled(controller)
  return {
    schemaVersion: 1,
    operation: 'PropsSI',
    input,
    value,
    provenance: provenance(),
  }
}

function evaluateAbstractState(coolprop, input, controller) {
  checkCancelled(controller)
  if (coolprop.input_pairs === null
    || (typeof coolprop.input_pairs !== 'object' && typeof coolprop.input_pairs !== 'function')) {
    fail('CoolProp input.inputPair', 'is not an available CoolProp input pair')
  }
  const inputPair = input.inputPair === 'PQ_INPUTS'
    ? coolprop.input_pairs.PQ_INPUTS
    : coolprop.input_pairs[input.inputPair]
  if (inputPair === undefined || inputPair === null) {
    fail('CoolProp input.inputPair', 'is not an available CoolProp input pair')
  }
  const state = coolprop.factory(input.backend, input.fluid)
  if (state === null || typeof state !== 'object') throw new Error('CoolProp AbstractState factory returned no state')
  try {
    state.update(inputPair, input.value1, input.value2)
    const values = {}
    for (const output of input.outputs) {
      checkCancelled(controller)
      const methodName = ABSTRACT_STATE_METHODS[output]
      if (typeof state[methodName] !== 'function') fail(`CoolProp output.${output}`, 'is not available on the state')
      values[output] = finiteOutput(state[methodName](), `CoolProp AbstractState ${output}`)
    }
    checkCancelled(controller)
    return {
      schemaVersion: 1,
      operation: 'AbstractState',
      input,
      backend: String(state.backend_name()),
      values,
      provenance: provenance(),
    }
  } finally {
    if (typeof state.delete === 'function') state.delete()
  }
}

async function execute(request, controller) {
  const input = parseInput(request.input)
  const coolprop = await getCoolProp()
  checkCancelled(controller)
  let result
  if (input.operation === 'F2K') result = evaluateF2K(coolprop, input, controller)
  else if (input.operation === 'PropsSI') result = evaluatePropsSI(coolprop, input, controller)
  else result = evaluateAbstractState(coolprop, input, controller)
  const serialized = JSON.stringify(result)
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > MAX_OUTPUT_BYTES) {
    fail('CoolProp output', `must be at most ${MAX_OUTPUT_BYTES} UTF-8 bytes`)
  }
  return result
}

function postFailure(request, reason) {
  try {
    worker.postMessage({
      type: 'failed',
      requestId: request && typeof request.requestId === 'string' ? request.requestId : 'invalid-request',
      adapterId: request && typeof request.adapterId === 'string' ? request.adapterId : COOLPROP_ADAPTER_ID,
      descriptor: request && request.descriptor ? request.descriptor : null,
      progress: 0,
      error: errorMessage(reason),
    })
  } catch {
    // A failed structured clone cannot be reported through the same channel.
  }
}

function postCancelled(request) {
  worker.postMessage({
    type: 'cancelled',
    requestId: request.requestId,
    adapterId: request.adapterId,
    descriptor: request.descriptor,
    progress: 0,
  })
}

async function executeRequest(request, controller) {
  try {
    worker.postMessage({
      type: 'started',
      requestId: request.requestId,
      adapterId: request.adapterId,
      descriptor: request.descriptor,
      progress: 0,
    })
    const result = await execute(request, controller)
    checkCancelled(controller)
    worker.postMessage({
      type: 'completed',
      requestId: request.requestId,
      adapterId: request.adapterId,
      descriptor: request.descriptor,
      progress: 100,
      result,
    })
  } catch (reason) {
    if (controller.cancelled || (reason instanceof Error && reason.name === 'AbortError')) postCancelled(request)
    else postFailure(request, reason)
  } finally {
    activeRequests.delete(request.requestId)
  }
}

function handleCancel(requestId) {
  const controller = activeRequests.get(requestId)
  if (controller) {
    controller.cancelled = true
    return
  }
  const previous = cancelledBeforeStart.get(requestId)
  if (previous !== undefined) clearTimeout(previous)
  const expiry = setTimeout(() => {
    if (cancelledBeforeStart.get(requestId) === expiry) cancelledBeforeStart.delete(requestId)
  }, 0)
  cancelledBeforeStart.set(requestId, expiry)
}

worker.addEventListener('message', (event) => {
  const request = event.data
  if (!request || typeof request !== 'object') {
    postFailure(null, new TypeError('CoolProp worker request must be an object'))
    return
  }
  if (request.type === 'cancel') {
    handleCancel(request.requestId)
    return
  }
  if (request.type !== 'run' || request.adapterId !== COOLPROP_ADAPTER_ID || typeof request.requestId !== 'string') {
    postFailure(request, new TypeError('CoolProp worker request is not a valid run request'))
    return
  }
  if (activeRequests.has(request.requestId)) {
    postFailure(request, new Error('Request ID is already active'))
    return
  }
  const pendingCancellation = cancelledBeforeStart.get(request.requestId)
  if (pendingCancellation !== undefined) {
    clearTimeout(pendingCancellation)
    cancelledBeforeStart.delete(request.requestId)
    postCancelled(request)
    return
  }
  const controller = { cancelled: false }
  activeRequests.set(request.requestId, controller)
  void executeRequest(request, controller)
})
