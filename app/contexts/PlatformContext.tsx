/**
 * PlatformContext — Phase 24.2
 *
 * Provides platform-wide branding/identity data fetched from the backend.
 * Replaces ALL hardcoded platform name, base URL, and branding references.
 *
 * Data source: GET /api/v1/platform/branding (public, no auth required)
 * Fallbacks are baked in so the UI renders correctly even if backend is down.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined ?? "";

export interface PlatformBranding {
  name:                string;
  tagline:             string;
  baseUrl:             string;
  supportEmail:        string;
  logoUrl:             string;
  faviconUrl:          string;
  copyrightYear:       string;
  companyName:         string;
  defaultLanguage:     string;
  defaultCurrency:     string;
  registrationEnabled: boolean;
  social: {
    twitter:   string;
    telegram:  string;
    instagram: string;
  };
}

const DEFAULT_BRANDING: PlatformBranding = {
  name:                "BitZimi",
  tagline:             "Play. Earn. Grow.",
  baseUrl:             "https://bitzimi.com",
  supportEmail:        "support@bitzimi.com",
  logoUrl:             "",
  faviconUrl:          "",
  copyrightYear:       new Date().getFullYear().toString(),
  companyName:         "BitZimi Ltd",
  defaultLanguage:     "en",
  defaultCurrency:     "USD",
  registrationEnabled: true,
  social:              { twitter: "", telegram: "", instagram: "" },
};

interface PlatformContextType {
  branding:     PlatformBranding;
  isLoaded:     boolean;
  referralUrl:  (code: string) => string;
  affiliateUrl: (code: string) => string;
  ambassadorUrl:(handle: string) => string;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PlatformBranding>(DEFAULT_BRANDING);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!API_BASE) { setIsLoaded(true); return; }
    fetch(`${API_BASE}/api/v1/platform/branding`)
      .then(r => r.json())
      .then(json => {
        if (json?.data) {
          setBranding({ ...DEFAULT_BRANDING, ...json.data });
          if (json.data.faviconUrl) {
            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
            if (link) link.href = json.data.faviconUrl;
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const referralUrl   = (code: string)   => `${branding.baseUrl}/register?ref=${code}`;
  const affiliateUrl  = (code: string)   => `${branding.baseUrl}/register?aff=${code}`;
  const ambassadorUrl = (handle: string) => `${branding.baseUrl}?amb=${handle}`;

  return (
    <PlatformContext.Provider value={{ branding, isLoaded, referralUrl, affiliateUrl, ambassadorUrl }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform must be used within PlatformProvider");
  return ctx;
}
