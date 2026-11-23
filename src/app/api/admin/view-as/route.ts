// /api/admin/view-as — az admin „így látja…" előnézete (CSAK admin; terv 12 / 1. szakasz, 3f).
//   POST { view: "user" | null }        — általános felhasználói nézet / vissza adminra
//   POST { asUserId: "<uuid>" | null }  — „így látja Y felhasználó" (cég választásakor a cégvezető vagy az első tag)
//   GET  ?q=…                           — kereső: felhasználók és cégek (név, e-mail, cég)
//
// A cookie CSAK a megjelenítést befolyásolja: a jogosultság-ellenőrzések és a levonás a valódi felhasználót nézik
// (lib/view-as.ts), és felhasználó szerinti előnézetben a middleware minden beküldést (nem GET API-hívást) letilt.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIEW_AS_COOKIE, VIEW_AS_USER_COOKIE } from "@/lib/view-as";

export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return me?.role === "admin" ? user : null;
}

const COOKIE = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 }; // 8 óra

export type ViewAsHit = { kind: "user" | "company"; id: string; userId: string | null; title: string; sub: string };

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Csak admin használhatja." }, { status: 403 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const admin = createAdminClient();
  const [{ data: list }, { data: profs }, comps, members] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, full_name, role"),
    admin.from("companies").select("id, name, status").neq("status", "lezart"),
    admin.from("company_members").select("company_id, user_id, is_company_head, joined_at").eq("status", "aktiv"),
  ]);
  const prof = new Map((profs ?? []).map((p) => [p.id as string, p]));
  const users: ViewAsHit[] = (list?.users ?? [])
    .filter((u) => prof.get(u.id)?.role !== "admin")
    .map((u) => ({ kind: "user" as const, id: u.id, userId: u.id, title: (prof.get(u.id)?.full_name as string) || u.email || "", sub: u.email ?? "" }));
  // Cég → a cégvezető (ha több van, az első), különben az elsőként csatlakozott tag.
  const companies: ViewAsHit[] = (comps.data ?? []).map((c) => {
    const ms = (members.data ?? []).filter((m) => m.company_id === c.id)
      .sort((a, b) => Number(b.is_company_head) - Number(a.is_company_head) || String(a.joined_at).localeCompare(String(b.joined_at)));
    const pick = ms[0]?.user_id as string | undefined;
    const who = pick ? ((prof.get(pick)?.full_name as string) || (list?.users ?? []).find((u) => u.id === pick)?.email || "") : "";
    return { kind: "company" as const, id: c.id as string, userId: pick ?? null, title: c.name as string, sub: pick ? `így látja: ${who}` : "nincs tagja" };
  });
  const match = (h: ViewAsHit) => !q || h.title.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q);
  return NextResponse.json({ hits: [...companies.filter(match), ...users.filter(match)].slice(0, 40) });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Csak admin használhatja." }, { status: 403 });
  let body: { view?: string | null; asUserId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const res = NextResponse.json({ ok: true });
  if (typeof body.asUserId === "string" && /^[0-9a-f-]{36}$/i.test(body.asUserId)) {
    // Admint nem lehet „megszemélyesíteni" (csak lefelé lehet váltani).
    const { data: target } = await createAdminClient().from("profiles").select("role").eq("id", body.asUserId).maybeSingle();
    if (!target) return NextResponse.json({ error: "A felhasználó nem található." }, { status: 404 });
    if (target.role === "admin") return NextResponse.json({ error: "Admin nézetét nem lehet előnézni." }, { status: 422 });
    res.cookies.set(VIEW_AS_USER_COOKIE, body.asUserId, COOKIE);
    res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  const view = body.view === "user" ? "user" : null;
  res.cookies.set(VIEW_AS_USER_COOKIE, "", { path: "/", maxAge: 0 });
  if (view) res.cookies.set(VIEW_AS_COOKIE, view, COOKIE);
  else res.cookies.set(VIEW_AS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
