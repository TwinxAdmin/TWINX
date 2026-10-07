#!/bin/bash
# TWINX indító — dupla kattintásra megnyitja a projektet VS Code-ban,
# és elindítja a fejlesztői szervert (localhost:3000).
#
# Ha a Mac nem engedi elindítani ("azonosítatlan fejlesztő"), akkor:
# jobb klikk a fájlra → Megnyitás → Megnyitás.

cd "$(dirname "$0")" || exit 1

# Ha a szerver már fut (pl. egy korábbi ablakban), nem indítunk másodikat — csak megnyitjuk a böngészőt.
if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "TWINX — a fejlesztői szerver már fut, megnyitom a böngészőt…"
  open "http://localhost:3000/admin/video-lab"
  exit 0
fi

echo "TWINX — projekt megnyitása VS Code-ban…"
open -a "Visual Studio Code" . 2>/dev/null || echo "  (VS Code nem található az Alkalmazások között — nyisd meg kézzel.)"

# Ha a csomaglista változott (pl. új csomag került be), előbb telepítünk.
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo
  echo "TWINX — csomagok frissítése (npm install)…"
  npm install || { echo "Az npm install nem sikerült."; read -r -p "Enter a bezáráshoz…"; exit 1; }
fi

echo
echo "TWINX — fejlesztői szerver indul…"
echo "  Böngészőben:  http://localhost:3000"
echo "  Videólabor:   http://localhost:3000/admin/video-lab"
echo "  Leállítás:    Ctrl+C"
echo

# A böngésző pár másodperc múlva magától megnyílik.
( sleep 6 && open "http://localhost:3000/admin/video-lab" ) &

npm run dev
