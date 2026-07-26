import { createHash } from "node:crypto";

const EXPECTED_DATASETS = 19;
const EXPECTED_DISPUTES = 4;
const ACCESS_CLASSES = ["open-web", "open-api", "registration", "controlled"];
const REDISTRIBUTION_MODES = ["raw", "derived-only", "metadata-only", "prohibited", "unknown"];
const PRIORITIES = ["P0", "P1", "P2"];
const DISPUTE_STATUSES = ["unverified-source", "nonexistent-as-claimed"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function plainText(markdown) {
  return markdown
    .replace(/\[([^\]]+)\]\((https?:\/\/(?:[^()\s]|\([^()]*\))+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function links(markdown) {
  return [...markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/(?:[^()\s]|\([^()]*\))+)\)/g)].map((match) => ({
    label: plainText(match[1]),
    url: match[2],
  }));
}

function codeValues(markdown) {
  return [...markdown.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function tableCells(line) {
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function slug(value) {
  return plainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitEvidence(value) {
  const separator = value.indexOf(";");
  assert(separator >= 0, `Missing owner/release separator in: ${value}`);
  return [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
}

function splitSentences(value) {
  return value.split(/(?<=[.!?])\s+(?=[A-Z"])/).map((sentence) => sentence.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function doiFromUrl(url) {
  const match = url.match(/^https:\/\/doi\.org\/(.+)$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function parseCandidateRows(registryText) {
  const datasets = [];
  let category = null;
  let inCandidateRegister = false;

  for (const [index, line] of registryText.split("\n").entries()) {
    if (line === "## Candidate register") {
      inCandidateRegister = true;
      continue;
    }
    if (line === "## Disputed source claims") break;
    if (!inCandidateRegister) continue;
    if (line.startsWith("### ")) {
      category = line.slice(4).trim();
      continue;
    }
    if (!line.startsWith("| ")) continue;

    const cells = tableCells(line);
    if (cells[0] === "Candidate" || cells.every((cell) => /^-+$/.test(cell))) continue;
    assert(category, `Candidate row has no category at line ${index + 1}`);
    assert(cells.length === 7, `Malformed EARTH dataset row at line ${index + 1}`);

    const [candidateCell, sourceCell, ownerReleaseCell, accessCell, redistributionCell, simulationCell, statusCell] = cells;
    const name = plainText(candidateCell);
    const sourceLinks = links(sourceCell);
    const termsLinks = links(accessCell);
    const accessClasses = codeValues(accessCell).filter((value) => ACCESS_CLASSES.includes(value));
    const redistributionModes = codeValues(redistributionCell).filter((value) => REDISTRIBUTION_MODES.includes(value));
    const ownerReleaseEvidence = plainText(ownerReleaseCell);
    const [responsibleOrganization, releaseEvidence] = splitEvidence(ownerReleaseEvidence);
    const redistributionEvidence = plainText(redistributionCell);
    const personalSeparator = redistributionEvidence.lastIndexOf(";");
    const personalDataEvidence = redistributionEvidence.slice(personalSeparator + 1).trim();
    const personalData = /^yes\b/i.test(personalDataEvidence);
    const simulationIds = unique(simulationCell.match(/EARTH-[A-Z]+-\d{3}/g) ?? []);
    const statusValues = codeValues(statusCell)
      .filter((value) => value.startsWith("authenticated/") || value === "terms-blocked")
      .map((value) => value === "terms-blocked" ? "authenticated/terms-blocked" : value);
    const priorityMatch = statusCell.match(/;\s*(P[0-2])\.\s*(.+)$/);

    assert(sourceLinks.length > 0, `Dataset ${name} has no source URL`);
    assert(termsLinks.length === 1, `Dataset ${name} must have exactly one terms URL`);
    assert(accessClasses.length > 0, `Dataset ${name} has no supported access class`);
    assert(redistributionModes.length === 1, `Dataset ${name} must have exactly one redistribution mode`);
    assert(personalSeparator >= 0 && /^(?:yes|no)\b/i.test(personalDataEvidence), `Dataset ${name} has invalid personal-data evidence`);
    assert(simulationIds.length > 0, `Dataset ${name} has no intended simulation IDs`);
    assert(statusValues.length > 0, `Dataset ${name} has no authentication status`);
    assert(priorityMatch, `Dataset ${name} has no priority or blocker evidence`);

    const sourceUrls = sourceLinks.map(({ url }) => url);
    const sourceDois = unique(sourceUrls.map(doiFromUrl).filter(Boolean));
    const authenticationStatuses = unique(statusValues);
    const priority = priorityMatch[1];
    const blockerEvidence = priorityMatch[2].trim();
    const g0bState = authenticationStatuses.includes("authenticated/terms-blocked") ? "blocked" : "pending";

    datasets.push({
      datasetId: `earth-dataset-${slug(name)}`,
      name,
      category,
      sourceLine: index + 1,
      canonicalSourceEvidence: sourceCell,
      sourceUrl: sourceUrls.find((url) => !doiFromUrl(url)) ?? sourceUrls[0],
      sourceUrls,
      sourceDoi: sourceDois[0] ?? null,
      sourceDois,
      ownerReleaseEvidence,
      responsibleOrganization,
      releaseEvidence,
      accessClass: accessClasses[0],
      accessClasses,
      termsUrl: termsLinks[0].url,
      redistributionMode: redistributionModes[0],
      redistributionEvidence,
      personalData,
      personalDataEvidence,
      requiresControlledHandling: personalData,
      dataHandling: personalData ? "controlled-local-only" : "source-terms",
      simulationIds,
      metadataAuthenticated: authenticationStatuses.some((status) => status.startsWith("authenticated/")),
      authenticationStatus: authenticationStatuses[0],
      authenticationStatuses,
      authenticationEvidence: plainText(statusCell),
      priority,
      blockerEvidence,
      blockers: splitSentences(blockerEvidence),
      acquisitionStatus: "not-acquired",
      frozen: false,
      retrievedAt: null,
      queryOrSelection: null,
      rowCount: null,
      byteCount: null,
      sha256: null,
      g0bState,
    });
  }

  return datasets;
}

function parseDisputedClaims(registryText) {
  const disputes = [];
  let inDisputes = false;

  for (const [index, line] of registryText.split("\n").entries()) {
    if (line === "## Disputed source claims") {
      inDisputes = true;
      continue;
    }
    if (inDisputes && line.startsWith("## ")) break;
    if (!inDisputes || !line.startsWith("| ")) continue;

    const cells = tableCells(line);
    if (cells[0] === "Claim in the plan/source material" || cells.every((cell) => /^-+$/.test(cell))) continue;
    assert(cells.length === 4, `Malformed disputed source claim at line ${index + 1}`);

    const [claimCell, findingCell, statusCell, consequenceCell] = cells;
    const claim = plainText(claimCell);
    const registryStatuses = codeValues(statusCell).filter((value) => DISPUTE_STATUSES.includes(value));
    assert(registryStatuses.length === 1, `Disputed claim ${claim} must have exactly one registry status`);

    disputes.push({
      claimId: `earth-dispute-${slug(claim)}`,
      claim,
      sourceLine: index + 1,
      finding: plainText(findingCell),
      registryStatus: registryStatuses[0],
      consequence: plainText(consequenceCell),
      simulationIds: unique(consequenceCell.match(/EARTH-[A-Z]+-\d{3}/g) ?? []),
    });
  }

  return disputes;
}

function counts(values, allowedValues) {
  return Object.fromEntries(allowedValues.map((value) => [value, values.filter((candidate) => candidate === value).length]));
}

export function buildEarthDatasetRegistry(registryText, {
  registryPath = "research/earth-thad-nassim/EARTH_DATASET_REGISTRY.md",
  sourcePlan,
} = {}) {
  assert(typeof registryText === "string", "EARTH dataset registry must be text");
  assert(typeof sourcePlan?.path === "string" && sourcePlan.path.length > 0, "EARTH dataset registry requires a source plan path");
  assert(/^[a-f0-9]{64}$/.test(sourcePlan?.sha256), "EARTH dataset registry requires a source plan SHA256");

  const reviewDateMatch = registryText.match(/^Review date:\s*(\d{4}-\d{2}-\d{2})$/m);
  assert(reviewDateMatch, "EARTH dataset registry must declare a review date");

  const datasets = parseCandidateRows(registryText);
  const disputedClaims = parseDisputedClaims(registryText);
  assert(datasets.length === EXPECTED_DATASETS, `Expected ${EXPECTED_DATASETS} EARTH dataset rows, found ${datasets.length}`);
  assert(new Set(datasets.map(({ datasetId }) => datasetId)).size === EXPECTED_DATASETS, "EARTH dataset IDs must be unique");
  assert(disputedClaims.length === EXPECTED_DISPUTES, `Expected ${EXPECTED_DISPUTES} disputed source claims, found ${disputedClaims.length}`);
  assert(new Set(disputedClaims.map(({ claimId }) => claimId)).size === EXPECTED_DISPUTES, "EARTH disputed claim IDs must be unique");

  for (const dataset of datasets) {
    assert(dataset.metadataAuthenticated, `Dataset ${dataset.datasetId} has no authenticated metadata`);
    assert(dataset.acquisitionStatus === "not-acquired" && !dataset.frozen, `Dataset ${dataset.datasetId} must remain unfrozen and not acquired`);
    assert(dataset.rowCount === null && dataset.byteCount === null && dataset.sha256 === null, `Dataset ${dataset.datasetId} contains fabricated acquisition metadata`);
    assert(dataset.g0bState === "pending" || dataset.g0bState === "blocked", `Dataset ${dataset.datasetId} has invalid G0b state`);
  }

  const summary = {
    sourceRows: datasets.length,
    registered: datasets.length,
    disputedClaims: disputedClaims.length,
    metadataAuthenticated: datasets.filter(({ metadataAuthenticated }) => metadataAuthenticated).length,
    dataAcquired: datasets.filter(({ acquisitionStatus }) => acquisitionStatus === "acquired").length,
    dataFrozen: datasets.filter(({ frozen }) => frozen).length,
    g0bPending: datasets.filter(({ g0bState }) => g0bState === "pending").length,
    g0bBlocked: datasets.filter(({ g0bState }) => g0bState === "blocked").length,
    personalData: datasets.filter(({ personalData }) => personalData).length,
    controlledAccess: datasets.filter(({ accessClasses }) => accessClasses.includes("controlled")).length,
    controlledHandling: datasets.filter(({ requiresControlledHandling }) => requiresControlledHandling).length,
    byPriority: counts(datasets.map(({ priority }) => priority), PRIORITIES),
    byRedistributionMode: counts(datasets.map(({ redistributionMode }) => redistributionMode), REDISTRIBUTION_MODES),
  };

  return {
    schemaVersion: 1,
    sourcePlan: {
      path: sourcePlan.path,
      revision: sourcePlan.revision ?? null,
      sha256: sourcePlan.sha256,
    },
    sourceRegistry: {
      path: registryPath,
      reviewDate: reviewDateMatch[1],
      sha256: sha256(registryText),
    },
    policy: {
      metadataAuthenticationDoesNotImplyAcquisition: true,
      datasetBytesAcquired: false,
      g0bPassed: false,
    },
    summary,
    datasets,
    disputedClaims,
  };
}
