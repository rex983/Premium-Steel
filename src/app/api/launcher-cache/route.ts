import { cacheClearRoute } from "@/lib/launcher-kit/cache-clear";

// The launcher's Admin → Clear Cache, server to server (signed token; public in the proxy).
export const dynamic = "force-dynamic";

export const POST = cacheClearRoute();
