// /visszajelzes?t=<token> — egy kattintás a levélből: köszönő oldal, opcionális szöveggel. Belépés nem kell.
import type { Metadata } from "next";
import ActivationCard from "@/components/activation/ActivationCard";
import { verifyFeedbackToken } from "@/lib/activation-token";
import { feedbackLabels } from "@/lib/activation-shared";
import FeedbackClient from "./FeedbackClient";

export const metadata: Metadata = { title: "Visszajelzés — TWINX", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = verifyFeedbackToken(t);
  return (
    <ActivationCard>
      {token && t ? (
        <FeedbackClient token={t} answer={feedbackLabels(token.q, token.c).answer} />
      ) : (
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">Ez a link már nem érvényes</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Ha szeretnél nekünk írni, itt megteheted: twinx.hu/kapcsolat</p>
        </div>
      )}
    </ActivationCard>
  );
}
