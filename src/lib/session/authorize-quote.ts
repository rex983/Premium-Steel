import { NextResponse } from "next/server";
import { canAccessRegion } from "@/lib/region-access";
import { isOwnQuotesOnly, isReadOnlyRole } from "@/lib/launcher/roles";
import type { ActiveIdentity } from "@/lib/session/active-identity";

// Quote row shape needed to decide access. Any select() that includes
// `created_by` and `region:psb_regions(offices)` satisfies this.
type QuoteAuthShape = {
  created_by: string | null;
  region: { offices?: string[] | null } | { offices?: string[] | null }[] | null;
};

function extractOffices(region: QuoteAuthShape["region"]): string[] | null | undefined {
  if (!region) return null;
  const r = Array.isArray(region) ? region[0] : region;
  return r?.offices ?? null;
}

// Returns null if the identity may read the quote, otherwise a 404 response
// (hides existence from users outside the region or ownership scope).
// `identity.role` is the permission role (launcher acts_as), so custom roles
// follow the role they act as; unknown roles are limited to their own quotes.
export function assertQuoteReadable(
  quote: QuoteAuthShape,
  identity: ActiveIdentity
): NextResponse | null {
  const { role, profileId, office } = identity;
  if (!canAccessRegion(role, office, extractOffices(quote.region))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isOwnQuotesOnly(role) && quote.created_by !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

// Returns null if the identity may mutate the quote, otherwise a 403 response.
// Read-only roles are always denied; own-quotes-only roles can only touch their own.
export function assertQuoteWritable(
  quote: QuoteAuthShape,
  identity: ActiveIdentity
): NextResponse | null {
  const { role, profileId, office } = identity;
  if (!canAccessRegion(role, office, extractOffices(quote.region))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isReadOnlyRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (isOwnQuotesOnly(role) && quote.created_by !== profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
