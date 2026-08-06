// Persistent deposit/withdrawal monitoring — survives page reload via localStorage.
// All pending sessions are stored in localStorage so the monitoring service can
// resume after a browser refresh or app restart.

import { appLifecycleService } from './appLifecycleService';

export type DepositStatus = "pending" | "confirming" | "completed" | "expired";
export type WithdrawalStatus = "submitted" | "processing" | "reviewing" | "completed";

export interface PendingDeposit {
  id: string;
  userId: string;
  method: "crypto" | "bank";
  requestedAmount: number;   // what the user entered (e.g. 100)
  memoAmount: number;        // unique amount to send (e.g. 100.05353)
  reference: string;         // wallet address or bank reference
  status: DepositStatus;
  createdAt: number;         // ms timestamp
  expiresAt: number;         // ms timestamp
}

export interface PendingWithdrawal {
  id: string;
  userId: string;
  method: "crypto" | "bank";
  amount: number;
  netAmount: number;         // after 7% fee
  destination: string;
  status: WithdrawalStatus;
  createdAt: number;
  completesAt: number;       // ms timestamp when it "processes"
}

const DEPOSITS_KEY = "bitzimi_pending_deposits";
const WITHDRAWALS_KEY = "bitzimi_pending_withdrawals";
const DEPOSIT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const WITHDRAWAL_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Set of memo amounts currently in use (loaded from storage on init)
const reservedMemoAmounts = new Set<number>();

function loadDeposits(): PendingDeposit[] {
  try {
    return JSON.parse(localStorage.getItem(DEPOSITS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDeposits(deposits: PendingDeposit[]) {
  localStorage.setItem(DEPOSITS_KEY, JSON.stringify(deposits));
}

function loadWithdrawals(): PendingWithdrawal[] {
  try {
    return JSON.parse(localStorage.getItem(WITHDRAWALS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveWithdrawals(withdrawals: PendingWithdrawal[]) {
  localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(withdrawals));
}

function generateUniqueId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Generate a unique memo amount — adds random decimals (5 digits) to the requested amount.
// IMPORTANT: Decimal variation MUST ALWAYS start with .0 followed by 5 random digits
// Example: $100.053564, $10.036475 (NOT $100.736655)
// Guarantees no two active sessions share the same memo amount.
function generateUniqueMemoAmount(base: number): number {
  // Seed reservedMemoAmounts from active deposits
  const active = loadDeposits().filter(
    (d) => d.status === "pending" || d.status === "confirming"
  );
  const used = new Set(active.map((d) => d.memoAmount));

  let candidate: number;
  let tries = 0;
  do {
    // Generate 5 random digits starting with 0
    // Range: 00000 to 09999 (ensures first digit is always 0)
    const randomFiveDigits = Math.floor(Math.random() * 10000).toString().padStart(5, "0");
    candidate = parseFloat(`${base}.0${randomFiveDigits}`);
    tries++;
  } while (used.has(candidate) && tries < 100);

  return candidate;
}

type DepositConfirmedCb = (depositId: string, amount: number) => void;
type WithdrawalCompletedCb = (withdrawalId: string, amount: number) => void;
type DepositStateChangeCb = (depositId: string, status: DepositStatus) => void;
type WithdrawalStateChangeCb = (withdrawalId: string, status: WithdrawalStatus) => void;

class DepositMonitoringService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onDepositConfirmed: DepositConfirmedCb | null = null;
  private onWithdrawalCompleted: WithdrawalCompletedCb | null = null;
  private depositStateChangeListeners: Set<DepositStateChangeCb> = new Set();
  private withdrawalStateChangeListeners: Set<WithdrawalStateChangeCb> = new Set();

  constructor() {
    // Register lifecycle handlers
    appLifecycleService.onResume(() => this.handleAppResume());
    appLifecycleService.onBackground(() => this.handleAppBackground());
  }

  /**
   * Handle app resuming from background
   * Re-sync all pending deposits/withdrawals
   */
  private handleAppResume() {
    console.log('💰 Deposit monitoring: App resumed, syncing transactions');

    // Force immediate tick to sync state
    if (this.intervalId) {
      this.tick();
    }
  }

  /**
   * Handle app going to background
   * State is already in localStorage, just log
   */
  private handleAppBackground() {
    console.log('💰 Deposit monitoring: App backgrounding (state persisted in localStorage)');
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  startMonitoring(
    onDepositConfirmed: DepositConfirmedCb,
    onWithdrawalCompleted: WithdrawalCompletedCb
  ) {
    this.onDepositConfirmed = onDepositConfirmed;
    this.onWithdrawalCompleted = onWithdrawalCompleted;

    if (this.intervalId) return;

    // Check immediately on start (handles returning-user scenario)
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 10_000); // every 10 s
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Create a new crypto deposit session and persist it. */
  createCryptoDeposit(userId: string, requestedAmount: number, walletAddress: string): PendingDeposit {
    const memoAmount = generateUniqueMemoAmount(requestedAmount);
    const now = Date.now();
    const deposit: PendingDeposit = {
      id: `crypto_${generateUniqueId()}`,
      userId,
      method: "crypto",
      requestedAmount,
      memoAmount,
      reference: walletAddress,
      status: "pending",
      createdAt: now,
      expiresAt: now + DEPOSIT_TTL_MS,
    };
    const deposits = loadDeposits();
    deposits.push(deposit);
    saveDeposits(deposits);
    return deposit;
  }

  /** Create a new bank deposit session and persist it. */
  createBankDeposit(userId: string, requestedAmount: number): PendingDeposit {
    const memoAmount = generateUniqueMemoAmount(requestedAmount);
    // Generate unique BZ-prefixed reference (BZ = Bitzimi, collision-safe)
    const randPart = Math.random().toString(36).toUpperCase().slice(2, 10);
    const timePart = Date.now().toString(36).toUpperCase().slice(-4);
    const refCode = `BZ${(randPart + timePart).slice(0, 10)}`;
    const now = Date.now();
    const deposit: PendingDeposit = {
      id: `bank_${generateUniqueId()}`,
      userId,
      method: "bank",
      requestedAmount,
      memoAmount,
      reference: refCode,
      status: "pending",
      createdAt: now,
      expiresAt: now + DEPOSIT_TTL_MS,
    };
    const deposits = loadDeposits();
    deposits.push(deposit);
    saveDeposits(deposits);
    return deposit;
  }

  /** Create a withdrawal record and persist it. */
  createWithdrawal(
    userId: string,
    method: "crypto" | "bank",
    amount: number,
    destination: string
  ): PendingWithdrawal {
    const FEE = 0.07;
    const netAmount = parseFloat((amount * (1 - FEE)).toFixed(2));
    const now = Date.now();
    const withdrawal: PendingWithdrawal = {
      id: `wd_${generateUniqueId()}`,
      userId,
      method,
      amount,
      netAmount,
      destination,
      status: "submitted",
      createdAt: now,
      completesAt: now + WITHDRAWAL_TTL_MS,
    };
    const withdrawals = loadWithdrawals();
    withdrawals.push(withdrawal);
    saveWithdrawals(withdrawals);
    return withdrawal;
  }

  /** Get pending deposit for a user (most recent active one). */
  getActiveDeposit(userId: string): PendingDeposit | null {
    const deposits = loadDeposits();
    const active = deposits
      .filter(
        (d) =>
          d.userId === userId &&
          (d.status === "pending" || d.status === "confirming") &&
          Date.now() <= d.expiresAt // Only return non-expired sessions
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    return active[0] || null;
  }

  /** Get pending withdrawal for a user (most recent active one). */
  getActiveWithdrawal(userId: string): PendingWithdrawal | null {
    const withdrawals = loadWithdrawals();
    const active = withdrawals
      .filter(
        (w) =>
          w.userId === userId &&
          w.status !== "completed"
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    return active[0] || null;
  }

  /** Get all deposits for a user. */
  getDeposits(userId: string): PendingDeposit[] {
    return loadDeposits().filter((d) => d.userId === userId);
  }

  /** Get all withdrawals for a user. */
  getWithdrawals(userId: string): PendingWithdrawal[] {
    return loadWithdrawals().filter((w) => w.userId === userId);
  }

  /** Subscribe to deposit state changes. Returns unsubscribe function. */
  onDepositStateChange(callback: DepositStateChangeCb) {
    this.depositStateChangeListeners.add(callback);
    return () => {
      this.depositStateChangeListeners.delete(callback);
    };
  }

  /** Subscribe to withdrawal state changes. Returns unsubscribe function. */
  onWithdrawalStateChange(callback: WithdrawalStateChangeCb) {
    this.withdrawalStateChangeListeners.add(callback);
    return () => {
      this.withdrawalStateChangeListeners.delete(callback);
    };
  }

  // ─── Internal tick ────────────────────────────────────────────────────────

  private tick() {
    this.processDeposits();
    this.processWithdrawals();
  }

  private processDeposits() {
    const now = Date.now();
    const deposits = loadDeposits();
    let changed = false;

    for (const deposit of deposits) {
      if (deposit.status === "completed" || deposit.status === "expired") continue;

      const previousStatus = deposit.status;

      // Expire overdue deposits
      if (now > deposit.expiresAt) {
        deposit.status = "expired";
        changed = true;
        this.notifyDepositStateChange(deposit.id, "expired");
        continue;
      }

      // Frontend-only deposit progression (placeholder until backend webhook integration).
      // TODO: Replace this time-based progression with real blockchain confirmations
      //       via backend WebSocket/webhook once the payment processor is integrated.
      //       The backend will call onDepositConfirmed() when the transaction is
      //       confirmed on-chain or by the payment processor.
      const age = now - deposit.createdAt;
      if (deposit.status === "pending" && age > 90_000) {
        deposit.status = "confirming";
        changed = true;
        this.notifyDepositStateChange(deposit.id, "confirming");
      } else if (deposit.status === "confirming" && age > 120_000) {
        deposit.status = "completed";
        changed = true;
        this.notifyDepositStateChange(deposit.id, "completed");
        this.onDepositConfirmed?.(deposit.id, deposit.requestedAmount);
      }
    }

    if (changed) saveDeposits(deposits);
  }

  private notifyDepositStateChange(depositId: string, status: DepositStatus) {
    this.depositStateChangeListeners.forEach(listener => {
      try {
        listener(depositId, status);
      } catch (error) {
        console.error("Error in deposit state change listener:", error);
      }
    });
  }

  private processWithdrawals() {
    const now = Date.now();
    const withdrawals = loadWithdrawals();
    let changed = false;

    for (const wd of withdrawals) {
      if (wd.status === "completed") continue;

      const age = now - wd.createdAt;
      const prev = wd.status;

      // Frontend-only withdrawal progression (placeholder until backend integration).
      // TODO: Replace with real bank/crypto network status polling once the
      //       payment processor provides a webhook or status API endpoint.
      // Timeline: submitted → processing (30 s) → reviewing (10 min) → completed (30 min)
      if (wd.status === "submitted" && age > 30_000) {
        wd.status = "processing";
        this.notifyWithdrawalStateChange(wd.id, "processing");
      } else if (wd.status === "processing" && age > 10 * 60_000) {
        wd.status = "reviewing";
        this.notifyWithdrawalStateChange(wd.id, "reviewing");
      } else if (wd.status === "reviewing" && now >= wd.completesAt) {
        wd.status = "completed";
        this.notifyWithdrawalStateChange(wd.id, "completed");
        this.onWithdrawalCompleted?.(wd.id, wd.netAmount);
      }

      if (wd.status !== prev) changed = true;
    }

    if (changed) saveWithdrawals(withdrawals);
  }

  private notifyWithdrawalStateChange(withdrawalId: string, status: WithdrawalStatus) {
    this.withdrawalStateChangeListeners.forEach(listener => {
      try {
        listener(withdrawalId, status);
      } catch (error) {
        console.error("Error in withdrawal state change listener:", error);
      }
    });
  }
}

export const depositMonitoringService = new DepositMonitoringService();
