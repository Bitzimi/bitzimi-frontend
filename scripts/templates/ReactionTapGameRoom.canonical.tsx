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
import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, Search, Info } from "lucide-react";
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
  DialogClose,
} from "../components/ui/dialog";
import { ReactionTapGameHistory, addReactionTapGameToHistory } from "../components/ReactionTapGameHistory";
import { gameMatchmakingService, type MatchResult } from "../services/gameMatchmakingService";

// ── Game state machine ─────────────────────────────────────────────────────────
type GameState =
  | "idle"            // room open, waiting for Search
  | "searching"       // in matchmaking queue
  | "matched"         // opponent found, about to signal ready
  | "countdown"        // shared server-timed countdown
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
  const recoverySearch = searchParams.get("recovery") === "search";

  const { formatCurrencyNoDecimals } = useSettings();
  // Wallet — backend controls all balance changes.
  // refreshWalletsFromBackend() is called after settlement.
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult }  = useGameStats();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const myUsername   = identity.username;

  // ── Core game state ──────────────────────────────────────────────────────────
  const [gameState,        setGameState]        = useState<GameState>("idle");
  const [opponentName,     setOpponentName]     = useState("");
  const [opponentAvatar,   setOpponentAvatar]   = useState("P");
  const [queueId,          setQueueId]          = useState<string | null>(null);
  const [matchId,          setMatchId]          = useState<string | null>(null);
  const [matchData,         setMatchData]         = useState<MatchResult | null>(null);
  const [showRules,         setShowRules]         = useState(false);

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
  // Both players use the same backend match creation timestamp and server clock.
  // The local browser only renders that shared timeline; it never starts its own
  // independent 5-second countdown from the moment the response arrives.
  const startCountdown = useCallback((sid: string, match: MatchResult) => {
    if (sessionId.current !== sid) return;
    const mid = match.matchId;
    const serverOffset = (match.serverNow ?? Date.now()) - Date.now();
    const countdownStartServerMs = match.lifecycleStartedAt + 2000;

    matchIdRef.current = mid;
    isPlayer1Ref.current = Boolean(match.isPlayer1);
    setMatchId(mid);
    setMatchData(match);
    setGameState("countdown");

    const tick = () => {
      if (sessionId.current !== sid) return;
      const nowServerMs = Date.now() + serverOffset;
      const remaining = countdownStartServerMs - nowServerMs;
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        void startSignalingPhase(sid, mid);
        return;
      }
      setCountdownValue(Math.min(5, Math.max(1, Math.ceil(remaining / 1000))));
    };

    tick();
    countdownRef.current = setInterval(tick, 100);
  }, []);

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
    setMatchData(match);

    const voided     = match.status === "cancelled";
    const won        = !voided && match.youWon;
    const totalPool = match.totalPool;
    const fee = match.platformFee;
    const payout = match.payout;

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
  const recoverActiveMatch = useCallback(async (sid: string, match: MatchResult) => {
    if (sessionId.current !== sid || match.status !== "active") {
      if (match.status === "settled" || match.status === "cancelled") handleMatchResult(sid, match);
      return;
    }

    matchIdRef.current = match.matchId;
    isPlayer1Ref.current = Boolean(match.isPlayer1);
    setMatchId(match.matchId);
    setMatchData(match);
    setOpponentName(match.opponent.username);
    setOpponentAvatar(match.opponent.avatar || match.opponent.username.charAt(0).toUpperCase());

    // If the authoritative signal already exists, resume exactly from that time.
    if (match.signalSentAt) {
      startWaitingPhase(sid, new Date(match.signalSentAt).getTime());
      return;
    }

    // Otherwise resume the shared match-start countdown from the backend timestamp.
    const serverOffset = (match.serverNow ?? Date.now()) - Date.now();
    const countdownStartServerMs = match.lifecycleStartedAt + 2000;
    const nowServerMs = Date.now() + serverOffset;
    if (nowServerMs < countdownStartServerMs) {
      startCountdown(sid, match);
    } else {
      // The countdown has already elapsed while this page was away. Tell the
      // backend this player is ready; the backend decides when the shared signal occurs.
      void startSignalingPhase(sid, match.matchId);
    }
  }, [handleMatchResult, startWaitingPhase, startCountdown, startSignalingPhase]);

  const pollExistingQueue = useCallback((sid: string, qid: string) => {
    setQueueId(qid);
    setGameState("searching");
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      if (sessionId.current !== sid) return;
      try {
        const status = await gameMatchmakingService.pollQueue(qid);
        if (sessionId.current !== sid) return;
        if (status.status === "matched" && status.matchId) {
          if (pollRef.current) clearInterval(pollRef.current);
          const match = await gameMatchmakingService.getMatch(status.matchId);
          if (sessionId.current !== sid) return;
          await recoverActiveMatch(sid, match);
        } else if (status.status === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          setQueueId(null);
          setGameState("idle");
        }
      } catch {
        // Keep the UI in the searching state. A transient network error must not
        // turn an active backend queue into a false local cancellation.
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), 500);
  }, [recoverActiveMatch]);

  const enterQueue = useCallback(async (sid: string, forceNew = false) => {
    try {
      if (privateMatchId) {
        const match = await gameMatchmakingService.getMatch(privateMatchId);
        if (sessionId.current !== sid) return;
        await recoverActiveMatch(sid, match);
        return;
      }

      setGameState("searching");
      const res = await gameMatchmakingService.joinQueue("reaction_tap", stakeAmount);
      if (sessionId.current !== sid) return;

      if (res.status === "matched" && res.matchId) {
        const match = await gameMatchmakingService.getMatch(res.matchId);
        if (sessionId.current !== sid) return;
        await recoverActiveMatch(sid, match);
        return;
      }
      if (res.queueId) pollExistingQueue(sid, res.queueId);
    } catch {
      if (sessionId.current !== sid) return;
      setQueueId(null);
      setGameState("idle");
      toast.error("Unable to start matchmaking. Please try Search again.");
    }
  }, [stakeAmount, recoverActiveMatch, pollExistingQueue, privateMatchId]);

  const handleSearch = useCallback(() => {
    if (gameState !== "idle") return;
    void enterQueue(sessionId.current, true);
  }, [gameState, enterQueue]);

  // ── Mount: recover the real backend state before deciding what the UI should show ──
  useEffect(() => {
    const sid = sessionId.current;
    let cancelled = false;
    const restore = async () => {
      if (privateMatchId) {
        await enterQueue(sid);
        return;
      }
      try {
        const active = await gameMatchmakingService.getActiveMatchmaking("reaction_tap", stakeAmount);
        if (cancelled || sessionId.current !== sid) return;
        if (active.status === "matched" && active.matchId) {
          const match = await gameMatchmakingService.getMatch(active.matchId);
          if (!cancelled) await recoverActiveMatch(sid, match);
          return;
        }
        if (active.status === "waiting" && active.queueId) {
          pollExistingQueue(sid, active.queueId);
          return;
        }
        if (balances.game < stakeAmount) {
          toast.error("Insufficient balance in Game Wallet");
          navigate("/game/reaction-tap");
        } else {
          setGameState("idle");
        }
      } catch {
        // A transient recovery read failure is not proof that the backend search
        // ended. Leave the room usable and let the user retry; never route them out.
        if (!cancelled) setGameState("idle");
      }
    };
    void restore();
    return () => {
      cancelled = true;
      stopAllTimers();
    };
  }, [stakeAmount, privateMatchId, balances.game, navigate, enterQueue, recoverActiveMatch, pollExistingQueue, stopAllTimers]); // re-run when recovery route is attached after backend state is checked

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


  const handleSearchNewOpponent = useCallback(() => {
    stopAllTimers();
    setShowResultPopup(false);
    setMatchId(null);
    matchIdRef.current = null;
    setMatchData(null);
    setQueueId(null);
    setOpponentName("");
    setOpponentAvatar("P");
    setCountdownValue(5);
    setTappedEarly(false);
    setYourTapTime(null);
    setOpponentTapTime(null);
    setLiveReactionTime(0);
    setIsWinner(false);
    setIsVoided(false);
    setWinAmount(0);
    setPlatformFee(0);
    gameEndedRef.current = false;
    setGameState("searching");
    void enterQueue(sessionId.current, true);
  }, [enterQueue, stopAllTimers]);

  const handleExit = useCallback(() => {
    stopAllTimers();
    if (roomCode) navigate(`/game/reaction-tap/private?roomCode=${roomCode}&stake=${stakeAmount}`);
    else navigate("/game/reaction-tap");
  }, [navigate, stopAllTimers, roomCode, stakeAmount]);

  // ── Derived display values ─────────────────────────────────────────────────────
  const winnerPayout    = matchData?.payout ?? 0;
  const displayedPool   = matchData?.totalPool ?? 0;
  const isTapDisabled   = gameState !== "signal_shown" && gameState !== "waiting_signal";
  const showLiveTimer   = gameState === "signal_shown" && yourTapTime === null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <ResponsiveLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleExit}
              className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Back to stake room</span>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-[6px]">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Tap Arena</h1>
              <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)}
              className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 rounded-lg shrink-0">
              <Info className="h-4 w-4 mr-2" />Rules
            </Button>
          </div>
          {showRules && (
            <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Play</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li>Wait until both players are ready and the signal appears.</li>
                  <li>Do not tap before the signal. An early tap is recorded as an early loss.</li>
                  <li>When <strong>TAP NOW</strong> appears, tap as quickly as possible.</li>
                  <li>The backend compares both reaction times and determines the winner.</li>
                  <li>The winner receives the backend-calculated payout after the platform fee.</li>
                  <li>If both players tap early, the round is void and both stakes are refunded.</li>
                </ul>
              </div>
            </Card>
          )}
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 divide-x divide-gray-200 dark:divide-gray-700">
                <div className="text-center px-1"><div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Bet</div><div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(matchData?.stake ?? stakeAmount)}</div></div>
                <div className="text-center px-1"><div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Pool</div><div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(displayedPool)}</div></div>
                <div className="text-center px-1"><div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Winner</div><div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(winnerPayout)}</div></div>
              </div>
            </div>
          </Card>
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
                  <div className="relative flex flex-col items-center">
                    <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block mb-6">
                      Balance: {formatCurrencyNoDecimals(balances.game)}
                    </div>
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
                    <p className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">WAIT...</p>
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
                      className="relative w-full h-28 sm:h-36 group disabled:opacity-50 disabled:cursor-not-allowed bg-transparent hover:bg-transparent border-0 p-0 touch-manipulation">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl shadow-[0_18px_50px_-18px_rgba(20,184,166,0.65)]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
                      <div className="relative z-10 flex flex-col items-center justify-center h-full">
                        <div className="text-3xl sm:text-5xl font-black text-white tracking-[0.18em] mb-2">TAP NOW</div>
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
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Tap the moment the signal appears</p>
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
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">Room Activity</h3>
                  <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrencyNoDecimals(stakeAmount)} Stake Room</span>
                </div>
              </div>
              <div className="p-4">
                <ReactionTapGameHistory key={historyKey} stake={stakeAmount} />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Result Modal — compact, clearly modal, with close + fresh matchmaking */}
      <Dialog open={showResultPopup} onOpenChange={setShowResultPopup}>
        <DialogContent hideClose className="w-[calc(100vw-32px)] max-w-[430px] max-h-[82vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 text-white shadow-2xl p-0">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.20),transparent_55%)] pointer-events-none" />
            <DialogClose asChild>
              <button type="button" aria-label="Close result" className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-md hover:bg-white/15 hover:text-white transition-colors">×</button>
            </DialogClose>
            <div className="relative p-5 sm:p-6">
              <DialogHeader className="text-center pr-8">
                <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${isWinner ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                  {isWinner ? <Trophy className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
                </div>
                <DialogTitle className={`text-2xl font-black tracking-tight ${isWinner ? "text-emerald-300" : "text-rose-300"}`}>
                  {isVoided ? "Round Void" : isWinner ? "You Win" : tappedEarly ? "Too Early" : "You Lose"}
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">Reaction Tap result</DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-3">
                {isVoided ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-center text-sm text-amber-200">Both players tapped early. Stakes were refunded.</div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Your Result</div>
                      <div className={`mt-1 text-3xl font-black ${isWinner ? "text-emerald-300" : "text-rose-300"}`}>
                        {isWinner ? "+" : "-"}{formatCurrencyNoDecimals(isWinner ? winAmount - stakeAmount : stakeAmount)}
                      </div>
                    </div>
                    {!tappedEarly && yourTapTime !== null && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-blue-400/15 bg-blue-400/10 p-3 text-center"><div className="text-xs text-slate-400">You</div><div className="mt-1 font-bold text-blue-200">{formatTime(yourTapTime)}</div></div>
                        <div className="rounded-2xl border border-rose-400/15 bg-rose-400/10 p-3 text-center"><div className="text-xs text-slate-400">{opponentName}</div><div className="mt-1 font-bold text-rose-200">{formatTime(opponentTapTime)}</div></div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400">Stake</span><span className="font-semibold">{formatCurrencyNoDecimals(matchData?.stake ?? stakeAmount)}</span></div>
                      <div className="mt-1 flex justify-between"><span className="text-slate-400">Pool</span><span className="font-semibold">{formatCurrencyNoDecimals(matchData?.totalPool ?? 0)}</span></div>
                      <div className="mt-1 flex justify-between"><span className="text-slate-400">Platform fee</span><span className="font-semibold">{formatCurrencyNoDecimals(matchData?.platformFee ?? platformFee)}</span></div>
                      <div className="mt-2 border-t border-white/10 pt-2 flex justify-between"><span className="font-semibold">Payout</span><span className="font-bold text-emerald-300">{formatCurrencyNoDecimals(winAmount)}</span></div>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <Button onClick={handleSearchNewOpponent} className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white font-bold shadow-lg shadow-purple-500/20 hover:from-violet-400 hover:via-purple-400 hover:to-fuchsia-400">Search New Opponent</Button>
                  <Button onClick={handleExit} variant="outline" className="h-11 w-full rounded-2xl border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]">Back to Stake Selection</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
