#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BASE_MATERIALS = ["Air", "StatorCores", "StatorCoils", "RotorCores", "RotorCoils"];
const REQUIRED_GROUPS = [...BASE_MATERIALS, "AllCores", "AllCoils", "OuterBoundary"];
const ELEMENT_NODE_COUNTS = new Map([[1, 2], [2, 3], [4, 4], [15, 1]]);

function section(text, name) {
  const startMarker = `$${name}\n`;
  const endMarker = `\n$End${name}`;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing $${name} section`);
  return text.slice(start + startMarker.length, end);
}

function tokens(text, name) {
  return section(text, name).trim().split(/\s+/);
}

function parsePhysicalNames(text) {
  const lines = section(text, "PhysicalNames").trim().split("\n");
  const count = Number(lines.shift());
  const byTag = new Map();
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\d+)\s+"([^"]+)"$/);
    if (!match) throw new Error(`Invalid physical name: ${line}`);
    const [, dimension, tag, name] = match;
    byTag.set(`${dimension}:${tag}`, name);
  }
  if (byTag.size !== count) throw new Error("Physical name count mismatch");
  return byTag;
}

function parseEntities(text) {
  const values = tokens(text, "Entities");
  let cursor = 0;
  const counts = values.slice(cursor, cursor += 4).map(Number);
  const physicalTags = new Map();
  for (let dimension = 0; dimension < 4; dimension += 1) {
    for (let index = 0; index < counts[dimension]; index += 1) {
      const tag = Number(values[cursor++]);
      cursor += dimension === 0 ? 3 : 6;
      const physicalCount = Number(values[cursor++]);
      const tags = values.slice(cursor, cursor += physicalCount).map(Number);
      physicalTags.set(`${dimension}:${tag}`, tags);
      if (dimension > 0) {
        const boundaryCount = Number(values[cursor++]);
        cursor += boundaryCount;
      }
    }
  }
  return { counts, physicalTags };
}

function parseNodes(text) {
  const values = tokens(text, "Nodes");
  let cursor = 0;
  const blockCount = Number(values[cursor++]);
  const nodeCount = Number(values[cursor++]);
  cursor += 1;
  const maximumTag = Number(values[cursor++]);
  const coordinates = new Float64Array((maximumTag + 1) * 3);
  for (let block = 0; block < blockCount; block += 1) {
    cursor += 2;
    const parametric = Number(values[cursor++]);
    const count = Number(values[cursor++]);
    const tags = values.slice(cursor, cursor += count).map(Number);
    for (const tag of tags) {
      const offset = tag * 3;
      coordinates[offset] = Number(values[cursor++]);
      coordinates[offset + 1] = Number(values[cursor++]);
      coordinates[offset + 2] = Number(values[cursor++]);
      if (parametric) throw new Error("Parametric nodes are not supported by this audit");
    }
  }
  return { coordinates, nodeCount, maximumTag };
}

class DisjointSet {
  constructor(size) {
    this.parent = new Int32Array(size);
    this.rank = new Uint8Array(size);
    for (let index = 0; index < size; index += 1) this.parent[index] = index;
  }

  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(left, right) {
    left = this.find(left);
    right = this.find(right);
    if (left === right) return;
    if (this.rank[left] < this.rank[right]) [left, right] = [right, left];
    this.parent[right] = left;
    if (this.rank[left] === this.rank[right]) this.rank[left] += 1;
  }
}

function faceKey(a, b, c) {
  if (a > b) [a, b] = [b, a];
  if (b > c) [b, c] = [c, b];
  if (a > b) [a, b] = [b, a];
  return (BigInt(a) << 42n) | (BigInt(b) << 21n) | BigInt(c);
}

function tetraQuality(nodes, coordinates) {
  const point = (index) => {
    const offset = nodes[index] * 3;
    return [coordinates[offset], coordinates[offset + 1], coordinates[offset + 2]];
  };
  const [a, b, c, d] = [point(0), point(1), point(2), point(3)];
  const subtract = (left, right) => left.map((value, index) => value - right[index]);
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ad = subtract(d, a);
  const volume6 = Math.abs(
    ab[0] * (ac[1] * ad[2] - ac[2] * ad[1]) -
    ab[1] * (ac[0] * ad[2] - ac[2] * ad[0]) +
    ab[2] * (ac[0] * ad[1] - ac[1] * ad[0])
  );
  const points = [a, b, c, d];
  const edges = [];
  for (let left = 0; left < 4; left += 1) {
    for (let right = left + 1; right < 4; right += 1) {
      edges.push(Math.hypot(...subtract(points[left], points[right])));
    }
  }
  return {
    volume6,
    edgeRatio: Math.max(...edges) / Math.min(...edges),
    minimumEdge: Math.min(...edges),
    maximumEdge: Math.max(...edges)
  };
}

function parseElements(text, entities, physicalNames, nodes) {
  if (nodes.maximumTag >= 2 ** 21) throw new Error("Face-key encoding supports node tags below 2^21");
  const values = tokens(text, "Elements");
  let cursor = 0;
  const blockCount = Number(values[cursor++]);
  const elementCount = Number(values[cursor++]);
  cursor += 2;
  const blocks = [];
  let tetraCount = 0;
  for (let block = 0; block < blockCount; block += 1) {
    const dimension = Number(values[cursor++]);
    const entityTag = Number(values[cursor++]);
    const elementType = Number(values[cursor++]);
    const count = Number(values[cursor++]);
    const nodeCount = ELEMENT_NODE_COUNTS.get(elementType);
    if (!nodeCount) throw new Error(`Unsupported element type ${elementType}`);
    const entries = new Array(count);
    for (let index = 0; index < count; index += 1) {
      cursor += 1;
      entries[index] = values.slice(cursor, cursor += nodeCount).map(Number);
    }
    blocks.push({ dimension, entityTag, elementType, entries });
    if (elementType === 4) tetraCount += count;
  }

  const groupElements = Object.fromEntries([...physicalNames.values()].map((name) => [name, 0]));
  const typeCounts = {};
  const faces = new Map();
  const dsu = new DisjointSet(tetraCount);
  let tetraIndex = 0;
  let minimumVolume6 = Infinity;
  let maximumEdgeRatio = 0;
  let minimumEdge = Infinity;
  let maximumEdge = 0;
  let maximumMaterialEdge = 0;
  const materialEdges = [];
  let degenerateTetrahedra = 0;
  let outerBoundaryTriangles = 0;
  let partitionedTetrahedra = 0;
  let partitionErrors = 0;

  for (const block of blocks) {
    const names = (entities.physicalTags.get(`${block.dimension}:${block.entityTag}`) ?? [])
      .map((tag) => physicalNames.get(`${block.dimension}:${tag}`));
    typeCounts[block.elementType] = (typeCounts[block.elementType] ?? 0) + block.entries.length;
    for (const name of names) groupElements[name] += block.entries.length;
    if (block.elementType === 2 && names.includes("OuterBoundary")) outerBoundaryTriangles += block.entries.length;
    if (block.elementType !== 4) continue;

    const baseMembership = names.filter((name) => BASE_MATERIALS.includes(name));
    if (baseMembership.length === 1) partitionedTetrahedra += block.entries.length;
    else partitionErrors += block.entries.length;
    for (const tetra of block.entries) {
      const quality = tetraQuality(tetra, nodes.coordinates);
      minimumVolume6 = Math.min(minimumVolume6, quality.volume6);
      maximumEdgeRatio = Math.max(maximumEdgeRatio, quality.edgeRatio);
      minimumEdge = Math.min(minimumEdge, quality.minimumEdge);
      maximumEdge = Math.max(maximumEdge, quality.maximumEdge);
      if (baseMembership[0] !== "Air") {
        maximumMaterialEdge = Math.max(maximumMaterialEdge, quality.maximumEdge);
        materialEdges.push(quality.maximumEdge);
      }
      if (quality.volume6 <= 1e-18) degenerateTetrahedra += 1;
      const tetraFaces = [
        faceKey(tetra[0], tetra[1], tetra[2]),
        faceKey(tetra[0], tetra[1], tetra[3]),
        faceKey(tetra[0], tetra[2], tetra[3]),
        faceKey(tetra[1], tetra[2], tetra[3])
      ];
      for (const key of tetraFaces) {
        const previous = faces.get(key);
        if (previous === undefined) faces.set(key, tetraIndex);
        else if (previous >= 0) {
          dsu.union(previous, tetraIndex);
          faces.set(key, -previous - 1);
        } else {
          faces.set(key, Number.MIN_SAFE_INTEGER);
        }
      }
      tetraIndex += 1;
    }
  }

  let exteriorFaces = 0;
  let nonManifoldFaces = 0;
  for (const owner of faces.values()) {
    if (owner >= 0) exteriorFaces += 1;
    if (owner === Number.MIN_SAFE_INTEGER) nonManifoldFaces += 1;
  }
  const components = new Set();
  for (let index = 0; index < tetraCount; index += 1) components.add(dsu.find(index));
  materialEdges.sort((left, right) => left - right);
  const materialEdgeP99 = materialEdges[Math.ceil(materialEdges.length * 0.99) - 1];
  return {
    elementCount,
    typeCounts,
    tetraCount,
    groupElements,
    partitionedTetrahedra,
    partitionErrors,
    exteriorFaces,
    outerBoundaryTriangles,
    nonManifoldFaces,
    connectedComponents: components.size,
    minimumVolume6,
    maximumEdgeRatio,
    minimumEdge,
    maximumEdge,
    maximumMaterialEdge,
    materialEdgeP99,
    degenerateTetrahedra
  };
}

export function auditMesh(meshPath, metadata = {}) {
  const bytes = readFileSync(meshPath);
  const text = bytes.toString("utf8").replaceAll("\r\n", "\n");
  const format = section(text, "MeshFormat").trim().split(/\s+/);
  if (format[0] !== "4.1" || format[1] !== "0") throw new Error("Audit requires an ASCII MSH 4.1 mesh");
  const physicalNames = parsePhysicalNames(text);
  const entities = parseEntities(text);
  const nodes = parseNodes(text);
  const elements = parseElements(text, entities, physicalNames, nodes);
  const groupNames = [...physicalNames.values()];
  const assemblyNames = groupNames.filter((name) => /^(Stator|Rotor)_\d+_(Minor|Major)_(Front|Back)_CoilCore$/.test(name));
  const missingGroups = REQUIRED_GROUPS.filter((name) => !groupNames.includes(name));
  const emptyGroups = groupNames.filter((name) => elements.groupElements[name] === 0);
  const featureTarget = metadata.mode === "smoke" ? 0.005 : 0.002;
  const materialEdgeP99Limit = metadata.mode === "smoke" ? 0.012 : 0.004;
  const checks = {
    expectedGroupsPresent: missingGroups.length === 0,
    allPhysicalGroupsNonempty: emptyGroups.length === 0,
    canonicalAssemblyCount: assemblyNames.length === 48,
    materialPartitionExact: elements.partitionErrors === 0 && elements.partitionedTetrahedra === elements.tetraCount,
    aggregateCoreCountExact: elements.groupElements.AllCores === elements.groupElements.StatorCores + elements.groupElements.RotorCores,
    aggregateCoilCountExact: elements.groupElements.AllCoils === elements.groupElements.StatorCoils + elements.groupElements.RotorCoils,
    faceConformity: elements.nonManifoldFaces === 0,
    singleConnectedDomain: elements.connectedComponents === 1,
    outerBoundaryComplete: elements.outerBoundaryTriangles === elements.exteriorFaces,
    positiveTetraVolumes: elements.degenerateTetrahedra === 0 && elements.minimumVolume6 > 0,
    materialFeatureResolution: elements.materialEdgeP99 <= materialEdgeP99Limit
  };
  return {
    schemaVersion: "edwin-gray-mesh-audit-v1",
    model: "US3890548A illustrative topology",
    mode: metadata.mode ?? "unknown",
    gmsh: { version: metadata.gmshVersion ?? "unknown", command: metadata.command ?? "unknown" },
    source: { geometrySha256: metadata.geometrySha256 ?? "unknown", meshSha256: createHash("sha256").update(bytes).digest("hex") },
    mesh: {
      format: "4.1 ASCII",
      nodes: nodes.nodeCount,
      elements: elements.elementCount,
      elementsByType: elements.typeCounts,
      tetrahedra: elements.tetraCount,
      entityCountsByDimension: entities.counts
    },
    physicalGroups: {
      count: physicalNames.size,
      assemblyCount: assemblyNames.length,
      expectedCount: 56,
      elements: elements.groupElements,
      missing: missingGroups,
      empty: emptyGroups
    },
    materialPartition: {
      groups: BASE_MATERIALS,
      assignedTetrahedra: elements.partitionedTetrahedra,
      multiplyOrUnassignedTetrahedra: elements.partitionErrors
    },
    connectivity: {
      tetrahedralComponents: elements.connectedComponents,
      exteriorFaces: elements.exteriorFaces,
      outerBoundaryTriangles: elements.outerBoundaryTriangles,
      nonManifoldFaces: elements.nonManifoldFaces
    },
    quality: {
      degenerateTetrahedra: elements.degenerateTetrahedra,
      minimumSixTimesVolumeM3: elements.minimumVolume6,
      minimumEdgeM: elements.minimumEdge,
      maximumEdgeM: elements.maximumEdge,
      maximumMaterialEdgeM: elements.maximumMaterialEdge,
      materialEdgeP99M: elements.materialEdgeP99,
      maximumEdgeRatio: elements.maximumEdgeRatio,
      featureTargetM: featureTarget,
      materialEdgeP99LimitM: materialEdgeP99Limit,
      representedFeatureDimensionsM: [0.001, 0.008, 0.01]
    },
    checks,
    valid: Object.values(checks).every(Boolean)
  };
}

function parseArguments(argv) {
  const options = { meshPath: argv[0] };
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = argv[index + 1];
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArguments(process.argv.slice(2));
  if (!options.meshPath) throw new Error("Usage: audit-msh.mjs MESH [--output PATH] [--mode MODE] [--gmsh-version VERSION] [--geometry-sha256 SHA] [--command COMMAND]");
  const report = auditMesh(resolve(options.meshPath), options);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(options.output), output);
  else process.stdout.write(output);
  if (!report.valid) process.exitCode = 1;
}
