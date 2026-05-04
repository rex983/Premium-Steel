import XLSX from "xlsx";
import fs from "node:fs";

const file = process.argv[2] || "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx";
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { cellFormula: true, cellStyles: false });

const ends = wb.Sheets["Pricing - Ends"];
const sides = wb.Sheets["Pricing - Sides"];
const acc = wb.Sheets["Pricing - Accessories"];
const base = wb.Sheets["Pricing - Base"];

console.log("=== Pricing - Ends!V21:V22 (wainscot dropdown) ===");
for (let r = 18; r <= 25; r++) {
  for (const c of ["U","V","W","X"]) {
    const cell = ends[`${c}${r}`];
    if (cell?.v !== undefined) console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
  }
}

console.log("\n=== Pricing - Ends!E41 (wainscot end final) + surrounding A29:F45 ===");
for (let r = 29; r <= 45; r++) {
  const line = [];
  for (const c of ["A","B","C","D","E","F"]) {
    const cell = ends[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      line.push(`${c}${r}=${JSON.stringify(cell.v)}${cell.f ? `[=${cell.f}]` : ""}`);
    }
  }
  if (line.length) console.log(`R${r}:`, line.join(" | "));
}

console.log("\n=== Pricing - Sides!F41 (wainscot side final) + surrounding A29:G45 ===");
for (let r = 29; r <= 45; r++) {
  const line = [];
  for (const c of ["A","B","C","D","E","F","G"]) {
    const cell = sides[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      line.push(`${c}${r}=${JSON.stringify(cell.v)}${cell.f ? `[=${cell.f}]` : ""}`);
    }
  }
  if (line.length) console.log(`R${r}:`, line.join(" | "));
}

console.log("\n=== Pricing - Base!I15, J15, K15, L15, M15 (base trim perimeter calc) ===");
for (let r = 14; r <= 18; r++) {
  for (let col = 0; col < 17; col++) {
    const c = XLSX.utils.encode_col(col);
    const cell = base[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
    }
  }
}

console.log("\n=== Pricing - Accessories full range L15:M19 (base trim perimeter inputs) ===");
for (let r = 14; r <= 22; r++) {
  for (const c of ["L","M","N","O"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
    }
  }
}

console.log("\n=== Quote sheet G40, G41, G42 (wainscot/basetrim user input) ===");
const q = wb.Sheets["PSB-Quote Sheet"];
for (let r = 40; r <= 42; r++) {
  for (const c of ["F","G","H","I","J","K","L","M","N","O","P"]) {
    const cell = q[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
    }
  }
}
