import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type GameResult = { id: string; gameType: string; lobby?: string; betAmount: number; winAmount: number; profit: number; timestamp: string; won: boolean; opponent?: string; outcome?: string; };
type GameStats = { totalGames: number; totalWins: number; totalLosses: number; totalProfit: number; winRate: number; gameHistory: GameResult[]; };
type GameStatsContextType = { stats: GameStats; addGameResult: (result: Omit<GameResult, "id" | "timestamp">) => void; resetStats: () => void; refreshStatsFromBackend: () => Promise<void>; };
const GameStatsContext = createContext<GameStatsContextType | undefined>(undefined);
const INITIAL_STATS: GameStats = { totalGames: 0, totalWins: 0, totalLosses: 0, totalProfit: 0, winRate: 0, gameHistory: [] };
const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function token() { return localStorage.getItem("bitzimi_access_token"); }
export function GameStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const refreshStatsFromBackend = useCallback(async () => {
    if (!API_BASE || !token()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/games/stats`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const json = await res.json();
      const o = json?.data?.overall;
      if (!o) return;
      setStats({ totalGames: Number(o.totalGames ?? 0), totalWins: Number(o.wins ?? 0), totalLosses: Number(o.losses ?? 0), totalProfit: Number(o.profit ?? 0), winRate: Number(o.winRate ?? 0), gameHistory: [] });
    } catch {}
  }, []);
  useEffect(() => { refreshStatsFromBackend(); }, [refreshStatsFromBackend]);
  const addGameResult = (_result: Omit<GameResult, "id" | "timestamp">) => { refreshStatsFromBackend(); };
  const resetStats = () => { refreshStatsFromBackend(); };
  return <GameStatsContext.Provider value={{ stats, addGameResult, resetStats, refreshStatsFromBackend }}>{children}</GameStatsContext.Provider>;
}
export function useGameStats() { const context = useContext(GameStatsContext); if (!context) throw new Error("useGameStats must be used within GameStatsProvider"); return context; }
