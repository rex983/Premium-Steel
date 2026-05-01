"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, STATUS_COLORS } from "@/lib/utils";
import { Plus } from "lucide-react";

interface QuoteRow {
  id: string;
  quote_number: string;
  status: string;
  customer_name: string | null;
  customer_state: string | null;
  total: number;
  balance_due: number;
  created_at: string;
}

const STATUSES = ["all", "draft", "sent", "accepted", "rejected", "cancelled", "expired"] as const;

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    const url = `/api/quotes?${params}`;
    const res = await fetch(url).then((r) => r.json());
    setQuotes(res.quotes ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [search, status]);

  return (
    <>
      <AppHeader title="Quotes" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex gap-2 flex-1">
              <Input
                className="max-w-sm"
                placeholder="Search by quote # or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Link href="/calculator">
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Quote</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : quotes.length === 0 ? (
              <div className="text-sm text-muted-foreground">No quotes yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/quotes/${q.id}`} className="font-mono font-medium hover:underline">
                          {q.quote_number}
                        </Link>
                      </TableCell>
                      <TableCell>{q.customer_name ?? "—"}</TableCell>
                      <TableCell>{q.customer_state ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[q.status] ?? "secondary"}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(q.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(q.balance_due)}
                      </TableCell>
                      <TableCell>{formatDate(q.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
