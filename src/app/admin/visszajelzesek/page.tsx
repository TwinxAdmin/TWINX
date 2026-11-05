// A Visszajelzések az AI-ügynökök oldalra költözött; a régi cím oda visz tovább.
import { redirect } from "next/navigation";

export default function AdminFeedbackPage() {
  redirect("/admin/ugynokok?tab=visszajelzesek");
}
