/**
 * useGameWallet — Phase 22.3
 *
 * Fetches the current user's Game Wallet balance.
 * Used by AuctionDetail to show balance before bidding.
 *
 * Reuses GET /api/v1/wallets (existing wallet endpoint).
 */

import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "";
const tok = () => localStorage.getItem("bitzimi_access_token") ?? "";

export function useGameWallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/v1/wallets`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // GET /api/v1/wallets returns { data: { balances: { game: n, ... } } }
      const balances = data.data?.balances ?? data.balances ?? data;
      const gameBalance = balances?.game ?? null;
      setBalance(typeof gameBalance === "number" ? gameBalance : null);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { balance, loading, refresh };
}
