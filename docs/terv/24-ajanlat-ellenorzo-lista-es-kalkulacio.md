# 24 – Belső ajánlat-ellenőrző lista és modul-kalkuláció sablon (D57 terv)

Állapot: **jóváhagyva** a döntések szerint, a két alapértelmezés is megerősítve (Kovács Márk, 2026-11-23); a sablon üres, **számot nem tartalmaz**. Belső dokumentum: az ügyfél nem látja, és nem kerül a weblapra.
Kapcsolódó: `19-dijak-es-fizetes-terv.md` (ajánlat, fizetési tételek), `20-plafon-es-hasznalat-terv.md` (plafon, pluszcsomag, kalkuláció szabálya), `21-lezaras-es-lemondas-terv.md` (tulajdon, `reuse`, `data_policy`), `23-atadas-jovahagyasa-terv.md` (átvétel), `01-alap-es-szabalyok.md` (D27, D39, D44, D53).

## 1. Döntések (Márk, 2026-11-23)

- **Dokumentum a projektben:** az ellenőrző lista és a kalkulációs sablon egy dokumentumban él (nem számolótábla, nem admin-funkció). Beépítés az adminba később, **Hamarosan**.
- **Minimum haszon-szabály a havi díjra:** a havi díj **legalább 2× a tipikus havi önköltség, és sosem kisebb a plafonnál.** Pontosítás ehhez (4.5): az egyéb havi költséget is számoljuk, és a „plafon" a `monthly_cap` (Ft, nettó önköltség, D53).
- **Fejlesztési díj:** a sablon mutat egy **önköltség-alapú alsó határt** (becsült munkaóra × belső óradíj + AI- és eszközköltség) és mellé az **érték-alapú árat, amelyet Márk határoz meg.**
- **Megerősítve (Márk):** a pluszcsomag ára legalább 2× az önköltsége; az ajánlat küldése előtt Márk és Tibor is jóváhagyja.
- **A kalkulációt (aktuális szolgáltatói árakkal, forrással) minden egyedi modulnál Claude készíti** a D53 szabálya szerint; az árat és a havi díjat Márk határozza meg.

## 2. Hogyan használjuk

1. A felmérés után (a modul irányának ismeretében) végigmegyünk a 3. szakasz listáján; a kalkulációt a 4. szakasz táblái szerint töltjük ki.
2. A szolgáltatói árakat **frissen, forrással** (link és dátum) gyűjtjük be; árat emlékezetből nem írunk be. Az árfolyam 380 Ft/USD (jelezve, ha el kell térni).
3. A kész lapot **Márk és Tibor** átnézi, és csak utána készül az ajánlat (`19`): a havi díj, a benne foglalt mennyiség és a pluszcsomag ára szerepel benne. (Márk megerősítette.)
4. A kitöltött lapot a modulhoz tartozó belső jegyzetként őrizzük (nem az Egyedi modulok lapon, mert az csak követési adatot tárol, D43). `[A tárolás helye eldöntendő.]`

## 3. Ellenőrző lista (minden ajánlat előtt)

**3.1 Felmérés**
- [ ] Mit gyorsít a modul, milyen konkrét folyamatot (nem sablonos oldal, D23)?
- [ ] Ki használja, hány kolléga, milyen gyakran?
- [ ] Hol fut (D27): a TWINX oldalán · saját app · beépítés a cég oldalába · meglévő csatornában. Az alternatíva más fejlesztési díjat és havi díjat jelent.
- [ ] Van-e a cégnek olyan adata, amelyet a modul feldolgoz (ügyféladat, személyes adat)? Ez a jogi résznél (3.7) számít.

**3.2 Költségtételek**
- [ ] API-hívások: kép, videó, szöveg, kutatás (melyik szolgáltató és modell).
- [ ] Tárhely, e-mail, külső szolgáltatás (ha van), egyéb havi költség.
- [ ] Egyszeri költség (pl. domain, licenc), ha a modul igényli.
- [ ] Saját fejlesztési munka: becsült óraszám (felmérés, fejlesztés, teszt, átadás).

**3.3 Havi önköltség három forgatókönyvben** (4.2–4.3)
- [ ] Alacsony, tipikus, magas havi használat; ráhagyás az újrapróbálásokra és a sikertelen hívásokra.
- [ ] Szolgáltatói árak forrással és dátummal; árfolyam rögzítve.

**3.4 Plafon és pluszcsomag** (`20`)
- [ ] A havi díjban foglalt mennyiség (X darab, az egység neve).
- [ ] A `monthly_cap` Ft-ban; javaslat: legalább a magas forgatókönyv API-költsége, hogy a rendes használat ne álljon le. `[Márk dönt.]`
- [ ] A pluszcsomag mérete, önköltsége és ára.
- [ ] API-költséges modulnál az Aktiváláshoz a plafon kötelező (D44).

**3.5 Díjak**
- [ ] Fejlesztési díj: önköltség-alapú alsó határ és érték-alapú ár (4.7).
- [ ] Havi díj és a minimum-szabály ellenőrzése (4.5).
- [ ] Részletfizetés és mérföldkövek (előleg, maradék, átadáskor; `19`).

**3.6 A haszon védelme**
- [ ] Havi díj ≥ max(2× tipikus havi önköltség; plafon + egyéb havi költség).
- [ ] Pluszcsomag ára ≥ 2× a pluszcsomag önköltsége (megerősítve).
- [ ] Ha bármelyik feltétel nem teljesül, az ajánlat nem megy ki indoklás és Márk–Tibor jóváhagyás nélkül.

**3.7 Jogi és adat**
- [ ] Szerződés: a modul tulajdona és újrahasznosíthatósága (`reuse`: újrahasznosítható / csak az ügyfélnek / az ügyfél engedélyével) és a kizárólagosság (`21`). `[JOGÁSZ: sablon]`
- [ ] NDA és adatfeldolgozói szerződés, ha a modul ügyféladatot kezel (`17`).
- [ ] `data_policy`: a modul törlési és exportálási leírása, vagy a „nem tárol ügyféladatot" kijelentés (`21`).
- [ ] Az átvétel feltételei: elfogadási kritériumok, hibajavítási időszak, hallgatólagos elfogadás (`23`). `[JOGÁSZ]`
- [ ] Lemondás: a kifizetett időszak végével lép hatályba; az ügyféladat törlése vagy visszaadása a szerződés szerinti határidőn belül (`21`).

**3.8 Kockázatok**
- [ ] Külső szolgáltató áremelése, kivezetése vagy kiesése: az ajánlat tartalmazzon ár-felülvizsgálati kikötést. `[JOGÁSZ]`
- [ ] A modul függ-e egyetlen szolgáltatótól? Van-e tartalék (vendor-függetlenség)?
- [ ] Az ügyfél által megadott adat és anyag külső bemenet (karantén, nem megbízható); a modul ne fusson le belőle semmi automatikusan.

**3.9 Az ajánlat tartalma és jóváhagyása**
- [ ] Nincs nyilvános ár; az ajánlat az ügyfélnek készül (`19`).
- [ ] Szerepel: a fejlesztési díj és mérföldkövei, a havi díj, a benne foglalt mennyiség (X darab), a pluszcsomag mérete és ára, az érvényesség, a lemondási szabály.
- [ ] Nem szerepel: belső önköltség, haszon, a plafon forintértéke.
- [ ] Márk és Tibor jóváhagyta (2. szakasz).

## 4. Kalkuláció sablon (a mezők üresek)

### 4.1 Alapadatok
| Mező | Érték |
|---|---|
| Cég | `[ ]` |
| Modul neve / regiszter-kulcs | `[ ]` |
| Hol fut (D27) | `[ ]` |
| Kollégák száma, hely-keret | `[ ]` |
| Árfolyam (Ft/USD) | 380 (D53; eltérés esetén indok) |
| A kalkuláció dátuma | `[ ]` |

### 4.2 Műveletek és API-költség (egy sor = egy költséges művelet)
| Művelet | Szolgáltató és modell | Egység | Hívás / művelet | Egységár (USD) | Forrás (link, dátum) | Költség / művelet (Ft) |
|---|---|---|---|---|---|---|
| `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

*Költség / művelet (Ft) = Σ (hívás × egységár) × árfolyam.* Az árakat mindig frissen, forrásból írjuk be.

### 4.3 Forgatókönyvek
| | Alacsony | Tipikus | Magas |
|---|---|---|---|
| Műveletek száma / hó | `[ ]` | `[ ]` | `[ ]` |
| Ráhagyás újrapróbálásra és hibára (%) | `[ ]` | `[ ]` | `[ ]` |
| **API-költség / hó (Ft)** = Σ (műveletek × költség / művelet) × (1 + ráhagyás) | `[ ]` | `[ ]` | `[ ]` |

### 4.4 Egyéb havi költség
| Tétel | Ft / hó | Megjegyzés |
|---|---|---|
| Tárhely, adatbázis | `[ ]` | |
| E-mail, értesítés | `[ ]` | |
| Külső szolgáltatás | `[ ]` | |
| **Egyéb havi költség összesen (E)** | `[ ]` | |

### 4.5 Havi díj minimuma (a D57 szabálya)
- **Tipikus havi önköltség (C_tip)** = API-költség (tipikus forgatókönyv) + E.
- **Plafon (P)** = a `monthly_cap` (Ft, nettó önköltség).
- **Havi díj minimuma (M)** = a nagyobbik a két érték közül: **2 × C_tip** és **P + E**.
- **Ellenőrzés:** a tervezett havi díj ≥ M. Teljes használatnál (a plafonig) sem lehet veszteséges, tipikus használatnál legalább 100% haszon.
- Az **áfát** nem számoljuk bele; a nettó díj az irányadó (`19`).

| | Ft / hó |
|---|---|
| C_tip | `[ ]` |
| P (plafon) | `[ ]` |
| E | `[ ]` |
| **M** | `[ ]` |
| **Tervezett havi díj (nettó)** | `[ ]` |
| Megfelel (igen/nem) | `[ ]` |

### 4.6 Foglalt mennyiség, plafon, pluszcsomag
| Mező | Érték |
|---|---|
| A havi díjban foglalt mennyiség (X) és az egység neve | `[ ]` |
| `monthly_cap` (Ft) | `[ ]` |
| Pluszcsomag mérete (egység) | `[ ]` |
| Pluszcsomag önköltsége, vagyis a keret-kiegészítés (Ft) | `[ ]` |
| Pluszcsomag ára (nettó) | `[ ]` |
| Ellenőrzés: a pluszcsomag ára ≥ 2 × önköltsége | `[ ]` |

### 4.7 Fejlesztési díj
**Önköltség-alapú alsó határ (F_min):**
| Tétel | Mennyiség | Egységár | Összeg (Ft) |
|---|---|---|---|
| Felmérés (óra) | `[ ]` | belső óradíj `[ ]` | `[ ]` |
| Fejlesztés (óra) | `[ ]` | belső óradíj `[ ]` | `[ ]` |
| Teszt és átadás (óra) | `[ ]` | belső óradíj `[ ]` | `[ ]` |
| AI- és eszközköltség a fejlesztés alatt (előfizetések, tesztelési API-hívások) | `[ ]` | | `[ ]` |
| Egyszeri költség (domain, licenc stb.) | `[ ]` | | `[ ]` |
| **F_min összesen** | | | `[ ]` |

- **A belső óradíjat és az óraszámokat Márk adja meg**; nem találunk ki értéket.
- **Érték-alapú ár (F):** Márk határozza meg. Segítő kérdések: mennyi időt és munkát vált ki a modul a cégnél; hány kollégát érint; mennyire egyedi és újrahasznosítható a megoldás; mi a megrendelő alternatívája; marad-e nálunk újrahasznosítható érték (`reuse`)?
- **Szabály:** F ≥ F_min. Ha F < F_min, az ajánlat csak kifejezett indoklással és Márk–Tibor jóváhagyással megy ki.

| | Ft (nettó) |
|---|---|
| F_min | `[ ]` |
| F (a Márk által meghatározott ár) | `[ ]` |
| Részletek (előleg / maradék / átadáskor) | `[ ]` |
| Megfelel (F ≥ F_min) | `[ ]` |

### 4.8 Összefoglaló az ajánlathoz
| Mező | Érték |
|---|---|
| Fejlesztési díj és mérföldkövei | `[ ]` |
| Havi díj (nettó), foglalt mennyiség | `[ ]` |
| Pluszcsomag (mennyiség, ár) | `[ ]` |
| Érvényesség | `[ ]` |
| Jóváhagyta: Márk · Tibor, dátum | `[ ]` |

## 5. Kapcsolat a többi tervvel

- A kalkuláció eredménye kerül az Aktiváláskor a `company_modules` mezőibe (`monthly_cap`, `usage_unit_label`, `included_units`, `extra_pack_*`; `14`, `20`) és az ajánlatba (`company_quotes`; `19`).
- A belső lapot **nem** tároljuk az adatbázisban az első fázisban; admin-funkcióvá válása Hamarosan.
- A későbbi ajánlat- és költségbecslő ügynök (D29, félretett szerep) ebből a listából és sablonból dolgozhat.

## 6. Nyitott pontok

- **A belső óradíj és az óraszám-becslés módja** `[KITÖLTENDŐ: Márk]`.
- **A kitöltött kalkuláció tárolásának helye** (projekt-dokumentum modulonként, vagy későbbi admin-funkció).
- **Ár-felülvizsgálati kikötés** a szerződés- és ajánlat-sablonban (szolgáltatói áremelés tovább háríthatósága). `[JOGÁSZ]`
- **Az első kitöltött minta:** az első valódi modulnál, friss szolgáltatói árakkal.
