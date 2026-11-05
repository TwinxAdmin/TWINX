// A köszönő és a leiratkozó oldal közös kerete: ugyanaz az arculat, mint a belépésnél, fix szélességgel és minimális magassággal.
import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function ActivationCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 font-sans" style={{ background: "var(--twx-dark)" }}>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center font-display text-3xl font-semibold tracking-wide" style={{ color: "var(--twx-on-dark)" }}>
          <Wordmark />
        </Link>
        <div className="twx-card flex min-h-[340px] flex-col justify-center p-7">{children}</div>
      </div>
    </main>
  );
}
