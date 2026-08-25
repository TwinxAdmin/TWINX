// Ideiglenes útvonal-zár a Telek ellenőrzés modulhoz.
// A modul nem publikus, amíg nem hibátlan — a /dashboard/real-estate/land
// útvonalat mindenki elől elrejtjük (a menüből is ki van véve a catalog.ts-ben).
// A modul KÓDJA és API-ja érintetlen marad. Publikáláskor töröld ezt a fájlt.
import { redirect } from "next/navigation";

export default function LandLockedLayout() {
  redirect("/dashboard");
}
