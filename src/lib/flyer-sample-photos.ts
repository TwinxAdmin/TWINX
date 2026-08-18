// Minta-fotók a sablonválasztó előnézetéhez.
//
// A partner MÉG NEM töltött fel képet, amikor sablont választ, ezért itt
// egyszerű, stilizált „belső tér" illusztrációkat mutatunk — így is azonnal
// érzékelhető, melyik elrendezés hova teszi a főképet és a kis képeket.
// Beágyazott SVG (data URI): nincs hálózati kérés, nincs extra fájl.

const svg = (body: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}</svg>`
  );

/** Nappali: nagy ablak, kanapé, dohányzóasztal. */
const LIVING = svg(
  `<rect width="400" height="300" fill="#ece4d8"/>
   <rect y="205" width="400" height="95" fill="#d8c8ae"/>
   <rect x="26" y="42" width="132" height="150" rx="4" fill="#bfd6d9"/>
   <path d="M92 42v150M26 117h132" stroke="#f4efe6" stroke-width="7"/>
   <rect x="26" y="42" width="132" height="150" rx="4" fill="none" stroke="#a08b6c" stroke-width="9"/>
   <rect x="196" y="150" width="178" height="66" rx="12" fill="#7d6d5b"/>
   <rect x="212" y="132" width="52" height="30" rx="7" fill="#c9b79c"/>
   <rect x="272" y="132" width="52" height="30" rx="7" fill="#b8a184"/>
   <rect x="188" y="228" width="120" height="14" rx="5" fill="#9b8a72"/>`
);

/** Konyha: pult, felső szekrények, függőlámpa. */
const KITCHEN = svg(
  `<rect width="400" height="300" fill="#efe6d6"/>
   <rect x="0" y="52" width="400" height="78" fill="#c9b291"/>
   <path d="M100 52v78M200 52v78M300 52v78" stroke="#efe6d6" stroke-width="6"/>
   <rect x="0" y="178" width="400" height="18" fill="#8f7a5f"/>
   <rect x="0" y="196" width="400" height="104" fill="#6f5c46"/>
   <path d="M110 196v104M240 196v104" stroke="#8f7a5f" stroke-width="6"/>
   <circle cx="200" cy="30" r="16" fill="#e8c98a"/>
   <path d="M200 0v14" stroke="#8f7a5f" stroke-width="5"/>
   <rect x="288" y="140" width="26" height="38" rx="6" fill="#5e7a5a"/>`
);

/** Hálószoba: ágy, párnák, éjjeliszekrény. */
const BEDROOM = svg(
  `<rect width="400" height="300" fill="#dfe6d8"/>
   <rect y="212" width="400" height="88" fill="#cdb99b"/>
   <rect x="92" y="96" width="216" height="34" rx="8" fill="#b9a98d"/>
   <rect x="82" y="130" width="236" height="88" rx="10" fill="#f2ece0"/>
   <rect x="82" y="176" width="236" height="42" rx="8" fill="#c3d0bd"/>
   <rect x="104" y="140" width="72" height="30" rx="8" fill="#ffffff"/>
   <rect x="224" y="140" width="72" height="30" rx="8" fill="#ffffff"/>
   <rect x="26" y="164" width="42" height="54" rx="5" fill="#a8926f"/>`
);

/** Étkező / erkély: asztal, székek, üvegajtó. */
const DINING = svg(
  `<rect width="400" height="300" fill="#e7e7e2"/>
   <rect x="248" y="26" width="128" height="196" rx="4" fill="#cfe0e2"/>
   <rect x="248" y="26" width="128" height="196" rx="4" fill="none" stroke="#9aa08f" stroke-width="9"/>
   <rect y="222" width="400" height="78" fill="#cdbfa6"/>
   <rect x="40" y="150" width="168" height="16" rx="6" fill="#6b5f4f"/>
   <path d="M56 166v56M192 166v56" stroke="#6b5f4f" stroke-width="10"/>
   <rect x="24" y="128" width="34" height="60" rx="7" fill="#8b8f7d"/>
   <rect x="190" y="128" width="34" height="60" rx="7" fill="#8b8f7d"/>`
);

/** Sorrend: főkép + három kis kép. */
export const FLYER_SAMPLE_PHOTOS = [LIVING, KITCHEN, BEDROOM, DINING];
