// Admin „Modul elemzés" fül (ME1) — CSAK szerveroldal. Maga a MODUL elemzése, felhasználó-szintű adat nélkül.
// Ugyanazokból az alapadatokból dolgozik, mint a Modul-használat (lib/module-usage.ts → loadBase).
//
// Fogalmak (ME1 — a meglévő adatokból):
//   • kohorsz            = akik az adott modult az időszakban futtatták ELŐSZÖR
//   • második futtatás   = a kohorsz hány %-a futtatta legalább még egyszer (bármikor)
//   • visszatér 30 napon = a kohorsz hány %-a futtatta újra az első futtatás utáni 30 napon belül
//   • megtartási görbe   = a kohorszból hányan futtatták MÉG a modult az első után 1 / 7 / 14 / 21 / 30 nap elteltével
//   • kapcsolódások      = ugyanazon a (budapesti) napon a felhasználó mely más modult használta előtte / utána
// ME2 (eseménynapló, 20261012191016_module-events.sql — egyelőre az 5 fő modulban):
//   • tölcsér   = lépésenként hány KÜLÖNBÖZŐ felhasználó jutott el: megnyitás → űrlap → indítás → siker → letöltés/megosztás
//   • hibás     = run_error / (run_success + run_error) · futási idő = a sikeres futtatások MEDIÁN ideje
//   • eszköz    = a szerver állapítja meg (mobile / tablet / desktop); az eszköz-szűrő az eseményekre hat
// Az elégedettség (ME3) később töltődik — addig null.
import { createAdminClient } from "@/lib/supabase/admin";
import { selectableModules } from "@/lib/module-favorites";
import { DAY, fetchAll, loadBase, modeFilter, userFilter, windowOf, type Run, type UsageFilters } from "@/lib/module-usage";

export type DeviceFilter = "all" | "mobile" | "tablet" | "desktop";
type Ev = { user: string; href: string; event: string; ms: number | null; device: string | null; detail: string | null; at: number };

const MIN_SAMPLE = 5;           // ennél kevesebb esetből nem mutatunk arányt („—")
const RET_DAYS = [1, 7, 14, 21, 30];

type Ctx = Awaited<ReturnType<typeof prepare>>;

async function prepare(f: UsageFilters, device: DeviceFilter = "all") {
  const now = Date.now();
  const { start, prevStart } = windowOf(f.range, now);
  const admin = createAdminClient();
  const [base, rawEvents] = await Promise.all([
    loadBase(f.range === "all" ? null : new Date(prevStart ?? start).toISOString()),
    // eseménynapló — csak az időszakra; ha a tábla még nincs, üres (a felület „—"-t mutat)
    fetchAll<{ user_id: string; module_href: string; event: string; duration_ms: number | null; device: string | null; detail: string | null; created_at: string }>((a, b) => {
      let q = admin.from("module_events").select("user_id, module_href, event, duration_ms, device, detail, created_at");
      if (start) q = q.gte("created_at", new Date(start).toISOString());
      return q.range(a, b);
    }),
  ]);
  const kindOf = new Map(base.offices.map((o) => [o.id, o.kind]));
  const keepUser = userFilter(f), keepMode = modeFilter(f, kindOf);
  const runs = base.runs.filter((r) => keepUser(base.people.get(r.user)) && keepMode(r));
  const views = base.views.filter((v) => keepUser(base.people.get(v.user)));
  const modules = selectableModules().map((m) => ({ href: m.href, label: m.label }));
  const eventsAll: Ev[] = rawEvents
    .filter((e) => keepUser(base.people.get(e.user_id)))
    .map((e) => ({ user: e.user_id, href: e.module_href, event: e.event, ms: e.duration_ms, device: e.device, detail: e.detail, at: Date.parse(e.created_at) }));
  const events = device === "all" ? eventsAll : eventsAll.filter((e) => e.device === device);
  return { now, start, prevStart, runs, views, modules, base, events, eventsAll, device };
}

/** Hibaarány és medián futási idő egy modulra (az eseménynaplóból). */
function runStats(events: Ev[], href: string) {
  const ok = events.filter((e) => e.href === href && e.event === "run_success");
  const bad = events.filter((e) => e.href === href && e.event === "run_error");
  const times = ok.map((e) => e.ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  return {
    finished: ok.length + bad.length,
    failurePct: pct(bad.length, ok.length + bad.length),
    avgSeconds: times.length >= MIN_SAMPLE ? Math.round(times[Math.floor(times.length / 2)] / 1000) : null,
    errors: bad,
  };
}

const pct = (a: number, b: number) => (b >= MIN_SAMPLE ? Math.round((a / b) * 100) : null);

/** Felhasználónként a modul futtatásainak időpontjai (növekvő). */
function runsByUser(runs: Run[], href: string): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of runs) if (r.href === href) m.set(r.user, [...(m.get(r.user) ?? []), r.at]);
  for (const v of m.values()) v.sort((a, b) => a - b);
  return m;
}

/** Visszatérési mutatók egy modulra (kohorsz = az időszakban először futtatók). */
function retention(ctx: Ctx, href: string) {
  const byUser = runsByUser(ctx.runs, href);
  const cohort = [...byUser.values()].filter((ts) => ts[0] >= ctx.start);
  const second = cohort.filter((ts) => ts.length >= 2);
  const within30 = cohort.filter((ts) => ts.length >= 2 && ts[1] - ts[0] <= 30 * DAY);
  const gaps = second.map((ts) => (ts[1] - ts[0]) / DAY).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  // megtartási görbe: csak azokat számoljuk egy napra, akiknél az eltelt idő már lehetővé teszi
  const curve = RET_DAYS.map((d) => {
    const eligible = cohort.filter((ts) => ctx.now - ts[0] >= d * DAY);
    const still = eligible.filter((ts) => ts.some((t) => t - ts[0] >= d * DAY));
    return { day: d, pct: pct(still.length, eligible.length), n: eligible.length };
  });
  return {
    cohort: cohort.length,
    secondPct: pct(second.length, cohort.length),
    within30Pct: pct(within30.length, cohort.length),
    medianDaysToSecond: median === null ? null : Math.round(median * 10) / 10,
    curve,
  };
}

// ---------------------------------------------------------------------------
// ÁTTEKINTŐ: TOP 3 + Modulok egészsége
// ---------------------------------------------------------------------------
export async function moduleAnalysisOverview(f: UsageFilters, device: DeviceFilter = "all") {
  const ctx = await prepare(f, device);
  const runsIn = ctx.runs.filter((r) => r.at >= ctx.start);
  const runsPrev = ctx.prevStart === null ? [] : ctx.runs.filter((r) => r.at >= ctx.prevStart! && r.at < ctx.start);
  const viewsIn = ctx.views.filter((v) => v.at >= ctx.start);

  const health = ctx.modules.map((m) => {
    const mr = runsIn.filter((r) => r.href === m.href);
    const runUsers = new Set(mr.map((r) => r.user));
    const viewUsers = new Set(viewsIn.filter((v) => v.href === m.href).map((v) => v.user));
    const conv = pct([...viewUsers].filter((u) => runUsers.has(u)).length, viewUsers.size);
    const ret = retention(ctx, m.href);
    const prev = runsPrev.filter((r) => r.href === m.href).length;
    const change = ctx.prevStart === null ? null : prev === 0 ? (mr.length ? "new" : null) : Math.round(((mr.length - prev) / prev) * 100);
    // napi mini-görbe (legfeljebb 30 nap) a TOP 3 kártyákhoz
    const days = Math.min(30, Math.max(7, Math.round((ctx.now - (ctx.start || ctx.now - 30 * DAY)) / DAY)));
    const spark = Array.from({ length: days }, (_, i) => {
      const d0 = ctx.now - (days - i) * DAY;
      return mr.filter((r) => r.at >= d0 && r.at < d0 + DAY).length;
    });
    const stats = runStats(ctx.events, m.href);
    const returning = runUsers.size ? Math.round(([...runUsers].filter((u) => mr.filter((r) => r.user === u).length >= 2).length / runUsers.size) * 100) : null;
    return {
      href: m.href, label: m.label, runs: mr.length, users: runUsers.size, change, returningPct: returning, spark,
      conversionPct: conv, secondPct: ret.secondPct, within30Pct: ret.within30Pct,
      failurePct: stats.failurePct, satisfactionPct: null as number | null, avgSeconds: stats.avgSeconds,
      tracked: ctx.eventsAll.some((e) => e.href === m.href),
    };
  });

  const top3 = [...health].filter((h) => h.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 3);
  return { filters: f, top3, health: health.sort((a, b) => b.runs - a.runs) };
}

// ---------------------------------------------------------------------------
// EGY MODUL MÉLY ELEMZÉSE
// ---------------------------------------------------------------------------
const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const SLOTS = [{ t: "0–6", a: 0, b: 6 }, { t: "6–9", a: 6, b: 9 }, { t: "9–12", a: 9, b: 12 }, { t: "12–15", a: 12, b: 15 }, { t: "15–18", a: 15, b: 18 }, { t: "18–21", a: 18, b: 21 }, { t: "21–24", a: 21, b: 24 }];

/** Budapesti nap (ÉÉÉÉ-HH-NN), hét napja (0 = hétfő) és óra. */
function bp(ts: number) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
    .formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, weekday: wd < 0 ? 0 : wd, hour: Number(get("hour")) % 24 };
}

export async function moduleAnalysisDeep(href: string, f: UsageFilters, device: DeviceFilter = "all") {
  const ctx = await prepare(f, device);
  const mod = ctx.modules.find((m) => m.href === href);
  if (!mod) return null;
  const labelOf = new Map(ctx.modules.map((m) => [m.href, m.label]));
  const runsIn = ctx.runs.filter((r) => r.at >= ctx.start);
  const mine = runsIn.filter((r) => r.href === href);

  // --- visszatérés (+ az összes modul átlaga a görbéhez) ---
  const ret = retention(ctx, href);
  const allCurves = ctx.modules.map((m) => retention(ctx, m.href).curve);
  const avgCurve = RET_DAYS.map((d, i) => {
    const vals = allCurves.map((c) => c[i].pct).filter((x): x is number => x !== null);
    return { day: d, pct: vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null };
  });
  // „ezzel kezdték a TWINX-et": akiknek a legelső futtatása (bármely modul) ez volt, és az az időszakra esik
  const firstEver = new Map<string, Run>();
  for (const r of ctx.runs) { const f0 = firstEver.get(r.user); if (!f0 || r.at < f0.at) firstEver.set(r.user, r); }
  const startedHere = [...firstEver.values()].filter((r) => r.href === href && r.at >= ctx.start).length;

  // --- mikor: hét napja × napszak (budapesti idő) ---
  const heat = SLOTS.map(() => WEEKDAYS.map(() => 0));
  for (const r of mine) {
    const t = bp(r.at);
    const si = SLOTS.findIndex((s) => t.hour >= s.a && t.hour < s.b);
    heat[si < 0 ? 0 : si][t.weekday]++;
  }

  // --- kapcsolódások: ugyanazon a napon előtte / utána használt más modul ---
  const byUserDay = new Map<string, Run[]>();
  for (const r of runsIn) {
    const k = `${r.user}|${bp(r.at).day}`;
    byUserDay.set(k, [...(byUserDay.get(k) ?? []), r]);
  }
  const before = new Map<string, number>(), after = new Map<string, number>();
  let firstOfDay = 0, onlyThis = 0;
  for (const r of mine) {
    const day = (byUserDay.get(`${r.user}|${bp(r.at).day}`) ?? []).filter((x) => x.href !== href);
    const b = day.filter((x) => x.at < r.at), a = day.filter((x) => x.at > r.at);
    if (!b.length) firstOfDay++;
    if (!a.length) onlyThis++;
    for (const h of new Set(b.map((x) => x.href))) before.set(h, (before.get(h) ?? 0) + 1);
    for (const h of new Set(a.map((x) => x.href))) after.set(h, (after.get(h) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)
    .map(([h, n]) => ({ label: labelOf.get(h) ?? h, pct: mine.length ? Math.round((n / mine.length) * 100) : 0 }));

  // --- tölcsér (különböző felhasználók lépésenként) ---
  const ev = ctx.events.filter((e) => e.href === href);
  const usersOf = (types: string[]) => new Set(ev.filter((e) => types.includes(e.event)).map((e) => e.user)).size;
  const viewUsers = new Set(ctx.views.filter((v) => v.href === href && v.at >= ctx.start).map((v) => v.user)).size;
  const tracked = ctx.eventsAll.some((e) => e.href === href);
  const funnel = tracked ? [
    { step: "Megnyitás", users: viewUsers },
    { step: "Űrlap elkezdése", users: usersOf(["form_start"]) },
    { step: "Futtatás indítása", users: usersOf(["run_start"]) },
    { step: "Sikeres eredmény", users: usersOf(["run_success"]) },
    { step: "Letöltés / megosztás", users: usersOf(["download", "share"]) },
  ] : null;

  // --- eszközök (különböző felhasználók; az eszköz-szűrőtől függetlenül) ---
  const devUsers = (d: string) => new Set(ctx.eventsAll.filter((e) => e.href === href && e.device === d).map((e) => e.user)).size;
  const devices = { mobile: devUsers("mobile"), tablet: devUsers("tablet"), desktop: devUsers("desktop") };

  // --- minőség (a meglévő jelek + az eseménynapló) ---
  const quality = await qualitySignals(href, ctx.start, mine.length);
  const stats = runStats(ctx.events, href);
  if (tracked) {
    quality.items.unshift(
      { label: "Hibás futtatás", value: stats.failurePct === null ? "—" : `${stats.failurePct}%`, hint: `${stats.errors.length} hiba / ${stats.finished} lezárult futtatás` },
      { label: "Medián futási idő", value: stats.avgSeconds === null ? "—" : fmtSec(stats.avgSeconds) },
    );
  }
  const errCount = new Map<string, number>();
  for (const e of stats.errors) errCount.set(e.detail ?? "ismeretlen", (errCount.get(e.detail ?? "ismeretlen") ?? 0) + 1);
  const topErrors = [...errCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, n]) => ({ code, n }));

  return {
    module: mod,
    runs: mine.length,
    users: new Set(mine.map((r) => r.user)).size,
    retention: { ...ret, startedHere, avgCurve },
    heat: { weekdays: WEEKDAYS, slots: SLOTS.map((s) => s.t), cells: heat },
    links: {
      before: rank(before), after: rank(after),
      firstOfDayPct: mine.length ? Math.round((firstOfDay / mine.length) * 100) : null,
      onlyThisPct: mine.length ? Math.round((onlyThis / mine.length) * 100) : null,
    },
    quality: { ...quality, topErrors },
    funnel,
    devices,
    tracked,
  };
}

/** Másodperc → „48 mp" / „3 p 40 mp". */
export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} p${s ? ` ${s} mp` : ""}` : `${s} mp`;
}

/** Modul-specifikus minőségi jelek, amik már most is rögzülnek. */
async function qualitySignals(href: string, start: number, runs: number) {
  const admin = createAdminClient();
  const since = new Date(start || 0).toISOString();
  const items: { label: string; value: string; hint?: string }[] = [];
  let reasons: { reason: string; at: string }[] = [];

  if (href === "/dashboard/real-estate/valuation") {
    const [{ count: all }, { count: edited }] = await Promise.all([
      admin.from("usage_history").select("id", { count: "exact", head: true }).eq("feature_used", "valuation").gte("created_at", since),
      admin.from("usage_history").select("id", { count: "exact", head: true }).eq("feature_used", "valuation").gte("created_at", since).not("edited_at", "is", null),
    ]);
    const p = pct(edited ?? 0, all ?? 0);
    items.push({ label: "Utólag szerkesztett eredmény", value: p === null ? "—" : `${p}%`, hint: "a partner kézzel javított a becslésen" });
  }
  if (href === "/dashboard/real-estate/image-enhance") {
    const [{ count: regen }, { data: rej }] = await Promise.all([
      admin.from("usage_history").select("id", { count: "exact", head: true }).eq("feature_used", "image_enhance_regenerate").gte("created_at", since),
      admin.from("enhance_rejections").select("reason, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    ]);
    items.push({ label: "Újragenerálás", value: String(regen ?? 0), hint: runs ? `a futtatások ${Math.round(((regen ?? 0) / runs) * 100)}%-a` : undefined });
    items.push({ label: "Elutasított eredmény", value: String(rej?.length ?? 0), hint: "a partner nem fogadta el, újat kért" });
    reasons = (rej ?? []).filter((r) => r.reason).map((r) => ({ reason: r.reason as string, at: r.created_at as string }));
  }
  return { items, reasons };
}
