import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildGrayMachineArtifact,
  canonicalJson,
  compileGrayMachines,
  renderGrayMachineModule,
  validateMachineContracts,
} from '../../../scripts/lib/gray-machine-compiler.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const MACHINE_ROOT = join(ROOT, 'fem/edwin-gray/machines/v1')
const SCHEMA_PATH = join(ROOT, 'fem/edwin-gray/schema/motor-machine.schema.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fixtures() {
  const schema = readJson(SCHEMA_PATH)
  const contracts = readdirSync(MACHINE_ROOT)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(MACHINE_ROOT, name)))
  return { schema, contracts }
}

test('compiler output is canonical, deterministic, current, and below the artifact limit', async () => {
  const { schema, contracts } = fixtures()
  const first = buildGrayMachineArtifact(contracts, schema)
  const second = buildGrayMachineArtifact([...contracts].reverse(), schema)
  assert.equal(canonicalJson(first), canonicalJson(second))
  assert.equal(renderGrayMachineModule(first), renderGrayMachineModule(second))
  assert.match(first.metadata.sourceHash, /^[a-f0-9]{64}$/)
  assert.equal(first.metadata.modelKey, first.metadata.compatibilityKeys.workbenchSnapshots)
  assert.equal(first.motorIds.length, 7)
  const checked = await compileGrayMachines({ root: ROOT, check: true })
  assert.ok(checked.bytes < 64 * 1024)
})

test('compiler rejects unknown fields and non-finite runtime values', () => {
  const { schema, contracts } = fixtures()
  const unknown = structuredClone(contracts)
  unknown[0].runtimeModel.catalog.unknown = true
  assert.throws(() => validateMachineContracts(unknown, schema), /unknown is not allowed/)

  const nonFinite = structuredClone(contracts)
  nonFinite[0].runtimeModel.defaults.chargeVoltageV = Number.POSITIVE_INFINITY
  assert.throws(() => validateMachineContracts(nonFinite, schema), /must have type number|must be finite/)
})

test('compiler rejects patent FEM inheritance by descriptive prototypes', () => {
  const { schema, contracts } = fixtures()
  const inherited = structuredClone(contracts)
  const prototype = inherited.find(({ machineKind }) => machineKind === 'engine-prototype')
  const patent = inherited.find(({ machineKind }) => machineKind === 'patent-illustrative-topology')
  prototype.compatibilityIdentity.topology = structuredClone(patent.compatibilityIdentity.topology)
  assert.throws(() => validateMachineContracts(inherited, schema), /inherits unavailable FEM field topology/)
})
