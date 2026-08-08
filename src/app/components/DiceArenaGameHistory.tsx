import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useSettings } from "../contexts/SettingsContext";

export interface DiceArenaGameRecord {
  id: string;
  playerCount: number;
  placement: "first" | "second" | "loss";
  playerRoll: number;
  firstPlaceRoll: number;
  secondPlaceRoll: number;
  stake: number;
  winnings: number;
  timestamp: string;
}

export function DiceArenaGameHistory({ stake }: { stake: number }) {
  const { formatCurrencyNoDecimals } = useSettings();
  const [games, setGames] = useState<DiceArenaGameRecord[]>([]);

  const loadGameHistory = () => {
    try {
      const storageKey = `bitzimiDiceArena_${stake}`;
      const stored = localStorage.getItem(storageKey);
      console.log(`🔍 Loading Arena $${stake} history from ${storageKey}:`, stored ? `${JSON.parse(stored).length} games` : 'EMPTY');
      if (stored) {
        const allGames = JSON.parse(stored);
        setGames(allGames.slice(0, 10));
      } else {
        setGames([]);
      }
    } catch (e) {
      console.error("Error loading Dice Arena history:", e);
      setGames([]);
    }
  };

  useEffect(() => {
    loadGameHistory();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `bitzimiDiceArena_${stake}`) {
        loadGameHistory();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(loadGameHistory, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [stake]);

  if (games.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-gray-900 dark:text-white">Recent Arena Rounds ({formatCurrencyNoDecimals(stake)})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                game.placement === "first"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50"
                  : game.placement === "second"
                  ? "bg-gray-50 dark:bg-gray-700/20 border-gray-200 dark:border-gray-600/50"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold ${
                    game.placement === "first" ? "text-amber-600 dark:text-amber-400" :
                    game.placement === "second" ? "text-gray-700 dark:text-gray-300" :
                    "text-red-600 dark:text-red-400"
                  }`}>
                    {game.placement === "first" ? "🥇 1ST" : game.placement === "second" ? "🥈 2ND" : "LOSS"}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">•</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{game.playerCount} Players</span>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-400">
                  Your Roll: <span className="text-purple-600 dark:text-purple-400 font-semibold">{game.playerRoll}</span>
                  {" • "}
                  Top Rolls: <span className="text-amber-600 dark:text-amber-400 font-semibold">{game.firstPlaceRoll}</span>
                  {", "}
                  <span className="text-gray-700 dark:text-gray-300 font-semibold">{game.secondPlaceRoll}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-gray-500">Stake: {formatCurrencyNoDecimals(game.stake)}</div>
                {game.placement !== "loss" && (
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    +{formatCurrencyNoDecimals(game.winnings - game.stake)}
                  </div>
                )}
                {game.placement === "loss" && (
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">
                    -{formatCurrencyNoDecimals(game.stake)}
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

export function addDiceArenaGameToHistory(record: Omit<DiceArenaGameRecord, "id" | "timestamp">) {
  try {
    const storageKey = `bitzimiDiceArena_${record.stake}`;
    const history = localStorage.getItem(storageKey);
    const games: DiceArenaGameRecord[] = history ? JSON.parse(history) : [];

    const newRecord: DiceArenaGameRecord = {
      ...record,
      id: `arena_${record.stake}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    games.unshift(newRecord);
    const trimmed = games.slice(0, 50);

    localStorage.setItem(storageKey, JSON.stringify(trimmed));
    console.log(`✅ Saved Arena $${record.stake} game to ${storageKey}`, newRecord);
    console.log(`📊 Total games in ${storageKey}:`, trimmed.length);
  } catch (e) {
    console.error("Error saving Dice Arena history:", e);
  }
}
