// GET   /api/office/credit-requests — tag: a saját legutóbbi kérése; létrehozó/kiosztó: az iroda függő kérései.
// POST  /api/office/credit-requests — tag keretet kér. body: { amount, note? }
// PATCH /api/office/credit-requests — létrehozó/kiosztó dönt. body: { id, action: "approve"|"reject", amount? }
//   Jóváhagyáskor office_allocate növeli a tag keretét (a szabályokat az adatbázis is kikényszeríti).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOCATE_MAX, type OfficeCreditRequest } from "@/lib/office";
import { getMembership } from "@/lib/office-server";
import { sendOfficeCreditRequestNotification } from "@/lib/email";

export const runtime = "nodejs";

const SELECT = "id, user_id, amount, note, status, granted, created_at, decided_at";

async function withNames(rows: Record<string, unknown>[]): Promise<OfficeCreditRequest[]> {
  if (rows.length === 0) return [];
  const admin = createAdminClient();
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const emails = new Map(
    await Promise.all(ids.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? ""] as const))
  );
  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    name: names.get(r.user_id as string) ?? "",
    email: emails.get(r.user_id as string) ?? "",
    amount: r.amount as number,
    note: (r.note as string) ?? null,
    status: r.status as OfficeCreditRequest["status"],
    granted: (r.granted as number) ?? null,
    createdAt: r.created_at as string,
    decidedAt: (r.decided_at as string) ?? null,
  }));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });
  const admin = createAdminClient();

  const { data: mine, error } = await admin
    .from("office_credit_requests").select(SELECT)
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
  if (error) {
    return NextResponse.json(
      { error: /office_credit_requests/.test(error.message) ? "Futtasd le az office-credit-requests.sql migrációt." : error.message },
      { status: 500 }
    );
  }

  let pending: OfficeCreditRequest[] = [];
  if (me.role === "owner" || me.can_allocate) {
    const { data } = await admin
      .from("office_credit_requests").select(SELECT)
      .eq("office_id", me.office_id).eq("status", "pending").order("created_at", { ascending: true });
    pending = await withNames((data ?? []) as Record<string, unknown>[]);
  }

  const [myLast] = await withNames((mine ?? []) as Record<string, unknown>[]);
  return NextResponse.json({ mine: myLast ?? null, pending });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { amount?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > ALLOCATE_MAX) {
    return NextResponse.json({ errors: { amount: `1 és ${ALLOCATE_MAX} közötti egész számot adj meg.` } }, { status: 422 });
  }
  const note = String(body.note ?? "").trim().slice(0, 300) || null;

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });
  if (me.role === "owner" || me.unlimited) {
    return NextResponse.json({ error: "Neked nincs szükséged keretre — az irodai egyenlegből közvetlenül dolgozol." }, { status: 400 });
  }

  // 2) Mentés (egyszerre egy függő kérés)
  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("office_credit_requests")
    .insert({ office_id: me.office_id, user_id: user.id, amount, note })
    .select(SELECT).single();
  if (error) {
    if (/one_pending|duplicate key/i.test(error.message)) {
      return NextResponse.json({ error: "Már van egy elbírálásra váró kérésed." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3) E-mail a létrehozónak (best-effort)
  try {
    const { data: office } = await admin.from("offices").select("name, owner_id").eq("id", me.office_id).single();
    const [{ data: owner }, { data: prof }] = await Promise.all([
      admin.auth.admin.getUserById(office?.owner_id as string),
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    if (owner.user?.email) {
      await sendOfficeCreditRequestNotification({
        to: owner.user.email,
        officeName: (office?.name as string) ?? "",
        requester: (prof?.full_name as string) || user.email || "Egy kolléga",
        amount,
        note: note ?? undefined,
      });
    }
  } catch (err) {
    console.error("Irodai kredit-kérés e-mail hiba:", (err as Error).message);
  }

  const [item] = await withNames([created as Record<string, unknown>]);
  return NextResponse.json({ ok: true, mine: item });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; action?: string; amount?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const id = String(body.id ?? "");
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "Hiányzó azonosító vagy művelet." }, { status: 400 });

  const me = await getMembership(user.id);
  if (!me || !(me.role === "owner" || me.can_allocate)) {
    return NextResponse.json({ error: "Kérést a létrehozó vagy a kiosztó jogú tag bírálhat el." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("office_credit_requests").select("id, office_id, user_id, amount, status").eq("id", id).maybeSingle();
  if (!req || req.office_id !== me.office_id) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (req.status !== "pending") return NextResponse.json({ error: "Ezt a kérést már elbírálták." }, { status: 409 });
  if (req.user_id === user.id && me.role !== "owner") {
    return NextResponse.json({ error: "A saját kérésedet nem hagyhatod jóvá." }, { status: 403 });
  }

  let granted: number | null = null;
  if (action === "approve") {
    granted = body.amount === undefined || body.amount === "" ? (req.amount as number) : Number(body.amount);
    if (!Number.isInteger(granted) || granted < 1 || granted > ALLOCATE_MAX) {
      return NextResponse.json({ error: `1 és ${ALLOCATE_MAX} közötti egész számot adj meg.` }, { status: 422 });
    }
  }

  // Feltételes lezárás: csak ha még függőben van (két jóváhagyó egyszerre sem dönthet kétszer).
  const { data: closed } = await admin
    .from("office_credit_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      granted, decided_by: user.id, decided_at: new Date().toISOString(),
    })
    .eq("id", id).eq("status", "pending").select("id");
  if (!closed?.length) return NextResponse.json({ error: "Ezt a kérést már elbírálták." }, { status: 409 });

  if (action === "approve" && granted) {
    const { data: newAllowance, error } = await admin.rpc("office_allocate", {
      p_actor: user.id, p_member: req.user_id, p_delta: granted, p_note: "Kérés jóváhagyva",
    });
    if (error || newAllowance === null) {
      // A kiosztás nem sikerült → a kérést visszanyitjuk, hogy ne vesszen el.
      await admin.from("office_credit_requests")
        .update({ status: "pending", granted: null, decided_by: null, decided_at: null }).eq("id", id);
      return NextResponse.json({ error: error?.message ?? "A kiosztás nem engedélyezett." }, { status: 403 });
    }
  }

  return NextResponse.json({ ok: true });
}
