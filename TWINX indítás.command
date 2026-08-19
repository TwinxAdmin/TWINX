#!/bin/bash
# TWINX indító — dupla kattintásra megnyitja a projektet VS Code-ban,
# és elindítja a fejlesztői szervert.
#
# Ha a Mac nem engedi elindítani ("azonosítatlan fejlesztő"), akkor:
# jobb klikk a fájlra → Megnyitás → Megnyitás.

cd "$(dirname "$0")" || exit 1

echo "TWINX — projekt megnyitása VS Code-ban…"
open -a "Visual Studio Code" . 2>/dev/null || echo "  (VS Code nem található az Alkalmazások között — nyisd meg kézzel.)"

echo
echo "TWINX — fejlesztői szerver indul…"
echo "  Böngészőben:  http://localhost:3000"
echo "  Leállítás:    Ctrl+C"
echo

npm run dev
