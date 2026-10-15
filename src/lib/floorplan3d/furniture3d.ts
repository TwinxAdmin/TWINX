// Paraméteres bútorok 3D-ben (3. lépés, F3b) — CSAK böngészőben. A japandi stíluslap formái szerint: alacsony, egyenes vonalú,
// enyhén lekerekített élek, vastag falapok, látható fa lábak, szövet kárpit (len, buklé — soha nem bőr), fogantyú nélküli frontok.
// Minden bútor a saját helyi rendszerében épül (x = szélesség, z = mélység, ELEJE +z), majd a leírás (FurnitureItem) helyére kerül.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FurnitureItem } from "@/lib/floorplan3d/furniture";
import { libraryMaterial, worldUV } from "@/lib/floorplan3d/materials";

type Mats = Record<string, THREE.Material>;

/** A bútorokhoz szükséges anyagok egyszeri betöltése (anyagkönyvtár + néhány egyszerű anyag). */
export async function furnitureMaterials(): Promise<Mats> {
  const [oak, linen, boucle, rug] = await Promise.all([
    libraryMaterial("light_oak_matte"), libraryMaterial("linen"), libraryMaterial("boucle"), libraryMaterial("wool_rug"),
  ]);
  return {
    light_oak_matte: oak, linen, boucle, wool_rug: rug,
    ceramic: new THREE.MeshStandardMaterial({ color: "#3A3632", roughness: 0.85 }),          // faszén, matt mázas
    ceramic_light: new THREE.MeshStandardMaterial({ color: "#D9D0C3", roughness: 0.85 }),
    black_metal: new THREE.MeshStandardMaterial({ color: "#1F1E1C", roughness: 0.55, metalness: 0.4 }),
    rice_paper: new THREE.MeshStandardMaterial({ color: "#F5EEDF", roughness: 1, emissive: "#FFE2B8", emissiveIntensity: 0.9, transparent: true, opacity: 0.95 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#6E8A5E", roughness: 0.8, side: THREE.DoubleSide }),
    soil: new THREE.MeshStandardMaterial({ color: "#3b3027", roughness: 1 }),
  };
}

const rbox = (w: number, h: number, d: number, r = 0.03) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));

/** Egy hálót a csoportba tesz: alja y0-n, közepe (x, z)-ben. */
function add(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y0: number, z: number, h: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}

function legs(g: THREE.Group, mat: THREE.Material, w: number, d: number, h: number, inset = 0.06, r = 0.022) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(r, r * 0.85, h, 14), mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), h);
  }
}

// ---------------------------------------------------------------------------
const builders: Record<FurnitureItem["type"], (it: FurnitureItem, m: Mats, ceiling: number) => THREE.Group> = {
  sofa: (it, m) => {
    const g = new THREE.Group(), up = m[it.materials?.upholstery ?? "linen"] ?? m.linen, wood = m.light_oak_matte;
    const legH = 0.07, baseH = 0.22, arm = 0.16, backD = 0.2;
    legs(g, wood, it.w - 0.1, it.d - 0.1, legH, 0.05, 0.02);
    add(g, rbox(it.w, baseH, it.d, 0.04), up, 0, legH, 0, baseH);                                        // ülőtest
    add(g, rbox(arm, 0.55 - legH, it.d, 0.05), up, -(it.w - arm) / 2, legH, 0, 0.55 - legH);                // karfák
    add(g, rbox(arm, 0.55 - legH, it.d, 0.05), up, (it.w - arm) / 2, legH, 0, 0.55 - legH);
    add(g, rbox(it.w - 2 * arm, it.h - legH - baseH, backD, 0.06), up, 0, legH + baseH, -(it.d - backD) / 2, it.h - legH - baseH); // háttámla
    const seatW = (it.w - 2 * arm) / 2;
    for (const sx of [-0.5, 0.5]) add(g, rbox(seatW - 0.02, 0.12, it.d - backD - 0.04, 0.05), up, sx * seatW, legH + baseH, backD / 2, 0.12); // ülőpárnák
    return g;
  },
  armchair: (it, m) => {
    const g = new THREE.Group(), up = m[it.materials?.upholstery ?? "boucle"] ?? m.boucle, wood = m.light_oak_matte;
    const legH = 0.16;
    legs(g, wood, it.w, it.d, legH, 0.06, 0.02);
    add(g, rbox(it.w, 0.06, it.d, 0.02), wood, 0, legH, 0, 0.06);                                          // tölgy keret
    add(g, rbox(it.w - 0.08, 0.16, it.d - 0.08, 0.06), up, 0, legH + 0.06, 0.02, 0.16);                    // ülés
    add(g, rbox(it.w - 0.08, it.h - legH - 0.06, 0.16, 0.07), up, 0, legH + 0.06, -(it.d - 0.16) / 2, it.h - legH - 0.06); // háttámla
    return g;
  },
  coffee_table: (it, m) => {
    const g = new THREE.Group(), wood = m.light_oak_matte, top = 0.05;
    add(g, rbox(it.w, top, it.d, 0.02), wood, 0, it.h - top, 0, top);
    legs(g, wood, it.w, it.d, it.h - top, 0.08, 0.03);
    return g;
  },
  side_table: (it, m) => {
    const g = new THREE.Group(), wood = m.light_oak_matte;
    add(g, new THREE.CylinderGeometry(it.w / 2, it.w / 2, 0.04, 32), wood, 0, it.h - 0.04, 0, 0.04);
    add(g, new THREE.CylinderGeometry(0.035, 0.05, it.h - 0.04, 16), wood, 0, 0, 0, it.h - 0.04);
    add(g, new THREE.CylinderGeometry(it.w / 3, it.w / 3, 0.03, 32), wood, 0, 0, 0, 0.03);
    return g;
  },
  shelf: (it, m) => {
    const g = new THREE.Group(), wood = m.light_oak_matte, t = 0.03, levels = 4;
    for (const sx of [-1, 1]) add(g, rbox(t, it.h, it.d, 0.008), wood, sx * (it.w - t) / 2, 0, 0, it.h);
    for (let i = 0; i < levels; i++) {
      const y = 0.06 + (i * (it.h - 0.1)) / (levels - 1);
      add(g, rbox(it.w - 2 * t, t, it.d, 0.008), wood, 0, y, 0, t);
      // kevés tárgy: polconként egy-két kerámia vagy könyvköteg, a felület legfeljebb harmada (stíluslap: shelf_fill_max 0,33)
      if (i < levels - 1) {
        const sx = (i % 2 ? 0.28 : -0.28) * it.w;
        add(g, new THREE.CylinderGeometry(0.06, 0.05, 0.16 + 0.04 * (i % 2), 20), i % 2 ? m.ceramic : m.ceramic_light, sx, y + t, 0, 0.16 + 0.04 * (i % 2));
        if (i === 1) add(g, rbox(0.22, 0.06, 0.16, 0.005), m.ceramic_light, -sx, y + t, 0, 0.06);
      }
    }
    return g;
  },
  sideboard: (it, m) => {
    const g = new THREE.Group(), wood = m.light_oak_matte, legH = 0.12;
    legs(g, wood, it.w, it.d, legH, 0.06, 0.02);
    add(g, rbox(it.w, it.h - legH, it.d, 0.02), wood, 0, legH, 0, it.h - legH);
    // fogantyú nélküli frontok: vékony árnyékfugák
    for (let i = 1; i < 3; i++) add(g, new THREE.BoxGeometry(0.006, it.h - legH - 0.06, 0.004), m.ceramic, -it.w / 2 + (i * it.w) / 3, legH + 0.03, it.d / 2 + 0.001, it.h - legH - 0.06);
    return g;
  },
  rug: (it, m) => {
    const g = new THREE.Group();
    add(g, rbox(it.w, it.h, it.d, 0.005), m[it.materials?.upholstery ?? "wool_rug"] ?? m.wool_rug, 0, 0.001, 0, it.h);
    return g;
  },
  pendant_lamp: (it, m, ceiling) => {
    const g = new THREE.Group(), drop = 0.75;
    const shade = new THREE.SphereGeometry(it.w / 2, 32, 20);
    shade.scale(1, it.h / it.w, 1);
    add(g, shade, m.rice_paper, 0, ceiling - drop - it.h, 0, it.h).castShadow = false;
    add(g, new THREE.CylinderGeometry(0.004, 0.004, drop, 6), m.black_metal, 0, ceiling - drop, 0, drop);
    return g;
  },
  floor_lamp: (it, m) => {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.14, 0.14, 0.02, 24), m.black_metal, 0, 0, 0, 0.02);
    add(g, new THREE.CylinderGeometry(0.012, 0.012, it.h - 0.3, 8), m.black_metal, 0, 0.02, 0, it.h - 0.3);
    add(g, new THREE.CylinderGeometry(it.w / 2 - 0.04, it.w / 2, 0.3, 28, 1, true), m.linen, 0, it.h - 0.3, 0, 0.3);
    return g;
  },
  plant: (it, m) => {
    // egyszerű, kódos növény (a CC0-modellig): matt kerámia kaspó + felfelé ívelő levelek
    const g = new THREE.Group(), potH = 0.38, potR = it.w * 0.32;
    add(g, new THREE.CylinderGeometry(potR, potR * 0.82, potH, 28), m.ceramic_light, 0, 0, 0, potH);
    add(g, new THREE.CylinderGeometry(potR * 0.92, potR * 0.92, 0.02, 24), m.soil, 0, potH - 0.03, 0, 0.02);
    const leaves = 14;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2 + (i % 3) * 0.4, len = (it.h - potH) * (0.55 + 0.45 * ((i * 7) % 5) / 4);
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len, 1, 4), m.leaf);
      const pos = leaf.geometry.getAttribute("position");
      for (let v = 0; v < pos.count; v++) { // ívelt, keskenyedő levél
        const y = pos.getY(v) / len + 0.5;
        pos.setX(v, pos.getX(v) * Math.sin(Math.PI * Math.min(1, y * 1.05)));
        pos.setZ(v, 0.25 * y * y * len);
      }
      leaf.geometry.computeVertexNormals();
      leaf.position.set(0, potH + len / 2 - 0.02, 0);
      leaf.rotation.set(-0.35 - 0.25 * ((i * 3) % 4) / 3, a, 0);
      leaf.castShadow = true;
      g.add(leaf);
    }
    return g;
  },
};

/** A berendezés felépítése: minden bútor a helyére (alaprajz (x, y) → three (x, z), elforgatás: rotation.y = −rot). */
export function buildFurniture(items: FurnitureItem[], mats: Mats, ceilingHeight: number): THREE.Group {
  const root = new THREE.Group();
  root.userData.kind = "furniture";
  for (const it of items) {
    const g = builders[it.type]?.(it, mats, ceilingHeight);
    if (!g) continue;
    g.position.set(it.x, 0, it.y);
    g.rotation.y = (-it.rot * Math.PI) / 180;
    g.userData = { kind: "furniture-item", itemId: it.id, type: it.type };
    root.add(g);
  }
  // a textúrás (fa, textil) felületek világ-méteres UV-t kapnak, hogy minden bútoron egyforma léptékű legyen az erezet
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).map && mesh.geometry.getAttribute("normal")) worldUV(mesh);
  });
  return root;
}
