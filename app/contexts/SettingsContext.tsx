/**
 * SettingsContext — Phase 24.2
 *
 * Manages user preferences: theme, language, currency.
 * Language and translations are now fully backend-driven:
 *   - Available languages come from GET /api/v1/languages
 *   - Translation bundles come from GET /api/v1/translations/:code
 *   - User preference synced via PATCH /api/v1/users/me/preferences
 *   - RTL layout applied automatically (Arabic, Hebrew, Persian)
 *
 * Currency: backend-driven rates from GET /api/v1/currencies.
 * USD is the ONLY accounting currency — currency only changes DISPLAY.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

// ── Types ──────────────────────────────────────────────────────────────────────

export type Currency = {
  code:   string;
  name:   string;
  symbol: string;
  rate:   number;
};

export type Language = {
  code:       string;
  name:       string;
  nativeName?: string;
  flag?:       string | null;
  direction?:  "ltr" | "rtl";
  isDefault?:  boolean;
  isEnabled?:  boolean;
  sortOrder?:  number;
};

// Fallback currencies used ONLY when backend is unreachable.
export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar",         symbol: "$",   rate: 1    },
  { code: "EUR", name: "Euro",               symbol: "€",   rate: 0.92 },
  { code: "GBP", name: "British Pound",      symbol: "£",   rate: 0.79 },
  { code: "NGN", name: "Nigerian Naira",     symbol: "₦",  rate: 1650 },
  { code: "CNY", name: "Chinese Yuan",       symbol: "¥",   rate: 7.25 },
  { code: "INR", name: "Indian Rupee",       symbol: "₹",  rate: 83   },
  { code: "ZAR", name: "South African Rand", symbol: "R",   rate: 18.5 },
  { code: "KES", name: "Kenyan Shilling",    symbol: "KSh", rate: 130  },
  { code: "RUB", name: "Russian Ruble",      symbol: "₽",  rate: 90   },
  { code: "TRY", name: "Turkish Lira",       symbol: "₺",  rate: 32   },
];

// Static fallback language — loaded before backend responds
const FALLBACK_LANGUAGE: Language = { code: "en", name: "English", direction: "ltr" };

type Theme = "light" | "dark";

type SettingsContextType = {
  theme:               Theme;
  setTheme:            (theme: Theme) => void;
  language:            Language;
  setLanguage:         (language: Language) => void;
  availableLanguages:  Language[];
  translationsLoaded:  boolean;
  currency:            Currency;
  setCurrency:         (currency: Currency) => void;
  availableCurrencies: Currency[];
  formatCurrency:           (amount: number) => string;
  formatCurrencyNoDecimals: (amount: number) => string;
  convertCurrency:   (amount: number) => number;
  convertToUSD:      (amount: number) => number;
  convertFromUSD:    (amount: number) => number;
  needsSmallFont:    () => boolean;
  t:                 (key: string, fallback?: string) => string;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem("bitzimiTheme") as Theme) || "dark"; }
    catch { return "dark"; }
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("bitzimiTheme", t); } catch {}
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);  // apply on mount

  // ── Language ───────────────────────────────────────────────────────────────
  const [availableLanguages,  setAvailableLanguages]  = useState<Language[]>([FALLBACK_LANGUAGE]);
  const [translationBundle,   setTranslationBundle]   = useState<Record<string, string>>({});
  const [translationsLoaded,  setTranslationsLoaded]  = useState(false);
  const [language,            setLanguageState]       = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("bitzimiLanguage");
      return saved ? JSON.parse(saved) : FALLBACK_LANGUAGE;
    } catch { return FALLBACK_LANGUAGE; }
  });

  /** Fetch translation bundle from backend and apply RTL if needed. */
  const fetchTranslations = useCallback(async (lang: Language) => {
    if (!API_BASE) { setTranslationsLoaded(true); return; }
    try {
      const res  = await fetch(`${API_BASE}/api/v1/translations/${lang.code}`);
      const json = await res.json();
      if (json?.data) setTranslationBundle(json.data);
    } catch {}
    finally { setTranslationsLoaded(true); }
  }, []);

  /** Full language change: save, apply RTL, fetch bundle, sync to backend. */
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem("bitzimiLanguage", JSON.stringify(lang)); } catch {}
    // RTL support
    const dir = lang.direction === "rtl" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang.code);
    // Fetch translation bundle
    fetchTranslations(lang);
    // Sync to backend (best-effort)
    const token = getToken();
    if (API_BASE && token) {
      fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ languagePref: lang.code }),
      }).catch(() => {});
    }
  }, [fetchTranslations]);

  // Load available languages from backend on mount
  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/api/v1/languages`)
      .then(r => r.json())
      .then(json => {
        const langs: Language[] = json?.data ?? [];
        if (langs.length > 0) {
          setAvailableLanguages(langs);
          // Update the current language object with full backend data (adds direction/flag/etc)
          setLanguageState(prev => {
            const full = langs.find(l => l.code === prev.code);
            return full ?? prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Fetch translations on mount for the current language
  useEffect(() => {
    // Apply RTL for saved language immediately (before bundle loads)
    const dir = language.direction === "rtl" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language.code);
    fetchTranslations(language);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Currency ───────────────────────────────────────────────────────────────
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem("bitzimiCurrency");
      return saved ? JSON.parse(saved) : CURRENCIES[0];
    } catch { return CURRENCIES[0]; }
  });

  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>(CURRENCIES);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem("bitzimiCurrency", JSON.stringify(c)); } catch {}
    // Sync to backend (best-effort)
    const token = getToken();
    if (API_BASE && token) {
      fetch(`${API_BASE}/api/v1/users/me/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currencyPref: c.code }),
      }).catch(() => {});
    }
  }, []);

  // Fetch live currency list + default on mount
  useEffect(() => {
    if (!API_BASE) return;
    const hasSavedCurrency = !!localStorage.getItem("bitzimiCurrency");
    Promise.all([
      fetch(`${API_BASE}/api/v1/currencies`).then(r => r.json()).catch(() => null),
      hasSavedCurrency ? null : fetch(`${API_BASE}/api/v1/currencies/default`).then(r => r.json()).catch(() => null),
    ]).then(([listJson, defaultJson]) => {
      const list: Currency[] = ((listJson?.data ?? []) as any[]).map((c: any) => ({
        code: c.code, name: c.name ?? c.code, symbol: c.symbol, rate: c.rate,
      }));
      if (list.length > 0) {
        setAvailableCurrencies(list);
        setCurrencyState(prev => {
          if (hasSavedCurrency) {
            const live = list.find(c => c.code === prev.code);
            return live ?? prev;
          }
          if (defaultJson?.data) {
            const def = defaultJson.data;
            return { code: def.code, name: def.name ?? def.code, symbol: def.symbol, rate: def.rate };
          }
          return list[0];
        });
      }
    }).catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Sync preferences from backend on mount (runs once after token is available)
  useEffect(() => {
    const token = getToken();
    if (!API_BASE || !token) return;
    fetch(`${API_BASE}/api/v1/users/me/preferences`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        const pref = json?.data;
        if (!pref) return;
        if (pref.themePref) setTheme(pref.themePref as Theme);
        if (pref.languagePref) {
          const l = availableLanguages.find(x => x.code === pref.languagePref);
          if (l) setLanguage(l);
        }
        if (pref.currencyPref) {
          const c = availableCurrencies.find(x => x.code === pref.currencyPref);
          if (c) setCurrency(c);
        }
      })
      .catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Currency helpers ───────────────────────────────────────────────────────
  const convertCurrency = (amount: number): number => {
    if (!isFinite(amount) || !isFinite(currency.rate) || currency.rate <= 0) return 0;
    return amount * currency.rate;
  };
  const convertToUSD   = (amount: number): number => {
    if (!isFinite(amount) || !isFinite(currency.rate) || currency.rate <= 0) return 0;
    return amount / currency.rate;
  };
  const convertFromUSD = (amount: number): number => {
    if (!isFinite(amount) || !isFinite(currency.rate) || currency.rate <= 0) return 0;
    return amount * currency.rate;
  };
  const formatCurrency = (amount: number): string => {
    if (!isFinite(amount)) return `${currency.symbol}0`;
    const converted = convertCurrency(amount);
    if (!isFinite(converted)) return `${currency.symbol}0`;
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };
  const formatCurrencyNoDecimals = (amount: number): string => {
    if (!isFinite(amount)) return `${currency.symbol}0`;
    const converted = convertCurrency(amount);
    if (!isFinite(converted)) return `${currency.symbol}0`;
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  const needsSmallFont = (): boolean => currency.rate > 20;

  // ── Translation function ───────────────────────────────────────────────────
  const t = useCallback((key: string, fallback?: string): string => {
    // 1. Try backend bundle (dot-notation keys)
    if (translationBundle[key]) return translationBundle[key];
    // 2. Try common short-form legacy keys (e.g. "save" → "common.save")
    if (translationBundle[`common.${key}`]) return translationBundle[`common.${key}`];
    // 3. Fallback parameter
    if (fallback) return fallback;
    // 4. Pretty-print the key itself
    return key.split(".").pop()?.replace(/_/g, " ") ?? key;
  }, [translationBundle]);

  return (
    <SettingsContext.Provider
      value={{
        theme, setTheme,
        language, setLanguage, availableLanguages, translationsLoaded,
        currency, setCurrency, availableCurrencies,
        formatCurrency, formatCurrencyNoDecimals,
        convertCurrency, convertToUSD, convertFromUSD,
        needsSmallFont, t,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
