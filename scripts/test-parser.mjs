#!/usr/bin/env node
/**
 * Run the PSB parser against the two real workbooks and dump JSON snapshots.
 *
 * Usage:
 *   node scripts/test-parser.mjs
 *
 * Outputs:
 *   scripts/parsed/south.json
 *   scripts/parsed/north.json
 *   scripts/parsed/_summary.txt
 *
 * Note: this file uses a small inline registration step so it can `import` from
 * the TypeScript src tree. It uses `tsx` if installed; otherwise it falls back
 * to a pre-built esbuild step.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(__dirname, "parsed");

const FILES = {
  south: "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx",
  north: "C:/Users/Redir/Downloads/MI WI PA MN 1_26_26.xlsx",
};

async function main() {
  // Lazy-import the parser so this script can run via `tsx scripts/test-parser.mjs`
  // or via a transpile step. We try the transpiled location first, then tsx.
  let parsePsbWorkbook;
  try {
    // Try transpiled (after `npm run build` runs Next's bundler — not for scripts).
    // Fallback to direct tsx.
    const mod = await import("../.next/server/chunks/parser.js").catch(() => null);
    if (mod?.parsePsbWorkbook) {
      parsePsbWorkbook = mod.parsePsbWorkbook;
    }
  } catch {}

  if (!parsePsbWorkbook) {
    // Use tsx via dynamic import of the .ts source.
    // pathToFileURL is required on Windows so the `c:` drive scheme is converted
    // to a `file://` URL that the ESM loader accepts.
    const parserPath = pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href;
    const mod = await import(parserPath);
    parsePsbWorkbook = mod.parsePsbWorkbook;
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const lines = [];
  lines.push(`PSB Parser test — ${new Date().toISOString()}`);
  lines.push("");

  for (const [label, path] of Object.entries(FILES)) {
    if (!existsSync(path)) {
      lines.push(`[${label}] FILE NOT FOUND: ${path}`);
      continue;
    }
    const buf = readFileSync(path);
    const result = parsePsbWorkbook(buf, path.split(/[\\/]/).pop());
    const outPath = resolve(outDir, `${label}.json`);
    writeFileSync(outPath, JSON.stringify(result.matrices, null, 2));

    lines.push(`[${label}]`);
    lines.push(`  detection: region=${result.detection.region} confidence=${result.detection.confidence}`);
    lines.push(`  reasons: ${result.detection.reasons.join(" | ")}`);
    lines.push(`  states: ${result.detection.states.join(", ")}`);
    lines.push(`  validation: ok=${result.validation.ok}`);
    if (result.validation.errors.length) {
      lines.push(`  ERRORS:`);
      for (const e of result.validation.errors) lines.push(`    - ${e}`);
    }
    if (result.validation.warnings.length) {
      lines.push(`  warnings:`);
      for (const w of result.validation.warnings) lines.push(`    - ${w}`);
    }
    lines.push(`  stats:`);
    for (const [k, v] of Object.entries(result.validation.stats)) {
      lines.push(`    ${k}: ${v}`);
    }
    lines.push("");
  }

  const summary = lines.join("\n");
  writeFileSync(resolve(outDir, "_summary.txt"), summary);
  console.log(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
