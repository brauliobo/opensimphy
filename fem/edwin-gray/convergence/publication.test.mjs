import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { expandPublicationLut, publicationDefinitions, validatePublicationPairs } from "./publication.mjs";
import { proveEventMapSymmetry, validateEventMapSymmetryProof } from "../scripts/event-map-symmetry.mjs";
import { validateBundledLut } from "../ci/validate-lut.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "..");
const read = (path) => readFileSync(resolve(ROOT, path));
const caseBytes = read("cases/patent-3890548-illustrative.json");
const eventMapBytes = read("excitation/v1/event-map-v1.json");
const geometryBytes = read("geometry/patent-3890548-3d.geo");
const caseData = JSON.parse(caseBytes);
const eventMap = JSON.parse(eventMapBytes);
const spec = JSON.parse(readFileSync(resolve(DIR, "convergence-spec-v2.json")));
const profile = JSON.parse(readFileSync(resolve(DIR, "publication-profile-v1.json")));
const schema = JSON.parse(read("schema/motor-fem-lut.schema.json"));
const hash = (character) => character.repeat(64);

function proof(map = eventMap) {
  return proveEventMapSymmetry({
    eventMap: map,
    caseData,
    geometryText: geometryBytes.toString("utf8"),
    eventMapBytes: Buffer.from(JSON.stringify(map)),
    caseBytes,
    geometryBytes
  });
}

function document(eventIndex, multiplier = 1) {
  const source = eventIndex % 3;
  const value = (1 + source * 0.1) * multiplier;
  return {
    contract: "edwin-gray-browser-result",
    contractVersion: 1,
    lutContract: "motor-fem-lut-v1",
    caseId: caseData.caseId,
    status: "complete",
    expectedAnglesDeg: caseData.sweep.anglesDeg,
    entries: [{
      entryId: `solved-${eventIndex}`,
      status: "complete",
      parameters: {
        rotorAngleDeg: caseData.sweep.anglesDeg[eventIndex],
        eventIndex,
        excitationContract: caseData.excitation.contract,
        meshSizeM: 0.025,
        driveCurrentA: 10
      },
      observables: {
        magneticEnergyJ: { value, unit: "J" },
        coEnergyJ: { value, unit: "J" },
        inductanceH: { value: value * 0.02, unit: "H" }
      },
      provenance: {
        synthetic: false,
        sourceFormat: "getdp-table",
        modelInputHash: hash("a"),
        jobInputHash: hash(String(eventIndex + 1)),
        solver: "getdp",
        backend: "docker",
        symmetryApplied: false,
        artifacts: [{ path: "solver-convergence.json", sha256: hash(String(eventIndex + 1)) }]
      }
    }],
    provenance: { synthetic: false, limitations: ["fixture"], source: "fixture" }
  };
}

const documents = () => [0, 1, 2, 3, 4, 5].map((eventIndex) => document(eventIndex));

test("machine-checks every i to i+3 rotational equivalence and fails on a changed source", () => {
  const valid = proof();
  assert.equal(validateEventMapSymmetryProof(valid).checks.length, 79);
  const changed = structuredClone(eventMap);
  changed.events[3].sectors[0].stator.station = 3;
  assert.throws(() => proof(changed), /event-0-stator-source-set/);
});

test("constructs exactly the six coarse publication jobs", () => {
  assert.deepEqual(publicationDefinitions(profile, spec, caseData).map((sample) => sample.eventIndex), [0, 1, 2, 3, 4, 5]);
  assert.ok(publicationDefinitions(profile, spec, caseData).every((sample) => sample.meshLevelId === "coarse"));
});

test("fails publication when a validation partner differs by more than one percent", () => {
  const mismatched = documents();
  mismatched[3] = document(3, 1.02);
  assert.throws(() => validatePublicationPairs(mismatched, profile), /above 0.01/);
});

test("expands complete 27-event coverage with honest representative provenance", () => {
  const lut = expandPublicationLut({ documents: documents(), profile, caseData, symmetryProof: proof() });
  assert.equal(lut.entries.length, 27);
  assert.deepEqual(lut.entries.map((entry) => entry.parameters.eventIndex), [...Array(27).keys()]);
  assert.equal(new Set(lut.entries.map((entry) => entry.provenance.sourceJobInputHash)).size, 3);
  for (const entry of lut.entries) {
    assert.equal(entry.provenance.derivation, "symmetry-derived-from-job");
    assert.equal(entry.provenance.sourceEventIndex, entry.parameters.eventIndex % 3);
    assert.equal(entry.provenance.rotationDeg, Math.floor(entry.parameters.eventIndex / 3) * 40);
    assert.equal(entry.provenance.synthetic, false);
    assert.deepEqual(entry.provenance.sourceArtifactHashes, entry.provenance.artifacts);
  }
  assert.equal(lut.compatibility.modelInputHash, hash("a"));
  assert.deepEqual(lut.publicationProfile.solvedEventIndices, [0, 1, 2, 3, 4, 5]);
  assert.doesNotThrow(() => validateBundledLut(lut, schema));
});
