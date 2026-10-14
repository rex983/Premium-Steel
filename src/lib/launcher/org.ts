import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Offices / departments / roles are created and named only in the BBD Launcher
 * (launcher_offices, launcher_departments, launcher_roles). PSB reads them,
 * cached for 60s. Until launcher migration 051 is applied (table missing:
 * PGRST205 / 42P01) the previous built-in lists are used so deploy order is
 * safe. Unknown values always render with their raw name.
 */
export interface OrgOption {
  name: string;
  display_name: string;
}

const FALLBACK_OFFICES: OrgOption[] = [
  { name: "Sales", display_name: "Sales" },
  { name: "BST", display_name: "BST" },
  { name: "RnD", display_name: "R&D" },
];

const FALLBACK_DEPARTMENTS: OrgOption[] = [
  { name: "SALES TEAM", display_name: "SALES TEAM" },
  { name: "BST", display_name: "BST" },
  { name: "RnD", display_name: "RnD" },
];

async function readOrgTable(
  table: "launcher_offices" | "launcher_departments" | "launcher_roles",
  fallback: OrgOption[],
): Promise<OrgOption[]> {
  const query = createAdminClient().from(table).select("name, display_name");
  const { data, error } =
    table === "launcher_roles"
      ? await query.order("name")
      : await query.order("sort_order").order("name");
  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") {
      console.warn(`[launcher-org] ${table} read failed; using built-in list`, error.message);
    }
    return fallback;
  }
  return (data ?? []).map((r) => ({
    name: String(r.name),
    display_name: (r.display_name as string | null) || String(r.name),
  }));
}

export const getLauncherOffices = unstable_cache(
  () => readOrgTable("launcher_offices", FALLBACK_OFFICES),
  ["launcher-offices"],
  { revalidate: 60 },
);

export const getLauncherDepartments = unstable_cache(
  () => readOrgTable("launcher_departments", FALLBACK_DEPARTMENTS),
  ["launcher-departments"],
  { revalidate: 60 },
);

export const getLauncherRoles = unstable_cache(
  () => readOrgTable("launcher_roles", []),
  ["launcher-roles"],
  { revalidate: 60 },
);

/** Every value must be an office that exists in the launcher. */
export async function invalidOffices(values: unknown[]): Promise<unknown[]> {
  const known = new Set((await getLauncherOffices()).map((o) => o.name));
  return values.filter((v) => typeof v !== "string" || !known.has(v));
}

export function displayName(options: OrgOption[], name: string | null | undefined): string {
  if (!name) return "";
  return options.find((o) => o.name === name)?.display_name || name;
}
