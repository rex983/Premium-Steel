"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useRegions } from "@/hooks/use-regions";
import { SNOW_LOAD_OPTIONS } from "@/lib/pricing/constants";

interface StateDefault {
  state_code: string;
  region_id: string | null;
  default_snow_load: string;
  default_wind_mph: number;
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
      <AppHeader title="State Defaults" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              When a state is selected in the Calculator, these values auto-populate the
              snow load and wind MPH. Users can still override them per quote.
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
                    <TableHead>Default Snow Load</TableHead>
                    <TableHead>Default Wind (MPH)</TableHead>
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
                      <TableCell>
                        <Select
                          value={r.default_snow_load}
                          onValueChange={(v) => update(r.state_code, { default_snow_load: v })}
                          disabled={savingCode === r.state_code}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SNOW_LOAD_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <WindInput
                          value={r.default_wind_mph}
                          onCommit={(n) => update(r.state_code, { default_wind_mph: n })}
                          saving={savingCode === r.state_code}
                        />
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

function WindInput({ value, onCommit, saving }: { value: number; onCommit: (n: number) => void; saving: boolean }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        className="w-24"
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={saving}
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={saving || v === String(value)}
        onClick={() => onCommit(Number(v))}
      >
        Save
      </Button>
    </div>
  );
}
