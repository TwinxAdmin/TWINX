// Service-role Supabase kliens — MEGKERÜLI az RLS-t.
// SZIGORÚAN csak szerveroldalon (API route, webhook). SOHA ne kliensen!
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
