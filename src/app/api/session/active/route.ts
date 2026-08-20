import { NextResponse } from "next/server";
import { getActiveIdentity } from "@/lib/session/active-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getActiveIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(identity);
}
