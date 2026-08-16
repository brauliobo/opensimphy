import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const OUTPUTS = [
  "magnetic-potential.pos",
  "magnetic-flux-density.pos",
  "observables.dat",
  "coenergy.dat",
  "inductance.dat"
];
const FAILED_LOG = /(?:^|\n)(?:.*PETSC ERROR|Error\s*:|.*(?:out of memory|cannot allocate memory|oom-kill|oom_reaper)|\s*Killed\s*$)/im;
const COMPLETE_LOG = /Info\s+: Stopped \([^\n]+\)\s*$/;
const RESIDUAL_ONLY_FAILURE = /run: GetDP log does not contain the final true residual\s*$/m;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function artifactPath(jobDir, category, name) {
  if (category === "inputs") return join(jobDir, name === "geometry" ? "geometry-wrapper.geo" : "getdp-wrapper.pro");
  if (category === "logs") return join(jobDir, `${name}.log`);
  return join(jobDir, name);
}

function validateCheckpointInputs(jobDir, checkpoint) {
  const direct = {
    environment: "solver-environment.json",
    mesh: "motor.msh",
    audit: "mesh-audit.json"
  };
  for (const [name, file] of Object.entries(direct)) {
    const path = join(jobDir, file);
    assert(existsSync(path) && checkpoint.artifacts?.[name] === sha256File(path), `checkpoint ${file} artifact hash mismatch`);
  }
  for (const [category, records] of Object.entries({
    inputs: checkpoint.artifacts?.inputs,
    logs: { gmsh: checkpoint.artifacts?.logs?.gmsh }
  })) {
    assert(records && Object.keys(records).length > 0, `checkpoint ${category} artifact hashes are incomplete`);
    for (const [name, expected] of Object.entries(records)) {
      const path = artifactPath(jobDir, category, name);
      assert(expected && existsSync(path) && expected === sha256File(path), `checkpoint ${category}/${name} artifact hash mismatch`);
    }
  }
}

export function residualOnlyRunnerFailure(stderr) {
  return RESIDUAL_ONLY_FAILURE.test(stderr || "");
}

export function collectSolverEvidence({ jobDir, solver, getdpExitStatus }) {
  assert(getdpExitStatus === 0, "GetDP did not exit successfully");
  const logPath = join(jobDir, "getdp.log");
  assert(existsSync(logPath), "GetDP log is missing");
  const log = readFileSync(logPath, "utf8");
  assert(!FAILED_LOG.test(log), "GetDP log contains a PETSc/GetDP error or out-of-memory failure");
  assert(COMPLETE_LOG.test(log), "GetDP log is truncated or does not contain the final stopped record");

  const selected = [...log.matchAll(/Info\s+: N: (\d+) - (\S+) (\S+)(?: (\S+))?/g)].at(-1);
  assert(selected, "GetDP log does not record the selected PETSc KSP/PC");
  assert(selected[2] === solver.kspType && selected[3] === solver.pcType,
    `GetDP selected ${selected[2]}/${selected[3]} instead of ${solver.kspType}/${solver.pcType}`);
  if (solver.factorSolverType) {
    assert(selected[4] === solver.factorSolverType,
      `GetDP selected ${selected[4] || "no factor solver"} instead of ${solver.factorSolverType}`);
  }

  assert(/Info\s+: SaveSolution\[Sys_Mag\]/.test(log), "GetDP log does not contain completed SaveSolution");
  const postoperations = [...log.matchAll(/Info\s+: PostOperation 'MagnetostaticResults' (\d)\/5\s*\n\s*> '([^']+)'/g)];
  assert(postoperations.length === OUTPUTS.length, "GetDP log does not contain all five postoperations");
  assert(postoperations.every((match, index) => Number(match[1]) === index + 1 && basename(match[2]) === OUTPUTS[index]),
    "GetDP postoperations do not match the five declared outputs");
  assert(/E n d\s+P o s t - P r o c e s s i n g\s*\n/.test(log), "GetDP postprocessing did not complete");

  const outputHashes = Object.fromEntries(OUTPUTS.map((name) => {
    const path = join(jobDir, name);
    assert(existsSync(path) && statSync(path).size > 0, `GetDP output is missing or empty: ${name}`);
    return [name, sha256File(path)];
  }));
  const reason = [...log.matchAll(/Linear solve (did not converge|converged) due to (\S+) iterations (\d+)/g)].at(-1);
  const residual = [...log.matchAll(/(\d+) KSP unpreconditioned resid norm ([\deE+.-]+) true resid norm ([\deE+.-]+) \|\|r\(i\)\|\|\/\|\|b\|\| ([\deE+.-]+)/g)].at(-1);
  if (reason) {
    assert(reason[1] === "converged" && reason[2].startsWith("CONVERGED_"), `PETSc solve did not converge: ${reason[2]}`);
  }

  if (solver.mode === "iterative") {
    assert(reason, "GetDP log does not contain a PETSc convergence reason");
    assert(residual, "GetDP log does not contain the final true residual");
    assert(Number.isFinite(Number(residual[3])) && Number(residual[3]) >= 0
      && Number.isFinite(Number(residual[4])) && Number(residual[4]) >= 0,
    "GetDP final true residual is invalid");
  } else {
    assert(solver.mode === "direct", `unsupported solver mode ${solver.mode}`);
    assert(solver.name === "direct-mumps-publication-v1", "direct calibration evidence requires the publication profile");
    assert(solver.kspType === "preonly" && solver.pcType === "lu" && solver.factorSolverType === "mumps",
      "direct calibration evidence requires preonly/lu/mumps");
  }

  return {
    schemaVersion: "edwin-gray-solver-evidence-v1",
    status: "complete",
    profile: solver.name,
    configSha256: solver.configSha256,
    mode: solver.mode,
    getdpExitStatus,
    kspType: selected[2],
    pcType: selected[3],
    factorSolverType: selected[4] || null,
    reason: reason?.[2] || null,
    iterations: reason ? Number(reason[3]) : null,
    finalResidualNorm: residual ? Number(residual[3]) : null,
    finalRelativeResidual: residual ? Number(residual[4]) : null,
    saveSolution: true,
    postoperations: OUTPUTS,
    getdpLogSha256: sha256File(logPath),
    outputHashes
  };
}

export function validateCheckpointSolverEvidence(jobDir, checkpoint) {
  const evidencePath = join(jobDir, "solver-convergence.json");
  assert(checkpoint.solverConvergence && existsSync(evidencePath), "solver evidence is missing");
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  const collected = collectSolverEvidence({ jobDir, solver: checkpoint.solverProfile, getdpExitStatus: evidence.getdpExitStatus });
  assert(JSON.stringify(evidence) === JSON.stringify(collected), "solver evidence does not match the GetDP log and outputs");
  assert(checkpoint.artifacts?.logs?.getdp === collected.getdpLogSha256, "checkpoint GetDP log hash mismatch");
  assert(checkpoint.artifacts?.convergence === sha256File(evidencePath), "checkpoint solver evidence hash mismatch");
  assert(JSON.stringify(checkpoint.artifacts?.outputs) === JSON.stringify(collected.outputHashes), "checkpoint solver output hashes mismatch");
  return collected;
}

export function validateSolveForAttestation(jobDir, checkpoint, getdpExitStatus) {
  assert(checkpoint.backend === "docker", "calibration solve checkpoint is not Docker-bounded");
  assert(checkpoint.phases?.mesh === "complete" && checkpoint.phases.solve === "pending",
    "calibration solve checkpoint is not pending after a completed mesh");
  assert(checkpoint.parameters?.meshSizeM === 0.025 && checkpoint.parameters.driveCurrentA === 10,
    "calibration solve checkpoint mesh/current is invalid");
  assert(checkpoint.resourceLimits?.memoryGiB === 24 && checkpoint.resourceLimits.memorySwapGiB === 24
    && checkpoint.resourceLimits.cpus === 2, "calibration solve checkpoint resource limits are invalid");
  assert(checkpoint.artifacts?.logs?.getdp == null && checkpoint.artifacts?.convergence == null
    && Object.keys(checkpoint.artifacts?.outputs || {}).length === 0 && checkpoint.solverConvergence == null,
    "calibration solve checkpoint already contains unattested solve evidence");
  validateCheckpointInputs(jobDir, checkpoint);
  return collectSolverEvidence({ jobDir, solver: checkpoint.solverProfile, getdpExitStatus });
}
