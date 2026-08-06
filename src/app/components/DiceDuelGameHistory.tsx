import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useSettings } from "../contexts/SettingsContext";
import { useIdentity } from "../contexts/IdentityContext";
import { PlayerAvatar } from "./PlayerAvatar";

// Avatar is NOT stored in history — resolved at render time from identity
export interface DiceDuelGameRecord {
  id: string;
  opponent: string;
  result: "win" | "loss";
  playerRoll: number;
  opponentRoll: number;
  stake: number;
  winnings: number;
  timestamp: string;
}

export function DiceDuelGameHistory({ stake }: { stake: number }) {
  const { formatCurrencyNoDecimals } = useSettings();
  const { identity } = useIdentity();
  const [games, setGames] = useState<DiceDuelGameRecord[]>([]);

  const loadGameHistory = () => {
    try {
      const storageKey = `bitzimiDiceClash_${stake}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const allGames = JSON.parse(stored);
        setGames(allGames.slice(0, 10));
      } else {
        setGames([]);
      }
    } catch (e) {
      console.error("Error loading Dice Clash history:", e);
      setGames([]);
    }
  };

  useEffect(() => {
    loadGameHistory();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `bitzimiDiceClash_${stake}`) loadGameHistory();
    };
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(loadGameHistory, 1000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [stake]);

  if (games.length === 0) return null;

  return (
    <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-900 dark:text-white">
          Recent Clash Rounds ({formatCurrencyNoDecimals(stake)})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {/* Current user avatar — always from identity */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden text-sm">
                    <PlayerAvatar avatar={identity.avatar} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          game.result === "win"
                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                            : "bg-red-500/20 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {game.result === "win" ? "WIN" : "LOSS"}
                      </span>
                      {/* Opponent avatar — derived from opponent name at render time */}
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs text-white overflow-hidden">
                        <PlayerAvatar avatar={game.opponent.charAt(0).toUpperCase()} />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        vs {game.opponent}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-500 mt-1">
                      Dice:{" "}
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {game.playerRoll}
                      </span>{" "}
                      vs{" "}
                      <span className="font-bold text-red-600 dark:text-red-400">
                        {game.opponentRoll}
                      </span>
                      <span className="mx-2">•</span>
                      {new Date(game.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-base font-bold ${
                    game.result === "win"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {game.result === "win" ? "+" : "-"}
                  {formatCurrencyNoDecimals(
                    game.result === "win" ? game.winnings - game.stake : game.stake
                  )}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-500">
                  Stake: {formatCurrencyNoDecimals(game.stake)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Avatar is NOT stored — history records only contain game data
export function addDiceDuelGameToHistory(
  record: Omit<DiceDuelGameRecord, "id" | "timestamp">
) {
  try {
    const storageKey = `bitzimiDiceClash_${record.stake}`;
    const history = localStorage.getItem(storageKey);
    const games: DiceDuelGameRecord[] = history ? JSON.parse(history) : [];

    const newRecord: DiceDuelGameRecord = {
      ...record,
      id: `clash_${record.stake}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    games.unshift(newRecord);
    localStorage.setItem(storageKey, JSON.stringify(games.slice(0, 50)));
  } catch (e) {
    console.error("Error saving Dice Clash history:", e);
  }
}
