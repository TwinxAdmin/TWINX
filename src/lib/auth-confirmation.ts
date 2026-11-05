// Megerősítő levél küldése (újraküldés, és belépési kísérlet meg nem erősített fiókkal). Csak szerveroldalról hívható.
//
// Redirect: a regisztráció (/api/auth/register) sem ad meg emailRedirectTo-t, ezért itt sem — így az újraküldött levél
// linkje ugyanoda visz. A kezdőkreditet és a signup_source-t a DB-trigger (handle_new_user) már a fiók létrejöttekor
// beállítja, az újraküldés ezekhez nem nyúl.
import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** „sent”: elment, vagy erre a címre egy percen belül már ment levél. „rate_limited”: a teljes küldési keret betelt. */
export type ConfirmationSendResult = "sent" | "rate_limited" | "failed";

export async function sendConfirmationEmail(supabase: ServerSupabase, email: string): Promise<ConfirmationSendResult> {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (!error) return "sent";
  // Címenkénti korlát: csak létező, meg nem erősített címre jön, ezért kifelé sikernek számít — különben elárulná,
  // hogy a cím létezik. A levél egy percen belül úgyis kiment, és a felületi visszaszámláló sem enged ide.
  if (/only request this after/i.test(error.message)) return "sent";
  if (error.status === 429 || /rate|limit/i.test(error.message)) return "rate_limited";
  console.error("[confirmation-email]", error.message);
  return "failed";
}
