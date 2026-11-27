// Jogi dokumentum megjelenítése (ÁSZF, Adatkezelési tájékoztató — D74, 9. lépés). A szöveg EGY helyen, markdownban
// van (src/content/legal/*), ez a komponens csak a ténylegesen használt részhalmazt rendereli: „## " cím (szakaszlinkkel),
// bekezdés, „- " felsorolás, táblázat, **félkövér**, [link](cím). Külső csomag nélkül, szerveroldalon.
// B arculat: olvasható szélesség (~70 karakter), 16–17 px szöveg; a táblázat mobilon a saját dobozában görgethető
// vízszintesen, az oldal nem lóg ki.
import type { ReactNode } from "react";

type Block =
  | { t: "h2"; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

export function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseLegal(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ t: "p", text: para.join(" ") }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { flush(); continue; }
    if (l.startsWith("## ")) { flush(); const text = l.slice(3).trim(); out.push({ t: "h2", text, id: slug(text) }); continue; }
    if (l.startsWith("- ")) {
      flush();
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      i--; out.push({ t: "ul", items }); continue;
    }
    if (l.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      i--; out.push({ t: "table", head: rows[0] ?? [], rows: rows.slice(1) }); continue;
    }
    para.push(l.trim());
  }
  flush();
  return out;
}

/** Soron belüli jelölések: **félkövér** és [szöveg](cím). */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={k++} className="font-semibold text-b-ink">{m[1]}</strong>);
    else parts.push(<a key={k++} href={m[3]} className="font-medium text-b-accent-ink underline underline-offset-2">{m[2]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function LegalDoc({ md }: { md: string }) {
  const blocks = parseLegal(md);
  return (
    <div className="space-y-4 text-[16.5px] leading-[1.7] text-b-ink-2">
      {blocks.map((b, i) => {
        if (b.t === "h2") return (
          <h2 key={i} id={b.id} className="font-display scroll-mt-24 pt-6 text-[24px] font-bold leading-tight tracking-[-0.3px] text-b-ink sm:text-[26px]">
            <a href={`#${b.id}`} className="hover:text-b-accent-ink">{b.text}</a>
          </h2>
        );
        if (b.t === "p") return <p key={i} className="max-w-[70ch]">{inline(b.text)}</p>;
        if (b.t === "ul") return (
          <ul key={i} className="max-w-[70ch] list-disc space-y-1.5 pl-5 marker:text-b-accent-ink">
            {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </ul>
        );
        return (
          <div key={i} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] border-collapse overflow-hidden rounded-2xl text-left text-[14.5px] leading-[1.55]">
              <thead>
                <tr className="bg-b-surface text-b-ink">
                  {b.head.map((h, j) => <th key={j} className="border-b border-b-line px-3 py-2.5 font-semibold">{inline(h)}</th>)}
                </tr>
              </thead>
              <tbody className="bg-b-card">
                {b.rows.map((r, j) => (
                  <tr key={j} className="align-top">
                    {r.map((c, n) => <td key={n} className="border-b border-b-line px-3 py-2.5">{inline(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Tartalomjegyzék a „## " címekből (szakaszlinkek). */
export function LegalToc({ md }: { md: string }) {
  const hs = parseLegal(md).filter((b): b is Extract<Block, { t: "h2" }> => b.t === "h2");
  return (
    <nav aria-label="Tartalom" className="rounded-2xl border border-b-line bg-b-card p-5">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[1.2px] text-b-ink-3">Tartalom</p>
      <ol className="grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
        {hs.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-b-ink hover:text-b-accent-ink hover:underline">{h.text}</a></li>)}
      </ol>
    </nav>
  );
}
