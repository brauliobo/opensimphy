import { readFile } from "node:fs/promises";

function fail(message, offset) {
  throw new Error(`${message} at source offset ${offset}`);
}

export function parseConstantsYaml(text) {
  const recipes = [];
  let cursor = 0;

  function whitespace() {
    while (cursor < text.length) {
      if (/\s/.test(text[cursor])) {
        cursor += 1;
      } else if (text[cursor] === "#") {
        while (cursor < text.length && text[cursor] !== "\n") cursor += 1;
      } else {
        break;
      }
    }
  }

  function quoted() {
    const start = cursor;
    cursor += 1;
    let value = "";
    while (cursor < text.length) {
      const character = text[cursor];
      if (character === "\\") {
        const escape = text.slice(cursor, cursor + 2);
        try {
          value += JSON.parse(`"${escape}"`);
        } catch {
          fail("Invalid quoted escape", cursor);
        }
        cursor += 2;
      } else if (character === '"') {
        cursor += 1;
        return value;
      } else {
        value += character;
        cursor += 1;
      }
    }
    fail("Unterminated quoted value", start);
  }

  function plain() {
    const start = cursor;
    let parentheses = 0;
    while (cursor < text.length) {
      const character = text[cursor];
      if (character === "(") parentheses += 1;
      if (character === ")") parentheses -= 1;
      if (parentheses === 0 && (character === "," || character === "}" || character === "]" || character === "\n")) break;
      cursor += 1;
    }
    const value = text.slice(start, cursor).trim();
    if (!value) fail("Expected a value", start);
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return Number(value);
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    return value;
  }

  function value() {
    whitespace();
    if (text[cursor] === '"') return quoted();
    if (text[cursor] === "{") return object();
    if (text[cursor] === "[") return array();
    return plain();
  }

  function key() {
    whitespace();
    return text[cursor] === '"' ? quoted() : plainKey();
  }

  function plainKey() {
    const start = cursor;
    while (cursor < text.length && text[cursor] !== ":") cursor += 1;
    const result = text.slice(start, cursor).trim();
    if (!result) fail("Expected a mapping key", start);
    return result;
  }

  function object() {
    const result = {};
    cursor += 1;
    whitespace();
    while (text[cursor] !== "}") {
      const name = key();
      whitespace();
      if (text[cursor] !== ":") fail("Expected ':'", cursor);
      cursor += 1;
      result[name] = value();
      whitespace();
      if (text[cursor] === ",") {
        cursor += 1;
        whitespace();
      } else if (text[cursor] !== "}") {
        fail("Expected ',' or '}'", cursor);
      }
    }
    cursor += 1;
    return result;
  }

  function array() {
    const result = [];
    cursor += 1;
    whitespace();
    while (text[cursor] !== "]") {
      result.push(value());
      whitespace();
      if (text[cursor] === ",") {
        cursor += 1;
        whitespace();
      } else if (text[cursor] !== "]") {
        fail("Expected ',' or ']'", cursor);
      }
    }
    cursor += 1;
    return result;
  }

  while (true) {
    const start = text.indexOf("- {", cursor);
    if (start < 0) break;
    cursor = start + 2;
    recipes.push(object());
  }
  return recipes;
}

export function parseSymbolsCsv(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (lines.shift() !== "token,value,dimension") throw new Error("Unexpected symbols CSV header");
  return lines.map((line, index) => {
    const first = line.indexOf(",");
    const last = line.lastIndexOf(",");
    if (first <= 0 || last <= first) throw new Error(`Malformed symbols CSV row ${index + 2}`);
    return { token: line.slice(0, first), value: line.slice(first + 1, last), dimension: line.slice(last + 1) };
  });
}

export function parsePublishedOutput(text) {
  const source = text.replace(/\r/g, "");
  const summary = source.match(/^(\d+) constants built\.\n\s*(\d+) exact, (\d+) passed, (\d+) failed\n\s*(\d+) measured, (\d+) passed, (\d+) failed$/m);
  if (!summary) throw new Error("Published output summary is missing or malformed");
  const summaryCounts = summary.slice(1).map(Number);
  if (summaryCounts.some((value) => !Number.isSafeInteger(value))) throw new Error("Published output summary contains nonfinite counts");
  const [total, exact, exactMet, exactUnmet, measured, measuredMet, measuredUnmet] = summaryCounts;
  if (total !== 288 || exact !== 70 || exactMet !== 68 || exactUnmet !== 2 || measured !== 218 || measuredMet !== 217 || measuredUnmet !== 1) {
    throw new Error("Published output summary does not match the preserved 288-record audit");
  }

  const header = /^(\d{3})\. (.+?)\s+—\s+(.+?)\s+\[built on pass (\d+)\]$/gm;
  const matches = [...source.matchAll(header)];
  if (matches.length !== total) throw new Error(`Published output contains ${matches.length}/${total} records`);
  const results = matches.map((match, index) => {
    const blockStart = match.index + match[0].length;
    const blockEnd = matches[index + 1]?.index ?? source.length;
    const block = source.slice(blockStart, blockEnd);
    const computed = block.match(/^computed:\s+([^\s]+)(?:\s+(.+))?$/m);
    const dependencies = block.match(/^deps:\s*(.*)$/m)?.[1].split(",").map((item) => item.trim()).filter(Boolean) ?? [];
    const recipeNumber = Number(match[1]);
    const buildPass = Number(match[4]);
    if (!Number.isSafeInteger(recipeNumber) || recipeNumber !== index + 1) throw new Error(`Published record ${index + 1} has a malformed recipe number`);
    if (!Number.isSafeInteger(buildPass) || buildPass < 1) throw new Error(`Published record ${recipeNumber} has a malformed build pass`);
    if (!computed || !Number.isFinite(Number(computed[1]))) throw new Error(`Published record ${recipeNumber} has a missing or nonfinite computed value`);

    const digitMarkers = [...block.matchAll(/^digits:/gm)];
    const sigmaMarkers = [...block.matchAll(/^sigma:/gm)];
    const withinMarkers = [...block.matchAll(/^within 5\.2\u03c3:/gm)];
    let sourceAudit;
    if (digitMarkers.length === 1 && sigmaMarkers.length === 0 && withinMarkers.length === 0) {
      const digits = block.match(/^digits:\s+(full match|almost-full match|not a match)\s+\((\d+)\/(\d+)\)\s*$/m);
      if (!digits) throw new Error(`Published exact audit ${recipeNumber} is malformed`);
      const matchedDigits = Number(digits[2]);
      const totalCompared = Number(digits[3]);
      if (!Number.isSafeInteger(matchedDigits) || !Number.isSafeInteger(totalCompared) || matchedDigits < 0 || totalCompared < 1 || matchedDigits > totalCompared) {
        throw new Error(`Published exact audit ${recipeNumber} has malformed digit counts`);
      }
      sourceAudit = {
        kind: "exact",
        assessment: digits[1],
        matchedDigits,
        totalCompared,
        met: digits[1] !== "not a match",
      };
    } else if (digitMarkers.length === 0 && sigmaMarkers.length === 1 && withinMarkers.length === 1) {
      const sigma = block.match(/^sigma:\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*$/m);
      const within = block.match(/^within 5\.2\u03c3:\s+(yes|no)\s*$/m);
      if (!sigma || !within) throw new Error(`Published measured audit ${recipeNumber} is malformed`);
      const zScore = Number(sigma[1]);
      if (!Number.isFinite(zScore)) throw new Error(`Published measured audit ${recipeNumber} has a nonfinite z-score`);
      const met = within[1] === "yes";
      if (met !== (Math.abs(zScore) <= 5.2)) throw new Error(`Published measured audit ${recipeNumber} disagrees with its 5.2-sigma result`);
      sourceAudit = { kind: "measured", zScore, threshold: 5.2, met };
    } else {
      throw new Error(`Published record ${recipeNumber} does not contain one complete source audit`);
    }
    return {
      recipeNumber,
      constantId: match[2].trim(),
      displayName: match[3].trim(),
      buildPass,
      dependencies,
      computed: computed[1],
      computedDimension: computed[2]?.trim() ?? null,
      sourceAudit,
    };
  });
  const actual = {
    exact: results.filter(({ sourceAudit }) => sourceAudit.kind === "exact"),
    measured: results.filter(({ sourceAudit }) => sourceAudit.kind === "measured"),
  };
  if (actual.exact.length !== exact || actual.exact.filter(({ sourceAudit }) => sourceAudit.met).length !== exactMet) {
    throw new Error("Published exact audits do not match the source summary");
  }
  if (actual.measured.length !== measured || actual.measured.filter(({ sourceAudit }) => sourceAudit.met).length !== measuredMet) {
    throw new Error("Published measured audits do not match the source summary");
  }
  return results;
}

function assertSourceIdentity(actual, expected, field, recipeNumber) {
  if (actual !== expected && actual.normalize("NFD") === expected.normalize("NFD")) {
    throw new Error(`Published ${field} for recipe ${recipeNumber} has a Unicode-normalization mismatch`);
  }
  if (actual !== actual.normalize("NFC") || expected !== expected.normalize("NFC")) {
    throw new Error(`Published ${field} for recipe ${recipeNumber} is not NFC-normalized`);
  }
  if (actual === expected) return;
  throw new Error(`Published ${field} for recipe ${recipeNumber} does not exactly match constants.yaml`);
}

export function bindPublishedResults(recipes, published) {
  if (recipes.length !== published.length) throw new Error(`Published result coverage is ${published.length}/${recipes.length}`);
  const byNumber = new Map();
  for (const result of published) {
    if (!Number.isSafeInteger(result.recipeNumber) || byNumber.has(result.recipeNumber)) {
      throw new Error(`Published recipe number ${result.recipeNumber} is invalid or duplicated`);
    }
    byNumber.set(result.recipeNumber, result);
  }
  const bound = new Map();
  for (const recipe of recipes) {
    const recipeNumber = recipe.recipe_number;
    if (!Number.isSafeInteger(recipeNumber) || bound.has(recipeNumber)) throw new Error(`Source recipe number ${recipeNumber} is invalid or duplicated`);
    const result = byNumber.get(recipeNumber);
    if (!result) throw new Error(`Published result for recipe ${recipeNumber} is missing`);
    assertSourceIdentity(result.constantId, recipe.constant_id, "constant ID", recipeNumber);
    assertSourceIdentity(result.displayName, recipe.display_name, "display name", recipeNumber);
    bound.set(recipeNumber, result);
  }
  return bound;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
