import { createAdminClient } from "@/lib/supabase/admin";

/** This app's jwt_audience in launcher_sso_configs. */
export const APP_AUDIENCE = "psb-pricing";

/** Shown in sign-in errors ("You don't have access to <APP_NAME> …"). */
export const APP_NAME = "PSB Pricing";

/** Service-role Supabase client (shared BBD database). */
export const adminClient = createAdminClient;
