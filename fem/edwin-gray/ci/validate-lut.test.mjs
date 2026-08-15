import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, validateBundledLut } from "./validate-lut.mjs";

const femRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readJson(resolve(femRoot, "schema/motor-fem-lut.schema.json"), "FEM LUT schema");
const hash = "a".repeat(64);

function validDocument() {
  return {
    contract: "edwin-gray-browser-result",
    contractVersion: 1,
    lutContract: "motor-fem-lut-v1",
    caseId: "ci-fixture",
    status: "complete",
    expectedAnglesDeg: [0],
    entries: [{
      entryId: "ci-fixture-0",
      status: "complete",
      parameters: { rotorAngleDeg: 0, meshSizeM: 0.025, driveCurrentA: 1 },
      observables: {
        magneticEnergyJ: { value: 1, unit: "J" },
        coEnergyJ: { value: 1, unit: "J" },
        inductanceH: { value: 2, unit: "H" }
      },
      provenance: {
        synthetic: false,
        sourceFormat: "getdp-table",
        modelInputHash: hash,
        jobInputHash: hash,
        solver: "getdp",
        backend: "docker",
        symmetryApplied: false,
        artifacts: [{ path: "observables.dat", sha256: hash }]
      }
    }],
    provenance: {
      synthetic: false,
      limitations: ["CI contract fixture only"],
      source: "CI contract fixture"
    }
  };
}

test("accepts a complete browser LUT contract", () => {
  assert.doesNotThrow(() => validateBundledLut(validDocument(), schema));
});

test("rejects a bundled LUT with the wrong contract", () => {
  const document = validDocument();
  document.lutContract = "motor-fem-lut-v0";
  assert.throws(() => validateBundledLut(document, schema), /lutContract/);
});

test("rejects a schema-valid LUT without exact angle coverage", () => {
  const document = validDocument();
  document.expectedAnglesDeg = [20];
  assert.throws(() => validateBundledLut(document, schema), /exactly cover/);
});
