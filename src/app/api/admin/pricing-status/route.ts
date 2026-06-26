import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { PARSER_VERSION } from "@/lib/excel/parser";

export const dynamic = "force-dynamic";

/**
 * Per-region parser version of the currently-active pricing data, with a stale
 * flag (true when the stored version is below the running code's PARSER_VERSION).
 *
 * Stale matrices silently lose any field added by a newer parser — e.g. the
 * roll-up door SIDE adder was introduced in 0.2.1 and old uploads have
 * rudSidePositionAdders undefined, so SIDE doors price without the $280 fee.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();

  const [{ data: regions }, { data: pricing }] = await Promise.all([
    supabase.from("psb_regions").select("id, name").eq("is_active", true).order("name"),
    supabase.from("psb_pricing_data")
      .select("region_id, version, matrices, created_at")
      .eq("is_current", true),
  ]);

  const byRegion: Record<string, { version: number; parserVersion: string | null; uploadedAt: string }> = {};
  for (const p of pricing ?? []) {
    const m = p.matrices as { parserVersion?: string } | null;
    byRegion[p.region_id] = {
      version: p.version,
      parserVersion: m?.parserVersion ?? null,
      uploadedAt: p.created_at,
    };
  }

  const rows = (regions ?? []).map((r) => {
    const info = byRegion[r.id];
    return {
      regionId: r.id,
      regionName: r.name,
      version: info?.version ?? null,
      parserVersion: info?.parserVersion ?? null,
      uploadedAt: info?.uploadedAt ?? null,
      stale: info ? isStale(info.parserVersion, PARSER_VERSION) : false,
    };
  });

  return NextResponse.json({
    currentParserVersion: PARSER_VERSION,
    regions: rows,
  });
}

function isStale(stored: string | null, current: string): boolean {
  if (!stored) return true;
  return cmp(stored, current) < 0;
}

function cmp(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
