import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, validateBundledLut } from "./validate-lut.mjs";

const femRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(femRoot, "../..");
const runner = resolve(femRoot, "scripts/run.mjs");
const schemaPath = resolve(femRoot, "schema/motor-fem-lut.schema.json");
const lutPath = resolve(repositoryRoot, "public/data/generated/edwin-gray/motor-fem-lut-v1.json");

const staticValidation = spawnSync(process.execPath, [runner, "--validate"], {
  cwd: femRoot,
  encoding: "utf8",
  stdio: "inherit"
});
if (staticValidation.error) throw staticValidation.error;
if (staticValidation.status !== 0) process.exit(staticValidation.status ?? 1);

if (existsSync(lutPath)) {
  validateBundledLut(readJson(lutPath, "bundled FEM LUT"), readJson(schemaPath, "FEM LUT schema"));
  console.log(`Validated bundled FEM LUT: ${lutPath}`);
} else {
  console.log("No bundled FEM LUT is present; static FEM contracts are valid.");
}
