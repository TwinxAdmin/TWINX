// /uj — a korábbi előnézeti cím. Az új főoldal 2026-11-23 óta a / címen él.
import { redirect } from "next/navigation";

export default function OldPreviewRedirect() {
  redirect("/");
}
