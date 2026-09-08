// POST /api/invite/redeem — ingatlanos ajándékkód beváltása.
//
// Bejelentkezett felhasználó hívja: a regisztráció után automatikusan (a
// regisztrációs űrlapon megadott kóddal), vagy kézzel a kezdőlapról — ez utóbbi
// kell a Google-fiókkal regisztrálóknak, akik nem tudnak kódot beírni.
//
// A kód NEM hozzáad, hanem KIEGÉSZÍT: a fiók a regisztrációs próbakredittel
// együtt pontosan `credits` (alapból 10) kredittel indul — sosem 13.
//
// Védelem: a kód egyszer használható (a beváltás atomikus, feltételes UPDATE),
// egy fiók egyszer válthat be, és a kód csak elfogadott jelentkezéshez tartozhat.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeInviteCode, topUpAmount } from "@/lib/invites";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { code?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const code = normalizeInviteCode(String(body.code ?? ""));
  if (!code) return NextResponse.json({ error: "Add meg az ajándékkódot." }, { status: 422 });

  const admin = createAdminClient();

  // Egy fiók egyszer válthat be kódot.
  const { data: profile } = await admin
    .from("profiles").select("invite_code").eq("id", user.id).maybeSingle();
  if (profile?.invite_code) {
    return NextResponse.json({ error: "Ezen a fiókon már beváltottál ajándékkódot." }, { status: 409 });
  }

  const { data: invite } = await admin
    .from("ingatlan_invites")
    .select("id, status, code, credits, redeemed_by")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.status !== "elfogadva") {
    return NextResponse.json({ error: "Ismeretlen vagy még jóvá nem hagyott kód." }, { status: 404 });
  }
  if (invite.redeemed_by) {
    return NextResponse.json({ error: "Ezt a kódot már beváltották." }, { status: 409 });
  }

  // ATOMIKUS foglalás: csak akkor sikerül, ha közben más nem váltotta be.
  const { data: claimed, error: claimError } = await admin
    .from("ingatlan_invites")
    .update({ redeemed_by: user.id, redeemed_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("redeemed_by", null)
    .select("id, credits");
  if (claimError) return NextResponse.json({ error: "A beváltás nem sikerült." }, { status: 500 });
  if (!claimed?.length) {
    return NextResponse.json({ error: "Ezt a kódot közben beváltották." }, { status: 409 });
  }

  const total = Number(claimed[0].credits) || invite.credits;
  const amount = topUpAmount(total);

  // A regisztrációs próbakredit felett CSAK a különbözetet írjuk jóvá.
  if (amount > 0) {
    const { error: walletError } = await admin.rpc("wallet_add", {
      p_user_id: user.id, p_amount: amount,
    });
    if (walletError) {
      // Visszaadjuk a kódot, hogy ne vesszen el a partner ajándéka.
      await admin.from("ingatlan_invites")
        .update({ redeemed_by: null, redeemed_at: null }).eq("id", invite.id);
      return NextResponse.json({ error: "A jóváírás nem sikerült, próbáld újra." }, { status: 500 });
    }
  }

  // Megjelölés: honnan jött és milyen kóddal — így bármikor kilistázható.
  await admin.from("profiles")
    .update({ signup_source: "ingatlan-landing", invite_code: code })
    .eq("id", user.id);

  // Napló (best-effort) — a kredit-naplóban külön soron látszik.
  await admin.from("credit_grants").insert({
    admin_id: null, admin_email: "rendszer",
    user_id: user.id, user_email: user.email ?? null,
    amount,
    note: `Ingatlanos ajándékcsomag (${total} kredit összesen), kód: ${code}`,
  });

  return NextResponse.json({ ok: true, total, added: amount });
}
