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
import { useRegions } from "@/hooks/use-regions";

interface StateDefault {
  state_code: string;
  region_id: string | null;
}

const STATE_LABEL: Record<string, string> = {
  IN: "Indiana", OH: "Ohio", IL: "Illinois", KY: "Kentucky", TN: "Tennessee",
  MO: "Missouri", WV: "West Virginia",
  MI: "Michigan", WI: "Wisconsin", PA: "Pennsylvania", MN: "Minnesota",
};

export default function StateDefaultsPage() {
  const [rows, setRows] = useState<StateDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const { regions } = useRegions();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/state-defaults").then((r) => r.json());
    setRows(res.stateDefaults ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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

  return (
    <>
      <AppHeader title="State → Region" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              Maps each state to a pricing region. Picking a state in the
              Calculator auto-selects that region. Snow load and wind MPH are
              not auto-populated — the spreadsheet treats them as independent
              inputs, so the user picks them per quote.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.state_code}>
                      <TableCell className="font-medium">
                        {STATE_LABEL[r.state_code] ?? r.state_code} ({r.state_code})
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.region_id ?? ""}
                          onValueChange={(v) => update(r.state_code, { region_id: v })}
                          disabled={savingCode === r.state_code}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions.map((reg) => (
                              <SelectItem key={reg.id} value={reg.id}>{reg.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
