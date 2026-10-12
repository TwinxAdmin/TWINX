// /api/office/transfers — KÖZÖS MUNKATÉR: kredit átadása társnak a SAJÁT pénztárcából (KM6).
//   GET  — a SAJÁT átadásaim a kiválasztott munkatérben (amit adtam / kaptam), max. 50.
//   POST { items: [{ userId, amount }], note? } — átadás egy vagy több társnak.
//        Tagonként a team_wallet_transfer() fut (atomikus, naplózott, mínuszba nem mehet).
//        Visszavétel NINCS. Ha közben hiba van, a már sikeres átadások megmaradnak — a válasz megmondja, melyek.
// Szabály: csak közös munkatérben (offices.kind = team), csak a munkatér tagjai között, magadnak nem.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOCATE_MAX, ALLOCATE_NOTE_MAX } from "@/lib/office";
import { getMembership, officeErrorMessage, officeKind } from "@/lib/office-server";
import { teamTransfers } from "@/lib/office-overview";

export const runtime = "nodejs";

const MIGRATION = "A kredit-átadáshoz futtasd le a 20261012105023_team-workspace.sql migrációt.";

async function teamMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const m = await getMembership(user.id);
  if (!m) return { error: NextResponse.json({ error: "Nem vagy tagja közös munkatérnek." }, { status: 403 }) };
  if ((await officeKind(m.office_id)) !== "team") {
    return { error: NextResponse.json({ error: "Kreditet átadni csak közös munkatérben lehet." }, { status: 403 }) };
  }
  return { userId: user.id, officeId: m.office_id };
}

export async function GET() {
  const me = await teamMember();
  if ("error" in me) return me.error;
  return NextResponse.json({ items: await teamTransfers(me.officeId, me.userId) });
}

export async function POST(request: Request) {
  const me = await teamMember();
  if ("error" in me) return me.error;

  let body: { items?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const raw = Array.isArray(body.items) ? body.items : [];
  const items = raw.map((x) => ({ userId: String((x as { userId?: unknown })?.userId ?? ""), amount: Number((x as { amount?: unknown })?.amount) }));
  if (items.length === 0) return NextResponse.json({ error: "Válaszd ki, kinek mennyit adsz." }, { status: 422 });
  if (items.length > 4) return NextResponse.json({ error: "Egyszerre legfeljebb 4 társnak adhatsz." }, { status: 422 });
  if (new Set(items.map((i) => i.userId)).size !== items.length) return NextResponse.json({ error: "Egy társ csak egyszer szerepelhet." }, { status: 422 });
  if (items.some((i) => !i.userId)) return NextResponse.json({ error: "Hiányzó társ." }, { status: 422 });
  if (items.some((i) => i.userId === me.userId)) return NextResponse.json({ error: "Magadnak nem adhatsz kreditet." }, { status: 422 });
  if (items.some((i) => !Number.isInteger(i.amount) || i.amount < 1 || i.amount > ALLOCATE_MAX)) {
    return NextResponse.json({ error: `1 és ${ALLOCATE_MAX} közötti egész számot adj meg.` }, { status: 422 });
  }
  if (typeof body.note === "string" && body.note.trim().length > ALLOCATE_NOTE_MAX) {
    return NextResponse.json({ errors: { note: `A megjegyzés legfeljebb ${ALLOCATE_NOTE_MAX} karakter lehet.` } }, { status: 422 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";

  // 2) Átadás tagonként (a függvény ellenőrzi a tagságot és az egyenleget)
  const admin = createAdminClient();
  const done: string[] = [];
  let balance: number | null = null;
  for (const it of items) {
    const { data, error } = await admin.rpc("team_wallet_transfer", {
      p_office: me.officeId, p_from: me.userId, p_to: it.userId, p_amount: it.amount, p_note: note || null,
    });
    if (error) {
      const missing = /team_wallet_transfer|function .* does not exist/i.test(error.message) && !/TEAM_/.test(error.message);
      return NextResponse.json(
        { error: missing ? MIGRATION : officeErrorMessage(error.message), done, balance },
        { status: missing ? 500 : /TEAM_/.test(error.message) ? 409 : 500 },
      );
    }
    done.push(it.userId);
    balance = typeof data === "number" ? data : balance;
  }

  return NextResponse.json({ ok: true, done, balance });
}
