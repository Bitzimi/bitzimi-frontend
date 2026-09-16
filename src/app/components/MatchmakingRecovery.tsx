import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { gameMatchmakingService, type MatchGameType } from "../services/gameMatchmakingService";

const RECOVERY_ROUTES: Record<string, MatchGameType> = {
  "/game/pvp-coinflip/play": "pvp_coinflip",
  "/game/reaction-tap/play": "reaction_tap",
};

export function MatchmakingRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const checkedRef = useRef("");

  useEffect(() => {
    const gameType = RECOVERY_ROUTES[location.pathname];
    if (!gameType) return;

    const params = new URLSearchParams(location.search);
    const stake = Number(params.get("stake"));
    const hasMatchId = Boolean(params.get("matchId"));
    const isRecoverySearch = params.get("recovery") === "search";
    if (!Number.isFinite(stake) || stake <= 0 || hasMatchId || isRecoverySearch) return;

    const key = `${location.pathname}:${stake}`;
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    let cancelled = false;
    void gameMatchmakingService.getActiveMatchmaking(gameType, stake).then(active => {
      if (cancelled) return;
      if (active.status === "matched" && active.matchId) {
        params.set("matchId", active.matchId);
        params.delete("recovery");
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
        return;
      }
      if (active.status === "waiting" && active.queueId) {
        params.set("recovery", "search");
        params.delete("matchId");
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    }).catch(() => {
      // Recovery is best-effort; the existing game page remains authoritative.
    });

    return () => { cancelled = true; };
  }, [location.pathname, location.search, navigate]);

  return null;
}
