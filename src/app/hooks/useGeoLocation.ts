/**
 * useGeoLocation — detects the user's current country via public IP.
 * Works with VPNs: always reflects the current IP location.
 *
 * Priority order for region detection:
 *   1. Live IP geolocation (re-fetched every 5 min)
 *   2. Manual country selected by user (stored in bitzimiManualCountry)
 *   3. Last known cached country (after cache expires, still shown until refresh)
 *
 * Display currency NEVER determines the user's country.
 */
import { useState, useEffect } from "react";

export interface GeoLocation {
  country: string;      // "Nigeria"
  countryCode: string;  // "NG"
  loading: boolean;
  error: boolean;
}

const CACHE_KEY = "bitzimiGeoLocation";
const MANUAL_COUNTRY_KEY = "bitzimiManualCountry";
/** 5 minutes — short enough so a VPN change is reflected after one refresh */
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6_000;

const DEFAULT: GeoLocation = { country: "", countryCode: "", loading: true, error: false };

function loadCache(): GeoLocation | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_TTL_MS) {
      return { ...data, loading: false, error: false };
    }
    // Cache is stale — return it with loading=true so a fresh fetch is triggered,
    // but pre-populate country so there is no flicker.
    return { ...data, loading: true, error: false };
  } catch { return null; }
}

function saveCache(country: string, countryCode: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: { country, countryCode },
      timestamp: Date.now(),
    }));
  } catch { /* ignore quota errors */ }
}

/** Allow a manual country override (e.g. for testing or user preference) */
export function setManualCountry(countryCode: string, country: string): void {
  try {
    localStorage.setItem(MANUAL_COUNTRY_KEY, JSON.stringify({ countryCode, country }));
  } catch { /* ignore */ }
}

export function clearManualCountry(): void {
  try { localStorage.removeItem(MANUAL_COUNTRY_KEY); } catch { /* ignore */ }
}

/** Force a fresh geo lookup on next render (call after VPN change) */
export function clearGeoCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

export function useGeoLocation(): GeoLocation {
  const [geo, setGeo] = useState<GeoLocation>(() => {
    // Check manual override first
    try {
      const manual = localStorage.getItem(MANUAL_COUNTRY_KEY);
      if (manual) {
        const { countryCode, country } = JSON.parse(manual);
        return { countryCode, country, loading: false, error: false };
      }
    } catch { /* ignore */ }
    // Then try cache
    return loadCache() ?? DEFAULT;
  });

  useEffect(() => {
    // If we have a fresh non-manual result, nothing to do
    if (!geo.loading) return;

    let cancelled = false;

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      : null;

    fetch("https://ipapi.co/json/", controller ? { signal: controller.signal } : {})
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: any) => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        const country = data.country_name || "";
        const countryCode = data.country_code || "";
        saveCache(country, countryCode);
        setGeo({ country, countryCode, loading: false, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        // Graceful fallback: use stale cache if available, else error state
        const stale = loadCache();
        if (stale) {
          setGeo({ ...stale, loading: false, error: false });
        } else {
          // No cache at all — show error but never crash
          setGeo({ country: "", countryCode: "", loading: false, error: true });
        }
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [geo.loading]);

  return geo;
}
