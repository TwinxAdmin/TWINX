// /dashboard/iroda/bemutato — „Mi az irodai fiók?" részletes ismertető (a felső TWINX menüsor megmarad).
import type { Metadata } from "next";
import OfficeShowcase from "@/components/office/OfficeShowcase";

export const metadata: Metadata = { title: "Mi az irodai fiók? — TWINX" };

export default function OfficeInfoPage() {
  return <OfficeShowcase />;
}
