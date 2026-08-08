/**
 * useSpinBattleMonitor — background Spin Battle state monitor.
 *
 * Polls all 4 lobbies every 5 seconds while the user is NOT on the SpinBattle page.
 * When a result is detected and the user had a bet in that round, it:
 *   1. Calls refreshWalletsFromBackend() — the backend already settled the wallet.
 *   2. Shows a toast notification with the result.
 *
 * No wallet mutations. No incrementBalance / decrementBalance / updateBalance calls.
 * No affiliate commission calculations — backend fires commissions server-side.
 * No dependency on the legacy spinBattleService frontend engine.
 */
import { useEffect, useRef } from "react";
import { useWallet } from "../contexts/WalletContext";
import { useSettings } from "../contexts/SettingsContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useIdentity } from "../contexts/IdentityContext";
import { liveActivityService } from "../services/liveActivityService";
import { toast } from "sonner";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
const POLL_INTERVAL_MS = 5_000; // background poll — less frequent than game-page poll

function getToken(): string | null {
  return localStorage.getItem("bitzimi_access_token");
}

export function useSpinBattleMonitor() {
  const { refreshWalletsFromBackend } = useWallet();
  const { formatCurrencyNoDecimals }  = useSettings();
  const { addGameResult }             = useGameStats();
  const { addNotification }           = useNotifications();
  const { identity }                  = useIdentity();

  // Keep refs current to avoid stale closures in setInterval
  const refreshRef   = useRef(refreshWalletsFromBackend);
  const formatRef    = useRef(formatCurrencyNoDecimals);
  const addGameRef   = useRef(addGameResult);
  const addNotifRef  = useRef(addNotification);
  const identityRef  = useRef(identity);

  useEffect(() => {
    refreshRef.current  = refreshWalletsFromBackend;
    formatRef.current   = formatCurrencyNoDecimals;
    addGameRef.current  = addGameResult;
    addNotifRef.current = addNotification;
    identityRef.current = identity;
  }, [refreshWalletsFromBackend, formatCurrencyNoDecimals, addGameResult, addNotification, identity]);

  // Per-lobby processed-round tracker — prevents duplicate notifications
  const processedRounds = useRef<Record<string, number | null>>({
    A: null, B: null, C: null, D: null,
  });

  useEffect(() => {
    if (!API_BASE) return; // no backend configured — monitor is a no-op

    const pollLobby = async (lobbyId: string) => {
      const token = getToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/api/v1/games/spin/lobbies/${lobbyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const json = await res.json();
        const data = json.data;

        if (
          data.phase === "result" &&
          data.winnerId &&
          data.roundNumber !== processedRounds.current[lobbyId] &&
          data.myBet?.inRound
        ) {
          processedRounds.current[lobbyId] = data.roundNumber;

          const userId   = identityRef.current.userId;
          const username = identityRef.current.username;
          const stake    = data.stake as number;
          const payout   = (data.winnerPayout as number) ?? 0;
          const iWon     = data.winnerId === userId;

          // Backend settled the wallet — refresh display balance
          refreshRef.current().catch(() => {});

          // Local game stats for Profile page display
          addGameRef.current({
            gameType:  "spin_battle",
            betAmount: stake,
            winAmount: iWon ? payout : 0,
            profit:    iWon ? payout - stake : -stake,
            won:       iWon,
          });

          if (iWon) {
            addNotifRef.current(
              "game_win",
              "🎉 Spin Battle Won!",
              `Lobby ${lobbyId} Round #${data.roundNumber}: Won ${formatRef.current(payout)}`,
              { game: "spin_battle", lobby: lobbyId, amount: payout, roundNumber: data.roundNumber },
            );
            liveActivityService.addActivity("game_win", username, "won in Spin Battle", payout);
            toast.success(`🎉 Spin Battle Lobby ${lobbyId}: Won ${formatRef.current(payout)}!`, { duration: 5000 });
          } else {
            addNotifRef.current(
              "game_loss",
              "Spin Battle Lost",
              `Lobby ${lobbyId} Round #${data.roundNumber}: Lost ${formatRef.current(stake)}`,
              { game: "spin_battle", lobby: lobbyId, amount: stake, roundNumber: data.roundNumber },
            );
          }
        }

        // Reset tracker on new round
        if (data.phase === "waiting" && data.roundNumber !== processedRounds.current[lobbyId]) {
          if (processedRounds.current[lobbyId] !== null && processedRounds.current[lobbyId]! < data.roundNumber) {
            processedRounds.current[lobbyId] = null;
          }
        }
      } catch { /* network errors — keep polling */ }
    };

    const pollAll = () => {
      ["A","B","C","D"].forEach(pollLobby);
    };

    const interval = setInterval(pollAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
