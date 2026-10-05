// Melyik videómotor készíti a partnerek videóit:
//   • "twinx"     — a SAJÁT TWINX motor (alapértelmezés)
//   • "shotstack" — külső szolgáltatás, TARTALÉK: csak vészhelyzetben kapcsoljuk vissza
//
// A kapcsoló az ADATBÁZISBAN van (app_settings.video_renderer), és az admin a
// Videólaborban állítja — újratelepítés nélkül, azonnal érvényes.
// Ha a tábla még nincs létrehozva (app-settings.sql), a VIDEO_RENDERER környezeti
// változó dönt; ha az sincs, a saját motor fut.
//
// SZERVEROLDALI modul (service_role kulcsot használ).
import { createAdminClient } from "@/lib/supabase/admin";

export type VideoRendererId = "shotstack" | "twinx";

export const RENDERER_SETTING_KEY = "video_renderer";

export type VideoRendererInfo = {
  /** Ami TÉNYLEGESEN fut a partnerek videóinál. */
  effective: VideoRendererId;
  /** Honnan jön a beállítás: adatbázis (Videólabor) vagy tartalék (env / alap). */
  source: "database" | "env" | "default";
  /** Shotstack környezet: "stage" (teszt, vízjeles) vagy "v1" (éles). */
  shotstackEnv: string;
  /** Be van-e állítva a Shotstack kulcs (a tartalék bekapcsolhatóságához). */
  shotstackReady: boolean;
  /** Mikor és ki állította utoljára (ha adatbázisból jön). */
  updatedAt: string | null;
};

const norm = (v: unknown): VideoRendererId | null =>
  v === "twinx" || v === "shotstack" ? v : null;

function envRenderer(): VideoRendererId | null {
  return norm(String(process.env.VIDEO_RENDERER ?? "").trim().toLowerCase());
}

/** A beállítás teljes leírása (a Videólabor kapcsolójához). */
export async function rendererInfo(): Promise<VideoRendererInfo> {
  const base = {
    shotstackEnv: process.env.SHOTSTACK_ENV || "stage",
    shotstackReady: Boolean(process.env.SHOTSTACK_API_KEY),
  };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_settings").select("value, updated_at").eq("key", RENDERER_SETTING_KEY).maybeSingle();
    const fromDb = !error ? norm(data?.value) : null;
    if (fromDb) return { ...base, effective: fromDb, source: "database", updatedAt: (data?.updated_at as string) ?? null };
  } catch { /* tábla hiányzik / hálózati hiba → tartalék */ }
  const env = envRenderer();
  return { ...base, effective: env ?? "twinx", source: env ? "env" : "default", updatedAt: null };
}

/** A partnerek videóinál ténylegesen használt motor. */
export async function activeRenderer(): Promise<VideoRendererId> {
  return (await rendererInfo()).effective;
}

/** Átkapcsolás (CSAK admin hívhatja — a hívó ellenőrzi). */
export async function setActiveRenderer(value: VideoRendererId, userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: RENDERER_SETTING_KEY, value, updated_at: new Date().toISOString(), updated_by: userId,
  });
  if (error) {
    return {
      ok: false,
      error: /app_settings/.test(error.message)
        ? "Hiányzik az app_settings tábla — futtasd az app-settings.sql-t a Supabase-ben."
        : error.message,
    };
  }
  return { ok: true };
}
