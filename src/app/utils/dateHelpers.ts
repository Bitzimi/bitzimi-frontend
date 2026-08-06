/**
 * Locale-aware date/time formatting utilities — Phase 24.2
 * All formats respect the user's selected locale (BCP 47, e.g. "en", "ar", "fr").
 */

export function formatDate(
  date: Date | string | number,
  locale = "en",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatTime(
  date: Date | string | number,
  locale = "en",
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatDateTime(date: Date | string | number, locale = "en"): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function formatRelative(date: Date | string | number, locale = "en"): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffSec < 60)      return rtf.format(-diffSec, "second");
  if (diffSec < 3600)    return rtf.format(-Math.floor(diffSec / 60),    "minute");
  if (diffSec < 86400)   return rtf.format(-Math.floor(diffSec / 3600),  "hour");
  if (diffSec < 2592000) return rtf.format(-Math.floor(diffSec / 86400), "day");
  if (diffSec < 31536000)return rtf.format(-Math.floor(diffSec / 2592000),"month");
  return rtf.format(-Math.floor(diffSec / 31536000), "year");
}
