// Hírlevél-hozzájárulás a Supabase-ben (profiles.newsletter + időpont + forrás). A Brevót a hívó szinkronizálja
// (syncUserToBrevo), így a két hely mindig ugyanazt mutatja. Migráció: 20261021200000_brevo-newsletter.sql
import { createAdminClient } from "@/lib/supabase/admin";
import { BREVO_MIGRATION } from "@/lib/brevo";

export type NewsletterSource = "register" | "settings" | "portal" | "brevo";

export type NewsletterState = { newsletter: boolean; at: string | null; bannerDismissed: boolean; migrated: boolean };

/** A felhasználó hírlevél-állapota (migráció előtt: migrated = false, minden „nem"). */
export async function getNewsletter(userId: string): Promise<NewsletterState> {
  const { data, error } = await createAdminClient().from("profiles")
    .select("newsletter, newsletter_at, newsletter_banner_dismissed_at").eq("id", userId).maybeSingle();
  if (error) return { newsletter: false, at: null, bannerDismissed: false, migrated: false };
  return {
    newsletter: !!data?.newsletter,
    at: (data?.newsletter_at as string | null) ?? null,
    bannerDismissed: !!data?.newsletter_banner_dismissed_at,
    migrated: true,
  };
}

/** Hírlevél be/ki. Hibánál (pl. a migráció még nem futott le) a hibaüzenet megnevezi a migrációt. */
export async function setNewsletter(userId: string, value: boolean, source: NewsletterSource): Promise<{ error?: string }> {
  const { error } = await createAdminClient().from("profiles").update({
    newsletter: value,
    newsletter_at: new Date().toISOString(),
    newsletter_source: source,
  }).eq("id", userId);
  if (error) return { error: `A hírlevél-beállítás nem menthető — futtasd le a ${BREVO_MIGRATION} migrációt.` };
  return {};
}

/** A Portálközpont hírlevél-sávjának bezárása (többé nem jelenik meg). */
export async function dismissNewsletterBanner(userId: string): Promise<{ error?: string }> {
  const { error } = await createAdminClient().from("profiles")
    .update({ newsletter_banner_dismissed_at: new Date().toISOString() }).eq("id", userId);
  if (error) return { error: `Nem menthető — futtasd le a ${BREVO_MIGRATION} migrációt.` };
  return {};
}
