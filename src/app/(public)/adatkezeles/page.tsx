// twinx.hu/adatkezeles — Adatkezelési tájékoztató, 2026-12-v1 (D74, 9. lépés; szöveg:
// src/content/legal/adatkezeles-2026-12-v1.ts, forrás: docs/terv/32-adatkezelesi-tajekoztato.md).
import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import ADATKEZELES_MD from "@/content/legal/adatkezeles-2026-12-v1";
import { PRIVACY_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Adatkezelési tájékoztató — TWINX",
  description: "Milyen személyes adatokat kezel a TWINX, miért, meddig, és milyen jogaid vannak.",
};

export default function AdatkezelesPage() {
  return <LegalPage title="Adatkezelési tájékoztató" version={PRIVACY_VERSION} md={ADATKEZELES_MD} />;
}
