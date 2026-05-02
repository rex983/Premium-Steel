import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdf } from "@/lib/pdf/quote-pdf";
import type { EngineOutput } from "@/lib/pricing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PreviewBody {
  result: EngineOutput;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  let body: PreviewBody;
  try {
    body = (await req.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.result?.totals || !body?.result?.lineItems) {
    return NextResponse.json({ error: "Missing pricing result" }, { status: 400 });
  }

  const c = body.customer ?? {};
  const buffer = await renderToBuffer(
    QuotePdf({
      quoteNumber: "PREVIEW",
      status: "draft",
      customer: {
        name: c.name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        zip: c.zip ?? null,
      },
      result: body.result,
      validUntil: null,
      notes: body.notes ?? null,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="quote-preview.pdf"',
    },
  });
}
