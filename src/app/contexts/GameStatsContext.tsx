import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type GameResult = {
  id: string;
  gameType: "color_prediction" | "football_ai" | "pvp_coinflip" | "spin_battle" | "reaction_tap" | "dice_duel";
  lobby?: string;
  betAmount: number;
  winAmount: number;
  profit: number; // Can be negative for losses
  timestamp: string;
  won: boolean;
  opponent?: string; // For PvP games
  outcome?: string; // For PvP games (e.g., "heads", "tails")
};

type GameStats = {
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalProfit: number; // Net profit (wins - losses)
  winRate: number; // Percentage
  gameHistory: GameResult[];
};

type GameStatsContextType = {
  stats: GameStats;
  addGameResult: (result: Omit<GameResult, "id" | "timestamp">) => void;
  resetStats: () => void;
};

const GameStatsContext = createContext<GameStatsContextType | undefined>(undefined);

const INITIAL_STATS: GameStats = {
  totalGames: 0,
  totalWins: 0,
  totalLosses: 0,
  totalProfit: 0,
  winRate: 0,
  gameHistory: [],
};

export function GameStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<GameStats>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem("bitzimiGameStats");
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.error("Error loading game stats:", e);
    }
    return INITIAL_STATS;
  });

  // Save to localStorage whenever stats change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem("bitzimiGameStats", JSON.stringify(stats));
      }
    } catch (e) {
      console.error("Error saving game stats:", e);
    }
  }, [stats]);

  const addGameResult = (result: Omit<GameResult, "id" | "timestamp">) => {
    setStats((prev) => {
      const newResult: GameResult = {
        ...result,
        id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      };

      const totalGames = prev.totalGames + 1;
      const totalWins = prev.totalWins + (result.won ? 1 : 0);
      const totalLosses = prev.totalLosses + (result.won ? 0 : 1);
      const totalProfit = prev.totalProfit + result.profit;
      const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

      return {
        totalGames,
        totalWins,
        totalLosses,
        totalProfit,
        winRate,
        gameHistory: [newResult, ...prev.gameHistory].slice(0, 100), // Keep last 100 games
      };
    });
  };

  const resetStats = () => {
    setStats(INITIAL_STATS);
    localStorage.removeItem("bitzimiGameStats");
  };

  return (
    <GameStatsContext.Provider value={{ stats, addGameResult, resetStats }}>
      {children}
    </GameStatsContext.Provider>
  );
}

export function useGameStats() {
  const context = useContext(GameStatsContext);
  if (!context) {
    throw new Error("useGameStats must be used within GameStatsProvider");
  }
  return context;
}