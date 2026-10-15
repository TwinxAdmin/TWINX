// 3D-modul prototípus: a kitalált tesztlakás digitális alaprajzát rajzolja meg a „valós méretek" JSON-ból.
// Futtatás: node scripts/floorplan3d-test-plan.mjs  (→ docs/floorplan3d-teszt/teszt-alaprajz-digitalis.png)
import fs from "fs";
import sharp from "sharp";
const T = JSON.parse(fs.readFileSync(process.argv[2] || "docs/floorplan3d-teszt/teszt-alaprajz.json"));
const S = 110, M = 90, OX = 0, OY = -1.5; // px/m, margó, a rajz bal-felső sarka méterben
const W = Math.round(7.9 * S + 2 * M), H = Math.round((9.9 - OY) * S + 2 * M);
const X = (x) => +(M + (x - OX) * S).toFixed(1), Y = (y) => +(M + (y - OY) * S).toFixed(1), L = (v) => (v * S).toFixed(1);
const f = (n) => n.toFixed(2).replace(".", ",");
let g = "";
// falak: teljes befoglaló fal-tömb, a helyiségek "kivájva"
g += `<rect x="${X(0)}" y="${Y(0)}" width="${L(7.9)}" height="${L(9.9)}" fill="#3d3d3d"/>`;
for (const r of T.helyisegek) {
  const [x1, x2] = r.x, [y1, y2] = r.y;
  g += `<rect x="${X(x1)}" y="${Y(y1)}" width="${L(x2 - x1)}" height="${L(y2 - y1)}" fill="${r.kulter ? "#f2f2ee" : "#ffffff"}" stroke="${r.kulter ? "#555" : "none"}" stroke-width="2"/>`;
}
// nappali–konyha nyitott határ: szaggatott vonal
g += `<line x1="${X(5.0)}" y1="${Y(0.3)}" x2="${X(5.0)}" y2="${Y(4.5)}" stroke="#777" stroke-width="2" stroke-dasharray="10 7"/>`;
// nyílászárók
for (const o of T.nyilaszarok) {
  const [cx, cy] = o.kozep, w = o.szel;
  const vertical = o.hol.includes("jobb külső");
  const th = vertical ? 0.3 : (Math.abs(cy - 0.15) < 0.01 || Math.abs(cy - 9.75) < 0.01 ? 0.3 : 0.1);
  if (vertical) {
    g += `<rect x="${X(cx - th / 2)}" y="${Y(cy - w / 2)}" width="${L(th)}" height="${L(w)}" fill="#fff"/>`;
    g += `<path d="M ${X(7.6)} ${Y(cy - w / 2)} A ${L(w)} ${L(w)} 0 0 0 ${X(7.6 - w)} ${Y(cy + w / 2)} L ${X(7.6)} ${Y(cy + w / 2)}" fill="none" stroke="#333" stroke-width="1.6"/>`;
    continue;
  }
  g += `<rect x="${X(cx - w / 2)}" y="${Y(cy - th / 2)}" width="${L(w)}" height="${L(th)}" fill="#fff"/>`;
  if (o.tipus === "ablak") {
    for (const d of [-0.05, 0.05]) g += `<line x1="${X(cx - w / 2)}" y1="${Y(cy + d)}" x2="${X(cx + w / 2)}" y2="${Y(cy + d)}" stroke="#333" stroke-width="1.6"/>`;
  } else {
    // ajtólap + nyílásív a nyitás felőli helyiségbe (lefelé, ha a fal felett van a közlekedő)
    const into = cy > 4.5 && cy < 4.6 ? -1 : cy > 6.0 && cy < 6.1 ? 1 : 1;
    const yWall = cy + into * th / 2;
    g += `<line x1="${X(cx - w / 2)}" y1="${Y(yWall)}" x2="${X(cx - w / 2)}" y2="${Y(yWall + into * w)}" stroke="#333" stroke-width="1.6"/>`;
    g += `<path d="M ${X(cx - w / 2)} ${Y(yWall + into * w)} A ${L(w)} ${L(w)} 0 0 ${into > 0 ? 0 : 1} ${X(cx + w / 2)} ${Y(yWall)}" fill="none" stroke="#333" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  }
}
// feliratok + belső méretek
for (const r of T.helyisegek) {
  const [x1, x2] = r.x, [y1, y2] = r.y, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  g += `<text x="${X(cx)}" y="${Y(cy) - 16}" font-size="21" font-weight="700" text-anchor="middle" font-family="Helvetica, Arial">${r.nev}</text>`;
  g += `<text x="${X(cx)}" y="${Y(cy) + 8}" font-size="15" text-anchor="middle" font-family="Helvetica, Arial">${r.kulter ? "fagyálló kerámia" : ["Fürdő", "Előszoba", "Konyha"].includes(r.nev) ? "kerámia" : "parketta"}</text>`;
  g += `<text x="${X(cx)}" y="${Y(cy) + 28}" font-size="15" text-anchor="middle" font-family="Helvetica, Arial">${f(r.m2)} m²</text>`;
  // szélesség: vízszintes méretvonal a helyiség alsó negyedében; mélység: függőleges a bal szélén
  const dy = y2 - (y2 - y1) * 0.2, dx = x1 + 0.35;
  g += `<line x1="${X(x1)}" y1="${Y(dy)}" x2="${X(x2)}" y2="${Y(dy)}" stroke="#888" stroke-width="1"/>`;
  g += `<text x="${X(cx)}" y="${Y(dy) - 5}" font-size="14" text-anchor="middle" font-family="Helvetica, Arial">${f(x2 - x1)}</text>`;
  if (y2 - y1 > 1.6) {
    g += `<line x1="${X(dx)}" y1="${Y(y1)}" x2="${X(dx)}" y2="${Y(y2)}" stroke="#888" stroke-width="1"/>`;
    g += `<text x="${X(dx) - 6}" y="${Y((y1 + y2) / 2)}" font-size="14" text-anchor="middle" font-family="Helvetica, Arial" transform="rotate(-90 ${X(dx) - 6} ${Y((y1 + y2) / 2)})">${f(y2 - y1)}</text>`;
  }
}
// külső összméretek
g += `<line x1="${X(0)}" y1="${Y(9.9) + 60}" x2="${X(7.9)}" y2="${Y(9.9) + 60}" stroke="#555" stroke-width="1.2"/><text x="${X(3.95)}" y="${Y(9.9) + 54}" font-size="15" text-anchor="middle" font-family="Helvetica, Arial">7,90</text>`;
g += `<text x="${M}" y="${H - 18}" font-size="14" font-family="Helvetica, Arial" fill="#555">TWINX tesztlakás · 2,5 szoba · belmagasság 2,70 m · M 1:100</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>${g}</svg>`;
sharp(Buffer.from(svg)).png().toFile(process.argv[3] || "docs/floorplan3d-teszt/teszt-alaprajz-digitalis.png").then(() => console.log("ok", W, H));
