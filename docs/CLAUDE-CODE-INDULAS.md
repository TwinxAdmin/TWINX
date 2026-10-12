# Átállás Claude Code-ra — rövid útmutató Márknak

## 1. Mi van már előkészítve a projektben
- **CLAUDE.md** — minden szabály, amit eddig megbeszéltünk (magyar nyelv, git csak kérésre, SQL bemásolva,
  UI-szabályok: fix méret, üres állapot, nincs ál-gomb, „⋯" menü, törlés = elrejtés). A Claude Code ezt
  **automatikusan beolvassa** minden indításkor.
- **TODO.md** — a végén az „▶ INNEN FOLYTATJUK — Claude Code" rész: mi készült el, és mi a következő lépés.
- **.claude/settings.json** — biztonsági beállítás: `git push`, `git commit`, `git reset`, ágváltás, merge
  és fájltörlés (`rm`) előtt a Claude Code **mindig rákérdez**; a `.env` fájlokat (titkos kulcsok) nem olvashatja.
- **design/portal-kozpont-latvanyterv.html** — a Portál Központ új nyitóoldalának látványterve.

## 2. Indítás
1. Nyisd meg a Claude Code-ot (az asztali alkalmazás „Code" részében, vagy terminálban a `claude` paranccsal —
   telepítés: https://docs.claude.com/en/docs/claude-code).
2. Válaszd ki / lépj be a projekt mappájába: `~/Claude/Projects/web_twinx`.
3. Első üzenetnek ezt érdemes írni:

   > Olvasd be a CLAUDE.md-t és a TODO.md végét („INNEN FOLYTATJUK"). Foglald össze 5 pontban, hol tartunk,
   > és javasolj tervet az 1. lépéshez (SQL-fájlok rendezése). Még ne módosíts semmit.

## 3. Javasolt munkamenet egy-egy fejlesztésnél
1. **Kérd a tervet** („Tervezd meg mikrolépésekre, még ne kódolj").
2. Ha jó, **„Mehet az 1. lépés"** — egyszerre egy lépés.
3. A lépés végén a Claude Code lefuttatja a típus- és lint-ellenőrzést (és ha lehet, a buildet), és megmutatja, mi változott.
4. Ha van SQL: bemásolja a válaszba — te futtatod a Supabase-ben, és visszaírod, hogy „lefutott".
5. Kipróbálod a gépeden (`npm run dev` → http://localhost:3000).
6. Ha minden rendben: „Kérek git parancsot" — vagy engedélyezed, hogy ő commitoljon / pusholjon (rákérdez).

## 4. Hasznos tudnivalók
- Ha valamit **mindig** így szeretnél, mondd: „ezt írd be a CLAUDE.md-be" — így a következő alkalommal is tudni fogja.
- Nagyobb ötletelés, marketinganyag, levélsorozat, látványterv: maradhat a Cowork-ban — a kód a Code-ban.
- Ha elakad vagy rossz irányba megy: „Állj meg, vond vissza az utolsó lépést" — a git miatt minden visszaállítható.
