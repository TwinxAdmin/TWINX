// POST /api/works/bulk — Korábbi munkák tömeges műveletei (egy vagy több elem, egy lépésben).
//   { action: "trash" | "restore" | "purge", ids: string[] }
//   • trash   — lomtárba (visszaállítható; WORKS_TRASH_DAYS nap után véglegesen törlődik)
//   • restore — vissza a lomtárból
//   • purge   — VÉGLEGES törlés (csak lomtárban lévő munka): a fájlok a Storage-ból is törlődnek
// Elemenként szerveroldali jogosultság-ellenőrzés (saját munka; irodában a létrehozó / vezető a csapatét is).
// Ha egy elem nem sikerül, a többi végigmegy — a válasz elemenként jelzi az eredményt. A kredit nem jár vissza.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setTrashed, purgeWorks } from "@/lib/works-trash";

export const runtime = "nodejs";
export const maxDuration = 300; // sok elem végleges törlése (Storage + adatbázis) is beleférjen

const MAX_IDS = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { action?: unknown; ids?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const action = body.action;
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))] : [];
  if (action !== "trash" && action !== "restore" && action !== "purge") return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 422 });
  if (!ids.length) return NextResponse.json({ error: "Nincs kijelölt munka." }, { status: 422 });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `Egyszerre legfeljebb ${MAX_IDS} munka.` }, { status: 422 });

  try {
    if (action === "purge") {
      const s = await purgeWorks(user.id, ids);
      return NextResponse.json({ results: s.results, bytesFreed: s.bytesFreed, filesDeleted: s.filesDeleted, filesKept: s.filesKept });
    }
    const results = await setTrashed(user.id, ids, action === "trash");
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
