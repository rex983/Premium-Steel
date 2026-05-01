import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const search = req.nextUrl.searchParams.get("search");

  let q = supabase
    .from("psb_customers")
    .select("id, name, email, phone, address, city, state, zip")
    .order("name");

  if (search) {
    const s = search.replace(/[%_\\(),."']/g, "");
    if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  const { data, error } = await q.limit(200);
  if (error) {
    console.error("Customer list error:", error.message);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
  return NextResponse.json({ customers: data });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, address, city, state, zip, notes } = body as Record<string, string>;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileId = session.user.profileId;
  const validUuid = profileId && UUID_RE.test(profileId) ? profileId : null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_customers")
    .insert({
      name, email: email || null, phone: phone || null,
      address: address || null, city: city || null, state: state || null, zip: zip || null,
      notes: notes || null,
      created_by: validUuid,
    })
    .select()
    .single();
  if (error) {
    console.error("Customer create error:", error.message);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
  return NextResponse.json({ customer: data });
}
