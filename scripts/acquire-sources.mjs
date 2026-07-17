#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const sourceDirectory = join(root, "public", "data", "sources");
const wallDirectory = join(root, "public", "data", "number-walls");
const wallBaseUrl = "https://www.physicsmonastery.earth/number-walls/data/";
const acquisitionDate = process.env.SOURCE_DATE || new Date().toISOString().slice(0, 10);

const inputs = [
  {
    id: "constants-yaml",
    source: "/home/braulio/.local/share/opencode/tool-output/tool_f70257ac8001812KX98v3Yixbl",
    target: "constants.yaml",
  },
  {
    id: "symbols-csv",
    source: "/tmp/opencode/physics-monastery/symbols.csv",
    target: "symbols.csv",
  },
  {
    id: "published-output",
    source: "/tmp/opencode/physics-monastery/latest-output.txt",
    target: "latest-output.txt",
  },
  {
    id: "number-walls-index",
    source: "/tmp/opencode/physics-monastery/number-walls-index.json",
    target: "number-walls-index.json",
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchPayload(entry) {
  const filename = entry.filename;
  assert(typeof filename === "string" && filename === basename(filename), `Unsafe filename for ${entry.id}`);
  assert(filename.endsWith(".json"), `Non-JSON wall payload for ${entry.id}`);

  const url = new URL(encodeURIComponent(filename), wallBaseUrl).href;
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      if (response.ok) break;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((done) => setTimeout(done, attempt * 500));
  }

  assert(response?.ok, `Failed ${url}: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }

  assert(payload && typeof payload === "object", `Non-object payload from ${url}`);
  assert(payload.id === entry.id, `Payload ID mismatch for ${filename}: ${payload.id} !== ${entry.id}`);
  assert(payload.kind === entry.kind, `Payload kind mismatch for ${entry.id}: ${payload.kind} !== ${entry.kind}`);
  assert(Array.isArray(payload.sequence), `Missing sequence for ${entry.id}`);
  assert(payload.sequence.length > 0, `Empty sequence for ${entry.id}`);

  await writeFile(join(wallDirectory, filename), bytes);
  return {
    id: entry.id,
    filename,
    url,
    status: response.status,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
    date: acquisitionDate,
    terms: payload.sequence.length,
  };
}

async function mapConcurrent(values, concurrency, operation) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

await mkdir(sourceDirectory, { recursive: true });
await mkdir(wallDirectory, { recursive: true });

const preserved = [];
for (const input of inputs) {
  const bytes = await readFile(input.source);
  await writeFile(join(sourceDirectory, input.target), bytes);
  preserved.push({
    id: input.id,
    originalPath: input.source,
    preservedPath: `sources/${input.target}`,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
  });
}

const constantsText = (await readFile(join(sourceDirectory, "constants.yaml"), "utf8"));
assert(constantsText.startsWith("# constants.yaml"), "Canonical constants source header is missing");
const recipeCount = constantsText.match(/^\s*-\s*\{\s*recipe_number:/gm)?.length ?? 0;
assert(recipeCount === 288, `Expected 288 recipes, found ${recipeCount}`);

const wallIndex = JSON.parse(await readFile(join(sourceDirectory, "number-walls-index.json"), "utf8"));
assert(Array.isArray(wallIndex), "Wall index must be an array");
assert(wallIndex.length === 351, `Expected 351 wall index entries, found ${wallIndex.length}`);
const ids = new Set();
const filenames = new Set();
for (const entry of wallIndex) {
  assert(entry && typeof entry === "object", "Wall index contains a non-object entry");
  assert(typeof entry.id === "string" && entry.id.length > 0, "Wall index contains an empty ID");
  assert(!ids.has(entry.id), `Duplicate wall ID: ${entry.id}`);
  assert(!filenames.has(entry.filename), `Duplicate wall filename: ${entry.filename}`);
  ids.add(entry.id);
  filenames.add(entry.filename);
}

const walls = await mapConcurrent(wallIndex, 8, fetchPayload);
assert(walls.length === 351, `Expected 351 downloaded walls, found ${walls.length}`);

const manifest = {
  schemaVersion: 1,
  acquisitionDate,
  sourcePolicy: "Original source bytes are preserved; generated artifacts are stored separately.",
  recipeCount,
  wallCount: walls.length,
  preserved,
  walls,
};
await writeFile(join(sourceDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({ recipeCount, wallCount: walls.length, wallBytes: walls.reduce((sum, item) => sum + item.bytes, 0) }));
