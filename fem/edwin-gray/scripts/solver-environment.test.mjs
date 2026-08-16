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
  assert.throws(
    () => resolveDockerImageReference("/missing/docker", "registry.example/solver:latest", { publication: true }),
    /requires an immutable Docker image digest/
  );
});

test("host binary content and thread count participate in environment identity", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "solver-environment-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const gmsh = join(directory, "gmsh");
  const getdp = join(directory, "getdp");
  writeFileSync(gmsh, "gmsh-a\n");
  writeFileSync(getdp, "getdp-a\n");
  chmodSync(gmsh, 0o755);
  chmodSync(getdp, 0o755);
  const runner = { revision: "test", runScriptSha256: "1", environmentModuleSha256: "2" };
  const first = identifyHostEnvironment({ gmsh, getdp, threads: 1, runner });
  const repeated = identifyHostEnvironment({ gmsh, getdp, threads: 1, runner });
  assert.equal(first.identityHash, repeated.identityHash);

  writeFileSync(gmsh, "gmsh-b\n");
  const changedBinary = identifyHostEnvironment({ gmsh, getdp, threads: 1, runner });
  const changedThreads = identifyHostEnvironment({ gmsh, getdp, threads: 2, runner });
  assert.notEqual(first.identityHash, changedBinary.identityHash);
  assert.notEqual(changedBinary.identityHash, changedThreads.identityHash);
});

test("environment manifest separates commands from options", () => {
  const environment = {
    identityHash: "a".repeat(64),
    identity: { backend: "docker", threadCount: 2, runner: { revision: "abc" } }
  };
  const manifest = environmentManifest(environment, {
    mesh: ["docker", "run", "gmsh", "model.geo", "-3"],
    solve: ["docker", "run", "getdp", "model.pro", "-solve", "Magnetostatics3D"]
  });
  assert.equal(manifest.execution.threadCount, 2);
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
