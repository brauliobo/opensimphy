#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ONELAB_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ONELAB_DIR, "..");
const CASE_PATH = join(ROOT, "cases/patent-3890548-illustrative.json");
const GEOMETRY_PATH = join(ROOT, "geometry/patent-3890548-3d.geo");
const PROBLEM_PATH = join(ROOT, "getdp/magnetostatic.pro");
const PROJECT_PATH = join(ONELAB_DIR, "project.geo");
const MAP_PATH = join(ONELAB_DIR, "parameter-map.json");
const DEFAULT_WORK_DIR = join(tmpdir(), "edwin-gray-onelab");
const CONFIG_FORMAT = "edwin-gray-onelab-config-v1";
const RESOLUTION = "Magnetostatics3D";
const POST_OPERATION = "MagnetostaticResults";

function fail(message) {
  throw new Error(message);
}

function readJson(path, label) {
  if (!existsSync(path)) fail(`${label} does not exist: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function valueAt(value, sourcePath) {
  let current = value;
  for (const key of sourcePath.split(".")) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, key)) {
      fail(`Authoritative case is missing ${sourcePath}`);
    }
    current = current[key];
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    fail(`Authoritative case parameter ${sourcePath} must be a finite number`);
  }
  return current;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceInputs() {
  for (const [label, path] of [
    ["case", CASE_PATH],
    ["Gmsh geometry", GEOMETRY_PATH],
    ["GetDP problem", PROBLEM_PATH],
    ["ONELAB project", PROJECT_PATH],
    ["parameter map", MAP_PATH]
  ]) {
    if (!existsSync(path)) fail(`${label} does not exist: ${path}`);
  }
  const caseData = readJson(CASE_PATH, "case");
  const map = readJson(MAP_PATH, "parameter map");
  if (map.format !== "edwin-gray-onelab-parameter-map-v1" || !Array.isArray(map.parameters)) {
    fail("Unsupported ONELAB parameter map");
  }
  return { caseData, map };
}

function exportedConfig() {
  const { caseData, map } = sourceInputs();
  return {
    format: CONFIG_FORMAT,
    caseId: caseData.caseId,
    caseSha256: sha256(CASE_PATH),
    files: {
      case: "../cases/patent-3890548-illustrative.json",
      geometry: "../geometry/patent-3890548-3d.geo",
      problem: "../getdp/magnetostatic.pro",
      project: "project.geo"
    },
    solver: {
      resolution: RESOLUTION,
      postOperation: POST_OPERATION
    },
    parameters: map.parameters.map((parameter) => ({
      ...parameter,
      value: valueAt(caseData, parameter.sourcePath)
    }))
  };
}

function validateConfig(config) {
  const expected = exportedConfig();
  if (config.format !== CONFIG_FORMAT) fail(`Unsupported ONELAB config format: ${config.format}`);
  if (config.caseId !== expected.caseId) fail("ONELAB config caseId does not match the authoritative case");
  if (config.caseSha256 !== expected.caseSha256) fail("ONELAB config case hash does not match the authoritative case");
  for (const [name, path] of Object.entries(expected.files)) {
    if (config.files?.[name] !== path) fail(`ONELAB config ${name} file reference is invalid`);
  }
  for (const [name, solverName] of Object.entries(expected.solver)) {
    if (config.solver?.[name] !== solverName) fail(`ONELAB config ${name} solver name is invalid`);
  }
  if (!Array.isArray(config.parameters) || config.parameters.length !== expected.parameters.length) {
    fail("ONELAB config parameter set is incomplete");
  }
  const values = config.parameters.map((parameter, index) => {
    const expectedParameter = expected.parameters[index];
    for (const key of ["sourcePath", "client", "symbol", "onelabName"]) {
      if (parameter[key] !== expectedParameter[key]) fail(`ONELAB parameter mapping mismatch at index ${index}`);
    }
    if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) {
      fail(`ONELAB parameter ${parameter.sourcePath} must be a finite number`);
    }
    return parameter.value;
  });
  return {
    ...expected,
    parameters: expected.parameters.map((parameter, index) => ({ ...parameter, value: values[index] }))
  };
}

function validateSources() {
  const config = exportedConfig();
  const geometry = readFileSync(GEOMETRY_PATH, "utf8");
  const problem = readFileSync(PROBLEM_PATH, "utf8");
  const project = readFileSync(PROJECT_PATH, "utf8");
  for (const parameter of config.parameters) {
    const source = parameter.client === "gmsh" ? geometry : problem;
    if (!source.includes(parameter.symbol) || !source.includes(`Name "${parameter.onelabName}"`)) {
      fail(`${parameter.client} does not expose ${parameter.symbol} as ${parameter.onelabName}`);
    }
  }
  if (!new RegExp(`Resolution\\s*\\{[\\s\\S]*Name\\s+${RESOLUTION}\\s*;`).test(problem)) {
    fail(`GetDP resolution does not exist: ${RESOLUTION}`);
  }
  if (!new RegExp(`PostOperation\\s*\\{[\\s\\S]*Name\\s+${POST_OPERATION}\\s*;`).test(problem)) {
    fail(`GetDP post-operation does not exist: ${POST_OPERATION}`);
  }
  if (!project.includes('../geometry/patent-3890548-3d.geo')) fail("ONELAB project does not include the existing geometry");
  if (!project.includes('Solver.Name0 = "Edwin Gray Magnetostatics"')) fail("ONELAB project solver registration is missing");
  return config;
}

function parseArgs(argv) {
  const action = argv[0] || "help";
  const options = {};
  const passthrough = [];
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      passthrough.push(token);
      continue;
    }
    const key = token.slice(2);
    if (key === "dry-run") {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { action, options, passthrough };
}

function configFor(options) {
  return validateConfig(options.config ? readJson(resolve(options.config), "ONELAB config") : exportedConfig());
}

function setNumberArgs(config, client) {
  return config.parameters
    .filter((parameter) => parameter.client === client)
    .flatMap((parameter) => ["-setnumber", parameter.onelabName, String(parameter.value)]);
}

function commandPlan(config, options) {
  const workDir = resolve(options["work-dir"] || DEFAULT_WORK_DIR);
  const mesh = join(workDir, "motor.msh");
  const resultBase = join(workDir, "solve");
  return {
    workDir,
    mesh,
    gmsh: [
      options["gmsh-bin"] || "gmsh",
      PROJECT_PATH,
      "-3", "-format", "msh4", "-o", mesh,
      ...setNumberArgs(config, "gmsh")
    ],
    getdp: [
      options["getdp-bin"] || "getdp",
      PROBLEM_PATH,
      "-name", resultBase,
      "-msh", mesh,
      "-solve", RESOLUTION,
      "-pos", POST_OPERATION,
      ...setNumberArgs(config, "getdp")
    ]
  };
}

function run(command, cwd, environment = process.env) {
  const result = spawnSync(command[0], command.slice(1), { cwd, env: environment, stdio: "inherit" });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${command[0]} exited with status ${result.status}`);
}

function writeConfig(path, config) {
  writeFileSync(resolve(path), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function usage() {
  return `Usage: node launcher.mjs ACTION [options]

Actions:
  validate                  Validate source mappings, file references and solver names
  export --output PATH      Export deterministic parameters from the authoritative case
  import --config PATH --output PATH
                            Validate and canonically rewrite an exported config
  gui [--config PATH]       Open the ONELAB project in Gmsh
  headless [--config PATH]  Mesh with Gmsh and solve/postprocess with GetDP
  client [ONELAB args]      Internal GetDP client registered by project.geo

Options:
  --work-dir PATH           Solver artifacts (default: ${DEFAULT_WORK_DIR})
  --gmsh-bin PATH           Gmsh executable (default: gmsh)
  --getdp-bin PATH          GetDP executable (default: getdp)
  --dry-run                 Print commands without starting Gmsh/GetDP`;
}

function main() {
  const { action, options, passthrough } = parseArgs(process.argv.slice(2));
  if (action === "help") {
    console.log(usage());
    return;
  }
  if (action === "validate") {
    const config = validateSources();
    if (options.config) validateConfig(readJson(resolve(options.config), "ONELAB config"));
    console.log(JSON.stringify({ valid: true, caseId: config.caseId, parameters: config.parameters.length }));
    return;
  }
  if (action === "export") {
    if (!options.output) fail("export requires --output PATH");
    writeConfig(options.output, validateSources());
    return;
  }
  if (action === "import") {
    if (!options.config || !options.output) fail("import requires --config PATH and --output PATH");
    writeConfig(options.output, validateConfig(readJson(resolve(options.config), "ONELAB config")));
    return;
  }
  if (action === "client") {
    validateSources();
    const workDir = resolve(process.env.EDWIN_GRAY_ONELAB_WORK_DIR || DEFAULT_WORK_DIR);
    mkdirSync(workDir, { recursive: true });
    const command = [
      process.env.EDWIN_GRAY_GETDP_BIN || "getdp",
      PROBLEM_PATH,
      "-name", join(workDir, "solve"),
      "-msh", process.env.EDWIN_GRAY_ONELAB_MESH || join(workDir, "motor.msh"),
      "-solve", RESOLUTION,
      "-pos", POST_OPERATION,
      ...passthrough
    ];
    run(command, workDir);
    return;
  }

  validateSources();
  const config = configFor(options);
  const plan = commandPlan(config, options);
  if (action === "headless") {
    if (options["dry-run"]) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    mkdirSync(plan.workDir, { recursive: true });
    run(plan.gmsh, plan.workDir);
    run(plan.getdp, plan.workDir);
    return;
  }
  if (action === "gui") {
    const command = [
      options["gmsh-bin"] || "gmsh",
      PROJECT_PATH,
      "-o", plan.mesh,
      ...config.parameters.flatMap((parameter) => ["-setnumber", parameter.onelabName, String(parameter.value)])
    ];
    if (options["dry-run"]) {
      console.log(JSON.stringify({ workDir: plan.workDir, command }, null, 2));
      return;
    }
    mkdirSync(plan.workDir, { recursive: true });
    run(command, ONELAB_DIR, {
      ...process.env,
      EDWIN_GRAY_ONELAB_WORK_DIR: plan.workDir,
      EDWIN_GRAY_ONELAB_MESH: plan.mesh,
      EDWIN_GRAY_GETDP_BIN: options["getdp-bin"] || "getdp"
    });
    return;
  }
  fail(`Unknown action: ${action}\n\n${usage()}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
