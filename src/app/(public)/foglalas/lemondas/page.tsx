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

  // B arculat (Márk kérése 2026-11-24): a foglalási folyamat minden pontja egyezzen — ugyanaz a korall „selyem"
  // kártya, mint a „Foglalj ingyenes felmérést" sávban (globals.css: .b-contact-silk), világos B háttéren.
  return (
    <main className="flex min-h-screen items-center justify-center bg-b-bg px-4 py-16 font-sans text-b-ink sm:px-6">
      <div className="b-contact-silk relative w-full max-w-lg overflow-hidden rounded-[28px] p-8 text-white shadow-b-lg sm:p-10">
        <div className="relative">
          <Link href="/" className="font-display text-2xl font-semibold"><Wordmark accent="#ffd2c2" /></Link>
          {booking ? (
            <>
              <p className="mt-8 text-[13px] uppercase tracking-[1.6px] text-white">Ingyenes felmérés</p>
              <h1 className="font-display mt-2 text-[28px] font-bold leading-tight tracking-[-0.5px]">Lemondod a foglalásod?</h1>
              <p className="mt-3 text-[17px] leading-relaxed text-white">
                Időpont: <strong>{booking.when}</strong>
                {booking.host ? <> · {booking.host}</> : null}
              </p>
              <CancelBookingClient token={token} />
            </>
          ) : (
            <>
              <h1 className="font-display mt-8 text-[28px] font-bold leading-tight tracking-[-0.5px]">Ez a link már nem érvényes</h1>
              <p className="mt-3 text-[17px] leading-relaxed text-white">
                Lehet, hogy a foglalást már lemondták, vagy az időpont elmúlt. Ha segítség kell, írj nekünk:{" "}
                <a href="mailto:office@twinx.hu" className="font-semibold underline underline-offset-2">office@twinx.hu</a>.
              </p>
              <div className="mt-6"><Link href="/#kapcsolat" className="b-btn-light">Új időpontot foglalok</Link></div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
