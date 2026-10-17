// Meta Conversions API (szerveroldali esemény) — CSAK szerveroldal.
// A böngészős Pixelt a hirdetésblokkolók és a süti-elutasítás sok helyen elvágják; a regisztrációt ezért a szerver is elküldi,
// UGYANAZZAL az eseményazonosítóval (event_id), így a Meta párosítja a kettőt, és nem számolja kétszer.
// Feltételek: van hozzáférési token (META_CAPI_TOKEN — Eseménykezelő → Twinx Pixel → Beállítások → Conversions API),
// és a látogató elfogadta a marketing-sütiket. Token nélkül csendben kihagyjuk. Hiba esetén sem akadályozza a regisztrációt.
import { createHash } from "node:crypto";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";
const TIMEOUT_MS = 4000;

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/** Egy cookie értéke a kérés fejlécéből (pl. _fbp, _fbc — a Pixel saját sütijei). */
function cookie(request: Request, name: string): string | undefined {
  const m = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export type RegistrationEvent = {
  eventId: string;
  contentName: string;
  email?: string | null;
  userId?: string | null;
  /** Az oldal, ahol a regisztráció történt (abszolút URL). */
  sourceUrl?: string | null;
};

/** CompleteRegistration küldése a Conversions API-nak. Visszatér: elküldtük-e (a hívó nem vár rá hibát). */
export async function sendRegistrationEvent(request: Request, ev: RegistrationEvent): Promise<boolean> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !META_PIXEL_ID || !ev.eventId) return false;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
  const userData: Record<string, unknown> = {
    client_ip_address: ip,
    client_user_agent: request.headers.get("user-agent") ?? undefined,
    fbp: cookie(request, "_fbp"),
    fbc: cookie(request, "_fbc"),
  };
  if (ev.email) userData.em = [sha256(ev.email)];
  if (ev.userId) userData.external_id = [sha256(ev.userId)];
  const body: Record<string, unknown> = {
    data: [{
      event_name: "CompleteRegistration",
      event_time: Math.floor(Date.now() / 1000),
      event_id: ev.eventId,
      action_source: "website",
      event_source_url: ev.sourceUrl ?? undefined,
      user_data: userData,
      custom_data: { content_name: ev.contentName },
    }],
  };
  // Eseménykezelő → Események tesztelése: a tesztkód ide (csak a teszt idejére állítsd be).
  if (process.env.META_CAPI_TEST_CODE) body.test_event_code = process.env.META_CAPI_TEST_CODE;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) console.warn("[meta-capi] sikertelen küldés", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.warn("[meta-capi] hiba", e instanceof Error ? e.message : e);
    return false;
  }
}

/** A kliens által küldött eseményazonosító ellenőrzése (csak ésszerű formátumot fogadunk el). */
export function cleanEventId(v: unknown): string | null {
  return typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}
