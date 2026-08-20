import { cookies } from "next/headers";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validators";
import type { UserRole, Office, Department } from "@/types/auth";

export const IMPERSONATION_COOKIE = "psb_view_as";

export interface ActiveIdentity {
  role: UserRole;
  profileId: string;
  office?: Office;
  department?: Department | null;
  email?: string | null;
  name?: string | null;
  isImpersonating: boolean;
  actualAdminEmail?: string | null;
  actualAdminProfileId?: string;
}

export async function getActiveIdentity(): Promise<ActiveIdentity | null> {
  const session = await auth();
  if (!session?.user) return null;

  const base: ActiveIdentity = {
    role: session.user.role,
    profileId: session.user.profileId,
    office: session.user.office,
    department: session.user.department ?? null,
    email: session.user.email,
    name: session.user.name,
    isImpersonating: false,
  };
  if (session.user.role !== "admin") return base;

  const cookieStore = await cookies();
  const targetId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!targetId || !isUuid(targetId)) return base;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name:full_name, role, office, department")
    .eq("id", targetId)
    .single();
  if (!profile) return base;

  return {
    role: profile.role as UserRole,
    profileId: profile.id,
    office: (profile.office ?? undefined) as Office | undefined,
    department: (profile.department ?? null) as Department | null,
    email: profile.email,
    name: profile.name,
    isImpersonating: true,
    actualAdminEmail: session.user.email,
    actualAdminProfileId: session.user.profileId,
  };
}
