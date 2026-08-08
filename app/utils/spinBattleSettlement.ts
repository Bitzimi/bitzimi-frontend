/**
 * Spin Battle Settlement — persisted idempotency guard.
 *
 * Stores settled round results in localStorage so that payout execution is
 * idempotent across every code path (live handler, retroactive processor,
 * global monitor) and across component remounts, refreshes, and crashes.
 *
 * Key: `spinBattle_${lobbyId}_settled`
 * Value: Record<roundNumber, SettledResult>
 *
 * Rules:
 * - Check isRoundSettled() BEFORE any balance/transaction/notification change.
 * - Call markRoundSettled() ATOMICALLY with the first payout execution.
 * - getSettledResult() lets display components reconcile local UI state.
 */

export interface SettledResult {
  won: boolean;
  payout: number;
  betAmount: number;
  timestamp: number;
}

function storageKey(lobbyId: string): string {
  return `spinBattle_${lobbyId}_settled`;
}

function loadMap(lobbyId: string): Record<string, SettledResult> {
  try {
    const raw = localStorage.getItem(storageKey(lobbyId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMap(lobbyId: string, map: Record<string, SettledResult>): void {
  // Prune to last 300 rounds to prevent unbounded growth
  const keys = Object.keys(map).map(Number).sort((a, b) => b - a);
  if (keys.length > 300) {
    keys.slice(300).forEach(k => delete map[String(k)]);
  }
  localStorage.setItem(storageKey(lobbyId), JSON.stringify(map));
}

/** Returns true if this round has already been settled (payout already executed). */
export function isRoundSettled(lobbyId: string, roundNumber: number): boolean {
  return !!loadMap(lobbyId)[String(roundNumber)];
}

/**
 * Marks a round as settled and stores the result.
 * No-op if already settled (idempotent).
 * Returns false if the round was already settled (caller should abort processing).
 */
export function markRoundSettled(
  lobbyId: string,
  roundNumber: number,
  result: SettledResult,
): boolean {
  const map = loadMap(lobbyId);
  const key = String(roundNumber);
  if (map[key]) return false; // Already settled — caller must abort
  map[key] = result;
  saveMap(lobbyId, map);
  return true; // Newly settled — safe to proceed
}

/** Returns the stored result for display reconciliation, or null if not settled. */
export function getSettledResult(
  lobbyId: string,
  roundNumber: number,
): SettledResult | null {
  return loadMap(lobbyId)[String(roundNumber)] ?? null;
}
