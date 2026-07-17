#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConstantsYaml, parsePublishedOutput, parseSymbolsCsv, readJson } from "./lib/source-parser.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = resolve(root, "..");
const sourceDirectory = join(root, "public", "data", "sources");
const generatedDirectory = join(root, "public", "data", "generated");
const sitePdfDirectory = join(root, "data", "physics_monastery", "site");

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

const recipeRegistry = recipes.map((recipe, index) => {
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
const earthFiles = await filesBelow(earthRoot, ".md");
const earthInventory = await Promise.all(earthFiles.map(async (path, index) => {
  const info = await stat(path);
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  return {
    id: `earth-${String(index + 1).padStart(3, "0")}`,
    localPath: relative(corpusRoot, path),
    title: name,
    bytes: info.size,
    family: "earth-local-markdown",
    contextOnly: true,
    licenseClaim: null,
    conceptLinks: conceptLinks(name),
  };
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

await Promise.all([
  writeFile(join(generatedDirectory, "recipes.json"), stableJson(recipeRegistry)),
  writeFile(join(generatedDirectory, "symbols.json"), stableJson(symbols)),
  writeFile(join(generatedDirectory, "walls.json"), stableJson(wallRegistry)),
  writeFile(join(generatedDirectory, "provenance.json"), stableJson(provenance)),
]);
await generateCompletion();

console.log(JSON.stringify({ recipes: recipes.length, symbols: symbols.length, walls: wallIndex.length, corpusPdfs: corpusPdfs.length, sitePdfs: sitePdfs.length, earthMarkdown: earthInventory.length }));
