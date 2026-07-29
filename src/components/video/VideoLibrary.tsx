// Videó-könyvtár: hónap szerinti és saját mappák, a mappára kattintva ABLAK nyílik.
// A mappa-logika közös a hirdetésekkel (FolderLibrary); itt csak a videó-kártya
// megjelenítése és a videóspecifikus műveletek (törlés a tárhelyről) egyedi.
"use client";

import FolderLibrary, { type LibraryFolder } from "@/components/library/FolderLibrary";
import { toDownloadUrl } from "@/lib/files";

export type VideoItem = {
  id: string;
  status: string;
  output_url: string | null;
  poster_url: string | null;
  title: string;
  package: string;
  format: string;
  imageCount: number;
  folderId: string | null;
  createdAt: string;
  /** A FolderLibrary borítóképe. */
  coverUrl?: string | null;
};
export type Folder = LibraryFolder;

export default function VideoLibrary({
  items, folders, onChanged,
}: { items: VideoItem[]; folders: Folder[]; onChanged: () => void }) {
  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    onChanged();
    return d as { folder?: Folder };
  }

  const withCover = items.map((v) => ({ ...v, coverUrl: v.poster_url }));

  return (
    <FolderLibrary<VideoItem>
      items={withCover}
      folders={folders}
      noun="videó"
      emptyText="Még nincs elkészült videód."
      downloadUrl={(v) => (v.output_url ? toDownloadUrl(v.output_url) : null)}
      renderItem={(v) => (
        <>
          {v.output_url ? (
            <video src={v.output_url} poster={v.poster_url ?? undefined} controls preload="none"
              className="w-full rounded-lg bg-black" style={{ maxHeight: 300 }} />
          ) : (
            // Még nincs kész videó — de a nyitókártya már látszik előképként.
            <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg"
              style={{ background: "var(--twx-line)" }}>
              {v.poster_url && v.status !== "failed" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.poster_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              ) : null}
              <span className="relative rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(255,255,255,0.85)", color: "var(--twx-ink)" }}>
                {v.status === "failed" ? "Sikertelen (kredit visszatérítve)" : "Készül…"}
              </span>
            </div>
          )}
          <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            {v.format} · {v.package === "pro" ? "PRO" : "Alap"} · {v.imageCount} kép
          </p>
        </>
      )}
      onCreateFolder={async (name) => {
        const d = await call("/api/real-estate/video/folders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        return d.folder;
      }}
      onMove={(id, folderId) =>
        call("/api/real-estate/video/manage", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, folderId }),
        })
      }
      onDelete={(v) => call(`/api/real-estate/video/manage?id=${v.id}`, { method: "DELETE" })}
    />
  );
}
