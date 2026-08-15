#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_RECORDS = 780;
const EXPECTED_PAGES = 16;
const AUTHOR = "Chenopdodium";
const PROFILE_URL = `https://jsfiddle.net/u/${AUTHOR}/fiddles/`;
const ACQUIRED_AT = "2026-08-15T00:00:00.000Z";
const ROW_KEYS = ["n", "p", "id", "s", "v", "t", "code", "lib", "dt", "as", "ui", "vz", "rk", "fl"];
const FLAG_KEYS = ["can", "svg", "three", "webgl", "raf", "tim", "aud", "net", "anim", "math", "d3", "plot", "p5"];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function fail(message) {
  throw new Error(`Fiddle registry input ${message}`);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    fail(`${label} has unknown or missing properties`);
  }
}

function integer(value, label, minimum) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    fail(`${label} must be a safe integer greater than or equal to ${minimum}`);
  }
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function token(value, label) {
  const result = text(value, label);
  if (!TOKEN_PATTERN.test(result)) fail(`${label} must contain only URL-safe token characters`);
  return result;
}

function strings(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((entry, index) => text(entry, `${label}[${index}]`));
}

function flags(value, label) {
  exactKeys(value, FLAG_KEYS, label);
  return {
    can: integer(value.can, `${label}.can`, 0),
    svg: integer(value.svg, `${label}.svg`, 0),
    three: boolean(value.three, `${label}.three`),
    webgl: boolean(value.webgl, `${label}.webgl`),
    raf: boolean(value.raf, `${label}.raf`),
    tim: boolean(value.tim, `${label}.tim`),
    aud: boolean(value.aud, `${label}.aud`),
    net: boolean(value.net, `${label}.net`),
    anim: boolean(value.anim, `${label}.anim`),
    math: boolean(value.math, `${label}.math`),
    d3: boolean(value.d3, `${label}.d3`),
    plot: boolean(value.plot, `${label}.plot`),
    p5: boolean(value.p5, `${label}.p5`),
  };
}

function boolean(value, label) {
  if (typeof value !== "boolean") fail(`${label} must be a boolean`);
  return value;
}

function parseCode(value, label) {
  const match = text(value, label).match(/^H(\d+)\/J(\d+)\/C(\d+)$/);
  if (!match) fail(`${label} must match H<number>/J<number>/C<number>`);
  return {
    html: integer(Number(match[1]), `${label}.html`, 0),
    js: integer(Number(match[2]), `${label}.js`, 0),
    css: integer(Number(match[3]), `${label}.css`, 0),
  };
}

function normalizeRow(value, lineNumber) {
  const label = `record on line ${lineNumber}`;
  exactKeys(value, ROW_KEYS, label);
  return {
    position: integer(value.n, `${label}.n`, 1),
    page: integer(value.p, `${label}.p`, 1),
    pastieId: token(value.id, `${label}.id`),
    slug: token(value.s, `${label}.s`),
    version: integer(value.v, `${label}.v`, 0),
    title: text(value.t, `${label}.t`),
    panelBytes: parseCode(value.code, `${label}.code`),
    library: text(value.lib, `${label}.lib`),
    documentType: text(value.dt, `${label}.dt`),
    assets: strings(value.as, `${label}.as`),
    controls: strings(value.ui, `${label}.ui`),
    visualization: text(value.vz, `${label}.vz`),
    risk: text(value.rk, `${label}.rk`),
    flags: flags(value.fl, `${label}.fl`),
  };
}

function parseInput(textValue) {
  let summary = null;
  const rows = [];
  const lines = textValue.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("{")) return;
    let value;
    try {
      value = JSON.parse(trimmed);
    } catch (reason) {
      fail(`line ${index + 1} is not valid JSON (${String(reason)})`);
    }
    if (!isRecord(value)) fail(`line ${index + 1} must contain an object`);
    if (Object.hasOwn(value, "profilePages") || Object.hasOwn(value, "fiddles")) {
      exactKeys(value, ["profilePages", "fiddles"], `summary on line ${index + 1}`);
      if (summary) fail(`contains more than one summary line`);
      summary = {
        profilePages: integer(value.profilePages, `summary on line ${index + 1}.profilePages`, 1),
        recordCount: integer(value.fiddles, `summary on line ${index + 1}.fiddles`, 1),
      };
      return;
    }
    rows.push(normalizeRow(value, index + 1));
  });
  if (!summary) fail("is missing its summary line");
  if (summary.profilePages !== EXPECTED_PAGES || summary.recordCount !== EXPECTED_RECORDS) {
    fail(`summary must declare ${EXPECTED_RECORDS} records across ${EXPECTED_PAGES} pages`);
  }
  if (rows.length !== EXPECTED_RECORDS) fail(`contains ${rows.length}/${EXPECTED_RECORDS} records`);
  if (rows.some((row, index) => row.position !== index + 1)) fail("record positions must be contiguous and ordered from 1");
  if (rows.some((row) => row.page > EXPECTED_PAGES)) fail(`record page must not exceed ${EXPECTED_PAGES}`);
  if (new Set(rows.map(({ pastieId }) => pastieId)).size !== rows.length) fail("pastie IDs must be unique");
  if (new Set(rows.map(({ slug }) => slug)).size !== rows.length) fail("slugs must be unique");
  if (new Set(rows.map(({ page }) => page)).size !== EXPECTED_PAGES) fail(`records must cover all ${EXPECTED_PAGES} pages`);
  return { summary, rows };
}

export function buildFiddleRegistry(inputText, sourceRevision) {
  if (!/^[a-f0-9]{64}$/.test(sourceRevision)) fail("source revision must be a lowercase SHA-256 digest");
  const { summary, rows } = parseInput(inputText);
  const records = rows.map((row) => ({
    position: row.position,
    page: row.page,
    pastieId: row.pastieId,
    slug: row.slug,
    version: row.version,
    title: row.title,
    sourceUrl: `https://jsfiddle.net/${AUTHOR}/${row.slug}/${row.version}/`,
    embedUrl: `https://jsfiddle.net/${AUTHOR}/${row.slug}/${row.version}/embedded/`,
    panelBytes: row.panelBytes,
    library: row.library,
    documentType: row.documentType,
    assets: row.assets,
    controls: row.controls,
    visualization: row.visualization,
    risk: row.risk,
    flags: row.flags,
  }));
  return {
    schemaVersion: 1,
    source: {
      platform: "jsfiddle",
      author: AUTHOR,
      profileUrl: PROFILE_URL,
      profilePages: summary.profilePages,
      recordCount: summary.recordCount,
      sourceRevision,
      acquiredAt: ACQUIRED_AT,
    },
    records,
  };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== "--input" && key !== "--output") fail(`does not recognize argument ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${key} requires a path`);
    values[key.slice(2)] = value;
    index += 1;
  }
  if (!values.input || !values.output) fail("requires --input <path> and --output <path>");
  return values;
}

async function main() {
  const { input, output } = parseArguments(process.argv.slice(2));
  const inputPath = resolve(input);
  const outputPath = resolve(output);
  const inputBytes = await readFile(inputPath);
  const sourceRevision = createHash("sha256").update(inputBytes).digest("hex");
  const registry = buildFiddleRegistry(inputBytes.toString("utf8"), sourceRevision);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
