import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalPath(path, label) {
  assert(typeof path === "string" && path.length > 0, `${label} must be a non-empty path`);
  assert(!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path), `${label} must be repository-relative`);
  assert(!path.includes("\\") && !path.split("/").includes(".."), `${label} must use a safe POSIX path`);
  return path;
}

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function bundleSha256(files) {
  const hash = createHash("sha256");
  for (const { path, bytes } of files.sort((left, right) => left.path.localeCompare(right.path, "en"))) {
    hash.update(path);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function readJson(path, label) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message}`);
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

export async function readExternalCorpusArtifacts({ root, sourceDirectory }) {
  const manifestPath = join(sourceDirectory, "external-corpus-artifact.json");
  const manifest = await readJson(manifestPath, "external corpus artifact manifest");
  assert(manifest?.schemaVersion === 1, "External corpus artifact manifest schema is unsupported");
  assert(manifest?.artifactRevision === "external-corpus-generated-v1", "External corpus artifact revision is unsupported");
  assert(manifest.expected && typeof manifest.expected === "object", "External corpus artifact expectations are missing");
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "External corpus artifact files are missing");
  assert(Array.isArray(manifest.directories) && manifest.directories.length > 0, "External corpus artifact directories are missing");

  const generatedDataRoot = join(root, "public", "data");
  const artifacts = new Map();
  const addArtifact = (path, bytes) => {
    assert(!artifacts.has(path), `Duplicate external corpus artifact ${path}`);
    artifacts.set(path, bytes);
  };

  for (const [index, entry] of manifest.files.entries()) {
    const path = canonicalPath(entry?.path, `external corpus artifact file ${index + 1}`);
    assert(/^generated\//.test(path), `External corpus artifact file must be generated data: ${path}`);
    assert(typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256), `Invalid artifact SHA-256 for ${path}`);
    const bytes = await readFile(join(generatedDataRoot, path));
    assert(sha256(bytes) === entry.sha256, `External corpus artifact hash mismatch for ${path}`);
    addArtifact(path, bytes);
  }

  for (const [index, entry] of manifest.directories.entries()) {
    const directory = canonicalPath(entry?.path, `external corpus artifact directory ${index + 1}`);
    assert(/^generated\//.test(directory), `External corpus artifact directory must be generated data: ${directory}`);
    assert(typeof entry.extension === "string" && entry.extension.startsWith("."), `Invalid artifact extension for ${directory}`);
    assert(Number.isSafeInteger(entry.count) && entry.count > 0, `Invalid artifact count for ${directory}`);
    assert(typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256), `Invalid artifact SHA-256 for ${directory}`);
    const absoluteDirectory = join(generatedDataRoot, directory);
    const allPaths = await filesBelow(absoluteDirectory);
    const paths = allPaths.filter((path) => path.toLowerCase().endsWith(entry.extension.toLowerCase()));
    assert(paths.length === allPaths.length, `External corpus artifact directory contains an unexpected file: ${directory}`);
    assert(paths.length === entry.count, `External corpus artifact count mismatch for ${directory}: expected ${entry.count}, found ${paths.length}`);
    const files = paths.map((path) => ({
      path: relative(generatedDataRoot, path).split(sep).join("/"),
      bytes: undefined,
    }));
    for (const file of files) file.bytes = await readFile(join(generatedDataRoot, file.path));
    assert(bundleSha256(files) === entry.sha256, `External corpus artifact bundle hash mismatch for ${directory}`);
    for (const file of files) addArtifact(file.path, file.bytes);
  }

  return {
    manifest,
    files: artifacts,
    json(path) {
      const canonical = canonicalPath(path, "external corpus artifact lookup");
      const bytes = artifacts.get(canonical);
      assert(bytes, `External corpus artifact is not listed: ${canonical}`);
      try {
        return JSON.parse(bytes.toString("utf8"));
      } catch (error) {
        throw new Error(`Invalid JSON in external corpus artifact ${canonical}: ${error.message}`);
      }
    },
  };
}
