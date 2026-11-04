// A dokumentum nyelve az adott oldalon (a gyökér layout magyar; a böngésző fordítója és a felolvasók is ebből dolgoznak).
"use client";

import { useEffect } from "react";
import type { Lang } from "@/lib/lang";

export default function HtmlLang({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = "hu"; };
  }, [lang]);
  return null;
}
