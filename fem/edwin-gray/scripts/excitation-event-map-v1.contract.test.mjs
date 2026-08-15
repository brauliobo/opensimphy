import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = join(ROOT, "excitation/v1/event-map-v1.json");
const GETDP_MAP_PATH = join(ROOT, "excitation/v1/event-map-v1.pro");
const FORMULATION_PATH = join(ROOT, "getdp/magnetostatic.pro");
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const getdpMap = readFileSync(GETDP_MAP_PATH, "utf8");
const formulation = readFileSync(FORMULATION_PATH, "utf8");
const phaseLabels = ["A", "B", "C"];

function expectedRegionId(component, station, element, plane) {
  const base = component === "stator" ? 2101 : 2201;
  return base + (station - 1) * 4 + (element === "major" ? 2 : 0) + (plane === "back" ? 1 : 0);
}

function sourceBranches(source) {
  const pattern = /(?:If|ElseIf)\(EventIndex == (\d+)\)\s+EventSourcePositive = Region\[\{([^}]+)}];\s+EventSourceNegative = Region\[\{([^}]+)}];/g;
  return [...source.matchAll(pattern)].map((match) => ({
    eventIndex: Number(match[1]),
    positive: match[2].split(",").map(Number),
    negative: match[3].split(",").map(Number)
  }));
}

test("excitation v1 defines 27 ordered unique browser-schedule events", () => {
  assert.equal(contract.contractVersion, "edwin-gray-fem-excitation-event-map/v1");
  assert.equal(contract.eventIndexBase, 0);
  assert.equal(contract.eventCount, 27);
  assert.equal(contract.events.length, 27);
  assert.equal(new Set(contract.events.map((event) => JSON.stringify(event))).size, 27);

  contract.events.forEach((event, eventIndex) => {
    assert.equal(event.eventIndex, eventIndex);
    assert.equal(event.angleDegNumerator, eventIndex * 40);
    assert.equal(event.phase, phaseLabels[eventIndex % 3]);
    assert.equal(event.sectors.length, 3);
    assert.deepEqual(event.sectors.map(({ sectorIndex }) => sectorIndex), [0, 1, 2]);
    assert.equal(new Set(event.sectors.map((sector) => `${sector.stator.station}:${sector.rotor.station}`)).size, 3);

    const element = eventIndex % 3 === 1 ? "major" : "minor";
    event.sectors.forEach((sector, sectorIndex) => {
      assert.equal(sector.phase, phaseLabels[sectorIndex]);
      assert.equal(sector.stator.station, (Math.floor(eventIndex / 3) + sectorIndex * 3) % 9 + 1);
      assert.equal(sector.rotor.station, (Math.floor(eventIndex / 9) + sectorIndex) % 3 + 1);
      assert.equal(sector.stator.element, element);
      assert.equal(sector.rotor.element, element);
    });
  });
});

test("excitation v1 requires stable explicit coil-only region identities", () => {
  const regionContract = contract.requiredPhysicalRegionContract;
  assert.equal(regionContract.dimension, 3);
  assert.equal(regionContract.material, "coil-envelope-only");
  assert.deepEqual(regionContract.mustExclude, ["core", "air"]);
  assert.equal(regionContract.regions.length, 48);
  assert.equal(new Set(regionContract.regions.map(({ id }) => id)).size, 48);
  assert.equal(new Set(regionContract.regions.map(({ identity }) => identity)).size, 48);

  const declared = new Map(regionContract.regions.map(({ id, identity }) => [id, identity]));
  for (const event of contract.events) {
    for (const sector of event.sectors) {
      for (const component of ["stator", "rotor"]) {
        const identity = sector[component];
        for (const plane of ["front", "back"]) {
          const terminal = identity[plane];
          const expectedId = expectedRegionId(component, identity.station, identity.element, plane);
          assert.equal(terminal.regionId, expectedId);
          assert.equal(declared.get(expectedId), `${component}-${identity.station}-${identity.element}-${plane}`);
        }
      }
    }
  }
});

test("every participating winding envelope is front/back balanced", () => {
  assert.equal(contract.approximation.kind, "homogenized-axial-current-density");
  assert.equal(contract.approximation.resolvedWinding, false);
  assert.match(contract.approximation.description, /not resolved/i);

  for (const event of contract.events) {
    let eventContribution = 0;
    for (const sector of event.sectors) {
      for (const component of ["stator", "rotor"]) {
        const { front, back } = sector[component];
        assert.equal(front.polarity, "positive");
        assert.equal(back.polarity, "negative");
        assert.equal(front.currentContribution, 1);
        assert.equal(back.currentContribution, -1);
        assert.equal(front.currentContribution + back.currentContribution, 0);
        eventContribution += front.currentContribution + back.currentContribution;
      }
    }
    assert.equal(eventContribution, 0);
  }
});

test("GetDP selects only the twelve coil regions belonging to one event", () => {
  const requiredIds = new Set(contract.requiredPhysicalRegionContract.regions.map(({ id }) => id));
  const coveredIds = new Set();
  const branches = sourceBranches(getdpMap);
  assert.deepEqual(branches.map(({ eventIndex }) => eventIndex), [...Array(27).keys()]);

  branches.forEach((branch, eventIndex) => {
    const event = contract.events[eventIndex];
    const expectedPositive = event.sectors.flatMap(({ stator, rotor }) => [stator.front.regionId, rotor.front.regionId]).sort();
    const expectedNegative = event.sectors.flatMap(({ stator, rotor }) => [stator.back.regionId, rotor.back.regionId]).sort();
    assert.deepEqual([...branch.positive].sort(), expectedPositive);
    assert.deepEqual([...branch.negative].sort(), expectedNegative);
    assert.equal(new Set([...branch.positive, ...branch.negative]).size, 12);
    assert.ok([...branch.positive, ...branch.negative].every((id) => requiredIds.has(id)));
    assert.equal(requiredIds.size - new Set([...branch.positive, ...branch.negative]).size, 36);
    for (const id of [...branch.positive, ...branch.negative]) coveredIds.add(id);
  });
  assert.deepEqual(coveredIds, requiredIds);

  assert.match(formulation, /EventIndex = DefineNumber\[0, Name "Parameters\/Excitation event index", Min 0, Max 26, Step 1];/);
  assert.match(formulation, /SourceCurrentDensity\[EventSourcePositive] = Vector\[0\., 0\., HomogenizedCurrentDensity];/);
  assert.match(formulation, /SourceCurrentDensity\[EventSourceNegative] = Vector\[0\., 0\., -HomogenizedCurrentDensity];/);
  assert.doesNotMatch(formulation, /SourceCurrentDensity\[AllCoils]/);
  assert.match(getdpMap, /DomainWithSourceCurrentDensity = Region\[\{EventSourcePositive, EventSourceNegative}];/);
});
