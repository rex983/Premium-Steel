"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { useRegions } from "@/hooks/use-regions";
import { STATE_NAMES, VALID_STATES } from "@/lib/us-states";

interface StateDefault {
  state_code: string;
  region_id: string | null;
}

const ALL_STATES = Array.from(VALID_STATES).sort();

export default function StateDefaultsPage() {
  const [rows, setRows] = useState<StateDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [addState, setAddState] = useState<string>("");
  const [addRegion, setAddRegion] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { regions } = useRegions();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/state-defaults").then((r) => r.json());
    setRows(res.stateDefaults ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const existing = useMemo(() => new Set(rows.map((r) => r.state_code)), [rows]);
  const available = useMemo(() => ALL_STATES.filter((c) => !existing.has(c)), [existing]);

  const update = async (code: string, patch: Partial<StateDefault>) => {
    setSavingCode(code);
    await fetch(`/api/admin/state-defaults/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingCode(null);
    load();
  };

  const handleAdd = async () => {
    if (!addState) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/admin/state-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state_code: addState,
        region_id: addRegion || undefined,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Add failed");
      return;
    }
    setAddState("");
    setAddRegion("");
    load();
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Remove ${STATE_NAMES[code] ?? code} (${code}) from the list?`)) return;
    setSavingCode(code);
    await fetch(`/api/admin/state-defaults/${code}`, { method: "DELETE" });
    setSavingCode(null);
    load();
  };

  return (
    <>
      <AppHeader title="State → Region" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              Maps each state to a pricing region. Picking a state in the
              Calculator auto-selects that region. Add states below to expand
              coverage, or remove states you no longer sell into.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 border rounded-md p-3 bg-muted/30">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">State</div>
                <Select value={addState} onValueChange={setAddState}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Pick a state to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c} value={c}>
                        {STATE_NAMES[c] ?? c} ({c})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Region (optional)</div>
                <Select value={addRegion} onValueChange={setAddRegion}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>{reg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!addState || adding} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {adding ? "Adding…" : "Add State"}
              </Button>
              {error && <p className="text-sm text-destructive w-full">{error}</p>}
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.state_code}>
                      <TableCell className="font-medium">
                        {STATE_NAMES[r.state_code] ?? r.state_code} ({r.state_code})
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.region_id ?? ""}
                          onValueChange={(v) => update(r.state_code, { region_id: v })}
                          disabled={savingCode === r.state_code}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions.map((reg) => (
                              <SelectItem key={reg.id} value={reg.id}>{reg.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r.state_code)}
                          disabled={savingCode === r.state_code}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
