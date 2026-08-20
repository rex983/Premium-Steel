"use client";

import { useEffect, useState } from "react";

interface ActiveIdentity {
  role: string;
  profileId: string;
  office?: string | null;
  email?: string | null;
  name?: string | null;
  isImpersonating: boolean;
  actualAdminEmail?: string | null;
}

export function ImpersonationBanner() {
  const [identity, setIdentity] = useState<ActiveIdentity | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    fetch("/api/session/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIdentity(data))
      .catch(() => setIdentity(null));
  }, []);

  if (!identity?.isImpersonating) return null;

  const exit = async () => {
    setExiting(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.href = "/admin/users";
  };

  const who = identity.name?.trim() || identity.email || identity.profileId;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-700 bg-amber-400/90 px-4 py-2 text-sm text-amber-950 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-xs">View as</span>
        <span className="font-medium">{who}</span>
        <span className="text-xs opacity-80">
          {identity.office ? `${identity.office} · ` : ""}
          <span className="uppercase">{identity.role}</span>
        </span>
        {identity.actualAdminEmail && (
          <span className="text-xs opacity-70">(admin: {identity.actualAdminEmail})</span>
        )}
      </div>
      <button
        onClick={exit}
        disabled={exiting}
        className="rounded border border-amber-800 bg-amber-100 px-2 py-1 text-xs font-semibold hover:bg-amber-50 disabled:opacity-60"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
