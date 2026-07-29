// /admin/credits — A kredit-adás beköltözött a Felhasználók táblába (sorvégi „+"
// gomb), így ez az oldal már csak átirányít. A régi könyvjelzők így is működnek.
import { redirect } from "next/navigation";

export default function AdminCreditsPage() {
  redirect("/admin/users");
}
