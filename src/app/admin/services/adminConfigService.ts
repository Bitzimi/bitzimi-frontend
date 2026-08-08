/**
 * Admin Config Service — frontend access layer for the SystemConfig backend.
 *
 * Provides:
 *   - get / set / list config entries via admin API
 *   - feature toggle helpers (isFeatureEnabled)
 *   - maintenance mode helpers
 *
 * All reads go to GET /api/v1/admin/config (admin-authenticated).
 * For PUBLIC feature checks (landing page, user-facing feature gates) use
 * GET /api/v1/platform/config instead (no admin required).
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

export interface ConfigEntry {
  key:         string;
  value:       any;
  rawValue:    string;
  description: string | null;
  updatedAt:   string;
  updatedBy:   string | null;
}

async function configFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "Config API error"), { status: res.status });
  return json.data as T;
}

export const adminConfigService = {
  /** List all system config entries. */
  async listAll(): Promise<ConfigEntry[]> {
    if (!API_BASE || !getToken()) return [];
    try { return await configFetch<ConfigEntry[]>("/api/v1/admin/config"); }
    catch { return []; }
  },

  /** Get a single config entry by key. Returns null if not found. */
  async get(key: string): Promise<ConfigEntry | null> {
    if (!API_BASE || !getToken()) return null;
    try { return await configFetch<ConfigEntry>(`/api/v1/admin/config/${encodeURIComponent(key)}`); }
    catch { return null; }
  },

  /** Get a parsed config value with a typed default. */
  async getValue<T = any>(key: string, defaultValue: T): Promise<T> {
    const entry = await this.get(key);
    return entry ? (entry.value as T) : defaultValue;
  },

  /** Set (upsert) a config entry. */
  async set(key: string, value: any, description?: string): Promise<ConfigEntry | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await configFetch<ConfigEntry>(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body:   JSON.stringify({ value, description }),
      });
    } catch { return null; }
  },

  /** Delete a config entry. */
  async delete(key: string): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await configFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, { method: "DELETE" });
      return true;
    } catch { return false; }
  },

  // ── Feature toggle helpers ──────────────────────────────────────────────────

  /** Check if a named feature is enabled (admin-side read). */
  async isFeatureEnabled(featureName: string, defaultValue = true): Promise<boolean> {
    return this.getValue<boolean>(`feature.${featureName}`, defaultValue);
  },

  /** Enable or disable a feature toggle. */
  async setFeature(featureName: string, enabled: boolean): Promise<boolean> {
    const entry = await this.set(`feature.${featureName}`, enabled);
    return entry !== null;
  },

  // ── Maintenance mode helpers ────────────────────────────────────────────────

  /** Check if maintenance mode is currently enabled. */
  async isMaintenanceEnabled(): Promise<boolean> {
    return this.getValue<boolean>("maintenance.enabled", false);
  },

  /** Enable or disable maintenance mode. */
  async setMaintenance(enabled: boolean, message?: string): Promise<boolean> {
    const modeOk = await this.set("maintenance.enabled", enabled);
    if (message !== undefined) await this.set("maintenance.message", message);
    return modeOk !== null;
  },
};
