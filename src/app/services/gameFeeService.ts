const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface GameFeeConfig {
  gameType: string;
  feeRate: number;
  feePercent: number;
  stakes: number[];
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("bitzimi_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getGameFeeConfig(gameType: string): Promise<GameFeeConfig> {
  const res = await fetch(`${API_BASE}/api/v1/games/config/${encodeURIComponent(gameType)}`, {
    headers: { ...getAuthHeader() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Unable to load game configuration");
  return json.data as GameFeeConfig;
}
