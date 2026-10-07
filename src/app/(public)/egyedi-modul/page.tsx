// twinx.hu/egyedi-modul — ÖNÁLLÓ, KIKÜLDHETŐ LANDING az egyedi modulról (későbbi kampányokhoz eltéve).
// A partnereknek a TWINX-en belüli változat szól: /dashboard/egyedi-modul (ugyanaz a tartalom).
// Jelenleg sehonnan nem linkeljük — kiküldéskor ezt a címet kell megadni.
import type { Metadata } from "next";
import CustomModuleShowcase from "@/components/custom-module/CustomModuleShowcase";

export const metadata: Metadata = {
  title: "TWINX egyedi modul — a te vállalkozásodra szabott automatizáció",
  description:
    "Megépítjük azt az eszközt, ami a te napi munkádat automatizálja: a TWINX-be építve, a te adataiddal, sablonjaiddal és arculatoddal. Díjmentes egyeztetés és árajánlat.",
};

export default function CustomModuleLanding() {
  return <CustomModuleShowcase />;
}
