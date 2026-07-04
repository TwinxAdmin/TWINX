// Ötlet beküldő űrlap (landing). Validáció -> /api/ideas.
"use client";

import { useState, type FormEvent } from "react";
import { validateIdeaInput } from "@/lib/ideas";

export default function IdeaForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const input = { authorName: name, authorEmail: email, content };
    const result = validateIdeaInput(input);
    setErrors(result.errors);
    if (!result.valid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a küldés során.");
        return;
      }
      setDone(true);
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-green-700">
        Köszönjük az ötleted! Moderálás után megjelenik a listában.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="idea-name" className="block text-sm">
            Név (opcionális)
          </label>
          <input
            id="idea-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
          />
          {errors.authorName && (
            <p className="mt-1 text-xs text-red-600">{errors.authorName}</p>
          )}
        </div>
        <div>
          <label htmlFor="idea-email" className="block text-sm">
            E-mail (opcionális, nem jelenik meg)
          </label>
          <input
            id="idea-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
          />
          {errors.authorEmail && (
            <p className="mt-1 text-xs text-red-600">{errors.authorEmail}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="idea-content" className="block text-sm">
          Ötleted
        </label>
        <textarea
          id="idea-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full border border-gray-300 p-2 text-sm"
          placeholder="Milyen funkciót, modult vagy fejlesztést szeretnél látni?"
        />
        {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--twx-coral)", color: "#1c1005" }}
      >
        {loading ? "Küldés…" : "Ötlet beküldése"}
      </button>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
    </form>
  );
}
