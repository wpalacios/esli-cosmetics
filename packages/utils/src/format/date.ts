/**
 * Formats a Date object to ISO 8601 string with timezone offset
 * Example: "2024-01-15T10:30:00-05:00"
 *
 * This function preserves the user's local timezone when formatting the datetime,
 * which is important for accurate time representation in different timezones.
 *
 * @param date - The date to format (defaults to current date/time)
 * @returns ISO 8601 formatted string with timezone offset
 */
export function formatDateTimeWithTimezone(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Get timezone offset in minutes and convert to hours and minutes
  const offsetMinutes = date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes <= 0 ? "+" : "-";
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetString}`;
}
