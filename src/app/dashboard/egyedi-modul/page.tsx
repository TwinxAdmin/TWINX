// /dashboard/egyedi-modul — „Mi az egyedi modul?” teljes oldalas ismertető a TWINX-en BELÜL
// (a felső menüsor megmarad). A tartalom közös az önálló landinggel (/egyedi-modul).
import type { Metadata } from "next";
import CustomModuleShowcase from "@/components/custom-module/CustomModuleShowcase";

export const metadata: Metadata = { title: "Mi az egyedi modul? — TWINX" };

export default function CustomModuleInfoPage() {
  return <CustomModuleShowcase embedded />;
}
