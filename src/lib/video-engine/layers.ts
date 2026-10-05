// RÉTEGEK → KÉP: a sablon rétegeit (forma, szöveg, halmozott blokk, kép) Satori-
// elemmé alakítja. A motor ebből egy átlátszó PNG-t rajzol, és animálva ülteti a
// videóra. KLIENS-/SZERVER-FÜGGETLEN (nincs Node-import).
import {
  resolveColor,
  type AspectId, type BindKey, type Box, type ColorRef, type Layer, type Palette, type StackItem,
} from "./template-schema";
import type { SatoriNode } from "./transitions";

export type BindData = Partial<Record<BindKey, string>>;

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
function fitSize(text: string, px: number, boxW: number, maxLines: number | undefined): number {
  if (!maxLines) return px;
  let size = px;
  const longest = (s: number) =>
    text.split("\n").reduce((acc, line) => acc + Math.max(1, Math.ceil((line.length * s * 0.5) / boxW)), 0);
  while (size > px * 0.55 && longest(size) > maxLines) size *= 0.93;
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
  const px = fitSize(shown, o.font.size * S, boxW, o.maxLines);
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
      // A kör alakú kép mindig valódi kör (a doboz rövidebb oldalára), középre igazítva.
      const bw = Math.round(l.box.w * ctx.W), bh = Math.round(l.box.h * ctx.H);
      const d = Math.min(bw, bh);
      const circle = l.mask === "circle";
      const frame = circle
        ? { left: Math.round(l.box.x * ctx.W + (bw - d) / 2), top: Math.round(l.box.y * ctx.H + (bh - d) / 2), width: d, height: d }
        : {};
      const border = l.border ? Math.max(2, Math.round(l.border.width * S)) : 0;
      return h("div", {
        ...base, ...frame, overflow: "hidden",
        borderRadius: circle ? 9999 : l.mask === "rounded" ? Math.round(0.03 * S) : 0,
        ...(l.border ? { border: `${border}px solid ${resolveColor(l.border.color, ctx.palette)}` } : {}),
        // Logónál (contain) fehér alap, hogy az átlátszó logó is jól látsszon.
        ...(l.fit === "contain" ? { background: "#ffffff", padding: Math.round(d * 0.12) } : {}),
      },
        // Portrénál az arc a kép felső részén van → a kivágás felülre igazodik.
        { type: "img", props: { src, style: { width: "100%", height: "100%", objectFit: l.fit ?? "cover", objectPosition: l.fit === "contain" ? "center" : "center top" } } });
    }
    default:
      return null; // kész elemek (feliratsáv, ár-pecsét) — következő lépés
  }
}

/** Több réteg egy teljes vászonméretű, átlátszó képre. */
export function layersFrame(layers: Layer[], ctx: LayerCtx, family: string): SatoriNode | null {
  const nodes = layers.map((l) => layerNode(l, ctx, family)).filter(Boolean);
  if (!nodes.length) return null;
  return h("div", { position: "relative", display: "flex", width: ctx.W, height: ctx.H, overflow: "hidden" }, nodes);
}
