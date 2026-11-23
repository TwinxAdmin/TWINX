// /meghivo?t=… — a meghívó oldal (terv 13 / 4., terv 22 / 4. B). A link megnyitása semmit nem fogad el:
// belépve az „Elfogadom" gomb (POST) dönt. Kijelentkezve Belépés / Regisztráció — a cím előre kitöltve és zárolva,
// siker után vissza ide. Hibás / lejárt / visszavont / elfogadott meghívó: mind ugyanaz az üzenet.
import type { Metadata } from "next";
import Link from "next/link";
import { createHash } from "node:crypto";
import Wordmark from "@/components/Wordmark";
import AuthModal from "@/components/AuthModal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleName } from "@/lib/module-registry";
import { INVITE_TEXT } from "@/lib/invite-texts";
import InviteActions from "./InviteActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meghívó — TWINX", robots: { index: false, follow: false } };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const token = ((await searchParams).t ?? "").trim();
  const admin = createAdminClient();
  let inv: { email: string; module: string; company: string } | null = null;
  if (token.length >= 20 && token.length <= 100) {
    const { data } = await admin.from("module_invitations").select("email, module_key, company_id, status, expires_at")
      .eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
    if (data && data.status === "meghivva" && new Date(data.expires_at as string).getTime() > Date.now()) {
      const { data: c } = await admin.from("companies").select("name").eq("id", data.company_id).maybeSingle();
      inv = { email: data.email as string, module: moduleName(data.module_key as string), company: (c?.name as string) ?? "" };
    }
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const sameEmail = !!user && !!inv && (user.email ?? "").toLowerCase() === inv.email;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 font-sans" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
      <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: "#1b1815", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/" className="font-display text-2xl font-semibold"><Wordmark /></Link>
        {!inv ? (
          <>
            <h1 className="font-display mt-8 text-2xl font-semibold">A meghívó nem érvényes</h1>
            <p className="mt-3 text-base" style={{ color: "var(--twx-on-dark-muted)" }}>{INVITE_TEXT.invalid}</p>
          </>
        ) : (
          <>
            <h1 className="font-display mt-8 text-2xl font-semibold">Meghívó: {inv.module}</h1>
            <p className="mt-3 text-base" style={{ color: "var(--twx-on-dark-muted)" }}>{INVITE_TEXT.intro(inv.module, inv.company)}</p>
            <InviteActions token={token} email={inv.email} moduleName={inv.module} loggedIn={!!user} sameEmail={sameEmail}
              next={`/meghivo?t=${encodeURIComponent(token)}`} />
          </>
        )}
      </div>
      <AuthModal />
    </main>
  );
}
