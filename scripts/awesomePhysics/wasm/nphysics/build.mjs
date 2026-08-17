#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../../../");
const persistRoot = resolve(repositoryRoot, ".wasm-build");
const publicArtifactDirectory = resolve(repositoryRoot, "public/wasm/awesomePhysics/nphysics");
const abiDirectory = resolve(scriptDirectory, "abi");
const defaultSource = resolve(repositoryRoot, "../awesome-physics-repos/nphysics");

const SOURCE_REVISION = "65aa85c5470a5da85e0c13652ce58400ae2e2201";
const RUST_VERSION = "1.87.0";
const CARGO_VERSION = "1.87.0";
const WASM_BINDGEN_VERSION = "0.2.127";
const WASM_TARGET = "wasm32-unknown-unknown";
const CARGO_JOBS = 4;
const MAX_MEMORY_BYTES = 134217728;
const CARGO_VIRTUAL_MEMORY_KB = 16 * 1024 * 1024;
const ABI_SOURCE_SHA256 = "5fad2ed31879ce0125ccb39445b2b69967d8968d8e21635a586df53ff5f4c46c";
const CARGO_LOCK_SHA256 = "e49337e39729eb355a9c337d78185bd41d6ff677071a7792b0928938e4cda8ba";
const HOST_PATH_NEEDLES = Object.freeze(["/home/braulio", "/tmp/opencode"]);
const EXPECTED = Object.freeze({
  wasm: Object.freeze({
    name: "nphysics2d_worker_probe.wasm",
    byteSize: 366856,
    sha256: "e549cc0b2af0084dd7ba6908c07357ba4b447516dd799c26763ee4b8a381b2ba",
  }),
  javascript: Object.freeze({
    name: "nphysics2d_worker_probe.js",
    byteSize: 12916,
    sha256: "364889e36d2218a7da8fcd55e1c4c97b227ceb68b4dfcf840b1d934c6b96bc26",
  }),
});

function fail(message) {
  throw new Error(`nphysics2d build rejected: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function inside(parent, child) {
  const childRelative = relative(parent, child);
  return childRelative === ""
    || (!childRelative.startsWith(`..${sep}`) && childRelative !== ".." && !isAbsolute(childRelative));
}

function optionValue(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  if (index === -1) return null;
  const value = argumentsList[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  return value;
}

function parseOptions(argumentsList) {
  const supported = new Set(["--source", "--output", "--record-artifact", "--install"]);
  for (const argument of argumentsList) {
    if (argument.startsWith("--") && !supported.has(argument)) fail(`unsupported option ${argument}`);
  }
  const source = resolve(optionValue(argumentsList, "--source") ?? defaultSource);
  const outputArgument = optionValue(argumentsList, "--output");
  if (outputArgument === null) fail("--output must identify a new or empty persist directory under .wasm-build");
  return {
    source,
    output: resolve(outputArgument),
    recordArtifact: argumentsList.includes("--record-artifact"),
    install: argumentsList.includes("--install"),
  };
}

async function run(command, argumentsList, options = {}) {
  try {
    const result = await execFileAsync(command, argumentsList, {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: 32 * 1024 * 1024,
    });
    return result.stdout;
  } catch (error) {
    const stderr = error?.stderr?.trim() ?? "";
    const stdout = error?.stdout?.trim() ?? "";
    const detail = [stderr, stdout].filter(Boolean).join("\n");
    fail(`${command} ${argumentsList.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
}

async function ensureEmptyOutput(output, source) {
  if (inside(source, output)) fail("output must be outside the pinned source checkout");
  if (inside(publicArtifactDirectory, output)) fail("output must not overwrite the public artifact directory");
  if (inside(repositoryRoot, output) && !inside(persistRoot, output)) {
    fail("in-repo output must stay under .wasm-build");
  }
  try {
    const outputStat = await stat(output);
    if (!outputStat.isDirectory()) fail("output exists but is not a directory");
    if ((await readdir(output)).length !== 0) fail("output directory must be empty");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(output, { recursive: true });
  }
}

async function sourceRevisionAndStatus(source) {
  const status = (await run("git", ["-C", source, "status", "--porcelain", "--untracked-files=all"])).trim();
  if (status.length > 0) fail("pinned source checkout is dirty");
  const revision = (await run("git", ["-C", source, "rev-parse", "HEAD"])).trim();
  if (revision !== SOURCE_REVISION) fail(`source revision is ${revision}, expected ${SOURCE_REVISION}`);
}

async function verifyToolchain() {
  const rustc = (await run("rustc", ["--version"])).trim();
  if (!rustc.startsWith(`rustc ${RUST_VERSION} `)) fail(`Rust toolchain is not ${RUST_VERSION}`);
  const cargo = (await run("cargo", ["--version"])).trim();
  if (!cargo.startsWith(`cargo ${CARGO_VERSION} `)) fail(`Cargo toolchain is not ${CARGO_VERSION}`);
  const bindgen = (await run("wasm-bindgen", ["--version"])).trim();
  if (bindgen !== `wasm-bindgen ${WASM_BINDGEN_VERSION}`) fail(`wasm-bindgen is not ${WASM_BINDGEN_VERSION}`);
  const targets = await run("rustup", ["target", "list", "--installed"]);
  if (!targets.split(/\r?\n/).includes(WASM_TARGET)) fail(`Rust target ${WASM_TARGET} is not installed`);
}

async function verifyLedger(recordArtifact) {
  const ledgerPath = resolve(scriptDirectory, "build-ledger.json");
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  if (ledger.source.revision !== SOURCE_REVISION) fail("build ledger source revision drifted");
  if (ledger.toolchain.rust !== RUST_VERSION || ledger.toolchain.cargo !== CARGO_VERSION) fail("build ledger Rust pin drifted");
  if (ledger.toolchain.wasmBindgen !== WASM_BINDGEN_VERSION || ledger.toolchain.target !== WASM_TARGET) fail("build ledger WASM toolchain pin drifted");
  if (ledger.toolchain.cargoJobs !== CARGO_JOBS) fail("build ledger cargo parallelism drifted");
  if (ledger.toolchain.maxMemoryBytes !== MAX_MEMORY_BYTES) fail("build ledger WASM memory pin drifted");
  if (ledger.abi.sourceSha256 !== ABI_SOURCE_SHA256) fail("build ledger ABI source hash drifted");
  if (ledger.lock.sha256 !== CARGO_LOCK_SHA256) fail("build ledger Cargo.lock hash drifted");
  if (recordArtifact) return;
  if (ledger.artifact.wasm.sha256 !== EXPECTED.wasm.sha256 || ledger.artifact.wasm.byteSize !== EXPECTED.wasm.byteSize) fail("build ledger WASM integrity drifted");
  if (ledger.artifact.javascript.sha256 !== EXPECTED.javascript.sha256 || ledger.artifact.javascript.byteSize !== EXPECTED.javascript.byteSize) fail("build ledger JavaScript integrity drifted");
}

async function stageAbi(output, source) {
  const stagedAbi = join(output, "abi");
  const vendor = join(output, "vendor");
  await mkdir(join(stagedAbi, "src"), { recursive: true });
  await mkdir(vendor, { recursive: true });
  await symlink(source, join(vendor, "nphysics"));
  const cargoTemplate = await readFile(join(abiDirectory, "Cargo.toml"), "utf8");
  const cargo = cargoTemplate.replace(
    /nphysics2d = \{ path = "[^"]+\/build\/nphysics2d"/,
    'nphysics2d = { path = "../vendor/nphysics/build/nphysics2d"',
  );
  if (cargo === cargoTemplate) fail("ABI Cargo.toml has no replaceable nphysics2d source path");
  await writeStaged(join(stagedAbi, "Cargo.toml"), cargo);
  await copyFile(join(abiDirectory, "Cargo.lock"), join(stagedAbi, "Cargo.lock"));
  await copyFile(join(abiDirectory, "src", "lib.rs"), join(stagedAbi, "src", "lib.rs"));
  const abiSource = await readFile(join(stagedAbi, "src", "lib.rs"));
  if (sha256(abiSource) !== ABI_SOURCE_SHA256) fail("ABI source hash drifted");
  const lock = await readFile(join(stagedAbi, "Cargo.lock"));
  if (sha256(lock) !== CARGO_LOCK_SHA256) fail("Cargo.lock hash drifted");
  return stagedAbi;
}

async function writeStaged(path, contents) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  await writeFile(path, contents);
}

function remapPathPrefixes(source, output) {
  const cargoHome = resolve(process.env.CARGO_HOME ?? join(process.env.HOME ?? "/home", ".cargo"));
  const rustupHome = resolve(process.env.RUSTUP_HOME ?? join(process.env.HOME ?? "/home", ".rustup"));
  const prefixes = [
    [source, "/src/nphysics"],
    [output, "/build/nphysics"],
    [cargoHome, "/cargo"],
    [rustupHome, "/rustup"],
    ["/tmp/opencode", "/tmp/build"],
    ["/home/braulio", "/home"],
  ];
  return prefixes
    .map(([from, to]) => `--remap-path-prefix=${from}=${to}`)
    .join(" ");
}

function assertNoHostPaths(bytes, label) {
  const text = Buffer.from(bytes).toString("latin1");
  const hits = HOST_PATH_NEEDLES.filter((needle) => text.includes(needle));
  if (hits.length > 0) fail(`${label} embeds host paths: ${hits.join(", ")}`);
}

async function verifyArtifact(path, expected, label, recordArtifact) {
  const bytes = await readFile(path);
  const digest = sha256(bytes);
  if (!recordArtifact) {
    if (bytes.byteLength !== expected.byteSize) fail(`${label} size is ${bytes.byteLength}, expected ${expected.byteSize}`);
    if (digest !== expected.sha256) fail(`${label} SHA-256 is ${digest}, expected ${expected.sha256}`);
  }
  assertNoHostPaths(bytes, label);
  return { bytes, digest, byteSize: bytes.byteLength };
}

async function verifyAbi(wasmPath, javascriptPath, recordArtifact) {
  const wasm = await verifyArtifact(wasmPath, EXPECTED.wasm, "nphysics2d WASM", recordArtifact);
  const javascript = await verifyArtifact(javascriptPath, EXPECTED.javascript, "nphysics2d JavaScript companion", recordArtifact);
  const javascriptText = javascript.bytes.toString("utf8");
  if (!javascriptText.includes("export class World2d") || !javascriptText.includes("initSync") || !javascriptText.includes("world2d_step")) {
    fail("generated JavaScript companion does not expose the pinned 2D ABI");
  }
  if (javascriptText.includes("World3d") || javascriptText.includes("world3d_")) fail("generated companion contains an unapproved 3D ABI");

  const module = await WebAssembly.compile(wasm.bytes);
  const exports = WebAssembly.Module.exports(module).map(({ name }) => name);
  for (const name of ["world2d_new", "world2d_snapshot", "world2d_step"]) {
    if (!exports.includes(name)) fail(`WASM is missing ABI export ${name}`);
  }
  if (exports.some((name) => name.startsWith("world3d_"))) fail("WASM contains an unapproved 3D ABI");

  const bindings = await import(pathToFileURL(javascriptPath).href);
  if (typeof bindings.initSync !== "function" || typeof bindings.World2d !== "function") fail("generated companion module contract drifted");
  bindings.initSync({ module });
  const world = new bindings.World2d();
  try {
    assert.deepEqual(Array.from(world.snapshot()), [0, 2, 0, 0]);
    const falling = world.step(60);
    const fallingSnapshot = Array.from(world.snapshot());
    if (!Number.isFinite(falling) || falling >= 2 || fallingSnapshot[3] !== 60) fail("2D falling smoke drifted");
    const settled = world.step(600);
    const settledSnapshot = Array.from(world.snapshot());
    if (!Number.isFinite(settled) || settledSnapshot[3] !== 660 || settled <= -1.5) fail("2D settled smoke drifted");
    assert.throws(() => world.step(601), /steps exceeds 600/);
    for (let index = 0; index < 8; index += 1) world.step(600);
    world.step(500);
    assert.throws(() => world.step(41), /total steps exceeds 6000/);
  } finally {
    world.free();
  }
  return {
    wasm: { path: wasmPath, name: EXPECTED.wasm.name, byteSize: wasm.byteSize, sha256: wasm.digest },
    javascript: { path: javascriptPath, name: EXPECTED.javascript.name, byteSize: javascript.byteSize, sha256: javascript.digest },
  };
}

async function installPublicArtifacts(artifacts) {
  await mkdir(publicArtifactDirectory, { recursive: true });
  await copyFile(artifacts.wasm.path, join(publicArtifactDirectory, artifacts.wasm.name));
  await copyFile(artifacts.javascript.path, join(publicArtifactDirectory, artifacts.javascript.name));
}

async function main() {
  const { source, output, recordArtifact, install } = parseOptions(process.argv.slice(2));
  await verifyLedger(recordArtifact);
  await ensureEmptyOutput(output, source);
  await sourceRevisionAndStatus(source);
  await verifyToolchain();

  const stagedAbi = await stageAbi(output, source);
  const targetDirectory = join(output, "cargo-target");
  const generatedDirectory = join(output, "generated");
  await mkdir(generatedDirectory, { recursive: true });
  const cargoEnvironment = {
    ...process.env,
    CARGO_BUILD_JOBS: String(CARGO_JOBS),
    CARGO_TARGET_DIR: targetDirectory,
    CARGO_INCREMENTAL: "0",
  };
  cargoEnvironment.RUSTFLAGS = `${remapPathPrefixes(source, output)} -C link-arg=--max-memory=${MAX_MEMORY_BYTES}`;
  delete cargoEnvironment.CARGO_ENCODED_RUSTFLAGS;
  await run("bash", [
    "-lc",
    `ulimit -v ${CARGO_VIRTUAL_MEMORY_KB} && exec cargo build --manifest-path ${JSON.stringify(join(stagedAbi, "Cargo.toml"))} --target ${WASM_TARGET} --release --locked --jobs ${CARGO_JOBS}`,
  ], { cwd: output, env: cargoEnvironment });

  const rawWasm = join(targetDirectory, WASM_TARGET, "release", "nphysics2d_worker_probe.wasm");
  const bindgenDirectory = join(output, "bindgen");
  await mkdir(bindgenDirectory, { recursive: true });
  await run("wasm-bindgen", [rawWasm, "--target", "web", "--no-typescript", "--out-dir", bindgenDirectory], { cwd: output, env: process.env });
  const generatedJavaScript = join(bindgenDirectory, "nphysics2d_worker_probe.js");
  const generatedWasm = join(bindgenDirectory, "nphysics2d_worker_probe_bg.wasm");
  const javascriptPath = join(generatedDirectory, EXPECTED.javascript.name);
  const wasmPath = join(generatedDirectory, EXPECTED.wasm.name);
  await rename(generatedJavaScript, javascriptPath);
  await rename(generatedWasm, wasmPath);
  const artifacts = await verifyAbi(wasmPath, javascriptPath, recordArtifact);
  if (install) await installPublicArtifacts(artifacts);

  const finalStatus = (await run("git", ["-C", source, "status", "--porcelain", "--untracked-files=all"])).trim();
  if (finalStatus.length > 0) fail("pinned source checkout changed during the build");
  const finalRevision = (await run("git", ["-C", source, "rev-parse", "HEAD"])).trim();
  if (finalRevision !== SOURCE_REVISION) fail("pinned source revision changed during the build");
  console.log(JSON.stringify({
    status: "PASS",
    sourceRevision: SOURCE_REVISION,
    output: generatedDirectory,
    hostPaths: "absent",
    wasm: artifacts.wasm,
    javascript: artifacts.javascript,
    cargoJobs: CARGO_JOBS,
    target: WASM_TARGET,
    wasmBindgen: WASM_BINDGEN_VERSION,
    virtualMemoryKb: CARGO_VIRTUAL_MEMORY_KB,
  }, null, 2));
}

await main();
