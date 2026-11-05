// /leiratkozas?t=<token> — leiratkozás egy kattintással a levél aljáról. Belépés nem kell.
import type { Metadata } from "next";
import ActivationCard from "@/components/activation/ActivationCard";
import { verifyUnsubscribeToken } from "@/lib/activation-token";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = { title: "Leiratkozás — TWINX", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <ActivationCard>
      {t && verifyUnsubscribeToken(t) ? (
        <UnsubscribeClient token={t} />
      ) : (
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">Ez a link nem érvényes</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Ha le szeretnél iratkozni, írj nekünk: twinx.hu/kapcsolat</p>
        </div>
      )}
    </ActivationCard>
  );
}
