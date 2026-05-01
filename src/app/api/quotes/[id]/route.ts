import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_PATCH_FIELDS = [
  "status",
  "customer_name", "customer_email", "customer_phone",
  "customer_address", "customer_city", "customer_state", "customer_zip",
  "customer_id", "notes", "valid_until",
];

const VALID_STATUS = ["draft", "sent", "accepted", "rejected", "cancelled", "expired"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { role, profileId } = session.user;
  if ((role === "sales_rep" || role === "viewer") && data.created_by !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ quote: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("psb_quotes")
    .select("id, created_by")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { role, profileId } = session.user;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "sales_rep" && existing.created_by !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const update: Record<string, unknown> = {};
  for (const f of ALLOWED_PATCH_FIELDS) {
    if (f in body) update[f] = body[f];
  }
  if (update.status && !VALID_STATUS.includes(update.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (update.status === "sent") {
    update.sent_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("psb_quotes")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Quote update error:", error.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ quote: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("psb_quotes")
    .select("id, created_by")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, profileId } = session.user;
  if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "sales_rep" && existing.created_by !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("psb_quotes").delete().eq("id", id);
  if (error) {
    console.error("Quote delete error:", error.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
