import { refreshBackendToken } from "./backendAuthService";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getAccessToken(): string | null {
  const direct = localStorage.getItem("bitzimi_access_token");
  if (direct) return direct;
  try {
    const raw = localStorage.getItem("bitzimiUser");
    const legacyToken = raw ? JSON.parse(raw)?.accessToken : null;
    if (typeof legacyToken === "string" && legacyToken) {
      localStorage.setItem("bitzimi_access_token", legacyToken);
      return legacyToken;
    }
  } catch {}
  return null;
}

function getAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  if (retry && !path.includes("/auth/refresh") && !getAccessToken()) {
    const refreshed = await refreshBackendToken();
    if (refreshed) return apiFetch<T>(path, options, false);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...getAuthHeader(), ...(options?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && retry && !path.includes("/auth/refresh")) {
    const refreshed = await refreshBackendToken();
    if (refreshed) return apiFetch<T>(path, options, false);
  }
  if (!res.ok) {
    const message = json?.error?.message ?? "API error";
    const code = json?.error?.code;
    throw Object.assign(new Error(code === "UNAUTHORIZED" ? "Your session has expired. Please log in again." : message), { code, status: res.status });
  }
  return json.data as T;
}

export type MatchGameType = "dice_clash" | "pvp_coinflip" | "reaction_tap";
export interface QueueResult { status: "waiting" | "matched" | "cancelled"; queueId?: string; matchId?: string; stake?: number; matchStatus?: "active" | "settled" | "cancelled"; }
export interface GameConfig { gameType: string; feeRate: number; feePercent: number; stakes: number[]; }
export interface PrivateRoom { id: string; code: string; gameType: string; stake: number; hostId: string; guestId: string | null; status: "waiting" | "ready" | "active" | "rematch" | "completed" | "cancelled"; currentMatchId: string | null; rematchHostReady: boolean; rematchGuestReady: boolean; createdAt: string; expiresAt: string; host: { id: string; profile: { username: string; avatarUrl: string | null } | null }; guest: { id: string; profile: { username: string; avatarUrl: string | null } | null } | null; }
export interface MatchResult { matchId: string; gameType: string; stake: number; totalPool: number; platformFee: number; status: "active" | "settled" | "cancelled"; opponent: { username: string; userId: string; avatar?: string | null }; result: Record<string, any> | null; winnerId: string | null; youWon: boolean; payout: number; createdAt: string; settledAt: string | null; signalSentAt: string | null; yourReady: boolean; opponentReady: boolean; serverNow?: string; animationStartAt?: string; animationDurationMs?: number; }
export interface CoinFlipHistoryItem { matchId: string; stake: number; totalPool: number; platformFee: number; result: "heads" | "tails" | null; youWon: boolean; payout: number; opponent: { username: string; userId: string; avatar?: string | null }; createdAt: string; settledAt: string | null; }

type PersistedQueueContext = { gameType: MatchGameType; stake: number; queueId?: string; matchId?: string; savedAt: number };
const QUEUE_CONTEXT_PREFIX = "bitzimi:matchmaking:";
const contextKey = (gameType: MatchGameType) => `${QUEUE_CONTEXT_PREFIX}${gameType}`;
function readContext(gameType: MatchGameType): PersistedQueueContext | null { try { const raw = localStorage.getItem(contextKey(gameType)); if (!raw) return null; const value = JSON.parse(raw) as PersistedQueueContext; return value.gameType === gameType ? value : null; } catch { return null; } }
function writeContext(value: PersistedQueueContext): void { try { localStorage.setItem(contextKey(value.gameType), JSON.stringify(value)); } catch {} }
function removeContext(gameType: MatchGameType): void { try { localStorage.removeItem(contextKey(gameType)); } catch {} }

let lastQueueContext: PersistedQueueContext | null = null;
const recoveredQueueIds = new Map<string, string>();

export const gameMatchmakingService = {
  async joinQueue(gameType: MatchGameType, stake: number): Promise<QueueResult> {
    const result = await apiFetch<QueueResult>("/api/v1/games/queue", { method: "POST", body: JSON.stringify({ gameType, stake }) });
    // Coin Flip has no browser queue state. The backend is the only source of truth.
    if (gameType !== "pvp_coinflip" && result.queueId) {
      lastQueueContext = { gameType, stake, queueId: result.queueId, savedAt: Date.now(), ...(result.matchId ? { matchId: result.matchId } : {}) };
      writeContext(lastQueueContext);
    }
    return result;
  },

  async recoverQueue(gameType: MatchGameType, stake: number): Promise<QueueResult | null> {
    if (gameType === "pvp_coinflip") {
      const result = await apiFetch<QueueResult>(`/api/v1/games/queue/recover?gameType=pvp_coinflip&stake=${encodeURIComponent(stake)}`);
      return result?.status === "cancelled" ? null : result;
    }
    const stored = readContext(gameType);
    if (stored && Number(stored.stake) === Number(stake)) {
      lastQueueContext = stored;
      if (stored.matchId) {
        try { const match = await this.getMatch(stored.matchId); if (match.status === "active" || match.status === "settled") return { status: "matched", queueId: stored.queueId, matchId: stored.matchId, stake: match.stake }; }
        catch (error: any) { if (error?.status !== 404) throw error; lastQueueContext = null; removeContext(gameType); }
      }
      if (stored.queueId) {
        try {
          const result = await apiFetch<QueueResult>(`/api/v1/games/queue/${stored.queueId}`);
          if (result.status === "matched" && result.matchId) { writeContext({ ...stored, matchId: result.matchId, savedAt: Date.now() }); return result; }
          if (result.status === "waiting") return result;
          lastQueueContext = null; removeContext(gameType); return null;
        } catch (error: any) { if (error?.status !== 404) throw error; lastQueueContext = null; removeContext(gameType); }
      }
    }
    return null;
  },

  clearQueueContext(gameType: MatchGameType) { lastQueueContext = null; recoveredQueueIds.clear(); if (gameType !== "pvp_coinflip") removeContext(gameType); },

  async pollQueue(queueId: string): Promise<QueueResult> {
    const effectiveQueueId = recoveredQueueIds.get(queueId) ?? queueId;
    try {
      const result = await apiFetch<QueueResult>(`/api/v1/games/queue/${effectiveQueueId}`);
      if (result.status === "matched" && result.matchId) { if (lastQueueContext && lastQueueContext.gameType !== "pvp_coinflip") { lastQueueContext = { ...lastQueueContext, queueId: result.queueId ?? effectiveQueueId, matchId: result.matchId, savedAt: Date.now() }; writeContext(lastQueueContext); } recoveredQueueIds.delete(queueId); }
      if (result.status === "cancelled") { const gameType = lastQueueContext?.gameType; lastQueueContext = null; if (gameType && gameType !== "pvp_coinflip") removeContext(gameType); }
      return result;
    } catch (error: any) { if (error?.status === 404) { lastQueueContext = null; } throw error; }
  },

  async leaveQueue(queueId: string): Promise<void> {
    const effectiveQueueId = recoveredQueueIds.get(queueId) ?? queueId;
    await apiFetch(`/api/v1/games/queue/${effectiveQueueId}`, { method: "DELETE" });
    recoveredQueueIds.delete(queueId);
    if (lastQueueContext?.queueId === effectiveQueueId && lastQueueContext.gameType !== "pvp_coinflip") { removeContext(lastQueueContext.gameType); lastQueueContext = null; }
  },

  async getMatch(matchId: string): Promise<MatchResult> { return apiFetch(`/api/v1/games/matches/${matchId}`); },
  async getGameConfig(gameType: string): Promise<GameConfig> { return apiFetch(`/api/v1/games/config/${encodeURIComponent(gameType)}`); },
  async getCoinFlipHistory(stake?: number): Promise<CoinFlipHistoryItem[]> { const qs = stake === undefined ? "" : `?stake=${encodeURIComponent(stake)}`; return apiFetch(`/api/v1/games/coinflip/history${qs}`); },
  async signalReady(matchId: string): Promise<{ signalSentAt?: string; delayMs?: number; waiting?: boolean }> { return apiFetch(`/api/v1/games/matches/${matchId}/ready`, { method: "POST", body: "{}" }); },
  async submitTap(matchId: string, tapMs: number): Promise<{ submitted: boolean }> { return apiFetch(`/api/v1/games/matches/${matchId}/tap`, { method: "POST", body: JSON.stringify({ tapMs }) }); },
  async createRoom(gameType: MatchGameType, stake: number): Promise<PrivateRoom> { return apiFetch("/api/v1/games/private-rooms", { method: "POST", body: JSON.stringify({ gameType, stake }) }); },
  async getRoom(code: string): Promise<PrivateRoom> { return apiFetch(`/api/v1/games/private-rooms/${code}`); },
  async joinRoom(code: string): Promise<PrivateRoom> { return apiFetch(`/api/v1/games/private-rooms/${code}/join`, { method: "POST", body: "{}" }); },
  async startMatch(code: string): Promise<{ matchId: string; room: PrivateRoom }> { return apiFetch(`/api/v1/games/private-rooms/${code}/start`, { method: "POST", body: "{}" }); },
  async signalRematch(code: string): Promise<{ status: "started" | "waiting"; matchId: string | null; room: PrivateRoom }> { return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "POST", body: "{}" }); },
  async declineRematch(code: string): Promise<PrivateRoom> { return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "DELETE" }); },
  async getMyActiveRoom(): Promise<PrivateRoom | null> { return apiFetch("/api/v1/games/private-rooms/my/active"); },
  async cancelRoom(code: string): Promise<void> { await apiFetch(`/api/v1/games/private-rooms/${code}`, { method: "DELETE" }); },
};

export interface DiceRoundInfo { roundId: string; roundNumber: number; stake: number; status: string; playerCount: number; maxPlayers: number; canJoin: boolean; timeRemaining: number | null; resultData: Record<string, any> | null; verificationId?: string | null; serverSeedHash?: string; }
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

export interface FairnessData { verificationId: string | null; serverSeed: string | null; clientSeed: string | null; nonce: number | null; serverSeedHash: string; settled: boolean; verification: any | null; }
export const fairnessService = {
  async getRoundFairness(roundId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/round/${roundId}`); },
  async getDiceRoundFairness(roundId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/dice-round/${roundId}`); },
  async getMatchFairness(matchId: string): Promise<FairnessData> { return apiFetch(`/api/v1/games/fairness/match/${matchId}`); },
};
