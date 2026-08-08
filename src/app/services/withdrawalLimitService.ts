/**
 * Withdrawal Limit Service
 *
 * Enforces daily and monthly withdrawal caps per user tier.
 * Limits reset at 00:00 UTC (daily) and 1st of month UTC (monthly).
 * All amounts are in USD.
 */

export type UserTier = "free" | "verified" | "vip";

export interface TierLimits {
  daily: number;
  monthly: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free:     { daily: 100,    monthly: 1_000   },
  verified: { daily: 1_000,  monthly: 10_000  },
  vip:      { daily: 10_000, monthly: 100_000 },
};

interface LimitRecord {
  date: string;   // YYYY-MM-DD (UTC)
  month: string;  // YYYY-MM (UTC)
  dailyUsed: number;
  monthlyUsed: number;
}

const STORAGE_KEY = "bitzimiWithdrawalLimits";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function thisMonthUTC(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

class WithdrawalLimitService {
  private getRecord(): LimitRecord {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { date: todayUTC(), month: thisMonthUTC(), dailyUsed: 0, monthlyUsed: 0 };
  }

  private saveRecord(record: LimitRecord): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }

  /** Returns current usage with auto-reset logic applied. */
  getUsed(): { dailyUsed: number; monthlyUsed: number } {
    const rec = this.getRecord();
    const today = todayUTC();
    const thisMonth = thisMonthUTC();

    return {
      dailyUsed: rec.date === today ? rec.dailyUsed : 0,
      monthlyUsed: rec.month === thisMonth ? rec.monthlyUsed : 0,
    };
  }

  /** Returns remaining limits for a given tier. */
  getRemaining(tier: UserTier): { dailyRemaining: number; monthlyRemaining: number } {
    const limits = TIER_LIMITS[tier];
    const { dailyUsed, monthlyUsed } = this.getUsed();
    return {
      dailyRemaining: Math.max(0, limits.daily - dailyUsed),
      monthlyRemaining: Math.max(0, limits.monthly - monthlyUsed),
    };
  }

  /**
   * Check if a withdrawal amount is within limits.
   * Returns { allowed, reason, dailyRemaining, monthlyRemaining }.
   */
  check(amount: number, tier: UserTier): {
    allowed: boolean;
    reason?: string;
    dailyRemaining: number;
    monthlyRemaining: number;
  } {
    const { dailyRemaining, monthlyRemaining } = this.getRemaining(tier);

    if (amount > dailyRemaining) {
      return {
        allowed: false,
        reason: `Daily withdrawal limit exceeded. Remaining today: $${dailyRemaining.toLocaleString()}`,
        dailyRemaining,
        monthlyRemaining,
      };
    }

    if (amount > monthlyRemaining) {
      return {
        allowed: false,
        reason: `Monthly withdrawal limit exceeded. Remaining this month: $${monthlyRemaining.toLocaleString()}`,
        dailyRemaining,
        monthlyRemaining,
      };
    }

    return { allowed: true, dailyRemaining, monthlyRemaining };
  }

  /** Record a completed withdrawal. Must be called after successful submission. */
  record(amount: number): void {
    const today = todayUTC();
    const thisMonth = thisMonthUTC();
    const rec = this.getRecord();

    const newRecord: LimitRecord = {
      date: today,
      month: thisMonth,
      dailyUsed: (rec.date === today ? rec.dailyUsed : 0) + amount,
      monthlyUsed: (rec.month === thisMonth ? rec.monthlyUsed : 0) + amount,
    };

    this.saveRecord(newRecord);
  }

  /** Returns a formatted display string for the limits UI. */
  formatLimit(amount: number): string {
    return `$${amount.toLocaleString()}`;
  }
}

export const withdrawalLimitService = new WithdrawalLimitService();
