// „Chat megnyitása" — a Smartsupp élő chat ablakát nyitja meg (ha még töltődik, a hívás sorba áll).
"use client";

export default function OpenChatButton({ className, style, children = "Chat megnyitása" }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} style={style}
      onClick={() => (window as unknown as { smartsupp?: (...a: unknown[]) => void }).smartsupp?.("chat:open")}>
      {children}
    </button>
  );
}
