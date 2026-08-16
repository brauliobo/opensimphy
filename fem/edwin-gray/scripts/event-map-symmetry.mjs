import { createHash } from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function angleKey(value) {
  return (((value % 360) + 360) % 360).toFixed(8);
}

function sourceSet(event, component, pairOffsetDeg) {
  const eventAngleDeg = event.angleDegNumerator / 3;
  return event.sectors.flatMap((sector) => {
    const source = sector[component];
    const stationAngle = component === "stator"
      ? (source.station - 1) * 40
      : eventAngleDeg + (source.station - 1) * 120;
    const elementOffset = source.element === "major"
      ? (component === "stator" ? -pairOffsetDeg : pairOffsetDeg)
      : 0;
    return ["front", "back"].map((plane) => ({
      angle: stationAngle + elementOffset,
      element: source.element,
      plane,
      polarity: source[plane].polarity,
      currentContribution: source[plane].currentContribution
    }));
  });
}

function rotatedSignature(records, rotationDeg = 0) {
  return records
    .map((record) => `${angleKey(record.angle + rotationDeg)}|${record.element}|${record.plane}|${record.polarity}|${record.currentContribution}`)
    .sort();
}

function check(condition, id, evidence) {
  assert(condition, `event-map symmetry proof failed: ${id}`);
  return { id, status: "passed", evidence };
}

export function proveEventMapSymmetry({ eventMap, caseData, geometryText, eventMapBytes, caseBytes, geometryBytes }) {
  assert(eventMap?.contractVersion === "edwin-gray-fem-excitation-event-map/v1", "event-map symmetry proof requires excitation v1");
  assert(Array.isArray(eventMap.events) && eventMap.events.length === 27, "event-map symmetry proof requires 27 events");
  assert(caseData?.model?.rotorStatorLayout, "event-map symmetry proof requires the rotor/stator layout");
  assert(typeof geometryText === "string" && geometryText.length > 0, "event-map symmetry proof requires geometry source");
  const layout = caseData.model.rotorStatorLayout;
  const pairOffsetDeg = caseData.geometry.pairOffsetDeg;
  const checks = [];

  checks.push(check(layout.statorPairStations === 9 && layout.statorAngularPitchDeg === 40 && 9 * 40 === 360,
    "complete-stator-geometry-40deg-invariant", "nine congruent stations exhaust one revolution"));
  checks.push(check(layout.rotorPairStations === 3 && layout.rotorAngularPitchDeg === 120 && 3 * 120 === 360,
    "complete-rotor-geometry-rotates-with-angle", "three congruent rotor stations exhaust one revolution"));
  checks.push(check(caseData.geometry.axis === "z"
      && caseData.geometry.airZMinM === -caseData.geometry.airZMaxM
      && /Cylinder\(1\).*AirOuterRadiusM/.test(geometryText),
    "air-domain-z-rotation-invariant", "centered circular cylindrical outer domain"));
  checks.push(check(/For station In \{0:8\}/.test(geometryText)
      && /statorAngle = station \* 40\./.test(geometryText)
      && /For station In \{0:2\}/.test(geometryText)
      && /rotorAngle = RotorAngleDeg \+ RotorPhaseDeg \+ station \* 120\./.test(geometryText),
    "geometry-construction-equivariant", "station loops use only z-axis rotations of common element boxes"));
  checks.push(check(caseData.materials.air.linear === true
      && caseData.materials.coil.linear === true
      && caseData.materials.core.linear === true
      && Object.values(caseData.materials).every((material) => Number.isFinite(material.relativePermeability)),
    "material-domain-rotation-invariant", "each complete physical domain has scalar linear permeability"));
  checks.push(check(eventMap.approximation.kind === "closed-surface-equivalent-current-potential"
      && caseData.excitation.sourceDirectionBasis === "local-radial",
    "source-law-rotation-equivariant", "local-radial current potential rotates with each selected envelope"));

  const regions = eventMap.requiredPhysicalRegionContract?.regions || [];
  checks.push(check(regions.length === 48
      && new Set(regions.map((region) => region.id)).size === 48
      && new Set(regions.map((region) => region.identity)).size === 48,
    "complete-region-identity", "all 36 stator and 12 rotor coil-envelope identities are unique"));

  for (let eventIndex = 0; eventIndex < 24; eventIndex += 1) {
    const source = eventMap.events[eventIndex];
    const target = eventMap.events[eventIndex + 3];
    checks.push(check(target.angleDegNumerator - source.angleDegNumerator === 120,
      `event-${eventIndex}-angle`, "event index +3 advances physical rotor angle by 40 degrees"));
    checks.push(check(stableJson(rotatedSignature(sourceSet(source, "stator", pairOffsetDeg), 40))
        === stableJson(rotatedSignature(sourceSet(target, "stator", pairOffsetDeg))),
      `event-${eventIndex}-stator-source-set`, "complete selected stator set advances by one 40-degree station"));
    checks.push(check(stableJson(rotatedSignature(sourceSet(source, "rotor", pairOffsetDeg), 40))
        === stableJson(rotatedSignature(sourceSet(target, "rotor", pairOffsetDeg))),
      `event-${eventIndex}-rotor-source-set`, "rotor geometry and complete selected rotor set rotate together by 40 degrees"));
  }

  const proof = {
    contract: "edwin-gray-event-map-symmetry-proof",
    contractVersion: 1,
    status: "complete",
    transformation: {
      eventOffset: 3,
      rotationDeg: 40,
      representativeEvents: [0, 1, 2],
      validationPartners: [3, 4, 5],
      classCount: 3,
      eventsPerClass: 9
    },
    inputs: {
      eventMapSha256: sha256(eventMapBytes ?? Buffer.from(JSON.stringify(eventMap))),
      caseSha256: sha256(caseBytes ?? Buffer.from(JSON.stringify(caseData))),
      geometrySha256: sha256(geometryBytes ?? Buffer.from(geometryText))
    },
    checks
  };
  proof.proofSha256 = sha256(Buffer.from(stableJson(proof)));
  return proof;
}

export function validateEventMapSymmetryProof(proof) {
  assert(proof?.contract === "edwin-gray-event-map-symmetry-proof" && proof.contractVersion === 1, "symmetry proof contract is invalid");
  assert(proof.status === "complete", "symmetry proof is incomplete");
  assert(proof.transformation?.eventOffset === 3 && proof.transformation.rotationDeg === 40, "symmetry proof transformation is invalid");
  assert(stableJson(proof.transformation.representativeEvents) === stableJson([0, 1, 2]), "symmetry proof representatives are invalid");
  assert(stableJson(proof.transformation.validationPartners) === stableJson([3, 4, 5]), "symmetry proof validation partners are invalid");
  assert(Object.values(proof.inputs || {}).every((hash) => SHA256.test(hash)), "symmetry proof input hashes are invalid");
  assert(Array.isArray(proof.checks) && proof.checks.length === 79 && proof.checks.every((item) => item.status === "passed"), "symmetry proof checks are incomplete");
  const { proofSha256, ...payload } = proof;
  assert(SHA256.test(proofSha256 || "") && proofSha256 === sha256(Buffer.from(stableJson(payload))), "symmetry proof hash is invalid");
  return proof;
}
