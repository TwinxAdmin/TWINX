// twinx.hu/aszf — Általános Szerződési Feltételek (nyilvános oldal).
// Az üzemeltető adatai, a változat és a hatálybalépés a src/lib/legal.ts-ből jönnek (egy helyen módosítható).
// Induló szakasz: Kovács Márk egyéni vállalkozó üzemeltet és számláz. A szöveg ügyvédi átnézése javasolt;
// módosításkor a TERMS_VERSION-t növelni kell.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { HOSTING_PROVIDER, LEGAL_OPERATOR, TERMS_EFFECTIVE, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Általános Szerződési Feltételek — TWINX",
  description: "A TWINX szolgáltatás általános szerződési feltételei.",
};

const op = LEGAL_OPERATOR;

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section id={`p${n}`} className="scroll-mt-6 space-y-3">
      <h2 className="font-display text-xl font-semibold">{n}. {title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed" style={{ color: "var(--twx-ink)" }}>{children}</div>
    </section>
  );
}

function Ul({ items }: { items: ReactNode[] }) {
  return <ul className="list-disc space-y-1.5 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

export default function TermsPage() {
  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide"><Wordmark /></Link>

        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Általános Szerződési Feltételek</h1>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Változat: {TERMS_VERSION} · Hatálybalépés: {TERMS_EFFECTIVE}
          </p>
        </header>

        <Section n={1} title="A szolgáltató adatai">
          <div className="twx-card space-y-1 p-5 text-sm">
            <p><b>Szolgáltató:</b> {op.name}</p>
            <p><b>Székhely:</b> {op.address}</p>
            <p><b>Adószám:</b> {op.taxNumber}</p>
            {op.registrationNumber && <p><b>Nyilvántartási szám:</b> {op.registrationNumber}</p>}
            <p><b>E-mail:</b> <a className="underline" href={`mailto:${op.email}`}>{op.email}</a></p>
            <p><b>Weboldal:</b> <a className="underline" href={op.website}>twinx.hu</a></p>
            <p><b>Tárhelyszolgáltató:</b> {HOSTING_PROVIDER.name}, {HOSTING_PROVIDER.address} ({HOSTING_PROVIDER.web})</p>
          </div>
          <p>
            A szerződés nyelve magyar. A szerződés elektronikus úton jön létre, nem minősül írásba foglalt szerződésnek, a Szolgáltató
            külön nem iktatja; a mindenkor hatályos ÁSZF ezen az oldalon érhető el.
          </p>
        </Section>

        <Section n={2} title="Fogalmak">
          <Ul items={[
            <><b>TWINX / Szolgáltatás:</b> a twinx.hu címen elérhető online platform, amely mesterséges intelligenciára épülő eszközöket (modulokat) nyújt — elsősorban ingatlanközvetítőknek (pl. értékbecslés, hirdetéskép, képjavító, videó, látványterv, hirdetésszövegek).</>,
            <><b>Partner:</b> aki a TWINX-re regisztrál és a Szolgáltatást igénybe veszi.</>,
            <><b>Fogyasztó:</b> az a Partner, aki önálló foglalkozásán és gazdasági tevékenységén kívül eső célból jár el.</>,
            <><b>Kredit:</b> a modulok használatához szükséges, előre megvásárolt elszámolási egység.</>,
            <><b>Modul:</b> a TWINX egy-egy funkciója (eszköze).</>,
            <><b>Irodai fiók / közös munkatér:</b> több Partner közös használatára szolgáló fiókforma (lásd 9. pont).</>,
          ]} />
        </Section>

        <Section n={3} title="A szerződés létrejötte, regisztráció">
          <Ul items={[
            "A szerződés a regisztrációval jön létre, amikor a Partner elfogadja a jelen ÁSZF-et. A regisztráció e-mail-címmel és jelszóval vagy Google-fiókkal történhet.",
            "A Partner köteles valós adatokat megadni, a belépési adatait titokban tartani, és a fiókjával történt tevékenységért felel. Ha illetéktelen hozzáférést észlel, haladéktalanul jelezze az office@twinx.hu címen.",
            "A regisztráció ingyenes. A Szolgáltató a regisztrációkor induló kreditet adhat (jelenleg 3 kreditet; a twinx.hu/ingatlan oldalról regisztrálóknak — a meghirdetett keret erejéig — 10 kreditet). Az induló kredit pénzre nem váltható.",
          ]} />
        </Section>

        <Section n={4} title="A kreditrendszer">
          <Ul items={[
            "A modulok használata kreditbe kerül. Hogy egy futtatás hány kredit, azt a modul a futtatás előtt jelzi.",
            <>A megvásárolt kreditek <b>nem járnak le</b>, bármelyik modulban felhasználhatók.</>,
            "Ha egy futtatás a Szolgáltató oldalán felmerülő hiba miatt nem készül el, a levont kredit automatikusan visszajár.",
            "A kredit nem ruházható át, és pénzre nem váltható — kivéve a közös munkatérben a társak közötti kredit-átadást (9. pont) és a fogyasztói elállást (6. pont).",
          ]} />
        </Section>

        <Section n={5} title="Kreditvásárlás, árak, fizetés">
          <Ul items={[
            "Kreditet a TWINX felületén lehet igényelni a kívánt csomag és a számlázási adatok megadásával. A mindenkori csomagokat és árakat a felület tartalmazza; a megrendelés az igényléskor feltüntetett áron jön létre.",
            <>A Szolgáltató az igénylés alapján számlát állít ki, és a krediteket <b>a díj beérkezése után</b> írja jóvá. A fizetés banki átutalással történik (bankkártyás fizetés a jövőben bevezethető; erről a felület tájékoztat).</>,
            "A feltüntetett árak a fizetendő végösszegek. A Szolgáltató a számlán az adózására vonatkozó szabályok szerint jár el.",
            "Hibás vagy hiányos számlázási adatból eredő többletköltség a Partnert terheli.",
          ]} />
        </Section>

        <Section n={6} title="Elállási jog (fogyasztóknak)">
          <Ul items={[
            "A fogyasztónak minősülő Partner a kreditvásárlástól a jóváírástól számított 14 napon belül indokolás nélkül elállhat, a fel nem használt kreditek arányában.",
            <>A Partner tudomásul veszi, hogy a kreditek felhasználásával a digitális szolgáltatás teljesítése megkezdődik; a <b>már felhasznált kreditek</b> tekintetében — a fogyasztó kifejezett beleegyezésével megkezdett teljesítésre tekintettel — elállásnak nincs helye.</>,
            "Az elállási szándékot az office@twinx.hu címre küldött egyértelmű nyilatkozattal lehet jelezni. A Szolgáltató a visszajáró összeget 14 napon belül, a fizetéssel azonos módon (átutalással) téríti vissza.",
            "Az induló (ajándék) kreditekre elállás nem vonatkozik.",
          ]} />
        </Section>

        <Section n={7} title="A Partner kötelezettségei, feltöltött tartalmak">
          <Ul items={[
            "A Partner csak olyan tartalmat (fotót, logót, szöveget, adatot) tölthet fel, amelynek felhasználására jogosult, és amely nem sérti harmadik személyek jogait (különösen szerzői jog, személyiségi jog, képmáshoz való jog, személyes adatok).",
            "Ha a feltöltött anyag harmadik személy személyes adatát tartalmazza (pl. ügyfél, ingatlantulajdonos), annak jogszerű kezeléséért a Partner felel.",
            "Tilos a Szolgáltatást jogellenes, megtévesztő vagy mások jogait sértő célra használni, a rendszert túlterhelni, automatizáltan lekérdezni vagy a működését megkerülni.",
          ]} />
        </Section>

        <Section n={8} title="A mesterséges intelligencia által készített eredmények">
          <Ul items={[
            <>A modulok eredményei mesterséges intelligenciával készülnek, ezért <b>tájékoztató jellegűek</b>, és tévedést tartalmazhatnak. Felhasználásuk előtt a Partner köteles ellenőrizni őket.</>,
            <>Az <b>értékbecslés</b> piaci adatokon alapuló becslés; nem minősül hivatalos ingatlanértékelésnek, igazságügyi vagy banki szakértői véleménynek.</>,
            <>A <b>látványterv</b> és a feljavított képek illusztrációk. Hirdetésben való felhasználásuknál a Partner felel azért, hogy a hirdetés ne legyen megtévesztő (pl. jelölje, ha a kép virtuálisan berendezett).</>,
            "A létrehozott eredményeket a Partner saját üzleti céljára szabadon felhasználhatja.",
          ]} />
        </Section>

        <Section n={9} title="Irodai fiók és közös munkatér">
          <Ul items={[
            "Irodai fiókban a létrehozó (vezető) tölti fel az irodai egyenleget, és kreditkeretet oszt ki a tagoknak. A vezető látja a kredithasználatot (ki, melyik modulban, mennyit), a munkák tartalmát csak akkor, ha azokat közös mappába teszik.",
            "Közös munkatérben a társak egyenrangúak, mindenki a saját kreditjéből dolgozik. A társnak átadott kredit nem vonható vissza.",
            "A közös mappákba tett munkákat a mappához hozzáféréssel rendelkező tagok megtekinthetik. Kilépéskor a kilépő közös mappába tett munkái 30 napig még olvashatók a többiek számára; a kilépő ezt megelőzően átadhatja munkáit a társainak.",
          ]} />
        </Section>

        <Section n={10} title="Szellemi tulajdon">
          <p>
            A TWINX platform, annak szoftvere, megjelenése és tartalma a Szolgáltató (illetve jogosultjai) szellemi tulajdona.
            A Partner által feltöltött tartalmak a Partneréi; a Partner a Szolgáltatás nyújtásához szükséges mértékben felhasználási
            engedélyt ad a Szolgáltatónak (pl. tárolás, feldolgozás, az eredmény elkészítése).
          </p>
        </Section>

        <Section n={11} title="A szolgáltatás elérhetősége, felelősség">
          <Ul items={[
            "A Szolgáltató a TWINX folyamatos működésére törekszik, de nem garantálja a megszakítás nélküli, hibamentes elérhetőséget (pl. karbantartás, külső szolgáltatók kiesése).",
            "A Szolgáltató jogosult a modulokat fejleszteni, módosítani, illetve megszüntetni; a már megvásárolt kreditek ilyenkor is felhasználhatók a többi modulban.",
            "Vállalkozásnak minősülő Partnerrel szemben a Szolgáltató felelőssége — szándékos vagy súlyosan gondatlan károkozás kivételével — a Partner által a kárt megelőző 12 hónapban megfizetett díj összegére korlátozódik. Fogyasztóval szemben a felelősség a jogszabályok szerint alakul.",
            "A Szolgáltató nem felel a Partner által feltöltött tartalomért, illetve az eredmények ellenőrzés nélküli felhasználásából eredő kárért.",
          ]} />
        </Section>

        <Section n={12} title="A fiók megszüntetése">
          <Ul items={[
            "A Partner a fiókja megszüntetését bármikor kérheti az office@twinx.hu címen.",
            "A fel nem használt kreditek ellenértéke — a fogyasztói elállás (6. pont) és a jogszabályban előírt esetek kivételével — nem jár vissza.",
            "A Szolgáltató a fiókot felfüggesztheti vagy megszüntetheti, ha a Partner az ÁSZF-et súlyosan megsérti (pl. jogellenes tartalom, visszaélés).",
          ]} />
        </Section>

        <Section n={13} title="Adatkezelés">
          <p>
            A személyes adatok kezelésének részleteit az Adatkezelési tájékoztató tartalmazza. Kérdés esetén:{" "}
            <a className="underline" href={`mailto:${op.email}`}>{op.email}</a>.
          </p>
        </Section>

        <Section n={14} title="Panaszkezelés, jogviták">
          <Ul items={[
            <>Panaszt az <a className="underline" href={`mailto:${op.email}`}>{op.email}</a> címen lehet tenni; a Szolgáltató 30 napon belül érdemben válaszol.</>,
            "Fogyasztó a lakóhelye szerint illetékes békéltető testülethez fordulhat; a Szolgáltató székhelye szerint illetékes a Fejér Vármegyei Békéltető Testület.",
            "Fogyasztói jogsértés esetén a fogyasztóvédelmi hatósághoz (a lakóhely szerinti vármegyei kormányhivatalhoz) is lehet fordulni.",
            "A szerződésre a magyar jog az irányadó.",
          ]} />
        </Section>

        <Section n={15} title="Az ÁSZF módosítása">
          <p>
            A Szolgáltató az ÁSZF-et módosíthatja. A módosításról a hatálybalépés előtt legalább 15 nappal a felületen vagy e-mailben
            értesíti a Partnereket; a módosított feltételeket a Partner a következő belépéskor fogadja el. Ha nem fogadja el, a fiókja
            megszüntetését kérheti.
          </p>
        </Section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm" style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
          <span>{op.name} · {op.email}</span>
          <span className="flex gap-4"><Link href="/" className="hover:underline">Főoldal</Link><CookieSettingsLink className="hover:underline" /></span>
        </footer>
      </div>
    </main>
  );
}
