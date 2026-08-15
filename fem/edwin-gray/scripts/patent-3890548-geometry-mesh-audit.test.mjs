import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GEOMETRY = join(ROOT, "geometry/patent-3890548-3d.geo");
const AUDIT = join(ROOT, "mesh-audit/patent-3890548-production.audit.json");

test("patent 3890548 geometry retains illustrative topology and audited groups", () => {
  const geometry = readFileSync(GEOMETRY, "utf8");
  assert.match(geometry, /^\/\/ US3890548A illustrative full 3D geometry\./);
  assert.match(geometry, /BooleanFragments\{ Volume\{1\}; Delete; \}\{ Volume\{allToolVolumes\[\]\}; Delete; \};/);
  assert.match(geometry, /Physical Volume\("Air", 100\)/);
  assert.match(geometry, /Physical Volume\("StatorCores", 200\)/);
  assert.match(geometry, /Physical Volume\("StatorCoils", 201\)/);
  assert.match(geometry, /Physical Volume\("RotorCores", 202\)/);
  assert.match(geometry, /Physical Volume\("RotorCoils", 203\)/);
  assert.match(geometry, /Physical Surface\("OuterBoundary", 300\)/);
  assert.match(geometry, /SmokeMesh = \{0, Choices\{0="Production", 1="Smoke"\}/);
  assert.match(geometry, /Field\[2\] = Threshold;/);
  assert.match(geometry, /Mesh\.Algorithm3D = 1;/);
});

test("archived production mesh audit is quantitative and valid", () => {
  const report = JSON.parse(readFileSync(AUDIT, "utf8"));
  assert.equal(report.schemaVersion, "edwin-gray-mesh-audit-v1");
  assert.equal(report.model, "US3890548A illustrative topology");
  assert.equal(report.mode, "production");
  assert.equal(report.gmsh.version, "4.8.4");
  assert.equal(report.physicalGroups.count, 56);
  assert.equal(report.physicalGroups.assemblyCount, 48);
  assert.deepEqual(report.physicalGroups.missing, []);
  assert.deepEqual(report.physicalGroups.empty, []);
  assert.equal(report.materialPartition.assignedTetrahedra, report.mesh.tetrahedra);
  assert.equal(report.materialPartition.multiplyOrUnassignedTetrahedra, 0);
  assert.equal(report.connectivity.tetrahedralComponents, 1);
  assert.equal(report.connectivity.nonManifoldFaces, 0);
  assert.equal(report.connectivity.outerBoundaryTriangles, report.connectivity.exteriorFaces);
  assert.equal(report.quality.degenerateTetrahedra, 0);
  assert.ok(report.quality.minimumSixTimesVolumeM3 > 0);
  assert.ok(report.quality.materialEdgeP99M <= 0.004);
  assert.equal(report.quality.featureTargetM, 0.002);
  assert.deepEqual(report.quality.representedFeatureDimensionsM, [0.001, 0.008, 0.01]);
  assert.ok(Number.isFinite(report.quality.maximumEdgeRatio));
  assert.equal(report.checks.materialFeatureResolution, true);
  assert.equal(report.valid, true);
  assert.ok(Object.values(report.physicalGroups.elements).every((count) => count > 0));
});
