/**
 * Spin Battle — fully backend-authoritative.
 *
 * Architecture:
 *   • Fixed stake per lobby (A=$1, B=$5, C=$20, D=$100) — no variable bet input.
 *   • Backend deducts the stake atomically in POST /api/v1/games/spin/lobbies/:lobby/join.
 *   • Backend selects winner via crypto.randomInt (server-side CSPRNG).
 *   • Backend settles the pool via settleSingleWinner() (atomic DB transaction).
 *   • Backend fires affiliate commission on every player (win AND loss).
 *   • Frontend polls GET /api/v1/games/spin/lobbies/:lobby every 1s for live state.
 *   • When phase transitions to "result", frontend animates wheel to land on backend winner.
 *   • refreshWalletsFromBackend() is called after result phase to sync displayed balance.
 *
 * No wallet mutations on the frontend. No Math.random() for game outcomes.
 * No local game engine. Backend is the sole source of truth.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
import { useIdentity } from "../contexts/IdentityContext";
import { ArrowLeft, Users, TrendingUp, Info, Sparkles, Trophy, Loader2, Shield } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { Button } from "../components/ui/button";
import { FairnessModal } from "../components/FairnessModal";
import { fairnessService, type FairnessData } from "../services/gameMatchmakingService";
import SpinBattleGameplay from "../components/SpinBattleGameplay";

// ── Types ──────────────────────────────────────────────────────────────────────

type BackendPhase = "waiting" | "countdown" | "locked" | "spinning" | "result" | "completed";

interface BackendPlayer {
  userId: string;
  username: string;
  index: number;
  avatar?: string | null;
  betAmount: number;
  color: string;
  segmentStart: number;
  segmentEnd: number;
  probability: number;
}

interface BackendWinner {
  roundNumber: number;
  winnerId: string | null;
  winnerUsername: string | null;
  winnerPayout: number;
  timestamp: string;
  avatar?: string | null;
}

interface LobbyState {
  lobbyId:        string;
  roundId:        string;
  roundNumber:    number;
  phase:          BackendPhase;
  playerCount:    number;
  maxPlayers:     number;
  minBet:         number;
  maxBet:         number;
  totalPool:      number;
  timeRemaining:  number | null;
  winnerId:       string | null;
  winnerUsername: string | null;
  winnerPayout:   number | null;
  canJoin:        boolean;
  players:        BackendPlayer[];
  myBet:          { inRound: boolean; amount: number | null } | null;
  recentWinners: BackendWinner[];
  history?: Array<{ roundNumber:number; lobbyId:string|null; betAmount:number; won:boolean|null; payout:number; timestamp:number }>;
  verificationId?: string | null;
  serverSeedHash?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

function getToken(): string | null {
  return localStorage.getItem("bitzimi_access_token");
}

const PLAYER_COLORS = [
  "#FF0000","#0066FF","#00CC44","#FFD700",
  "#FF8C00","#9400D3","#FF1493","#00FFFF",
  "#FF6347","#ADFF2F","#8B4513","#4169E1",
];

// Restored lobby bet ranges
const LOBBY_RANGES: Record<string, { min: number; max: number }> = {
  A: { min: 1,   max: 20  },
  B: { min: 21,  max: 50  },
  C: { min: 51,  max: 120 },
  D: { min: 121, max: 500 },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SpinBattle() {
  const navigate = useNavigate();
  const { formatCurrency, formatCurrencyNoDecimals } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult }   = useGameStats();
  const { addNotification } = useNotifications();
  const { identity }        = useIdentity();
  const myUsername          = identity.username;

  // ── Lobby selection ──────────────────────────────────────────────────────────
  const [selectedLobby, setSelectedLobby] = useState<string | null>(null);
  const [allLobbies,    setAllLobbies]    = useState<Record<string, Partial<LobbyState>>>({});

  const [betAmount, setBetAmount] = useState<string>("");  // user's chosen bet

  // ── Game state ───────────────────────────────────────────────────────────────
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [joining,    setJoining]    = useState(false);
  const [showRules,  setShowRules]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<"winners" | "history">("winners");
  const [showFairness,  setShowFairness]  = useState(false);
  const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);
  const [userHistory, setUserHistory] = useState<Array<{
    roundNumber: number; betAmount: number; won: boolean | null; payout: number; timestamp: number;
  }>>([]);

  // ── Wheel animation ──────────────────────────────────────────────────────────
  const [wheelRotation,   setWheelRotation]   = useState(0);
  const [isSpinning,      setIsSpinning]       = useState(false);
  const [showResultPopup, setShowResultPopup]  = useState(false);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // ── Refs for dedup ───────────────────────────────────────────────────────────
  const processedRound   = useRef<number | null>(null);
  const prevPhase        = useRef<BackendPhase | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const lobbiesPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── All-lobbies polling (lobby selection screen) ───────────────────────────
  useEffect(() => {
    if (!API_BASE || !getToken()) return;
    if (selectedLobby) return; // game page handles its own polling

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/games/spin/lobbies`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) {
          const json = await res.json();
          setAllLobbies(json.data ?? {});
        }
      } catch {}
    };

    poll();
    lobbiesPollRef.current = setInterval(poll, 3000);
    return () => { if (lobbiesPollRef.current) clearInterval(lobbiesPollRef.current); };
  }, [selectedLobby]);

  // ── Single-lobby polling (game page) ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedLobby || !API_BASE || !getToken()) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/games/spin/lobbies/${selectedLobby}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data as LobbyState;
        handleLobbySnapshot(data);
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedLobby]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Process backend snapshot ─────────────────────────────────────────────────
  const handleLobbySnapshot = useCallback((data: LobbyState) => {
    setLobbyState(data);
    if (Array.isArray(data.history)) setUserHistory(data.history);

    // Detect round transition for history reset
    if (data.roundNumber !== processedRound.current && data.phase === "waiting") {
      setShowResultPopup(false);
      setWheelRotation(0);
      setIsSpinning(false);
      setFairnessData(null);
    }

    // Detect spinning → result: animate wheel to winner
    if (prevPhase.current !== "spinning" && data.phase === "spinning") {
      setIsSpinning(true);
      // Wheel animation will resolve when we detect "result" phase with winner
    }

    // Detect result phase — animate wheel to winner and sync wallet
    if (data.phase === "result" && data.winnerId && processedRound.current !== data.roundNumber) {
      processedRound.current = data.roundNumber;
      if (data.roundId) {
        fairnessService.getRoundFairness(data.roundId).then(setFairnessData).catch(() => {});
      }
      setIsSpinning(false);

      // Calculate final rotation so winner's segment lands at top (arrow position)
      const N = data.players.length;
      if (N > 0) {
        const winnerIndex = data.players.findIndex(p => p.userId === data.winnerId);
        if (winnerIndex >= 0) {
          const segmentSize  = 360 / N;
          const winnerCenter = (winnerIndex + 0.5) * segmentSize;
          // To place winnerCenter at 0° (top), rotate by -(winnerCenter).
          // Add 8 full spins for visual effect.
          const finalRotation = 8 * 360 + (360 - winnerCenter);
          setWheelRotation(finalRotation);
        }
      }

      // Wallet sync — backend already credited the winner
      refreshWalletsFromBackend().catch(() => {});

      // Local stats + notifications based on backend result
      const iAmInRound = data.myBet?.inRound ?? false;
      const iWon       = iAmInRound && data.winnerId === identity.userId;
      const myBet      = data.myBet?.amount ?? 0;   // player's own bet amount
      const payout     = data.winnerPayout ?? 0;

      if (iAmInRound) {
        addGameResult({
          gameType:  "spin_battle",
          betAmount: myBet,
          winAmount: iWon ? payout : 0,
          profit:    iWon ? payout - myBet : -myBet,
          won:       iWon,
        });

        if (iWon) {
          addNotification("game_win", "🎉 Spin Battle Won!",
            `Won ${formatCurrencyNoDecimals(payout)} in Lobby ${data.lobbyId}`,
            { game: "spin_battle", lobby: data.lobbyId, amount: payout, roundNumber: data.roundNumber });
          liveActivityService.addActivity("game_win", myUsername, "won in Spin Battle", payout);
          toast.success(`🎉 ${myUsername} won ${formatCurrencyNoDecimals(payout)}!`, { duration: 5000 });
        } else {
          addNotification("game_loss", "Spin Battle Lost",
            `Lost ${formatCurrencyNoDecimals(myBet)} in Lobby ${data.lobbyId}`,
            { game: "spin_battle", lobby: data.lobbyId, amount: myBet, roundNumber: data.roundNumber });
          toast.info(`${data.winnerUsername ?? "Someone"} won ${formatCurrencyNoDecimals(payout)}`);
        }
      } else if (!iAmInRound) {
        toast.info(`Round #${data.roundNumber}: ${data.winnerUsername ?? "Someone"} won ${formatCurrencyNoDecimals(payout)}`);
      }

      // Show winner popup after wheel animation (5s)
      setTimeout(() => setShowResultPopup(true), 5000);
      // Auto-dismiss popup after 8s more
      setTimeout(() => setShowResultPopup(false), 13000);
    }

    // Track phase transitions
    prevPhase.current = data.phase;
  }, [identity.userId, myUsername, formatCurrencyNoDecimals, refreshWalletsFromBackend, addGameResult, addNotification]);

  // ── Join round ───────────────────────────────────────────────────────────────
  const handleJoin = useCallback(async () => {
    if (!selectedLobby || !API_BASE || !getToken()) return;
    if (joining) return;

    const range = LOBBY_RANGES[selectedLobby];
    const bet   = parseFloat(betAmount) || range?.min || 1;

    if (range && (bet < range.min || bet > range.max)) {
      toast.error(`Bet must be $${range.min}–$${range.max} for Lobby ${selectedLobby}`);
      return;
    }
    if (balances.game < bet) {
      toast.error(`Insufficient balance. Need ${formatCurrencyNoDecimals(bet)}`);
      return;
    }

    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/games/spin/lobbies/${selectedLobby}/join`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: bet }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any)?.error?.message ?? "Failed to join round");
        return;
      }

      refreshWalletsFromBackend().catch(() => {});

      toast.success(`Joined Round #${lobbyState?.roundNumber ?? "—"} with ${formatCurrencyNoDecimals(bet)}!`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }, [selectedLobby, betAmount, joining, balances.game, formatCurrencyNoDecimals, lobbyState, refreshWalletsFromBackend]);

  // ── Wheel render ──────────────────────────────────────────────────────────────
  const renderWheel = () => {
    const players = lobbyState?.players ?? [];
    const N       = players.length;
    const winner  = lobbyState?.winnerId;

    if (N === 0) {
      return (
        <div className="relative w-full aspect-square max-w-[400px] mx-auto">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-300 dark:border-gray-700/50 flex items-center justify-center shadow-2xl">
            <div className="text-center">
              <Sparkles className="h-12 w-12 text-blue-500 dark:text-blue-400 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Waiting for players</p>
            </div>
          </div>
        </div>
      );
    }

    const segmentSize = 360 / N;

    return (
      <div className="relative w-full aspect-square max-w-[400px] mx-auto">
        {/* Arrow pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-20">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-gray-800 dark:border-t-white drop-shadow-lg" />
        </div>

        {/* Spinning wheel */}
        <div
          ref={wheelRef}
          className="absolute inset-0 rounded-full overflow-hidden shadow-2xl border-4 border-gray-300 dark:border-gray-700/50"
          style={{
            transform:  `rotate(${wheelRotation}deg)`,
            transition: isSpinning
              ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : lobbyState?.phase === "result"
                ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                : "none",
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {players.map((player, i) => {
              const startDeg = i * segmentSize;
              const endDeg   = (i + 1) * segmentSize;
              const startRad = (startDeg * Math.PI) / 180;
              const endRad   = (endDeg   * Math.PI) / 180;
              const large    = segmentSize > 180 ? 1 : 0;

              const x1 = 100 + 100 * Math.cos(startRad - Math.PI / 2);
              const y1 = 100 + 100 * Math.sin(startRad - Math.PI / 2);
              const x2 = 100 + 100 * Math.cos(endRad   - Math.PI / 2);
              const y2 = 100 + 100 * Math.sin(endRad   - Math.PI / 2);
              const path = `M 100 100 L ${x1} ${y1} A 100 100 0 ${large} 1 ${x2} ${y2} Z`;

              const centerDeg = (startDeg + endDeg) / 2;
              const centerRad = (centerDeg * Math.PI) / 180 - Math.PI / 2;
              const ax = 100 + 70 * Math.cos(centerRad);
              const ay = 100 + 70 * Math.sin(centerRad);

              const color    = PLAYER_COLORS[i % PLAYER_COLORS.length];
              const isWinner = winner === player.userId && lobbyState?.phase === "result";
              const isMe     = player.userId === identity.userId;

              return (
                <g key={player.userId}>
                  <path d={path} fill={color} stroke="white" strokeWidth="2"
                    className={isWinner ? "animate-pulse" : ""}
                    style={isWinner ? { filter: "brightness(1.3)" } : {}}
                  />
                  <text x={ax} y={ay} fontSize="18" textAnchor="middle" dominantBaseline="central"
                    className="pointer-events-none select-none">
                    {isMe ? (identity.avatar?.length === 1 ? identity.avatar : (myUsername?.charAt(0) ?? "U")) : (player.username?.charAt(0)?.toUpperCase() ?? "?")}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Center overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-36 h-36 rounded-full bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-black dark:to-gray-900 border-4 border-gray-300 dark:border-gray-700/50 flex items-center justify-center shadow-2xl">
            {lobbyState?.phase === "countdown" && (
              <p className={`text-5xl font-bold tabular-nums ${(lobbyState.timeRemaining ?? 0) <= 5 ? "text-red-500 animate-pulse" : "text-gray-900 dark:text-white"}`}>
                {lobbyState.timeRemaining}
              </p>
            )}
            {(lobbyState?.phase === "spinning" || isSpinning) && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
                <p className="text-white text-xs font-bold">LIVE</p>
              </div>
            )}
            {lobbyState?.phase === "result" && lobbyState.winnerUsername && (
              <div className="flex flex-col items-center gap-1 p-2">
                <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
                <p className="text-gray-900 dark:text-white text-xs font-bold text-center leading-tight max-w-[100px] truncate">
                  {lobbyState.winnerUsername}
                </p>
                <p className="text-yellow-500 text-xs font-bold animate-pulse">WINS!</p>
              </div>
            )}
            {(!lobbyState || lobbyState.phase === "waiting") && N === 0 && (
              <p className="text-gray-900 dark:text-white text-sm font-semibold">Waiting...</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Lobby selection screen ─────────────────────────────────────────────────────
  if (!selectedLobby) {
    return (
      <ResponsiveLayout>
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/games")} className="hover:bg-gray-200 dark:hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Spin Battle</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Choose a lobby to join</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(["A", "B", "C", "D"] as const).map((lobbyId) => {
              const range       = LOBBY_RANGES[lobbyId];
              const info        = allLobbies[lobbyId];
              const playerCount = info?.playerCount ?? 0;
              const phase       = info?.phase ?? "waiting";

              return (
                <Card key={lobbyId}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/90 dark:to-gray-800/90 border border-gray-200 dark:border-gray-700/50 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm"
                  onClick={() => { setSelectedLobby(lobbyId); setBetAmount(String(range.min)); }}>
                  <CardContent className="p-8">
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="text-4xl font-bold text-blue-500 dark:text-blue-400">{lobbyId}</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Lobby {lobbyId}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Max 12 players per round</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-700/50">
                        <div className="flex items-center justify-center gap-2">
                          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {playerCount} {playerCount === 1 ? "player" : "players"} in round
                          </span>
                        </div>
                        {phase !== "waiting" && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 capitalize">{phase}</p>
                        )}
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700/50">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Bet Range</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrencyNoDecimals(range.min)} – {formatCurrencyNoDecimals(range.max)}
                        </p>
                      </div>
                      <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold">
                        Join Lobby {lobbyId}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (!lobbyState) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-blue-400 mx-auto mb-3 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Connecting to lobby {selectedLobby}...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <SpinBattleGameplay
        lobbyState={lobbyState}
        selectedLobby={selectedLobby}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        joining={joining}
        onJoin={handleJoin}
        onBack={() => setSelectedLobby(null)}
        balances={balances}
        identity={identity}
        userHistory={userHistory}
      />
    </ResponsiveLayout>
  );
}
