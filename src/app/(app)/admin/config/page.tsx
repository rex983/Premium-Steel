"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PSBConfig {
  id: string;
  deposit_default_pct: number;
  tax_default_pct: number;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  updated_at: string;
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<PSBConfig | null>(null);
  const [form, setForm] = useState({
    deposit: "0.10", tax: "0.07",
    phone: "", email: "", address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/config").then((r) => r.json());
    if (res.config) {
      setCfg(res.config);
      setForm({
        deposit: String(res.config.deposit_default_pct),
        tax: String(res.config.tax_default_pct),
        phone: res.config.contact_phone ?? "",
        email: res.config.contact_email ?? "",
        address: res.config.contact_address ?? "",
      });
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deposit_default_pct: Number(form.deposit),
        tax_default_pct: Number(form.tax),
        contact_phone: form.phone,
        contact_email: form.email,
        contact_address: form.address,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Saved.");
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Save failed");
    }
  };

  return (
    <>
      <AppHeader title="Config" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              Manufacturer-level defaults applied to every new quote.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Default Deposit % (0.0–1.0)</Label>
                    <Input
                      type="number" step="0.01" min="0" max="1"
                      value={form.deposit}
                      onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Default Tax % (0.0–0.5)</Label>
                    <Input
                      type="number" step="0.001" min="0" max="0.5"
                      value={form.tax}
                      onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact Email</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
                  {cfg && (
                    <span className="text-xs text-muted-foreground">
                      Last updated {new Date(cfg.updated_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
