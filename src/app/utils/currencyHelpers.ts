/**
 * Currency display helpers — Phase 23.4
 *
 * Rate-driven, not hardcoded-list-driven.
 * "Small" currencies (high rate vs USD, e.g. NGN = 1650) need smaller text.
 * Threshold: rate > 20 means small. Works for any admin-added currency.
 */

const SMALL_THRESHOLD = 20;

/**
 * Text size class based on exchange rate.
 * Pass `currency.rate` from SettingsContext (live backend rate).
 */
export function getAmountTextSize(
  rate: number,
  baseSize: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" = "4xl",
): string {
  const small = rate > SMALL_THRESHOLD;
  const sizeMap = {
    small: { "4xl": "text-lg", "3xl": "text-base", "2xl": "text-sm", "xl": "text-xs", "lg": "text-xs", "base": "text-xs", "sm": "text-xs", "xs": "text-xs" },
    large: { "4xl": "text-2xl", "3xl": "text-xl", "2xl": "text-lg", "xl": "text-base", "lg": "text-sm", "base": "text-sm", "sm": "text-xs", "xs": "text-xs" },
  };
  return small ? sizeMap.small[baseSize] : sizeMap.large[baseSize];
}

/**
 * Fallback symbol lookup — only used when the full Currency object is unavailable.
 * The real symbol comes from SettingsContext which is live from the backend.
 */
export function getCurrencySymbol(code: string): string {
  const known: Record<string, string> = {
    USD: "$", GBP: "£", EUR: "€", NGN: "₦", CNY: "¥",
    INR: "₹", ZAR: "R", KES: "KSh", RUB: "₽", TRY: "₺",
    AED: "د.إ", CAD: "CA$", AUD: "A$", JPY: "¥", BRL: "R$",
    CHF: "CHF", MXN: "MX$", SGD: "S$", HKD: "HK$", KRW: "₩",
  };
  return known[code.toUpperCase()] ?? code;
}

/** Returns true if the currency needs compact text (rate > 20). */
export function isSmallCurrency(rate: number): boolean {
  return rate > SMALL_THRESHOLD;
}
