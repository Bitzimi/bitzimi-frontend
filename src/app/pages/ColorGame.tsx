import { useState, useEffect, useRef } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import {
  Users,
  DollarSign,
  Info,
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useParams, useNavigate } from "react-router";
import { lobbyGameStateService } from "../services/lobbyGameStateService";
import { betService } from "../services/betService";
import { WheelSpinner } from "../components/WheelSpinner";
import { FairnessModal } from "../components/FairnessModal";
import { fairnessService, type FairnessData } from "../services/gameMatchmakingService";
import { appLifecycleService } from "../services/appLifecycleService";
import { useIdentity } from "../contexts/IdentityContext";

// ── Constants ──────────────────────────────────────────────────────────────────

const LOBBY_CONFIG: Record<string, { minBet: number; maxBet: number }> = {
  A: { minBet: 1,    maxBet: 20    },
  B: { minBet: 21,   maxBet: 100   },
  C: { minBet: 101,  maxBet: 1000  },
  D: { minBet: 1001, maxBet: 5000  },
};

// ── Backend helpers ────────────────────────────────────────────────────────────

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

function getToken(): string | null {
  return localStorage.getItem("bitzimi_access_token");
}

function useBackend(): boolean {
  return !!(API_BASE && getToken());
}

/** Map backend lobby state → the ServerGameState-compatible shape the UI needs. */
function toDisplayState(data: any) {
  const phaseMap: Record<string, string> = {
    waiting: "WAITING",
    spinning: "SPINNING",
    result:  "RESULT",
  };
  return {
    state:            phaseMap[data.phase] ?? "WAITING",
    roundNumber:      data.roundNumber as number,
    dailyRoundNumber: (data.dailyRoundNumber ?? data.roundNumber) as number,
    roundId:          (data.roundId ?? null) as string | null,
    serverSeedHash:   (data.serverSeedHash ?? null) as string | null,
    timeRemaining:    data.timeRemaining as number,
    winner:           (data.result ?? null) as "red" | "blue" | null,
    redTeam:     { players: data.redPlayers  ?? 0, totalAmount: data.redTotal  ?? 0 },
    blueTeam:    { players: data.bluePlayers ?? 0, totalAmount: data.blueTotal ?? 0 },
    history:     (data.history ?? [])
      .filter((h: any) => h.result)
      .map((h: any) => ({ roundNumber: h.roundNumber, winner: h.result, timestamp: new Date(h.timestamp).getTime() })),
    currentRoundBets: data.currentBets ?? [],
    voided: data.voided ?? false,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ColorGame() {
  const { lobbyId = "A" } = useParams();
  const lid      = lobbyId.toUpperCase();
  const navigate = useNavigate();

  // Wallet — all balance changes happen on the backend.
  // refreshWalletsFromBackend() is called after each backend mutation.
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { formatCurrency, convertToUSD, currency } = useSettings();
  const { identity } = useIdentity();
  const myUsername = identity.username;

  const lobbyInfo       = LOBBY_CONFIG[lid];
  const minBet          = lobbyInfo?.minBet ?? 1;
  const maxBet          = lobbyInfo?.maxBet ?? 20;
  const minBetLocal     = minBet * currency.rate;
  const maxBetLocal     = maxBet * currency.rate;

  // ── State ──────────────────────────────────────────────────────────────────
  const [gameState,       setGameState]       = useState<ReturnType<typeof toDisplayState> | null>(null);
  const [currentRoundBet, setCurrentRoundBet] = useState<{ team: "red"|"blue"; amount: number } | null>(null);
  const [betAmount,       setBetAmount]       = useState("");
  const [betError,        setBetError]        = useState<string | null>(null);
  const [placingBet,      setPlacingBet]      = useState(false);
  const [showRules,       setShowRules]       = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showFairness,    setShowFairness]    = useState(false);
  const [resultData,      setResultData]      = useState<{
    won: boolean; amount: number; payout?: number; team?: string; winner?: string;
  } | null>(null);
  const [betHistory,    setBetHistory]    = useState<any[]>([]);
  const [activeTab,     setActiveTab]     = useState<"your"|"recent">("your");
  const [lifecycleSync, setLifecycleSync] = useState(0);
  const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);

  const processedRound = useRef<number | null>(null);
  const resultDataRef  = useRef<typeof resultData>(null);
  const prevPhase      = useRef<string | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── App lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = appLifecycleService.onResume(() => setLifecycleSync(n => n + 1));
    return () => unsub();
  }, []);

  // ── Process a backend snapshot ─────────────────────────────────────────────
  const handleSnapshot = (data: any) => {
    const s = toDisplayState(data);
    setGameState(s);

    const phase = data.phase as string;

    // New round: reset result/bet state
    if (phase === "waiting") {
      if (processedRound.current !== null && data.roundNumber > processedRound.current) {
        processedRound.current = null;
        setShowResultModal(false);
        setResultData(null);
        resultDataRef.current = null;
        setCurrentRoundBet(null);
        setFairnessData(null);
        try { localStorage.removeItem(`colorGame_participation_${lid}`); } catch {}
      }
    }

    // Sync user's current bet from backend
    if (data.myBet) {
      setCurrentRoundBet({ team: data.myBet.team, amount: data.myBet.amount });
    } else if (phase === "waiting" && processedRound.current === null) {
      setCurrentRoundBet(null);
    }

    // SPINNING → RESULT: backend settled, refresh wallet display
    if (prevPhase.current === "spinning" && phase === "result") {
      refreshWalletsFromBackend().catch(() => {});
    }
    prevPhase.current = phase;

    // Show result modal once per round
    if (phase === "result" && processedRound.current !== data.roundNumber) {
      processedRound.current = data.roundNumber;
      if (data.roundId) {
        fairnessService.getRoundFairness(data.roundId).then(setFairnessData).catch(() => {});
      }

      let rd: typeof resultData;
      if (data.voided) {
        rd = { won: false, amount: 0, payout: 0, team: "", winner: "void" };
      } else if (data.myBet) {
        const won    = data.myBet.outcome === "win";
        const payout = data.myBet.payout ?? 0;
        rd = { won, amount: data.myBet.amount, payout, team: data.myBet.team, winner: data.result };
      } else {
        rd = null;
      }

      setResultData(rd);
      resultDataRef.current = rd;
      setTimeout(() => setShowResultModal(true), 500);
    }
  };

  // ── Backend polling (primary: when VITE_API_URL + JWT present) ───────────
  useEffect(() => {
    if (!useBackend()) return;

    const token = getToken()!;
    const poll  = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/games/color/lobbies/${lid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) handleSnapshot((await res.json()).data);
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [lid]); // eslint-disable-line react-hooks/exhaustive-deps

  // No offline fallback — game requires backend connectivity.
  // If backend is unavailable, the polling useEffect above silently fails and
  // gameState stays null, showing the "Connecting to game server..." loading state.

  // ── Bet history ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = betService.subscribe((bets: any[]) => setBetHistory(bets));
    return () => unsub();
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateBet = (value: string) => {
    setBetError(null);
    if (!value?.trim()) return;
    const amt = parseFloat(value);
    if (isNaN(amt) || amt <= 0) { setBetError("Please enter a valid amount"); return; }
    const usd = convertToUSD(amt);
    if (usd < minBet) { setBetError(`Minimum bet is ${formatCurrency(minBet)}`); return; }
    if (usd > maxBet) { setBetError(`Maximum bet is ${formatCurrency(maxBet)}`); return; }
  };

  const isBetValid = () => {
    if (!betAmount?.trim() || betError) return false;
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt <= 0) return false;
    const usd = convertToUSD(amt);
    return usd >= minBet && usd <= maxBet;
  };

  // ── Place bet ──────────────────────────────────────────────────────────────
  const handleBet = async (team: "red" | "blue") => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) { setBetError("Please enter a valid amount"); return; }
    const amountInUSD = convertToUSD(amount);
    if (amountInUSD > maxBet) { setBetError(`Maximum bet is ${formatCurrency(maxBet)}`); return; }
    if (!gameState || gameState.state !== "WAITING") { setBetError("Betting closed for this round"); return; }
    if (currentRoundBet) { setBetError("You already placed a bet for this round"); return; }

    if (useBackend()) {
      // ── Backend path (production) ─────────────────────────────────────────
      // Backend atomically validates, deducts game wallet, and records bet.
      if (amountInUSD > balances.game) { setBetError("Insufficient balance"); return; }

      setPlacingBet(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/games/color/bets`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ lobbyId: lid, team, amount: amountInUSD }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setBetError((err as any)?.error?.message ?? (err as any)?.message ?? "Failed to place bet");
          return;
        }

        // Backend deducted wallet — refresh display balance
        refreshWalletsFromBackend().catch(() => {});
        setCurrentRoundBet({ team, amount: amountInUSD });

        // Persist for reload resilience
        try {
          localStorage.setItem(`colorGame_participation_${lid}`, JSON.stringify({
            roundNumber: gameState.roundNumber, team, amount: amountInUSD, lobbyId: lid,
          }));
        } catch {}

        toast.success(`Placed ${formatCurrency(amountInUSD)} on ${team.toUpperCase()}`);
        setBetAmount("");
      } catch {
        setBetError("Failed to place bet. Please try again.");
      } finally {
        setPlacingBet(false);
      }
    } else {
      // Backend not configured — game requires a live server connection.
      setBetError("Game server unavailable. Please log in and ensure the server is running.");
    }
  };

  // ── Quick amounts ──────────────────────────────────────────────────────────
  const getQuickAmounts = () => {
    if (!lobbyInfo) return [1, 5, 10];
    const { minBet: lo, maxBet: hi } = lobbyInfo;
    if (lo === 1    && hi === 20)   return [1, 6, 13];
    if (lo === 21   && hi === 100)  return [21, 40, 70];
    if (lo === 101  && hi === 1000) return [101, 350, 700];
    if (lo === 1001 && hi === 5000) return [1001, 2000, 3500];
    const r = hi - lo;
    return [Math.floor(lo), Math.floor(lo + r * 0.33), Math.floor(lo + r * 0.66)].filter((v, i, a) => a.indexOf(v) === i);
  };
  const quickAmounts   = getQuickAmounts();
  const useSlider      = ["NGN","CNY","INR","ZAR","KES"].includes(currency.code);
  const amountTextSize = useSlider ? "text-xs md:text-base lg:text-lg" : "text-base md:text-lg lg:text-xl";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Connecting to game server...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  const totalPool       = gameState.redTeam.totalAmount + gameState.blueTeam.totalAmount;
  const platformFee     = totalPool * 0.1;
  const isBettingClosed = gameState.state !== "WAITING" || currentRoundBet !== null;
  const isSpinning      = gameState.state === "SPINNING";

  return (
    <ResponsiveLayout>
      {/* Back */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/game/lobby-selection")} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Lobbies
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg md:text-2xl font-semibold">Red vs Blue Game</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">LIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm md:text-base text-gray-600">Round #{gameState.dailyRoundNumber ?? gameState.roundNumber} <span className="text-xs text-gray-400">today</span></p>
              <Badge variant={gameState.state === "WAITING" ? "default" : "secondary"} className="uppercase">
                {gameState.state}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowRules(true)}>
            <Info className="mr-2 h-4 w-4" />Rules
          </Button>
        </div>
      </div>

      {/* Balance */}
      <Card className="mb-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Game Wallet</p>
              <p className="text-2xl font-bold">{formatCurrency(balances.game)}</p>
            </div>
            <DollarSign className="h-10 w-10 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Live bet confirmation */}
      {currentRoundBet && gameState.state === "WAITING" && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            You placed <strong>{formatCurrency(currentRoundBet.amount)}</strong> on{" "}
            <strong className={currentRoundBet.team === "red" ? "text-red-600" : "text-blue-600"}>
              {currentRoundBet.team.toUpperCase()}
            </strong>{" "}
            for Round #{gameState.roundNumber}
          </AlertDescription>
        </Alert>
      )}

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(["red","blue"] as const).map(team => {
          const info   = team === "red" ? gameState.redTeam : gameState.blueTeam;
          const colors = team === "red"
            ? { border:"border-red-300", bg:"from-red-50 to-red-100", icon:"text-red-600", text:"text-red-700", title:"text-red-600" }
            : { border:"border-blue-300", bg:"from-blue-50 to-blue-100", icon:"text-blue-600", text:"text-blue-700", title:"text-blue-600" };
          return (
            <motion.div key={team} whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
              <Card className={`${colors.border} bg-gradient-to-br ${colors.bg} overflow-hidden relative`}>
                <div className={`absolute inset-0 bg-${team}-500 opacity-5`} />
                <CardHeader className="pb-3">
                  <CardTitle className={`${colors.title} text-lg md:text-xl`}>{team.toUpperCase()}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className={`h-4 w-4 ${colors.icon} flex-shrink-0`} />
                    <span className="font-medium text-gray-900 dark:text-black">{info.players} players</span>
                  </div>
                  <span className={`${amountTextSize} font-bold ${colors.text} break-words block`}>
                    {formatCurrency(info.totalAmount)}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Spinner / Timer */}
      <Card className="mb-4">
        <CardContent className="py-6">
          <div className="text-center space-y-6">
            {gameState.state === "WAITING" && gameState.timeRemaining <= 10 && gameState.timeRemaining > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: [1, 0.5, 1], scale: 1 }}
                transition={{ opacity: { repeat: Infinity, duration: 0.8 } }}
                className="text-xl font-bold text-amber-600"
              >
                ⚠️ Bet Closing Soon!
              </motion.div>
            )}
            {(gameState.state === "SPINNING" || (gameState.state === "WAITING" && gameState.timeRemaining === 0)) && (
              <div className="text-xl font-bold text-purple-600">🔒 Bet Closed</div>
            )}
            {gameState.state === "SPINNING" && (
              <p className="text-xl font-bold text-gray-700 animate-pulse">Spinning...</p>
            )}
            <div className="py-4">
              <WheelSpinner
                key={`${gameState.roundNumber}-${gameState.state}-${lifecycleSync}`}
                isSpinning={isSpinning}
                winner={gameState.winner}
                timeRemaining={gameState.timeRemaining}
                gameState={gameState.state}
                roundNumber={gameState.roundNumber}
              />
            </div>
            <AnimatePresence>
              {gameState.state === "RESULT" && gameState.winner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className={`text-3xl md:text-4xl font-bold ${gameState.winner === "red" ? "text-red-600" : "text-blue-600"}`}
                >
                  {gameState.winner === "red" ? "🔴 Red Wins!" : "🔵 Blue Wins!"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Pool */}
      <Card className="mb-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
        <CardContent className="py-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Total Pool</p>
            <p className="text-3xl font-bold text-yellow-700 mb-2">{formatCurrency(totalPool)}</p>
            <p className="text-xs text-gray-500">10% platform fee: {formatCurrency(platformFee)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Bet panel */}
      <Card className="mb-4">
        <CardHeader><CardTitle>Place Your Bet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="number"
              placeholder={`Enter amount (${formatCurrency(minBet)} - ${formatCurrency(maxBet)})`}
              value={betAmount}
              onChange={e => { setBetAmount(e.target.value); validateBet(e.target.value); }}
              disabled={isBettingClosed || placingBet}
              className={`h-12 text-lg ${betError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {betError && <p className="text-sm text-red-600 font-medium">{betError}</p>}
          </div>

          {!useSlider ? (
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map(a => (
                <Button key={a} variant="outline" size="sm" disabled={isBettingClosed || placingBet}
                  onClick={() => { const v = (a * currency.rate).toString(); setBetAmount(v); validateBet(v); }}
                  className="h-10">{formatCurrency(a)}</Button>
              ))}
              <Button variant="outline" size="sm" disabled={isBettingClosed || placingBet}
                onClick={() => { const v = (maxBet * currency.rate).toString(); setBetAmount(v); validateBet(v); }}
                className="h-10 font-semibold">Max</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <input type="range"
                min={Math.floor(minBetLocal)} max={Math.floor(maxBetLocal)}
                step={Math.max(1, Math.floor((maxBetLocal - minBetLocal) / 100))}
                value={betAmount || Math.floor(minBetLocal)}
                onChange={e => { const v = e.target.value; setBetAmount(v); validateBet(v); }}
                disabled={isBettingClosed || placingBet}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Min: {currency.symbol}{Math.floor(minBetLocal).toLocaleString()}</span>
                <span>Max: {currency.symbol}{Math.floor(maxBetLocal).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => handleBet("red")}
              disabled={isBettingClosed || !betAmount || !isBetValid() || placingBet}
              className="h-12 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed">
              {currentRoundBet ? "Bet Placed" : placingBet ? "Placing..." : "Bet on Red"}
            </Button>
            <Button onClick={() => handleBet("blue")}
              disabled={isBettingClosed || !betAmount || !isBetValid() || placingBet}
              className="h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed">
              {currentRoundBet ? "Bet Placed" : placingBet ? "Placing..." : "Bet on Blue"}
            </Button>
          </div>

          {currentRoundBet && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">Bet locked for this round. Wait for results!</AlertDescription>
            </Alert>
          )}
          {gameState.state !== "WAITING" && !currentRoundBet && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {gameState.state === "SPINNING" ? "Determining winner..." : "Showing results..."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Round history */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Previous Results</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowFairness(true)} className="flex items-center gap-2">
              <Shield className="h-4 w-4" />Verify Fairness
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {gameState.history.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {gameState.history.map((r: any) => (
                <div key={`${r.roundNumber}-${r.timestamp}`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs ${r.winner === "red" ? "bg-red-500" : "bg-blue-500"}`}
                  title={`Round ${r.roundNumber} — ${r.winner?.toUpperCase()} won`}
                >
                  {r.roundNumber}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No previous results yet</p>
          )}
        </CardContent>
      </Card>

      {/* Bet history tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex border-b">
            {(["your","recent"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"
                }`}>
                {tab === "your" ? "Your Bet History" : "Recent Bets"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "your" ? (
            betHistory.filter((b: any) => b.lobbyId === lid).length > 0 ? (
              <div className="space-y-2">
                {betHistory.filter((b: any) => b.lobbyId === lid).map((bet: any) => (
                  <div key={bet.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${bet.team === "red" ? "bg-red-500" : "bg-blue-500"}`} />
                      <div>
                        <p className="font-medium">Round #{bet.roundNumber}</p>
                        <p className="text-sm text-gray-600">{formatCurrency(bet.amount)} on {bet.team?.toUpperCase()}</p>
                        <p className="text-xs text-gray-500">{new Date(bet.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {bet.result === "win" ? (
                        <div className="flex items-center gap-2">
                          <div><p className="text-sm font-medium text-green-600">WON</p>
                            <p className="text-xs text-green-600">+{formatCurrency(bet.payout || 0)}</p></div>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      ) : bet.result === "loss" ? (
                        <div className="flex items-center gap-2">
                          <div><p className="text-sm font-medium text-red-600">LOST</p>
                            <p className="text-xs text-red-600">-{formatCurrency(bet.amount)}</p></div>
                          <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No bets placed in this lobby yet</p>
            )
          ) : (
            <div>
              <div className="mb-3 text-center">
                <Badge variant="outline" className="text-xs">Round #{gameState.roundNumber} — Live Feed</Badge>
              </div>
              {gameState.currentRoundBets.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gameState.currentRoundBets.map((bet: any) => (
                    <div key={bet.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="flex-1 text-left"><p className="font-medium text-sm">{bet.username}</p></div>
                      <div className="flex-1 text-center"><p className="font-semibold text-sm">{formatCurrency(bet.amount)}</p></div>
                      <div className="flex-1 text-right">
                        <p className={`font-bold text-sm uppercase ${bet.team === "red" ? "text-red-600" : "text-blue-600"}`}>{bet.team}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No bets placed this round yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Modal */}
      <Dialog open={showResultModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" hideClose>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}>
                {resultDataRef.current?.winner === "void" ? (
                  <span className="text-amber-500">⚠️ ROUND VOID</span>
                ) : gameState.winner === "red" ? (
                  <span className="text-red-600">🔴 RED WINS! 🔴</span>
                ) : gameState.winner === "blue" ? (
                  <span className="text-blue-600">🔵 BLUE WINS! 🔵</span>
                ) : null}
              </motion.div>
            </DialogTitle>
            <DialogDescription className="sr-only">Round result</DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            {(() => {
              const result = resultDataRef.current ?? resultData;
              if (!result) return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <AlertCircle className="h-20 w-20 text-gray-400 mx-auto" />
                  <p className="text-xl text-gray-600">You didn&apos;t place a bet this round</p>
                  <p className="text-sm text-gray-500">Join the next round to play!</p>
                </motion.div>
              );

              if (result.winner === "void") return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="text-5xl">⚠️</div>
                  <div className="text-xl font-bold text-amber-500">Round Voided</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Only one side had bets. Your stake has been fully refunded — no winner, no loser, no fee.
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">100% Stake Returned</div>
                </motion.div>
              );

              const sc = result.team?.toUpperCase() ?? "UNKNOWN";
              const wc = result.winner?.toUpperCase() ?? "UNKNOWN";

              return result.won ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <CheckCircle className="h-20 w-20 text-green-600 mx-auto" />
                  <p className="text-2xl font-bold text-green-600">YOU WON!</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-gray-600">You picked:{" "}
                      <span className={`font-bold ${sc === "RED" ? "text-red-600" : "text-blue-600"}`}>{sc === "RED" ? "🔴" : "🔵"} {sc}</span>
                    </p>
                    <p className="text-sm text-gray-600">Winner:{" "}
                      <span className={`font-bold ${wc === "RED" ? "text-red-600" : "text-blue-600"}`}>{wc === "RED" ? "🔴" : "🔵"} {wc}</span>
                    </p>
                    <div className="border-t border-green-300 pt-2 mt-2">
                      <p className="text-lg font-semibold text-green-700">+{formatCurrency(result.payout || 0)}</p>
                      <p className="text-sm text-gray-600 mt-1">Bet: {formatCurrency(result.amount)}</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <XCircle className="h-20 w-20 text-red-600 mx-auto" />
                  <p className="text-2xl font-bold text-red-600">YOU LOST</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-gray-600">You picked:{" "}
                      <span className={`font-bold ${sc === "RED" ? "text-red-600" : "text-blue-600"}`}>{sc === "RED" ? "🔴" : "🔵"} {sc}</span>
                    </p>
                    <p className="text-sm text-gray-600">Winner:{" "}
                      <span className={`font-bold ${wc === "RED" ? "text-red-600" : "text-blue-600"}`}>{wc === "RED" ? "🔴" : "🔵"} {wc}</span>
                    </p>
                    <div className="border-t border-red-300 pt-2 mt-2">
                      <p className="text-lg font-semibold text-red-700">-{formatCurrency(result.amount)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Next round starting soon...</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rules Modal */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Game Rules</DialogTitle>
            <DialogDescription>Learn how to play Red vs Blue</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>• This is a <strong>synchronized multiplayer game</strong></p>
            <p>• Choose either <strong className="text-red-600">Red</strong> or <strong className="text-blue-600">Blue</strong> to bet on</p>
            <p>• Place your bet before the countdown ends (during WAITING state)</p>
            <p>• When timer reaches zero, the wheel spins for <strong>6 seconds</strong></p>
            <p>• Winner is determined by <strong>true server-side randomness</strong> (50/50 chance)</p>
            <p>• The losing team&apos;s pool is distributed among winners proportionally</p>
            <p>• <strong>10% platform fee</strong> is deducted before distribution</p>
            <p className="text-amber-600 font-medium">⚠️ Only one bet per round allowed</p>
            <p className="text-blue-600 font-medium">💡 If only one side bets, the round is voided and stakes fully refunded</p>
          </div>
          <Button onClick={() => setShowRules(false)} className="w-full">Got it!</Button>
        </DialogContent>
      </Dialog>

      {/* Fairness Modal */}
      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        gameType="color_game"
        roundNumber={gameState.roundNumber}
        dailyRoundNumber={gameState.dailyRoundNumber}
        serverSeedHash={fairnessData?.serverSeedHash ?? gameState.serverSeedHash ?? ""}
        serverSeed={fairnessData?.serverSeed ?? null}
        clientSeed={fairnessData?.clientSeed ?? null}
        nonce={fairnessData?.nonce ?? null}
        result={gameState.winner}
      />
    </ResponsiveLayout>
  );
}
