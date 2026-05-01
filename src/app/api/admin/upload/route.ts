import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePsbWorkbook } from "@/lib/excel/parser";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const regionId = form.get("regionId") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!regionId || !UUID_RE.test(regionId)) {
    return NextResponse.json({ error: "Invalid region ID" }, { status: 400 });
  }

  // size guard (5 MB plenty for these workbooks)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const profileId = guard.profileId;
  const validUuid = profileId && UUID_RE.test(profileId) ? profileId : null;

  // Fetch target region
  const { data: region, error: regError } = await supabase
    .from("psb_regions")
    .select("id, name, slug, states, is_active")
    .eq("id", regionId)
    .single();
  if (regError || !region) {
    return NextResponse.json({ error: "Region not found" }, { status: 404 });
  }

  // Insert upload record (status=processing)
  const { data: upload, error: uploadErr } = await supabase
    .from("psb_uploads")
    .insert({
      region_id: regionId,
      uploaded_by: validUuid,
      filename: file.name,
      status: "processing",
    })
    .select()
    .single();
  if (uploadErr || !upload) {
    return NextResponse.json({ error: "Failed to record upload" }, { status: 500 });
  }

  // Parse the workbook
  let parseResult: ReturnType<typeof parsePsbWorkbook>;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parseResult = parsePsbWorkbook(buffer, file.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("psb_uploads").update({
      status: "failed", error_message: `Parse failed: ${msg}`,
    }).eq("id", upload.id);
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 400 });
  }

  if (!parseResult.validation.ok) {
    const errs = parseResult.validation.errors.join("; ");
    await supabase.from("psb_uploads").update({
      status: "failed", error_message: `Validation failed: ${errs}`,
    }).eq("id", upload.id);
    return NextResponse.json({
      error: `Validation failed: ${errs}`,
      warnings: parseResult.validation.warnings,
    }, { status: 400 });
  }

  // Validate region match: filename states (or default-state-derived region) should
  // overlap with target region states.
  const fileStates = parseResult.detection.states;
  const overlap = fileStates.filter((s) => region.states.includes(s));
  if (fileStates.length > 0 && overlap.length === 0) {
    const msg = `Workbook states [${fileStates.join(", ")}] don't match region "${region.name}" [${region.states.join(", ")}]`;
    await supabase.from("psb_uploads").update({
      status: "failed", error_message: msg,
    }).eq("id", upload.id);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Determine next version number for this region
  const { data: maxVersion } = await supabase
    .from("psb_pricing_data")
    .select("version")
    .eq("region_id", regionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (maxVersion?.version ?? 0) + 1;

  // Insert new pricing_data row (is_current=false initially)
  const { data: newPricing, error: insertErr } = await supabase
    .from("psb_pricing_data")
    .insert({
      region_id: regionId,
      version: nextVersion,
      is_current: false,
      matrices: parseResult.matrices,
      upload_id: upload.id,
    })
    .select()
    .single();
  if (insertErr || !newPricing) {
    await supabase.from("psb_uploads").update({
      status: "failed", error_message: `DB insert failed: ${insertErr?.message ?? "unknown"}`,
    }).eq("id", upload.id);
    return NextResponse.json({ error: "Failed to save pricing data" }, { status: 500 });
  }

  // Activate: deactivate previous current, then set new one to current
  await supabase.from("psb_pricing_data")
    .update({ is_current: false })
    .eq("region_id", regionId)
    .eq("is_current", true);
  await supabase.from("psb_pricing_data")
    .update({ is_current: true })
    .eq("id", newPricing.id);

  // Update upload to success
  const sheetCount = Object.keys(parseResult.matrices).length;
  await supabase.from("psb_uploads").update({
    status: "success", sheet_count: sheetCount,
  }).eq("id", upload.id);

  await logAudit({
    actorEmail: guard.email,
    action: "pricing.upload",
    entity: "psb_pricing_data",
    entityId: newPricing.id,
    diff: {
      regionId,
      version: nextVersion,
      filename: file.name,
      detection: parseResult.detection,
    },
  });

  return NextResponse.json({
    ok: true,
    upload,
    pricing: { id: newPricing.id, version: nextVersion },
    detection: parseResult.detection,
    warnings: parseResult.validation.warnings,
  });
}
