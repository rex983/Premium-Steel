/** Launcher base URL (client-safe). Used for "Managed in the BBD Launcher" links and the View-as exit. */
export const LAUNCHER_URL = (
  process.env.NEXT_PUBLIC_LAUNCHER_URL || "https://bbd-launcher.vercel.app"
).replace(/\/+$/, "");
