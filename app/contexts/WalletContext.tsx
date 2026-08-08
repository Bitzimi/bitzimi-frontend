import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WalletBalances {
  main: number;
  game: number;
  task: number;
  referral: number;
  affiliate: number;
  ambassador: number;
  taskVault: number; // Locked budget for active tasks — excluded from spendable balance
}

type AffiliateStatus = "not_applied" | "pending" | "approved" | "rejected";

interface AffiliateApplication {
  fullName: string;
  socialPlatform: string;
  totalMembers: number;
  socialLink: string;
  submittedAt: string;
}

// Transaction types for history
export type TransactionType =
  | "task_budget_locked"
  | "task_budget_returned"
  | "task_reward_paid"
  | "task_completed"
  | "task_created"
  | "transfer"
  | "deposit"
  | "withdrawal"
  | "game_bet"
  | "game_win"
  | "game_loss"
  | "reaction_tap_stake"
  | "reaction_tap_win"
  | "affiliate_commission"
  | "vip_purchase"
  | "referral_earned"
  | "affiliate_earned";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  wallet: keyof WalletBalances | "multiple";
  description: string;
  timestamp: string;
  metadata?: any;
}

interface WalletContextType {
  balances: WalletBalances;
  setBalances: (balances: WalletBalances) => void;
  updateBalance: (wallet: keyof WalletBalances, amount: number) => void;
  incrementBalance: (wallet: keyof WalletBalances, amount: number) => void;
  decrementBalance: (wallet: keyof WalletBalances, amount: number) => boolean;
  transfer: (from: keyof WalletBalances, to: keyof WalletBalances, amount: number) => boolean;
  totalBalance: number;
  availableBalance: number;
  getTotalBalance: () => number;
  getTotalBalanceExcludingMain: () => number;
  refreshWalletsFromBackend: () => Promise<void>;
  gameEarnings: number;
  addGameEarnings: (amount: number) => void;
  referralEarnings: number;
  addReferralEarnings: (amount: number) => void;
  totalReferrals: number;
  setTotalReferrals: (count: number) => void;
  affiliateBalance: number;
  setAffiliateBalance: (amount: number) => void;
  decrementAffiliateBalance: (amount: number) => boolean;
  affiliateStatus: AffiliateStatus;
  setAffiliateStatus: (status: AffiliateStatus) => void;
  affiliateApplication: AffiliateApplication | null;
  setAffiliateApplication: (application: AffiliateApplication | null) => void;
  // NEW - Transaction history
  transactions: Transaction[];
  addTransaction: (
    type: TransactionType,
    amount: number,
    wallet: keyof WalletBalances | "multiple",
    description: string,
    metadata?: any
  ) => void;
  getTransactionHistory: (limit?: number) => Transaction[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<WalletBalances>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("bitzimiWalletBalances");
        if (stored) {
          const parsed = JSON.parse(stored);

          // Validate and sanitize all balance values
          const sanitizeBalance = (value: any, defaultValue: number): number => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isFinite(num) && num >= 0 ? num : defaultValue;
          };

          // Migrate old data if affiliate doesn't exist (migrate from 0, not fake 2845)
          if (parsed.affiliate === undefined) {
            const oldAffiliate = localStorage.getItem("bitzimiAffiliateBalance");
            const parsedOld = oldAffiliate ? parseFloat(oldAffiliate) : NaN;
            parsed.affiliate = isFinite(parsedOld) ? parsedOld : 0;
          }

          // Add taskVault if it doesn't exist
          if (parsed.taskVault === undefined) {
            parsed.taskVault = 0;
          }

          // Add ambassador if it doesn't exist
          if (parsed.ambassador === undefined) {
            parsed.ambassador = 0;
          }

          // Sanitize all balances — default fallback is always 0 (real users start empty)
          return {
            main: sanitizeBalance(parsed.main, 0),
            game: sanitizeBalance(parsed.game, 0),
            task: sanitizeBalance(parsed.task, 0),
            referral: sanitizeBalance(parsed.referral, 0),
            affiliate: sanitizeBalance(parsed.affiliate, 0),
            ambassador: sanitizeBalance(parsed.ambassador, 0),
            taskVault: sanitizeBalance(parsed.taskVault, 0),
          };
        }
      }
    } catch (e) {
      console.error("Error loading wallet balances:", e);
    }
    // Real users start with zero balance in all wallets.
    // Balances are earned through tasks, games, referrals, and affiliate/ambassador commissions.
    return {
      main: 0,
      game: 0,
      task: 0,
      referral: 0,
      affiliate: 0,
      ambassador: 0,
      taskVault: 0,
    };
  });

  // Transaction history
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("bitzimiTransactions");
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.error("Error loading transactions:", e);
    }
    return [];
  });

  // Save transactions to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("bitzimiTransactions", JSON.stringify(transactions));
      }
    } catch (e) {
      console.error("Error saving transactions:", e);
    }
  }, [transactions]);

  // Add transaction
  const addTransaction = (
    type: TransactionType,
    amount: number,
    wallet: keyof WalletBalances | "multiple",
    description: string,
    metadata?: any
  ) => {
    const transaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      amount,
      wallet,
      description,
      timestamp: new Date().toISOString(),
      metadata,
    };

    setTransactions((prev) => [transaction, ...prev]);
  };

  const getTransactionHistory = (limit?: number) => {
    return limit ? transactions.slice(0, limit) : transactions;
  };

  // Track game earnings separately
  const [gameEarnings, setGameEarnings] = useState<number>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("bitzimiGameEarnings");
        return stored ? parseFloat(stored) : 0;
      }
    } catch (e) {
      console.error("Error loading game earnings:", e);
    }
    return 0;
  });

  // Save game earnings to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("bitzimiGameEarnings", gameEarnings.toString());
      }
    } catch (e) {
      console.error("Error saving game earnings:", e);
    }
  }, [gameEarnings]);

  // Track referral earnings separately
  const [referralEarnings, setReferralEarnings] = useState<number>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("bitzimiReferralEarnings");
        return stored ? parseFloat(stored) : 0;
      }
    } catch (e) {
      console.error("Error loading referral earnings:", e);
    }
    return 0;
  });

  // Save referral earnings to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("bitzimiReferralEarnings", referralEarnings.toString());
      }
    } catch (e) {
      console.error("Error saving referral earnings:", e);
    }
  }, [referralEarnings]);

  // Track total referrals
  const [totalReferrals, setTotalReferrals] = useState<number>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = localStorage.getItem("bitzimiTotalReferrals");
        return stored ? parseInt(stored) : 0;
      }
    } catch (e) {
      console.error("Error loading total referrals:", e);
    }
    return 0;
  });

  // Save total referrals to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("bitzimiTotalReferrals", totalReferrals.toString());
      }
    } catch (e) {
      console.error("Error saving total referrals:", e);
    }
  }, [totalReferrals]);

  // Track affiliate balance (kept for backward compatibility - synced with balances.affiliate)
  const affiliateBalance = balances.affiliate;

  const setAffiliateBalance = (amount: number) => {
    updateBalance("affiliate", amount);
  };

  const decrementAffiliateBalance = (amount: number): boolean => {
    return decrementBalance("affiliate", amount);
  };

  const updateBalance = (wallet: keyof WalletBalances, amount: number) => {
    setBalances((prev) => {
      const newBalances = {
        ...prev,
        [wallet]: Math.max(0, amount), // SET the new amount directly, don't add
      };

      // Immediately save to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("bitzimiWalletBalances", JSON.stringify(newBalances));
        }
      } catch (e) {
        console.error("Error saving wallet balances in updateBalance:", e);
      }

      return newBalances;
    });
  };

  const incrementBalance = (wallet: keyof WalletBalances, amount: number) => {
    // Defensive check: reject NaN, Infinity, or negative amounts
    if (!isFinite(amount) || amount < 0) {
      console.error(`incrementBalance: Invalid amount ${amount} for wallet ${wallet}`);
      return;
    }

    setBalances((prev) => {
      const newBalances = {
        ...prev,
        [wallet]: Math.max(0, prev[wallet] + amount),
      };

      // Immediately save to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("bitzimiWalletBalances", JSON.stringify(newBalances));
        }
      } catch (e) {
        console.error("Error saving wallet balances in incrementBalance:", e);
      }

      return newBalances;
    });
  };

  const decrementBalance = (wallet: keyof WalletBalances, amount: number): boolean => {
    if (amount <= 0 || balances[wallet] < amount) {
      return false;
    }

    setBalances((prev) => {
      const newBalances = {
        ...prev,
        [wallet]: Math.max(0, prev[wallet] - amount), // SUBTRACT the amount from the current balance
      };

      // Immediately save to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("bitzimiWalletBalances", JSON.stringify(newBalances));
        }
      } catch (e) {
        console.error("Error saving wallet balances in decrementBalance:", e);
      }

      return newBalances;
    });

    return true;
  };

  const transfer = (
    from: keyof WalletBalances,
    to: keyof WalletBalances,
    amount: number
  ): boolean => {
    if (amount <= 0 || balances[from] < amount || from === to) {
      return false;
    }

    setBalances((prev) => {
      const newBalances = {
        ...prev,
        [from]: prev[from] - amount,
        [to]: prev[to] + amount,
      };

      // Immediately save to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("bitzimiWalletBalances", JSON.stringify(newBalances));
        }
      } catch (e) {
        console.error("Error saving wallet balances in transfer:", e);
      }

      return newBalances;
    });

    return true;
  };

  // Backend-computed totals — never calculated on the frontend.
  // Populated by refreshWalletsFromBackend(); default 0 until first sync.
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  // Kept for backward compatibility with components that call these functions.
  // Values come from backend summary, not client-side arithmetic.
  const getTotalBalance = () => totalBalance;
  const getTotalBalanceExcludingMain = () => availableBalance;

  const refreshWalletsFromBackend = async (): Promise<void> => {
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    if (!apiBase) return;
    const token = localStorage.getItem("bitzimi_access_token");
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/v1/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const data: { balances?: Record<string, number>; summary?: { totalBalance: number; availableBalance: number } } = json.data ?? {};

      // Update individual wallet balances
      if (data.balances) {
        setBalances((prev) => {
          const next: WalletBalances = { ...prev };
          for (const [walletType, balance] of Object.entries(data.balances!)) {
            const key = walletType === "task_vault"
              ? "taskVault"
              : walletType as keyof WalletBalances;
            if (key in next) next[key] = balance;
          }
          try { localStorage.setItem("bitzimiWalletBalances", JSON.stringify(next)); } catch {}
          return next;
        });
      }

      // Update backend-computed totals — never calculate these on the frontend
      if (data.summary) {
        setTotalBalance(data.summary.totalBalance);
        setAvailableBalance(data.summary.availableBalance);
      }
    } catch {}
  };

  // Sync wallet balances from backend on mount.
  // Silently no-ops when VITE_API_URL is not set or JWT is absent (offline / dev mode).
  useEffect(() => {
    refreshWalletsFromBackend();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addGameEarnings = (amount: number) => {
    setGameEarnings((prev) => prev + amount);
  };

  const addReferralEarnings = (amount: number) => {
    setReferralEarnings((prev) => prev + amount);
  };

  // Affiliate status and application
  const [affiliateStatus, setAffiliateStatus] = useState<AffiliateStatus>("not_applied");
  const [affiliateApplication, setAffiliateApplication] =
    useState<AffiliateApplication | null>(null);

  // Load affiliate application status from backend on mount
  useEffect(() => {
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    const token = localStorage.getItem("bitzimi_access_token");
    if (!apiBase || !token) return;
    fetch(`${apiBase}/api/v1/affiliates/application`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const app = json?.data ?? null;
        if (app === null) {
          setAffiliateStatus("not_applied");
          setAffiliateApplication(null);
        } else {
          setAffiliateStatus(app.status as AffiliateStatus);
          setAffiliateApplication(app);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <WalletContext.Provider
      value={{
        balances,
        setBalances,
        updateBalance,
        incrementBalance,
        decrementBalance,
        transfer,
        totalBalance,
        availableBalance,
        getTotalBalance,
        getTotalBalanceExcludingMain,
        refreshWalletsFromBackend,
        gameEarnings,
        addGameEarnings,
        referralEarnings,
        addReferralEarnings,
        totalReferrals,
        setTotalReferrals,
        affiliateBalance,
        setAffiliateBalance,
        decrementAffiliateBalance,
        affiliateStatus,
        setAffiliateStatus,
        affiliateApplication,
        setAffiliateApplication,
        transactions,
        addTransaction,
        getTransactionHistory,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
