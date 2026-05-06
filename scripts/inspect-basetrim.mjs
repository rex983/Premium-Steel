import XLSX from "xlsx";
import fs from "node:fs";

for (const file of [
  "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx",
  "C:/Users/Redir/Downloads/MI WI PA MN 1_26_26.xlsx",
]) {
  console.log(`\n============================================================`);
  console.log(`FILE: ${file.split("/").pop()}`);
  console.log(`============================================================`);
  const buf = fs.readFileSync(file);
  const wb = XLSX.read(buf, { cellFormula: true, cellStyles: false });
  const acc = wb.Sheets["Pricing - Accessories"];

  console.log("\nFull H/I/J/K cells rows 14..22 (base trim):");
  for (let r = 14; r <= 22; r++) {
    for (const c of ["G","H","I","J","K","L","M"]) {
      const cell = acc[`${c}${r}`];
      if (cell?.v !== undefined || cell?.f) {
        console.log(`  ${c}${r}=${JSON.stringify(cell?.v)} (f=${cell?.f ?? ""})`);
      }
    }
  }

  console.log("\nQuote sheet G42 (base trim user picker):");
  const q = wb.Sheets["PSB-Quote Sheet"];
  for (const c of ["F","G","H","I","J","K","L"]) {
    const cell = q[`${c}42`];
    if (cell?.v !== undefined || cell?.f) {
      console.log(`  ${c}42=${JSON.stringify(cell?.v)} (f=${cell?.f ?? ""})`);
    }
  }

  // Defined names referencing base trim
  console.log("\nDefined names with bt/baset/trim:");
  if (wb.Workbook?.Names) {
    for (const n of wb.Workbook.Names) {
      if (/(?:bt$|baset|basetrim|^trim$)/i.test(n.Name)) {
        console.log(`  ${n.Name} = ${n.Ref}`);
      }
    }
  }

  // Confirm rate G16, G19 etc.
  console.log("\nRates G15..G19:");
  for (let r = 15; r <= 19; r++) {
    const cell = acc[`G${r}`];
    if (cell?.v !== undefined) console.log(`  G${r}=${JSON.stringify(cell.v)}`);
  }
}
