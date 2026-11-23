// /foglalas/lemondas?t=… — a visszaigazoló levél „Lemondás" linkje (terv 15 / 2. szakasz).
// A megnyitás CSAK megmutatja a foglalást (a levelező- és vírusirtó programok előre megnyitják a linkeket);
// a lemondás a „Lemondom" gombbal, POST-tal történik. Hibás/lejárt tokennél általános üzenet.
import type { Metadata } from "next";
import { createHash } from "node:crypto";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtFullBudapest } from "@/lib/bookings";
import CancelBookingClient from "./CancelBookingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Foglalás lemondása — TWINX", robots: { index: false, follow: false } };

async function findBooking(token: string) {
  if (token.length < 20 || token.length > 100) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("starts_at, host_id")
    .eq("cancel_token_hash", hash).in("status", ["uj", "egyeztetve"]).maybeSingle();
  if (!data || !data.starts_at || new Date(data.starts_at as string).getTime() <= Date.now()) return null;
  const { data: h } = data.host_id
    ? await admin.from("booking_hosts").select("display_name").eq("user_id", data.host_id).maybeSingle()
    : { data: null };
  return { when: fmtFullBudapest(data.starts_at as string), host: (h?.display_name as string | undefined) ?? null };
}

export default async function CancelBookingPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const token = ((await searchParams).t ?? "").trim();
  const booking = token ? await findBooking(token) : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16 font-sans" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
      <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: "#1b1815", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/" className="font-display text-2xl font-semibold"><Wordmark /></Link>
        {booking ? (
          <>
            <h1 className="font-display mt-8 text-2xl font-semibold">Lemondod a foglalásod?</h1>
            <p className="mt-3 text-base" style={{ color: "var(--twx-on-dark-muted)" }}>
              Ingyenes felmérés: <strong style={{ color: "var(--twx-on-dark)" }}>{booking.when}</strong>
              {booking.host ? <> · {booking.host}</> : null}
            </p>
            <CancelBookingClient token={token} />
          </>
        ) : (
          <>
            <h1 className="font-display mt-8 text-2xl font-semibold">Ez a link már nem érvényes</h1>
            <p className="mt-3 text-base" style={{ color: "var(--twx-on-dark-muted)" }}>
              Lehet, hogy a foglalást már lemondták, vagy az időpont elmúlt. Ha segítség kell, írj nekünk: office@twinx.hu.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
