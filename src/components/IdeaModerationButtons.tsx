// Admin moderációs gombok egy ötlethez -> /api/admin/ideas.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IdeaModerationButtons({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function act(action: "approve" | "reject" | "delete") {
    setLoading(true);
    try {
      await fetch("/api/admin/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 text-xs">
      {status !== "approved" && (
        <button
          onClick={() => act("approve")}
          disabled={loading}
          className="border border-green-700 px-2 py-1 text-green-700 disabled:opacity-50"
        >
          Jóváhagyás
        </button>
      )}
      {status !== "rejected" && (
        <button
          onClick={() => act("reject")}
          disabled={loading}
          className="border border-gray-400 px-2 py-1 text-gray-600 disabled:opacity-50"
        >
          Elutasítás
        </button>
      )}
      <button
        onClick={() => act("delete")}
        disabled={loading}
        className="border border-red-600 px-2 py-1 text-red-600 disabled:opacity-50"
      >
        Törlés
      </button>
    </div>
  );
}
