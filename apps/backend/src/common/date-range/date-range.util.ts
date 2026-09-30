export type RawDate = string | Date | undefined;

/**
 * Business time zone used to interpret calendar-day filters (e.g. "orders on
 * June 26"). Esli operates in Nicaragua (no DST), but it stays configurable via
 * `APP_TIMEZONE` so the same logic works if the business expands.
 */
export const DEFAULT_BUSINESS_TIME_ZONE =
  process.env.APP_TIMEZONE?.trim() || "America/Managua";

/**
 * Offset in milliseconds between `timeZone`'s wall clock and UTC at `instant`.
 * Positive when the zone is behind UTC (e.g. America/Managua → +6h). Handles DST
 * because the offset is resolved at the given instant.
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find(part => part.type === type)?.value);
  // `hour` can come back as "24" at midnight in some engines; normalize to 0.
  const hour = get("hour") % 24;
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

/**
 * Convert calendar-day bounds (YYYY-MM-DD) expressed in `timeZone` into the
 * exact UTC instants for the start of `startDate` and the end of `endDate`.
 *
 * This is the correct way to filter UTC-stored `createdAt` by a local business
 * day: an order created at 23:00 in Nicaragua (stored as 05:00 UTC next day)
 * still belongs to that local day and is captured precisely — no over-capture
 * of neighbouring days. Returns undefined when neither bound is valid.
 */
export function zonedDayRangeToUtc(
  startDate?: string,
  endDate?: string,
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE
): { gte?: Date; lte?: Date } | undefined {
  const toInstant = (ymd: string, endOfDay: boolean): Date | undefined => {
    const parts = ymd.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined;
    const [year, month, day] = parts;
    const hour = endOfDay ? 23 : 0;
    const minute = endOfDay ? 59 : 0;
    const second = endOfDay ? 59 : 0;
    const ms = endOfDay ? 999 : 0;
    // Probe the zone offset on a second-aligned instant (Intl has no ms), then
    // apply it to the full wall-clock value so milliseconds stay exact.
    const probe = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    const offset = timeZoneOffsetMs(new Date(probe), timeZone);
    const wallClockAsUtc = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      ms
    );
    return new Date(wallClockAsUtc - offset);
  };

  const range: { gte?: Date; lte?: Date } = {};
  if (startDate) {
    const start = toInstant(startDate, false);
    if (start) range.gte = start;
  }
  if (endDate) {
    const end = toInstant(endDate, true);
    if (end) range.lte = end;
  }
  return range.gte || range.lte ? range : undefined;
}

export function normalizeDateRange(raw: { from?: RawDate; to?: RawDate }): {
  from?: Date;
  to?: Date;
} {
  // Parse YYYY-MM-DD string as UTC date
  // The frontend sends UTC dates that represent the start of the user's local day
  // We need to expand the range to cover the full local day, which may span 2 UTC days
  const parseUTCDateOnly = (v: string): Date | undefined => {
    const parts = v.split("-").map(Number);
    if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
      const [y, m, d] = parts;
      // Create UTC date - this ensures we're querying the correct UTC day
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
    return undefined;
  };

  const parse = (v?: RawDate): Date | undefined => {
    if (!v) return undefined;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    if (typeof v === "string") {
      if (v.includes("T") || v.includes("Z") || v.includes("+")) {
        // ISO format with timezone - parse as-is
        return new Date(v);
      }
      // YYYY-MM-DD format - parse as UTC date
      return parseUTCDateOnly(v) ?? new Date(v);
    }
    return undefined;
  };

  // For UTC dates, we need to set start/end of day in UTC
  const startOfDayUTC = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    return new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
  };

  const endOfDayUTC = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    return new Date(Date.UTC(y, m, day, 23, 59, 59, 999));
  };

  const fromRaw = parse(raw.from);
  const toRaw = parse(raw.to);

  // For "from" date: use start of that UTC day
  // For "to" date: expand to end of that UTC day, plus the next UTC day
  // This ensures we capture orders that fall in the latter part of the user's local day
  // Example: User selects Jan 29 in UTC-5, which spans Jan 29 05:00 UTC to Jan 30 04:59 UTC
  // We query from Jan 29 00:00 UTC to Jan 30 23:59 UTC to capture everything
  let from = fromRaw ? startOfDayUTC(fromRaw) : undefined;
  let to = toRaw
    ? (() => {
        const endOfDay = endOfDayUTC(toRaw);
        // Add one more day to ensure we capture the full local day
        const nextDay = new Date(endOfDay);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        return endOfDayUTC(nextDay);
      })()
    : undefined;

  if (from && to && from > to) {
    // swap defensivo
    [from, to] = [startOfDayUTC(toRaw!), endOfDayUTC(fromRaw!)];
  }
  return { from, to };
}

const LOCALE = "es-ES";

const spanish12hDateTimeOptions: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

/**
 * Formats an instant to 'DD/MM/YYYY, hh:mm:ss a.m./p.m.' in es-ES.
 * @param timeZone IANA time zone (e.g. America/Mexico_City) from the client; when
 *   omitted, uses the process default (often UTC on cloud servers — avoid for user-facing PDFs).
 */
export function formatDateLocal(d?: string | Date, timeZone?: string): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const formatWithOptions = (opts: Intl.DateTimeFormatOptions) => {
    const raw = dt.toLocaleString(LOCALE, opts);
    return raw
      .replace(/\s?a\.?\s?m\.?/i, " a.m.")
      .replace(/\s?p\.?\s?m\.?/i, " p.m.")
      .replace(/\s+/, " ")
      .trim();
  };
  const tz = timeZone?.trim();
  if (tz) {
    try {
      return formatWithOptions({
        ...spanish12hDateTimeOptions,
        timeZone: tz,
      });
    } catch {
      return formatWithOptions(spanish12hDateTimeOptions);
    }
  }
  return formatWithOptions(spanish12hDateTimeOptions);
}
