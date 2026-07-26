import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, relative, sep } from "node:path";

const CLAIM_HEADING = /\b(theorem|results?|predictions?|summary|closure|statement|verdict|conclusions?)\b/i;
const EXPLICIT_CLAIM = /\bclaims?(?:ed|ing)?\b/i;
const FORMULA_LINE = /(?:=|≈|≃|∝|→|↔|≤|≥|\b(?:sin|cos|exp|sqrt|arcsin)\b|\\(?:frac|sqrt|sum|int|boxed|begin))/.source;
const DOMAIN_SERIES = /\b(BIO|CHEM|GALAXY|NEURO|PLANET|STAR)-(\d+)\b/i;

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left.normalize("NFC")), Buffer.from(right.normalize("NFC")));
}

async function markdownFilesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await markdownFilesBelow(path));
    else if (entry.name.toLowerCase().endsWith(".md")) files.push(path);
  }
  return files;
}

function canonicalPath(root, path) {
  const output = relative(root, path).split(sep).join("/").normalize("NFC");
  if (!output || output.startsWith("/") || output.split("/").includes("..")) {
    throw new Error(`Invalid EARTH source path: ${output || path}`);
  }
  return output;
}

function documentIdentity(path) {
  return sha256(Buffer.from(path, "utf8"));
}

function documentSlug(path, identity) {
  const stem = basename(path, ".md")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "document";
  return `${stem}--${identity.slice(0, 12)}`;
}

function classify(path) {
  const series = basename(path).match(DOMAIN_SERIES);
  return {
    collection: path === "README.md" ? "root" : path.includes("/Safe Paper/") ? "safe-paper" : "theorem",
    series: series?.[1]?.toUpperCase() ?? null,
    ordinal: series ? Number(series[2]) : null,
  };
}

function linesWithOffsets(text) {
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  let byteOffset = 0;
  return lines.map((value, index) => {
    const hasNewline = index < lines.length - 1 || text.endsWith("\n");
    const byteLength = Buffer.byteLength(value, "utf8");
    const line = {
      number: index + 1,
      text: value,
      startByte: byteOffset,
      endByte: byteOffset + byteLength,
    };
    byteOffset += byteLength + (hasNewline ? 1 : 0);
    return line;
  });
}

function scanStructure(lines, documentId) {
  const headings = [];
  const codeBlocks = [];
  const fencedLines = new Set();
  let fence = null;

  for (const line of lines) {
    if (fence) {
      fencedLines.add(line.number);
      const closing = line.text.match(/^ {0,3}(`+|~+)\s*$/);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
        const content = lines.slice(fence.startLine, line.number - 1).map(({ text }) => text).join("\n");
        codeBlocks.push({
          id: `${documentId}-code-${codeBlocks.length + 1}`,
          language: fence.language,
          info: fence.info,
          section: fence.section,
          startLine: fence.startLine,
          endLine: line.number,
          contentSha256: sha256(Buffer.from(content, "utf8")),
          execution: "disabled",
        });
        fence = null;
      }
      continue;
    }

    const opening = line.text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening) {
      const info = opening[2].trim();
      fence = {
        marker: opening[1][0],
        length: opening[1].length,
        info,
        language: info.split(/\s+/, 1)[0]?.toLowerCase() || null,
        section: headings.at(-1)?.text ?? null,
        startLine: line.number,
      };
      fencedLines.add(line.number);
      continue;
    }

    const heading = line.text.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/);
    if (heading) {
      const text = heading[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      headings.push({
        id: `${documentId}-heading-${headings.length + 1}`,
        level: heading[1].length,
        text,
        line: line.number,
      });
    }
  }

  if (fence) throw new Error(`Unclosed code fence at line ${fence.startLine}`);
  return { headings, codeBlocks, fencedLines };
}

function unescapedAt(text, index, token) {
  if (!text.startsWith(token, index)) return false;
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 0;
}

function scanMath(lines, fencedLines, documentId) {
  const formulas = [];
  const diagnostics = [];
  let display = null;

  for (const line of lines) {
    if (fencedLines.has(line.number)) continue;
    let cursor = 0;
    let codeTicks = 0;

    while (cursor < line.text.length) {
      if (display) {
        const close = line.text.indexOf("$$", cursor);
        if (close === -1) {
          display.content.push(line.text.slice(cursor));
          display.content.push("\n");
          break;
        }
        display.content.push(line.text.slice(cursor, close));
        formulas.push({
          id: `${documentId}-formula-${formulas.length + 1}`,
          kind: "display-math",
          basis: "dollar-delimited",
          text: display.content.join("").trim(),
          startLine: display.startLine,
          startColumn: display.startColumn,
          endLine: line.number,
          endColumn: close + 3,
        });
        display = null;
        cursor = close + 2;
        continue;
      }

      if (line.text[cursor] === "`") {
        let run = 1;
        while (line.text[cursor + run] === "`") run += 1;
        if (codeTicks === 0) codeTicks = run;
        else if (codeTicks === run) codeTicks = 0;
        cursor += run;
        continue;
      }
      if (codeTicks) {
        cursor += 1;
        continue;
      }

      if (unescapedAt(line.text, cursor, "$$")) {
        display = { startLine: line.number, startColumn: cursor + 1, content: [] };
        cursor += 2;
        continue;
      }
      if (unescapedAt(line.text, cursor, "$")) {
        let close = cursor + 1;
        while (close < line.text.length && !unescapedAt(line.text, close, "$")) close += 1;
        if (close < line.text.length) {
          formulas.push({
            id: `${documentId}-formula-${formulas.length + 1}`,
            kind: "inline-math",
            basis: "dollar-delimited",
            text: line.text.slice(cursor + 1, close),
            startLine: line.number,
            startColumn: cursor + 1,
            endLine: line.number,
            endColumn: close + 2,
          });
          cursor = close + 1;
          continue;
        }
      }
      cursor += 1;
    }
  }

  if (display) {
    diagnostics.push({
      code: "unclosed-display-math",
      line: display.startLine,
      column: display.startColumn,
    });
  }
  return { formulas, diagnostics };
}

function scanCandidates(lines, fencedLines, headings, codeBlocks, formulas, documentId) {
  const claims = [];
  const simulations = [];
  const formulaLines = new Set(formulas.flatMap(({ startLine, endLine }) => {
    const output = [];
    for (let line = startLine; line <= endLine; line += 1) output.push(line);
    return output;
  }));
  const plainFormulaPattern = new RegExp(FORMULA_LINE);

  for (const heading of headings) {
    if (!CLAIM_HEADING.test(heading.text)) continue;
    claims.push({
      id: `${documentId}-claim-${claims.length + 1}`,
      basis: "heading-keyword",
      text: heading.text,
      line: heading.line,
      validationStatus: "unreviewed-source-claim",
    });
  }

  const plainFormulas = [];
  for (const line of lines) {
    if (fencedLines.has(line.number)) continue;
    if (EXPLICIT_CLAIM.test(line.text) && !headings.some((heading) => heading.line === line.number)) {
      claims.push({
        id: `${documentId}-claim-${claims.length + 1}`,
        basis: "explicit-claim-word",
        text: line.text.trim(),
        line: line.number,
        validationStatus: "unreviewed-source-claim",
      });
    }
    if (!formulaLines.has(line.number) && plainFormulaPattern.test(line.text)) {
      plainFormulas.push({
        id: `${documentId}-formula-${formulas.length + plainFormulas.length + 1}`,
        kind: "plain-line-candidate",
        basis: "relation-or-operator-heuristic",
        text: line.text.trim(),
        startLine: line.number,
        startColumn: 1,
        endLine: line.number,
        endColumn: line.text.length + 1,
      });
    }
  }

  for (const block of codeBlocks) {
    if (block.language !== "python") continue;
    let basis = null;
    if (/verification notes/i.test(block.section ?? "")) basis = "verification-python";
    else if (/simulat|lattice verification/i.test(block.section ?? "")) basis = "simulation-heading-python";
    if (!basis) continue;
    simulations.push({
      id: `${documentId}-simulation-${simulations.length + 1}`,
      basis,
      codeBlockId: block.id,
      section: block.section,
      line: block.startLine,
      validationStatus: "unreviewed-candidate",
    });
  }

  return { claims, simulations, plainFormulas };
}

export function sanitizeMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, destination) => `[Image omitted: ${alt || "source image"}](${destination})`)
    .replace(/<\/?[A-Za-z][^>\n]*>/g, (tag) => tag.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
}

function parseDocument(path, bytes) {
  const text = bytes.toString("utf8");
  const identity = documentIdentity(path);
  const documentId = `earth-p-${identity}`;
  const lines = linesWithOffsets(text);
  const { headings, codeBlocks, fencedLines } = scanStructure(lines, documentId);
  const { formulas, diagnostics } = scanMath(lines, fencedLines, documentId);
  const { claims, simulations, plainFormulas } = scanCandidates(lines, fencedLines, headings, codeBlocks, formulas, documentId);
  const classification = classify(path);

  return {
    id: documentId,
    slug: documentSlug(path, identity),
    title: basename(path, ".md"),
    classification,
    source: {
      path,
      sha256: sha256(bytes),
      bytes: bytes.byteLength,
      lineCount: lines.length,
      encoding: "utf-8",
      finalNewline: text.endsWith("\n"),
    },
    structure: { headings, codeBlocks },
    formulas: [...formulas, ...plainFormulas],
    claims,
    simulations,
    diagnostics,
    sanitizedMarkdown: sanitizeMarkdown(text),
  };
}

export async function readEarthCorpus(earthRoot) {
  const paths = (await markdownFilesBelow(earthRoot))
    .map((path) => ({ absolute: path, canonical: canonicalPath(earthRoot, path) }))
    .sort((left, right) => compareUtf8(left.canonical, right.canonical));
  const documents = await Promise.all(paths.map(async ({ absolute, canonical }) => parseDocument(canonical, await readFile(absolute))));
  const slugs = new Set(documents.map(({ slug }) => slug));
  if (slugs.size !== documents.length) throw new Error("EARTH document slug collision");
  return documents;
}

export function createEarthSourceLock(documents, { lockedAt, sourceRevision }) {
  return {
    schemaVersion: 1,
    lockedAt,
    source: {
      repository: "https://github.com/SamDoesThings2/EARTH",
      revision: sourceRevision,
      root: "EARTH",
    },
    license: {
      identifier: "CC-BY-NC-SA-4.0",
      declarationPath: "README.md",
      attribution: "EARTH Collaboration - Richard Vaught, Alexander T. Rayman (2025)",
      note: "License declaration is recorded from the source README; OpenSimPhy does not independently verify authorship or rights ownership.",
    },
    files: documents.map(({ source }) => ({
      path: source.path,
      sha256: source.sha256,
      bytes: source.bytes,
    })),
  };
}

export function verifyEarthSourceLock(documents, lock) {
  if (lock?.schemaVersion !== 1 || !Array.isArray(lock.files)) throw new Error("Invalid EARTH source lock");
  const actual = new Map(documents.map(({ source }) => [source.path, source]));
  const expected = new Map(lock.files.map((file) => [file.path, file]));
  const errors = [];

  for (const path of [...new Set([...actual.keys(), ...expected.keys()])].sort(compareUtf8)) {
    const source = actual.get(path);
    const locked = expected.get(path);
    if (!locked) errors.push(`unlocked file ${path}`);
    else if (!source) errors.push(`missing file ${path}`);
    else if (source.sha256 !== locked.sha256 || source.bytes !== locked.bytes) errors.push(`changed file ${path}`);
  }
  if (errors.length) throw new Error(`EARTH source lock mismatch: ${errors.join("; ")}`);
  return true;
}

export function buildEarthArtifacts(documents, lock) {
  const formulas = documents.flatMap((document) => document.formulas.map((formula) => ({ documentId: document.id, documentSlug: document.slug, ...formula })));
  const claims = documents.flatMap((document) => document.claims.map((claim) => ({ documentId: document.id, documentSlug: document.slug, ...claim })));
  const codeBlocks = documents.flatMap((document) => document.structure.codeBlocks.map((block) => ({ documentId: document.id, documentSlug: document.slug, ...block })));
  const simulations = documents.flatMap((document) => document.simulations.map((simulation) => ({ documentId: document.id, documentSlug: document.slug, ...simulation })));
  const summary = {
    documents: documents.length,
    sourceBytes: documents.reduce((sum, document) => sum + document.source.bytes, 0),
    sourceLines: documents.reduce((sum, document) => sum + document.source.lineCount, 0),
    headings: documents.reduce((sum, document) => sum + document.structure.headings.length, 0),
    formulas: formulas.length,
    delimitedFormulas: formulas.filter(({ basis }) => basis === "dollar-delimited").length,
    plainFormulaCandidates: formulas.filter(({ kind }) => kind === "plain-line-candidate").length,
    claimCandidates: claims.length,
    codeBlocks: codeBlocks.length,
    simulationCandidates: simulations.length,
    diagnostics: documents.reduce((sum, document) => sum + document.diagnostics.length, 0),
  };
  const envelope = {
    schemaVersion: 1,
    parserVersion: 1,
    sourceRevision: lock.source.revision,
    sourceLockSha256: sha256(Buffer.from(`${JSON.stringify(lock, null, 2)}\n`)),
  };
  const manifest = {
    ...envelope,
    license: lock.license,
    policy: {
      sourceClaimsAreValidated: false,
      codeExecution: "disabled",
      rawHtml: "escaped",
      remoteImages: "omitted",
      candidateRule: "Heuristic candidates are discovery aids, not scientific validation or executable simulation status.",
    },
    summary,
    documents: documents.map((document) => ({
      id: document.id,
      slug: document.slug,
      title: document.title,
      classification: document.classification,
      source: document.source,
      counts: {
        headings: document.structure.headings.length,
        formulas: document.formulas.length,
        claims: document.claims.length,
        codeBlocks: document.structure.codeBlocks.length,
        simulations: document.simulations.length,
        diagnostics: document.diagnostics.length,
      },
      dataUrl: `/data/generated/earth/documents/${document.slug}.json`,
    })),
  };
  const ledger = (kind, items) => ({ ...envelope, kind, count: items.length, items });
  const shards = documents.map((document) => ({
    slug: document.slug,
    artifact: {
      ...envelope,
      document: {
        id: document.id,
        slug: document.slug,
        title: document.title,
        classification: document.classification,
        source: document.source,
        structure: document.structure,
        diagnostics: document.diagnostics,
        sanitizedMarkdown: document.sanitizedMarkdown,
      },
    },
  }));
  return {
    manifest,
    formulas: ledger("formula-inventory", formulas),
    claims: ledger("claim-candidates", claims),
    code: ledger("inert-code-inventory", codeBlocks),
    simulations: ledger("simulation-candidates", simulations),
    shards,
  };
}
