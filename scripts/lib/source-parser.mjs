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
  const header = /^(\d{3})\. (.+?)\s+—\s+(.+?)\s+\[built on pass (\d+)\]$/gm;
  const matches = [...text.matchAll(header)];
  return matches.map((match, index) => {
    const blockStart = match.index + match[0].length;
    const blockEnd = matches[index + 1]?.index ?? text.length;
    const block = text.slice(blockStart, blockEnd);
    const computed = block.match(/^computed:\s+([^\s]+)(?:\s+(.+))?$/m);
    const dependencies = block.match(/^deps:\s*(.*)$/m)?.[1].split(",").map((item) => item.trim()).filter(Boolean) ?? [];
    const sigma = block.match(/^sigma:\s+([+-]?[\d.]+)$/m);
    return {
      recipeNumber: Number(match[1]),
      constantId: match[2].trim(),
      displayName: match[3].trim(),
      buildPass: Number(match[4]),
      dependencies,
      computed: computed?.[1] ?? null,
      computedDimension: computed?.[2]?.trim() ?? null,
      zScore: sigma ? Number(sigma[1]) : null,
    };
  });
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
