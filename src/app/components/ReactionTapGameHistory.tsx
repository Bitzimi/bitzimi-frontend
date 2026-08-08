import { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { useSettings } from "../contexts/SettingsContext";
import { useIdentity } from "../contexts/IdentityContext";
import { PlayerAvatar } from "./PlayerAvatar";
import { Trophy, TrendingUp, Timer, Users } from "lucide-react";

// Avatar is NOT stored — resolved at render time from identity/opponent name
export interface ReactionTapGameRecord {
  id: string;
  stake: number;
  result: "win" | "loss";
  opponentName: string;
  yourReactionTime: number | null;
  opponentReactionTime: number | null;
  tappedEarly: boolean;
  winnings: number;
  timestamp: string;
}

export function ReactionTapGameHistory({ stake }: { stake: number }) {
  const { formatCurrencyNoDecimals } = useSettings();
  const { identity } = useIdentity();
  const [games, setGames] = useState<ReactionTapGameRecord[]>([]);

  const loadGameHistory = () => {
    try {
      const storageKey = `bitzimiReactionTap_${stake}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const allGames = JSON.parse(stored);
        setGames(allGames.slice(0, 10));
      } else {
        setGames([]);
      }
    } catch (e) {
      console.error("Error loading Reaction Tap history:", e);
      setGames([]);
    }
  };

  useEffect(() => {
    loadGameHistory();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `bitzimiReactionTap_${stake}`) loadGameHistory();
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(loadGameHistory, 1000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [stake]);

  if (games.length === 0) {
    return (
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <CardContent className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <TrendingUp className="h-8 w-8 text-gray-400 dark:text-gray-600" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No matches yet in this room
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 sticky top-4">
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2">
          {games.map((game, index) => (
            <div
              key={game.id}
              className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                game.result === "win"
                  ? "bg-white dark:bg-gray-800 border-green-200 dark:border-green-800"
                  : "bg-white dark:bg-gray-800 border-red-200 dark:border-red-800"
              }`}
            >
              {/* Top Indicator Strip */}
              <div
                className={`h-1.5 ${
                  game.result === "win"
                    ? "bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"
                    : "bg-gradient-to-r from-red-500 via-orange-500 to-red-500"
                }`}
              />

              <div className="p-3">
                {/* Header: Result Badge & Amount */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                        game.result === "win"
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : "bg-gradient-to-r from-red-500 to-orange-600"
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5 text-white" />
                      <span className="text-xs font-black text-white tracking-wider">
                        {game.result === "win" ? "WIN" : "LOSS"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600">
                      #{games.length - index}
                    </span>
                  </div>
                  <div
                    className={`text-base sm:text-lg font-black ${
                      game.result === "win"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {game.result === "win" ? "+" : "-"}
                    {formatCurrencyNoDecimals(
                      game.result === "win"
                        ? game.winnings - game.stake
                        : game.stake
                    )}
                  </div>
                </div>

                {/* Opponent — avatar derived from opponent name, not stored */}
                <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Users className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">VS</span>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-xs text-white overflow-hidden">
                    <PlayerAvatar avatar={game.opponentName.charAt(0).toUpperCase()} />
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {game.opponentName}
                  </span>
                </div>

                {/* Reaction Times */}
                {game.tappedEarly ? (
                  <div className="bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 rounded-lg px-3 py-2 border border-red-300 dark:border-red-800">
                    <p className="text-xs font-black text-red-700 dark:text-red-300 text-center">
                      ⚠️ Tapped Too Early
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 rounded-lg px-2.5 py-2 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-1 mb-1">
                        <Timer className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        {/* Current user avatar — always from identity */}
                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden text-[9px] text-white">
                          <PlayerAvatar avatar={identity.avatar} />
                        </div>
                        <span className="text-[9px] text-blue-700 dark:text-blue-300 uppercase tracking-wider font-bold">
                          {identity.username}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-blue-700 dark:text-blue-400">
                        {game.yourReactionTime}ms
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 rounded-lg px-2.5 py-2 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-1 mb-1">
                        <Timer className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-[9px] text-purple-700 dark:text-purple-300 uppercase tracking-wider font-bold">
                          Opp
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-400">
                        {game.opponentReactionTime}ms
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Avatar is NOT stored — history records contain only game data
export function addReactionTapGameToHistory(
  record: Omit<ReactionTapGameRecord, "id" | "timestamp">
) {
  try {
    const storageKey = `bitzimiReactionTap_${record.stake}`;
    const history = localStorage.getItem(storageKey);
    const games: ReactionTapGameRecord[] = history ? JSON.parse(history) : [];

    const newRecord: ReactionTapGameRecord = {
      ...record,
      id: `reaction_${record.stake}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    games.unshift(newRecord);
    localStorage.setItem(storageKey, JSON.stringify(games.slice(0, 50)));
  } catch (e) {
    console.error("Error saving Reaction Tap history:", e);
  }
}
