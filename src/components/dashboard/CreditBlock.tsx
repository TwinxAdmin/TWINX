// Kreditblokk — a Portálközpont legfelső, egyszerű sávja (design/portal-vegleges.html, 1. blokk).
// Mindenkinek ugyanaz a felépítés: érme, felirat, szám, gombok — csak a tartalom igazodik a szerepkörhöz:
//   user  → egyenleg + „Ajándékkód beváltása" (amíg nem váltott be kódot) + „Egyenleg feltöltése"
//   sales → az admin által adott keret + „Keret igénylése"
//   admin → prezentációs mód, heti / havi folyamat-számláló (nincs kreditlevonás)
//   office → irodai módban dolgozó tag: az irodai kerete (mint a lenti kredit-sávon) + „Kredit kérése"
// 0 kreditnél a szám piros, és a felirat a feltöltésre hív. Asztali nézetben fix magasság (nem ugrál).
import Link from "next/link";
import PricingTrigger from "@/components/PricingTrigger";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import InviteRedeem from "@/components/dashboard/InviteRedeem";

type Props =
  | { mode: "admin"; weekCount: number; monthCount: number }
  | { mode: "sales"; balance: number }
  | { mode: "user"; balance: number; canRedeem: boolean }
  | { mode: "office"; allowance: number | null }; // null = korlátlan keret

const PRIMARY: React.CSSProperties = { background: "#c4553a", color: "#fff" };
const SECONDARY: React.CSSProperties = { background: "#fff", color: "var(--twx-ink)", boxShadow: "inset 0 0 0 1px #d9cfc4" };
const BTN = "inline-flex h-[42px] items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-90";

/** A bal oldali érme (admin: sötét, arany csillag; 0 kredit: tompított). */
function Coin({ variant }: { variant: "normal" | "zero" | "admin" }) {
  const bg =
    variant === "admin"
      ? "radial-gradient(circle at 35% 30%, #3a2e25, #1a1512)"
      : variant === "zero"
        ? "radial-gradient(circle at 35% 30%, #f4d2ca, #c9826f 60%, #a0503b)"
        : "radial-gradient(circle at 35% 30%, #ffd9c9, #ef7a5a 60%, #c4553a)";
  return (
    <span aria-hidden
      className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-display text-lg font-bold sm:h-[52px] sm:w-[52px] sm:text-xl"
      style={{
        background: bg,
        color: variant === "admin" ? "#e9c77f" : "#fff",
        boxShadow: variant === "admin" ? "inset 0 -3px 0 rgba(0,0,0,.25)" : "inset 0 -3px 0 rgba(0,0,0,.12), 0 6px 14px rgba(196,85,58,.28)",
      }}>
      {variant === "admin" ? "✦" : "K"}
    </span>
  );
}

const LABEL = "text-[11px] font-bold uppercase tracking-[0.2em]";

export default function CreditBlock(props: Props) {
  // 0 kredit: piros szám, a felirat a feltöltésre hív (korlátlan irodai keretnél soha)
  const amount = props.mode === "admin" ? null : props.mode === "office" ? props.allowance : props.balance;
  const zero = amount !== null && amount <= 0;

  return (
    <section
      aria-label={props.mode === "admin" ? "Prezentációs mód" : props.mode === "sales" ? "Kereted" : props.mode === "office" ? "Irodai kereted" : "Egyenleged"}
      className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[20px] bg-white p-4 sm:h-[100px] sm:flex-nowrap sm:px-6 sm:py-0"
      style={{ boxShadow: "0 0 0 1px var(--twx-line), 0 8px 22px rgba(28,24,21,.05)" }}
    >
      <Coin variant={props.mode === "admin" ? "admin" : zero ? "zero" : "normal"} />

      {props.mode === "admin" ? (
        <div className="min-w-0 flex-1">
          <p className={LABEL} style={{ color: "var(--twx-ink-muted)" }}>
            Prezentációs mód
            <span className="ml-2 rounded-full px-2 py-0.5 align-middle text-[11px] tracking-normal" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Admin</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-x-7 gap-y-1">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold leading-none sm:text-[34px]">{props.weekCount}</span>
              <span className="text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>folyamat a héten</span>
            </p>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold leading-none sm:text-[34px]">{props.monthCount}</span>
              <span className="text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>folyamat a hónapban</span>
            </p>
          </div>
          <p className="mt-0.5 hidden text-xs lg:block" style={{ color: "var(--twx-ink-muted)" }}>
            A modulok kreditlevonás nélkül futnak (csak API-költség).
          </p>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={LABEL} style={{ color: "var(--twx-ink-muted)" }}>
              {props.mode === "sales" ? "Kereted" : props.mode === "office" ? "Irodai kereted" : "Egyenleged"}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
              <span className="font-display text-[34px] font-bold leading-none sm:text-[38px]" style={zero ? { color: "#b03a24" } : undefined}>
                {amount === null ? "Korlátlan" : <AnimatedNumber value={amount} animateOnMount />}
              </span>
              {amount !== null && (
                <span className="text-sm font-semibold" style={{ color: "var(--twx-ink-muted)" }}>
                  {props.mode === "sales" ? "folyamat" : "kredit"}
                </span>
              )}
              <span className="text-[13px]" style={{ color: "var(--twx-ink-muted)" }}>
                ·{" "}
                {props.mode === "sales"
                  ? "az admin által biztosított, bármelyik modulban"
                  : props.mode === "office"
                    ? zero ? "kérj keretet az iroda vezetőjétől" : "az iroda fizeti, bármelyik modulban"
                    : zero
                    ? "tölts fel a folytatáshoz"
                    : "bármelyik modulban felhasználható"}
              </span>
            </p>
          </div>

          <div className="flex w-full flex-none flex-wrap items-center gap-2.5 sm:w-auto">
            {/* Ajándékkód — csak amíg a fiók nem váltott be kódot (beváltás után eltűnik). */}
            {props.mode === "user" && props.canRedeem && (
              <div className="flex-1 sm:flex-none [&>button]:w-full">
                <InviteRedeem />
              </div>
            )}
            {props.mode === "office" ? (
              // Irodai módban a keretet az iroda adja → az Irodai fiók oldalra visz (ugyanígy a lenti sáv is);
              // korlátlan keretnél nincs mit kérni, ott csak „Irodai fiók".
              <Link href="/dashboard/iroda" className={`${BTN} flex-1 sm:flex-none`} style={zero ? PRIMARY : SECONDARY}>
                {amount === null ? "Irodai fiók" : "Kredit kérése"}
              </Link>
            ) : (
              <PricingTrigger className={`${BTN} flex-1 sm:flex-none`} style={PRIMARY}>
                {props.mode === "sales" ? "Keret igénylése" : "Egyenleg feltöltése"}
              </PricingTrigger>
            )}
          </div>
        </>
      )}
    </section>
  );
}
