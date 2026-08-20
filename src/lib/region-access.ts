import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, Office } from "@/types/auth";

export const VALID_OFFICES: Office[] = ["Harbor", "Marion", "BST", "RnD"];
const VALID_OFFICE_SET = new Set<string>(VALID_OFFICES);

export function isValidOffice(value: unknown): value is Office {
  return typeof value === "string" && VALID_OFFICE_SET.has(value);
}

export function canAccessRegion(
  role: UserRole | undefined,
  office: Office | undefined,
  regionOffices: string[] | null | undefined
): boolean {
  if (role === "admin") return true;
  if (!office) return false;
  const allowed = regionOffices ?? [];
  if (allowed.length === 0) return false;
  return allowed.includes(office);
}

export async function canSessionAccessRegionId(
  role: UserRole | undefined,
  office: Office | undefined,
  regionId: string
): Promise<boolean> {
  if (role === "admin") return true;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("psb_regions")
    .select("offices")
    .eq("id", regionId)
    .single();
  return canAccessRegion(role, office, data?.offices);
}

export async function accessibleRegionIds(
  role: UserRole | undefined,
  office: Office | undefined
): Promise<string[] | "all"> {
  if (role === "admin") return "all";
  if (!office) return [];
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("psb_regions")
    .select("id")
    .contains("offices", [office]);
  return (data ?? []).map((r) => r.id);
}
