// Böngészőoldali hirdetés-render (nincs szerver-Chromium).
// A HTML-t rejtett iframe-be írjuk, megvárjuk a fontokat/képeket, majd html2canvas-szal
// képpé alakítjuk. PDF esetén a képet jsPDF-be tesszük.
type Kind = "pdf" | "image";

export type RenderedFlyer = { blob: Blob; ext: string; contentType: string };

export async function renderFlyerToBlob(
  html: string,
  width: number,
  height: number,
  kind: Kind
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
    // A teljes tartalom kirajzolásához engedjük túlnyúlni (különben az alja levágódna).
    target.style.overflow = "visible";
    target.style.height = "auto";
    const naturalW = Math.max(target.scrollWidth, width);
    const naturalH = Math.max(target.scrollHeight, height);

    // @ts-ignore - a csomag a build során települ (package.json dependency)
    const html2canvas = (await import("html2canvas")).default;
    const shot = await html2canvas(target, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 2,
      width: naturalW,
      height: naturalH,
      windowWidth: naturalW,
      windowHeight: naturalH,
    });

    // Fit-to-page: a teljes hirdetést a formátum méretére skálázzuk (semmi ne vágódjon le),
    // vízszintesen középre igazítva.
    const s = 2;
    const out = document.createElement("canvas");
    out.width = width * s;
    out.height = height * s;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Nem sikerült a kép összeállítása.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    const fit = Math.min(out.width / shot.width, out.height / shot.height);
    const dw = shot.width * fit;
    const dh = shot.height * fit;
    ctx.drawImage(shot, (out.width - dw) / 2, 0, dw, dh);

    if (kind === "pdf") {
      // @ts-ignore - a csomag a build során települ (package.json dependency)
      const { jsPDF } = await import("jspdf");
      const orientation = width >= height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
      pdf.addImage(out.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, width, height);
      return { blob: pdf.output("blob"), ext: "pdf", contentType: "application/pdf" };
    }

    const blob = await new Promise<Blob>((resolve, reject) =>
      out.toBlob(
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
