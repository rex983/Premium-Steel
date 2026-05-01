"use client";

import type { EngineOutput } from "@/lib/pricing/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

export function TotalsPanel({ result }: { result: EngineOutput }) {
  const t = result.totals;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold">Totals</h3>
        <p className="text-xs text-muted-foreground">Region: {result.region}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="space-y-1">
          {result.lineItems.map((li) => (
            <div key={li.key} className="flex justify-between">
              <span className="text-muted-foreground truncate pr-2">{li.label}</span>
              <span className="font-mono">{formatCurrency(li.price)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Engineering</span>
            <span className="font-mono">{formatCurrency(result.engineeringBreakdown.totalEngineering)}</span>
          </div>
          {t.promoDiscount !== 0 && (
            <div className="flex justify-between text-green-600">
              <span>Promo</span>
              <span className="font-mono">{formatCurrency(t.promoDiscount)}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="space-y-1">
          <Row label="Total Taxable Sale" value={t.totalTaxableSale} />
          <Row label="Tax" value={t.taxAmount} />
          <Row label="Subtotal" value={t.subtotal} />
          <Row label="Equipment / Labor" value={t.equipmentLabor} />
          <Row label="Additional Labor" value={t.additionalLabor} />
        </div>
        <Separator />
        <Row label="Total" value={t.total} bold />
        <div className="space-y-1 mt-2">
          <Row label="Deposit" value={t.depositAmount} muted />
          <Row label="Balance Due" value={t.balanceDue} bold />
        </div>
        <Separator />
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">
          Reference only (not in balance)
        </p>
        <Row label="Plans Cost" value={t.plansCost} muted />
        <Row label="Calcs Cost" value={t.calcsCost} muted />
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}
