import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useSettings } from "../contexts/SettingsContext";

export interface DiceRoyaleGameRecord {
  id: string;
  playerCount: number;
  result: "win" | "loss";
  playerRoll: number;
  winningRoll: number;
  stake: number;
  winnings: number;
  timestamp: string;
}

export function DiceRoyaleGameHistory({ stake }: { stake: number }) {
  const { formatCurrencyNoDecimals } = useSettings();
  const [games, setGames] = useState<DiceRoyaleGameRecord[]>([]);

  const loadGameHistory = () => {
    try {
      const storageKey = `bitzimiDiceRoyale_${stake}`;
      const stored = localStorage.getItem(storageKey);
      console.log(`🔍 Loading Royale $${stake} history from ${storageKey}:`, stored ? `${JSON.parse(stored).length} games` : 'EMPTY');
      if (stored) {
        const allGames = JSON.parse(stored);
        setGames(allGames.slice(0, 10));
      } else {
        setGames([]);
      }
    } catch (e) {
      console.error("Error loading Dice Royale history:", e);
      setGames([]);
    }
  };

  useEffect(() => {
    loadGameHistory();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `bitzimiDiceRoyale_${stake}`) {
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
        <CardTitle className="text-base text-gray-900 dark:text-white">Recent Royale Rounds ({formatCurrencyNoDecimals(stake)})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                game.result === "win"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold ${game.result === "win" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {game.result === "win" ? "WIN" : "LOSS"}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">•</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{game.playerCount} Players</span>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-400">
                  Your Roll: <span className="text-amber-600 dark:text-amber-400 font-semibold">{game.playerRoll}</span>
                  {" • "}
                  Winning Roll: <span className="text-green-600 dark:text-green-400 font-semibold">{game.winningRoll}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-gray-500">Stake: {formatCurrencyNoDecimals(game.stake)}</div>
                {game.result === "win" && (
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">
                    +{formatCurrencyNoDecimals(game.winnings - game.stake)}
                  </div>
                )}
                {game.result === "loss" && (
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

export function addDiceRoyaleGameToHistory(record: Omit<DiceRoyaleGameRecord, "id" | "timestamp">) {
  try {
    const storageKey = `bitzimiDiceRoyale_${record.stake}`;
    const history = localStorage.getItem(storageKey);
    const games: DiceRoyaleGameRecord[] = history ? JSON.parse(history) : [];

    const newRecord: DiceRoyaleGameRecord = {
      ...record,
      id: `royale_${record.stake}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    games.unshift(newRecord);
    const trimmed = games.slice(0, 50);

    localStorage.setItem(storageKey, JSON.stringify(trimmed));
    console.log(`✅ Saved Royale $${record.stake} game to ${storageKey}`, newRecord);
    console.log(`📊 Total games in ${storageKey}:`, trimmed.length);
  } catch (e) {
    console.error("Error saving Dice Royale history:", e);
  }
}
