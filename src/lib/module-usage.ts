// Admin „Modul-használat" összesítő (MH3) — CSAK szerveroldal (service_role).
// Források: usage_history (futtatás) · module_views (megnyitás, fejenként naponta egy sor, 20261012183311_module-views.sql)
// · user_module_favorites · profiles (szerepkör, forrás, regisztráció) · offices / office_members / office_transfers.
// Nincs benne pénzügy. Modul-kulcs: a katalógus útvonala (href); a futtatásnál FEATURE_TO_HREF fordít.
//
// Fogalmak:
//   • futtatás     = egy usage_history sor (minden futtatás számít)
//   • megnyitás    = egy module_views sor (felhasználó × modul × nap)
//   • megnyitásból futtatás = akik megnyitották ÉS futtatták / akik megnyitották (az időszakban)
//   • visszatérő   = a modul felhasználóinak hány %-a futtatta legalább 2-szer
//   • aktív / alvó / még nem futtatott = az utolsó futtatás 30 napon belül / régebben / soha
import { createAdminClient } from "@/lib/supabase/admin";
import { activityTitle } from "@/lib/activity";
import { FEATURE_TO_HREF, selectableModules } from "@/lib/module-favorites";
import { LANDING_SIGNUP_SOURCE, SIGNUP_SOURCE_LABEL } from "@/lib/onboarding";

export type UsageRange = "7d" | "30d" | "90d" | "all";
export type UsageSource = "all" | "direct" | "landing";
export type UsageMode = "all" | "private" | "office" | "team";
export type RegWindow = "today" | "7d" | "30d" | "90d" | "12m" | "all";
export type RegGroup = "day" | "week" | "month";
export type UsageFilters = { range: UsageRange; source: UsageSource; mode: UsageMode; staff: boolean };

const DAY = 24 * 3600 * 1000;
const RANGE_DAYS: Record<Exclude<UsageRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };
const SLEEP_DAYS = 30;
const PAGE = 1000;
const MAX_ROWS = 100_000;

export function parseFilters(p: URLSearchParams): UsageFilters {
  const r = p.get("range"), s = p.get("source"), m = p.get("mode");
  return {
    range: r === "7d" || r === "30d" || r === "90d" || r === "all" ? r : "30d",
    source: s === "direct" || s === "landing" ? s : "all",
    mode: m === "private" || m === "office" || m === "team" ? m : "all",
    staff: p.get("staff") === "1",
  };
}

// ---------------------------------------------------------------------------
// Alapadatok betöltése (lapozva — a Supabase egyszerre 1000 sort ad)
// ---------------------------------------------------------------------------
type Run = { user: string; href: string; at: number; office: string | null };
type View = { user: string; href: string; at: number };
type Person = { id: string; email: string; name: string; role: string; source: string | null; createdAt: number };
type Office = { id: string; name: string; kind: "office" | "team"; ownerId: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

async function loadBase(sinceIso: string | null) {
  const admin = createAdminClient();

  // felhasználók (e-mail, regisztráció) — az auth listából, lapozva
  const authUsers: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const list = data?.users ?? [];
    authUsers.push(...list);
    if (list.length < 1000) break;
  }

  const [profiles, offices, members, favorites, history, views, transfers] = await Promise.all([
    fetchAll<{ id: string; role: string; full_name: string | null; signup_source: string | null; created_at: string }>((a, b) =>
      admin.from("profiles").select("id, role, full_name, signup_source, created_at").range(a, b)),
    fetchAll<{ id: string; name: string; kind?: string; owner_id: string | null }>((a, b) =>
      admin.from("offices").select("id, name, kind, owner_id").range(a, b)),
    fetchAll<{ office_id: string; user_id: string; role: string; joined_at: string }>((a, b) =>
      admin.from("office_members").select("office_id, user_id, role, joined_at").range(a, b)),
    fetchAll<{ user_id: string; module_href: string }>((a, b) =>
      admin.from("user_module_favorites").select("user_id, module_href").range(a, b)),
    // a futtatásokat MINDIG teljes időtávra kérjük (az aktív/alvó állapothoz és az előző időszakhoz kell)
    fetchAll<{ user_id: string; feature_used: string; created_at: string; office_id: string | null }>((a, b) =>
      admin.from("usage_history").select("user_id, feature_used, created_at, office_id").order("created_at", { ascending: true }).range(a, b)),
    fetchAll<{ user_id: string; module_href: string; first_at: string }>((a, b) => {
      let q = admin.from("module_views").select("user_id, module_href, first_at");
      if (sinceIso) q = q.gte("first_at", sinceIso);
      return q.range(a, b);
    }),
    fetchAll<{ office_id: string | null; amount: number; created_at: string }>((a, b) =>
      admin.from("office_transfers").select("office_id, amount, created_at").range(a, b)),
  ]);

  const prof = new Map(profiles.map((p) => [p.id, p]));
  const people = new Map<string, Person>();
  for (const u of authUsers) {
    const p = prof.get(u.id);
    const meta = (u.user_metadata ?? {}) as { full_name?: string };
    people.set(u.id, {
      id: u.id,
      email: u.email ?? "—",
      name: (p?.full_name ?? meta.full_name ?? "").trim(),
      role: p?.role ?? "user",
      source: p?.signup_source ?? null,
      createdAt: Date.parse(p?.created_at ?? u.created_at ?? "") || 0,
    });
  }

  const officeList: Office[] = offices.map((o) => ({ id: o.id, name: o.name, kind: o.kind === "team" ? "team" : "office", ownerId: o.owner_id }));
  const runs: Run[] = history.flatMap((h) => {
    const href = FEATURE_TO_HREF[h.feature_used];
    return href ? [{ user: h.user_id, href, at: Date.parse(h.created_at), office: h.office_id }] : [];
  });
  const viewRows: View[] = views.map((v) => ({ user: v.user_id, href: v.module_href, at: Date.parse(v.first_at) }));

  return { people, offices: officeList, members, favorites, runs, views: viewRows, transfers, history };
}

// ---------------------------------------------------------------------------
// Segédek
// ---------------------------------------------------------------------------
function windowOf(range: UsageRange, now: number) {
  if (range === "all") return { start: 0, prevStart: null as number | null };
  const len = RANGE_DAYS[range] * DAY;
  return { start: now - len, prevStart: now - 2 * len };
}

const isLanding = (p: Person) => p.source === LANDING_SIGNUP_SOURCE;
const isStaff = (p: Person) => p.role === "admin" || p.role === "sales";

function userFilter(f: UsageFilters) {
  return (p: Person | undefined) => {
    if (!p) return false;
    if (!f.staff && isStaff(p)) return false;
    if (f.source === "landing" && !isLanding(p)) return false;
    if (f.source === "direct" && isLanding(p)) return false;
    return true;
  };
}

function modeFilter(f: UsageFilters, kindOf: Map<string, "office" | "team">) {
  return (r: Run) => {
    if (f.mode === "all") return true;
    if (f.mode === "private") return !r.office;
    return !!r.office && kindOf.get(r.office) === f.mode;
  };
}

function count<K>(m: Map<K, number>, k: K, by = 1) { m.set(k, (m.get(k) ?? 0) + by); }

// ---------------------------------------------------------------------------
// ÁTTEKINTŐ
// ---------------------------------------------------------------------------
export async function moduleUsageOverview(f: UsageFilters, reg: { window: RegWindow; group: RegGroup }) {
  const now = Date.now();
  const { start, prevStart } = windowOf(f.range, now);
  const viewSince = prevStart ?? (f.range === "all" ? null : start);
  const base = await loadBase(viewSince === null ? null : new Date(viewSince).toISOString());
  const modules = selectableModules().map((m) => ({ href: m.href, label: m.label }));
  const labelOf = new Map(modules.map((m) => [m.href, m.label]));
  const kindOf = new Map(base.offices.map((o) => [o.id, o.kind]));

  const keepUser = userFilter(f);
  const keepMode = modeFilter(f, kindOf);
  const runsAll = base.runs.filter((r) => keepUser(base.people.get(r.user)));
  const runsIn = runsAll.filter((r) => r.at >= start && keepMode(r));
  const runsPrev = prevStart === null ? [] : runsAll.filter((r) => r.at >= prevStart && r.at < start && keepMode(r));
  const viewsIn = base.views.filter((v) => v.at >= start && keepUser(base.people.get(v.user)));

  // --- KPI ---
  const activeUsers = new Set(runsIn.map((r) => r.user));
  const activePrev = new Set(runsPrev.map((r) => r.user));
  const viewers = new Set(viewsIn.map((v) => v.user));
  const viewersWhoRan = [...viewers].filter((u) => activeUsers.has(u)).length;
  const lastRun = new Map<string, number>();
  for (const r of runsAll) lastRun.set(r.user, Math.max(lastRun.get(r.user) ?? 0, r.at));
  const sleeping = [...lastRun.values()].filter((t) => t < now - SLEEP_DAYS * DAY).length;

  // --- modul-rangsor ---
  const runsBy = new Map<string, number>(), prevBy = new Map<string, number>(), viewsBy = new Map<string, number>();
  const userRunsBy = new Map<string, Map<string, number>>(), viewUsersBy = new Map<string, Set<string>>();
  for (const r of runsIn) {
    count(runsBy, r.href);
    const m = userRunsBy.get(r.href) ?? new Map<string, number>();
    count(m, r.user); userRunsBy.set(r.href, m);
  }
  for (const r of runsPrev) count(prevBy, r.href);
  for (const v of viewsIn) {
    count(viewsBy, v.href);
    const s = viewUsersBy.get(v.href) ?? new Set<string>(); s.add(v.user); viewUsersBy.set(v.href, s);
  }
  const favBy = new Map<string, number>();
  for (const fv of base.favorites) if (keepUser(base.people.get(fv.user_id))) count(favBy, fv.module_href);

  const ranking = modules.map((m) => {
    const users = userRunsBy.get(m.href) ?? new Map<string, number>();
    const vUsers = viewUsersBy.get(m.href) ?? new Set<string>();
    const runs = runsBy.get(m.href) ?? 0, prev = prevBy.get(m.href) ?? 0;
    const returning = users.size ? [...users.values()].filter((n) => n >= 2).length / users.size : 0;
    const conversion = vUsers.size ? [...vUsers].filter((u) => users.has(u)).length / vUsers.size : null;
    const change = prevStart === null ? null : prev === 0 ? (runs > 0 ? "new" : null) : Math.round(((runs - prev) / prev) * 100);
    const flags: ("interest" | "rising")[] = [];
    if (vUsers.size >= 5 && conversion !== null && conversion < 0.35) flags.push("interest");
    if (typeof change === "number" && change >= 30 && runs >= 5) flags.push("rising");
    return {
      href: m.href, label: m.label, views: viewsBy.get(m.href) ?? 0, viewUsers: vUsers.size, runs, users: users.size,
      returningPct: Math.round(returning * 100), conversionPct: conversion === null ? null : Math.round(conversion * 100),
      change, favorites: favBy.get(m.href) ?? 0, flags,
    };
  }).sort((a, b) => b.runs - a.runs || b.views - a.views);

  // --- felhasználók TOP 5-tel ---
  const perUser = new Map<string, Map<string, number>>();
  for (const r of runsIn) { const m = perUser.get(r.user) ?? new Map<string, number>(); count(m, r.href); perUser.set(r.user, m); }
  const viewsPerUser = new Map<string, number>(), lastView = new Map<string, number>();
  for (const v of viewsIn) count(viewsPerUser, v.user);
  for (const v of base.views) lastView.set(v.user, Math.max(lastView.get(v.user) ?? 0, v.at));
  const memberships = new Map<string, string[]>();
  const officeName = new Map(base.offices.map((o) => [o.id, o.name]));
  for (const mm of base.members) memberships.set(mm.user_id, [...(memberships.get(mm.user_id) ?? []), officeName.get(mm.office_id) ?? "Iroda"]);

  const users = [...base.people.values()].filter(keepUser).map((p) => {
    const m = perUser.get(p.id) ?? new Map<string, number>();
    const top5 = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([href, n]) => ({ href, label: labelOf.get(href) ?? href, runs: n }));
    const last = lastRun.get(p.id) ?? 0;
    const status = !last ? "never" : last >= now - SLEEP_DAYS * DAY ? "active" : "sleeping";
    return {
      id: p.id, name: p.name, email: p.email, role: p.role,
      source: p.source ? SIGNUP_SOURCE_LABEL[p.source] ?? p.source : "Közvetlen",
      offices: memberships.get(p.id) ?? [],
      top5, runs: [...m.values()].reduce((s, n) => s + n, 0), views: viewsPerUser.get(p.id) ?? 0, tried: m.size,
      lastActive: Math.max(last, lastView.get(p.id) ?? 0) || null, status,
    };
  }).sort((a, b) => b.runs - a.runs || (b.lastActive ?? 0) - (a.lastActive ?? 0)).slice(0, 500);

  // --- irodák és munkaterek ---
  const membersOf = new Map<string, string[]>();
  for (const mm of base.members) membersOf.set(mm.office_id, [...(membersOf.get(mm.office_id) ?? []), mm.user_id]);
  const allRunsIn = base.runs.filter((r) => r.at >= start && keepUser(base.people.get(r.user)));
  const viewersAll = new Set(viewsIn.map((v) => v.user));
  const transfersIn = base.transfers.filter((t) => Date.parse(t.created_at) >= start);
  const officeRows = base.offices.map((o) => {
    const mem = (membersOf.get(o.id) ?? []).filter((u) => keepUser(base.people.get(u)));
    const runs = allRunsIn.filter((r) => r.office === o.id);
    const mix = new Map<string, number>();
    for (const r of runs) count(mix, r.href);
    const active = new Set(runs.map((r) => r.user));
    const memViewers = mem.filter((u) => viewersAll.has(u));
    const tr = transfersIn.filter((t) => t.office_id === o.id);
    const mixList = [...mix.entries()].sort((a, b) => b[1] - a[1]).map(([href, n]) => ({ href, label: labelOf.get(href) ?? href, runs: n }));
    return {
      id: o.id, name: o.name, kind: o.kind, owner: o.ownerId ? base.people.get(o.ownerId)?.email ?? "—" : "—",
      members: mem.length, activeMembers: active.size, runs: runs.length,
      conversionPct: memViewers.length ? Math.round((memViewers.filter((u) => active.has(u)).length / memViewers.length) * 100) : null,
      transfers: { count: tr.length, sum: tr.reduce((s, t) => s + (t.amount ?? 0), 0) },
      mix: mixList.slice(0, 6), top: mixList[0]?.label ?? null,
    };
  }).sort((a, b) => b.runs - a.runs || b.members - a.members);

  return {
    filters: f,
    modules,
    kpi: {
      runs: runsIn.length, runsPrev: prevStart === null ? null : runsPrev.length,
      activeUsers: activeUsers.size, activePrev: prevStart === null ? null : activePrev.size,
      conversionPct: viewers.size ? Math.round((viewersWhoRan / viewers.size) * 100) : null,
      topModule: ranking[0]?.runs ? ranking[0].label : null,
      sleeping,
    },
    registrations: registrations([...base.people.values()].filter((p) => f.staff || !isStaff(p)), new Set(lastRun.keys()), reg, now),
    ranking,
    users,
    offices: { office: officeRows.filter((o) => o.kind === "office"), team: officeRows.filter((o) => o.kind === "team") },
    viewsSince: viewSince ? new Date(viewSince).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// ÚJ REGISZTRÁLÓK — csempék (több időszak egyszerre) + a kiválasztott ablak grafikonja és bontása
// ---------------------------------------------------------------------------
const REG_DAYS: Record<Exclude<RegWindow, "today" | "all">, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

function budapestDayStart(now: number): number {
  const d = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
  return now - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000;
}

function registrations(people: Person[], ranSomeone: Set<string>, reg: { window: RegWindow; group: RegGroup }, now: number) {
  const today = budapestDayStart(now);
  const startOf = (w: RegWindow) => (w === "today" ? today : w === "all" ? 0 : now - REG_DAYS[w] * DAY);
  const inWin = (p: Person, from: number, to = now) => p.createdAt >= from && p.createdAt < to;
  const tile = (w: RegWindow) => {
    const from = startOf(w);
    const n = people.filter((p) => inWin(p, from)).length;
    const prev = w === "today" || w === "all" ? null : people.filter((p) => inWin(p, from - (now - from), from)).length;
    return { window: w, count: n, prev };
  };
  const tiles = (["today", "7d", "30d", "90d", "12m", "all"] as RegWindow[]).map(tile);

  const from = startOf(reg.window);
  const sel = people.filter((p) => inWin(p, from));
  const firstAt = reg.window === "all" ? Math.min(...people.map((p) => p.createdAt).filter(Boolean), now) : from;
  // csoportosítás: a kért (nap / hét / hónap), de max. ~60 oszlop
  const bucketMs = reg.group === "day" ? DAY : reg.group === "week" ? 7 * DAY : 30 * DAY;
  const buckets = Math.min(60, Math.max(1, Math.ceil((now - firstAt) / bucketMs)));
  const series = Array.from({ length: buckets }, (_, i) => {
    const b0 = now - (buckets - i) * bucketMs, b1 = b0 + bucketMs;
    const inB = sel.filter((p) => p.createdAt >= b0 && p.createdAt < b1);
    return { from: new Date(b0).toISOString(), direct: inB.filter((p) => !isLanding(p)).length, landing: inB.filter(isLanding).length };
  });
  return {
    tiles,
    selected: {
      window: reg.window, group: reg.group, count: sel.length,
      direct: sel.filter((p) => !isLanding(p)).length, landing: sel.filter(isLanding).length,
      activated: sel.filter((p) => ranSomeone.has(p.id)).length,
      series,
    },
  };
}

// ---------------------------------------------------------------------------
// EGY FELHASZNÁLÓ RÉSZLETEI
// ---------------------------------------------------------------------------
export async function moduleUsageUser(userId: string, f: UsageFilters) {
  const now = Date.now();
  const { start } = windowOf(f.range, now);
  const admin = createAdminClient();
  const modules = selectableModules().map((m) => ({ href: m.href, label: m.label }));
  const labelOf = new Map(modules.map((m) => [m.href, m.label]));

  const [{ data: authUser }, { data: profile }, history, views, { data: favs }, { data: mems }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("role, full_name, signup_source, created_at").eq("id", userId).maybeSingle(),
    fetchAll<{ id: string; feature_used: string; input_data: Record<string, unknown> | null; created_at: string; office_id: string | null }>((a, b) =>
      admin.from("usage_history").select("id, feature_used, input_data, created_at, office_id").eq("user_id", userId)
        .order("created_at", { ascending: false }).range(a, b)),
    fetchAll<{ module_href: string; first_at: string }>((a, b) =>
      admin.from("module_views").select("module_href, first_at").eq("user_id", userId).order("first_at", { ascending: false }).range(a, b)),
    admin.from("user_module_favorites").select("module_href").eq("user_id", userId),
    admin.from("office_members").select("office_id, role").eq("user_id", userId),
  ]);
  if (!authUser?.user) return null;

  const officeIds = (mems ?? []).map((m) => m.office_id as string);
  const { data: offs } = officeIds.length
    ? await admin.from("offices").select("id, name, kind").in("id", officeIds)
    : { data: [] as { id: string; name: string; kind?: string }[] };
  const favSet = new Set((favs ?? []).map((x) => x.module_href as string));

  const runs = history.map((h) => ({ ...h, href: FEATURE_TO_HREF[h.feature_used] ?? null, at: Date.parse(h.created_at) }));
  const runsIn = runs.filter((r) => r.at >= start);
  const viewsIn = views.filter((v) => Date.parse(v.first_at) >= start);

  // modulonként: futtatás, megnyitás, utolsó használat, 30 napos napi görbe
  const sparkFrom = now - 30 * DAY;
  const table = modules.map((m) => {
    const mr = runsIn.filter((r) => r.href === m.href);
    const allR = runs.filter((r) => r.href === m.href);
    const spark = Array.from({ length: 30 }, (_, i) => {
      const d0 = sparkFrom + i * DAY;
      return allR.filter((r) => r.at >= d0 && r.at < d0 + DAY).length;
    });
    return {
      href: m.href, label: m.label, runs: mr.length, views: viewsIn.filter((v) => v.module_href === m.href).length,
      lastUsed: allR[0]?.created_at ?? null, favorite: favSet.has(m.href), spark,
    };
  }).sort((a, b) => b.runs - a.runs || b.views - a.views);

  // idővonal: futtatások + megnyitások, max. 50
  const timeline = [
    ...runs.slice(0, 50).map((r) => ({
      kind: "run" as const, at: r.created_at,
      module: r.href ? labelOf.get(r.href) ?? r.feature_used : r.feature_used,
      title: activityTitle(r.feature_used, r.input_data, r.created_at),
    })),
    ...views.slice(0, 50).map((v) => ({ kind: "view" as const, at: v.first_at, module: labelOf.get(v.module_href) ?? v.module_href, title: null })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 50);

  // automatikus összegzés (a számokból, AI nélkül)
  const totalRuns = runsIn.length;
  const used = table.filter((t) => t.runs > 0);
  const lastAt = Math.max(runs[0]?.at ?? 0, Date.parse(views[0]?.first_at ?? "") || 0);
  const parts: string[] = [];
  if (!totalRuns) parts.push("Ebben az időszakban nem futtatott modult.");
  else {
    const top = used[0];
    parts.push(`Főleg a(z) ${top.label} modult használja (a futtatásai ${Math.round((top.runs / totalRuns) * 100)}%-a).`);
    if (used.length >= 4) parts.push(`Sokféle modult kipróbált (${used.length}).`);
  }
  const lurk = table.find((t) => t.views >= 3 && t.runs <= Math.floor(t.views / 4));
  if (lurk) parts.push(`A(z) ${lurk.label} modult sokszor megnyitja (${lurk.views}×), de ritkán futtatja (${lurk.runs}×) — érdemes rákérdezni, mi tartja vissza.`);
  const officeRuns = runsIn.filter((r) => r.office_id).length;
  if (officeRuns) parts.push(`Irodai / munkatér módban készült munkái: ${officeRuns}.`);
  if (lastAt && lastAt < now - SLEEP_DAYS * DAY) parts.push("30 napja nem volt aktív.");

  const viewUsersRan = table.filter((t) => t.views > 0);
  return {
    user: {
      id: userId, email: authUser.user.email ?? "—",
      name: ((profile?.full_name as string) ?? "").trim(),
      role: (profile?.role as string) ?? "user",
      source: profile?.signup_source ? SIGNUP_SOURCE_LABEL[profile.signup_source as string] ?? (profile.signup_source as string) : "Közvetlen",
      createdAt: (profile?.created_at as string) ?? authUser.user.created_at ?? null,
      offices: (offs ?? []).map((o) => ({ id: o.id as string, name: o.name as string, kind: o.kind === "team" ? "team" : "office" })),
    },
    kpi: {
      runs: totalRuns, views: viewsIn.length,
      conversionPct: viewUsersRan.length ? Math.round((viewUsersRan.filter((t) => t.runs > 0).length / viewUsersRan.length) * 100) : null,
      tried: used.length, modules: modules.length,
      lastActive: lastAt ? new Date(lastAt).toISOString() : null,
    },
    summary: parts.join(" "),
    modules: table,
    timeline,
  };
}

// ---------------------------------------------------------------------------
// EGY IRODA / MUNKATÉR RÉSZLETEI — tag × modul (az irodában készült futtatások)
// ---------------------------------------------------------------------------
export async function moduleUsageOffice(officeId: string, f: UsageFilters) {
  const now = Date.now();
  const { start } = windowOf(f.range, now);
  const admin = createAdminClient();
  const modules = selectableModules().map((m) => ({ href: m.href, label: m.label }));

  const [{ data: office }, { data: mems }, history, folders] = await Promise.all([
    admin.from("offices").select("id, name, kind").eq("id", officeId).maybeSingle(),
    admin.from("office_members").select("user_id, role, joined_at").eq("office_id", officeId),
    fetchAll<{ user_id: string; feature_used: string; created_at: string }>((a, b) =>
      admin.from("usage_history").select("user_id, feature_used, created_at").eq("office_id", officeId).range(a, b)),
    admin.from("office_folders").select("id", { count: "exact", head: true }).eq("office_id", officeId),
  ]);
  if (!office) return null;

  const ids = (mems ?? []).map((m) => m.user_id as string);
  const { data: profs } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map((profs ?? []).map((p) => [p.id as string, ((p.full_name as string) ?? "").trim()]));
  await Promise.all(ids.filter((id) => !nameOf.get(id)).map(async (id) => {
    const { data } = await admin.auth.admin.getUserById(id);
    nameOf.set(id, data.user?.email ?? "—");
  }));

  const runsIn = history.filter((h) => Date.parse(h.created_at) >= start)
    .map((h) => ({ user: h.user_id, href: FEATURE_TO_HREF[h.feature_used] ?? null })).filter((r) => r.href);
  const matrix = ids.map((id) => ({
    userId: id, name: nameOf.get(id) ?? "—",
    counts: modules.map((m) => runsIn.filter((r) => r.user === id && r.href === m.href).length),
  })).sort((a, b) => b.counts.reduce((s, n) => s + n, 0) - a.counts.reduce((s, n) => s + n, 0));

  return {
    office: { id: office.id as string, name: office.name as string, kind: office.kind === "team" ? "team" : "office" },
    kpi: {
      runs: runsIn.length, members: ids.length,
      activeMembers: new Set(runsIn.map((r) => r.user)).size,
      folders: folders.count ?? 0,
    },
    modules,
    matrix,
  };
}

// ---------------------------------------------------------------------------
// EGY MODUL RÉSZLETEI (MH5) — kik használják a legtöbbet + napi görbe (futtatás és megnyitás)
// ---------------------------------------------------------------------------
export async function moduleUsageModule(href: string, f: UsageFilters) {
  const mod = selectableModules().find((m) => m.href === href);
  if (!mod) return null;
  const now = Date.now();
  const { start } = windowOf(f.range, now);
  // a görbe max. 90 napot mutat (az „összes" időszaknál az utolsó 90 napot)
  const days = f.range === "all" ? 90 : RANGE_DAYS[f.range];
  const curveFrom = now - days * DAY;
  // a megnyitások az időszak elejétől kellenek (az „összes”-nél mind)
  const base = await loadBase(f.range === "all" ? null : new Date(start).toISOString());
  const kindOf = new Map(base.offices.map((o) => [o.id, o.kind]));
  const keepUser = userFilter(f), keepMode = modeFilter(f, kindOf);

  const runs = base.runs.filter((r) => r.href === href && keepUser(base.people.get(r.user)) && keepMode(r));
  const views = base.views.filter((v) => v.href === href && keepUser(base.people.get(v.user)));
  const runsIn = runs.filter((r) => r.at >= start), viewsIn = views.filter((v) => v.at >= start);

  const perUser = new Map<string, { runs: number; views: number; last: number }>();
  for (const r of runsIn) { const x = perUser.get(r.user) ?? { runs: 0, views: 0, last: 0 }; x.runs++; x.last = Math.max(x.last, r.at); perUser.set(r.user, x); }
  for (const v of viewsIn) { const x = perUser.get(v.user) ?? { runs: 0, views: 0, last: 0 }; x.views++; x.last = Math.max(x.last, v.at); perUser.set(v.user, x); }
  const top = [...perUser.entries()]
    .sort((a, b) => b[1].runs - a[1].runs || b[1].views - a[1].views)
    .slice(0, 50)
    .map(([id, x]) => {
      const p = base.people.get(id);
      return { id, name: p?.name ?? "", email: p?.email ?? "—", source: p?.source ? SIGNUP_SOURCE_LABEL[p.source] ?? p.source : "Közvetlen", ...x, last: x.last ? new Date(x.last).toISOString() : null };
    });

  const curve = Array.from({ length: days }, (_, i) => {
    const d0 = curveFrom + i * DAY;
    return {
      day: new Date(d0).toISOString().slice(0, 10),
      runs: runs.filter((r) => r.at >= d0 && r.at < d0 + DAY).length,
      views: views.filter((v) => v.at >= d0 && v.at < d0 + DAY).length,
    };
  });

  return {
    module: { href: mod.href, label: mod.label },
    kpi: { runs: runsIn.length, views: viewsIn.length, users: new Set(runsIn.map((r) => r.user)).size, viewUsers: new Set(viewsIn.map((v) => v.user)).size },
    top,
    curve,
  };
}
