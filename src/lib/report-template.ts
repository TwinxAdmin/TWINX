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
    const line = raw.trim();
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
    // Számozott szekció: "1. Cím" / "1.  **Cím:**"
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      closeList();
      html += `<h3 class="section"><span class="num">${m[1]}</span><span>${inline(m[2])}</span></h3>`;
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
    color: #1c1815; font-size: 11.5px; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .top {
    background: #12100e; color: #f4efe7;
    padding: 22px 40px 26px;
  }
  .brand {
    font-size: 13px; font-weight: 700; letter-spacing: 3px;
    color: #ef7a5a; text-transform: uppercase;
  }
  .rule { width: 44px; height: 3px; background: #ef7a5a; border-radius: 2px; margin: 10px 0 14px; }
  .title { font-size: 24px; font-weight: 700; color: #f7f3ec; margin: 0; line-height: 1.15; }
  .wrap { padding: 22px 40px 40px; }
  .meta {
    background: #f7f3ec; border: 1px solid #e8e1d6; border-radius: 12px;
    padding: 14px 18px; margin-bottom: 22px;
  }
  .meta .row { display: flex; gap: 8px; padding: 2px 0; font-size: 11px; color: #3a332c; }
  .meta .k { color: #6e655c; min-width: 130px; }
  h3.section {
    font-size: 13px; color: #b5482c; margin: 20px 0 6px;
    display: flex; align-items: center; gap: 9px;
  }
  h3.section .num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; border-radius: 999px;
    background: #ef7a5a; color: #1c1005; font-size: 11px; font-weight: 700; flex: none;
  }
  p { margin: 5px 0; }
  ul { margin: 5px 0 5px 4px; padding-left: 18px; }
  li { margin: 3px 0; }
  strong { color: #1c1815; }
</style></head><body>
  <div class="top">
    <div class="brand">TWINX</div>
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
      <span><span style="color:#ef7a5a; font-weight:700; letter-spacing:1px;">TWINX</span> &nbsp; ${SLOGAN}</span>
      <span style="white-space:nowrap;">oldal <span class="pageNumber"></span>/<span class="totalPages"></span></span>
    </div>
  </div>`;
}
