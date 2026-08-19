import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().optional(),
  role: z.string().min(1).default("sales_rep"),
  office: z.enum(["Harbor", "Marion", "BST", "RnD"]).nullable().optional(),
  department: z.enum(["SALES TEAM", "BST", "RnD"]).nullable().optional(),
  is_it: z.boolean().optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();
  // Shared profiles table stores full_name; alias to `name` for the UI.
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, name:full_name, role, office, department, is_it, created_at, updated_at")
    .order("email");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(users || []);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, role, office, department, is_it } = parsed.data;
  const supabase = createAdminClient();

  // No FK to auth.users on shared profiles.id — launcher-style direct insert.
  // `approved: true` is required because ASC Engineering's signIn gate blocks
  // approved === false, and the column default is false.
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      email,
      full_name: name ?? null,
      role,
      office: office ?? null,
      department: department ?? null,
      is_it: is_it ?? false,
      approved: true,
    })
    .select("id, email, name:full_name, role, office, department, is_it, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actorEmail: guard.email,
    action: "user.create",
    entity: "profiles",
    entityId: profile.id,
    diff: { email, role, office, department, is_it: is_it ?? false },
  });

  return NextResponse.json(profile, { status: 201 });
}
