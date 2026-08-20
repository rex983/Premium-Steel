import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { IMPERSONATION_COOKIE } from "@/lib/session/active-identity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const targetId = body?.profileId;
  if (!isUuid(targetId)) {
    return NextResponse.json({ error: "Invalid profileId" }, { status: 400 });
  }
  if (targetId === guard.profileId) {
    return NextResponse.json({ error: "Cannot view as yourself" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name:full_name, role, office, department")
    .eq("id", targetId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, targetId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  await logAudit({
    actorEmail: guard.email,
    action: "impersonate.start",
    entity: "profiles",
    entityId: targetId,
    diff: {
      target_email: profile.email,
      target_role: profile.role,
      target_office: profile.office,
    },
  });

  return NextResponse.json({
    ok: true,
    target: { id: profile.id, email: profile.email, name: profile.name },
  });
}

export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const cookieStore = await cookies();
  const target = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  cookieStore.delete(IMPERSONATION_COOKIE);

  if (target) {
    await logAudit({
      actorEmail: guard.email,
      action: "impersonate.stop",
      entity: "profiles",
      entityId: target,
    });
  }

  return NextResponse.json({ ok: true });
}
