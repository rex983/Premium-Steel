"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Region {
  id: string;
  name: string;
  display_name: string | null;
  slug: string;
  states: string[];
  offices: string[];
  is_active: boolean;
  created_at: string;
  currentPricing: { version: number; uploadedAt: string } | null;
  lastUpload: { filename: string; uploadedAt: string } | null;
}

const OFFICE_OPTIONS: { value: string; label: string }[] = [
  { value: "Harbor", label: "Harbor" },
  { value: "Marion", label: "Marion" },
  { value: "BST", label: "BST" },
  { value: "RnD", label: "R&D" },
];

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Region | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/regions").then((r) => r.json());
    setRegions(res.regions ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (region: Region) => {
    await fetch(`/api/admin/regions/${region.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !region.is_active }),
    });
    load();
  };

  const handleDelete = async (region: Region) => {
    if (!confirm(`Delete region "${region.name}"? This will also delete all pricing data and uploads for this region.`)) return;
    await fetch(`/api/admin/regions/${region.id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <AppHeader title="Regions" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Each region has its own price book. Upload PSB workbooks under Admin → Upload Pricing.
            </p>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />New Region
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-2">
                {regions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between border rounded-md p-3 gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.name}</span>
                        {r.display_name?.trim() && (
                          <span className="text-xs text-muted-foreground">
                            (reps see: <span className="italic">{r.display_name}</span>)
                          </span>
                        )}
                        <Badge variant={r.is_active ? "default" : "secondary"}>
                          {r.is_active ? "active" : "inactive"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.states.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                        <span>Offices:</span>
                        {r.offices.length === 0 ? (
                          <span className="italic">admin-only</span>
                        ) : (
                          r.offices.map((o) => (
                            <Badge key={o} variant="secondary" className="text-[10px]">{o}</Badge>
                          ))
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.currentPricing
                          ? `v${r.currentPricing.version} active · uploaded ${formatDate(r.currentPricing.uploadedAt)}`
                          : "no pricing data uploaded yet"}
                        {r.lastUpload && ` · last file: ${r.lastUpload.filename}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => toggleActive(r)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <RegionDialog
        open={creating}
        setOpen={setCreating}
        onSaved={() => { setCreating(false); load(); }}
      />
      {editing && (
        <RegionDialog
          open={!!editing}
          setOpen={(v) => !v && setEditing(null)}
          region={editing}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function RegionDialog({
  open, setOpen, region, onSaved,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  region?: Region;
  onSaved: () => void;
}) {
  const [name, setName] = useState(region?.name ?? "");
  const [displayName, setDisplayName] = useState(region?.display_name ?? "");
  const [statesText, setStatesText] = useState((region?.states ?? []).join(", "));
  const [offices, setOffices] = useState<string[]>(region?.offices ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(region?.name ?? "");
    setDisplayName(region?.display_name ?? "");
    setStatesText((region?.states ?? []).join(", "));
    setOffices(region?.offices ?? []);
    setError(null);
  }, [region, open]);

  const toggleOffice = (value: string) => {
    setOffices((prev) =>
      prev.includes(value) ? prev.filter((o) => o !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const states = statesText.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const body = { name, display_name: displayName, states, offices };
    const url = region ? `/api/admin/regions/${region.id}` : "/api/admin/regions";
    const method = region ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{region ? "Edit Region" : "New Region"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Internal Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
            <p className="text-[11px] text-muted-foreground">
              Used for admin, uploads, and matching workbook to region. Not shown to sales reps.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Display Name (sales-rep facing)</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={name || "e.g. Zone A"}
            />
            <p className="text-[11px] text-muted-foreground">
              What reps see in the calculator region picker. Leave blank to use the internal name.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">States (2-letter codes, comma or space separated)</Label>
            <Input
              value={statesText}
              onChange={(e) => setStatesText(e.target.value)}
              placeholder="IN, OH, KY, IL, TN, MO, WV"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Offices that can view + use this region</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              {OFFICE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={offices.includes(opt.value)}
                    onChange={() => toggleOffice(opt.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave all unchecked to keep this region admin-only. Admins always see every region.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : region ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
