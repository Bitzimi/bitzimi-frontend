import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const _API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _getToken() { return localStorage.getItem("bitzimi_access_token"); }

function _mapBackendType(type: string): TransactionType {
  const m: Record<string, TransactionType> = {
    deposit: "deposit", withdrawal: "withdrawal", transfer: "transfer",
    game_win: "game_win", game_loss: "game_loss", game_bet: "game_loss",
    task_reward: "task_reward", referral_bonus: "referral_bonus",
    referral_earned: "referral_bonus", affiliate_earned: "referral_bonus",
    affiliate_commission: "referral_bonus", commission: "referral_bonus",
    vip_purchase: "withdrawal", streak_reward: "deposit",
  };
  return m[type] ?? "deposit";
}
function _mapBackendStatus(status: string): TransactionStatus {
  const m: Record<string, TransactionStatus> = {
    completed: "completed", pending: "pending", confirming: "confirming",
    failed: "failed", expired: "expired", approved: "completed",
    rejected: "failed", submitted: "pending", processing: "pending", reviewing: "pending",
  };
  return m[status] ?? "pending";
}
function _backendToLocal(tx: any): Transaction {
  const amount = typeof tx.amount === "number" ? tx.amount : parseFloat(String(tx.netAmount ?? tx.amount ?? 0));
  return {
    id: tx.id,
    type: _mapBackendType(tx.type),
    amount: Math.abs(amount),
    status: _mapBackendStatus(tx.status),
    createdAt: tx.createdAt,
    description: tx.description ?? tx.type?.replace(/_/g, " ") ?? "Transaction",
    metadata: tx.metadata
      ? (typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata)
      : undefined,
  };
}

export type TransactionType = 
  | "deposit" 
  | "withdrawal" 
  | "transfer" 
  | "game_win" 
  | "game_loss" 
  | "task_reward" 
  | "referral_bonus";

export type TransactionStatus = "completed" | "pending" | "confirming" | "failed" | "expired";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  description: string;
  metadata?: {
    fromWallet?: string;
    toWallet?: string;
    gameType?: string;
    lobby?: string;
    depositId?: string;
    withdrawalId?: string;
    uniqueAmount?: number;
    method?: string;
    [key: string]: any;
  };
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
      const res = await fetch(`${_API_BASE}/api/v1/transactions?limit=100`, {
        headers: { Authorization: `Bearer ${_getToken()}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const backendItems: Transaction[] = (json.data?.items ?? []).map(_backendToLocal);
      if (backendItems.length === 0) return;
      setTransactions((prev) => {
        const backendIds = new Set(backendItems.map((t) => t.id));
        // Keep local-only pending deposit/withdrawal records not yet in backend
        const localOnly = prev.filter(
          (t) =>
            !backendIds.has(t.id) &&
            (t.status === "pending" || t.status === "confirming") &&
            (t.metadata?.depositId || t.metadata?.withdrawalId)
        );
        const merged = [...backendItems, ...localOnly].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        try { localStorage.setItem("bitzimiTransactions", JSON.stringify(merged)); } catch {}
        return merged;
      });
    } catch {}
  }, []);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem("bitzimiTransactions");
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.error("Error loading transactions:", e);
    }
    
    // New users start with an empty transaction history.
    // All transactions are earned through real activity (deposits, withdrawals,
    // game wins, task completions, referrals, affiliate commissions).
    return [];
  });

  // Persist local state to localStorage
  useEffect(() => {
    try { localStorage.setItem("bitzimiTransactions", JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  // Sync from backend on mount
  useEffect(() => { refreshTransactionsFromBackend(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTransaction = (transaction: Omit<Transaction, "id" | "createdAt">) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => {
      const updated = [newTransaction, ...prev].slice(0, 100);

      // Immediately save to localStorage to prevent loss on rapid state changes
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem("bitzimiTransactions", JSON.stringify(updated));
        }
      } catch (e) {
        console.error("Error saving transaction immediately:", e);
      }

      return updated;
    });
  };

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, "id" | "createdAt">>) => {
    setTransactions((prev) => {
      const updated = prev.map((tx) =>
        tx.id === id ? { ...tx, ...updates } : tx
      );

      // Immediately save to localStorage
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem("bitzimiTransactions", JSON.stringify(updated));
        }
      } catch (e) {
        console.error("Error saving transaction update immediately:", e);
      }

      return updated;
    });
  };

  const getTransactionByDepositId = (depositId: string): Transaction | undefined => {
    return transactions.find(tx => tx.metadata?.depositId === depositId);
  };

  const getTransactionByWithdrawalId = (withdrawalId: string): Transaction | undefined => {
    return transactions.find(tx => tx.metadata?.withdrawalId === withdrawalId);
  };

  const clearTransactions = () => {
    setTransactions([]);
    localStorage.removeItem("bitzimiTransactions");
  };

  return (
    <TransactionContext.Provider value={{
      transactions,
      addTransaction,
      updateTransaction,
      getTransactionByDepositId,
      getTransactionByWithdrawalId,
      clearTransactions,
      refreshTransactionsFromBackend,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTransactions must be used within TransactionProvider");
  }
  return context;
}
