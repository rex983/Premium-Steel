import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const requested = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIMIT,
  );

  const supabase = createAdminClient();

  const { data: uploads, error } = await supabase
    .from("psb_uploads")
    .select("id, region_id, uploaded_by, filename, sheet_count, status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const regionIds = Array.from(new Set((uploads ?? []).map((u) => u.region_id).filter(Boolean)));
  const uploaderIds = Array.from(new Set((uploads ?? []).map((u) => u.uploaded_by).filter(Boolean)));

  const [{ data: regions }, { data: profiles }] = await Promise.all([
    regionIds.length
      ? supabase.from("psb_regions").select("id, name").in("id", regionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    uploaderIds.length
      ? supabase.from("profiles").select("id, name:full_name, email").in("id", uploaderIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
  ]);

  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.name ?? p.email ?? "Unknown"] as const),
  );

  const rows = (uploads ?? []).map((u) => ({
    id: u.id,
    regionId: u.region_id,
    regionName: regionMap.get(u.region_id) ?? "Unknown region",
    uploader: u.uploaded_by ? profileMap.get(u.uploaded_by) ?? "Unknown user" : null,
    filename: u.filename,
    sheetCount: u.sheet_count,
    status: u.status,
    errorMessage: u.error_message,
    createdAt: u.created_at,
  }));

  return NextResponse.json({ uploads: rows });
}
