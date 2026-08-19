import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Value(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sameNumber(left, right) {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function eventIndexForAngle(spec, angle) {
  const periodic = spec.production.periodicityPairsDeg.some((pair) => sameNumber(pair[1], angle));
  return spec.production.convergenceEventIndex + (periodic ? spec.production.periodicityEventIndexOffset : 0);
}

export function productionSampleKey(tuple) {
  return `${tuple.domainId}|${tuple.meshLevelId}|${Number(tuple.driveCurrentA).toPrecision(15)}|${Number(tuple.rotorAngleDeg).toFixed(10)}`;
}

export function productionRequiredTuples(spec) {
  const production = spec.production;
  const base = production.baseDomainId;
  const fine = production.meshLevels.at(-1).id;
  const representative = production.representativeAngles.map((item) => item.angleDeg);
  const angles = new Set([
    ...representative,
    ...production.torqueAnglesDeg,
    ...production.periodicityPairsDeg.flat()
  ].map((angle) => Number(angle).toFixed(10)));
  const required = new Map();
  const add = (domainId, meshLevelId, driveCurrentA, rotorAngleDeg) => {
    const tuple = { domainId, meshLevelId, driveCurrentA, rotorAngleDeg, eventIndex: eventIndexForAngle(spec, rotorAngleDeg) };
    required.set(productionSampleKey(tuple), tuple);
  };
  for (const mesh of production.meshLevels) {
    for (const angle of angles) add(base, mesh.id, production.productionCurrentA, Number(angle));
  }
  for (const domain of production.domains) {
    for (const angle of representative) add(domain.id, fine, production.productionCurrentA, angle);
  }
  for (const current of [production.productionCurrentA, production.linearityAuditCurrentA]) {
    for (const angle of representative) add(base, fine, current, angle);
  }
  const tuples = [...required.values()].sort((left, right) => productionSampleKey(left).localeCompare(productionSampleKey(right)));
  if (tuples.length !== 33) throw new Error("canonical production convergence profile must contain exactly 33 tuples");
  return tuples;
}

export function productionProfileDocument(spec, specificationSha256) {
  return {
    contract: "edwin-gray-production-convergence-profile",
    contractVersion: 1,
    profileId: "historical-33-sample-production-v2",
    specificationSha256,
    requiredTuples: productionRequiredTuples(spec)
  };
}

export function productionConvergenceAttestation(spec, specPath) {
  const profile = productionProfileDocument(spec, sha256File(specPath));
  return {
    contract: profile.contract,
    contractVersion: profile.contractVersion,
    profileId: profile.profileId,
    sha256: sha256Value(profile)
  };
}
