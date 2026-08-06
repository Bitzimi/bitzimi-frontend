/**
 * Locale-aware number formatting utilities — Phase 24.2
 * USD is the ONLY accounting currency — these helpers only affect DISPLAY.
 */

export function formatNumber(
  value: number,
  locale = "en",
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number, locale = "en", decimals = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

export function formatCompact(value: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact", maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Display-only currency formatting.
 * value is always internally USD; displayRate converts it for display only.
 */
export function formatDisplayCurrency(
  usdValue: number,
  displayRate: number,
  displayCurrencyCode: string,
  locale = "en",
): string {
  const displayValue = usdValue * displayRate;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: displayCurrencyCode,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(displayValue);
  } catch {
    return `${displayCurrencyCode} ${displayValue.toFixed(2)}`;
  }
}
