import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
  office: z.enum(["Harbor", "Marion", "BST", "RnD"]).nullable().optional(),
  is_it: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.full_name = parsed.data.name;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.office !== undefined) updates.office = parsed.data.office;
  if (parsed.data.is_it !== undefined) updates.is_it = parsed.data.is_it;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const securityChange =
    parsed.data.role !== undefined ||
    parsed.data.office !== undefined ||
    parsed.data.is_it !== undefined;

  // Bump session_version on security-relevant changes so live JWTs in sibling
  // apps (launcher, QSB, ASC) pick up the new claims on next request.
  if (securityChange) {
    const { data: before } = await supabase
      .from("profiles")
      .select("session_version")
      .eq("id", id)
      .single();
    updates.session_version = ((before?.session_version as number | null) ?? 1) + 1;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("id, email, name:full_name, role, office, is_it, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "user.update",
    entity: "profiles",
    entityId: id,
    diff: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;

  if (guard.profileId === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "user.delete",
    entity: "profiles",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
