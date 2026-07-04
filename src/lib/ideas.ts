// Ötletláda — validáció + a jóváhagyott ötletek biztonságos (email nélküli) listája.
import { createAdminClient } from "@/lib/supabase/admin";

export type IdeaInput = {
  authorName?: string;
  authorEmail?: string;
  content: string;
};

export function validateIdeaInput(input: Partial<IdeaInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const content = String(input.content ?? "").trim();
  if (content.length < 10) errors.content = "Írj legalább 10 karaktert az ötletről.";
  if (content.length > 1000) errors.content = "Az ötlet legfeljebb 1000 karakter lehet.";

  const name = String(input.authorName ?? "").trim();
  if (name.length > 100) errors.authorName = "A név legfeljebb 100 karakter.";

  const email = String(input.authorEmail ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.authorEmail = "Érvényes e-mail cím szükséges (vagy hagyd üresen).";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Nyilvános lista — CSAK biztonságos mezők (email nélkül).
export type PublicIdea = {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: string;
};

export async function getApprovedIdeas(limit = 50): Promise<PublicIdea[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ideas")
    .select("id, author_name, content, created_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => ({
    id: d.id as string,
    authorName: (d.author_name as string | null) ?? null,
    content: d.content as string,
    createdAt: d.created_at as string,
  }));
}
