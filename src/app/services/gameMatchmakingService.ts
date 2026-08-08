/**
 * Game Matchmaking Service — connects frontend game pages to the backend
 * real-player matchmaking and round APIs.
 *
 * Replaces the localStorage + bot-based simulation for all PvP games.
 *
 * Endpoints consumed:
 *   POST   /api/v1/games/queue               — join 1v1 matchmaking
 *   GET    /api/v1/games/queue/:id           — poll queue status
 *   DELETE /api/v1/games/queue/:id           — leave queue
 *   GET    /api/v1/games/matches/:id         — poll match result
 *   POST   /api/v1/games/matches/:id/ready   — ReactionTap signal ready
 *   POST   /api/v1/games/matches/:id/tap     — ReactionTap submit tap
 *   GET    /api/v1/games/dice-royale/rounds  — view Royale round for stake
 *   POST   /api/v1/games/dice-royale/rounds/:id/join — join Royale round
 *   GET    /api/v1/games/dice-arena/rounds   — view Arena round for stake
 *   POST   /api/v1/games/dice-arena/rounds/:id/join  — join Arena round
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  // JWT stored in localStorage by backendAuthService after login/register.
  // Set VITE_API_URL to connect the frontend to the backend.
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

// ── 1v1 Matchmaking ──────────────────────────────────────────────────────────

export type MatchGameType = "dice_clash" | "pvp_coinflip" | "reaction_tap";

export interface QueueResult {
  status:   "waiting" | "matched" | "cancelled";
  queueId?: string;
  matchId?: string;
}

export interface PrivateRoom {
  id:                string;
  code:              string;
  gameType:          string;
  stake:             number;
  hostId:            string;
  guestId:           string | null;
  status:            "waiting" | "ready" | "active" | "rematch" | "completed" | "cancelled";
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
  status:      "active" | "settled" | "cancelled";
  opponent:    { username: string; userId: string };
  result:      Record<string, any> | null;
  winnerId:    string | null;
  youWon:      boolean;
  payout:      number;
  createdAt:   string;
  settledAt:   string | null;
  signalSentAt:string | null;
  yourReady:   boolean;
  opponentReady:boolean;
}

export const gameMatchmakingService = {
  /** Join matchmaking queue for a 1v1 game. Returns immediately if matched. */
  async joinQueue(gameType: MatchGameType, stake: number): Promise<QueueResult> {
    return apiFetch("/api/v1/games/queue", {
      method: "POST",
      body:   JSON.stringify({ gameType, stake }),
    });
  },

  /** Poll until matched. Returns {status: "matched", matchId} or {status: "cancelled"}. */
  async pollQueue(queueId: string): Promise<QueueResult> {
    return apiFetch(`/api/v1/games/queue/${queueId}`);
  },

  /** Leave the queue (refunds stake if not yet matched). */
  async leaveQueue(queueId: string): Promise<void> {
    await apiFetch(`/api/v1/games/queue/${queueId}`, { method: "DELETE" });
  },

  /** Poll match state until status !== "active". */
  async getMatch(matchId: string): Promise<MatchResult> {
    return apiFetch(`/api/v1/games/matches/${matchId}`);
  },

  /** ReactionTap: signal you are ready to see the signal. */
  async signalReady(matchId: string): Promise<{ signalSentAt?: string; delayMs?: number; waiting?: boolean }> {
    return apiFetch(`/api/v1/games/matches/${matchId}/ready`, { method: "POST", body: "{}" });
  },

  /** ReactionTap: submit tap time in milliseconds after seeing the signal. */
  async submitTap(matchId: string, tapMs: number): Promise<{ submitted: boolean }> {
    return apiFetch(`/api/v1/games/matches/${matchId}/tap`, {
      method: "POST",
      body:   JSON.stringify({ tapMs }),
    });
  },

  // ── Private Rooms ────────────────────────────────────────────────────────────

  /** Create a new private room. Backend generates the invite code. */
  async createRoom(gameType: MatchGameType, stake: number): Promise<PrivateRoom> {
    return apiFetch("/api/v1/games/private-rooms", {
      method: "POST",
      body:   JSON.stringify({ gameType, stake }),
    });
  },

  /** Get room state by invite code. */
  async getRoom(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}`);
  },

  /** Join a room as guest using its invite code. */
  async joinRoom(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/join`, { method: "POST", body: "{}" });
  },

  /** Start the match (either player can call once both are in the room). */
  async startMatch(code: string): Promise<{ matchId: string; room: PrivateRoom }> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/start`, { method: "POST", body: "{}" });
  },

  /** Signal rematch readiness. Returns {status:"started",matchId} when both accept. */
  async signalRematch(code: string): Promise<{ status: "started" | "waiting"; matchId: string | null; room: PrivateRoom }> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "POST", body: "{}" });
  },

  /** Decline a rematch. Both players return to the private room. */
  async declineRematch(code: string): Promise<PrivateRoom> {
    return apiFetch(`/api/v1/games/private-rooms/${code}/rematch`, { method: "DELETE" });
  },

  /** Get my currently active private room (if any). */
  async getMyActiveRoom(): Promise<PrivateRoom | null> {
    return apiFetch("/api/v1/games/private-rooms/my/active");
  },

  /** Cancel a room (host only). */
  async cancelRoom(code: string): Promise<void> {
    await apiFetch(`/api/v1/games/private-rooms/${code}`, { method: "DELETE" });
  },
};

// ── Dice Royale ───────────────────────────────────────────────────────────────

export interface DiceRoundInfo {
  roundId:      string;
  roundNumber:  number;
  stake:        number;
  status:       string;
  playerCount:  number;
  maxPlayers:   number;
  canJoin:      boolean;
  timeRemaining:number | null;
  resultData:   Record<string, any> | null;
}

export const diceRoyaleService = {
  async getRound(stake: number): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-royale/rounds?stake=${stake}`);
  },
  async pollRound(roundId: string): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}`);
  },
  async joinRound(roundId: string, stake: number): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/join`, {
      method: "POST",
      body:   JSON.stringify({ stake }),
    });
  },
  async leaveRound(roundId: string): Promise<void> {
    await apiFetch(`/api/v1/games/dice-royale/rounds/${roundId}/leave`, { method: "DELETE" });
  },
};

// ── Dice Arena ────────────────────────────────────────────────────────────────

export const diceArenaService = {
  async getRound(stake: number): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-arena/rounds?stake=${stake}`);
  },
  async pollRound(roundId: string): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}`);
  },
  async joinRound(roundId: string, stake: number): Promise<DiceRoundInfo> {
    return apiFetch(`/api/v1/games/dice-arena/rounds/${roundId}/join`, {
      method: "POST",
      body:   JSON.stringify({ stake }),
    });
  },
};

// ── Provably Fair ─────────────────────────────────────────────────────────────

export interface FairnessData {
  serverSeed:     string | null;
  clientSeed:     string | null;
  nonce:          number | null;
  serverSeedHash: string;
  settled:        boolean;
  verification:   any | null;
}

export const fairnessService = {
  /** GameRound fairness — Color Prediction, Spin Battle */
  async getRoundFairness(roundId: string): Promise<FairnessData> {
    return apiFetch(`/api/v1/games/fairness/round/${roundId}`);
  },
  /** DiceRound fairness — Dice Royale, Dice Arena */
  async getDiceRoundFairness(roundId: string): Promise<FairnessData> {
    return apiFetch(`/api/v1/games/fairness/dice-round/${roundId}`);
  },
  /** PvpMatch fairness — Dice Clash, Coin Flip */
  async getMatchFairness(matchId: string): Promise<FairnessData> {
    return apiFetch(`/api/v1/games/fairness/match/${matchId}`);
  },
};
