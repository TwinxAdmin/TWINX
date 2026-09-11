// Ingatlan landing kezdőkredit — a GOOGLE-regisztrációs úthoz.
//
// Az e-mail/jelszavas regisztrációnál a `signup_source` a Supabase signUp
// metaadatában megy át, és a DB-trigger (handle_new_user) adja a 10 kreditet.
// A Google OAuth-nál viszont nincs saját metaadat, ezért a trigger 3 kreditet
// ad; ezt a /auth/callback hívja fel 10-re ezzel a helperrel, ha a landingről
// indult a folyamat.
//
// A logika a `landing-signup-credits.sql` trigger párja: forrás mentése +
// a keret (első 50) erejéig a különbözet jóváírása. Idempotens: ha a
// profilon már van signup_source, nem csinál semmit (nem ad duplán).
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LANDING_SIGNUP_SOURCE,
  LANDING_WELCOME_CREDITS,
  LANDING_CREDITS_CAP,
  WELCOME_CREDITS,
} from "@/lib/onboarding";

export async function applyLandingSignupBonus(userId: string, userEmail: string | null): Promise<void> {
  const admin = createAdminClient();

  // Már jelölt? Akkor a bónuszt is megkapta — ne csináljunk semmit.
  const { data: profile } = await admin
    .from("profiles")
    .select("signup_source")
    .eq("id", userId)
    .single();
  if (!profile || profile.signup_source) return;

  // Hányan érkeztek eddig a landingről? A keret erejéig jár a 10.
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("signup_source", LANDING_SIGNUP_SOURCE);
  const withinCap = (count ?? 0) < LANDING_CREDITS_CAP;

  // Forrás mentése (akkor is, ha a keret betelt — az admin így is lássa).
  await admin.from("profiles").update({ signup_source: LANDING_SIGNUP_SOURCE }).eq("id", userId);

  if (!withinCap) return;

  // Feltöltés a különbözettel (a trigger már adott WELCOME_CREDITS-et Google-nél).
  const topUp = Math.max(0, LANDING_WELCOME_CREDITS - WELCOME_CREDITS);
  if (topUp === 0) return;

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();
  const current = Number(wallet?.balance) || 0;

  await admin.from("wallets").update({ balance: current + topUp }).eq("user_id", userId);
  await admin.from("credit_grants").insert({
    admin_id: null,
    admin_email: "rendszer",
    user_id: userId,
    user_email: userEmail ?? null,
    amount: topUp,
    note: "Ingatlan landing (Google) — 10 kezdőkredit",
  });
}
