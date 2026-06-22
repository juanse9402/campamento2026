/**
 * Returns today's date as a "YYYY-MM-DD" string in the **local** timezone
 * of the device running the app (not UTC).
 *
 * Why: JavaScript's `new Date().toISOString()` always returns UTC, which can
 * cause the date to be off by one day (e.g. late at night in UTC-5).
 * Supabase stores dates as plain strings, so we must send the local date.
 */
export function getTodayLocalStr(): string {
  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
