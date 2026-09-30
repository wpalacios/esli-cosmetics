/**
 * ISO instant, label for PDF footers, and IANA time zone for the user's browser.
 * Use for report PDF exports so the API can format server-side timestamps in the
 * same zone (Node on the host often uses UTC).
 */
export function getReportExportMeta(date: Date = new Date()): {
  generatedAt: string;
  generatedAtFormatted: string;
  timeZone: string;
} {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const raw = date.toLocaleString("es-ES", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const generatedAtFormatted = raw
    .replace(/\s+a\.?\s*m\.?/gi, " a.m.")
    .replace(/\s+p\.?\s*m\.?/gi, " p.m.");
  return {
    generatedAt: date.toISOString(),
    generatedAtFormatted,
    timeZone,
  };
}

/**
 * Calendar date in the user's browser IANA zone (DD/MM/YYYY, es-ES).
 * Use on account statement and similar UIs so dates match PDF exports that send the same `timeZone`.
 */
export function formatShortDateInUserTimeZone(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return d.toLocaleDateString("es-ES", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d.toLocaleDateString("es-ES");
  }
}
