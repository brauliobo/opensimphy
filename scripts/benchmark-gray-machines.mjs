#!/usr/bin/env node

import { stat } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serialize } from 'node:v8'
import { createServer } from 'vite'

const args = new Set(process.argv.slice(2))
for (const argument of args) {
  if (argument !== '--json') throw new Error(`Unknown argument: ${argument}`)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })

function median(values) {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

function assertFinite(value, path = 'result') {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${path} is not finite`)
  if (Array.isArray(value)) value.forEach((child, index) => assertFinite(child, `${path}[${index}]`))
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFinite(child, `${path}.${key}`)
  }
}

try {
  const engine = await server.ssrLoadModule('/src/edwin-gray/edwinGrayEngine.ts')
  const artifactPath = resolve(root, 'src/edwin-gray/generated/grayMachines.generated.ts')
  const artifactBytes = (await stat(artifactPath)).size
  const timings = Object.fromEntries(engine.GRAY_MOTOR_IDS.map((motorId) => [motorId, []]))
  const resultBytes = {}
  const closure = {}
  const rounds = 3

  for (let round = 0; round < rounds; round += 1) {
    for (const motorId of engine.GRAY_MOTOR_IDS) {
      const preset = engine.GRAY_PRESETS[motorId]
      const profile = Object.values(engine.GRAY_ENGINE_PROFILES).find((entry) => entry.motorId === motorId)
      const started = performance.now()
      const result = engine.evaluateGrayFullMotor({
        ...preset,
        machineContractId: profile.contractId,
        revolutions: 100,
        mode: 'prescribed-diagnostic',
        machineMode: 'modified-electronic-v1',
      })
      timings[motorId].push(performance.now() - started)
      assertFinite(result)
      if (Math.abs(result.ledger.normalizedResidual) > 1e-8) throw new Error(`${motorId} energy boundary did not close`)
      if (result.ledger.wholeSystemCop > 1 + 1e-10) throw new Error(`${motorId} COP exceeded one`)
      if (result.completedRevolutions !== 100) throw new Error(`${motorId} did not complete 100 revolutions`)
      const bytes = serialize(result).byteLength
      if (bytes >= 8 * 1024 * 1024) throw new Error(`${motorId} result is ${bytes} bytes; limit is below 8388608 bytes`)
      resultBytes[motorId] = bytes
      closure[motorId] = {
        normalizedResidual: result.ledger.normalizedResidual,
        wholeSystemCop: result.ledger.wholeSystemCop,
      }
    }
  }

  if (artifactBytes >= 64 * 1024) throw new Error(`Artifact is ${artifactBytes} bytes; limit is below 65536 bytes`)
  const modelMediansMs = Object.fromEntries(Object.entries(timings).map(([motorId, samples]) => [motorId, median(samples)]))
  const aggregateSamplesMs = Array.from({ length: rounds }, (_, round) => (
    Object.values(timings).reduce((sum, samples) => sum + samples[round], 0)
  ))
  const aggregateMedianMs = median(aggregateSamplesMs)
  const timingFailures = Object.entries(modelMediansMs)
    .filter(([, milliseconds]) => milliseconds > 1_000)
    .map(([motorId, milliseconds]) => `${motorId} median ${milliseconds.toFixed(1)} ms exceeds 1000 ms`)
  if (aggregateMedianMs > 5_000) timingFailures.push(`aggregate median ${aggregateMedianMs.toFixed(1)} ms exceeds 5000 ms`)

  const report = {
    status: timingFailures.length ? 'failed' : 'passed',
    models: engine.GRAY_MOTOR_IDS.length,
    revolutionsPerModel: 100,
    rounds,
    artifactBytes,
    resultBytes,
    resultSizeMetric: 'node:v8 serialized bytes (preserves shared frozen event templates)',
    modelMediansMs,
    aggregateMedianMs,
    closure,
    timingTargets: { individualMs: 1_000, aggregateMs: 5_000 },
    timingNote: 'Timing gates are hardware-sensitive wall-clock targets; functional finite, closure, COP, and size gates are deterministic.',
    timingFailures,
  }
  console.log(JSON.stringify(report, null, args.has('--json') ? 0 : 2))
  if (timingFailures.length) process.exitCode = 1
} finally {
  await server.close()
}
