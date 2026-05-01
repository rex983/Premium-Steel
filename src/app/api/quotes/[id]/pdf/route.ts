import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuotePdf } from "@/lib/pdf/quote-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { data: quote, error } = await supabase
    .from("psb_quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { role, profileId } = session.user;
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
