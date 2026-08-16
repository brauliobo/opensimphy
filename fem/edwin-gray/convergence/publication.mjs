import { validateEventMapSymmetryProof } from "../scripts/event-map-symmetry.mjs";

const OBSERVABLES = ["magneticEnergyJ", "coEnergyJ", "inductanceH"];
const SHA256 = /^[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function relativeDifference(left, right) {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
}

export function publicationDefinitions(profile, spec, caseData) {
  assert(profile?.contract === "edwin-gray-fast-publication-profile" && profile.contractVersion === 1, "fast publication profile is invalid");
  const mesh = spec.production.meshLevels.find((item) => item.id === profile.meshLevelId);
  assert(mesh && mesh.meshSizeM === profile.acceptedMesh.meshSizeM, "fast publication profile does not match the accepted convergence mesh");
  assert(profile.solverProfile === "direct-mumps-publication-v1", "fast publication solver profile is invalid");
  assert(profile.resources?.dockerMemoryGiB === 24 && profile.resources.dockerCpus === 2 && profile.resources.solverThreads === 2,
    "fast publication resource profile must be 24 GiB and 2 CPUs/threads");
  const eventIndices = [...profile.representativeEvents, ...profile.validationPartners];
  assert(JSON.stringify(eventIndices) === JSON.stringify([0, 1, 2, 3, 4, 5]), "fast publication requires representative events 0,1,2 and validation partners 3,4,5");
  return eventIndices.map((eventIndex) => ({
    domainId: spec.production.baseDomainId,
    meshLevelId: profile.meshLevelId,
    driveCurrentA: spec.production.productionCurrentA,
    rotorAngleDeg: caseData.sweep.anglesDeg[eventIndex],
    eventIndex
  }));
}

function solvedEntry(document, eventIndex) {
  assert(document?.status === "complete" && document.entries?.length === 1, `publication event ${eventIndex} must contain one complete solver entry`);
  const entry = document.entries[0];
  assert(entry.parameters.eventIndex === eventIndex, `publication event ${eventIndex} result has the wrong event index`);
  assert(entry.provenance.synthetic === false && entry.provenance.symmetryApplied === false, `publication event ${eventIndex} must be an independently solved result`);
  assert(SHA256.test(entry.provenance.jobInputHash || ""), `publication event ${eventIndex} job hash is invalid`);
  assert(Array.isArray(entry.provenance.artifacts) && entry.provenance.artifacts.length > 0, `publication event ${eventIndex} artifact hashes are missing`);
  return entry;
}

export function validatePublicationPairs(documents, profile) {
  assert(Array.isArray(documents) && documents.length === 6, "publication requires exactly six solved job documents");
  const entries = new Map(documents.map((document) => {
    const eventIndex = document.entries?.[0]?.parameters?.eventIndex;
    return [eventIndex, solvedEntry(document, eventIndex)];
  }));
  assert(entries.size === 6 && [0, 1, 2, 3, 4, 5].every((eventIndex) => entries.has(eventIndex)), "publication solved jobs must exactly cover events 0 through 5");
  const first = entries.get(0);
  assert([...entries.values()].every((entry) => entry.provenance.modelInputHash === first.provenance.modelInputHash), "publication jobs must share one actual model hash");
  assert([...entries.values()].every((entry) => entry.provenance.solver === first.provenance.solver && entry.provenance.backend === first.provenance.backend), "publication jobs must share one solver environment");

  const pairs = profile.representativeEvents.map((representativeEvent, index) => {
    const validationEvent = profile.validationPartners[index];
    const representative = entries.get(representativeEvent);
    const validation = entries.get(validationEvent);
    const differences = Object.fromEntries(OBSERVABLES.map((observable) => [observable,
      relativeDifference(representative.observables[observable].value, validation.observables[observable].value)]));
    const maximumRelativeDifference = Math.max(...Object.values(differences));
    assert(maximumRelativeDifference <= profile.pairRelativeTolerance,
      `publication symmetry pair ${representativeEvent}/${validationEvent} differs by ${maximumRelativeDifference}, above ${profile.pairRelativeTolerance}`);
    return {
      representativeEvent,
      validationEvent,
      rotationDeg: 40,
      tolerance: profile.pairRelativeTolerance,
      differences,
      maximumRelativeDifference,
      status: "passed",
      representativeJobInputHash: representative.provenance.jobInputHash,
      validationJobInputHash: validation.provenance.jobInputHash,
      representativeArtifactHashes: representative.provenance.artifacts,
      validationArtifactHashes: validation.provenance.artifacts
    };
  });
  return { entries, pairs };
}

function compatibility(caseData, modelInputHash) {
  return {
    machineContractId: caseData.caseId,
    machineRevision: 1,
    modelRevision: 1,
    topologyIdentity: "us3890548a-nine-stator-three-rotor-pair-topology",
    turns: caseData.excitation.turns,
    excitation: caseData.excitation.kind,
    modelInputHash
  };
}

export function expandPublicationLut({ documents, profile, caseData, symmetryProof }) {
  validateEventMapSymmetryProof(symmetryProof);
  const { entries: solvedEntries, pairs } = validatePublicationPairs(documents, profile);
  const representativeEntries = profile.representativeEvents.map((eventIndex) => solvedEntries.get(eventIndex));
  const modelInputHash = representativeEntries[0].provenance.modelInputHash;
  const entries = caseData.sweep.eventIndices.map((eventIndex, angleIndex) => {
    const sourceEventIndex = eventIndex % 3;
    const source = representativeEntries[sourceEventIndex];
    const rotorAngleDeg = caseData.sweep.anglesDeg[angleIndex];
    return {
      entryId: `angle-${rotorAngleDeg}-event-${eventIndex}-mesh-${source.parameters.meshSizeM}-current-${source.parameters.driveCurrentA}`,
      status: "complete",
      parameters: {
        ...source.parameters,
        rotorAngleDeg,
        eventIndex
      },
      observables: structuredClone(source.observables),
      provenance: {
        ...structuredClone(source.provenance),
        symmetryApplied: true,
        derivation: "symmetry-derived-from-job",
        rotationDeg: Math.floor(eventIndex / 3) * 40,
        sourceEventIndex,
        sourceJobInputHash: source.provenance.jobInputHash,
        sourceArtifactHashes: structuredClone(source.provenance.artifacts)
      }
    };
  });
  assert(entries.length === 27 && new Set(entries.map((entry) => entry.parameters.eventIndex)).size === 27, "symmetry expansion must cover all 27 events exactly once");
  return {
    contract: "edwin-gray-browser-result",
    contractVersion: 1,
    lutContract: "motor-fem-lut-v1",
    caseId: caseData.caseId,
    status: "complete",
    expectedAnglesDeg: [...caseData.sweep.anglesDeg],
    entries,
    compatibility: compatibility(caseData, modelInputHash),
    publicationProfile: {
      profileId: profile.profileId,
      solvedEventIndices: [0, 1, 2, 3, 4, 5],
      independentlySolvedJobCount: 6,
      symmetryDerivedEntryCount: 27
    },
    symmetryProof,
    validationPairs: pairs,
    provenance: {
      synthetic: false,
      limitations: [...new Set(documents.flatMap((document) => document.provenance.limitations || []))],
      source: "Six independently solved coarse direct-MUMPS jobs; 27 entries expanded from exact 40-degree event classes after three validation-pair gates"
    }
  };
}
