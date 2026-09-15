/**
 * Reaction Tap Game Room — fully backend-authoritative.
 *
 * Flow:
 *   1. Join matchmaking queue → backend creates match, deducts both stakes atomically.
 *   2. Both players call signalReady() → backend sets signalSentAt with a random delay.
 *   3. Frontend waits until signalSentAt, then shows the TAP NOW signal.
 *   4. Player taps → tapMs = Date.now() - signalSentAt (negative if early tap).
 *   5. submitTap(matchId, tapMs) → backend receives and, when both taps in, settles.
 *   6. Frontend polls getMatch() until status === "settled" or "cancelled".
 *   7. refreshWalletsFromBackend() syncs the displayed balance from the server.
 *
 * No wallet mutations on the frontend. No local winner determination.
 * No simulated opponents. Backend is the sole source of truth.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
import { useIdentity } from "../contexts/IdentityContext";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { ReactionTapGameHistory, addReactionTapGameToHistory } from "../components/ReactionTapGameHistory";
import { gameMatchmakingService, type MatchResult } from "../services/gameMatchmakingService";

// ── Game state machine ─────────────────────────────────────────────────────────
type GameState =
  | "searching"       // in matchmaking queue
  | "matched"         // opponent found, about to signal ready
  | "signaling"       // called signalReady(), waiting for opponent to be ready too
  | "waiting_signal"  // both ready — waiting for signalSentAt to pass
  | "signal_shown"    // TAP NOW visible
  | "submitted"       // tap submitted, waiting for backend to settle
  | "finished";       // match settled, showing result

// ── Component ──────────────────────────────────────────────────────────────────
export default function ReactionTapGameRoom() {
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const stakeAmount  = parseInt(searchParams.get("stake") || "1");
  const privateMatchId = searchParams.get("matchId");
  const roomCode = searchParams.get("roomCode");

  const { formatCurrencyNoDecimals } = useSettings();
  // Wallet — backend controls all balance changes.
  // refreshWalletsFromBackend() is called after settlement.
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult }  = useGameStats();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const myUsername   = identity.username;

  // ── Core game state ──────────────────────────────────────────────────────────
  const [gameState,        setGameState]        = useState<GameState>("searching");
  const [opponentName,     setOpponentName]     = useState("");
  const [opponentAvatar,   setOpponentAvatar]   = useState("P");
  const [queueId,          setQueueId]          = useState<string | null>(null);
  const [matchId,          setMatchId]          = useState<string | null>(null);

  // ── Countdown UI state (5…4…3…2…1 before "WAIT...") ───────────────────────
  const [countdownValue,   setCountdownValue]   = useState(5);

  // ── Tap timing state ─────────────────────────────────────────────────────────
  const [tappedEarly,      setTappedEarly]      = useState(false);
  const [yourTapTime,      setYourTapTime]      = useState<number | null>(null);   // ms
  const [opponentTapTime,  setOpponentTapTime]  = useState<number | null>(null);  // ms from backend
  const [liveReactionTime, setLiveReactionTime] = useState(0);

  // ── Result state (from backend) ───────────────────────────────────────────────
  const [isWinner,         setIsWinner]         = useState(false);
  const [winAmount,        setWinAmount]        = useState(0);
  const [platformFee,      setPlatformFee]      = useState(0);
  const [isVoided,         setIsVoided]         = useState(false);
  const [showResultPopup,  setShowResultPopup]  = useState(false);
  const [historyKey,       setHistoryKey]       = useState(0);
  const [walletAnimation,  setWalletAnimation]  = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const signalSentAtRef  = useRef<number | null>(null); // unix ms from server
  const liveTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId        = useRef<string>(`s_${Date.now()}`);
  const gameEndedRef     = useRef(false);
  const matchIdRef       = useRef<string | null>(null); // stays current inside intervals
  const isPlayer1Ref     = useRef<boolean>(false);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const stopAllTimers = useCallback(() => {
    if (liveTimerRef.current)  { clearInterval(liveTimerRef.current);  liveTimerRef.current  = null; }
    if (pollRef.current)       { clearInterval(pollRef.current);       pollRef.current       = null; }
    if (countdownRef.current)  { clearInterval(countdownRef.current);  countdownRef.current  = null; }
    if (signalTimerRef.current){ clearTimeout(signalTimerRef.current); signalTimerRef.current = null; }
  }, []);

  const formatTime = (ms: number | null) => {
    if (ms === null) return "—";
    if (ms < 0) return "EARLY";
    return (ms / 1000).toFixed(3) + "s";
  };

  // ── Phase: show signal ────────────────────────────────────────────────────────
  const showSignal = useCallback((sid: string) => {
    if (sessionId.current !== sid) return;
    signalSentAtRef.current = Date.now();
    setGameState("signal_shown");

    liveTimerRef.current = setInterval(() => {
      if (sessionId.current !== sid) { clearInterval(liveTimerRef.current!); return; }
      if (signalSentAtRef.current) setLiveReactionTime(Date.now() - signalSentAtRef.current);
    }, 10);
  }, []);

  // ── Phase: "WAIT..." with server-timed signal ─────────────────────────────────
  const startWaitingPhase = useCallback((sid: string, serverSignalSentAt: number) => {
    if (sessionId.current !== sid) return;
    setGameState("waiting_signal");
    signalSentAtRef.current = serverSignalSentAt;

    const msUntilSignal = serverSignalSentAt - Date.now();
    if (msUntilSignal <= 0) {
      showSignal(sid);
    } else {
      signalTimerRef.current = setTimeout(() => showSignal(sid), msUntilSignal);
    }
  }, [showSignal]);

  // ── Phase: 5-second countdown after match found ───────────────────────────────
  const startCountdown = useCallback((sid: string, mid: string, p1: boolean) => {
    if (sessionId.current !== sid) return;
    matchIdRef.current  = mid;
    isPlayer1Ref.current = p1;
    setGameState("countdown");
    setCountdownValue(5);

    let count = 5;
    countdownRef.current = setInterval(() => {
      if (sessionId.current !== sid) { clearInterval(countdownRef.current!); return; }
      count--;
      setCountdownValue(count);
      if (count === 0) {
        clearInterval(countdownRef.current!);
        startSignalingPhase(sid, mid);
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase: call signalReady(), poll until signalSentAt is set ─────────────────
  const startSignalingPhase = useCallback(async (sid: string, mid: string) => {
    if (sessionId.current !== sid) return;
    setGameState("signaling");
    try {
      const res = await gameMatchmakingService.signalReady(mid);
      if (sessionId.current !== sid) return;

      if (res.signalSentAt) {
        // Both players were ready simultaneously — signal time returned directly
        startWaitingPhase(sid, new Date(res.signalSentAt).getTime());
        return;
      }
    } catch { /* non-fatal: opponent may not have called ready yet */ }

    // Other player not ready yet — poll match until signalSentAt is set
    pollRef.current = setInterval(async () => {
      if (sessionId.current !== sid) { clearInterval(pollRef.current!); return; }
      try {
        const match = await gameMatchmakingService.getMatch(mid);
        if (sessionId.current !== sid) return;

        if (match.signalSentAt) {
          clearInterval(pollRef.current!);
          startWaitingPhase(sid, new Date(match.signalSentAt).getTime());
          return;
        }
        if (match.status !== "active") {
          // Match was cancelled before both ready
          clearInterval(pollRef.current!);
          toast.error("Match cancelled. Returning to lobby.");
          navigate("/game/reaction-tap");
        }
      } catch { /* keep polling */ }
    }, 500);
  }, [navigate, startWaitingPhase]);

  // ── Phase: poll for settlement after tap submitted ─────────────────────────────
  const pollForResult = useCallback((sid: string, mid: string) => {
    if (sessionId.current !== sid) return;
    setGameState("submitted");

    pollRef.current = setInterval(async () => {
      if (sessionId.current !== sid) { clearInterval(pollRef.current!); return; }
      try {
        const match = await gameMatchmakingService.getMatch(mid);
        if (sessionId.current !== sid) return;

        if (match.status === "settled" || match.status === "cancelled") {
          clearInterval(pollRef.current!);
          handleMatchResult(sid, match);
        }
      } catch { /* keep polling */ }
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply settled match result ─────────────────────────────────────────────────
  const handleMatchResult = useCallback((sid: string, match: MatchResult) => {
    if (sessionId.current !== sid || gameEndedRef.current) return;
    gameEndedRef.current = true;
    stopAllTimers();

    const voided     = match.status === "cancelled";
    const won        = !voided && match.youWon;
    const totalPool  = stakeAmount * 2;
    const fee        = Math.floor(totalPool * 0.10);
    const payout     = totalPool - fee;

    setIsWinner(won);
    setIsVoided(voided);
    setWinAmount(payout);
    setPlatformFee(fee);

    // Extract reaction times from backend result
    if (match.result && !voided) {
      const isP1  = match.isPlayer1 ?? (match as any).isPlayer1;
      const myMs  = isP1 ? match.result.p1TapMs : match.result.p2TapMs;
      const oppMs = isP1 ? match.result.p2TapMs : match.result.p1TapMs;

      if (typeof myMs === "number")  setYourTapTime(myMs);
      if (typeof oppMs === "number") setOpponentTapTime(oppMs);

      // Was my tap an early tap? (negative tapMs)
      if (typeof myMs === "number" && myMs < 0) setTappedEarly(true);
    }

    // Sync wallet from backend — backend settled atomically
    refreshWalletsFromBackend().then(() => {
      setWalletAnimation(true);
      setTimeout(() => setWalletAnimation(false), 1000);
    }).catch(() => {});

    // Local game stats (display only — backend records in game_stats table)
    addGameResult({
      gameType:  "reaction_tap",
      betAmount: stakeAmount,
      winAmount: won ? payout : 0,
      profit:    won ? payout - stakeAmount : -stakeAmount,
      won,
      opponent:  opponentName,
    });

    // Game history for sidebar display
    addReactionTapGameToHistory({
      stake:               stakeAmount,
      result:              voided ? "loss" : won ? "win" : "loss",
      opponentName,
      yourReactionTime:    match.result ? (match.isPlayer1 ? match.result.p1TapMs : match.result.p2TapMs) : null,
      opponentReactionTime: match.result ? (match.isPlayer1 ? match.result.p2TapMs : match.result.p1TapMs) : null,
      tappedEarly:         !!(match.result && ((match.isPlayer1 ? match.result.p1TapMs : match.result.p2TapMs) < 0)),
      winnings:            won ? payout : 0,
    });

    // Notification + live activity
    if (voided) {
      addNotification("system_alert", "Round Voided", "Both players tapped early. Stakes refunded.", { game: "reaction_tap" });
    } else if (won) {
      addNotification("game_win", "🎉 Victory!",
        `Reaction Tap: Won ${formatCurrencyNoDecimals(payout)} vs ${opponentAvatar} ${opponentName}`,
        { game: "reaction_tap", stake: stakeAmount, payout, opponent: opponentName });
      liveActivityService.addActivity("game_win", myUsername, "won in Reaction Tap", payout);
      toast.success(`${myUsername} won ${formatCurrencyNoDecimals(payout)}!`);
    } else {
      addNotification("game_loss", "You Lost",
        `Reaction Tap: Lost ${formatCurrencyNoDecimals(stakeAmount)} vs ${opponentAvatar} ${opponentName}`,
        { game: "reaction_tap", stake: stakeAmount, opponent: opponentName });
      toast.error(`${myUsername} lost this round`);
    }

    setGameState("finished");
    setTimeout(() => {
      setShowResultPopup(true);
      setHistoryKey(k => k + 1);
    }, 500);
  }, [stakeAmount, opponentName, opponentAvatar, myUsername, refreshWalletsFromBackend, addGameResult, addNotification, formatCurrencyNoDecimals, stopAllTimers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enter matchmaking queue ────────────────────────────────────────────────────
  const enterQueue = useCallback(async (sid: string) => {
    try {
      // Private match: skip queue, load pre-created match directly
      if (privateMatchId) {
        const match = await gameMatchmakingService.getMatch(privateMatchId);
        if (sessionId.current !== sid) return;
        setMatchId(privateMatchId);
        setOpponentName(match.opponent.username);
        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
        setGameState("matched");
        setTimeout(() => startCountdown(sid, privateMatchId, match.isPlayer1 ?? true), 2000);
        return;
      }

      const res = await gameMatchmakingService.joinQueue("reaction_tap", stakeAmount);
      if (sessionId.current !== sid) return;

      if (res.status === "matched" && res.matchId) {
        const match = await gameMatchmakingService.getMatch(res.matchId);
        if (sessionId.current !== sid) return;
        setMatchId(res.matchId);
        setOpponentName(match.opponent.username);
        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
        setGameState("matched");
        setTimeout(() => startCountdown(sid, res.matchId!, match.isPlayer1 ?? true), 2000);
        return;
      }

      if (res.queueId) {
        setQueueId(res.queueId);
        pollRef.current = setInterval(async () => {
          if (sessionId.current !== sid) { clearInterval(pollRef.current!); return; }
          try {
            const status = await gameMatchmakingService.pollQueue(res.queueId!);
            if (sessionId.current !== sid) return;
            if (status.status === "matched" && status.matchId) {
              clearInterval(pollRef.current!);
              const match = await gameMatchmakingService.getMatch(status.matchId);
              if (sessionId.current !== sid) return;
              setMatchId(status.matchId);
              setOpponentName(match.opponent.username);
              setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
              setGameState("matched");
              setTimeout(() => startCountdown(sid, status.matchId!, match.isPlayer1 ?? true), 2000);
            } else if (status.status === "cancelled") {
              clearInterval(pollRef.current!);
              navigate("/game/reaction-tap");
            }
          } catch { /* keep polling */ }
        }, 2000);
      }
    } catch { navigate("/game/reaction-tap"); }
  }, [stakeAmount, navigate, startCountdown, privateMatchId]);

  // ── Mount: balance check + enter queue ────────────────────────────────────────
  useEffect(() => {
    if (balances.game < stakeAmount) {
      toast.error("Insufficient balance in Game Wallet");
      navigate("/game/reaction-tap");
      return;
    }
    // Backend deducts stakes when match is created — no local decrementBalance
    const sid = sessionId.current;
    enterQueue(sid);
    return () => stopAllTimers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle tap ─────────────────────────────────────────────────────────────────
  const handleTap = useCallback(async () => {
    const sid = sessionId.current;
    const mid = matchIdRef.current;
    if (!mid || gameEndedRef.current) return;

    const now             = Date.now();
    const signalAt        = signalSentAtRef.current;
    const tapMs           = signalAt !== null ? now - signalAt : -1;
    const isEarly         = gameState === "waiting_signal" || tapMs < 0;

    if (gameState === "signal_shown" || isEarly) {
      // Stop live timer immediately for responsive UI
      if (liveTimerRef.current) { clearInterval(liveTimerRef.current); liveTimerRef.current = null; }
      if (signalTimerRef.current) { clearTimeout(signalTimerRef.current); signalTimerRef.current = null; }

      const finalTapMs = isEarly ? -1 : tapMs;
      if (isEarly) setTappedEarly(true);
      if (!isEarly) setYourTapTime(tapMs);

      try {
        await gameMatchmakingService.submitTap(mid, finalTapMs);
        pollForResult(sid, mid);
      } catch (err: any) {
        if (err?.code === "SIGNAL_NOT_SENT") {
          // Race: signal not set server-side yet — treat as early tap
          setTappedEarly(true);
          try {
            await gameMatchmakingService.submitTap(mid, -1);
            pollForResult(sid, mid);
          } catch { /* ignore */ }
        }
        // Other errors: still poll for result (backend may have settled)
        pollForResult(sid, mid);
      }
    }
  }, [gameState, pollForResult]);


  const handleExit = useCallback(() => {
    stopAllTimers();
    if (roomCode) navigate(`/game/reaction-tap/private?roomCode=${roomCode}&stake=${stakeAmount}`);
    else navigate("/game/reaction-tap");
  }, [navigate, stopAllTimers, roomCode, stakeAmount]);

  // ── Derived display values ─────────────────────────────────────────────────────
  const winnerPayout    = stakeAmount * 2 * 0.9;
  const isTapDisabled   = gameState !== "signal_shown" && gameState !== "waiting_signal";
  const showLiveTimer   = gameState === "signal_shown" && yourTapTime === null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <ResponsiveLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={handleExit}
            className="mb-3 sm:mb-4 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4 mr-2" />Exit Room
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Reaction Arena</h1>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {formatCurrencyNoDecimals(stakeAmount)} Stake • First to tap wins
                </p>
              </div>
            </div>
            <Card className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 transition-all duration-300 ${walletAnimation ? "scale-105" : ""}`}>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mb-0.5">Game Wallet</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(balances.game)}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Main */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Stats bar */}
            <Card className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Prize Pool</p>
                    <p className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
                      {formatCurrencyNoDecimals(stakeAmount * 2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Your Stake</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(stakeAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Winner Gets</p>
                    <p className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                      {formatCurrencyNoDecimals(winnerPayout)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Searching */}
            {gameState === "searching" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-12 sm:p-16 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                  <div className="relative">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-6 animate-pulse">
                      <Clock className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Finding Opponent</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Matching you with a skilled competitor...</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Matched */}
            {gameState === "matched" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-8 sm:p-12">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5" />
                  <div className="relative">
                    <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
                      {/* You */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-white dark:border-gray-800 overflow-hidden">
                            <PlayerAvatar avatar={identity.avatar} />
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border-2 border-blue-500">
                            <p className="text-xs font-black text-blue-600 dark:text-blue-400">{myUsername}</p>
                          </div>
                        </div>
                        <div className="mt-3 px-4 py-1.5 bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-full border border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Ready</p>
                        </div>
                      </div>
                      {/* VS */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center border-4 border-white dark:border-gray-900">
                            <div className="text-xs sm:text-sm font-black text-gray-600 dark:text-gray-400 tracking-widest">VS</div>
                          </div>
                          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-gradient-to-br from-blue-400 to-red-400" style={{ animationDuration: "2s" }} />
                        </div>
                        <div className="px-3 py-1 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-md border border-gray-300 dark:border-gray-600">
                          <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Battle</p>
                        </div>
                      </div>
                      {/* Opponent */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center border-4 border-white dark:border-gray-800 overflow-hidden">
                            <PlayerAvatar avatar={opponentAvatar} />
                          </div>
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border-2 border-red-500 whitespace-nowrap">
                            <p className="text-xs font-black text-red-600 dark:text-red-400">{opponentName}</p>
                          </div>
                        </div>
                        <div className="mt-3 px-4 py-1.5 bg-gradient-to-r from-red-500/10 to-orange-600/10 rounded-full border border-red-200 dark:border-red-800">
                          <p className="text-xs font-bold text-red-700 dark:text-red-300">Ready</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-center bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-sm font-bold text-green-700 dark:text-green-300">Match Found • Starting Game</p>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Countdown */}
            {gameState === "countdown" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-8 sm:p-12">
                  <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-white dark:border-gray-900 overflow-hidden">
                        <PlayerAvatar avatar={identity.avatar} />
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{myUsername}</p>
                    </div>
                    <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">VS</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center border-2 border-white dark:border-gray-900 overflow-hidden">
                        <PlayerAvatar avatar={opponentAvatar} />
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{opponentName}</p>
                    </div>
                  </div>
                  <div className="text-center py-8 sm:py-12">
                    <p className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-6 uppercase tracking-widest">Get Ready</p>
                    <div className="relative text-[6rem] sm:text-[10rem] font-black bg-gradient-to-br from-yellow-400 to-amber-500 bg-clip-text text-transparent leading-none" key={countdownValue}>
                      {countdownValue}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Signaling / Waiting for signal */}
            {(gameState === "signaling" || gameState === "waiting_signal") && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-8 sm:p-12">
                  <div className="flex items-center justify-center gap-6 sm:gap-12 mb-8">
                    {[{ avatar: identity.avatar, name: myUsername, color: "blue" }, { avatar: opponentAvatar, name: opponentName, color: "red" }].map(({ avatar, name, color }) => (
                      <div key={name} className="flex flex-col items-center gap-2">
                        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-${color}-500 to-${color === "blue" ? "purple" : "orange"}-600 flex items-center justify-center text-2xl sm:text-3xl border-2 border-white dark:border-gray-900 overflow-hidden`}>
                          <PlayerAvatar avatar={avatar} />
                        </div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-center py-8 sm:py-12">
                    <p className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white mb-8">WAIT...</p>
                    <div className="max-w-md mx-auto bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-2 border-red-300 dark:border-red-700 rounded-xl p-5 sm:p-6">
                      <div className="flex items-center gap-3 justify-center mb-3">
                        <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                        <p className="text-base sm:text-lg font-black text-red-700 dark:text-red-200">Don&apos;t Tap Yet!</p>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-red-700 dark:text-red-200">Tapping early = instant loss</p>
                    </div>
                    {/* Allow early-tap detection */}
                    <button onClick={handleTap} className="mt-8 w-full h-16 rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 text-red-400 dark:text-red-600 text-sm font-semibold opacity-0 cursor-default" aria-label="tap area (not yet)" />
                  </div>
                </div>
              </Card>
            )}

            {/* Signal shown — TAP NOW */}
            {gameState === "signal_shown" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-6 sm:p-8">
                  <div className="flex items-center justify-center gap-6 sm:gap-12 mb-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl border-2 border-white dark:border-gray-900 overflow-hidden">
                        <PlayerAvatar avatar={identity.avatar} />
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{myUsername}</p>
                      {yourTapTime !== null && (
                        <div className="px-2 py-1 bg-blue-500/10 rounded-md">
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatTime(yourTapTime)}</p>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-400">VS</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-2xl border-2 border-white dark:border-gray-900 overflow-hidden">
                        <PlayerAvatar avatar={opponentAvatar} />
                      </div>
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{opponentName}</p>
                    </div>
                  </div>
                  <div className="py-4 sm:py-6">
                    <Button onClick={handleTap} disabled={yourTapTime !== null}
                      className="relative w-full h-24 sm:h-32 group disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-transparent border-0 p-0">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
                      <div className="relative z-10 flex flex-col items-center justify-center h-full">
                        <div className="text-4xl sm:text-6xl font-black text-white tracking-wider mb-2">TAP NOW</div>
                        <div className="flex items-center gap-2 opacity-90">
                          <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300" />
                          <p className="text-xs sm:text-sm font-bold text-green-100 tracking-wide">
                            {showLiveTimer ? formatTime(liveReactionTime) : "TAPPED!"}
                          </p>
                          <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300" />
                        </div>
                      </div>
                      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 group-hover:ring-white/30 transition-all" />
                    </Button>
                    {yourTapTime === null && (
                      <div className="text-center mt-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 rounded-lg py-2 px-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Click or tap as fast as you can!</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Submitted — waiting for backend */}
            {gameState === "submitted" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="p-8 sm:p-12 text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 animate-pulse">
                    <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-2">
                      {yourTapTime !== null ? `You tapped in ${formatTime(yourTapTime)}` : tappedEarly ? "You tapped early!" : "Tap submitted"}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for result...</p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-3 h-3 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Finished */}
            {gameState === "finished" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="p-8 sm:p-12 text-center">
                  <div className={`inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full mb-6 ${isWinner ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-orange-600"}`}>
                    {isWinner ? <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-white" /> : <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-white" />}
                  </div>
                  <h2 className={`text-3xl sm:text-4xl font-black mb-2 ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {isVoided ? "ROUND VOID" : isWinner ? "YOU WIN!" : tappedEarly ? "TOO EARLY!" : "YOU LOSE"}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isVoided ? "Stakes refunded" : "Match completed • View results"}
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 sticky top-4">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Room Activity</h3>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{formatCurrencyNoDecimals(stakeAmount)} Stake Room</p>
              </div>
              <div className="p-4">
                <ReactionTapGameHistory key={historyKey} stake={stakeAmount} />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <Dialog open={showResultPopup} onOpenChange={setShowResultPopup}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <div className="p-4 sm:p-6">
            <DialogHeader>
              <div className="text-center">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${isWinner ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-orange-600"}`}>
                  <div className="text-white">
                    {isWinner ? <Trophy className="h-8 w-8 sm:h-10 sm:w-10" /> : <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />}
                  </div>
                </div>
                <DialogTitle className={`text-2xl sm:text-3xl font-black mb-2 ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {isVoided ? "ROUND VOID" : isWinner ? "VICTORY!" : tappedEarly ? "TOO EARLY!" : "DEFEAT"}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {isWinner ? "You won the reaction tap match" : "You lost the reaction tap match"}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-3">
              {isVoided && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800 text-center">
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">Both players tapped early. Stakes fully refunded.</p>
                </div>
              )}

              {!isVoided && !tappedEarly && yourTapTime !== null && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider font-semibold">Match Results</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm overflow-hidden">
                          <PlayerAvatar avatar={identity.avatar} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{myUsername}</span>
                      </div>
                      <span className="text-base font-black text-blue-600 dark:text-blue-400">{formatTime(yourTapTime)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-sm overflow-hidden">
                          <PlayerAvatar avatar={opponentAvatar} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{opponentName}</span>
                      </div>
                      <span className="text-base font-black text-red-600 dark:text-red-400">{formatTime(opponentTapTime)}</span>
                    </div>
                  </div>
                </div>
              )}

              {tappedEarly && !isVoided && (
                <div className="bg-red-500/10 dark:bg-red-500/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300 font-semibold text-center">{myUsername} tapped before the signal!</p>
                </div>
              )}

              {!isVoided && (
                <>
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider font-semibold">
                      {isWinner ? `${myUsername} Won` : `${myUsername} Lost`}
                    </p>
                    <div className={`text-4xl sm:text-5xl font-black ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {isWinner ? "+" : "-"}{formatCurrencyNoDecimals(isWinner ? winAmount - stakeAmount : stakeAmount)}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Stake</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(stakeAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Pool</span>
                        <span className="font-semibold text-yellow-600 dark:text-yellow-400">{formatCurrencyNoDecimals(stakeAmount * 2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Fee (10%)</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(platformFee)}</span>
                      </div>
                      <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <span className="text-gray-900 dark:text-white font-bold">Payout</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrencyNoDecimals(winAmount)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Game Wallet</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white">{formatCurrencyNoDecimals(balances.game)}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleExit} variant="outline"
                  className="w-full h-11 sm:h-12 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Back to Stake Selection
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
