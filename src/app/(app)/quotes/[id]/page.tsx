"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Trash2, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate, STATUS_COLORS } from "@/lib/utils";
import type { EngineOutput } from "@/lib/pricing/types";

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  region_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_zip: string | null;
  config: Record<string, unknown>;
  pricing: EngineOutput;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  deposit_pct: number;
  deposit_amount: number;
  total: number;
  balance_due: number;
  promo_tier: string | null;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

const STATUSES = ["draft", "sent", "accepted", "rejected", "cancelled", "expired"];

export default function QuoteDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/quotes/${id}`).then((r) => r.json());
    if (res.error) setError(res.error);
    else setQuote(res.quote);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
    else alert("Failed to update status");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/quotes");
    else alert("Failed to delete quote");
  };

  if (loading) {
    return (
      <>
        <AppHeader title="Quote" />
        <main className="flex-1 p-6"><div className="text-sm text-muted-foreground">Loading…</div></main>
      </>
    );
  }
  if (error || !quote) {
    return (
      <>
        <AppHeader title="Quote" />
        <main className="flex-1 p-6"><div className="text-sm text-destructive">{error ?? "Not found"}</div></main>
      </>
    );
  }

  const result = quote.pricing;

  return (
    <>
      <AppHeader title={quote.quote_number} />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/quotes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
          </Link>
          <Badge variant={STATUS_COLORS[quote.status] ?? "secondary"}>{quote.status}</Badge>
          <div className="ml-auto flex gap-2">
            <Select value={quote.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />PDF
              </Button>
            </a>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold">Customer</h3></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>{quote.customer_name ?? "—"}</div>
                <div className="text-muted-foreground">{quote.customer_email}</div>
                <div className="text-muted-foreground">{quote.customer_phone}</div>
                <div className="text-muted-foreground">
                  {[quote.customer_address, quote.customer_city, quote.customer_state, quote.customer_zip]
                    .filter(Boolean).join(", ")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold">Line Items</h3></CardHeader>
              <CardContent className="text-sm space-y-1">
                {result.lineItems.map((li) => (
                  <div key={li.key} className="flex justify-between">
                    <span className="text-muted-foreground">{li.label}</span>
                    <span className="font-mono">{formatCurrency(li.price)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Engineering</span>
                  <span className="font-mono">{formatCurrency(result.engineeringBreakdown.totalEngineering)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold">Engineering Breakdown</h3></CardHeader>
              <CardContent className="text-sm">
                <Row label="Trusses" spacing={result.engineeringBreakdown.trussSpacing} extra={result.engineeringBreakdown.extraTrussesNeeded} price={result.engineeringBreakdown.trussPrice} />
                <Row label="Hat Channels" spacing={result.engineeringBreakdown.hatChannelSpacing} extra={result.engineeringBreakdown.extraChannelsNeeded} price={result.engineeringBreakdown.hatChannelPrice} />
                <Row label="Girts" spacing={result.engineeringBreakdown.girtSpacing} extra={result.engineeringBreakdown.extraGirtsNeeded} price={result.engineeringBreakdown.girtPrice} />
                <Row label="Verticals" spacing={result.engineeringBreakdown.verticalSpacing} extra={result.engineeringBreakdown.extraVerticalsNeeded} price={result.engineeringBreakdown.verticalPrice} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><h3 className="font-semibold">Totals</h3></CardHeader>
            <CardContent className="text-sm space-y-1">
              <Money label="Total Taxable Sale" value={result.totals.totalTaxableSale} />
              <Money label="Tax" value={result.totals.taxAmount} />
              <Money label="Subtotal" value={result.totals.subtotal} />
              <Money label="Equipment / Labor" value={result.totals.equipmentLabor} />
              <Money label="Additional Labor" value={result.totals.additionalLabor} />
              <Separator className="my-2" />
              <Money label="Total" value={result.totals.total} bold />
              <Money label="Deposit" value={result.totals.depositAmount} muted />
              <Money label="Balance Due" value={result.totals.balanceDue} bold />
              <Separator className="my-2" />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Reference only (not in balance)
              </p>
              <Money label="Plans Cost" value={result.totals.plansCost} muted />
              <Money label="Calcs Cost" value={result.totals.calcsCost} muted />
              <Separator className="my-2" />
              <div className="text-xs text-muted-foreground">
                Created {formatDate(quote.created_at)}<br />
                {quote.valid_until && `Valid until ${formatDate(quote.valid_until)}`}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function Money({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}

function Row({ label, spacing, extra, price }: { label: string; spacing: string; extra: number; price: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-1 border-b last:border-b-0">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{spacing}</div>
      <div className="text-muted-foreground">+{extra}</div>
      <div className="text-right font-mono">{formatCurrency(price)}</div>
    </div>
  );
}
