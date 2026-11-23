// A meghívó-oldal szövegei (terv 22 / 4. B) — egy helyen. A hibás, lejárt, visszavont és elfogadott meghívó
// ugyanazt mondja (nem árul el semmit).
export const INVITE_TEXT = {
  invalid: "Ez a meghívó már nem érvényes. Kérd meg a cégvezetőt, hogy küldjön újat.",
  otherEmail: "Ezt a meghívót másik e-mail címre küldték. Lépj be azzal a címmel, amelyre érkezett.",
  unconfirmed: "Előbb erősítsd meg az e-mail címedet, utána elfogadhatod a meghívót.",
  notActive: "A meghívót elfogadtad, de a modul most nem aktív, ezért még nem használhatod. Szólj a cégvezetőnek.",
  done: (mod: string) => `Kész! A(z) ${mod} elérhető a Moduljaim menüben.`,
  intro: (mod: string, comp: string) => `Meghívást kaptál a(z) ${mod} használatára a(z) ${comp} nevében. Lépj be, vagy regisztrálj ugyanazzal az e-mail címmel, amelyre a meghívó érkezett.`,
};
