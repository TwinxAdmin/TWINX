// OfficeSpaceView — az irodai fiók az ÚJ, kredit nélküli felületen (3d-3; D35: az irodai fiók opcionális közös tér).
// Nincs közös kreditkeret, feltöltés, kiosztás, kredit-kérés és kredit-mozgás: csak a közös tér részei —
// üzenetek, Munkáim (megosztás közös mappába), közös mappák, feladatok, tagok, kedvenc modulok.
// A régi, kredites nézetek (OfficeManagerView / OfficeMemberView / OfficeTeamView) a régi felületen maradnak.
// Minden blokk fix magasságú, üresen is látszik.
"use client";

import { useEffect, useState } from "react";
import type { OverviewRange } from "@/lib/office-overview";
import { ROLE_TEXT } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import OfficeMessagesRow from "@/components/office/OfficeMessagesRow";
import OfficeMyWorks from "@/components/office/OfficeMyWorks";
import OfficeFolders from "@/components/office/OfficeFolders";
import OfficeTasksCard from "@/components/office/OfficeTasksCard";
import OfficeModuleShelf from "@/components/office/OfficeModuleShelf";
import { EmptyState, Icons, OfficeCard } from "@/components/office/OfficeUi";

type Office = { id: string; name: string; role: "owner" | "member"; canAllocate?: boolean; kind?: string; joinCode?: string | null };
type Member = { userId: string; name: string; email: string; role: string; canAllocate?: boolean };

const CARD_H = 340;

export default function OfficeSpaceView({ office }: { office: Office }) {
  const [range, setRange] = useState<OverviewRange>("30d");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [membersNote, setMembersNote] = useState<string | null>(null);
  const isManager = office.role === "owner" || !!office.canAllocate;
  const roleLabel = office.role === "owner" ? "owner" : office.canAllocate ? "manager" : "member";

  useEffect(() => {
    // A teljes taglistát a létrehozó és a vezető látja; a kolléga helyén rövid tájékoztató áll.
    if (!isManager) { setMembers([]); setMembersNote("A tagokat az irodai fiók létrehozója és vezetői kezelik."); return; }
    fetch("/api/office/members").then((r) => r.json()).then((d) => {
      if (d.error) { setMembers([]); setMembersNote(d.error); return; }
      setMembers((d.members ?? []) as Member[]);
    }).catch(() => { setMembers([]); setMembersNote("A taglistát most nem sikerült betölteni."); });
  }, [isManager]);

  async function copyCode() {
    if (!office.joinCode) return;
    try { await navigator.clipboard.writeText(office.joinCode); showToast("Csatlakozási kód kimásolva.", "success"); }
    catch { showToast("A vágólap nem elérhető — jelöld ki a kódot kézzel.", "error"); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fejléc-sáv: iroda neve, szerep, csatlakozási kód — kredit nélkül */}
      <section className="flex min-h-[150px] flex-wrap items-center justify-between gap-6 rounded-[20px] p-5 sm:p-7"
        style={{ background: "#121110", border: "1px solid #2A2420", color: "#F3EDE6",
          backgroundImage: "radial-gradient(ellipse 520px 300px at 88% 0%, rgba(238,123,91,0.22), transparent 70%)" }}>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.16em]" style={{ color: "#EE7B5B" }}>IRODAI FIÓK · KÖZÖS TÉR</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[34px]" style={{ color: "#F6F1EA" }}>{office.name}</h1>
            <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
              style={{ background: "rgba(238,123,91,0.16)", color: "#F4A48A", border: "1px solid rgba(238,123,91,0.4)" }}>
              {ROLE_TEXT[roleLabel as keyof typeof ROLE_TEXT] ?? "Tag"}
            </span>
          </div>
          <p className="text-sm" style={{ color: "#A89E94" }}>Közös tér a kollégáknak: üzenetek, közös mappák, megosztott munkák.</p>
        </div>
        {office.joinCode && (
          <div className="flex min-w-[240px] flex-col gap-2 rounded-[14px] px-3.5 py-3" style={{ background: "#1B1815", border: "1px solid rgba(238,123,91,0.5)" }}>
            <span className="text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#F4A48A" }}>CSATLAKOZÁSI KÓD</span>
            <div className="flex items-center justify-between gap-3">
              <span className="select-all font-mono text-lg font-bold tracking-[0.08em]" style={{ color: "#EE7B5B" }}>{office.joinCode}</span>
              <button type="button" onClick={copyCode} className="h-[26px] rounded-full px-2.5 text-[11px] font-semibold" style={{ border: "1px solid #3A322C", color: "#F3EDE6" }}>
                Másolás
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Üzenetek — kredit-kérés nélkül (team mód) */}
      <OfficeMessagesRow canDecide={false} team />

      <OfficeMyWorks range={range} onRange={setRange} />

      <div className="grid gap-4 md:grid-cols-3">
        <OfficeFolders height={CARD_H} />
        <OfficeTasksCard height={CARD_H} />
        <OfficeCard title="Tagok" height={CARD_H} badge={members && members.length > 0 ? <span className="text-xs" style={{ color: "#6B6258" }}>{members.length} fő</span> : undefined}>
          {members === null ? (
            <p className="text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>
          ) : members.length === 0 ? (
            <EmptyState icon={Icons.users} title="Tagok" text={membersNote ?? "Még nincs más tag. Add át a csatlakozási kódot a kollégáidnak."} />
          ) : (
            <ul>
              {members.map((m) => (
                <li key={m.userId} className="flex h-11 items-center justify-between gap-3 border-b last:border-b-0" style={{ borderColor: "#EFE7DD" }}>
                  <span className="min-w-0 truncate text-[13px]"><strong>{m.name || m.email}</strong>{m.name && <span className="ml-2 text-xs" style={{ color: "#6B6258" }}>{m.email}</span>}</span>
                  <span className="flex-none text-[11px]" style={{ color: "#6B6258" }}>{m.role === "owner" ? "Létrehozó" : m.canAllocate ? "Vezető" : "Tag"}</span>
                </li>
              ))}
            </ul>
          )}
        </OfficeCard>
      </div>

      <OfficeModuleShelf />
    </div>
  );
}
