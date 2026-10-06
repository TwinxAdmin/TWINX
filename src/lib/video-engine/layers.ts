// RÉTEGEK → KÉP: a sablon rétegeit (forma, szöveg, halmozott blokk, kép) Satori-
// elemmé alakítja. A motor ebből egy átlátszó PNG-t rajzol, és animálva ülteti a
// videóra. KLIENS-/SZERVER-FÜGGETLEN (nincs Node-import).
import {
  resolveColor,
  type AspectId, type BindKey, type Box, type ColorRef, type Layer, type Palette, type StackItem,
} from "./template-schema";
import { symbolSvg, type SatoriNode } from "./transitions";

/** Adatok a rétegekhez. `captionpos.N` = a N. fotó feliratának helye ("bottom" | "center"). */
export type BindData = Partial<Record<BindKey | `captionpos.${number}`, string>>;

export type LayerCtx = {
  W: number;
  H: number;
  aspect: AspectId;
  palette: Palette;
  data: BindData;
};

const h = (type: string, style: Record<string, unknown>, children?: unknown): SatoriNode =>
  ({ type, props: children === undefined ? { style } : { style, children } });

/** "#rrggbb" + átlátszóság → rgba(). */
function rgba(hex: string, alpha = 1): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** A réteg adott méretre érvényes változata (byAspect felülírásokkal). */
export function forAspect<T extends Layer>(l: T, aspect: AspectId): T {
  const over = (l as { byAspect?: Partial<Record<AspectId, object>> }).byAspect?.[aspect];
  return over ? ({ ...l, ...over } as T) : l;
}

/** Egy kötött vagy fix szöveg értéke; üres → null (a réteg kimarad). */
function valueOf(bind: BindKey | undefined, text: string | undefined, data: BindData): string | null {
  const v = (bind ? data[bind] : undefined) ?? text ?? "";
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Betűméret-csökkentés, ha a szöveg nem fér el a megengedett sorszámban
 * (becslés: átlagos betűszélesség ≈ 0,56 em). Nem vágunk le szöveget.
 */
function fitSize(
  text: string, px: number, boxW: number, maxLines: number | undefined,
  opts: { uppercase?: boolean; letterSpacingPx?: number } = {},
): number {
  if (!maxLines) return px;
  // Nagybetűs szöveg szélesebb (≈0,68 em), a betűköz karakterenként hozzáadódik.
  const em = opts.uppercase ? 0.68 : 0.54;
  const ls = opts.letterSpacingPx ?? 0;
  let size = px;
  const lines = (s: number) =>
    text.split("\n").reduce((acc, line) => acc + Math.max(1, Math.ceil((line.length * (s * em + ls)) / boxW)), 0);
  while (size > px * 0.5 && lines(size) > maxLines) size *= 0.93;
  return Math.round(size);
}

function textBlock(
  value: string,
  o: { font: { weight: number; size: number }; color: ColorRef; lineHeight?: number; letterSpacing?: number; uppercase?: boolean; align?: "left" | "center" | "right"; maxLines?: number },
  ctx: LayerCtx, family: string, boxW: number, extra: Record<string, unknown> = {},
): SatoriNode {
  const S = Math.min(ctx.W, ctx.H);
  // Egysoros helyen a többsoros adat (pl. „1 szoba / 40 m²") egy sorba fűződik.
  const joined = o.maxLines === 1 ? value.split("\n").map((x) => x.trim()).filter(Boolean).join("  ·  ") : value;
  const shown = o.uppercase ? joined.toUpperCase() : joined;
  const px = fitSize(shown, o.font.size * S, boxW, o.maxLines, { uppercase: o.uppercase, letterSpacingPx: (o.letterSpacing ?? 0) * S });
  const lines = shown.split("\n").filter((x) => x.trim());
  return h("div", {
    display: "flex", flexDirection: "column",
    alignItems: o.align === "center" ? "center" : o.align === "right" ? "flex-end" : "flex-start",
    fontFamily: family, fontWeight: o.font.weight, fontSize: px,
    lineHeight: o.lineHeight ?? 1.15, letterSpacing: (o.letterSpacing ?? 0) * S,
    color: resolveColor(o.color, ctx.palette), textAlign: o.align ?? "left",
    ...extra,
  }, lines.map((line) => h("div", { display: "flex" }, line)));
}

function boxStyle(b: Box, ctx: LayerCtx): Record<string, unknown> {
  return {
    position: "absolute",
    left: Math.round(b.x * ctx.W), top: Math.round(b.y * ctx.H),
    width: Math.round(b.w * ctx.W), height: Math.round(b.h * ctx.H),
  };
}

function stackItem(it: StackItem, ctx: LayerCtx, family: string, innerW: number): SatoriNode | null {
  const S = Math.min(ctx.W, ctx.H);
  if (it.type === "spacer") return h("div", { display: "flex", height: Math.round(it.height * S) });
  const mt = Math.round((it.gapBefore ?? 0) * S);
  if (it.type === "rule") {
    return h("div", {
      display: "flex", width: Math.round(it.width * S), height: Math.max(2, Math.round(it.height * S)),
      background: resolveColor(it.color, ctx.palette), marginTop: mt,
    });
  }
  const v = valueOf(it.bind, it.text, ctx.data);
  if (!v) return null;
  return textBlock(v, it, ctx, family, innerW, { marginTop: mt });
}

/** Egy réteg Satori-eleme (null, ha nincs mit megjeleníteni). */
export function layerNode(layer: Layer, ctx: LayerCtx, family: string): SatoriNode | null {
  const l = forAspect(layer, ctx.aspect);
  const S = Math.min(ctx.W, ctx.H);
  const base = { ...boxStyle(l.box, ctx), opacity: l.opacity ?? 1, display: "flex" };

  switch (l.kind) {
    case "shape": {
      // Sokszög: SVG-vel rajzolva (a Satori a CSS clip-path-t nem ismeri).
      if (l.shape === "polygon" && l.points?.length) {
        const bw = Math.round(l.box.w * ctx.W), bh = Math.round(l.box.h * ctx.H);
        const pts = l.points.map(([x, y]) => `${(x * bw).toFixed(1)},${(y * bh).toFixed(1)}`).join(" ");
        const grad = typeof l.fill === "string" ? null : l.fill;
        const stops = grad?.stops.map(([o, c, a]) => ({ type: "stop", props: { offset: String(o), "stop-color": resolveColor(c, ctx.palette), "stop-opacity": String(a ?? 1) } }));
        // Lineáris színátmenet iránya a megadott szögből (0° = balról jobbra).
        const ang = ((grad?.angle ?? 90) - 90) * (Math.PI / 180);
        const gx = Math.cos(ang) / 2, gy = Math.sin(ang) / 2;
        const defs = grad
          ? [{ type: "defs", props: { children: grad.gradient === "radial"
              ? { type: "radialGradient", props: { id: "pg", cx: "0", cy: "1", r: "1.2", children: stops } }
              : { type: "linearGradient", props: { id: "pg", x1: String(0.5 - gx), y1: String(0.5 + gy), x2: String(0.5 + gx), y2: String(0.5 - gy), children: stops } } } }]
          : [];
        return h("div", base,
          { type: "svg", props: { width: bw, height: bh, viewBox: `0 0 ${bw} ${bh}`, children: [
            ...defs,
            { type: "polygon", props: { points: pts, fill: grad ? "url(#pg)" : resolveColor(l.fill as ColorRef, ctx.palette) } },
          ] } });
      }
      const fill = typeof l.fill === "string"
        ? { background: resolveColor(l.fill, ctx.palette) }
        : {
            backgroundImage: l.fill.gradient === "radial"
              ? `radial-gradient(circle at 50% 100%, ${l.fill.stops.map(([o, c, a]) => `${rgba(resolveColor(c, ctx.palette), a ?? 1)} ${Math.round(o * 100)}%`).join(", ")})`
              : `linear-gradient(${l.fill.angle ?? 90}deg, ${l.fill.stops.map(([o, c, a]) => `${rgba(resolveColor(c, ctx.palette), a ?? 1)} ${Math.round(o * 100)}%`).join(", ")})`,
          };
      return h("div", {
        ...base, ...fill,
        borderRadius: l.shape === "circle" ? 9999 : l.shape === "roundedRect" ? Math.round((l.radius ?? 0.02) * S) : 0,
        ...(l.skewX ? { transform: `skewX(${l.skewX}deg)` } : {}),
      });
    }
    case "text": {
      const v = valueOf(l.bind, l.text, ctx.data);
      if (!v) return null;
      const w = Math.round(l.box.w * ctx.W);
      return h("div", {
        ...base, flexDirection: "column",
        justifyContent: l.valign === "middle" ? "center" : l.valign === "bottom" ? "flex-end" : "flex-start",
        alignItems: l.align === "center" ? "center" : l.align === "right" ? "flex-end" : "flex-start",
      }, textBlock(v, l, ctx, family, w));
    }
    case "stack": {
      const pad = l.padding ?? {};
      const pl = Math.round((pad.left ?? 0) * S), pr = Math.round((pad.right ?? 0) * S);
      const innerW = Math.round(l.box.w * ctx.W) - pl - pr;
      const items = l.items.map((it) => stackItem(it, ctx, family, innerW)).filter(Boolean);
      if (!items.length) return null;
      return h("div", {
        ...base, flexDirection: "column",
        justifyContent: l.valign === "middle" ? "center" : l.valign === "bottom" ? "flex-end" : "flex-start",
        alignItems: l.align === "center" ? "center" : l.align === "right" ? "flex-end" : "flex-start",
        paddingTop: Math.round((pad.top ?? 0) * S), paddingBottom: Math.round((pad.bottom ?? 0) * S),
        paddingLeft: pl, paddingRight: pr,
      }, items);
    }
    case "image": {
      const src = valueOf(l.bind, undefined, ctx.data);
      if (!src) return null;
      if (l.mask === "diamond") return diamondImage(l, src, ctx);
      // A kör alakú kép mindig valódi kör (a doboz rövidebb oldalára), középre igazítva.
      const bw = Math.round(l.box.w * ctx.W), bh = Math.round(l.box.h * ctx.H);
      const d = Math.min(bw, bh);
      const circle = l.mask === "circle";
      const frame = circle
        ? { left: Math.round(l.box.x * ctx.W + (bw - d) / 2), top: Math.round(l.box.y * ctx.H + (bh - d) / 2), width: d, height: d }
        : {};
      const border = l.border && l.border.width > 0 ? Math.max(1, Math.round(l.border.width * S)) : 0;
      // Ingatlanfotó (photo.N): középre vágva — ugyanúgy, ahogy a motor nagyító rétege vág,
      // így az álló kép és a mozgó kép pontosan fedi egymást.
      const isPhoto = String(l.bind).startsWith("photo.");
      const zoom = l.zoom && Math.abs(l.zoom - 1) > 0.0005 ? { transform: `scale(${l.zoom.toFixed(4)})` } : {};
      return h("div", {
        ...base, ...frame, overflow: "hidden",
        ...(l.shadow ? { boxShadow: `0 ${Math.round(S * 0.008)}px ${Math.round(S * 0.022)}px rgba(40,30,20,0.22)` } : {}),
        borderRadius: circle ? 9999 : l.mask === "rounded" ? Math.round(0.03 * S) : 0,
        ...(border ? { border: `${border}px solid ${resolveColor(l.border!.color, ctx.palette)}` } : {}),
        // Logónál (contain) fehér alap, hogy az átlátszó logó is jól látsszon.
        ...(l.fit === "contain" ? { background: "#ffffff", padding: Math.round(d * 0.12) } : {}),
      },
        // Portrénál az arc a kép felső részén van → a kivágás felülre igazodik.
        // A méret attribútumként is megvan: a Satori így sosem próbálja letölteni a képet
        // a méretéért (élesben ez okozott „Image size cannot be determined" hibát).
        { type: "img", props: { src, width: circle ? d : bw, height: circle ? d : bh, style: { width: "100%", height: "100%", objectFit: l.fit ?? "cover", objectPosition: l.fit === "contain" || isPhoto ? "center" : "center top", ...zoom } } });
    }
    case "symbol": {
      // Vonalas ingatlanos ikon (ugyanaz a rajz, mint a Prestige szimbólum-áttűnéséé).
      const size = Math.round(l.box.w * ctx.W);
      return h("div", { ...base, width: size, height: size },
        symbolSvg(l.symbol, size, {
          fill: l.fill ? resolveColor(l.fill, ctx.palette) : "none",
          stroke: resolveColor(l.stroke, ctx.palette),
        }));
    }
    case "component":
      if (l.component === "captionBar") return captionBar(l, ctx, family);
      if (l.component === "captionCard") return captionCard(l, ctx, family);
      if (l.component === "marble") return marble(l, ctx);
      if (l.component === "paperNote") return paperNote(l, ctx, family);
      return null; // ár-pecsét — később

    default:
      return null;
  }
}

/**
 * FOTÓNKÉNTI FELIRATSÁV (a mostani Aurora-feliratsáv pontos mása):
 *  • alul: lágy, alulról sötétedő sáv a fotón (a felirat mindig olvasható);
 *  • két sor, középre igazítva, félkövér fehér betű árnyékkal — a betűméret a
 *    szöveg hosszához igazodik, így nem lóg ki;
 *  • a szöveg fölött rövid kiemelő csík a paletta színével.
 * Adat: `caption.N` = "1. sor\n2. sor" (a 2. sor elhagyható). Üres adat → nincs sáv.
 * `props.position = "center"`: középre igazított változat (fent-lent áttűnő sávval).
 */
function captionBar(l: Extract<Layer, { kind: "component" }>, ctx: LayerCtx, family: string): SatoriNode | null {
  const raw = valueOf(l.bind, undefined, ctx.data);
  if (!raw) return null;
  const [line1 = "", line2 = ""] = raw.split("\n").map((x) => x.trim());
  if (!line1 && !line2) return null;
  const W = ctx.W, H = ctx.H, u = W / 1080;
  const accent = resolveColor("@accent", ctx.palette);
  const has2 = Boolean(line2);
  const fs1 = Math.round((line1.length > 30 ? 54 : line1.length > 22 ? 66 : 80) * u);
  const fs2 = Math.round((line2.length > 30 ? 50 : line2.length > 22 ? 58 : 68) * u);
  const shadow = "0 3px 18px rgba(0,0,0,0.9)";
  const lineStyle = (size: number, mt = 0) => ({
    display: "flex", fontFamily: family, fontSize: size, fontWeight: 700, color: "#ffffff",
    lineHeight: 1.12, letterSpacing: Math.round(1 * u), textShadow: shadow, textAlign: "center", marginTop: mt,
  });
  const rule = (mt = 0) => h("div", {
    display: "flex", width: Math.round(100 * u), height: Math.max(3, Math.round(4 * u)), background: accent, opacity: 0.95, marginTop: mt,
  });
  const texts = [
    line1 ? h("div", lineStyle(fs1), line1) : null,
    has2 ? h("div", lineStyle(fs2, Math.round(10 * u)), line2) : null,
  ].filter(Boolean);
  const full = { position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" };

  // A felirat helye: a partner fotónkénti választása (adat) > a sablon alapértéke.
  const n = String(l.bind ?? "").split(".")[1];
  const position = (n && ctx.data[`captionpos.${Number(n)}`]) || String(l.props?.position ?? "bottom");
  if (position === "center") {
    const bandH = Math.round((has2 ? 500 : 430) * u);
    return h("div", full, [
      h("div", {
        position: "absolute", left: 0, top: Math.round((H - bandH) / 2), width: W, height: bandH, display: "flex",
        backgroundImage: "linear-gradient(180deg, rgba(12,14,16,0) 0%, rgba(12,14,16,0.58) 26%, rgba(12,14,16,0.64) 74%, rgba(12,14,16,0) 100%)",
      }),
      h("div", {
        position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", paddingLeft: Math.round(48 * u), paddingRight: Math.round(48 * u),
      }, [rule(), ...texts.map((t, i) => (i === 0 ? { ...t, props: { ...t!.props, style: { ...(t!.props.style as object), marginTop: Math.round(26 * u) } } } : t)), rule(Math.round(26 * u))]),
    ]);
  }

  const zoneH = Math.round((has2 ? 430 : 360) * u);
  return h("div", full, [
    h("div", {
      position: "absolute", left: 0, bottom: 0, width: W, height: zoneH, display: "flex",
      backgroundImage: "linear-gradient(0deg, rgba(12,14,16,0.74) 0%, rgba(12,14,16,0.36) 55%, rgba(12,14,16,0) 100%)",
    }),
    // A kiemelő csík a szövegblokk része (fölötte, fix réssel) — így hosszú vagy
    // nagy betűs első sornál sem csúszhat bele a szövegbe.
    h("div", {
      position: "absolute", left: 0, bottom: Math.round(66 * u), width: W, display: "flex", flexDirection: "column",
      alignItems: "center", paddingLeft: Math.round(48 * u), paddingRight: Math.round(48 * u),
    }, [h("div", {
      display: "flex", width: Math.round(100 * u), height: Math.max(3, Math.round(4 * u)), background: accent, opacity: 0.95,
      marginBottom: Math.round(22 * u),
    }), ...texts]),
  ]);
}

/**
 * KÁRTYÁS FOTÓFELIRAT (Skandi): világos, enyhén áttetsző kártya sötét betűkkel —
 * bármilyen fotón olvasható, mert a szöveg nem a képen, hanem a kártyán ül.
 *  • fent apró sorszám („02") és vékony kiemelő vonal;
 *  • 1. sor: a fő felirat (közepesen vastag), 2. sor: kiegészítés (vékony, halványabb);
 *  • a kártya legfeljebb a vászon 84%-áig szélesedik; a hosszú szöveg TÖRDEL, és ha
 *    soronként kettőnél több kellene, a betű kisebb lesz — így SOHA nem lóg ki.
 * Hely: `captionpos.N` adat vagy `props.position` — "bottom" (bal alsó) / "center".
 * Betűsúlyok: props.weightMain (alap 500), props.weightSub (alap 300).
 */
function captionCard(l: Extract<Layer, { kind: "component" }>, ctx: LayerCtx, family: string): SatoriNode | null {
  const raw = valueOf(l.bind, undefined, ctx.data);
  if (!raw) return null;
  const [line1 = "", line2 = ""] = raw.split("\n").map((x) => x.trim());
  if (!line1 && !line2) return null;
  const W = ctx.W, H = ctx.H, S = Math.min(W, H);
  const square = ctx.aspect === "1:1";
  const n = Number(String(l.bind ?? "").split(".")[1]) || 0;
  const position = (n && ctx.data[`captionpos.${n}`]) || String(l.props?.position ?? "bottom");
  const pal = ctx.palette;
  // Álló (9:16) méretre a sablon nagyíthatja a kártyát és a betűt (props.portraitScale),
  // szélesebbre veheti (props.portraitWidth) és több sort engedhet (props.portraitLines).
  const ps = square ? 1 : Number(l.props?.portraitScale ?? 1);
  const maxW = Math.round(W * (square ? 0.84 : Number(l.props?.portraitWidth ?? 0.84)));
  const padX = Math.round(S * (square ? 0.032 : 0.036) * ps);
  const padY = Math.round(S * (square ? 0.026 : 0.03) * ps);
  const innerW = maxW - padX * 2;
  const wMain = Number(l.props?.weightMain ?? 500);
  const wSub = Number(l.props?.weightSub ?? 300);
  const sizeMain = (square ? 0.04 : 0.046) * ps;
  const sizeSub = (square ? 0.028 : 0.032) * ps;

  const label = h("div", { display: "flex", alignItems: "center", marginBottom: Math.round(S * 0.014) }, [
    h("div", {
      display: "flex", fontFamily: family, fontWeight: wMain, fontSize: Math.round(S * 0.02),
      letterSpacing: Math.round(S * 0.004), color: resolveColor("@accent", pal),
    }, String(n).padStart(2, "0")),
    h("div", { display: "flex", width: Math.round(S * 0.05), height: Math.max(2, Math.round(S * 0.0025)), background: resolveColor("@accent", pal), marginLeft: Math.round(S * 0.014) }),
  ]);
  // Egységes mód (props.uniform): a teljes felirat EGY szövegtömb, EGY betűmérettel
  // és vastagsággal — nincs külön „fő" és „al" sor. Legfeljebb 3 sor; ha a
  // szöveg ennél többet kívánna, a betű arányosan kisebb lesz (nem lóg ki).
  if (l.props?.uniform) {
    const all = [line1, line2].filter(Boolean).join(" ");
    const lines = square ? 3 : Number(l.props?.portraitLines ?? 3);
    const block = textBlock(all, { font: { weight: wMain, size: sizeMain }, color: "@text", lineHeight: 1.2, maxLines: lines }, ctx, family, innerW);
    const ucard = h("div", {
      display: "flex", flexDirection: "column", maxWidth: maxW,
      paddingLeft: padX, paddingRight: padX, paddingTop: padY, paddingBottom: padY,
      background: rgba(resolveColor("@base", pal), 0.94),
      borderRadius: Math.round(S * 0.02),
      boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    }, [label, block].filter(Boolean));
    const ufull = { position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" };
    if (position === "center") return h("div", { ...ufull, alignItems: "center", justifyContent: "center" }, ucard);
    return h("div", {
      ...ufull, alignItems: "flex-end", justifyContent: "flex-start",
      paddingLeft: Math.round(W * 0.06), paddingBottom: Math.round(H * (square ? 0.06 : 0.075)),
    }, ucard);
  }
  const main = line1
    ? textBlock(line1, { font: { weight: wMain, size: sizeMain }, color: "@text", lineHeight: 1.18, maxLines: 2 }, ctx, family, innerW)
    : null;
  const sub = line2
    ? textBlock(line2, { font: { weight: wSub, size: sizeSub }, color: (l.props?.colorSub as ColorRef | undefined) ?? "@muted", lineHeight: 1.25, maxLines: 2 }, ctx, family, innerW,
        { marginTop: Math.round(S * 0.008) })
    : null;

  const card = h("div", {
    display: "flex", flexDirection: "column", maxWidth: maxW,
    paddingLeft: padX, paddingRight: padX, paddingTop: padY, paddingBottom: padY,
    background: rgba(resolveColor("@base", pal), 0.94),
    borderRadius: Math.round(S * 0.02),
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
  }, [label, main, sub].filter(Boolean));

  const full = { position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" };
  if (position === "center") {
    return h("div", { ...full, alignItems: "center", justifyContent: "center" }, card);
  }
  return h("div", {
    ...full, alignItems: "flex-end", justifyContent: "flex-start",
    paddingLeft: Math.round(W * 0.06), paddingBottom: Math.round(H * (square ? 0.06 : 0.075)),
  }, card);
}

/**
 * RombUSZ alakú fotó (a Mozaik sablon „gyémánt" képei): a doboz oldalfelezőin ülő
 * csúcsokkal, a fotó kitölti (cover), körben vastag (alapból fehér) kerettel.
 * SVG-vel rajzolva (vágógörbe + kép), hogy a rajzoló biztosan kezelje.
 */
function diamondImage(l: Extract<Layer, { kind: "image" }>, src: string, ctx: LayerCtx): SatoriNode {
  const S = Math.min(ctx.W, ctx.H);
  // A rombusz = 45°-ban elforgatott négyzet: a doboz (D×D) oldalfelezőin ülnek a csúcsai.
  const D = Math.round(Math.min(l.box.w * ctx.W, l.box.h * ctx.H));
  const cx = Math.round((l.box.x + l.box.w / 2) * ctx.W), cy = Math.round((l.box.y + l.box.h / 2) * ctx.H);
  const side = D / Math.SQRT2; // az elforgatott négyzet oldala
  const b = l.border ? Math.max(2, Math.round(l.border.width * S)) : 0;
  return {
    type: "div",
    props: {
      style: {
        position: "absolute", left: Math.round(cx - side / 2), top: Math.round(cy - side / 2),
        width: Math.round(side), height: Math.round(side), display: "flex", overflow: "hidden",
        transform: "rotate(45deg)", opacity: l.opacity ?? 1,
        ...(b ? { border: `${b}px solid ${resolveColor(l.border!.color, ctx.palette)}` } : {}),
      },
      // A fotó visszaforgatva → álló kép, a rombusz teljes területét kitölti (cover).
      children: {
        type: "img",
        props: {
          src, width: D, height: D,
          style: {
            position: "absolute", left: Math.round((side - D) / 2) - b, top: Math.round((side - D) / 2) - b,
            width: D, height: D, objectFit: "cover", transform: "rotate(-45deg)",
          },
        },
      },
    },
  };
}

/**
 * Világos MÁRVÁNY háttér (a Mozaik sablon alapja): halvány, lágy erezet a paletta
 * alapszínén. Kódból (SVG zajszűrő) — nincs külső képfájl.
 */
function marble(l: Extract<Layer, { kind: "component" }>, ctx: LayerCtx): SatoriNode {
  const W = ctx.W, H = ctx.H;
  const base = resolveColor("@base", ctx.palette);
  const vein = resolveColor((l.props?.vein as ColorRef | undefined) ?? "@muted", ctx.palette);
  const seed = Number(l.props?.seed ?? 7);
  return {
    type: "div",
    props: {
      style: { position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" },
      children: {
        type: "svg",
        props: {
          width: W, height: H, viewBox: `0 0 ${W} ${H}`,
          children: [
            { type: "defs", props: { children: [
              { type: "filter", props: { id: "mv", x: "0", y: "0", width: "100%", height: "100%", children: [
                { type: "feTurbulence", props: { type: "fractalNoise", baseFrequency: "0.0011 0.0034", numOctaves: "4", seed: String(seed), result: "n" } },
                // A zaj értékét az átlátszóságba tesszük, majd csak egy KESKENY sávját hagyjuk meg
                // → vékony, kanyargó „erezet" (mint a márványon), nem foltok.
                { type: "feColorMatrix", props: { in: "n", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0", result: "a" } },
                { type: "feComponentTransfer", props: { in: "a", result: "v", children: { type: "feFuncA", props: { type: "table", tableValues: "0 0 0 0 0 0 0 0 0 0 0 0.75 0 0 0 0 0 0 0 0 0 0 0" } } } },
                { type: "feGaussianBlur", props: { in: "v", stdDeviation: "0.6" } },
              ] } },
              { type: "linearGradient", props: { id: "mg", x1: "0", y1: "0", x2: "1", y2: "1", children: [
                { type: "stop", props: { offset: "0", "stop-color": "#ffffff", "stop-opacity": "0.55" } },
                { type: "stop", props: { offset: "1", "stop-color": "#ffffff", "stop-opacity": "0" } },
              ] } },
            ] } },
            { type: "rect", props: { x: 0, y: 0, width: W, height: H, fill: base } },
            { type: "rect", props: { x: 0, y: 0, width: W, height: H, fill: vein, opacity: 0.2, filter: "url(#mv)" } },
            { type: "rect", props: { x: 0, y: 0, width: W, height: H, fill: "url(#mg)" } },
          ],
        },
      },
    },
  };
}

/**
 * PAPÍRCSÍK-FELIRAT (a Mozaik fotónkénti szövegablaka): krémszínű, enyhén szálas
 * „vászonpapír" csík szakadt bal és jobb széllel, picit megdöntve, halk árnyékkal.
 * A szöveg EGY tömb, egy betűmérettel, középre zárva; a csík magassága a szöveghez igazodik.
 *  • props.family / props.weight — a felirat betűje (alap: a sablon első betűje, 500);
 *  • props.size — betűméret a vászon rövidebb oldalához mérve; props.lines — max. sorszám
 *    (ha a szöveg többet kívánna, a betű arányosan kisebb lesz — sosem lóg ki);
 *  • props.insetLeft — a szöveg bal margója a csík bal szélétől (a vászon szélességében):
 *    a csík bal vége a kis képek ALÁ bújik, a szöveg csak a látható részen ül;
 *  • props.tilt — döntés fokban (alap −1).
 * A csík a doboz függőleges közepén ül.
 */
function paperNote(l: Extract<Layer, { kind: "component" }>, ctx: LayerCtx, family: string): SatoriNode | null {
  const raw = valueOf(l.bind, undefined, ctx.data);
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  const W = ctx.W, H = ctx.H, S = Math.min(W, H);
  const fam = String(l.props?.family ?? family);
  const weight = Number(l.props?.weight ?? 500);
  const size = Number(l.props?.size ?? 0.044);
  const lines = Number(l.props?.lines ?? 3);
  const bx = Math.round(l.box.x * W), by = Math.round(l.box.y * H);
  const bw = Math.round(l.box.w * W), bh = Math.round(l.box.h * H);
  const inL = Math.round(Number(l.props?.insetLeft ?? 0.05) * W);
  const inR = Math.round(S * 0.05);
  const padY = Math.round(S * 0.034);
  const innerW = bw - inL - inR;
  const block = textBlock(text, { font: { weight, size }, color: (l.props?.color as ColorRef | undefined) ?? "#2e2a26", lineHeight: 1.24, maxLines: lines, align: "center" }, ctx, fam, innerW,
    { width: innerW });
  // A papír: SVG (szakadt szélek + finom szálas textúra + árnyék), a csík méretére nyújtva.
  const jag = (side: "l" | "r") => {
    const pts: string[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const y = 20 + (i / n) * 260;
      const wob = ((i * 37) % 11) / 11; // determinisztikus „szakadás"
      const x = side === "l" ? 14 + wob * 9 : 986 - wob * 9;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return side === "l" ? pts.reverse() : pts;
  };
  const poly = [...jag("r"), ...jag("l")].join(" ");
  const paper = String(l.props?.paper ?? "#f5efe4");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 1000 300" preserveAspectRatio="none">` +
    `<defs><filter id="s" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#3a2a1a" flood-opacity="0.22"/></filter>` +
    `<filter id="t"><feTurbulence type="fractalNoise" baseFrequency="0.55 0.08" numOctaves="2" seed="4"/>` +
    `<feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.37  0 0 0 0 0.30  0 0 0 0.16 0"/></filter>` +
    `<clipPath id="c"><polygon points="${poly}"/></clipPath></defs>` +
    `<polygon points="${poly}" fill="${paper}" filter="url(#s)"/>` +
    `<rect x="0" y="0" width="1000" height="300" filter="url(#t)" clip-path="url(#c)"/>` +
    `</svg>`;
  const src = `data:image/svg+xml;base64,${typeof Buffer !== "undefined" ? Buffer.from(svg).toString("base64") : btoa(svg)}`;
  return h("div", {
    position: "absolute", left: bx, top: by, width: bw, height: bh, display: "flex", alignItems: "center",
  }, h("div", {
    display: "flex", width: bw, position: "relative",
    paddingLeft: inL, paddingRight: inR, paddingTop: padY, paddingBottom: padY,
    transform: `rotate(${Number(l.props?.tilt ?? -1)}deg)`,
    backgroundImage: `url(${src})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
  }, block));
}

/** Több réteg egy teljes vászonméretű, átlátszó képre. */
export function layersFrame(layers: Layer[], ctx: LayerCtx, family: string): SatoriNode | null {
  const nodes = layers.map((l) => layerNode(l, ctx, family)).filter(Boolean);
  if (!nodes.length) return null;
  return h("div", { position: "relative", display: "flex", width: ctx.W, height: ctx.H, overflow: "hidden" }, nodes);
}
