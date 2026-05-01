import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceBuilding } from "@/lib/pricing/engine";
import type { BuildingConfig } from "@/lib/pricing/types";
import type { PSBPricingMatrices } from "@/types/pricing";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { role, profileId } = session.user;
  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  let query = supabase
    .from("psb_quotes")
    .select(
      "id, quote_number, status, customer_name, customer_state, subtotal, total, balance_due, created_at, updated_at, region_id, created_by"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (role === "sales_rep" || role === "viewer") {
    query = query.eq("created_by", profileId);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (search) {
    const s = search.replace(/[%_\\(),."']/g, "");
    if (s) {
      query = query.or(`quote_number.ilike.%${s}%,customer_name.ilike.%${s}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Quotes list error:", error.message);
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 });
  }
  return NextResponse.json({ quotes: data });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    regionId,
    config,
    customer,
    customerId,
    notes,
  } = body as {
    regionId: string;
    config: BuildingConfig;
    customer?: {
      name?: string; email?: string; phone?: string;
      address?: string; city?: string; state?: string; zip?: string;
    };
    customerId?: string;
    notes?: string;
  };

  if (!regionId || !config) {
    return NextResponse.json({ error: "regionId and config are required" }, { status: 400 });
  }
  if (!UUID_RE.test(regionId)) {
    return NextResponse.json({ error: "Invalid region ID" }, { status: 400 });
  }

  // Bound checks
  if (typeof config.width !== "number" || config.width < 12 || config.width > 60) {
    return NextResponse.json({ error: "Invalid width" }, { status: 400 });
  }
  if (typeof config.length !== "number" || config.length < 20 || config.length > 200) {
    return NextResponse.json({ error: "Invalid length" }, { status: 400 });
  }
  if (typeof config.height !== "number" || config.height < 6 || config.height > 20) {
    return NextResponse.json({ error: "Invalid height" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch current pricing snapshot
  const { data: pricingRow } = await supabase
    .from("psb_pricing_data")
    .select("id, matrices")
    .eq("region_id", regionId)
    .eq("is_current", true)
    .single();

  if (!pricingRow) {
    return NextResponse.json({ error: "No pricing data for this region" }, { status: 400 });
  }

  // Server-side recompute
  let result: ReturnType<typeof priceBuilding>;
  try {
    result = priceBuilding(config, pricingRow.matrices as PSBPricingMatrices);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Quote pricing error:", msg);
    return NextResponse.json({ error: `Pricing failed: ${msg}` }, { status: 500 });
  }

  // Generate quote number
  const profileId = session.user.profileId;
  const validUuid = profileId && UUID_RE.test(profileId) ? profileId : null;

  const { data: quoteNum, error: qnErr } = await supabase.rpc("next_psb_quote_number");
  if (qnErr) {
    return NextResponse.json({ error: "Failed to generate quote number" }, { status: 500 });
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  // Resolve customer
  let resolvedCustomerId: string | null = customerId || null;
  let customerSnapshot = customer ?? {};

  if (resolvedCustomerId) {
    const { data: cust } = await supabase
      .from("psb_customers")
      .select("name, email, phone, address, city, state, zip")
      .eq("id", resolvedCustomerId)
      .single();
    if (cust) customerSnapshot = cust;
  } else if (customer?.name) {
    const { data: newCust, error: custErr } = await supabase
      .from("psb_customers")
      .insert({
        name: customer.name,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        address: customer.address ?? null,
        city: customer.city ?? null,
        state: customer.state ?? null,
        zip: customer.zip ?? null,
        created_by: validUuid,
      })
      .select("id")
      .single();
    if (custErr) console.error("Auto-create customer error:", custErr.message);
    if (newCust) resolvedCustomerId = newCust.id;
  }

  const { data: quote, error: insertError } = await supabase
    .from("psb_quotes")
    .insert({
      quote_number: quoteNum,
      region_id: regionId,
      pricing_data_id: pricingRow.id,
      customer_id: resolvedCustomerId,
      created_by: validUuid,
      status: "draft",
      customer_name: customerSnapshot.name ?? null,
      customer_email: customerSnapshot.email ?? null,
      customer_phone: customerSnapshot.phone ?? null,
      customer_address: customerSnapshot.address ?? null,
      customer_city: customerSnapshot.city ?? null,
      customer_state: customerSnapshot.state ?? null,
      customer_zip: customerSnapshot.zip ?? null,
      config,
      pricing: result,
      subtotal: result.totals.subtotal,
      tax_rate: config.taxPct ?? 0.07,
      tax_amount: result.totals.taxAmount,
      deposit_pct: config.depositPct ?? 0.10,
      deposit_amount: result.totals.depositAmount,
      total: result.totals.total,
      promo_tier: config.promoTier ?? null,
      notes: notes ?? null,
      valid_until: validUntil.toISOString().slice(0, 10),
    })
    .select("id, quote_number")
    .single();

  if (insertError || !quote) {
    console.error("Quote insert error:", insertError?.message);
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }

  return NextResponse.json({ quote });
}
