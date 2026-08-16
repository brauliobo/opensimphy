#!/usr/bin/env node

import { compileGrayMachines } from './lib/gray-machine-compiler.mjs'

const args = new Set(process.argv.slice(2))
for (const argument of args) {
  if (argument !== '--check') throw new Error(`Unknown argument: ${argument}`)
}

const result = await compileGrayMachines({ check: args.has('--check') })
console.log(JSON.stringify({
  status: args.has('--check') ? 'current' : result.changed ? 'generated' : 'unchanged',
  output: result.outputPath,
  bytes: result.bytes,
  sourceHash: result.artifact.metadata.sourceHash,
  modelKey: result.artifact.metadata.modelKey,
}, null, 2))
