import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getLauncherOffices } from "@/lib/launcher/org";

export const dynamic = "force-dynamic";

// Offices are created and named in the BBD Launcher (launcher_offices).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;
  return NextResponse.json({ offices: await getLauncherOffices() });
}
