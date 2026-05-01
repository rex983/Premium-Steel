"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : "/api/customers";
    const res = await fetch(url).then((r) => r.json());
    setCustomers(res.customers ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [search]);

  return (
    <>
      <AppHeader title="Customers" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <Input
              className="max-w-sm"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <NewCustomerDialog open={open} setOpen={setOpen} onCreated={load} />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : customers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No customers yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City / State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell>
                        {[c.city, c.state].filter(Boolean).join(", ")}
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

function NewCustomerDialog({
  open, setOpen, onCreated,
}: { open: boolean; setOpen: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setForm({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" });
      onCreated();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to create customer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />New Customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <FormRow label="Name *" name="name" form={form} setForm={setForm} required />
          <FormRow label="Email" name="email" form={form} setForm={setForm} type="email" />
          <FormRow label="Phone" name="phone" form={form} setForm={setForm} />
          <FormRow label="Address" name="address" form={form} setForm={setForm} />
          <FormRow label="City" name="city" form={form} setForm={setForm} />
          <FormRow label="State" name="state" form={form} setForm={setForm} />
          <FormRow label="Zip" name="zip" form={form} setForm={setForm} />
          <DialogFooter className="col-span-2 gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormRow<T extends Record<string, string>>({
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
        type={type}
        required={required}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </div>
  );
}
