import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function writeExecutable(path, source) {
  writeFileSync(path, `#!/usr/bin/env node\n${source}`, "utf8");
  chmodSync(path, 0o755);
}

function fixture(t) {
  const temporary = mkdtempSync(join(tmpdir(), "edwin-gray-runner-"));
  const root = join(temporary, "edwin-gray");
  cpSync(SOURCE_ROOT, root, {
    recursive: true,
    filter: (source) => source === SOURCE_ROOT || !source.startsWith(join(SOURCE_ROOT, "runs"))
  });
  t.after(() => rmSync(temporary, { recursive: true, force: true }));

  const casePath = join(root, "cases/patent-3890548-illustrative.json");
  const caseData = JSON.parse(readFileSync(casePath, "utf8"));
  caseData.sweep.anglesDeg = [0, 20];
  caseData.sweep.eventIndices = [0, 1];
  caseData.sweep.meshSizesM = [0.025];
  caseData.sweep.driveCurrentA = [1];
  writeFileSync(casePath, `${JSON.stringify(caseData, null, 2)}\n`, "utf8");

  const bin = join(temporary, "bin");
  const counters = join(temporary, "counters");
  const runs = join(temporary, "runs");
  const manifest = join(temporary, "sweep.json");
  const output = join(temporary, "aggregate.json");
  mkdirSync(bin, { recursive: true });
  mkdirSync(counters, { recursive: true });

  const gmsh = join(bin, "gmsh");
  const getdp = join(bin, "getdp");
  const audit = join(bin, "audit.mjs");
  writeExecutable(gmsh, `
import { appendFileSync, writeFileSync } from "node:fs";
const outputIndex = process.argv.indexOf("-o");
if (outputIndex < 0) process.exit(2);
appendFileSync(process.env.GMSH_COUNT, "run\\n");
writeFileSync(process.argv[outputIndex + 1], "deterministic mesh\\n");
`);
  writeExecutable(getdp, `
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
appendFileSync(process.env.GETDP_COUNT, "run\\n");
if (existsSync(process.env.GETDP_NO_OUTPUT)) process.exit(0);
console.log("Info    : N: 100 - preonly lu mumps");
console.log("  0 KSP unpreconditioned resid norm 1.0e+00 true resid norm 1.0e+00 ||r(i)||/||b|| 1.0e+00");
writeFileSync(join(process.cwd(), "observables.dat"), "MagneticEnergyJ 1.25\\n");
writeFileSync(join(process.cwd(), "coenergy.dat"), "CoEnergyJ 1.25\\n");
writeFileSync(join(process.cwd(), "inductance.dat"), "InductanceH 2.5\\n");
if (existsSync(process.env.GETDP_NONCONVERGE)) {
  console.log("Linear solve did not converge due to DIVERGED_ITS iterations 750");
  process.exit(0);
}
console.log("  12 KSP unpreconditioned resid norm 5.0e-04 true resid norm 5.0e-04 ||r(i)||/||b|| 5.0e-04");
console.log("Linear solve converged due to CONVERGED_RTOL iterations 12");
console.log("Info    : SaveSolution[Sys_Mag]");
console.log("Info    : Stopped (fixture, Wall = 2.5s, CPU = 2.0s, Mem = 64.0Mb)");
`);
  writeExecutable(audit, `
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const mesh = process.argv[2];
const outputIndex = process.argv.indexOf("--output");
if (outputIndex < 0) process.exit(2);
const meshSha256 = createHash("sha256").update(readFileSync(mesh)).digest("hex");
const valid = !existsSync(process.env.AUDIT_REJECT);
writeFileSync(process.argv[outputIndex + 1], JSON.stringify({ schemaVersion: "edwin-gray-mesh-audit-v1", valid, source: { meshSha256 } }) + "\\n");
if (!valid) process.exit(1);
`);

  const environment = {
    ...process.env,
    GMSH_COUNT: join(counters, "gmsh"),
    GETDP_COUNT: join(counters, "getdp"),
    GETDP_NO_OUTPUT: join(temporary, "getdp-no-output"),
    GETDP_NONCONVERGE: join(temporary, "getdp-nonconverge"),
    AUDIT_REJECT: join(temporary, "audit-reject")
  };
  return { root, runs, manifest, output, gmsh, getdp, audit, environment };
}

function run(context, ...args) {
  return spawnSync(process.execPath, [join(context.root, "scripts/run.mjs"), ...args], {
    cwd: context.root,
    encoding: "utf8",
    env: context.environment
  });
}

function generateAndRun(context) {
  let result = run(context, "--sweep", "--manifest", context.manifest, "--mesh-audit", context.audit);
  assert.equal(result.status, 0, result.stderr);
  result = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(readFileSync(context.manifest, "utf8"));
}

function count(path) {
  try {
    return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

test("successful solver runs resume from verified artifacts and aggregate exact coverage", (t) => {
  const context = fixture(t);
  const manifest = generateAndRun(context);
  assert.equal(manifest.status, "complete");
  assert.equal(count(context.environment.GMSH_COUNT), 2);
  assert.equal(count(context.environment.GETDP_COUNT), 2);

  for (const item of manifest.jobs) {
    const normalized = JSON.parse(readFileSync(resolve(dirname(context.manifest), item.result), "utf8"));
    const provenance = normalized.entries[0].provenance;
    assert.equal(provenance.modelInputHash, manifest.inputHash);
    assert.match(provenance.jobInputHash, /^[a-f0-9]{64}$/);
    assert.notEqual(provenance.jobInputHash, provenance.modelInputHash);
    assert.equal(normalized.entries[0].parameters.eventIndex, manifest.jobs.find((job) => job.jobId === item.jobId).parameters.eventIndex);
    assert.equal(normalized.entries[0].parameters.excitationContract, "edwin-gray-fem-excitation-event-map/v1");
    assert.ok(provenance.artifacts.some((artifact) => artifact.path === "mesh-audit.json"));
  }

  const resumed = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(count(context.environment.GMSH_COUNT), 2);
  assert.equal(count(context.environment.GETDP_COUNT), 2);
  assert.match(resumed.stdout, /"skipped": true/);

  const aggregated = run(
    context,
    "--aggregate",
    "--manifest", context.manifest,
    "--mesh-size", "0.025",
    "--drive-current", "1",
    "--mesh-audit", context.audit,
    "--run-dir", context.runs,
    "--out", context.output
  );
  assert.equal(aggregated.status, 0, aggregated.stderr);
  assert.deepEqual(
    JSON.parse(readFileSync(context.output, "utf8")).entries.map((entry) => entry.parameters.rotorAngleDeg),
    [0, 20]
  );
});

test("resume repairs tampered artifacts and rejects stale solver outputs", (t) => {
  const context = fixture(t);
  const manifest = generateAndRun(context);
  const firstDir = join(context.runs, manifest.jobs[0].jobId);
  const secondDir = join(context.runs, manifest.jobs[1].jobId);

  appendFileSync(join(firstDir, "observables.dat"), "tampered\n");
  let resumed = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(count(context.environment.GETDP_COUNT), 3);

  appendFileSync(join(secondDir, "result.json"), " ");
  resumed = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(count(context.environment.GETDP_COUNT), 3, "result tampering should rerun normalization only");

  const checkpointPath = join(secondDir, "checkpoint.json");
  const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf8"));
  checkpoint.jobInputHash = "0".repeat(64);
  writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  resumed = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(count(context.environment.GMSH_COUNT), 3);
  assert.equal(count(context.environment.GETDP_COUNT), 4);

  appendFileSync(join(firstDir, "coenergy.dat"), "tampered again\n");
  writeFileSync(context.environment.GETDP_NO_OUTPUT, "enabled\n", "utf8");
  resumed = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.notEqual(resumed.status, 0);
  assert.match(resumed.stderr, /without producing all declared table outputs/);
  assert.equal(count(context.environment.GETDP_COUNT), 5);
});

test("runner rejects a quantitative mesh-audit failure before GetDP", (t) => {
  const context = fixture(t);
  writeFileSync(context.environment.AUDIT_REJECT, "reject\n", "utf8");
  let result = run(context, "--sweep", "--manifest", context.manifest, "--mesh-audit", context.audit);
  assert.equal(result.status, 0, result.stderr);
  result = run(
    context,
    "--resume",
    "--manifest", context.manifest,
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.notEqual(result.status, 0);
  assert.equal(count(context.environment.GETDP_COUNT), 0);
});

test("runner rejects PETSc nonconvergence even when GetDP exits zero", (t) => {
  const context = fixture(t);
  writeFileSync(context.environment.GETDP_NONCONVERGE, "reject\n", "utf8");
  const result = run(
    context,
    "--resume",
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PETSc solve did not converge: DIVERGED_ITS/);
});

test("direct MUMPS publication is explicit and restricted to the accepted coarse mesh", (t) => {
  const context = fixture(t);
  const common = [
    "--dry-run",
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--solver-profile", "direct-mumps-publication-v1"
  ];
  let result = run(context, ...common);
  assert.equal(result.status, 0, result.stderr);
  result = run(context, ...common, "--mesh-size", "0.025");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /-pc_factor_mat_solver_type/);
  result = run(context, ...common, "--mesh-size", "0.019");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires mesh size 0.025 m/);
  result = run(context, ...common, "--mesh-size", "0.025", "--publication");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /memory-bounded Docker backend/);
  result = run(context, ...common.slice(0, -2), "--solver-profile", "direct-mumps-convergence-v1", "--mesh-size", "0.019");
  assert.equal(result.status, 0, result.stderr);
});

test("direct MUMPS attests completion without iterative residual lines", (t) => {
  const context = fixture(t);
  writeExecutable(context.getdp, `
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
if (existsSync(process.env.GETDP_NO_OUTPUT)) process.exit(0);
console.log("Info    : N: 100 - preonly lu mumps");
console.log("Linear solve converged due to CONVERGED_ITS iterations 1");
console.log("Info    : SaveSolution[Sys_Mag]");
writeFileSync(join(process.cwd(), "observables.dat"), "MagneticEnergyJ 1.25\\n");
writeFileSync(join(process.cwd(), "coenergy.dat"), "CoEnergyJ 1.25\\n");
writeFileSync(join(process.cwd(), "inductance.dat"), "InductanceH 2.5\\n");
console.log("Info    : Stopped (fixture, Wall = 2.5s, CPU = 2.0s, Mem = 64.0Mb)");
`);
  const result = run(
    context,
    "--resume",
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--solver-profile", "direct-mumps-convergence-v1",
    "--mesh-size", "0.025",
    "--run-dir", context.runs
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const convergence = JSON.parse(readFileSync(join(output.jobDir, "solver-convergence.json"), "utf8"));
  assert.equal(convergence.schemaVersion, "edwin-gray-solver-evidence-v1");
  assert.equal(convergence.finalResidualNorm, null);
  assert.equal(convergence.reason, "CONVERGED_ITS");
});

test("aggregation rejects an incomplete declared manifest slice", (t) => {
  const context = fixture(t);
  const manifest = generateAndRun(context);
  manifest.jobs[1].status = "pending";
  writeFileSync(context.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const aggregated = run(
    context,
    "--aggregate",
    "--manifest", context.manifest,
    "--mesh-size", "0.025",
    "--drive-current", "1",
    "--mesh-audit", context.audit,
    "--run-dir", context.runs,
    "--out", context.output
  );
  assert.notEqual(aggregated.status, 0);
  assert.match(aggregated.stderr, /Declared aggregation job is not complete/);
});

test("single-job overrides reuse only an attested geometry-identical mesh", (t) => {
  const context = fixture(t);
  const common = [
    "--resume",
    "--backend", "host",
    "--gmsh-bin", context.gmsh,
    "--getdp-bin", context.getdp,
    "--mesh-audit", context.audit,
    "--run-dir", context.runs,
    "--rotor-angle", "6.6666666667",
    "--event-index", "0",
    "--mesh-size", "0.025"
  ];
  const production = run(context, ...common, "--drive-current", "10");
  assert.equal(production.status, 0, production.stderr);
  const first = JSON.parse(production.stdout);
  const audit = run(
    context,
    ...common,
    "--drive-current", "1",
    "--reuse-mesh-checkpoint", join(first.jobDir, "checkpoint.json")
  );
  assert.equal(audit.status, 0, audit.stderr);
  assert.equal(count(context.environment.GMSH_COUNT), 1);
  assert.equal(count(context.environment.GETDP_COUNT), 2);
  const second = JSON.parse(audit.stdout);
  const firstCheckpoint = JSON.parse(readFileSync(join(first.jobDir, "checkpoint.json"), "utf8"));
  const secondCheckpoint = JSON.parse(readFileSync(join(second.jobDir, "checkpoint.json"), "utf8"));
  assert.equal(firstCheckpoint.artifacts.mesh, secondCheckpoint.artifacts.mesh);
  assert.notEqual(firstCheckpoint.jobInputHash, secondCheckpoint.jobInputHash);
});
