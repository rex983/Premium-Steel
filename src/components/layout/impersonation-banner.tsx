"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LAUNCHER_URL } from "@/lib/launcher/url";


/**
 * Shown on every authenticated page while a launcher admin is viewing PSB as
 * another user. The session is read-only (enforced server-side in middleware).
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const [exiting, setExiting] = useState(false);

  const viewAs = session?.viewAs;
  if (!viewAs) return null;

  const exit = async () => {
    setExiting(true);
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.href = `${LAUNCHER_URL}/dashboard`;
    }
  };

  const who = session.user?.name?.trim() || session.user?.email || "user";
  const actor = viewAs.actorName?.trim() || viewAs.actorEmail;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b-2 border-black bg-yellow-300 px-4 py-2 text-sm font-medium text-black"
    >
      <span>
        Viewing as <strong>{who}</strong> ({session.user?.role}) — read-only. Signed in as{" "}
        <strong>{actor}</strong>.
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="shrink-0 rounded border-2 border-black bg-white px-3 py-1 text-xs font-bold hover:bg-yellow-100 disabled:opacity-60"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
