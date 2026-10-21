// Brevo-szinkron — a regisztrált felhasználók kontaktként a Brevóban (e-mail alapján upsert, dupla megerősítés nélkül).
//   • a kulcs és a listák CSAK szerveroldalon, környezeti változóban: BREVO_API_KEY, BREVO_LIST_USERS,
//     BREVO_LIST_NEWSLETTER, BREVO_LIST_3D (a lista száma a Brevóban). Kulcs nélkül csendben kihagyja.
//   • mindig a TELJES, aktuális állapotot küldjük az adatbázisból (név, regisztráció, fióktípus, irodai szerep,
//     hírlevél + időpont, listák) — így bármelyik esemény (regisztráció, beállítás, várólista, iroda) ugyanazt hívja.
//   • 3 próbálkozás; ha mégsem sikerül, a brevo_sync_queue-ba kerül, és a napi ütemezett feladat újrapróbálja.
//   • SOHA nem dob hibát a hívóra: a regisztráció / beállítás a Brevo miatt nem akadhat el.
// Migráció: 20261021200000_brevo-newsletter.sql
import { createAdminClient } from "@/lib/supabase/admin";

export const BREVO_MIGRATION = "20261021200000_brevo-newsletter.sql";
const API = "https://api.brevo.com/v3";

/** A Brevo-attribútumok (az admin-szinkron létrehozza őket, ha még nincsenek). */
export const BREVO_ATTRIBUTES: { name: string; type: "text" | "date" | "boolean" }[] = [
  { name: "FIRSTNAME", type: "text" },
  { name: "LASTNAME", type: "text" },
  { name: "REG_DATUM", type: "date" },
  { name: "FIOKTIPUS", type: "text" },      // privát / irodai
  { name: "IRODAI_SZEREP", type: "text" },  // vezető / kolléga (irodai fióknál)
  { name: "HIRLEVEL", type: "boolean" },
  { name: "HIRLEVEL_DATUM", type: "date" },
];

function listId(name: string): number | null {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function brevoConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && listId("BREVO_LIST_USERS") !== null;
}

async function call(path: string, init: { method: string; body?: unknown }): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { "api-key": process.env.BREVO_API_KEY ?? "", "content-type": "application/json", accept: "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, text: res.ok ? "" : (await res.text().catch(() => "")).slice(0, 500) };
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

/** „Kovács Márk" → vezetéknév: Kovács, keresztnév: Márk (magyar névsorrend). */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { last: parts[0], first: parts.slice(1).join(" ") };
}

type Contact = {
  email: string;
  attributes: Record<string, string | boolean | null>;
  add: number[];
  remove: number[];
  newsletter: boolean;
};

/** Egy felhasználó aktuális Brevo-kontaktja az adatbázisból (null: nincs e-mail / nincs ilyen fiók). */
async function buildContact(userId: string): Promise<Contact | null> {
  const admin = createAdminClient();
  const [{ data: au }, { data: p }, { data: members }, { data: wait }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name, created_at, newsletter, newsletter_at").eq("id", userId).maybeSingle(),
    admin.from("office_members").select("role, can_allocate").eq("user_id", userId),
    admin.from("premium3d_waitlist").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  const email = au?.user?.email;
  if (!email) return null;

  const name = splitName(String(p?.full_name ?? au.user?.user_metadata?.full_name ?? ""));
  const office = (members ?? []).length > 0;
  const lead = (members ?? []).some((m) => m.role === "owner" || m.can_allocate);
  const newsletter = !!p?.newsletter;

  const users = listId("BREVO_LIST_USERS");
  const news = listId("BREVO_LIST_NEWSLETTER");
  const d3 = listId("BREVO_LIST_3D");
  const add: number[] = [];
  const remove: number[] = [];
  if (users) add.push(users);
  if (news) (newsletter ? add : remove).push(news);
  if (d3) (wait ? add : remove).push(d3);

  return {
    email,
    newsletter,
    add,
    remove,
    attributes: {
      FIRSTNAME: name.first || null,
      LASTNAME: name.last || null,
      REG_DATUM: day((p?.created_at as string | undefined) ?? au.user?.created_at),
      FIOKTIPUS: office ? "irodai" : "privát",
      IRODAI_SZEREP: office ? (lead ? "vezető" : "kolléga") : "",
      HIRLEVEL: newsletter,
      HIRLEVEL_DATUM: newsletter ? day(p?.newsletter_at as string | null) : null,
    },
  };
}

/** Egy kontakt felvitele / frissítése a Brevóban: upsert + a nem érvényes listákról levétel. */
async function push(c: Contact): Promise<void> {
  const up = await call("/contacts", {
    method: "POST",
    body: {
      email: c.email,
      attributes: c.attributes,
      listIds: c.add,
      updateEnabled: true,
      // ha most kifejezetten kér hírlevelet, a korábbi (Brevóban történt) leiratkozás tiltását feloldjuk
      ...(c.newsletter ? { emailBlacklisted: false } : {}),
    },
  });
  if (!up.ok) throw new Error(`Brevo ${up.status}: ${up.text}`);
  if (c.remove.length) {
    const rm = await call(`/contacts/${encodeURIComponent(c.email)}`, { method: "PUT", body: { unlinkListIds: c.remove } });
    // 400: a kontakt nincs is azon a listán — ez nem hiba
    if (!rm.ok && rm.status !== 400) throw new Error(`Brevo ${rm.status}: ${rm.text}`);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Egy felhasználó szinkronja a Brevóba — 3 próbálkozással. Sikertelenség esetén a sorba (brevo_sync_queue) teszi.
 * Soha nem dob hibát; az eredményt visszaadja (az admin-szinkron számolja).
 */
export async function syncUserToBrevo(userId: string): Promise<"ok" | "skipped" | "failed"> {
  if (!brevoConfigured()) return "skipped";
  const admin = createAdminClient();
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const c = await buildContact(userId);
      if (!c) return "skipped";
      await push(c);
      await admin.from("brevo_sync_queue").delete().eq("user_id", userId);
      return "ok";
    } catch (e) {
      lastError = (e as Error).message || "ismeretlen hiba";
      if (attempt < 3) await wait(attempt * 700);
    }
  }
  console.error(`[brevo] szinkron sikertelen (${userId}): ${lastError}`);
  try {
    const { data: prev } = await admin.from("brevo_sync_queue").select("attempts").eq("user_id", userId).maybeSingle();
    await admin.from("brevo_sync_queue").upsert({
      user_id: userId,
      attempts: ((prev?.attempts as number | undefined) ?? 0) + 3,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // a sor mentése se akassza meg a hívót (pl. ha a migráció még nem futott le)
  }
  return "failed";
}

/** A hiányzó Brevo-attribútumok létrehozása (az egyszeri admin-szinkron hívja). A már létező attribútum nem hiba. */
export async function ensureBrevoAttributes(): Promise<string[]> {
  const errors: string[] = [];
  for (const a of BREVO_ATTRIBUTES) {
    if (a.name === "FIRSTNAME" || a.name === "LASTNAME") continue; // a Brevo alapból tartalmazza
    const r = await call(`/contacts/attributes/normal/${a.name}`, { method: "POST", body: { type: a.type } });
    if (!r.ok && r.status !== 400) errors.push(`${a.name}: ${r.status} ${r.text}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Admin + ütemezett feladat
// ---------------------------------------------------------------------------

export type BrevoStatus = {
  configured: boolean;
  missing: string[];          // hiányzó KÖTELEZŐ környezeti változók (kulcs + „TWINX felhasználók" lista)
  optional: string[];         // hiányzó, nem kötelező listák (hírlevél, 3D várólista) — nélkülük ezek kimaradnak
  users: number;              // regisztrált fiókok (profiles)
  newsletter: number | null;  // hírlevelet kér (null: a migráció még nem futott le)
  queue: number | null;       // sikertelen, újrapróbálásra váró szinkron
};

export async function brevoStatus(): Promise<BrevoStatus> {
  const admin = createAdminClient();
  const missing = ["BREVO_API_KEY", "BREVO_LIST_USERS"].filter((k) => (k === "BREVO_API_KEY" ? !process.env[k] : listId(k) === null));
  const optional = ["BREVO_LIST_NEWSLETTER", "BREVO_LIST_3D"].filter((k) => listId(k) === null);
  const [users, news, queue] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("newsletter", true),
    admin.from("brevo_sync_queue").select("user_id", { count: "exact", head: true }),
  ]);
  return {
    configured: brevoConfigured(),
    missing,
    optional,
    users: users.count ?? 0,
    newsletter: news.error ? null : news.count ?? 0,
    // migráció előtt a sor-tábla sincs meg (a HEAD-kérés ilyenkor nem mindig ad hibát → a profil-oszlop dönt)
    queue: queue.error || news.error ? null : queue.count ?? 0,
  };
}

/** Az egyszeri (bármikor megismételhető) szinkron egy szelete: `offset`-től `size` fiók, a regisztráció sorrendjében. */
export async function syncBatch(offset: number, size: number): Promise<{ ok: number; failed: number; skipped: number; next: number | null }> {
  const { data, error } = await createAdminClient().from("profiles").select("id")
    .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + size - 1);
  if (error) throw new Error(error.message);
  const r = { ok: 0, failed: 0, skipped: 0 };
  for (const p of data ?? []) r[await syncUserToBrevo(String(p.id))]++;
  return { ...r, next: (data?.length ?? 0) === size ? offset + size : null };
}

/** A sikertelen szinkronok újrapróbálása (napi ütemezett feladat + admin-gomb). */
export async function retryBrevoQueue(limit = 200): Promise<{ ok: number; failed: number; skipped: number }> {
  const { data, error } = await createAdminClient().from("brevo_sync_queue").select("user_id")
    .order("updated_at", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);
  const r = { ok: 0, failed: 0, skipped: 0 };
  for (const q of data ?? []) r[await syncUserToBrevo(String(q.user_id))]++;
  return r;
}
