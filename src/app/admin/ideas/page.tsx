// /admin/ideas — Ötlet moderáció (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IdeaModerationButtons from "@/components/IdeaModerationButtons";

export const runtime = "nodejs";

type Idea = {
  id: string;
  author_name: string | null;
  author_email: string | null;
  content: string;
  status: string;
  created_at: string;
};

function IdeaRow({ idea }: { idea: Idea }) {
  return (
    <li className="twx-card p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`text-xs ${
              idea.status === "approved"
                ? "text-green-700"
                : idea.status === "rejected"
                  ? "text-gray-400"
                  : "text-amber-600"
            }`}
          >
            {idea.status}
          </span>
          <p className="mt-1 whitespace-pre-wrap">{idea.content}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {idea.author_name || "Névtelen"}
            {idea.author_email ? ` · ${idea.author_email}` : ""} ·{" "}
            {new Date(idea.created_at).toLocaleString("hu-HU")}
          </p>
        </div>
      </div>
      <div className="mt-2">
        <IdeaModerationButtons id={idea.id} status={idea.status} />
      </div>
    </li>
  );
}

export default async function AdminIdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data } = await supabase
    .from("ideas")
    .select("id, author_name, author_email, content, status, created_at")
    .order("created_at", { ascending: false });

  const list = (data ?? []) as Idea[];
  const pending = list.filter((i) => i.status === "pending");
  const others = list.filter((i) => i.status !== "pending");

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Admin — Ötletláda</h1>
        <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
          <a href="/admin/analytics">Analitika</a>
          <a href="/admin/prompts">Promptok</a>
          <a href="/admin/users">Felhasználók</a>
          <a href="/admin/credits">Kredit</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </div>

      <section>
        <h2 className="font-display font-medium">Jóváhagyásra vár ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs függőben lévő ötlet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pending.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display font-medium">Elbírált ötletek ({others.length})</h2>
        {others.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs elbírált ötlet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {others.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} />
            ))}
          </ul>
        )}
      </section>
      </div>
    </main>
  );
}
