import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";

// Roles are managed centrally by the BBD Launcher (`launcher_roles`). PSB just
// reads the list so its user-management UI can offer whatever roles exist.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("launcher_roles")
    .select("name, display_name")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
