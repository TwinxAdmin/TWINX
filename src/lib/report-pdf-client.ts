// report-pdf-client.ts — A4 PDF a BÖNGÉSZŐBEN, a képernyőn látott riportból.
//
// MIÉRT böngészőoldalon? A Vercelen nincs használható szerver-Chromium, a régi
// pdf-lib fallback pedig csúnya. Így viszont a PDF PONTOSAN az, amit a partner
// az előnézetben lát (WYSIWYG) — ugyanaz a DOM.
//
// A lapozás DOM-alapú: a riport blokkjait egyesével pakoljuk A4-es oldalakra, és
// ott törünk, ahol a következő blokk már nem férne el. Így nem vágódik ketté a
// szöveg (a html2canvas-t oldalanként külön hívjuk).

export const A4_W = 794; // px @96dpi
export const A4_H = 1123;
const PAD = 56; // meg kell egyeznie a ReportPaper PAPER_PAD értékével

function makePage(): HTMLDivElement {
  const page = document.createElement("div");
  page.style.width = `${A4_W}px`;
  page.style.height = `${A4_H}px`;
  page.style.padding = `${PAD}px`;
  page.style.boxSizing = "border-box";
  page.style.background = "#ffffff";
  page.style.overflow = "hidden";
  page.style.position = "relative";
  return page;
}

/** Elfér-e még a lapon? (a padding miatt a scrollHeight a mérvadó) */
function overflows(page: HTMLElement): boolean {
  return page.scrollHeight > A4_H + 1;
}

/**
 * Túl magas blokk szétvágása bekezdésenként, folytatás-fejléccel.
 * Ha egyetlen bekezdés/lista önmagában magasabb egy A4-nél, azt IS felbontjuk
 * (listaelemenként) — így nem vághat le némán szöveget az `overflow: hidden`.
 */
function splitTall(
  node: HTMLElement,
  pushPage: () => HTMLElement,
  current: HTMLElement
): HTMLElement {
  let page = current;
  const bodyBox = node.lastElementChild as HTMLElement | null;
  if (!bodyBox || bodyBox.children.length === 0) {
    // Nincs mit felbontani (pl. egyetlen hosszú szövegcsomó) — külön lapra tesszük.
    if (page.childElementCount > 0) page = pushPage();
    page.appendChild(node);
    return page;
  }

  const chunks = Array.from(bodyBox.children) as HTMLElement[];
  bodyBox.replaceChildren();
  if (page.childElementCount > 0) page = pushPage();
  page.appendChild(node);

  let box = bodyBox;

  /** Új oldal a szakasz megismételt fejlécével; visszaadja az új tartalom-dobozt. */
  const continuation = (): HTMLElement => {
    page = pushPage();
    const shell = node.cloneNode(true) as HTMLElement;
    const heading = shell.querySelector("h2");
    if (heading && !/folytatás/i.test(heading.textContent ?? "")) {
      heading.textContent = `${heading.textContent} (folytatás)`;
    }
    const nextBox = shell.lastElementChild as HTMLElement;
    nextBox.replaceChildren();
    shell.style.marginTop = "0px";
    page.appendChild(shell);
    return nextBox;
  };

  for (const chunk of chunks) {
    box.appendChild(chunk);
    if (!overflows(page)) continue;

    box.removeChild(chunk);
    box = continuation();
    box.appendChild(chunk);
    if (!overflows(page)) continue;

    // A bekezdés/lista önmagában sem fér el: a saját elemeire bontjuk.
    box.removeChild(chunk);
    const items = Array.from(chunk.children) as HTMLElement[];
    if (!items.length) {
      box.appendChild(chunk); // tovább már nem bontható (nagyon ritka)
      continue;
    }
    let holder = chunk.cloneNode(false) as HTMLElement;
    box.appendChild(holder);
    for (const item of items) {
      holder.appendChild(item);
      if (!overflows(page)) continue;
      holder.removeChild(item);
      box = continuation();
      holder = chunk.cloneNode(false) as HTMLElement;
      box.appendChild(holder);
      holder.appendChild(item);
    }
  }
  return page;
}

/**
 * A megadott (már renderelt, rejtett) riport-elemből A4 PDF blob.
 * A forrás elem a ReportPaper `forPdf` változata legyen: szerkesztő-gombok nélkül.
 */
export async function paperToPdfBlob(
  source: HTMLElement,
  opts: { scale?: number; quality?: number } = {}
): Promise<Blob> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.95; // szövegnél a JPEG-artifact hamar látszik
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  try {
    // A tördelés ELŐTT megvárjuk a betűtípusokat: fallback-fonttal mérve
    // elcsúsznának a töréspontok, és levágódhatna az utolsó sor.
    if (document.fonts?.ready) await document.fonts.ready;

    const pages: HTMLElement[] = [];
    const pushPage = (): HTMLElement => {
      const p = makePage();
      host.appendChild(p);
      pages.push(p);
      return p;
    };

    let page = pushPage();
    // A ReportPaper közvetlen gyerekei a tördelhető blokkok (data-flow jelölés).
    const blocks = Array.from(source.children) as HTMLElement[];

    for (const block of blocks) {
      const clone = block.cloneNode(true) as HTMLElement;
      page.appendChild(clone);
      if (!overflows(page)) continue;

      page.removeChild(clone);
      if (page.childElementCount === 0) {
        // Egyetlen blokk magasabb egy teljes oldalnál -> bekezdésenként vágjuk.
        page = splitTall(clone, pushPage, page);
        continue;
      }
      page = pushPage();
      clone.style.marginTop = "0px";
      page.appendChild(clone);
      if (overflows(page)) {
        page.removeChild(clone);
        page = splitTall(clone, pushPage, page);
      }
    }

    // @ts-ignore - a csomag a build során települ (package.json dependency)
    const html2canvas = (await import("html2canvas")).default;
    // @ts-ignore - a csomag a build során települ (package.json dependency)
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [A4_W, A4_H] });

    for (let i = 0; i < pages.length; i += 1) {
      const canvas = await html2canvas(pages[i], {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
        width: A4_W,
        height: A4_H,
        windowWidth: A4_W,
        windowHeight: A4_H,
      });
      if (i > 0) pdf.addPage([A4_W, A4_H], "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", quality), "JPEG", 0, 0, A4_W, A4_H);
    }

    return pdf.output("blob") as Blob;
  } finally {
    host.remove();
  }
}

/** Blob -> base64 (data-prefix nélkül), a szerverre küldéshez. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("A PDF beolvasása nem sikerült."));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
