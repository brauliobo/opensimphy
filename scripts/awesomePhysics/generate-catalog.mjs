#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAwesomePhysicsArtifacts } from '../lib/awesome-physics-catalog.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const corpusRoot = resolve(projectRoot, '..')
const outputDirectory = join(projectRoot, 'public/data/generated/awesomePhysics')

const [catalogText, manifestText, planText] = await Promise.all([
  readFile(join(corpusRoot, 'awesome-physics/README.md'), 'utf8'),
  readFile(join(corpusRoot, 'awesome-physics-repos/CLONE_MANIFEST.tsv'), 'utf8'),
  readFile(join(corpusRoot, 'AWESOME_PHYSICS_MIGRATION_PLAN.md'), 'utf8'),
])

const artifacts = buildAwesomePhysicsArtifacts({ catalogText, manifestText, planText })
await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(join(outputDirectory, 'catalog.json'), `${JSON.stringify(artifacts.catalog, null, 2)}\n`),
  writeFile(join(outputDirectory, 'simulations.json'), `${JSON.stringify(artifacts.simulations, null, 2)}\n`),
])

console.log(JSON.stringify({
  wrote: ['public/data/generated/awesomePhysics/catalog.json', 'public/data/generated/awesomePhysics/simulations.json'],
  catalog: artifacts.catalog.summary,
  simulations: artifacts.simulations.summary,
}, null, 2))
