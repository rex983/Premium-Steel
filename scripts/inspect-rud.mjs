import XLSX from "xlsx";
import fs from "node:fs";

const file = process.argv[2] || "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx";
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { cellFormula: true, cellStyles: false });

const acc = wb.Sheets["Pricing - Accessories"];
const q = wb.Sheets["PSB-Quote Sheet"];

console.log("=== WID rows L12, L13 (walk-in doors total) ===");
for (let r = 12; r <= 13; r++) {
  for (const c of ["G","H","I","J","K","L","M"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined) console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
  }
}

console.log("\n=== Window rows D18, D19 ===");
for (let r = 18; r <= 19; r++) {
  for (const c of ["A","B","C","D","E"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined) console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
  }
}

console.log("\n=== WID lookup H2:I11 ===");
for (let r = 2; r <= 11; r++) {
  for (const c of ["H","I"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined) console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
  }
}

console.log("\n=== Windows lookup A2:B10 ===");
for (let r = 2; r <= 10; r++) {
  for (const c of ["A","B"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined) console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
  }
}

console.log("\n=== Quote sheet walk-in / window rows (29-32) ===");
for (let r = 29; r <= 32; r++) {
  const line = [];
  for (const c of ["F","G","H","I","J","K","L","M","N","O","P","Q","R"]) {
    const cell = q[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      line.push(`${c}${r}=${JSON.stringify(cell.v)}${cell.f ? `[=${cell.f}]` : ""}`);
    }
  }
  console.log(`R${r}:`, line.join(" | "));
}
