// GET /api/office/ledger?scope=office|me&limit=20 — kredit-mozgások a KIVÁLASZTOTT irodában.
//   • scope=office: az iroda feltöltései, kiosztásai, korrekciói (ki, kinek, mennyit, mikor, megjegyzés)
//     — CSAK létrehozó / vezető.
//   • scope=me: a saját keretem változásai (kapott keret, költések, visszatérítések) — bármely tag.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/office-server";
import { ledger } from "@/lib/office-overview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit")) || 20;

  if (params.get("scope") === "office") {
    if (!(me.role === "owner" || me.can_allocate)) {
      return NextResponse.json({ error: "Az iroda kredit-naplóját a létrehozó és a vezető látja." }, { status: 403 });
    }
    return NextResponse.json({ items: await ledger(me.office_id, { kind: "office" }, limit) });
  }

  return NextResponse.json({ items: await ledger(me.office_id, { kind: "member", userId: user.id }, limit) });
}
