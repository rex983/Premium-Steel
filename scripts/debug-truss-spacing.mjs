#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function main() {
  const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
  const buf = readFileSync("C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx");
  const parsed = parserMod.parsePsbWorkbook(buf, "south.xlsx");
  const ts = parsed.matrices.snow.trussSpacing;
  const ch = parsed.matrices.snow.changers;

  console.log("rowKeys count:", ts.rowKeys.length);
  console.log("first 5 rowKeys:", ts.rowKeys.slice(0, 5));
  console.log("colKeys count:", ts.colKeys.length);
  console.log("first 5 colKeys:", ts.colKeys.slice(0, 5));
  console.log("looking for E-105-30-AFV — found at index:", ts.colKeys.indexOf("E-105-30-AFV"));
  console.log("looking for T-30GL — found at index:", ts.rowKeys.indexOf("T-30GL"));

  const rowIdx = ts.rowKeys.indexOf("T-30GL");
  const colIdx = ts.colKeys.indexOf("E-105-30-AFV");
  console.log(`spacingTable[${rowIdx}][${colIdx}] = ${ts.spacingTable[rowIdx]?.[colIdx]}`);

  // also check legHeightSymbol for 15
  console.log("legHeightSymbol[15] =", ch.legHeightSymbol[15]);
  console.log("legHeightTubingFeet[15] =", ch.legHeightTubingFeet[15]);
  console.log("trussWidthBucket[30] =", ch.trussWidthBucket[30]);
  console.log("hcWidthBucket[30] =", ch.hcWidthBucket[30]);
  console.log("snowLoadNameToCode['30 Ground Load'] =", ch.snowLoadNameToCode["30 Ground Load"]);
  console.log("snowLoadNameToCode['60 Ground Load'] =", ch.snowLoadNameToCode["60 Ground Load"]);
  console.log("legHeightAdjust[30]['30GL'] =", ch.legHeightAdjust[30]?.["30GL"]);
  console.log("legHeightAdjust[30]['60GL'] =", ch.legHeightAdjust[30]?.["60GL"]);
  console.log("byStateName['Indiana'].code =", ch.byStateName["Indiana"]?.code);
  console.log("byStateName['Indiana'].trussPriceByWidth[30] =", ch.byStateName["Indiana"]?.trussPriceByWidth[30]);
}
main().catch((err) => { console.error(err); process.exit(1); });
