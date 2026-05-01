"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: string;
  actor_email: string | null;
  entity: string | null;
  entity_id: string | null;
  action: string;
  diff: Record<string, unknown> | null;
  created_at: string;
}

const ENTITY_FILTERS = ["all", "psb_regions", "psb_state_defaults", "psb_pricing_data", "psb_config"];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entity, setEntity] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const url = entity === "all" ? "/api/admin/audit-log" : `/api/admin/audit-log?entity=${entity}`;
    const res = await fetch(url).then((r) => r.json());
    setEntries(res.entries ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity]);

  return (
    <>
      <AppHeader title="Audit Log" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">
              History of admin actions. Latest 200 entries.
            </p>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_FILTERS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{e.actor_email ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{e.entity ?? "—"}</TableCell>
                      <TableCell>
                        <pre className="text-[10px] max-w-md overflow-x-auto bg-muted/30 p-1 rounded">
                          {e.diff ? JSON.stringify(e.diff, null, 0) : "—"}
                        </pre>
                      </TableCell>
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
