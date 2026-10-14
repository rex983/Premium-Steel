import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import {
  displayName,
  getLauncherDepartments,
  getLauncherOffices,
  getLauncherRoles,
} from "@/lib/launcher/org";

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

  // Labels come from the launcher's role / office / department tables.
  const [roles, offices, departments] = await Promise.all([
    getLauncherRoles(),
    getLauncherOffices(),
    getLauncherDepartments(),
  ]);
  return NextResponse.json(
    (users || []).map((u) => ({
      ...u,
      role_label: displayName(roles, u.role),
      office_label: displayName(offices, u.office),
      department_label: displayName(departments, u.department),
    })),
  );
}
