/**
 * Game Matchmaking Service — connects frontend game pages to the backend
 * real-player matchmaking and round APIs.
 *
 * Replaces the localStorage + bot-based simulation for all PvP games.
 *
 * Endpoints consumed:
 *   POST   /api/v1/games/queue               — join 1v1 matchmaking
 *   GET    /api/v1/games/queue/active        — read-only active search/match recovery
 *   POST   /api/v1/games/queue/:id/heartbeat — refresh active-search lease
 *   GET    /api/v1/games/queue/:id           — poll queue status
 *   DELETE /api/v1/games/queue/:id           — leave queue
 *   GET    /api/v1/games/matches/:id         — poll match result
 *   POST   /api/v1/games/matches/:id/settle  — settle Coin Flip after result reveal
 *   POST   /api/v1/games/matches/:id/ready   — ReactionTap signal ready
 *   POST   /api/v1/games/matches/:id/tap     — ReactionTap submit tap
 *   GET    /api/v1/games/dice-royale/rounds  — view Royale round for stake
 *   POST   /api/v1/games/dice-royale/rounds/:id/join — join Royale round
 *   GET    /api/v1/games/dice-arena/rounds   — view Arena round for stake
 *   POST   /api/v1/games/dice-arena/rounds/:id/join  — join Arena round
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("bitzimi_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { code: json?.error?.code, status: res.status });
  return json.data as T;
}

export type MatchGameType = "dice_clash" | "pvp_coinflip" | "reaction_tap";

export interface QueueResult {
  status:   "waiting" | "matched" | "cancelled";
  queueId?: string;
  matchId?: string;
}

export interface ActiveMatchmaking {
  status: "none" | "waiting" | "matched";
  queueId: string | null;
  matchId: string | null;
}

export interface PrivateRoom {
  id:                string;
  code:              string;
  gameType:          string;
  stake:             number;
  hostId:            string;
  guestId:           string | null;
  status:             "waiting" | "ready" | "active" | "rematch" | "completed" | "cancelled";
  currentMatchId:    string | null;
  rematchHostReady:  boolean;
  rematchGuestReady: boolean;
  createdAt:         string;
  expiresAt:         string;
  host:              { id: string; profile: { username: string; avatarUrl: string | null } | null };
  guest:             { id: string; profile: { username: string; avatarUrl: string | null } | null } | null;
}

export interface MatchResult {
  matchId:     string;
  gameType:    string;
  stake:       number;
  totalPool:   number;
  platformFee: number;
  status:      "active" | "settling" | "settled" | "cancelled";
  isPlayer1?: boolean;
  playerIsHome?: boolean;
  opponent:    { username: string; userId: string; avatar: string };
  result:      Record<string, any> | null;
  winnerId:    string | null;
  youWon:      boolean;
  payout:      number;
  createdAt:   string;
  settledAt:  string | null;
  signalSentAt:string | null;
  serverNow: number;
  lifecycleStartedAt: number;
  yourReady:   boolean;
  opponentReady:boolean;
}

export interface GameConfig {
  gameType: string;
  feeRate: number;
  feePercent: number;
  stakes: number[];
}

export const gameMatchmakingService = {
  async joinQueue(gameType: MatchGameType, stake: number): Promise<QueueResult> {
    return apiFetch("/api/v1/games/queue", { method: "POST", body: JSON.stringify({ gameType, stake }) });
  },
  async getActiveMatchmaking(gameType: MatchGameType, stake: number): Promise<ActiveMatchmaking> {
    return apiFetch(`/api/v1/games/queue/active?gameType=${encodeURIComponent(gameType)}&stake=${encodeURIComponent(stake)}`);
  },
  async heartbeatQueue(queueId: string): Promise<{ status: "waiting" | "matched" | "cancelled"; matchId: string | null; expiresAt?: string }> {
    return apiFetch(`/api/v1/games/queue/${encodeURIComponent(queueId)}/heartbeat`, { method: "POST", body: "{}" });
  },
  async pollQueue(queueId: string): Promise<QueueResult> {
    return apiFetch(`/api/v1/games/queue/${queueId}`);
  },
  async leaveQueue(queueId: string): Promise<void> {
    await apiFetch(`/api/v1/games/queue/${queueId}`, { method: "DELETE" });
  },
  async getMatch(matchId: string): Promise<MatchResult> {
    return apiFetch(`/api/v1/games/matches/${matchId}`);
  },
  async getGameConfig(gameType: MatchGameType): Promise<GameConfig> {
    return apiFetch(`/api/v1/games/config/${gameType}`);
  },
  async settleCoinFlip(matchId: string): Promise<{ settled: boolean; winnerId: string; payout: number }> {
    return apiFetch(`/api/v1/games/matches/${matchId}/settle`, { method: "POST", body: "{}" });
  },
  async signalReady(matchId: string): Promise<{ signalSentAt?: string; delayMs?: number; waiting?: boolean }> {
    return apiFetch(`/api/v1/games/matches/${matchId}/ready`, { method: "POST", body: "{}" });
  },
  async submitTap(matchId: string, tapMs: number): Promise<{ submitted: boolean }> {
    return apiFetch(`/api/v1/games/matches/${matchId}/tap`, { method: "POST", body: JSON.stringify({ tapMs }) });
  },
  async createRoom(gameType: MatchGameType, stake: number): Promise<PrivateRoom> {
    return apiFetch("/api/v1/games/private-rooms", { method: "POST", body: JSON.stringify({ gameType, stake }) });
  },
  async getRoom(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}`);
  },
  async joinRoom(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/join`, { method: "POST", body: "{}" });
  },
  async startMatch(code: string): Promise<{ matchId: string; room: PrivateRoom }> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/start`, { method: "POST", body: "{}" });
  },
  async signalRematch(code: string): Promise<{ status: "started" | "waiting"; matchId: string | null; room: PrivateRoom }> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "POST", body: "{}" });
  },
  async declineRematch(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "DELETE" });
  },
  async getMyActiveRoom(): Promise<PrivateRoom | null> {
    return apiFetch("/api/v1/games/private-rooms/my/active");
  },
  async cancelRoom(code: string): Promise<void> {
    await apiFetch(`/api/v1/games/private-rooms/${code}`, { method: "DELETE" });
  },
};

export interface DiceRoundInfo {
  roundId: string;
  roundNumber: number;
  stake: number;
  status: string;
  playerCount: number;
  maxPlayers: number;
  canJoin: boolean;
  timeRemaining: number | null;
  resultData: Record<string, any> | null;
}

export const diceRoyaleService = {
  async getRound(stake: number): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-royale/rounds?stake=${stake}`); },
  async pollRound(roundId: string): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}`); },
  async joinRound(roundId: string, stake: number): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/join`, { method: "POST", body: JSON.stringify({ stake }) }); },
  async leaveRound(roundId: string): Promise<void> { await apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/leave`, { method: "DELETE" }); },
};

export const diceArenaService = {
  async getRound(stake: number): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-arena/rounds?stake=${stake}`); },
  async pollRound(roundId: string): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}`); },
  async joinRound(roundId: string, stake: number): Promise<DiceRoundInfo> { return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}/join`, { method: "POST", body: JSON.stringify({ stake }) }); },
};

export interface FairnessData {
  serverSeed: string | null;
  clientSeed: string | null;
  nonce: number | null;
  serverSeedHash: string;
  settled: boolean;
  verification: any | null;
}

export const fairnessService = {
  async getRoundFairness(roundId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/round/${roundId}`); },
  async getDiceRoundFairness(roundId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/dice-round/${roundId}`); },
  async getMatchFairness(matchId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/match/${matchId}`); },
};
