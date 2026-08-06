/**
 * PrivateMatchLobby — shared by all three PvP games.
 *
 * Modes:
 *   "select"  — choose create or join
 *   "host"    — room created; show code, poll for guest joining
 *   "join"    — enter code input, then join and auto-start
 *   "rematch" — after a match ends, signal/wait/decline rematch
 *
 * URL params consumed:
 *   stake     — required bet amount
 *   roomCode  — if present, initialises in rematch mode for that room
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Copy, Check, Users, ArrowLeft, RefreshCw, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { ResponsiveLayout } from "./ResponsiveLayout";
import { gameMatchmakingService, type PrivateRoom } from "../services/gameMatchmakingService";
import { useSettings } from "../contexts/SettingsContext";

export interface PrivateMatchLobbyProps {
  gameType:    "pvp_coinflip" | "dice_clash" | "reaction_tap";
  gameName:    string;
  gamePlayPath: string;  // e.g. /game/pvp-coinflip/play
  backPath:    string;   // e.g. /game/pvp-coinflip
}

type Mode = "select" | "host" | "join" | "rematch";

export default function PrivateMatchLobby({ gameType, gameName, gamePlayPath, backPath }: PrivateMatchLobbyProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatCurrencyNoDecimals } = useSettings();

  const stakeAmount  = parseInt(searchParams.get("stake") || "1");
  const roomCodeParam = searchParams.get("roomCode") ?? "";

  // If roomCode is in URL we entered rematch mode coming back from the game page
  const [mode, setMode]       = useState<Mode>(roomCodeParam ? "rematch" : "select");
  const [room, setRoom]       = useState<PrivateRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Rematch UX: track whether *I* have already signalled
  const [iSignalled, setISignalled] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Navigate to game page, carrying matchId + roomCode so the game can return here for rematches
  const navigateToGame = useCallback((matchId: string, code: string) => {
    stopPolling();
    navigate(`${gamePlayPath}?matchId=${matchId}&roomCode=${code}&stake=${stakeAmount}`);
  }, [navigate, gamePlayPath, stakeAmount, stopPolling]);

  // Poll room state every 2 s
  const startPolling = useCallback((code: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await gameMatchmakingService.getRoom(code);
        setRoom(r);
        if (r.status === "active" && r.currentMatchId) {
          navigateToGame(r.currentMatchId, code);
        }
      } catch { /* room expired or network issue */ }
    }, 2000);
  }, [navigateToGame, stopPolling]);

  // ── Rematch mode: fetch room on mount, start polling ─────────────────────────
  useEffect(() => {
    if (mode !== "rematch" || !roomCodeParam) return;
    setLoading(true);
    gameMatchmakingService.getRoom(roomCodeParam)
      .then(r => {
        setRoom(r);
        startPolling(roomCodeParam);
      })
      .catch(() => setError("Room not found or has expired"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create room ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoading(true); setError("");
    try {
      const r = await gameMatchmakingService.createRoom(gameType, stakeAmount);
      setRoom(r);
      setMode("host");
      startPolling(r.code);
    } catch (err: any) {
      setError(err.message ?? "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  // ── Join room ─────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError("Enter the 6-character room code"); return; }
    setLoading(true); setError("");
    try {
      // 1. Join (sets status to "ready")
      await gameMatchmakingService.joinRoom(code);
      // 2. Start the match (either player can trigger; backend is idempotent via status check)
      const result = await gameMatchmakingService.startMatch(code);
      navigateToGame(result.matchId, code);
    } catch (err: any) {
      setError(err.message ?? "Failed to join room");
      setLoading(false);
    }
  };

  // ── Copy room code ────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Cancel / back ─────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    stopPolling();
    if (room && mode === "host") {
      try { await gameMatchmakingService.cancelRoom(room.code); } catch { /* ignore */ }
    }
    navigate(backPath);
  };

  // ── Rematch: accept ───────────────────────────────────────────────────────────
  const handleAcceptRematch = async () => {
    if (!room) return;
    setLoading(true); setError("");
    try {
      const res = await gameMatchmakingService.signalRematch(room.code);
      if (res.status === "started" && res.matchId) {
        navigateToGame(res.matchId, room.code);
      } else {
        setISignalled(true);
        setRoom(res.room);
        // Keep polling — opponent hasn't accepted yet
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to signal rematch");
    } finally {
      setLoading(false);
    }
  };

  // ── Rematch: decline ──────────────────────────────────────────────────────────
  const handleDeclineRematch = async () => {
    if (!room) return;
    try { await gameMatchmakingService.declineRematch(room.code); } catch { /* ignore */ }
    stopPolling();
    navigate(backPath);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const backButton = (label = "Back to Stake Selection") => (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCancel}
        className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        <span className="text-sm font-medium">{label}</span>
      </Button>
    </div>
  );

  const pageTitle = (suffix: string) => (
    <div className="flex items-baseline gap-[6px]">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">{gameName}</h1>
      <span className="text-sm text-gray-500 whitespace-nowrap">— {suffix}</span>
    </div>
  );

  // ── REMATCH MODE ──────────────────────────────────────────────────────────────
  if (mode === "rematch") {
    const hostUsername  = room?.host?.profile?.username ?? "Host";
    const guestUsername = room?.guest?.profile?.username ?? "Guest";
    const hostReady     = room?.rematchHostReady ?? false;
    const guestReady    = room?.rematchGuestReady ?? false;

    return (
      <ResponsiveLayout>
        <div className="space-y-3 mb-6">
          {backButton("Back to Stake Selection")}
          {pageTitle(`Private Room · ${formatCurrencyNoDecimals(stakeAmount)}`)}
        </div>

        <Card className="p-6 space-y-5 border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10">
          <div className="text-center space-y-1">
            <div className="text-4xl mb-2">🔄</div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Rematch?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Both players must accept to start a new match in the same room.
            </p>
          </div>

          {room && (
            <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-700 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400 font-mono tracking-widest">{room.code}</span>
                <span className="text-xs text-gray-400">Room</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-300">{hostUsername}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hostReady ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                  {hostReady ? "✓ Ready" : "Waiting…"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-300">{guestUsername}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${guestReady ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                  {guestReady ? "✓ Ready" : "Waiting…"}
                </span>
              </div>
            </div>
          )}

          {loading && !room && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading room…
            </div>
          )}

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleDeclineRematch}
              className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-4 w-4 mr-2" />
              Decline
            </Button>
            <Button
              onClick={handleAcceptRematch}
              disabled={loading || iSignalled}
              className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60"
            >
              {iSignalled
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Waiting…</>
                : "Accept Rematch"}
            </Button>
          </div>
        </Card>
      </ResponsiveLayout>
    );
  }

  // ── SELECT MODE ───────────────────────────────────────────────────────────────
  if (mode === "select") {
    return (
      <ResponsiveLayout>
        <div className="space-y-3 mb-6">
          {backButton()}
          {pageTitle(`Private Match · ${formatCurrencyNoDecimals(stakeAmount)}`)}
        </div>

        <Card className="p-6 space-y-5 border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center mx-auto mb-3">
              <Lock className="h-7 w-7 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Challenge a Friend</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a private room and share the code, or enter your friend&apos;s code.
            </p>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <div className="space-y-3">
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium"
            >
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
              Create Room
            </Button>
            <Button
              variant="outline"
              onClick={() => { setMode("join"); setError(""); }}
              className="w-full h-11 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              Join with Code
            </Button>
          </div>
        </Card>
      </ResponsiveLayout>
    );
  }

  // ── HOST MODE — waiting for guest ─────────────────────────────────────────────
  if (mode === "host" && room) {
    return (
      <ResponsiveLayout>
        <div className="space-y-3 mb-6">
          {backButton()}
          {pageTitle(`Private Match · ${formatCurrencyNoDecimals(stakeAmount)}`)}
        </div>

        <Card className="p-6 space-y-5 border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10">
          <div className="text-center space-y-1">
            <div className="text-4xl mb-2">⏳</div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Waiting for your friend…</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Share this code. Game starts automatically when they join.</p>
          </div>

          {/* Room code */}
          <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-700 rounded-xl p-5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Room Code</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-purple-700 dark:text-purple-300">
              {room.code}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            {copied
              ? <><Check className="h-4 w-4 mr-2 text-green-500" />Copied!</>
              : <><Copy className="h-4 w-4 mr-2" />Copy Room Code</>}
          </Button>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <RefreshCw className="h-3 w-3 animate-spin flex-shrink-0" />
            <span>Waiting for opponent… game starts automatically.</span>
          </div>

          <Button
            variant="ghost"
            onClick={handleCancel}
            className="w-full text-sm text-gray-400 hover:text-red-500"
          >
            Cancel Room
          </Button>
        </Card>
      </ResponsiveLayout>
    );
  }

  // ── JOIN MODE — enter code ────────────────────────────────────────────────────
  return (
    <ResponsiveLayout>
      <div className="space-y-3 mb-6">
        {backButton()}
        {pageTitle(`Private Match · ${formatCurrencyNoDecimals(stakeAmount)}`)}
      </div>

      <Card className="p-6 space-y-5 border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Enter Room Code</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ask your friend for their 6-character room code.</p>
        </div>

        <Input
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="A1B2C3"
          maxLength={6}
          className="font-mono text-center text-xl tracking-widest uppercase h-12"
          disabled={loading}
        />

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <Button
          onClick={handleJoin}
          disabled={loading || joinCode.length !== 6}
          className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50"
        >
          {loading
            ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Joining…</>
            : "Join Room"}
        </Button>

        <Button
          variant="ghost"
          onClick={() => { setMode("select"); setError(""); setJoinCode(""); }}
          className="w-full text-sm text-gray-400"
          disabled={loading}
        >
          Back
        </Button>
      </Card>
    </ResponsiveLayout>
  );
}
