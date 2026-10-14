export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function validProfileId(id: string | null | undefined): string | null {
  return id && UUID_RE.test(id) ? id : null;
}

// Strips PostgREST/ILIKE special characters so user input can't break the `.or()` filter.
export function sanitizeSearchInput(raw: string): string {
  return raw.replace(/[%_\\(),."']/g, "");
}
