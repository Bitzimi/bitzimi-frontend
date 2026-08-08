import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { useSettings } from "../contexts/SettingsContext";

export interface PvPGameRecord {
  id: string;
  opponent: string;
  result: "win" | "loss";
  amount: number;
  stake: number;
  timestamp: string;
}

export function PvPGameHistory() {
  const { formatCurrencyNoDecimals } = useSettings();

  // Load game history from localStorage
  const getGameHistory = (): PvPGameRecord[] => {
    try {
      const stored = localStorage.getItem("bitzimiPvPGameHistory");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading game history:", e);
    }
    return [];
  };

  const games = getGameHistory().slice(0, 10); // Show last 10 games

  if (games.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Games</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    game.result === "win"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {game.result === "win" ? "WIN" : "LOSS"}
                  </span>
                  <span className="text-sm text-gray-400">vs {game.opponent}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(game.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-base font-bold ${
                  game.result === "win" ? "text-green-400" : "text-red-400"
                }`}>
                  {game.result === "win" ? "+" : "-"}{formatCurrencyNoDecimals(game.amount)}
                </div>
                <div className="text-xs text-gray-500">
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

// Helper function to add game to history
export function addPvPGameToHistory(record: Omit<PvPGameRecord, "id" | "timestamp">) {
  try {
    const history = localStorage.getItem("bitzimiPvPGameHistory");
    const games: PvPGameRecord[] = history ? JSON.parse(history) : [];

    const newRecord: PvPGameRecord = {
      ...record,
      id: `pvp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    games.unshift(newRecord);

    // Keep only last 50 games
    const trimmed = games.slice(0, 50);

    localStorage.setItem("bitzimiPvPGameHistory", JSON.stringify(trimmed));
  } catch (e) {
    console.error("Error saving game history:", e);
  }
}
