#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildConstantTaxonomy } from "./lib/constant-taxonomy.mjs";
import { buildEarthArtifacts, createEarthSourceLock, readEarthCorpus, verifyEarthSourceLock } from "./lib/earth-corpus.mjs";
import { buildEarthDatasetRegistry } from "./lib/earth-dataset-registry.mjs";
import { buildEarthEvidenceArtifacts } from "./lib/earth-evidence.mjs";
import { buildEarthSimulationCoverage } from "./lib/earth-simulation-coverage.mjs";
import { buildEarthSimulationRegistry } from "./lib/earth-simulation-registry.mjs";
import { buildAwesomePhysicsArtifacts } from "./lib/awesome-physics-catalog.mjs";
import { readExternalCorpusArtifacts } from "./lib/external-corpus-artifacts.mjs";
import { bindPublishedResults, parseConstantsYaml, parsePublishedOutput, parseSymbolsCsv, readJson } from "./lib/source-parser.mjs";
import { buildTourArtifacts, readTourSource } from "./lib/tour-content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = resolve(root, "..");
const sourceDirectory = join(root, "public", "data", "sources");
const generatedDirectory = join(root, "public", "data", "generated");
const sitePdfDirectory = join(root, "data", "physics_monastery", "site");
const tourSourceDirectory = join(root, "content", "tour");
const run = promisify(execFile);
const externalCorpusModeArgument = process.argv.find((argument) => argument.startsWith("--external-corpus-mode="));
const externalCorpusMode = externalCorpusModeArgument?.slice("--external-corpus-mode=".length) ?? "full";
if (!new Set(["full", "artifact"]).has(externalCorpusMode)) {
  throw new Error(`Unsupported external corpus mode: ${externalCorpusMode}. Use full or artifact.`);
}
if (externalCorpusMode === "artifact" && process.argv.includes("--update-earth-lock")) {
  throw new Error("--update-earth-lock requires --external-corpus-mode=full");
}

const EXPECTED_EXTERNAL_CORPUS = Object.freeze({
  awesomePhysics: {
    catalogRevision: "807186a1235f3b35aa969718e16b04480e4e5f6a",
    catalogEntries: 86,
    projectEntries: 75,
    simulationCapabilities: 76,
  },
  earth: {
    sourceRevision: "f054e54d2c9d3e0e6aad51b89a9ec40d68e3b8df",
    sourceLockSha256: "2ae1f11f2c80b970638696e00680ceb19ec12f0f4293eb60d498ed8f3941f675",
    documents: 63,
    formulas: 2123,
    codeBlocks: 153,
    simulationCandidates: 146,
    programs: 130,
    datasets: 19,
    disputedClaims: 4,
  },
  provenance: {
    contextualPdfs: 15,
    earthMarkdown: 63,
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const V_M_1_SOURCE_CAVEAT = "The source label says 100 kPa, while its p_1 dependency is 101325.003754773 Pa and expected value 0.02241396954 m^3/mol corresponds to about 101.325 kPa.";

function formulaSourceCaveats(recipe, result, recipes, symbols) {
  if (recipe.constant_id !== "V_m_1") return [];
  assert(recipe.recipe_number === 120, "V_m_1 must remain recipe 120");
  assert(recipe.display_name === "molar volume of ideal gas (273.15 K, 100kPa)", "V_m_1 source label changed");
  assert(recipe.expected_kind === "exact" && recipe.expected_value === 0.02241396954, "V_m_1 expected source value changed");
  assert(result.dependencies.includes("p_1"), "V_m_1 published dependencies do not contain p_1");
  const p0 = symbols.find(({ token }) => token === "p_0");
  const p1 = symbols.find(({ token }) => token === "p_1");
  assert(p0?.value === "1e5" && p0.dimension === "pascal", "p_0 source value changed");
  assert(p1?.value === "101325.003754773" && p1.dimension === "pascal", "p_1 source value changed");
  const reference = recipes.find(({ recipe_number: recipeNumber }) => recipeNumber === 119);
  assert(reference?.constant_id === "V_m_0" && reference.expected_value === 0.02271095464, "V_m_0 reference source value changed");
  const impliedPressure = Number(p0.value) * Number(reference.expected_value) / Number(recipe.expected_value);
  assert(Number.isFinite(impliedPressure) && Math.abs(impliedPressure - Number(p1.value)) < 0.01, "V_m_1 expected value no longer corresponds to about 101.325 kPa");
  return [V_M_1_SOURCE_CAVEAT];
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
  const sourcePath = relative(root, path).split(sep).join("/");
  assert(!sourcePath.startsWith("/") && !sourcePath.split("/").includes(".."), `Invalid site PDF source path: ${sourcePath}`);
  return {
    id: `physics-monastery-${filename.replace(/\.pdf$/i, "")}`,
    sourcePath,
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

function assertStableProvenance(value, path = "provenance") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertStableProvenance(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    assert(key !== "localSourcePath" && key !== "originalPath", `${path}.${key} is not a stable provenance field`);
    if (typeof entry === "string" && (/Path$/.test(key) || key === "sourceIdentifier")) {
      assert(!entry.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(entry), `${path}.${key} must not be an absolute path`);
      assert(!entry.includes("\\") && !entry.split("/").includes(".."), `${path}.${key} must be a safe POSIX path`);
    }
    assertStableProvenance(entry, `${path}.${key}`);
  }
}

await mkdir(generatedDirectory, { recursive: true });

const constantsText = await readFile(join(sourceDirectory, "constants.yaml"), "utf8");
const symbolsText = await readFile(join(sourceDirectory, "symbols.csv"), "utf8");
const publishedText = await readFile(join(sourceDirectory, "latest-output.txt"), "utf8");
const wallIndex = await readJson(join(sourceDirectory, "number-walls-index.json"));
const sourceManifest = await readJson(join(sourceDirectory, "manifest.json"));
const generatedAt = process.env.SOURCE_DATE || sourceManifest.acquisitionDate;
const externalCorpusArtifacts = externalCorpusMode === "artifact"
  ? await readExternalCorpusArtifacts({ root, sourceDirectory })
  : null;
let awesomePhysics;
if (externalCorpusArtifacts) {
  awesomePhysics = {
    catalog: externalCorpusArtifacts.json("generated/awesomePhysics/catalog.json"),
    simulations: externalCorpusArtifacts.json("generated/awesomePhysics/simulations.json"),
  };
} else {
  const awesomePhysicsCatalogText = await readFile(join(corpusRoot, "awesome-physics", "README.md"), "utf8");
  const awesomePhysicsManifestText = await readFile(join(corpusRoot, "awesome-physics-repos", "CLONE_MANIFEST.tsv"), "utf8");
  const awesomePhysicsPlanText = await readFile(join(corpusRoot, "AWESOME_PHYSICS_MIGRATION_PLAN.md"), "utf8");
  awesomePhysics = buildAwesomePhysicsArtifacts({
    catalogText: awesomePhysicsCatalogText,
    manifestText: awesomePhysicsManifestText,
    planText: awesomePhysicsPlanText,
  });
}
const recipes = parseConstantsYaml(constantsText);
const symbols = parseSymbolsCsv(symbolsText);
const published = parsePublishedOutput(publishedText);
const publishedByRecipe = bindPublishedResults(recipes, published);

assert(recipes.length === 288, `Expected 288 parsed recipes, found ${recipes.length}`);
assert(symbols.length === 80, `Expected 80 parsed symbols, found ${symbols.length}`);
assert(published.length === 288, `Expected 288 published results, found ${published.length}`);
assert(wallIndex.length === 351, `Expected 351 wall entries, found ${wallIndex.length}`);
const natureWalls = wallIndex.filter((entry) => entry.category === "constants-of-nature");
assert(natureWalls.length === 288, `Expected 288 nature walls, found ${natureWalls.length}`);

const recipeRegistryBase = recipes.map((recipe, index) => {
  const result = publishedByRecipe.get(recipe.recipe_number);
  const wall = natureWalls[index];
  assert(recipe.recipe_number === index + 1, `Recipe order mismatch at ${index + 1}`);
  assert(result, `Published output is missing recipe ${recipe.recipe_number}`);
  assert(wall.id.startsWith(`nature-${String(index + 1).padStart(3, "0")}-`), `Wall order mismatch at ${index + 1}`);
  const sourceCaveats = formulaSourceCaveats(recipe, result, recipes, symbols);
  return {
    ...recipe,
    model_value: wall.modelValue,
    wall_id: wall.id,
    published_result: result,
    ...(sourceCaveats.length > 0 ? { source_caveats: sourceCaveats } : {}),
  };
});
const { recipes: recipeRegistry, artifact: taxonomy } = buildConstantTaxonomy(recipeRegistryBase, generatedAt);

const wallRegistry = wallIndex.map((entry) => ({
  ...entry,
  dataUrl: `/data/number-walls/${entry.filename}`,
  provenanceUrl: `${sourceManifest.walls.find((wall) => wall.id === entry.id)?.url ?? ""}`,
}));

const sitePdfPaths = (await filesBelow(sitePdfDirectory, ".pdf")).filter((path) => ["288.pdf", "combinatorics.pdf", "transform_dictionary.pdf"].includes(path.slice(path.lastIndexOf("/") + 1)));
const sitePdfs = await Promise.all(sitePdfPaths.map(sitePdfMetadata));
assert(sitePdfs.length === 3, `Expected 3 recovered site PDFs, found ${sitePdfs.length}`);
const earthLockPath = join(sourceDirectory, "earth-source-lock.json");
let earthLock;
let corpusPdfs;
let earthArtifacts;
let earthSimulationArtifacts;
let earthSimulationCoverage;
let earthDatasetRegistry;
let earthEvidenceArtifacts;
let earthDocumentWrites;
let earthInventory;
if (externalCorpusArtifacts) {
  const artifactProvenance = externalCorpusArtifacts.json("generated/provenance.json");
  const expected = externalCorpusArtifacts.manifest.expected;
  assert(JSON.stringify(expected) === JSON.stringify(EXPECTED_EXTERNAL_CORPUS), "External corpus artifact expectations are not the pinned release set");
  assertStableProvenance(artifactProvenance);
  assert(artifactProvenance.schemaVersion === 2, "External corpus provenance artifact schema is unsupported");
  assert(Array.isArray(artifactProvenance.contextualPdfs), "External corpus provenance is missing contextual PDFs");
  assert(Array.isArray(artifactProvenance.earthMarkdown), "External corpus provenance is missing EARTH metadata");
  assert(artifactProvenance.contextualPdfs.length === expected.provenance.contextualPdfs, "External corpus provenance PDF coverage is incomplete");
  assert(artifactProvenance.earthMarkdown.length === expected.provenance.earthMarkdown, "External corpus provenance EARTH coverage is incomplete");
  assert(JSON.stringify(artifactProvenance.physicsMonastery.sourceArtifacts) === JSON.stringify(sourceManifest.preserved), "External corpus provenance source artifact metadata drifted");
  assert(JSON.stringify(artifactProvenance.physicsMonastery.recoveredSitePdfs) === JSON.stringify(sitePdfs), "External corpus provenance site PDF metadata drifted");
  corpusPdfs = artifactProvenance.contextualPdfs;
  earthInventory = artifactProvenance.earthMarkdown;
  earthLock = await readJson(earthLockPath);
  const manifest = externalCorpusArtifacts.json("generated/earth/manifest.json");
  const formulas = externalCorpusArtifacts.json("generated/earth/formulas.json");
  const claims = externalCorpusArtifacts.json("generated/earth/claims.json");
  const code = externalCorpusArtifacts.json("generated/earth/code.json");
  const simulations = externalCorpusArtifacts.json("generated/earth/simulations.json");
  const registry = externalCorpusArtifacts.json("generated/earth/scientific-simulations.json");
  const coverage = externalCorpusArtifacts.json("generated/earth/scientific-coverage.json");
  const datasets = externalCorpusArtifacts.json("generated/earth/datasets.json");
  const completion = externalCorpusArtifacts.json("generated/earth/completion.json");
  assert(awesomePhysics.catalog.schemaVersion === 1, "External corpus Awesome Physics catalog schema is unsupported");
  assert(awesomePhysics.catalog.catalogRevision === expected.awesomePhysics.catalogRevision, "External corpus Awesome Physics catalog revision drifted");
  assert(awesomePhysics.catalog.summary.totalEntries === expected.awesomePhysics.catalogEntries, "External corpus Awesome Physics catalog coverage is incomplete");
  assert(awesomePhysics.catalog.summary.projectEntries === expected.awesomePhysics.projectEntries, "External corpus Awesome Physics project coverage is incomplete");
  assert(awesomePhysics.simulations.schemaVersion === 1, "External corpus Awesome Physics simulation schema is unsupported");
  assert(awesomePhysics.simulations.catalogRevision === expected.awesomePhysics.catalogRevision, "External corpus Awesome Physics simulation revision drifted");
  assert(awesomePhysics.simulations.summary.sourceCapabilities === expected.awesomePhysics.simulationCapabilities, "External corpus Awesome Physics simulation coverage is incomplete");
  assert(manifest.sourceRevision === expected.earth.sourceRevision, "External corpus EARTH source revision drifted");
  assert(manifest.sourceLockSha256 === expected.earth.sourceLockSha256, "External corpus EARTH source lock drifted");
  assert(manifest.summary.documents === expected.earth.documents, "External corpus EARTH document coverage is incomplete");
  assert(manifest.summary.formulas === expected.earth.formulas, "External corpus EARTH formula coverage is incomplete");
  assert(manifest.summary.codeBlocks === expected.earth.codeBlocks, "External corpus EARTH code coverage is incomplete");
  assert(manifest.summary.simulationCandidates === expected.earth.simulationCandidates, "External corpus EARTH simulation coverage is incomplete");
  assert(registry.items.length === expected.earth.programs, "External corpus EARTH program coverage is incomplete");
  assert(datasets.datasets.length === expected.earth.datasets, "External corpus EARTH dataset coverage is incomplete");
  assert(datasets.disputedClaims.length === expected.earth.disputedClaims, "External corpus EARTH disputed-claim coverage is incomplete");
  assert(completion.complete === true, "External corpus EARTH completion artifact is incomplete");
  assert(coverage.summary.exact === true, "External corpus EARTH scientific coverage is not exact");
  assert(earthLock.source?.revision === manifest.sourceRevision, "External corpus EARTH lock revision does not match its artifact");
  assert(earthLock.files.length === expected.earth.documents, "External corpus EARTH source lock is incomplete");
  assert(sha256(Buffer.from(stableJson(earthLock))) === manifest.sourceLockSha256, "External corpus EARTH source lock bytes do not match its artifact");
  const lockedPaths = new Map(earthLock.files.map(({ path, sha256: digest, bytes }) => [path, { sha256: digest, bytes }]));
  for (const document of manifest.documents) {
    const locked = lockedPaths.get(document.source.path);
    assert(locked?.sha256 === document.source.sha256 && locked.bytes === document.source.bytes, `External corpus EARTH document lock drifted: ${document.source.path}`);
  }
  assert(new Set(earthInventory.map(({ id }) => id)).size === expected.earth.documents, "External corpus EARTH provenance IDs are incomplete");
  assert(new Set(manifest.documents.map(({ id }) => id)).size === expected.earth.documents, "External corpus EARTH document IDs are incomplete");
  assert(JSON.stringify([...earthInventory].map(({ id }) => id).sort()) === JSON.stringify(manifest.documents.map(({ id }) => id).sort()), "External corpus EARTH provenance IDs drifted");
  earthArtifacts = { manifest, formulas, claims, code, simulations, shards: [] };
  earthSimulationArtifacts = { registry, completion };
  earthSimulationCoverage = coverage;
  earthDatasetRegistry = datasets;
  earthEvidenceArtifacts = buildEarthEvidenceArtifacts({
    manifest: earthArtifacts.manifest,
    coverage: earthSimulationCoverage,
    registry: earthSimulationArtifacts.registry,
    datasets: earthDatasetRegistry,
  });
  const documentPrefix = "generated/earth/documents/";
  earthDocumentWrites = [...externalCorpusArtifacts.files.entries()]
    .filter(([path]) => path.startsWith(documentPrefix))
    .map(([path, bytes]) => ({ slug: path.slice(documentPrefix.length, -5), bytes }));
  assert(earthDocumentWrites.length === expected.earth.documents, "External corpus EARTH document shards are incomplete");
} else {
  const indexText = await readFile(join(corpusRoot, "INDEX.md"), "utf8");
  corpusPdfs = parseIndexPdfs(indexText);
  assert(corpusPdfs.length === EXPECTED_EXTERNAL_CORPUS.provenance.contextualPdfs, `Expected ${EXPECTED_EXTERNAL_CORPUS.provenance.contextualPdfs} contextual PDFs, found ${corpusPdfs.length}`);
  const earthRoot = join(corpusRoot, "EARTH");
  const earthDocuments = await readEarthCorpus(earthRoot);
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
  earthArtifacts = buildEarthArtifacts(earthDocuments, earthLock);
  const earthPlanPath = join(corpusRoot, "research", "earth-thad-nassim", "EARTH_SIMULATION_PLAN.md");
  const earthPlanText = await readFile(earthPlanPath, "utf8");
  earthSimulationArtifacts = buildEarthSimulationRegistry(earthPlanText, earthArtifacts.manifest);
  earthSimulationCoverage = buildEarthSimulationCoverage({
    manifest: earthArtifacts.manifest,
    formulas: earthArtifacts.formulas,
    code: earthArtifacts.code,
    simulations: earthArtifacts.simulations,
    registry: earthSimulationArtifacts.registry,
  });
  const earthDatasetRegistryPath = join(corpusRoot, "research", "earth-thad-nassim", "EARTH_DATASET_REGISTRY.md");
  const earthDatasetRegistryText = await readFile(earthDatasetRegistryPath, "utf8");
  earthDatasetRegistry = buildEarthDatasetRegistry(earthDatasetRegistryText, {
    sourcePlan: earthSimulationArtifacts.registry.sourcePlan,
  });
  earthEvidenceArtifacts = buildEarthEvidenceArtifacts({
    manifest: earthArtifacts.manifest,
    coverage: earthSimulationCoverage,
    registry: earthSimulationArtifacts.registry,
    datasets: earthDatasetRegistry,
  });
  earthDocumentWrites = earthArtifacts.shards.map(({ slug, artifact }) => ({ slug, artifact }));
  earthInventory = earthArtifacts.manifest.documents.map((document) => ({
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
}
const tourSource = await readTourSource(tourSourceDirectory);
const tourArtifacts = buildTourArtifacts(tourSource, {
  recipeIds: recipeRegistry.map(({ constant_id: id }) => id),
  programIds: earthSimulationArtifacts.registry.items.map(({ id }) => id),
});

const provenance = {
  schemaVersion: 2,
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
assertStableProvenance(provenance);

const earthGeneratedDirectory = join(generatedDirectory, "earth");
const earthDocumentDirectory = join(earthGeneratedDirectory, "documents");
const earthEvidenceDirectory = join(earthGeneratedDirectory, "evidence");
const earthEvidenceProgramDirectory = join(earthEvidenceDirectory, "programs");
const earthEvidenceDocumentDirectory = join(earthEvidenceDirectory, "documents");
const tourGeneratedDirectory = join(generatedDirectory, "tour");
const awesomePhysicsGeneratedDirectory = join(generatedDirectory, "awesomePhysics");
const tourChapterDirectory = join(tourGeneratedDirectory, "chapters");
const tourLessonDirectory = join(tourGeneratedDirectory, "lessons");
const tourSimulationDirectory = join(tourGeneratedDirectory, "simulations");
await rm(earthDocumentDirectory, { recursive: true, force: true });
await rm(earthEvidenceDirectory, { recursive: true, force: true });
await rm(tourGeneratedDirectory, { recursive: true, force: true });
await rm(awesomePhysicsGeneratedDirectory, { recursive: true, force: true });
await mkdir(earthDocumentDirectory, { recursive: true });
await mkdir(earthEvidenceProgramDirectory, { recursive: true });
await mkdir(earthEvidenceDocumentDirectory, { recursive: true });
await mkdir(awesomePhysicsGeneratedDirectory, { recursive: true });
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
  writeFile(join(awesomePhysicsGeneratedDirectory, "catalog.json"), stableJson(awesomePhysics.catalog)),
  writeFile(join(awesomePhysicsGeneratedDirectory, "simulations.json"), stableJson(awesomePhysics.simulations)),
  writeFile(join(tourGeneratedDirectory, "manifest.json"), stableJson(tourArtifacts.manifest)),
  writeFile(join(tourGeneratedDirectory, "glossary.json"), stableJson(tourArtifacts.glossary)),
  writeFile(join(tourGeneratedDirectory, "references.json"), stableJson(tourArtifacts.references)),
  writeFile(join(tourGeneratedDirectory, "claim-vocabulary.json"), stableJson(tourArtifacts.claimVocabulary)),
  ...earthDocumentWrites.map(({ slug, bytes, artifact }) => writeFile(join(earthDocumentDirectory, `${slug}.json`), bytes ?? stableJson(artifact))),
  ...earthEvidenceArtifacts.programShards.map(({ id, artifact }) => writeFile(join(earthEvidenceProgramDirectory, `${id}.json`), stableJson(artifact))),
  ...earthEvidenceArtifacts.documentShards.map(({ slug, artifact }) => writeFile(join(earthEvidenceDocumentDirectory, `${slug}.json`), stableJson(artifact))),
  ...tourArtifacts.chapters.map((artifact) => writeFile(join(tourChapterDirectory, `${artifact.id}.json`), stableJson(artifact))),
  ...tourArtifacts.lessons.map((artifact) => writeFile(join(tourLessonDirectory, `${artifact.id}.json`), stableJson(artifact))),
  ...tourArtifacts.simulations.map((artifact) => writeFile(join(tourSimulationDirectory, `${artifact.id}.json`), stableJson(artifact))),
]);
await generateCompletion();

console.log(JSON.stringify({ externalCorpusMode, recipes: recipes.length, symbols: symbols.length, walls: wallIndex.length, corpusPdfs: corpusPdfs.length, sitePdfs: sitePdfs.length, awesomePhysics: { catalog: awesomePhysics.catalog.summary, simulations: awesomePhysics.simulations.summary }, earth: earthArtifacts.manifest.summary, earthScientificSimulations: earthSimulationArtifacts.registry.summary, earthScientificCoverage: earthSimulationCoverage.summary, earthDatasets: earthDatasetRegistry.summary, earthEvidence: earthEvidenceArtifacts.manifest.summary, tour: tourArtifacts.summary }));
