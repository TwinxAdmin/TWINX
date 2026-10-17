// Bankkártyás fizetés után a Stripe ide küld vissza (?purchase=success&credits=N) — visszajelzés a partnernek, majd a
// paramétereket kivesszük a címből (frissítéskor ne ismétlődjön). A kreditet és a számlát a webhook intézi (pár másodperc).
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { showToast } from "@/components/Toast";

export default function PurchaseSuccessNotice() {
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (params.get("purchase") !== "success") return;
    const credits = Number(params.get("credits") ?? 0);
    const office = params.get("target") === "office";
    showToast(
      `Sikeres fizetés! ${credits > 0 ? `+${credits} kredit` : "A kredit"} pár másodpercen belül megjelenik ${office ? "az iroda egyenlegén" : "az egyenlegeden"}, a számlát e-mailben küldjük.`,
      "success",
    );
    const url = new URL(window.location.href);
    url.searchParams.delete("purchase");
    url.searchParams.delete("credits");
    url.searchParams.delete("target");
    window.history.replaceState(null, "", url.pathname + url.search);
    // az egyenleg (kredit-sáv) frissítése, amikor a webhook már jóváírt
    const t = window.setTimeout(() => router.refresh(), 4000);
    return () => window.clearTimeout(t);
  }, [params, router]);
  return null;
}
