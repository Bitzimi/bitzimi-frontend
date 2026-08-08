/**
 * FeatureContext — Platform-wide feature flag system.
 *
 * Fetches /api/v1/platform/features (authenticated) which returns:
 *   { data: { access: Record<string, boolean>, flags: Record<string, boolean> } }
 *
 * - access[name] = true  → user can access this feature (backend evaluated role + VIP)
 * - flags[name]  = true  → feature is enabled (boolean feature flag)
 *
 * Frontend MUST NOT hardcode access rules. All access decisions come from backend.
 * Admin configures access levels via Admin Panel → Feature Management.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

interface FeatureState {
  access: Record<string, boolean>; // feature.access.* — evaluated per user by backend
  flags:  Record<string, boolean>; // feature.* boolean flags
}

interface FeatureContextValue {
  /** True if the authenticated user can access this feature (backend-evaluated). */
  hasFeature: (name: string) => boolean;
  /** True if the named boolean feature flag is enabled on the platform. */
  hasFlag: (name: string) => boolean;
  /** Force a re-fetch (e.g. after subscription upgrade). */
  refresh: () => Promise<void>;
  loading: boolean;
}

const FeatureContext = createContext<FeatureContextValue>({
  hasFeature: () => true,  // fail-open default (unauthenticated state handled by backend)
  hasFlag:    () => false,
  refresh:    async () => {},
  loading:    true,
});

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [state, setState]   = useState<FeatureState>({ access: {}, flags: {} });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("bitzimi_access_token");
    if (!token) {
      setState({ access: {}, flags: {} });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/platform/features`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setState({ access: {}, flags: {} }); return; }
      const json = await res.json();
      setState({
        access: (json.data?.access as Record<string, boolean>) ?? {},
        flags:  (json.data?.flags  as Record<string, boolean>) ?? {},
      });
    } catch {
      setState({ access: {}, flags: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("identity-updated", handler);
    return () => window.removeEventListener("identity-updated", handler);
  }, [refresh]);

  const hasFeature = useCallback((name: string): boolean => {
    // If not yet loaded or feature not configured, default to true (fail-open)
    if (loading) return true;
    if (!(name in state.access)) return true;
    return state.access[name] === true;
  }, [state, loading]);

  const hasFlag = useCallback((name: string): boolean => {
    return state.flags[name] === true;
  }, [state]);

  return (
    <FeatureContext.Provider value={{ hasFeature, hasFlag, refresh, loading }}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeature() {
  return useContext(FeatureContext);
}
