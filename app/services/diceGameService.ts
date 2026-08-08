// Shared Dice Game Service - manages continuous background rounds
// All dice games (Clash, Royale, Arena) share the same global round counter

class DiceGameService {
  private globalRoundNumber: number = 1;
  private listeners: Array<(roundNumber: number) => void> = [];
  private timer: NodeJS.Timeout | null = null;

  private readonly ROUND_DURATION = 35000; // 35 seconds per round (avg game length)

  constructor() {
    // Load saved round from localStorage
    const saved = localStorage.getItem('diceGlobalRound');
    if (saved) {
      this.globalRoundNumber = parseInt(saved);
    }

    this.startRoundLoop();
  }

  private startRoundLoop() {
    // Round increments are now game-completion-based, not time-based
    // No timer needed - games call incrementRound() when they finish
  }

  subscribe(listener: (roundNumber: number) => void) {
    this.listeners.push(listener);

    // Send current round immediately
    listener(this.globalRoundNumber);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private broadcast() {
    this.listeners.forEach(listener => listener(this.globalRoundNumber));
  }

  getCurrentRound(): number {
    return this.globalRoundNumber;
  }

  // Increment round when a game completes
  incrementRound() {
    this.globalRoundNumber++;
    localStorage.setItem('diceGlobalRound', String(this.globalRoundNumber));
    this.broadcast();
    console.log(`🎲 GLOBAL DICE ROUND: #${this.globalRoundNumber}`);
  }

  // Reset to Round 1 (admin/debug only)
  reset() {
    this.globalRoundNumber = 1;
    localStorage.setItem('diceGlobalRound', '1');
    this.broadcast();
  }
}

// Export singleton instance
export const diceGameService = new DiceGameService();
