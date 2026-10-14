import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";

// Users, roles, offices and departments are managed only in the BBD Launcher
// (Admin → Users). PSB lists them read-only.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();
  // Shared profiles table stores full_name; alias to `name` for the UI.
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, name:full_name, role, office, department, is_it, is_active, created_at, updated_at")
    .order("email");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(users || []);
}
