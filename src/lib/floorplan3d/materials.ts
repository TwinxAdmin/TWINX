// Stílus-anyagok a 3D-jelenetre (3. lépés, F3a) — CSAK böngészőben (textúra-betöltés, vászon).
// A stíluslap MEGNEVEZI az anyagot (pl. primary_wood: "light_oak_matte"), az anyagkönyvtár (MATERIAL_LIBRARY) mondja meg,
// hogyan jelenik meg 3D-ben (CC0-textúra + szín + érdesség). A geometriához NEM nyúlunk — csak a hálók anyagát cseréljük.
// Textúrák: public/floorplan3d/textures (Poly Haven, CC0 — lásd LICENC.md).
import * as THREE from "three";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import type { FloorPlan, RoomKind } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS } from "@/lib/floorplan3d/plan";
import type { BuiltScene } from "@/lib/floorplan3d/scene";

const TEX = "/floorplan3d/textures";

/** Anyagkönyvtár: a stíluslap anyagneveihez a megjelenítés. (A színkódok javaslatok — a stíluslapba is bekerülhetnek.) */
// recolor: a textúra színe helyett a stílus színe (a mintázat megmarad); contrast: mennyit tartson meg a mintázat világosság-
// ingadozásából (0 = sima szín, 1 = az eredeti kontraszt); normal: a felületi domborzat erőssége.
export const MATERIAL_LIBRARY: Record<string, { texture?: string; tileM: number; color: string; roughness: number; contrast?: number; normal?: number }> = {
  light_oak_matte: { texture: "wood_floor", tileM: 1.7, color: "#DCC8AA", roughness: 0.82, contrast: 0.3, normal: 0.5 },
  wide_plank_light_oak_matte: { texture: "wood_floor", tileM: 1.7, color: "#DCC8AA", roughness: 0.82, contrast: 0.3, normal: 0.5 },
  walnut: { texture: "wood_floor", tileM: 1.7, color: "#6B4A33", roughness: 0.75, contrast: 0.4, normal: 0.5 },
  large_format_matte_stone: { tileM: 1.2, color: "#BDB4A8", roughness: 0.9 },
  plaster: { texture: "white_plaster_02", tileM: 2.0, color: "#EDE8E0", roughness: 0.95, contrast: 0.06, normal: 0.15 },
  linen: { texture: "rough_linen", tileM: 0.5, color: "#E6DFD3", roughness: 0.98, contrast: 0.25, normal: 0.6 },
  boucle: { texture: "wool_boucle", tileM: 0.4, color: "#EFE9DF", roughness: 1, contrast: 0.06, normal: 0.9 },
  outdoor_tile: { tileM: 1.0, color: "#A39C91", roughness: 0.95 },
  wool_rug: { texture: "wool_boucle", tileM: 0.6, color: "#E4DCCD", roughness: 1, contrast: 0.05, normal: 0.5 },
};

const WET: RoomKind[] = ["furdo", "wc"];
const KITCHEN: RoomKind[] = ["konyha"];

// ---------------------------------------------------------------------------
const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();

function load(url: string, srgb: boolean): Promise<THREE.Texture> {
  const key = `${url}|${srgb}`;
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    }));
  }
  return cache.get(key)!;
}

/**
 * A színtérkép „átszínezése": a textúra világosság-mintázatát (erezet, deszkahatár) megtartjuk, a színt a stílus adja.
 * (A Poly Haven fapadló közepesen barna — így lesz belőle világos matt tölgy, a CC0 megengedi a módosítást.)
 */
async function recolored(name: string, hex: string, contrast: number): Promise<THREE.Texture> {
  const key = `recolor|${name}|${hex}|${contrast}`;
  if (!cache.has(key)) {
    cache.set(key, load(`${TEX}/${name}_diff_1k.jpg`, true).then((src) => {
      const img = src.image as HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const mean = sum / (px.length / 4) || 1;
      const t = new THREE.Color(hex);
      for (let i = 0; i < px.length; i += 4) {
        const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / mean; // 1 = átlagos világosság
        const f = 1 + contrast * (l - 1);                                          // a mintázat visszafogott megtartása
        px[i] = Math.min(255, t.r * 255 * f); px[i + 1] = Math.min(255, t.g * 255 * f); px[i + 2] = Math.min(255, t.b * 255 * f);
      }
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      return tex;
    }));
  }
  return cache.get(key)!;
}

/** Egy könyvtári anyagból MeshStandardMaterial (textúra a világ-méterhez igazítva: tileM méterenként ismétlődik). */
export async function libraryMaterial(name: string, override?: { color?: string }): Promise<THREE.MeshStandardMaterial> {
  const def = MATERIAL_LIBRARY[name] ?? { tileM: 1, color: "#cccccc", roughness: 0.9 };
  const color = override?.color ?? def.color;
  const mat = new THREE.MeshStandardMaterial({ color: def.texture ? 0xffffff : color, roughness: def.roughness, metalness: 0 });
  if (def.texture) {
    const [map, normal, rough] = await Promise.all([
      recolored(def.texture, color, def.contrast ?? 0.3),
      load(`${TEX}/${def.texture}_nor_gl_1k.jpg`, false),
      load(`${TEX}/${def.texture}_rough_1k.jpg`, false),
    ]);
    for (const t of [map, normal, rough]) t.repeat.set(1 / def.tileM, 1 / def.tileM);
    mat.map = map; mat.normalMap = normal; mat.roughnessMap = rough;
    mat.normalScale.set(def.normal ?? 0.5, def.normal ?? 0.5);
  }
  mat.userData.library = name;
  return mat;
}

/**
 * Világ-méteres UV a dobozokra (falak): a BoxGeometry alap-UV-ja lapanként 0–1, így a textúra minden falon máshogy nyúlna.
 * Itt minden csúcs UV-ja a világbeli helyéből jön (a lap normálisa szerint választott két tengely) → egységes léptékű felület.
 */
export function worldUV(mesh: THREE.Mesh) {
  const g = mesh.geometry as THREE.BufferGeometry;
  const pos = g.getAttribute("position"), nor = g.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(nor, i).transformDirection(mesh.matrixWorld); // elforgatott bútornál is a VILÁG-normális döntsön
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    if (ax >= ay && ax >= az) { uv[i * 2] = p.z; uv[i * 2 + 1] = p.y; }
    else if (az >= ay) { uv[i * 2] = p.x; uv[i * 2 + 1] = p.y; }
    else { uv[i * 2] = p.x; uv[i * 2 + 1] = p.z; }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** A stíluslap szerinti padlóanyag-név egy helyiségtípushoz. */
export function floorMaterialName(kind: RoomKind, sheet: StyleSheet): string {
  if (OUTDOOR_KINDS.includes(kind)) return "outdoor_tile";
  if (WET.includes(kind) || KITCHEN.includes(kind)) return sheet.floor.wet_rooms.type;
  return sheet.floor.living;
}

/**
 * Színhőmérséklet (K) → RGB (Tanner Helland-féle közelítés) — a stíluslap 2700–3000 K meleg fényéhez.
 * whiteBalance: 0 = nyers (erősen narancs), 1 = fehér; a fényképezőgép fehéregyensúlyához hasonlóan részben semlegesítünk.
 */
export function kelvinToColor(k: number, whiteBalance = 0): THREE.Color {
  return rawKelvin(k).lerp(new THREE.Color(1, 1, 1), whiteBalance);
}

function rawKelvin(k: number): THREE.Color {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

/**
 * A stílus anyagainak alkalmazása a megépült (berendezetlen) jelenetre: fal (vakolat + megengedett falszín), mennyezet,
 * padló helyiségtípusonként (lakótér: világos tölgy; vizes helyiség és konyha: matt greige kő; kültér: kültéri lap).
 * Visszaadja az eredeti anyagokat (a „Berendezetlen" nézethez vissza lehet állni).
 */
export async function applyStyle(built: BuiltScene, plan: FloorPlan, sheet: StyleSheet): Promise<() => void> {
  const kindOf = new Map(plan.rooms.map((r) => [r.id, r.kind]));
  const wall = await libraryMaterial("plaster", { color: sheet.wall_colors_allowed[0] });
  const ceiling = new THREE.MeshStandardMaterial({ color: sheet.ceiling_color, roughness: 1, side: THREE.DoubleSide });
  const floors = new Map<string, THREE.MeshStandardMaterial>();
  const floorFor = async (kind: RoomKind) => {
    const name = floorMaterialName(kind, sheet);
    if (!floors.has(name)) floors.set(name, await libraryMaterial(name, name === sheet.floor.wet_rooms.type ? { color: sheet.floor.wet_rooms.color } : undefined));
    return floors.get(name)!;
  };
  const restore: { mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];
  const meshes: THREE.Mesh[] = [];
  built.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const kind = m.userData.kind as string | undefined;
    if (kind === "wall") { restore.push({ mesh: m, mat: m.material }); worldUV(m); m.material = wall; }
    else if (kind === "ceiling") { restore.push({ mesh: m, mat: m.material }); m.material = ceiling; }
    else if (kind === "floor") { restore.push({ mesh: m, mat: m.material }); m.material = await floorFor(kindOf.get(m.userData.roomId) ?? "egyeb"); }
  }
  return () => { for (const r of restore) r.mesh.material = r.mat; };
}
