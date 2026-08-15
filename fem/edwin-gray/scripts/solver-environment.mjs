import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { arch, platform } from "node:os";

export const SOLVER_ENVIRONMENT_VERSION = "solver-environment-v1";
export const SOLVER_SOURCE = Object.freeze({
  kind: "debian-snapshot+getdp-official-sha256",
  baseImage: "debian@sha256:362e64223cc0da95422b3b13c045186fc0a81250e765d31c025fbddf257f6143",
  debianSnapshot: "20260804T000000Z",
  gmshPackage: "4.8.4+ds2-3",
  getdpPackage: "official-3.5.0",
  getdpArchiveSha256: "d3c28fa18f20d6147b4c7367d4dd802e9f7ddb58c608688bbb71919dbca8041d",
  testedArchitecture: "linux/amd64"
});

export function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isImmutableImageReference(image) {
  return /@sha256:[a-f0-9]{64}$/.test(image || "");
}

function inspectDocker(docker, image, template) {
  const result = spawnSync(docker, ["image", "inspect", "--format", template, image], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function resolveDockerImageReference(docker, requestedImage, { publication = false } = {}) {
  if (isImmutableImageReference(requestedImage)) {
    return {
      requestedImage,
      image: requestedImage,
      digest: requestedImage.slice(requestedImage.indexOf("@") + 1),
      mutableReference: false
    };
  }

  const repoDigestsText = inspectDocker(docker, requestedImage, "{{json .RepoDigests}}");
  const inspectedRepoDigests = repoDigestsText ? JSON.parse(repoDigestsText) : [];
  const repoDigests = Array.isArray(inspectedRepoDigests) ? inspectedRepoDigests : [];
  const resolvedDigest = [...repoDigests].sort()[0] || null;
  if (resolvedDigest) {
    return {
      requestedImage,
      image: resolvedDigest,
      digest: resolvedDigest.slice(resolvedDigest.indexOf("@") + 1),
      mutableReference: true
    };
  }
  if (publication) {
    throw new Error(`Publication mode requires an immutable Docker image digest; could not resolve: ${requestedImage}`);
  }

  const imageId = inspectDocker(docker, requestedImage, "{{.Id}}");
  return {
    requestedImage,
    image: imageId || requestedImage,
    digest: imageId || null,
    mutableReference: true
  };
}

export function runnerIdentity({ revision, runScript, environmentModule }) {
  return {
    revision: revision || "unknown",
    runScriptSha256: sha256(readFileSync(runScript)),
    environmentModuleSha256: sha256(readFileSync(environmentModule))
  };
}

export function identifyHostEnvironment({ gmsh, getdp, threads, runner }) {
  return identify({
    backend: "host",
    architecture: `${platform()}/${arch()}`,
    threadCount: threads,
    tools: {
      gmsh: { sha256: sha256(readFileSync(gmsh)) },
      getdp: { sha256: sha256(readFileSync(getdp)) }
    },
    runner
  });
}

export function identifyDockerEnvironment({ image, threads, runner }) {
  return identify({
    backend: "docker",
    architecture: SOLVER_SOURCE.testedArchitecture,
    threadCount: threads,
    image,
    software: {
      gmsh: SOLVER_SOURCE.gmshPackage,
      getdp: SOLVER_SOURCE.getdpPackage
    },
    source: SOLVER_SOURCE,
    runner
  });
}

export function identifyUnavailableEnvironment({ reason, threads, runner }) {
  return identify({
    backend: "unavailable",
    architecture: `${platform()}/${arch()}`,
    threadCount: threads,
    reason,
    runner
  });
}

function identify(identity) {
  return {
    schemaVersion: SOLVER_ENVIRONMENT_VERSION,
    identityHash: sha256(Buffer.from(stableJson(identity))),
    identity
  };
}

export function environmentManifest(environment, commands) {
  return {
    schemaVersion: SOLVER_ENVIRONMENT_VERSION,
    identityHash: environment.identityHash,
    ...environment.identity,
    execution: {
      threadCount: environment.identity.threadCount,
      commands: Object.fromEntries(Object.entries(commands).map(([phase, command]) => [phase, {
        command: command[0],
        options: command.slice(1)
      }]))
    }
  };
}
