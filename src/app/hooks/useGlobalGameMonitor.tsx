/**
 * useGlobalGameMonitor — background Color Game monitor.
 *
 * Polls all 4 Color Game lobbies every 5 seconds while the user may be away
 * from the game page. When a round result is detected AND the user had a bet
 * in that round (via backend `myBet.inRound`), it:
 *   1. Calls refreshWalletsFromBackend() — backend already settled the wallet.
 *   2. Records local game stats for the Profile page.
 *   3. Sends an in-app notification and toast.
 *
 * Architecture rules applied:
 *   • No local incrementBalance / decrementBalance / updateBalance.
 *   • No lobbyGameStateService dependency — purely backend-driven.
 *   • No betService dependency — backend myBet field is the source of truth.
 *   • No affiliate commission calculations — backend fires commissions server-side.
 *   • No Math.random() for game outcomes.
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

const LOBBIES = ["A", "B", "C", "D"] as const;

export function useGlobalGameMonitor() {
  const { refreshWalletsFromBackend } = useWallet();
  const { formatCurrencyNoDecimals }  = useSettings();
  const { addGameResult }             = useGameStats();
  const { addNotification }           = useNotifications();
  const { identity }                  = useIdentity();

  // Keep refs current to avoid stale closures inside setInterval
  const refreshRef  = useRef(refreshWalletsFromBackend);
  const formatRef   = useRef(formatCurrencyNoDecimals);
  const addGameRef  = useRef(addGameResult);
  const addNotifRef = useRef(addNotification);
  const identityRef = useRef(identity);

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
    if (!API_BASE) return; // backend not configured — monitor is a no-op

    const pollLobby = async (lobbyId: string) => {
      const token = getToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/api/v1/games/color/lobbies/${lobbyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const json = await res.json();
        const data = json.data;

        // Detect result phase with a settled user bet (backend is source of truth)
        if (
          data.phase === "result" &&
          data.result &&
          data.myBet &&
          data.roundNumber !== processedRounds.current[lobbyId]
        ) {
          processedRounds.current[lobbyId] = data.roundNumber;

          const myBet   = data.myBet;
          const won     = myBet.outcome === "win";
          const voided  = myBet.outcome === "draw";
          const amount  = myBet.amount as number;
          const payout  = (myBet.payout as number) ?? 0;
          const username = identityRef.current.username;

          // Backend already settled — refresh displayed balance
          refreshRef.current().catch(() => {});

          if (!voided) {
            // Local game stats (display only — backend records in game_stats table)
            addGameRef.current({
              gameType:  "color_prediction",
              lobby:     lobbyId,
              betAmount: amount,
              winAmount: won ? payout : 0,
              profit:    won ? payout - amount : -amount,
              won,
            });

            if (won) {
              addNotifRef.current(
                "game_win",
                "🎉 You Won!",
                `Color Prediction Lobby ${lobbyId}: +${formatRef.current(payout)}`,
                { game: "color_prediction", lobby: lobbyId, amount: payout },
              );
              liveActivityService.addActivity("game_win", username, "won in Color Prediction", payout);
              toast.success(`🎉 Lobby ${lobbyId}: You won ${formatRef.current(payout)}!`, { duration: 5000 });
            } else {
              addNotifRef.current(
                "game_loss",
                "You Lost",
                `Color Prediction Lobby ${lobbyId}: -${formatRef.current(amount)}`,
                { game: "color_prediction", lobby: lobbyId, amount },
              );
              toast.error(`Lobby ${lobbyId}: You lost ${formatRef.current(amount)}`, { duration: 5000 });
            }
          }
        }

        // Reset tracker on new round
        if (data.phase === "waiting") {
          const prev = processedRounds.current[lobbyId];
          if (prev !== null && data.roundNumber > prev) {
            processedRounds.current[lobbyId] = null;
          }
        }
      } catch { /* network errors — keep polling */ }
    };

    const pollAll = () => LOBBIES.forEach(pollLobby);

    const interval = setInterval(pollAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
