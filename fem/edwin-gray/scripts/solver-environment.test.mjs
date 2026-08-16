import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  environmentManifest,
  identifyHostEnvironment,
  isImmutableImageReference,
  resolveDockerImageReference
} from "./solver-environment.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("pinned image installs checksum-attested GetDP with MSH 4 support", () => {
  const dockerfile = readFileSync(join(ROOT, "container/Dockerfile"), "utf8");
  assert.match(dockerfile, /getdp-3\.5\.0-Linux64c\.tgz/);
  assert.match(dockerfile, /d3c28fa18f20d6147b4c7367d4dd802e9f7ddb58c608688bbb71919dbca8041d/);
  assert.doesNotMatch(dockerfile, /apt-get install[\s\S]*"getdp=/);
});

test("publication image references are immutable or resolved to a repository digest", () => {
  const immutable = "registry.example/solver@sha256:" + "a".repeat(64);
  assert.equal(isImmutableImageReference(immutable), true);
  assert.equal(resolveDockerImageReference("unused", immutable, { publication: true }).image, immutable);
  const imageId = "sha256:" + "b".repeat(64);
  assert.equal(isImmutableImageReference(imageId), true);
  assert.equal(resolveDockerImageReference("unused", imageId, { publication: true }).digest, imageId);
  assert.throws(
    () => resolveDockerImageReference("/missing/docker", "registry.example/solver:latest", { publication: true }),
    /requires an immutable Docker image digest/
  );
});

test("host binary content, phase thread resources, and command plans participate in environment identity", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "solver-environment-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  writeFileSync(gmsh, "gmsh-a\n");
  writeFileSync(getdp, "getdp-a\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);
  const runner = { revision: "test", runScriptSha256: "1", environmentModuleSha256: "2" };
  const solver = { name: "iterative-cg-gamg-v1", configSha256: "3" };
  const resources = { memoryGiB: null, memorySwapGiB: null, cpus: 1, meshThreads: 1, solverThreads: 1 };
  const commandPlan = { mesh: ["gmsh", "-nt", "1"], solve: ["getdp", "-nt", "1"] };
  const first = identifyHostEnvironment({ gmsh, getdp, solver, resources, commandPlan, runner });
  const repeated = identifyHostEnvironment({ gmsh, getdp, solver, resources, commandPlan, runner });
  assert.equal(first.identityHash, repeated.identityHash);

  writeFileSync(gmsh, "gmsh-b\n");
  const changedBinary = identifyHostEnvironment({ gmsh, getdp, solver, resources, commandPlan, runner });
  const changedThreads = identifyHostEnvironment({
    gmsh,
    getdp,
    solver,
    resources: { ...resources, meshThreads: 2 },
    commandPlan: { ...commandPlan, mesh: ["gmsh", "-nt", "2"] },
    runner
  });
  const changedPlan = identifyHostEnvironment({ gmsh, getdp, solver, resources, commandPlan: { ...commandPlan, mesh: [...commandPlan.mesh, "-algo", "delaunay"] }, runner });
  assert.notEqual(first.identityHash, changedBinary.identityHash);
  assert.notEqual(changedBinary.identityHash, changedThreads.identityHash);
  assert.notEqual(changedBinary.identityHash, changedPlan.identityHash);
});

test("environment manifest separates commands from options", () => {
  const environment = {
    identityHash: "a".repeat(64),
    identity: {
      backend: "docker",
      resources: { memoryGiB: 24, memorySwapGiB: 24, cpus: 2, meshThreads: 1, solverThreads: 2 },
      commandPlan: { mesh: ["gmsh", "-nt", "1"], solve: ["getdp", "-nt", "2"] },
      solver: { name: "iterative-cg-gamg-v1" },
      runner: { revision: "abc" }
    }
  };
  const manifest = environmentManifest(environment, {
    mesh: ["docker", "run", "gmsh", "model.geo", "-3"],
    solve: ["docker", "run", "getdp", "model.pro", "-solve", "Magnetostatics3D"]
  });
  assert.equal(manifest.execution.meshThreads, 1);
  assert.equal(manifest.execution.solverThreads, 2);
  assert.equal(manifest.execution.resources.memoryGiB, 24);
  assert.equal(manifest.execution.solver.name, "iterative-cg-gamg-v1");
  assert.equal(manifest.execution.commands.mesh.command, "docker");
  assert.deepEqual(manifest.execution.commands.solve.options.slice(-3), ["model.pro", "-solve", "Magnetostatics3D"]);
});

test("runner job hashes change with the solver environment but model job IDs remain stable", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "solver-runner-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  writeFileSync(gmsh, "#!/bin/sh\nexit 0\n");
  writeFileSync(getdp, "#!/bin/sh\nexit 0\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);

  const run = (eventIndex = 0) => {
    const result = spawnSync(process.execPath, [
      join(ROOT, "scripts/run.mjs"),
      "--dry-run",
      "--backend", "host",
      "--gmsh-bin", gmsh,
      "--getdp-bin", getdp,
      "--event-index", String(eventIndex)
    ], { cwd: ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };

  const first = run();
  writeFileSync(gmsh, "#!/bin/sh\n# changed solver\nexit 0\n");
  const changed = run();
  assert.equal(first.jobId, changed.jobId);
  assert.notEqual(first.environmentIdentityHash, changed.environmentIdentityHash);
  assert.notEqual(first.inputHash, changed.inputHash);
  const changedEvent = run(4);
  assert.notEqual(changed.jobId, changedEvent.jobId);
  assert.notEqual(changed.inputHash, changedEvent.inputHash);
  assert.ok(changedEvent.commands.audit.includes("--output"));
});

test("Docker publication plan hard-caps memory and CPU and selects direct MUMPS", () => {
  const image = "registry.example/solver@sha256:" + "a".repeat(64);
  const result = spawnSync(process.execPath, [
    join(ROOT, "scripts/run.mjs"),
    "--dry-run",
    "--backend", "docker",
    "--docker-bin", "/bin/true",
    "--docker-image", image,
    "--publication",
    "--solver-profile", "direct-mumps-publication-v1",
    "--memory-gib", "24",
    "--cpus", "2",
    "--mesh-threads", "1",
    "--threads", "2"
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  for (const command of [plan.commands.mesh, plan.commands.solve]) {
    assert.deepEqual(command.slice(2, 10), ["--rm", "--memory", "24g", "--memory-swap", "24g", "--cpus", "2", "--user"]);
  }
  assert.ok(plan.commands.solve.includes("-ksp_type"));
  assert.ok(plan.commands.solve.includes("mumps"));
  assert.ok(plan.commands.solve.includes("-ksp_error_if_not_converged"));
  assert.equal(plan.commands.mesh[plan.commands.mesh.indexOf("-nt") + 1], "1");
  assert.equal(plan.commands.solve[plan.commands.solve.indexOf("-nt") + 1], "2");
  assert.ok(plan.commands.mesh.includes("OMP_NUM_THREADS=1"));
  assert.ok(plan.commands.solve.includes("OMP_NUM_THREADS=2"));
});

test("publication fails when the solver profile or exact resource cap is missing", () => {
  const image = "registry.example/solver@sha256:" + "a".repeat(64);
  const run = (...args) => spawnSync(process.execPath, [
    join(ROOT, "scripts/run.mjs"), "--dry-run", "--backend", "docker",
    "--docker-bin", "/bin/true", "--docker-image", image, "--publication", ...args
  ], { cwd: ROOT, encoding: "utf8" });
  let result = run("--memory-gib", "24", "--cpus", "2", "--mesh-threads", "1", "--threads", "2");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit --solver-profile/);
  result = run("--solver-profile", "direct-mumps-publication-v1", "--memory-gib", "23", "--cpus", "2", "--mesh-threads", "1", "--threads", "2");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly 24 GiB/);
  result = run("--solver-profile", "direct-mumps-publication-v1", "--memory-gib", "24", "--cpus", "1", "--mesh-threads", "1", "--threads", "2");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly 2/);
  result = run("--solver-profile", "direct-mumps-publication-v1", "--memory-gib", "24", "--cpus", "2", "--mesh-threads", "2", "--threads", "2");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mesh thread limit must be exactly 1/);
});

test("normal runner defaults mesh threads to solver threads unless explicitly separated", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "solver-thread-plan-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  writeFileSync(gmsh, "#!/bin/sh\nexit 0\n");
  writeFileSync(getdp, "#!/bin/sh\nexit 0\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);
  const plan = (...args) => {
    const result = spawnSync(process.execPath, [
      join(ROOT, "scripts/run.mjs"), "--dry-run", "--backend", "host",
      "--gmsh-bin", gmsh, "--getdp-bin", getdp, "--threads", "2", ...args
    ], { cwd: ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const compatible = plan();
  const separated = plan("--mesh-threads", "1");
  assert.equal(compatible.commands.mesh[compatible.commands.mesh.indexOf("-nt") + 1], "2");
  assert.equal(separated.commands.mesh[separated.commands.mesh.indexOf("-nt") + 1], "1");
  assert.equal(separated.commands.solve[separated.commands.solve.indexOf("-nt") + 1], "2");
  assert.equal(compatible.jobId, separated.jobId);
  assert.notEqual(compatible.environmentIdentityHash, separated.environmentIdentityHash);
  assert.notEqual(compatible.inputHash, separated.inputHash);
});

test("solver configuration bytes and resource budgets change immutable environment identity", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "solver-config-identity-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  const config = join(directory, "solver.json");
  writeFileSync(gmsh, "#!/bin/sh\nexit 0\n");
  writeFileSync(getdp, "#!/bin/sh\nexit 0\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);
  const sourceConfig = JSON.parse(readFileSync(join(ROOT, "getdp/solver-profiles-v1.json"), "utf8"));
  writeFileSync(config, JSON.stringify(sourceConfig));
  const plan = (cpus) => {
    const result = spawnSync(process.execPath, [
      join(ROOT, "scripts/run.mjs"), "--dry-run", "--backend", "host",
      "--gmsh-bin", gmsh, "--getdp-bin", getdp,
      "--solver-config", config, "--cpus", String(cpus)
    ], { cwd: ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const first = plan(1);
  const changedBudget = plan(2);
  sourceConfig.profiles["iterative-cg-gamg-v1"].maximumIterations = 501;
  writeFileSync(config, JSON.stringify(sourceConfig));
  const changedConfig = plan(2);
  assert.equal(first.jobId, changedBudget.jobId);
  assert.equal(changedBudget.jobId, changedConfig.jobId);
  assert.notEqual(first.environmentIdentityHash, changedBudget.environmentIdentityHash);
  assert.notEqual(changedBudget.environmentIdentityHash, changedConfig.environmentIdentityHash);
  assert.notEqual(changedBudget.inputHash, changedConfig.inputHash);
});
