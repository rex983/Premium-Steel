"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";
import type { BuildingConfig } from "@/lib/pricing/types";

export interface SaveQuoteDialogProps {
  regionId: string;
  config: BuildingConfig;
  defaultCustomerState?: string;
}

export function SaveQuoteDialog({ regionId, config, defaultCustomerState }: SaveQuoteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "",
    state: defaultCustomerState ?? "", zip: "", notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regionId,
        config,
        customer: {
          name: form.name, email: form.email, phone: form.phone,
          address: form.address, city: form.city, state: form.state, zip: form.zip,
        },
        notes: form.notes,
      }),
    });
    setSaving(false);
    const json = await res.json();
    if (res.ok && json.quote) {
      setOpen(false);
      router.push(`/quotes/${json.quote.id}`);
    } else {
      alert(json.error ?? "Failed to save quote");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FileText className="h-4 w-4 mr-1" />Save as Quote
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Quote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <Field label="Customer Name *" name="name" form={form} setForm={setForm} required />
          <Field label="Email" name="email" form={form} setForm={setForm} type="email" />
          <Field label="Phone" name="phone" form={form} setForm={setForm} />
          <Field label="Address" name="address" form={form} setForm={setForm} />
          <Field label="City" name="city" form={form} setForm={setForm} />
          <Field label="State" name="state" form={form} setForm={setForm} />
          <Field label="Zip" name="zip" form={form} setForm={setForm} />
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter className="col-span-2 gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field<T extends Record<string, string>>({
  label, name, form, setForm, type = "text", required = false,
}: {
  label: string; name: keyof T; form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;
  type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type} required={required}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </div>
  );
}
