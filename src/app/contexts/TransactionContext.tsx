import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const _API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _getToken() { return localStorage.getItem("bitzimi_access_token"); }

function _mapBackendType(type: string): TransactionType {
  const m: Record<string, TransactionType> = {
    deposit: "deposit", withdrawal: "withdrawal", transfer: "transfer",
    game_win: "game_win", game_loss: "game_loss", game_bet: "game_bet", game_void: "game_void",
    task_reward: "task_reward", referral_bonus: "referral_bonus",
    referral_earned: "referral_bonus", affiliate_earned: "affiliate_commission",
    affiliate_commission: "affiliate_commission", commission: "referral_bonus",
    vip_purchase: "vip_purchase", streak_reward: "streak_reward",
  };
  return m[type] ?? (type as TransactionType);
}
function _mapBackendStatus(status: string): TransactionStatus {
  const m: Record<string, TransactionStatus> = {
    completed: "completed", pending: "pending", confirming: "confirming",
    failed: "failed", expired: "expired", approved: "completed",
    rejected: "failed", submitted: "pending", processing: "pending", reviewing: "pending",
  };
  return m[status] ?? "pending";
}
function _parseMetadata(raw: any) {
  if (!raw) return {};
  if (typeof raw === "object") return { ...raw };
  try { return JSON.parse(raw); } catch { return {}; }
}
function _normalizeGameMetadata(amount: number, raw: any) {
  const metadata = _parseMetadata(raw);
  let gameType = String(metadata.gameType || metadata.game || metadata.game_type || "").toLowerCase().replace(/[-\s]/g, "_");
  const description = String(metadata.__transactionDescription || "").toLowerCase();

  // Older ledger rows may have a human description but incomplete metadata. Recover only
  // the game identity that is explicitly present in that recorded description.
  if (!gameType) {
    if (description.includes("colour prediction") || description.includes("color prediction") || description.includes("colour game") || description.includes("color game")) gameType = "color_game";
    else if (description.includes("dice clash")) gameType = "dice_clash";
    else if (description.includes("dice royale")) gameType = "dice_royale";
    else if (description.includes("dice arena")) gameType = "dice_arena";
    else if (description.includes("coin flip")) gameType = "pvp_coinflip";
    else if (description.includes("spin battle")) gameType = "spin_battle";
    if (gameType) metadata.gameType = gameType;
  } else {
    metadata.gameType = gameType;
  }

  // Colour Prediction is a lobby-based game. Preserve a recorded lobby; only use the
  // established lobby bands when an older Colour Prediction record has no lobby field.
  if (gameType === "color_game" || gameType === "color_prediction") {
    if (metadata.lobby == null && metadata.lobbyId == null && metadata.lobbyName == null) {
      metadata.lobby = amount <= 20 ? "A" : amount <= 50 ? "B" : amount <= 120 ? "C" : "D";
    }
  }

  delete metadata.__transactionDescription;
  return metadata;
}
function _formatGameDescription(type: string, amount: number, metadata: any, fallback: string) {
  if (!["game_win", "game_loss", "game_bet", "game_void"].includes(type)) return fallback;
  const gameType = String(metadata?.gameType || metadata?.game || metadata?.game_type || "").toLowerCase().replace(/[-\s]/g, "_");
  const names: Record<string, string> = {
    color_game: "Colour Prediction", color_prediction: "Colour Prediction", colour_prediction: "Colour Prediction", spin_battle: "Spin Battle",
    dice_clash: "Dice Clash", dice_royale: "Dice Royale", dice_arena: "Dice Arena",
    coin_flip: "Coin Flip", pvp_coinflip: "Coin Flip", pvp_coin_flip: "Coin Flip", reaction_tap: "Reaction Tap",
  };
  if (!gameType) return fallback;
  const game = names[gameType] || gameType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const action = type === "game_loss" ? "Loss" : type === "game_win" ? "Win" : type === "game_bet" ? "Bet" : "Void";
  const lobby = metadata?.lobby ?? metadata?.lobbyName ?? metadata?.lobby_name ?? metadata?.lobbyId;
  const stake = metadata?.stake ?? metadata?.stakeAmount ?? metadata?.roomStake ?? metadata?.stakeRoom ?? metadata?.stake_room;
  // Lobby-based games use Lobby X. Stake-selection games use Stake Room $X.
  const context = lobby != null && String(lobby).trim() !== ""
    ? `Lobby ${String(lobby).replace(/^Lobby\s*/i, "")}`
    : stake != null && String(stake).trim() !== "" ? `Stake Room $${Number(stake).toLocaleString()}` : null;
  return `${game} ${action}${context ? ` - ${context}` : ""}`;
}
function _backendToLocal(tx: any): Transaction {
  const amount = typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.netAmount ?? tx.amount ?? 0));
  const rawMetadata = _parseMetadata(tx.metadata);
  const metadata = _normalizeGameMetadata(Math.abs(amount), { ...rawMetadata, __transactionDescription: tx.description ?? "" });
  const fallbackDescription = tx.description ?? tx.type?.replace(/_/g, " ") ?? "Transaction";
  return {
    id: tx.id,
    type: _mapBackendType(tx.type),
    amount: Math.abs(amount),
    status: _mapBackendStatus(tx.status),
    createdAt: tx.createdAt,
    description: _formatGameDescription(tx.type, Math.abs(amount), metadata, fallbackDescription),
    metadata,
  };
}

export type TransactionType = string;
export type TransactionStatus = "completed" | "pending" | "confirming" | "failed" | "expired";
export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  description: string;
  metadata?: { fromWallet?: string; toWallet?: string; gameType?: string; lobby?: string; depositId?: string; withdrawalId?: string; uniqueAmount?: number; method?: string; [key: string]: any; };
};

type TransactionContextType = {
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, "id" | "createdAt">) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id" | "createdAt">>) => void;
  getTransactionByDepositId: (depositId: string) => Transaction | undefined;
  getTransactionByWithdrawalId: (withdrawalId: string) => Transaction | undefined;
  clearTransactions: () => void;
  refreshTransactionsFromBackend: () => Promise<void>;
};
const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const refreshTransactionsFromBackend = useCallback(async () => {
    if (!_API_BASE || !_getToken()) return;
    try {
      const res = await fetch(`${_API_BASE}/api/v1/transactions?limit=100`, { headers: { Authorization: `Bearer ${_getToken()}` } });
      if (!res.ok) return;
      const json = await res.json();
      const backendItems: Transaction[] = (json.data?.items ?? []).map(_backendToLocal);
      setTransactions((prev) => {
        const backendIds = new Set(backendItems.map((t) => t.id));
        const localOnly = prev.filter((t) => !backendIds.has(t.id) && (t.status === "pending" || t.status === "confirming") && (t.metadata?.depositId || t.metadata?.withdrawalId));
        const merged = [...backendItems, ...localOnly].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        try { localStorage.setItem("bitzimiTransactions", JSON.stringify(merged)); } catch {}
        return merged;
      });
    } catch {}
  }, []);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem("bitzimiTransactions");
        if (stored) return JSON.parse(stored);
      }
    } catch (e) { console.error("Error loading transactions:", e); }
    return [];
  });
  useEffect(() => { try { localStorage.setItem("bitzimiTransactions", JSON.stringify(transactions)); } catch {} }, [transactions]);
  useEffect(() => { refreshTransactionsFromBackend(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTransaction = (transaction: Omit<Transaction, "id" | "createdAt">) => {
    const newTransaction: Transaction = { ...transaction, id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, createdAt: new Date().toISOString() };
    setTransactions((prev) => { const updated = [newTransaction, ...prev].slice(0, 100); try { localStorage.setItem("bitzimiTransactions", JSON.stringify(updated)); } catch {} return updated; });
  };
  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, "id" | "createdAt">>) => {
    setTransactions((prev) => { const updated = prev.map((tx) => tx.id === id ? { ...tx, ...updates } : tx); try { localStorage.setItem("bitzimiTransactions", JSON.stringify(updated)); } catch {} return updated; });
  };
  const getTransactionByDepositId = (depositId: string) => transactions.find(tx => tx.metadata?.depositId === depositId);
  const getTransactionByWithdrawalId = (withdrawalId: string) => transactions.find(tx => tx.metadata?.withdrawalId === withdrawalId);
  const clearTransactions = () => { setTransactions([]); localStorage.removeItem("bitzimiTransactions"); };
  return <TransactionContext.Provider value={{ transactions, addTransaction, updateTransaction, getTransactionByDepositId, getTransactionByWithdrawalId, clearTransactions, refreshTransactionsFromBackend }}>{children}</TransactionContext.Provider>;
}
export function useTransactions() { const context = useContext(TransactionContext); if (!context) throw new Error("useTransactions must be used within TransactionProvider"); return context; }