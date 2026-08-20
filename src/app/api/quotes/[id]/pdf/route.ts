import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActiveIdentity } from "@/lib/session/active-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuotePdf } from "@/lib/pdf/quote-pdf";
import { canAccessRegion } from "@/lib/region-access";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = await getActiveIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: quote, error } = await supabase
    .from("psb_quotes")
    .select(
      "quote_number, status, created_by, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_state, customer_zip, pricing, valid_until, notes, region:psb_regions(offices)"
    )
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { role, profileId, office } = identity;
  const regionOffices = (quote.region as { offices?: string[] } | null)?.offices;
  if (!canAccessRegion(role, office, regionOffices)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((role === "sales_rep" || role === "viewer") && quote.created_by !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    QuotePdf({
      quoteNumber: quote.quote_number,
      status: quote.status,
      customer: {
        name: quote.customer_name,
        email: quote.customer_email,
        phone: quote.customer_phone,
        address: quote.customer_address,
        city: quote.customer_city,
        state: quote.customer_state,
        zip: quote.customer_zip,
      },
      result: quote.pricing,
      validUntil: quote.valid_until,
      notes: quote.notes,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
    },
  });
}
