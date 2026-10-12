// Modul-visszajelzés (ME3) — CSAK szerveroldal: mikor kérdezzünk, és mentés (20261012192545_module-feedback.sql).
//   • csillag: ha a felhasználó a modult legalább 3-szor futtatta (usage_history), és még nincs válasza;
//     ha bezárta (dismissed, asked_count = 1), a 6. futtatástól még EGYSZER — utána soha
//   • „Mi hiányzik?": legalább 3 különböző napon megnyitotta (module_views), de egyszer sem futtatta, és még nincs válasza
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURE_TO_HREF } from "@/lib/module-favorites";
import { ASK_VIEW_DAYS, RATING_FIRST_RUN, RATING_SECOND_RUN } from "@/lib/module-feedback-shared";

/** Hányszor futtatta a felhasználó a modult (minden idők, a modulhoz tartozó feature-ök szerint). */
export async function moduleRunCount(userId: string, moduleHref: string): Promise<number> {
  const features = Object.entries(FEATURE_TO_HREF).filter(([, h]) => h === moduleHref).map(([f]) => f);
  if (!features.length) return 0;
  const { count } = await createAdminClient()
    .from("usage_history").select("id", { count: "exact", head: true })
    .eq("user_id", userId).in("feature_used", features);
  return count ?? 0;
}

export async function feedbackPrompt(userId: string, moduleHref: string): Promise<{ rating: boolean; ask: boolean; runs: number }> {
  const admin = createAdminClient();
  const [runs, { data: rating, error: rErr }, { data: ask, error: aErr }, { count: viewDays }] = await Promise.all([
    moduleRunCount(userId, moduleHref),
    admin.from("module_ratings").select("status, asked_count").eq("user_id", userId).eq("module_href", moduleHref).maybeSingle(),
    admin.from("module_asks").select("status").eq("user_id", userId).eq("module_href", moduleHref).maybeSingle(),
    admin.from("module_views").select("day", { count: "exact", head: true }).eq("user_id", userId).eq("module_href", moduleHref),
  ]);
  // ha a táblák még nincsenek (a migráció nem futott le), nem kérdezünk
  if (rErr || aErr) return { rating: false, ask: false, runs };

  const showRating = !rating
    ? runs >= RATING_FIRST_RUN
    : rating.status === "dismissed" && (rating.asked_count as number) < 2 && runs >= RATING_SECOND_RUN;
  const showAsk = !ask && runs === 0 && (viewDays ?? 0) >= ASK_VIEW_DAYS;
  return { rating: showRating, ask: showAsk, runs };
}
