// Egyszerű CSV-készítés és letöltés a böngészőben — a magyar Excelhez igazítva:
// pontosvessző elválasztó, UTF-8 BOM (ékezetek), CRLF sorvég. Több táblázat egy fájlban: szakaszok üres sorral elválasztva.

export type CsvCell = string | number | null | undefined;
export type CsvSection = { title: string; header: string[]; rows: CsvCell[][] };

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (cells: CsvCell[]) => cells.map(cell).join(";");

/** Szakaszokból egy CSV-szöveg (a szakasz címe saját sorban, alatta fejléc + sorok). */
export function buildCsv(sections: CsvSection[]): string {
  return sections
    .map((s) => [line([s.title]), line(s.header), ...s.rows.map(line)].join("\r\n"))
    .join("\r\n\r\n");
}

/** Letöltés fájlként (BOM-mal, hogy az Excel az ékezeteket jól mutassa). */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
