#!/usr/bin/env -S vite-node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompletionReport } from "../src/engine/completion.js";
import { CORE_CASES } from "../src/engine/core.js";
import type {
  PrimitiveSymbolSource,
  RecipeSource,
  RegistryArtifact,
} from "../src/types/engine.js";

interface WallRegistryEntry {
  id: string;
  title: string;
  category: string;
  filename: string;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedDirectory = join(root, "public", "data", "generated");
const wallDirectory = join(root, "public", "data", "number-walls");
const sourceDirectory = join(root, "public", "data", "sources");

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const paths = {
  recipes: join(generatedDirectory, "recipes.json"),
  symbols: join(generatedDirectory, "symbols.json"),
  walls: join(generatedDirectory, "walls.json"),
  sourceManifest: join(sourceDirectory, "manifest.json"),
};
const [recipeText, symbolText, wallText, sourceManifestText] = await Promise.all(Object.values(paths).map((path) => readFile(path, "utf8")));
const recipes = JSON.parse(recipeText) as RecipeSource[];
const symbols = JSON.parse(symbolText) as PrimitiveSymbolSource[];
const walls = JSON.parse(wallText) as WallRegistryEntry[];
const sourceManifest = JSON.parse(sourceManifestText) as { acquisitionDate: string };
const wallPayloads = await Promise.all(walls.map(async ({ id, filename }) => {
  const payload = JSON.parse(await readFile(join(wallDirectory, filename), "utf8")) as { id?: unknown };
  if (payload.id !== id) throw new Error(`Wall registry ID ${id} does not match payload ID ${String(payload.id)}`);
  return payload;
}));
const inputs = {
  recipesSha256: sha256(recipeText),
  symbolsSha256: sha256(symbolText),
  wallsSha256: sha256(wallText),
  sourceManifestSha256: sha256(sourceManifestText),
};
const report = buildCompletionReport(
  { recipes, symbols, wallPayloads, wallSourceCount: walls.length },
  { generatedAt: sourceManifest.acquisitionDate },
);
const completion = { ...report, inputs };
const registry: RegistryArtifact = {
  schemaVersion: 1,
  generatedAt: sourceManifest.acquisitionDate,
  inputs,
  recipes: {
    count: recipes.length,
    dataUrl: "/data/generated/recipes.json",
    items: recipes.map((recipe) => ({
      recipeNumber: recipe.recipe_number,
      id: recipe.constant_id,
      name: recipe.display_name,
      wallId: recipe.wall_id,
    })),
  },
  walls: {
    count: walls.length,
    dataUrl: "/data/generated/walls.json",
    items: walls.map(({ id, title, category, filename }) => ({ id, title, category, filename })),
  },
  core: {
    count: CORE_CASES.length,
    items: CORE_CASES,
  },
};

await Promise.all([
  writeFile(join(generatedDirectory, "completion.json"), stableJson(completion)),
  writeFile(join(generatedDirectory, "registry.json"), stableJson(registry)),
]);

console.log(JSON.stringify({
  complete: completion.complete,
  recipes: completion.recipes,
  walls: completion.walls,
  core: completion.core,
}));
if (!completion.complete) throw new Error(`Completion audit failed: ${[...completion.unresolved, ...completion.errors].join("; ") || "coverage mismatch"}`);
