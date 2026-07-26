#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildConstantTaxonomy } from "./lib/constant-taxonomy.mjs";
import { buildEarthArtifacts, createEarthSourceLock, readEarthCorpus, verifyEarthSourceLock } from "./lib/earth-corpus.mjs";
import { buildEarthDatasetRegistry } from "./lib/earth-dataset-registry.mjs";
import { buildEarthEvidenceArtifacts } from "./lib/earth-evidence.mjs";
import { buildEarthSimulationCoverage } from "./lib/earth-simulation-coverage.mjs";
import { buildEarthSimulationRegistry } from "./lib/earth-simulation-registry.mjs";
import { parseConstantsYaml, parsePublishedOutput, parseSymbolsCsv, readJson } from "./lib/source-parser.mjs";
import { buildTourArtifacts, readTourSource } from "./lib/tour-content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = resolve(root, "..");
const sourceDirectory = join(root, "public", "data", "sources");
const generatedDirectory = join(root, "public", "data", "generated");
const sitePdfDirectory = join(root, "data", "physics_monastery", "site");
const tourSourceDirectory = join(root, "content", "tour");
const run = promisify(execFile);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function generateCompletion() {
  return new Promise((resolvePromise, reject) => {
    const executable = join(root, "node_modules", ".bin", "vite-node");
    const child = spawn(executable, [join(root, "scripts", "generate-completion.ts")], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Completion generator exited with status ${code ?? "unknown"}`));
    });
  });
}

async function earthRevision(earthRoot) {
  const [{ stdout: status }, { stdout: revision }] = await Promise.all([
    run("git", ["-C", earthRoot, "status", "--porcelain"]),
    run("git", ["-C", earthRoot, "rev-parse", "HEAD"]),
  ]);
  assert(status.trim() === "", "Refusing to update the EARTH source lock from a dirty worktree");
  return revision.trim();
}

async function filesBelow(directory, extension) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(path, extension));
    else if (!extension || entry.name.toLowerCase().endsWith(extension)) output.push(path);
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

function conceptLinks(name) {
  const normalized = name.toLowerCase();
  const links = [];
  if (/planck|quantum|uqft/.test(normalized)) links.push("planck-five-forms", "complex-planck-surfaces");
  if (/knot|trefoil|manifold|gieseking|hyperbol/.test(normalized)) links.push("figure-eight-gieseking-identities", "hyperbolic-quartic-roots");
  if (/combinator|binomial|transform/.test(normalized)) links.push("binomial-constructor", "transform-families");
  if (/leech|sphere|dimension|lattice/.test(normalized)) links.push("hypersphere-24d-leech");
  if (/zero|prime|spectrum|dirac/.test(normalized)) links.push("constructive-twisted-zeros", "companion-matrix-flow");
  if (/unit|dimension|boundary/.test(normalized)) links.push("coherent-five-axis-units", "typed-six-axis-boundary");
  return [...new Set(links)];
}

function parseIndexPdfs(indexText) {
  const entries = [];
  for (const line of indexText.split("\n")) {
    const match = line.match(/^\| `([^`]+\.pdf)` \| ([^|]+) \| (\d+) \| (\d+) \| `([a-f0-9]{64})` \|(?: ([^|]+) \|)?$/);
    if (!match) continue;
    entries.push({
      id: `corpus-${entries.length + 1}`,
      localPath: match[1],
      title: match[2].trim(),
      pages: Number(match[3]),
      bytes: Number(match[4]),
      sha256: match[5],
      sourceUrl: match[6]?.trim() ?? null,
      family: "context-corpus",
      contextOnly: true,
      licenseClaim: null,
      conceptLinks: conceptLinks(`${match[1]} ${match[2]}`),
    });
  }
  return entries;
}

async function sitePdfMetadata(path) {
  const bytes = await readFile(path);
  const content = bytes.toString("latin1");
  const filename = path.slice(path.lastIndexOf("/") + 1);
  return {
    id: `physics-monastery-${filename.replace(/\.pdf$/i, "")}`,
    localSourcePath: path,
    title: filename.replace(/[-_]/g, " ").replace(/\.pdf$/i, ""),
    pages: content.match(/\/Type\s*\/Page\b/g)?.length ?? null,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    sourceUrl: null,
    family: "physics-monastery-site-recovery",
    contextOnly: false,
    licenseClaim: null,
    accessNote: "Recovered site PDF retained outside public/data; metadata only is published here.",
    conceptLinks: conceptLinks(filename),
  };
}

await mkdir(generatedDirectory, { recursive: true });

const constantsText = await readFile(join(sourceDirectory, "constants.yaml"), "utf8");
const symbolsText = await readFile(join(sourceDirectory, "symbols.csv"), "utf8");
const publishedText = await readFile(join(sourceDirectory, "latest-output.txt"), "utf8");
const wallIndex = await readJson(join(sourceDirectory, "number-walls-index.json"));
const sourceManifest = await readJson(join(sourceDirectory, "manifest.json"));
const generatedAt = process.env.SOURCE_DATE || sourceManifest.acquisitionDate;
const recipes = parseConstantsYaml(constantsText);
const symbols = parseSymbolsCsv(symbolsText);
const published = parsePublishedOutput(publishedText);

assert(recipes.length === 288, `Expected 288 parsed recipes, found ${recipes.length}`);
assert(symbols.length === 80, `Expected 80 parsed symbols, found ${symbols.length}`);
assert(published.length === 288, `Expected 288 published results, found ${published.length}`);
assert(wallIndex.length === 351, `Expected 351 wall entries, found ${wallIndex.length}`);
const natureWalls = wallIndex.filter((entry) => entry.category === "constants-of-nature");
assert(natureWalls.length === 288, `Expected 288 nature walls, found ${natureWalls.length}`);

const recipeRegistryBase = recipes.map((recipe, index) => {
  const result = published[index];
  const wall = natureWalls[index];
  assert(recipe.recipe_number === index + 1, `Recipe order mismatch at ${index + 1}`);
  assert(result.recipeNumber === recipe.recipe_number, `Published output order mismatch at ${index + 1}`);
  assert(wall.id.startsWith(`nature-${String(index + 1).padStart(3, "0")}-`), `Wall order mismatch at ${index + 1}`);
  return {
    ...recipe,
    model_value: wall.modelValue,
    wall_id: wall.id,
    published_result: result,
  };
});
const { recipes: recipeRegistry, artifact: taxonomy } = buildConstantTaxonomy(recipeRegistryBase, generatedAt);

const wallRegistry = wallIndex.map((entry) => ({
  ...entry,
  dataUrl: `/data/number-walls/${entry.filename}`,
  provenanceUrl: `${sourceManifest.walls.find((wall) => wall.id === entry.id)?.url ?? ""}`,
}));

const indexText = await readFile(join(corpusRoot, "INDEX.md"), "utf8");
const corpusPdfs = parseIndexPdfs(indexText);
const sitePdfPaths = (await filesBelow(sitePdfDirectory, ".pdf")).filter((path) => ["288.pdf", "combinatorics.pdf", "transform_dictionary.pdf"].includes(path.slice(path.lastIndexOf("/") + 1)));
const sitePdfs = await Promise.all(sitePdfPaths.map(sitePdfMetadata));
const earthRoot = join(corpusRoot, "EARTH");
const earthLockPath = join(sourceDirectory, "earth-source-lock.json");
const earthDocuments = await readEarthCorpus(earthRoot);
let earthLock;
if (process.argv.includes("--update-earth-lock")) {
  earthLock = createEarthSourceLock(earthDocuments, {
    lockedAt: generatedAt,
    sourceRevision: await earthRevision(earthRoot),
  });
  await writeFile(earthLockPath, stableJson(earthLock));
} else {
  earthLock = await readJson(earthLockPath);
}
verifyEarthSourceLock(earthDocuments, earthLock);
assert(earthDocuments.length === 63, `Expected 63 locked EARTH documents, found ${earthDocuments.length}`);
const earthArtifacts = buildEarthArtifacts(earthDocuments, earthLock);
const earthPlanPath = join(corpusRoot, "research", "earth-thad-nassim", "EARTH_SIMULATION_PLAN.md");
const earthPlanText = await readFile(earthPlanPath, "utf8");
const earthSimulationArtifacts = buildEarthSimulationRegistry(earthPlanText, earthArtifacts.manifest);
const earthSimulationCoverage = buildEarthSimulationCoverage({
  manifest: earthArtifacts.manifest,
  formulas: earthArtifacts.formulas,
  code: earthArtifacts.code,
  simulations: earthArtifacts.simulations,
  registry: earthSimulationArtifacts.registry,
});
const earthDatasetRegistryPath = join(corpusRoot, "research", "earth-thad-nassim", "EARTH_DATASET_REGISTRY.md");
const earthDatasetRegistryText = await readFile(earthDatasetRegistryPath, "utf8");
const earthDatasetRegistry = buildEarthDatasetRegistry(earthDatasetRegistryText, {
  sourcePlan: earthSimulationArtifacts.registry.sourcePlan,
});
const earthEvidenceArtifacts = buildEarthEvidenceArtifacts({
  manifest: earthArtifacts.manifest,
  coverage: earthSimulationCoverage,
  registry: earthSimulationArtifacts.registry,
  datasets: earthDatasetRegistry,
});
const tourSource = await readTourSource(tourSourceDirectory);
const tourArtifacts = buildTourArtifacts(tourSource, {
  recipeIds: recipeRegistry.map(({ constant_id: id }) => id),
  programIds: earthSimulationArtifacts.registry.items.map(({ id }) => id),
});
const earthInventory = earthArtifacts.manifest.documents.map((document) => ({
  id: document.id,
  localPath: `EARTH/${document.source.path}`,
  title: document.title,
  bytes: document.source.bytes,
  sha256: document.source.sha256,
  family: "earth-local-markdown",
  contextOnly: true,
  licenseClaim: earthLock.license.identifier,
  conceptLinks: conceptLinks(document.title),
}));

const provenance = {
  schemaVersion: 1,
  generatedAt,
  policy: {
    publicSourceRecordsCopied: true,
    sourcePdfsPublished: false,
    licenseClaim: "No source license is asserted by this metadata registry.",
    contextRule: "Only Physics Monastery recovered site material is direct simulation provenance; all other corpus and EARTH entries are context only.",
  },
  physicsMonastery: {
    siteUrl: "https://www.physicsmonastery.earth/",
    sourceArtifacts: sourceManifest.preserved,
    recoveredSitePdfs: sitePdfs,
  },
  contextualPdfs: corpusPdfs,
  earthMarkdown: earthInventory,
};

const earthGeneratedDirectory = join(generatedDirectory, "earth");
const earthDocumentDirectory = join(earthGeneratedDirectory, "documents");
const earthEvidenceDirectory = join(earthGeneratedDirectory, "evidence");
const earthEvidenceProgramDirectory = join(earthEvidenceDirectory, "programs");
const earthEvidenceDocumentDirectory = join(earthEvidenceDirectory, "documents");
const tourGeneratedDirectory = join(generatedDirectory, "tour");
const tourChapterDirectory = join(tourGeneratedDirectory, "chapters");
const tourLessonDirectory = join(tourGeneratedDirectory, "lessons");
const tourSimulationDirectory = join(tourGeneratedDirectory, "simulations");
await rm(earthDocumentDirectory, { recursive: true, force: true });
await rm(earthEvidenceDirectory, { recursive: true, force: true });
await rm(tourGeneratedDirectory, { recursive: true, force: true });
await mkdir(earthDocumentDirectory, { recursive: true });
await mkdir(earthEvidenceProgramDirectory, { recursive: true });
await mkdir(earthEvidenceDocumentDirectory, { recursive: true });
await mkdir(tourChapterDirectory, { recursive: true });
await mkdir(tourLessonDirectory, { recursive: true });
await mkdir(tourSimulationDirectory, { recursive: true });

await Promise.all([
  writeFile(join(generatedDirectory, "recipes.json"), stableJson(recipeRegistry)),
  writeFile(join(generatedDirectory, "taxonomy.json"), stableJson(taxonomy)),
  writeFile(join(generatedDirectory, "symbols.json"), stableJson(symbols)),
  writeFile(join(generatedDirectory, "walls.json"), stableJson(wallRegistry)),
  writeFile(join(generatedDirectory, "provenance.json"), stableJson(provenance)),
  writeFile(join(earthGeneratedDirectory, "manifest.json"), stableJson(earthArtifacts.manifest)),
  writeFile(join(earthGeneratedDirectory, "formulas.json"), stableJson(earthArtifacts.formulas)),
  writeFile(join(earthGeneratedDirectory, "claims.json"), stableJson(earthArtifacts.claims)),
  writeFile(join(earthGeneratedDirectory, "code.json"), stableJson(earthArtifacts.code)),
  writeFile(join(earthGeneratedDirectory, "simulations.json"), stableJson(earthArtifacts.simulations)),
  writeFile(join(earthGeneratedDirectory, "scientific-simulations.json"), stableJson(earthSimulationArtifacts.registry)),
  writeFile(join(earthGeneratedDirectory, "scientific-coverage.json"), stableJson(earthSimulationCoverage)),
  writeFile(join(earthGeneratedDirectory, "datasets.json"), stableJson(earthDatasetRegistry)),
  writeFile(join(earthGeneratedDirectory, "completion.json"), stableJson(earthSimulationArtifacts.completion)),
  writeFile(join(earthEvidenceDirectory, "manifest.json"), stableJson(earthEvidenceArtifacts.manifest)),
  writeFile(join(tourGeneratedDirectory, "manifest.json"), stableJson(tourArtifacts.manifest)),
  writeFile(join(tourGeneratedDirectory, "glossary.json"), stableJson(tourArtifacts.glossary)),
  writeFile(join(tourGeneratedDirectory, "references.json"), stableJson(tourArtifacts.references)),
  writeFile(join(tourGeneratedDirectory, "claim-vocabulary.json"), stableJson(tourArtifacts.claimVocabulary)),
  ...earthArtifacts.shards.map(({ slug, artifact }) => writeFile(join(earthDocumentDirectory, `${slug}.json`), stableJson(artifact))),
  ...earthEvidenceArtifacts.programShards.map(({ id, artifact }) => writeFile(join(earthEvidenceProgramDirectory, `${id}.json`), stableJson(artifact))),
  ...earthEvidenceArtifacts.documentShards.map(({ slug, artifact }) => writeFile(join(earthEvidenceDocumentDirectory, `${slug}.json`), stableJson(artifact))),
  ...tourArtifacts.chapters.map((artifact) => writeFile(join(tourChapterDirectory, `${artifact.id}.json`), stableJson(artifact))),
  ...tourArtifacts.lessons.map((artifact) => writeFile(join(tourLessonDirectory, `${artifact.id}.json`), stableJson(artifact))),
  ...tourArtifacts.simulations.map((artifact) => writeFile(join(tourSimulationDirectory, `${artifact.id}.json`), stableJson(artifact))),
]);
await generateCompletion();

console.log(JSON.stringify({ recipes: recipes.length, symbols: symbols.length, walls: wallIndex.length, corpusPdfs: corpusPdfs.length, sitePdfs: sitePdfs.length, earth: earthArtifacts.manifest.summary, earthScientificSimulations: earthSimulationArtifacts.registry.summary, earthScientificCoverage: earthSimulationCoverage.summary, earthDatasets: earthDatasetRegistry.summary, earthEvidence: earthEvidenceArtifacts.manifest.summary, tour: tourArtifacts.summary }));
