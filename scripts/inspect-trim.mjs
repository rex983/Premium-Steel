import XLSX from "xlsx";
import fs from "node:fs";

const file = process.argv[2] || "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx";
const buf = fs.readFileSync(file);
const wb = XLSX.read(buf, { cellFormula: true, cellStyles: false });

const q = wb.Sheets["PSB-Quote Sheet"];
const acc = wb.Sheets["Pricing - Accessories"];

console.log("=== Quote sheet wainscot/basetrim/overhang INPUT cells (cols B-Q rows 38..47) ===");
for (let r = 38; r <= 47; r++) {
  for (const c of ["B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R"]) {
    const cell = q[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
    }
  }
}

console.log("\n=== Validation: data validation ranges in named cells (search for wainscot/baseTrim/overhang labels) ===");
// Look for any cell containing "Base Trim", "Wainscot", "Overhang" labels in the first 60 rows
for (const sn of wb.SheetNames) {
  const s = wb.Sheets[sn];
  const range = XLSX.utils.decode_range(s["!ref"] || "A1:A1");
  const maxR = Math.min(range.e.r, 80);
  const maxC = Math.min(range.e.c, 25);
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const v = s[addr]?.v;
      if (typeof v === "string" && /(?:Base Trim|wainscot|overhang)/i.test(v) && !/\?/.test(v)) {
        console.log(`  ${sn}!${addr} = ${JSON.stringify(v)}`);
      }
    }
  }
}

console.log("\n=== Pricing - Accessories!H16:I20 (base trim options) ===");
for (let r = 14; r <= 22; r++) {
  for (const c of ["G","H","I","J","K"]) {
    const cell = acc[`${c}${r}`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}${r}=${JSON.stringify(cell.v)} (f=${cell.f ?? ""})`);
    }
  }
}

// Look at named ranges
console.log("\n=== Defined names ===");
if (wb.Workbook?.Names) {
  for (const n of wb.Workbook.Names) {
    if (/wain|basetrim|trim|overh/i.test(n.Name)) {
      console.log(`  ${n.Name} = ${n.Ref}`);
    }
  }
}
