// Böngészőoldali hirdetés-render (nincs szerver-Chromium).
// A HTML-t rejtett iframe-be írjuk, megvárjuk a fontokat/képeket, majd html2canvas-szal
// képpé alakítjuk. PDF esetén a képet jsPDF-be tesszük.
type Kind = "pdf" | "image";

export type RenderedFlyer = { blob: Blob; ext: string; contentType: string };

export async function renderFlyerToBlob(
  html: string,
  width: number,
  height: number,
  kind: Kind,
  fitToContent = true
): Promise<RenderedFlyer> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    border: "0",
    background: "#ffffff",
  });
  document.body.appendChild(iframe);

  // Az iframe stílusait/fontjait ideiglenesen a fő dokumentumba is bekötjük, hogy a
  // html2canvas (ami a fő dokumentumban renderel) a megfelelő betűtípust lássa.
  const bridged: HTMLElement[] = [];

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Nem sikerült az előnézeti keret létrehozása.");
    doc.open();
    doc.write(html);
    doc.close();

    // Fontok/képek bevárása.
    await sleep(60);
    doc.querySelectorAll("head link[rel='stylesheet'], head style").forEach((n) => {
      const clone = n.cloneNode(true) as HTMLElement;
      document.head.appendChild(clone);
      bridged.push(clone);
    });
    try {
      if (doc.fonts?.ready) await doc.fonts.ready;
      const anyDoc = document as unknown as { fonts?: { ready?: Promise<unknown> } };
      if (anyDoc.fonts?.ready) await anyDoc.fonts.ready;
    } catch {
      /* nem baj, megyünk tovább */
    }
    await waitForImages(doc);
    await sleep(120);

    const target = (doc.querySelector(".flyer") as HTMLElement) || doc.body;
    let naturalW = width;
    let naturalH = height;
    if (fitToContent) {
      // Álló poszter: a magasság a tartalomhoz igazodik (nincs üres alsó rész).
      target.style.overflow = "visible";
      target.style.minHeight = "0";
      target.style.height = "auto";
      if (doc.body) { doc.body.style.height = "auto"; doc.body.style.overflow = "visible"; }
      if (doc.documentElement) { doc.documentElement.style.height = "auto"; doc.documentElement.style.overflow = "visible"; }
      await sleep(30);
      naturalW = target.offsetWidth || width;
      naturalH = target.offsetHeight || height;
    }
    // frame (négyzet/story): fix méret, a kép kitölti — a natural marad width×height.

    // @ts-ignore - a csomag a build során települ (package.json dependency)
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(target, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 2,
      width: naturalW,
      height: naturalH,
      windowWidth: naturalW,
      windowHeight: naturalH,
    });

    if (kind === "pdf") {
      // @ts-ignore - a csomag a build során települ (package.json dependency)
      const { jsPDF } = await import("jspdf");
      const orientation = naturalW >= naturalH ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [naturalW, naturalH] });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, naturalW, naturalH);
      return { blob: pdf.output("blob"), ext: "pdf", contentType: "application/pdf" };
    }

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b: Blob | null) => (b ? resolve(b) : reject(new Error("A kép nem készült el."))),
        "image/png"
      )
    );
    return { blob, ext: "png", contentType: "image/png" };
  } finally {
    bridged.forEach((n) => n.remove());
    document.body.removeChild(iframe);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          })
    )
  ).then(() => undefined);
}
