// Modul-ablak bemutató (B arculat, terv 29 / 4.3): finoman lebegő böngészőablak „példa-modulok" felirattal és három
// iparágfüggetlen PÉLDA-kártyával, egyszerű, rajzolt felületelemekkel. Nincs kitalált szám, nincs ügyfélnév.
// A kártyák fix magasságúak; csökkentett mozgásnál a lebegés és a pulzáló oszlop áll (globals.css).
export default function ModuleWindow() {
  const card = "h-[200px] rounded-2xl border border-b-line bg-b-card p-4";
  const sub = "text-xs text-b-ink-3";
  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-20 pt-5 sm:px-8" aria-label="Példa-modulok">
      <div className="b-float overflow-hidden rounded-3xl border border-b-line bg-b-card shadow-b-lg">
        <div className="flex h-[42px] items-center gap-[7px] bg-b-surface px-[18px]" aria-hidden>
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#d9c9b8]" />
          <span className="ml-4 text-xs text-b-ink-2">app.twinx.hu · példa-modulok</span>
        </div>
        <div className="grid grid-cols-1 gap-[18px] bg-b-surface-2 p-5 sm:p-7 md:grid-cols-3">
          {/* 1) Ajánlatkészítő */}
          <div className={card}>
            <p className="mb-1 font-semibold">Ajánlatkészítő</p>
            <p className={`${sub} mb-3.5`}>pl. építőipar, szolgáltatás</p>
            <div className="mb-2.5 h-[9px] rounded-[5px] bg-b-surface" />
            <div className="mb-2.5 h-[9px] w-4/5 rounded-[5px] bg-b-surface" />
            <div className="mb-[18px] h-[9px] w-[55%] rounded-[5px] bg-b-surface" />
            <span className="inline-block rounded-full bg-b-accent px-3.5 py-[7px] text-xs font-semibold text-white">PDF kész</span>
          </div>
          {/* 2) Ügyfélkérdés-válaszoló */}
          <div className={card}>
            <p className="mb-1 font-semibold">Ügyfélkérdés-válaszoló</p>
            <p className={`${sub} mb-3.5`}>pl. webshop, szépségipar</p>
            <div className="mb-2 w-[70%] rounded-[12px_12px_12px_3px] bg-b-surface px-2.5 py-2 text-xs">Mikor van szabad időpont?</div>
            <div className="ml-auto w-[70%] rounded-[12px_12px_3px_12px] bg-b-accent px-2.5 py-2 text-xs text-white">Csütörtök 10:00 jó?</div>
          </div>
          {/* 3) Készletfigyelő */}
          <div className={card}>
            <p className="mb-1 font-semibold">Készletfigyelő</p>
            <p className={`${sub} mb-1.5`}>pl. kereskedelem, vendéglátás</p>
            <div className="flex h-[110px] items-end gap-2.5" aria-hidden>
              <div className="h-[40%] flex-1 rounded-md bg-b-surface" />
              <div className="h-[65%] flex-1 rounded-md bg-b-surface" />
              <div className="b-bar h-full flex-1 rounded-md bg-b-accent" />
              <div className="h-[55%] flex-1 rounded-md bg-b-surface" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
