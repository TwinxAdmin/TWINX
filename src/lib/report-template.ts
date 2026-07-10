// TWINX jelentés-PDF HTML sablon (Ingatlan + Telek értékbecslés).
// Fix TWINX-arculat (korall akcent, sötét fejléc). A partner ezt NEM szabhatja.
// A HTML-t a report-pdf.ts rendereli PDF-be (headless Chromium).

const SLOGAN =
  "Találd meg a vállalkozásodhoz passzoló célalkalmazást — havidíjak nélkül, tiszta használat alapon.";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Sorközi formázás: **félkövér**
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Az AI nyers szövegét rendezett HTML-lé alakítja (címsorok, listák, bekezdések).
function renderBody(body: string): string {
  const lines = body.split(/\r?\n/);
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const raw of lines) {
    // Perplexity hivatkozás-jelek eltávolítása (pl. [1], [9][10]).
    const line = raw.replace(/\[\d+\]/g, "").trim();
    if (!line) {
      closeList();
      continue;
    }
    let m: RegExpMatchArray | null;

    // Markdown címsor (#, ##, ###)
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
      closeList();
      html += `<h3 class="section">${inline(m[1])}</h3>`;
      continue;
    }
    // Számozott szekció: "1. Cím: tartalom" — a címke cím, a tartalom bekezdés.
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      closeList();
      const num = m[1];
      const rest = m[2].replace(/\*\*/g, "").trim(); // a címkéből a ** felesleges
      const ci = rest.indexOf(":");
      if (ci > 0 && ci < rest.length - 1) {
        const label = rest.slice(0, ci).trim();
        const content = rest.slice(ci + 1).trim();
        html += `<h3 class="section"><span class="num">${num}</span><span>${esc(label)}</span></h3>`;
        if (content) html += `<p>${inline(content)}</p>`;
      } else {
        html += `<h3 class="section"><span class="num">${num}</span><span>${esc(rest.replace(/:$/, ""))}</span></h3>`;
      }
      continue;
    }
    // Felsorolás: *, -, •
    if ((m = line.match(/^[*\-•]\s+(.*)$/))) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(m[1])}</li>`;
      continue;
    }
    // Bekezdés
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function renderMeta(meta: string[]): string {
  return meta
    .map((m) => {
      const i = m.indexOf(":");
      if (i > 0) {
        return `<div class="row"><span class="k">${esc(m.slice(0, i))}</span><span>${esc(m.slice(i + 1))}</span></div>`;
      }
      return `<div class="row">${esc(m)}</div>`;
    })
    .join("");
}

export function buildReportHtml(params: {
  title: string;
  meta: string[];
  body: string;
}): string {
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1c1815; font-size: 11.5px; line-height: 1.62;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .top {
    background: #12100e; color: #f4efe7;
    padding: 32px 46px 30px;
  }
  .brand {
    font-size: 20px; font-weight: 800; letter-spacing: 2.5px; color: #f7f3ec;
  }
  .brand .x { color: #ef7a5a; }
  .rule { width: 48px; height: 4px; background: #ef7a5a; border-radius: 2px; margin: 11px 0 16px; }
  .title { font-size: 27px; font-weight: 700; color: #f7f3ec; margin: 0; line-height: 1.12; letter-spacing: -0.2px; }
  .wrap { padding: 30px 46px 40px; }
  .meta {
    background: #f7f3ec; border: 1px solid #e8e1d6; border-left: 3px solid #ef7a5a;
    border-radius: 0 12px 12px 0; padding: 16px 20px; margin-bottom: 26px;
  }
  .meta .row { display: flex; gap: 10px; padding: 3px 0; font-size: 11px; color: #3a332c; }
  .meta .k { color: #6e655c; min-width: 140px; font-weight: 600; }
  h3.section {
    font-size: 13px; color: #b5482c; margin: 26px 0 10px; padding-bottom: 7px;
    border-bottom: 1px solid #ece3d6; text-transform: uppercase; letter-spacing: 0.3px;
    display: flex; align-items: center; gap: 10px;
  }
  h3.section .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 999px;
    background: #ef7a5a; color: #1c1005; font-size: 11px; font-weight: 800; flex: none;
  }
  p { margin: 6px 0; }
  ul { margin: 8px 0; padding-left: 2px; list-style: none; }
  li { margin: 5px 0; padding-left: 18px; position: relative; }
  li:before { content: "•"; position: absolute; left: 2px; color: #ef7a5a; font-weight: 800; }
  strong { color: #1c1815; }
</style></head><body>
  <div class="top">
    <div class="brand">TWIN<span class="x">X</span></div>
    <div class="rule"></div>
    <h1 class="title">${esc(params.title)}</h1>
  </div>
  <div class="wrap">
    <div class="meta">${renderMeta(params.meta)}</div>
    <div class="body">${renderBody(params.body)}</div>
  </div>
</body></html>`;
}

export function reportFooterHtml(): string {
  return `<div style="width:100%; font-size:7.5px; color:#6e655c; padding:0 40px; -webkit-print-color-adjust:exact;">
    <div style="border-top:1px solid #e8e1d6; padding-top:5px; display:flex; justify-content:space-between; align-items:center;">
      <span><span style="font-weight:700; letter-spacing:1px; color:#12100e;">TWIN<span style="color:#ef7a5a;">X</span></span> &nbsp; ${SLOGAN}</span>
      <span style="white-space:nowrap;">oldal <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>
  </div>`;
}
