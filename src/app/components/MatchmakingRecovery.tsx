import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { gameMatchmakingService, type MatchGameType } from "../services/gameMatchmakingService";

const RECOVERY_ROUTES: Record<string, MatchGameType> = {
  "/game/pvp-coinflip/play": "pvp_coinflip",
  "/game/reaction-tap/play": "reaction_tap",
};

const RECOVERY_RETRIES = [0, 700, 1800];

export function MatchmakingRecovery() {
  const location = useLocation();
  const navigate = useNavigate();
  const checkedRef = useRef("");

  useEffect(() => {
    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    const gameType = RECOVERY_ROUTES[pathname];
    if (!gameType) return;

    const params = new URLSearchParams(location.search);
    const stake = Number(params.get("stake"));
    const hasMatchId = Boolean(params.get("matchId"));
    const isRecoverySearch = params.get("recovery") === "search";
    if (!Number.isFinite(stake) || stake <= 0 || hasMatchId || isRecoverySearch) return;

    const key = `${pathname}:${stake}`;
    if (checkedRef.current === key) return;
    checkedRef.current = key;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const check = async (attempt: number) => {
      try {
        const active = await gameMatchmakingService.getActiveMatchmaking(gameType, stake);
        if (cancelled) return;

        if (active.status === "matched" && active.matchId) {
          params.set("matchId", active.matchId);
          params.delete("recovery");
          navigate(`${pathname}?${params.toString()}`, { replace: true });
          return;
        }

        if (active.status === "waiting" && active.queueId) {
          params.set("recovery", "search");
          params.delete("matchId");
          navigate(`${pathname}?${params.toString()}`, { replace: true });
        }
      } catch {
        if (cancelled || attempt >= RECOVERY_RETRIES.length - 1) return;
        retryTimer = setTimeout(() => void check(attempt + 1), RECOVERY_RETRIES[attempt + 1]);
      }
    };

    void check(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [location.pathname, location.search, navigate]);

  return null;
}
