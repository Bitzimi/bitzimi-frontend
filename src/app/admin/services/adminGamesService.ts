/**
 * adminGamesService — game management API client for the admin panel.
 * All data comes from the backend. No calculation happens here.
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type RoomAccessLevel = "public" | "verified" | "vip" | "staff";

export interface LobbyConfig {
  lobbyId:     string;
  enabled:     boolean;
  minBet:      number;
  maxBet:      number;
  order:       number;
  accessLevel: RoomAccessLevel;
}

export interface RoomConfig {
  roomId:      string;
  name:        string;
  enabled:     boolean;
  maintenance: boolean;
  visible:     boolean;
  order:       number;
  capacity:    number | null;
}

export interface GameConfig {
  gameType:    string;
  name:        string;
  category:    string;
  enabled:     boolean;
  maintenance: boolean;
  feeRate:     number;
  roomMode:    boolean;
  lobbies:     LobbyConfig[];
  stakes:      number[];
}

export interface MonitoringRound {
  id:          string;
  lobbyId?:    string | null;
  stake?:      number;
  status:      string;
  playerCount: number;
}

export interface GameMonitoring {
  colorGame:   { activeRounds: number; activePlayers: number; rounds: MonitoringRound[] };
  spinBattle:  { activeRounds: number; activePlayers: number; rounds: MonitoringRound[] };
  diceRoyale:  { activeRounds: number; activePlayers: number; rounds: MonitoringRound[] };
  diceArena:   { activeRounds: number; activePlayers: number; rounds: MonitoringRound[] };
  pvp:         { activeMatches: number; byGameType: Record<string, number> };
  queue:       { totalWaiting: number; byGameType: Record<string, number> };
  roundsSettled24h:  number;
  totalActivePlayers: number;
}

export interface HistoryItem {
  id:        string;
  roundId:   string;
  gameType:  string;
  lobbyId:   string | null;
  userId:    string;
  username:  string;
  amount:    number;
  outcome:   string | null;
  payout:    number | null;
  fee:       number | null;
  betData:   any;
  placedAt:  string;
  settledAt: string | null;
}

export interface HistoryPage {
  items:      HistoryItem[];
  nextCursor: string | null;
  hasMore:    boolean;
}

export interface AnalyticsGameRow {
  totalGames:    number;
  wins:          number;
  totalWagered:  number;
  totalPaid:     number;
  platformRevenue: number;
  rounds30d:     number;
}

export interface GameAnalytics {
  period:      string;
  since:       string;
  byGameType:  Record<string, AnalyticsGameRow>;
  totals: {
    totalGames:    number;
    totalWagered:  number;
    totalPaid:     number;
    platformRevenue: number;
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const adminGamesService = {
  /** Fetch all game configs (enabled, maintenance, feeRate, roomMode, lobbies, stakes). */
  async fetchConfigs(): Promise<GameConfig[]> {
    return apiFetch<GameConfig[]>("/api/v1/admin/games");
  },

  /** Update a game's enabled/maintenance/feeRate/roomMode. */
  async updateGame(gameType: string, opts: { enabled?: boolean; maintenance?: boolean; feeRate?: number; roomMode?: boolean }): Promise<GameConfig> {
    return apiFetch<GameConfig>(`/api/v1/admin/games/${gameType}`, {
      method: "PATCH",
      body:   JSON.stringify(opts),
    });
  },

  /** Update a single lobby's config. */
  async updateLobby(gameType: string, lobbyId: string, opts: { enabled?: boolean; minBet?: number; maxBet?: number; order?: number; accessLevel?: RoomAccessLevel }): Promise<LobbyConfig> {
    return apiFetch<LobbyConfig>(`/api/v1/admin/games/${gameType}/lobbies/${lobbyId}`, {
      method: "PATCH",
      body:   JSON.stringify(opts),
    });
  },

  /** Create a new lobby for a lobby-based game. */
  async createLobby(gameType: string, opts: { lobbyId: string; minBet: number; maxBet: number; enabled?: boolean }): Promise<LobbyConfig> {
    return apiFetch<LobbyConfig>(`/api/v1/admin/games/${gameType}/lobbies`, {
      method: "POST",
      body:   JSON.stringify(opts),
    });
  },

  /** Replace available stakes for a stake-selection game. */
  async updateStakes(gameType: string, stakes: number[]): Promise<number[]> {
    return apiFetch<number[]>(`/api/v1/admin/games/${gameType}/stakes`, {
      method: "PATCH",
      body:   JSON.stringify({ stakes }),
    });
  },

  // ── Lobby room management ────────────────────────────────────────────────────

  /** List rooms for a lobby. */
  async fetchLobbyRooms(gameType: string, lobbyId: string): Promise<RoomConfig[]> {
    return apiFetch<RoomConfig[]>(`/api/v1/admin/games/${gameType}/lobbies/${lobbyId}/rooms`);
  },

  /** Create a new room in a lobby. */
  async createLobbyRoom(
    gameType: string,
    lobbyId:  string,
    opts: { roomId?: string; name?: string; enabled?: boolean; visible?: boolean; capacity?: number | null },
  ): Promise<RoomConfig> {
    return apiFetch<RoomConfig>(`/api/v1/admin/games/${gameType}/lobbies/${lobbyId}/rooms`, {
      method: "POST",
      body:   JSON.stringify(opts),
    });
  },

  /** Update a room in a lobby. */
  async updateLobbyRoom(
    gameType: string,
    lobbyId:  string,
    roomId:   string,
    opts: { name?: string; enabled?: boolean; maintenance?: boolean; visible?: boolean; order?: number; capacity?: number | null },
  ): Promise<RoomConfig> {
    return apiFetch<RoomConfig>(`/api/v1/admin/games/${gameType}/lobbies/${lobbyId}/rooms/${roomId}`, {
      method: "PATCH",
      body:   JSON.stringify(opts),
    });
  },

  /** Delete a room from a lobby. */
  async deleteLobbyRoom(gameType: string, lobbyId: string, roomId: string): Promise<void> {
    await fetch(`${API_BASE}/api/v1/admin/games/${gameType}/lobbies/${lobbyId}/rooms/${roomId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },

  // ── Stake room management ─────────────────────────────────────────────────────

  /** List rooms for a stake value. */
  async fetchStakeRooms(gameType: string, stake: number): Promise<RoomConfig[]> {
    return apiFetch<RoomConfig[]>(`/api/v1/admin/games/${gameType}/stakes/${stake}/rooms`);
  },

  /** Create a new room for a stake value. */
  async createStakeRoom(
    gameType: string,
    stake:    number,
    opts: { roomId?: string; name?: string; enabled?: boolean; visible?: boolean; capacity?: number | null },
  ): Promise<RoomConfig> {
    return apiFetch<RoomConfig>(`/api/v1/admin/games/${gameType}/stakes/${stake}/rooms`, {
      method: "POST",
      body:   JSON.stringify(opts),
    });
  },

  /** Update a room for a stake value. */
  async updateStakeRoom(
    gameType: string,
    stake:    number,
    roomId:   string,
    opts: { name?: string; enabled?: boolean; maintenance?: boolean; visible?: boolean; order?: number; capacity?: number | null },
  ): Promise<RoomConfig> {
    return apiFetch<RoomConfig>(`/api/v1/admin/games/${gameType}/stakes/${stake}/rooms/${roomId}`, {
      method: "PATCH",
      body:   JSON.stringify(opts),
    });
  },

  /** Delete a room for a stake value. */
  async deleteStakeRoom(gameType: string, stake: number, roomId: string): Promise<void> {
    await fetch(`${API_BASE}/api/v1/admin/games/${gameType}/stakes/${stake}/rooms/${roomId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  },

  // ── Monitoring / history / analytics ─────────────────────────────────────────

  /** Live monitoring snapshot. */
  async fetchMonitoring(): Promise<GameMonitoring> {
    return apiFetch<GameMonitoring>("/api/v1/admin/games/monitoring");
  },

  /** Paginated match/bet history. */
  async fetchHistory(opts?: { cursor?: string; limit?: number; gameType?: string }): Promise<HistoryPage> {
    const params = new URLSearchParams();
    if (opts?.cursor)   params.set("cursor",   opts.cursor);
    if (opts?.limit)    params.set("limit",    String(opts.limit));
    if (opts?.gameType) params.set("gameType", opts.gameType);
    return apiFetch<HistoryPage>(`/api/v1/admin/games/history?${params}`);
  },

  /** Platform revenue analytics (30-day window). */
  async fetchAnalytics(): Promise<GameAnalytics> {
    return apiFetch<GameAnalytics>("/api/v1/admin/games/analytics");
  },
};
