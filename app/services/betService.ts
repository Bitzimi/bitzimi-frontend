export interface UserBet {
  id: string;
  roundNumber: number;
  team: "red" | "blue";
  amount: number;
  timestamp: number;
  result?: "win" | "loss";
  payout?: number;
  lobbyId: string; // Track which lobby this bet was placed in
}

export interface GlobalBet {
  id: string;
  username: string;
  roundNumber: number;
  team: "red" | "blue";
  amount: number;
  timestamp: number;
}

class BetService {
  private bets: UserBet[] = [];
  private globalBets: GlobalBet[] = [];
  private listeners: Array<(bets: UserBet[]) => void> = [];
  private globalListeners: Array<(bets: GlobalBet[]) => void> = [];
  private currentRoundNumber: number = 127;
  private readonly STORAGE_KEY = 'colorGame_userBets';

  constructor() {
    // CRITICAL: Restore bets from localStorage on initialization
    this.restoreBetsFromStorage();
  }

  /**
   * Restore user bets from localStorage (survives page reloads/freezes)
   */
  private restoreBetsFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserBet[];
        this.bets = Array.isArray(parsed) ? parsed : [];
        console.log(`♻️ Restored ${this.bets.length} bets from localStorage`);
      }
    } catch (error) {
      console.error('Failed to restore bets from localStorage:', error);
      this.bets = [];
    }
  }

  /**
   * Persist user bets to localStorage (critical for page reload survival)
   */
  private persistBetsToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bets));
    } catch (error) {
      console.error('Failed to persist bets to localStorage:', error);
    }
  }

  // username is passed by the calling component (from identity.username) —
  // services do not access identity localStorage directly
  placeBet(roundNumber: number, team: "red" | "blue", amount: number, lobbyId: string, username: string): UserBet {
    const bet: UserBet = {
      id: `bet-${Date.now()}-${Math.random()}`,
      roundNumber,
      team,
      amount,
      timestamp: Date.now(),
      lobbyId,
    };

    this.bets.push(bet);
    this.persistBetsToStorage(); // CRITICAL: Save to localStorage immediately
    this.broadcast();

    // username comes from identity.username passed by the caller
    this.addToGlobalFeed(username, roundNumber, team, amount);

    return bet;
  }

  // Add a global bet (from other players - simulated)
  addToGlobalFeed(username: string, roundNumber: number, team: "red" | "blue", amount: number) {
    const globalBet: GlobalBet = {
      id: `global-${Date.now()}-${Math.random()}`,
      username,
      roundNumber,
      team,
      amount,
      timestamp: Date.now(),
    };

    this.globalBets.push(globalBet);
    this.broadcastGlobal();
  }

  // Get bets for current round only
  getCurrentRoundBets(): GlobalBet[] {
    return this.globalBets.filter(bet => bet.roundNumber === this.currentRoundNumber);
  }

  // Clear old bets when round changes
  setCurrentRound(roundNumber: number) {
    if (roundNumber !== this.currentRoundNumber) {
      this.currentRoundNumber = roundNumber;
      // Keep only current and previous round bets
      this.globalBets = this.globalBets.filter(bet => bet.roundNumber >= roundNumber - 1);
      this.broadcastGlobal();
    }
  }

  getBetForRound(roundNumber: number, lobbyId?: string): UserBet | undefined {
    // If lobbyId is provided, filter by both round and lobby
    if (lobbyId) {
      return this.bets.find(bet => bet.roundNumber === roundNumber && bet.lobbyId === lobbyId && !bet.result);
    }
    // Fallback to just round number (for backward compatibility)
    return this.bets.find(bet => bet.roundNumber === roundNumber && !bet.result);
  }

  resolveBet(roundNumber: number, winner: "red" | "blue", payout: number, lobbyId?: string) {
    // Find bet by round and lobby
    const bet = lobbyId
      ? this.bets.find(bet => bet.roundNumber === roundNumber && bet.lobbyId === lobbyId && !bet.result)
      : this.bets.find(bet => bet.roundNumber === roundNumber && !bet.result);

    if (bet) {
      bet.result = bet.team === winner ? "win" : "loss";
      if (bet.result === "win") {
        bet.payout = payout;
      }
      this.persistBetsToStorage(); // CRITICAL: Save to localStorage after resolving
      this.broadcast();
    }
  }

  getAllBets(): UserBet[] {
    return [...this.bets].reverse(); // Most recent first
  }

  subscribe(listener: (bets: UserBet[]) => void) {
    this.listeners.push(listener);
    listener(this.getAllBets());
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  subscribeGlobal(listener: (bets: GlobalBet[]) => void) {
    this.globalListeners.push(listener);
    listener(this.getCurrentRoundBets());
    
    return () => {
      this.globalListeners = this.globalListeners.filter(l => l !== listener);
    };
  }

  private broadcast() {
    const allBets = this.getAllBets();
    this.listeners.forEach(listener => listener(allBets));
  }

  private broadcastGlobal() {
    const currentBets = this.getCurrentRoundBets();
    this.globalListeners.forEach(listener => listener(currentBets));
  }
}

export const betService = new BetService();