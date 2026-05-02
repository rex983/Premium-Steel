import fs from "fs";
import path from "path";
import {
  Document, Page, View, Text, Image, StyleSheet,
} from "@react-pdf/renderer";
import type { EngineOutput } from "@/lib/pricing/types";

const logoDataUrl = (() => {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
})();

interface QuotePdfProps {
  quoteNumber: string;
  status: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  result: EngineOutput;
  validUntil: string | null;
  notes: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#222",
    paddingBottom: 8,
    marginBottom: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
  },
  brandLogo: { width: 130, height: 56, objectFit: "contain", marginBottom: 4 },
  brandTag: { fontSize: 9, color: "#555" },
  meta: { textAlign: "right", fontSize: 9 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    backgroundColor: "#eee",
    padding: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
    fontSize: 10,
  },
  bold: { fontWeight: "bold" },
  muted: { color: "#666" },
  table: {
    borderTopWidth: 1,
    borderColor: "#ccc",
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
    paddingVertical: 2,
  },
  tableCellLabel: { flex: 3 },
  tableCellRight: { flex: 1, textAlign: "right" },
  small: { fontSize: 8, color: "#666" },
  notes: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#fafafa",
    fontSize: 9,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 8,
    color: "#666",
    fontStyle: "italic",
  },
});

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function QuotePdf({ quoteNumber, status, customer, result, validUntil, notes }: QuotePdfProps) {
  const cfg = result.inputs;
  const t = result.totals;
  const e = result.engineeringBreakdown;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.brandLogo} />
            ) : (
              <Text style={styles.brand}>Premium Steel Buildings</Text>
            )}
            <Text style={styles.brandTag}>PO Box 24, Godley, TX 76044-9998</Text>
            <Text style={styles.brandTag}>844-387-7246 · orders@premiumsteelbuildings.com</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.bold}>{quoteNumber}</Text>
            <Text>Status: {status}</Text>
            {validUntil && <Text>Valid until: {validUntil}</Text>}
            <Text>Region: {result.region}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text>{customer.name ?? "—"}</Text>
          <Text style={styles.muted}>
            {[customer.email, customer.phone].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.muted}>
            {[customer.address, customer.city, customer.state, customer.zip]
              .filter(Boolean).join(", ")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Building</Text>
          <View style={styles.row}>
            <Text>Size</Text>
            <Text>{cfg.width}' × {cfg.length}' × {cfg.height}'</Text>
          </View>
          <View style={styles.row}>
            <Text>Roof Style / Gauge</Text>
            <Text>{cfg.roofStyle} · {cfg.gauge.toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text>Sides / Ends</Text>
            <Text>{cfg.sides} ({cfg.sidesPanel} ×{cfg.sidesQty}) · {cfg.ends} ({cfg.endsPanel} ×{cfg.endsQty})</Text>
          </View>
          <View style={styles.row}>
            <Text>Snow / Wind</Text>
            <Text>{cfg.snowLoad} · {cfg.windMph} MPH</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            {result.lineItems.map((li) => (
              <View key={li.key} style={styles.tableRow}>
                <Text style={styles.tableCellLabel}>{li.label}</Text>
                <Text style={styles.tableCellRight}>{fmt(li.price)}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, styles.bold]}>
              <Text style={styles.tableCellLabel}>Engineering</Text>
              <Text style={styles.tableCellRight}>{fmt(e.totalEngineering)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engineering Breakdown</Text>
          <BreakdownRow label="Trusses" spacing={e.trussSpacing} extra={e.extraTrussesNeeded} price={e.trussPrice} />
          <BreakdownRow label="Hat Channels" spacing={e.hatChannelSpacing} extra={e.extraChannelsNeeded} price={e.hatChannelPrice} />
          <BreakdownRow label="Girts" spacing={e.girtSpacing} extra={e.extraGirtsNeeded} price={e.girtPrice} />
          <BreakdownRow label="Verticals" spacing={e.verticalSpacing} extra={e.extraVerticalsNeeded} price={e.verticalPrice} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totals</Text>
          <View style={styles.totalsRow}><Text>Total Taxable Sale</Text><Text>{fmt(t.totalTaxableSale)}</Text></View>
          <View style={styles.totalsRow}><Text>Tax</Text><Text>{fmt(t.taxAmount)}</Text></View>
          <View style={styles.totalsRow}><Text>Subtotal</Text><Text>{fmt(t.subtotal)}</Text></View>
          <View style={styles.totalsRow}><Text>Equipment / Labor</Text><Text>{fmt(t.equipmentLabor)}</Text></View>
          <View style={styles.totalsRow}><Text>Additional Labor</Text><Text>{fmt(t.additionalLabor)}</Text></View>
          <View style={[styles.totalsRow, styles.bold]}><Text>Total</Text><Text>{fmt(t.total)}</Text></View>
          <View style={[styles.totalsRow, styles.muted]}><Text>Deposit</Text><Text>{fmt(t.depositAmount)}</Text></View>
          <View style={[styles.totalsRow, styles.bold]}><Text>Balance Due</Text><Text>{fmt(t.balanceDue)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.small}>Reference only (not in balance):</Text>
          <View style={[styles.totalsRow, styles.muted]}><Text>Plans Cost</Text><Text>{fmt(t.plansCost)}</Text></View>
          <View style={[styles.totalsRow, styles.muted]}><Text>Calcs Cost</Text><Text>{fmt(t.calcsCost)}</Text></View>
        </View>

        {notes && (
          <View style={styles.notes}>
            <Text style={styles.bold}>Notes:</Text>
            <Text>{notes}</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          *CUSTOMER IS RESPONSIBLE FOR PERMITS. The lot must be level within 3" and free
          of obstacles. Premium Steel Buildings is not responsible for leaks under base
          rails. If there is a price discrepancy over $25, Premium Steel Buildings Inc.
          reserves the right to cancel the order.
        </Text>
      </Page>
    </Document>
  );
}

function BreakdownRow({
  label, spacing, extra, price,
}: { label: string; spacing: string; extra: number; price: number }) {
  return (
    <View style={styles.tableRow}>
      <Text style={{ flex: 2 }}>{label}</Text>
      <Text style={{ flex: 1, ...styles.muted }}>{spacing}</Text>
      <Text style={{ flex: 1, ...styles.muted }}>+{extra}</Text>
      <Text style={styles.tableCellRight}>{fmt(price)}</Text>
    </View>
  );
}
