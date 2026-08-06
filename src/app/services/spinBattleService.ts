export type SpinGameState = "waiting" | "countdown" | "spinning" | "result";
export type LobbyId = "A" | "B" | "C" | "D";

// Lobby bet limits
export const LOBBY_LIMITS = {
  A: { min: 1, max: 20, quickBets: [1, 5, 15] },
  B: { min: 21, max: 50, quickBets: [21, 30, 40] },
  C: { min: 51, max: 120, quickBets: [51, 75, 95] },
  D: { min: 121, max: 500, quickBets: [121, 230, 375] },
};

export interface SpinPlayer {
  id: string;
  username: string;
  avatar: string;
  animalName: string;
  betAmount: number;
  color: string;
  segmentStart: number;
  segmentEnd: number;
  segmentIndex: number;
  isUser: boolean;
}

export interface SpinWinner {
  roundNumber: number;
  username: string;
  avatar: string;
  animalName: string;
  winAmount: number;
  timestamp: number;
}

export interface SpinBattleState {
  state: SpinGameState;
  roundNumber: number;
  timeRemaining: number;
  players: SpinPlayer[];
  winner: SpinPlayer | null;
  winnerPayout: number;
  totalPool: number;
  spinStartTime?: number;
  resultShownAt?: number;
  finalRotation?: number;
  recentWinners: SpinWinner[];
  waitingForNextRound?: boolean;
  nextRoundStartsAt?: number;
  showPopup?: boolean; // Controls when to show the winner popup (delays 6 seconds after spin ends)
}

// ==========================================
// STRICT 12 COLORS (NO DUPLICATES)
// ==========================================

const PLAYER_COLORS = [
  "#FF0000", // Bright Red
  "#0066FF", // Bright Blue
  "#00FF00", // Bright Green
  "#FFD700", // Gold
  "#FF8C00", // Dark Orange
  "#9400D3", // Dark Violet
  "#FF1493", // Deep Pink
  "#00FFFF", // Cyan
  "#FF6347", // Tomato Red
  "#ADFF2F", // Green Yellow
  "#8B4513", // Saddle Brown
  "#4169E1", // Royal Blue
];

const MAX_PLAYERS_PER_LOBBY = 12;


const MOCK_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Skyler", "Cameron",
  "Quinn", "Avery", "Parker", "Finley"
];

// Shuffle array utility
function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Assign colors for the round
function assignColors(playerCount: number): { colors: string[] } {
  if (playerCount > MAX_PLAYERS_PER_LOBBY) {
    throw new Error(`Cannot assign more than ${MAX_PLAYERS_PER_LOBBY} players`);
  }
  const shuffledColors = shuffle(PLAYER_COLORS);
  return { colors: shuffledColors.slice(0, playerCount) };
}

class SpinBattleService {
  private lobbyStates: Map<LobbyId, SpinBattleState> = new Map();
  private lobbyListeners: Map<LobbyId, Array<(state: SpinBattleState) => void>> = new Map();
  private lobbyTimers: Map<LobbyId, NodeJS.Timeout> = new Map();
  private lobbyPlayerJoinTimers: Map<LobbyId, NodeJS.Timeout> = new Map();
  
  private readonly COUNTDOWN_DURATION = 30;
  private readonly SPIN_DURATION = 5;
  private readonly RESULT_DELAY = 2; // Wait 2 seconds before showing result in center
  private readonly POPUP_DELAY = 4; // Show popup EXACTLY after 4 seconds (center winner displays for 4s first)
  private readonly RESULT_DISPLAY_DURATION = 8; // Total time: 4s center + 4s popup = 8s
  private readonly PLATFORM_FEE = 0.1;

  // Lobby-specific random targets
  private lobbyMockPlayerTargets: Map<LobbyId, number> = new Map();
  private lobbySecondPlayerDelayTimes: Map<LobbyId, number | null> = new Map();
  private lobbyWaitingForSecondPlayer: Map<LobbyId, boolean> = new Map();

  // AUTO-INITIALIZE ALL LOBBIES ON SERVICE CREATION
  constructor() {
    const lobbies: LobbyId[] = ["A", "B", "C", "D"];
    lobbies.forEach(lobbyId => {
      // Initialize fresh state first (will be used as live state baseline)
      this.lobbyStates.set(lobbyId, this.initializeGame(lobbyId));

      // Then try to restore persisted state - if valid, it will override the fresh state
      // If restoration returns null (e.g., live state is more current), keep the initialized state
      const restoredState = this.restoreLobbyState(lobbyId);
      if (restoredState) {
        this.lobbyStates.set(lobbyId, restoredState);
        // CRITICAL FIX: Broadcast immediately after restoration to ensure UI gets updated state
        // This fixes the issue where returning after a round has ended doesn't show the popup
        setTimeout(() => {
          this.broadcast(lobbyId);
        }, 100); // Small delay to ensure listeners are registered
      }

      // Start game loops
      this.startGameLoop(lobbyId);
      this.startPlayerJoinLoop(lobbyId);
    });
    console.log("✅ All 4 Spin Battle lobbies initialized and running independently!");
  }

  /**
   * Restore lobby state from localStorage and sync with elapsed time
   * CRITICAL: Handles COMPLETE CYCLE PROGRESSION, not just single state transitions
   * CRITICAL FIX: For WAITING state, check if the live state has progressed beyond it
   */
  private restoreLobbyState(lobbyId: LobbyId): SpinBattleState | null {
    try {
      const stored = localStorage.getItem(`spinBattle_${lobbyId}_state`);
      if (!stored) return null;

      const persistedState = JSON.parse(stored) as SpinBattleState & { _persistedAt?: number };
      const now = Date.now();

      console.log(`♻️ Restoring Spin Battle lobby ${lobbyId} from localStorage:`, persistedState.state, 'Round:', persistedState.roundNumber);

      // CRITICAL FIX: For WAITING state, check if the live game has already progressed
      // WAITING has variable duration (depends on when players join), so we can't calculate elapsed time
      // Instead, check if the current in-memory state has already moved past WAITING
      if (persistedState.state === "waiting") {
        // Check if there's already a live state for this lobby
        const liveState = this.lobbyStates.get(lobbyId);
        
        if (liveState) {
          // If live state has progressed beyond WAITING, use it instead of persisted state
          if (liveState.state !== "waiting" && liveState.roundNumber === persistedState.roundNumber) {
            console.log(`✅ Lobby ${lobbyId}: Live state has progressed to ${liveState.state}, using live state instead of persisted WAITING`);
            return null; // Return null to use the live state that's already running
          }
          
          // If live state is a newer round, use it
          if (liveState.roundNumber > persistedState.roundNumber) {
            console.log(`✅ Lobby ${lobbyId}: Live state is on newer round ${liveState.roundNumber}, using live state`);
            return null; // Return null to use the live state that's already running
          }
        }
        
        // If no live state or live state is older, restore the persisted WAITING state
        console.log(`📥 Lobby ${lobbyId}: Restoring persisted WAITING state for round ${persistedState.roundNumber}`);
        return persistedState;
      }
      
      // For other states (countdown, spinning, result), continue with time-based restoration
      let totalElapsed = 0;
      let stateStartTime = now;

      if (persistedState.state === "countdown" && persistedState.spinStartTime) {
        stateStartTime = persistedState.spinStartTime;
        totalElapsed = (now - stateStartTime) / 1000;
      } else if (persistedState.state === "spinning" && persistedState.spinStartTime) {
        stateStartTime = persistedState.spinStartTime;
        totalElapsed = (now - stateStartTime) / 1000;
      } else if (persistedState.state === "result" && persistedState.resultShownAt) {
        stateStartTime = persistedState.resultShownAt;
        totalElapsed = (now - stateStartTime) / 1000;
      } else {
        // No valid timestamp, can't sync - return fresh state
        console.warn(`⚠️ No valid timestamp for lobby ${lobbyId}, initializing fresh round`);
        return this.initializeGame(lobbyId);
      }

      // CRITICAL: Calculate COMPLETE cycle progression
      // One full cycle = countdown (30s) + spinning (5s) + result (8s) = 43s
      const FULL_CYCLE = this.COUNTDOWN_DURATION + this.SPIN_DURATION + this.RESULT_DISPLAY_DURATION;

      // Adjust elapsed time based on current state
      let elapsedFromCountdownStart = 0;

      if (persistedState.state === "countdown") {
        // Already at countdown start
        elapsedFromCountdownStart = totalElapsed;
      } else if (persistedState.state === "spinning") {
        // Spinning started after countdown, add countdown duration
        elapsedFromCountdownStart = this.COUNTDOWN_DURATION + totalElapsed;
      } else if (persistedState.state === "result") {
        // Result started after countdown + spinning, add both
        elapsedFromCountdownStart = this.COUNTDOWN_DURATION + this.SPIN_DURATION + totalElapsed;
      }

      // Calculate how many COMPLETE cycles have passed
      const completedCycles = Math.floor(elapsedFromCountdownStart / FULL_CYCLE);
      const timeInCurrentCycle = elapsedFromCountdownStart % FULL_CYCLE;

      console.log(`⏰ Lobby ${lobbyId}: ${elapsedFromCountdownStart.toFixed(1)}s elapsed, ${completedCycles} complete cycles, ${timeInCurrentCycle.toFixed(1)}s into current cycle`);

      // If multiple complete cycles passed, start fresh round
      if (completedCycles > 0) {
        console.log(`⏰ ${completedCycles} complete cycles passed for lobby ${lobbyId}, starting fresh round`);
        return this.initializeGame(lobbyId);
      }

      // Determine current state based on position in cycle
      if (timeInCurrentCycle < this.COUNTDOWN_DURATION) {
        // Still in countdown
        const remaining = Math.max(0, Math.ceil(this.COUNTDOWN_DURATION - timeInCurrentCycle));
        persistedState.timeRemaining = remaining;

        if (remaining === 0) {
          // Countdown just expired, move to spinning
          console.log(`⏰ Countdown just expired for lobby ${lobbyId}, moving to spinning`);
          persistedState.state = "spinning";
          persistedState.spinStartTime = now;
        } else if (persistedState.state !== "countdown") {
          // Fix state mismatch
          persistedState.state = "countdown";
          persistedState.spinStartTime = stateStartTime;
        }
      } else if (timeInCurrentCycle < this.COUNTDOWN_DURATION + this.SPIN_DURATION) {
        // In spinning phase
        const spinElapsed = timeInCurrentCycle - this.COUNTDOWN_DURATION;

        if (spinElapsed >= this.SPIN_DURATION) {
          // CRITICAL FIX: Spin completed while user was away
          // Calculate when the spin actually completed (not now!)
          const actualSpinCompletionTime = now - ((spinElapsed - this.SPIN_DURATION) * 1000);
          console.log(`⏰ Spin completed ${((spinElapsed - this.SPIN_DURATION) * 1000).toFixed(0)}ms ago for lobby ${lobbyId}, moving to result`);
          persistedState.state = "result";
          persistedState.resultShownAt = actualSpinCompletionTime;

          // Calculate how long result has been showing
          const resultElapsed = (now - actualSpinCompletionTime) / 1000;
          persistedState.showPopup = resultElapsed >= this.POPUP_DELAY;

          console.log(`⏰ Result has been showing for ${resultElapsed.toFixed(1)}s, showPopup: ${persistedState.showPopup}`);
        } else if (persistedState.state !== "spinning") {
          // Fix state mismatch
          persistedState.state = "spinning";
          persistedState.spinStartTime = now - (spinElapsed * 1000);
        }
      } else {
        // In result phase
        const resultElapsed = timeInCurrentCycle - this.COUNTDOWN_DURATION - this.SPIN_DURATION;

        if (resultElapsed >= this.RESULT_DISPLAY_DURATION) {
          // Result display complete, start new round
          console.log(`⏰ Result display complete for lobby ${lobbyId}, starting new round`);
          return this.initializeGame(lobbyId);
        } else if (persistedState.state !== "result") {
          // Fix state mismatch
          persistedState.state = "result";
          persistedState.resultShownAt = now - (resultElapsed * 1000);
          persistedState.showPopup = resultElapsed >= this.POPUP_DELAY;
        }
      }

      return persistedState;
    } catch (error) {
      console.error(`Failed to restore Spin Battle lobby ${lobbyId} state:`, error);
      return null;
    }
  }

  /**
   * Persist lobby state to localStorage
   */
  private persistLobbyState(lobbyId: LobbyId) {
    try {
      const state = this.lobbyStates.get(lobbyId);
      if (!state) return;

      const stateWithTimestamp = {
        ...state,
        _persistedAt: Date.now(),
      };

      localStorage.setItem(`spinBattle_${lobbyId}_state`, JSON.stringify(stateWithTimestamp));
    } catch (error) {
      console.error(`Failed to persist Spin Battle lobby ${lobbyId} state:`, error);
    }
  }

  private initializeGame(lobbyId: LobbyId): SpinBattleState {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`spinBattle_${lobbyId}_roundData`);
    let roundNumber = 1;
    
    if (stored) {
      try {
        const { roundNumber: savedRound, lastResetDate } = JSON.parse(stored);
        if (lastResetDate === today) {
          roundNumber = savedRound;
        } else {
          localStorage.setItem(`spinBattle_${lobbyId}_roundData`, JSON.stringify({
            roundNumber: 1,
            lastResetDate: today
          }));
        }
      } catch (e) {
        console.error(`Failed to load round number for lobby ${lobbyId}`, e);
      }
    } else {
      localStorage.setItem(`spinBattle_${lobbyId}_roundData`, JSON.stringify({
        roundNumber: 1,
        lastResetDate: today
      }));
    }

    let recentWinners: SpinWinner[] = [];
    const storedWinners = localStorage.getItem(`spinBattle_${lobbyId}_recentWinners`);
    if (storedWinners) {
      try {
        recentWinners = JSON.parse(storedWinners).slice(0, 20);
      } catch (e) {
        console.error(`Failed to load recent winners for lobby ${lobbyId}`, e);
      }
    }

    const target = Math.min(Math.floor(Math.random() * 7) + 4, MAX_PLAYERS_PER_LOBBY);
    this.lobbyMockPlayerTargets.set(lobbyId, target);

    return {
      state: "waiting",
      roundNumber,
      timeRemaining: this.COUNTDOWN_DURATION,
      players: [],
      winner: null,
      winnerPayout: 0,
      totalPool: 0,
      recentWinners,
      waitingForNextRound: false,
    };
  }

  subscribe(lobbyId: LobbyId, listener: (state: SpinBattleState) => void) {
    if (!this.lobbyStates.has(lobbyId)) {
      this.lobbyStates.set(lobbyId, this.initializeGame(lobbyId));
      this.startGameLoop(lobbyId);
      this.startPlayerJoinLoop(lobbyId);
    }

    if (!this.lobbyListeners.has(lobbyId)) {
      this.lobbyListeners.set(lobbyId, []);
    }

    this.lobbyListeners.get(lobbyId)!.push(listener);
    
    const currentState = this.lobbyStates.get(lobbyId);
    if (currentState) {
      listener({ ...currentState });
    }
    
    return () => {
      const listeners = this.lobbyListeners.get(lobbyId);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private broadcast(lobbyId: LobbyId) {
    const currentState = this.lobbyStates.get(lobbyId);
    const listeners = this.lobbyListeners.get(lobbyId);
    
    if (currentState && listeners) {
      listeners.forEach(listener => listener({ ...currentState }));
    }
  }

  private startGameLoop(lobbyId: LobbyId) {
    const existingTimer = this.lobbyTimers.get(lobbyId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(() => {
      const currentState = this.lobbyStates.get(lobbyId);
      if (!currentState) return;

      if (currentState.waitingForNextRound) {
        if (currentState.nextRoundStartsAt && Date.now() >= currentState.nextRoundStartsAt) {
          currentState.waitingForNextRound = false;
          currentState.nextRoundStartsAt = undefined;
          this.broadcast(lobbyId);
        }
        return;
      }

      if (currentState.state === "waiting") {
        // Do nothing, handled by player join
      } else if (currentState.state === "countdown") {
        const now = Date.now();
        const elapsed = (now - (currentState.spinStartTime || now)) / 1000;
        const remaining = Math.ceil(this.COUNTDOWN_DURATION - elapsed);

        currentState.timeRemaining = remaining;

        if (remaining <= 0) {
          this.triggerSpin(lobbyId);
        } else {
          this.broadcast(lobbyId);
        }
      } else if (currentState.state === "spinning") {
        const elapsed = Date.now() - (currentState.spinStartTime || 0);
        if (elapsed >= this.SPIN_DURATION * 1000) {
          this.showResult(lobbyId);
        }
      } else if (currentState.state === "result") {
        const elapsed = Date.now() - (currentState.resultShownAt || 0);
        
        // Show popup after 4 seconds (wheel center shows winner for 4s first)
        if (elapsed >= this.POPUP_DELAY * 1000 && !currentState.showPopup) {
          currentState.showPopup = true;
          this.broadcast(lobbyId);
        }
        
        if (elapsed >= this.RESULT_DISPLAY_DURATION * 1000) {
          this.startNewRound(lobbyId);
        }
      }
    }, 100);

    this.lobbyTimers.set(lobbyId, timer);
  }

  private startPlayerJoinLoop(lobbyId: LobbyId) {
    const existingTimer = this.lobbyPlayerJoinTimers.get(lobbyId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(() => {
      const currentState = this.lobbyStates.get(lobbyId);
      if (!currentState) return;

      if (currentState.waitingForNextRound) return;

      // STRICT: Do not allow more than 12 players
      if (currentState.players.length >= MAX_PLAYERS_PER_LOBBY) return;

      const canJoin = currentState.state === "waiting" || 
                      (currentState.state === "countdown" && currentState.timeRemaining > 5);

      if (!canJoin) return;

      // Handle second player with random delay
      if (currentState.players.length === 1) {
        const waiting = this.lobbyWaitingForSecondPlayer.get(lobbyId);
        if (!waiting) {
          const randomChance = Math.random();
          
          if (randomChance < 0.3) {
            const instantDelay = Math.random() * 1000;
            setTimeout(() => {
              const state = this.lobbyStates.get(lobbyId);
              if (state && state.players.length === 1) {
                this.addMockPlayer(lobbyId);
              }
            }, instantDelay);
            this.lobbyWaitingForSecondPlayer.set(lobbyId, true);
          } else {
            this.lobbyWaitingForSecondPlayer.set(lobbyId, true);
            const randomDelay = Math.random() * 13000 + 2000;
            this.lobbySecondPlayerDelayTimes.set(lobbyId, Date.now() + randomDelay);
          }
        } else {
          const delayTime = this.lobbySecondPlayerDelayTimes.get(lobbyId);
          if (delayTime && Date.now() >= delayTime) {
            this.addMockPlayer(lobbyId);
            this.lobbySecondPlayerDelayTimes.set(lobbyId, null);
          }
        }
        return;
      }

      if (currentState.state === "waiting" && currentState.players.length === 0) {
        this.lobbyWaitingForSecondPlayer.set(lobbyId, false);
        this.lobbySecondPlayerDelayTimes.set(lobbyId, null);
      }

      const mockPlayerCount = currentState.players.filter(p => !p.isUser).length;
      const target = this.lobbyMockPlayerTargets.get(lobbyId) || 6;

      if (Math.random() > 0.5 && mockPlayerCount < target && currentState.players.length < MAX_PLAYERS_PER_LOBBY) {
        this.addMockPlayer(lobbyId);
      }
    }, Math.random() * 1500 + 1500);

    this.lobbyPlayerJoinTimers.set(lobbyId, timer);
  }

  private addMockPlayer(lobbyId: LobbyId) {
    const currentState = this.lobbyStates.get(lobbyId);
    if (!currentState) return;

    if (currentState.players.length >= MAX_PLAYERS_PER_LOBBY) return;

    const usedNames = currentState.players.map(p => p.username);
    const availableNames = MOCK_NAMES.filter(n => !usedNames.includes(n));
    
    if (availableNames.length === 0) return;

    const randomName = availableNames[Math.floor(Math.random() * availableNames.length)];
    
    // RESPECT LOBBY BET LIMITS
    const limits = LOBBY_LIMITS[lobbyId];
    const randomBet = Math.floor(Math.random() * (limits.max - limits.min + 1)) + limits.min;

    // CRITICAL FIX: Use deterministic player ID for mock players too
    const playerId = `${lobbyId}_${currentState.roundNumber}_${randomName}`;

    const newPlayer: SpinPlayer = {
      id: playerId,
      username: randomName,
      avatar: "",
      animalName: "",
      betAmount: randomBet,
      color: "",
      segmentStart: 0,
      segmentEnd: 0,
      segmentIndex: currentState.players.length,
      isUser: false,
    };

    currentState.players.push(newPlayer);
    
    this.assignPlayerAttributes(currentState);
    this.calculateSegments(currentState);
    currentState.totalPool = currentState.players.reduce((sum, p) => sum + p.betAmount, 0);

    if (currentState.players.length >= 2 && currentState.state === "waiting") {
      currentState.state = "countdown";
      currentState.spinStartTime = Date.now();
      currentState.timeRemaining = this.COUNTDOWN_DURATION;
    }

    this.persistLobbyState(lobbyId); // CRITICAL: Persist after player joins
    this.broadcast(lobbyId);
  }

  private assignPlayerAttributes(state: SpinBattleState) {
    const { colors } = assignColors(state.players.length);

    state.players.forEach((player, index) => {
      player.color = colors[index];
      // Avatar = first letter of username — no emoji pools
      player.avatar = player.username.charAt(0).toUpperCase();
      player.animalName = player.username; // kept for interface compat, set to username
    });
  }

  private calculateSegments(state: SpinBattleState) {
    if (state.players.length === 0) return;
    
    const totalPool = state.players.reduce((sum, p) => sum + p.betAmount, 0);
    let currentAngle = 0;
    
    state.players.forEach((player, index) => {
      const share = player.betAmount / totalPool;
      const segmentSize = share * 360;
      
      player.segmentIndex = index;
      player.segmentStart = currentAngle;
      player.segmentEnd = currentAngle + segmentSize;
      
      currentAngle += segmentSize;
    });
  }

  private triggerSpin(lobbyId: LobbyId) {
    const currentState = this.lobbyStates.get(lobbyId);
    if (!currentState || currentState.players.length === 0) return;

    const spinRotations = 360 * 8;
    const randomStopAngle = Math.random() * 360;
    const finalRotation = spinRotations + randomStopAngle;

    currentState.state = "spinning";
    currentState.spinStartTime = Date.now();
    currentState.timeRemaining = 0;
    currentState.finalRotation = finalRotation;

    const platformFee = Math.floor(currentState.totalPool * this.PLATFORM_FEE);
    currentState.winnerPayout = currentState.totalPool - platformFee;

    this.persistLobbyState(lobbyId); // CRITICAL: Persist after spin starts
    this.broadcast(lobbyId);
  }

  private showResult(lobbyId: LobbyId) {
    const currentState = this.lobbyStates.get(lobbyId);
    if (!currentState || !currentState.finalRotation) return;

    const finalRotation = currentState.finalRotation;
    const normalizedRotation = ((finalRotation % 360) + 360) % 360;
    const arrowAngle = (360 - normalizedRotation) % 360;
    
    let winner: SpinPlayer | null = null;
    
    for (const player of currentState.players) {
      if (arrowAngle >= player.segmentStart && arrowAngle < player.segmentEnd) {
        winner = player;
        break;
      }
    }
    
    if (!winner && arrowAngle === 0) {
      for (const player of currentState.players) {
        if (player.segmentEnd === 360 || Math.abs(player.segmentEnd - 360) < 0.001) {
          winner = player;
          break;
        }
      }
    }

    if (!winner) {
      console.error(`Winner not found! arrowAngle: ${arrowAngle}`);
      winner = currentState.players[0];
    }

    currentState.winner = winner;
    currentState.state = "result";
    currentState.resultShownAt = Date.now();
    currentState.showPopup = false; // CRITICAL: Start with popup hidden for 4 seconds

    const newWinner: SpinWinner = {
      roundNumber: currentState.roundNumber,
      username: winner.username,
      avatar: winner.avatar,
      animalName: winner.animalName,
      winAmount: currentState.winnerPayout,
      timestamp: Date.now(),
    };

    currentState.recentWinners = [newWinner, ...currentState.recentWinners].slice(0, 20);
    localStorage.setItem(`spinBattle_${lobbyId}_recentWinners`, JSON.stringify(currentState.recentWinners));

    this.processUserBets(lobbyId, winner, currentState.roundNumber, currentState.winnerPayout);

    this.persistLobbyState(lobbyId); // CRITICAL: Persist after result determined
    this.broadcast(lobbyId);
  }

  private processUserBets(lobbyId: LobbyId, winner: SpinPlayer, roundNumber: number, payout: number) {
    const pendingBets = localStorage.getItem(`spinBattle_${lobbyId}_pendingBets`);
    if (!pendingBets) return;

    try {
      const bets: Array<{ roundNumber: number; username: string; amount: number; playerId: string }> = JSON.parse(pendingBets);
      const currentRoundBets = bets.filter(b => b.roundNumber === roundNumber);

      currentRoundBets.forEach(bet => {
        const won = bet.playerId === winner.id;
        
        const results = JSON.parse(localStorage.getItem(`spinBattle_${lobbyId}_completedBets`) || "[]");
        results.push({
          roundNumber,
          username: bet.username,
          amount: bet.amount,
          won,
          payout: won ? payout : 0,
          timestamp: Date.now(),
        });
        localStorage.setItem(`spinBattle_${lobbyId}_completedBets`, JSON.stringify(results));
      });

      const remainingBets = bets.filter(b => b.roundNumber !== roundNumber);
      localStorage.setItem(`spinBattle_${lobbyId}_pendingBets`, JSON.stringify(remainingBets));

    } catch (e) {
      console.error(`Failed to process user bets for lobby ${lobbyId}`, e);
    }
  }

  private startNewRound(lobbyId: LobbyId) {
    const currentState = this.lobbyStates.get(lobbyId);
    if (!currentState) return;

    const newRoundNumber = currentState.roundNumber + 1;
    
    const today = new Date().toDateString();
    localStorage.setItem(`spinBattle_${lobbyId}_roundData`, JSON.stringify({
      roundNumber: newRoundNumber,
      lastResetDate: today
    }));

    const target = Math.min(Math.floor(Math.random() * 7) + 4, MAX_PLAYERS_PER_LOBBY);
    this.lobbyMockPlayerTargets.set(lobbyId, target);

    // IMMEDIATE RESTART - NO DELAY
    this.lobbyStates.set(lobbyId, {
      ...currentState,
      state: "waiting",
      roundNumber: newRoundNumber,
      timeRemaining: this.COUNTDOWN_DURATION,
      players: [],
      winner: null,
      winnerPayout: 0,
      totalPool: 0,
      finalRotation: undefined,
      waitingForNextRound: false, // NO WAITING
      nextRoundStartsAt: undefined,
    });

    this.persistLobbyState(lobbyId); // CRITICAL: Persist new round state
    this.broadcast(lobbyId);
  }

  addUserPlayer(lobbyId: LobbyId, username: string, betAmount: number): { success: boolean; playerId?: string; error?: string } {
    const currentState = this.lobbyStates.get(lobbyId);
    if (!currentState) return { success: false, error: "Lobby not initialized" };

    if (currentState.players.length >= MAX_PLAYERS_PER_LOBBY) {
      return { success: false, error: "Lobby is full" };
    }

    if (currentState.waitingForNextRound) {
      return { success: false, error: "Waiting for next round" };
    }

    if (currentState.state === "spinning" || currentState.state === "result") {
      return { success: false, error: "Round in progress" };
    }

    if (currentState.state === "countdown" && currentState.timeRemaining <= 5) {
      return { success: false, error: "No more bets" };
    }

    if (currentState.players.some(p => p.username === username)) {
      return { success: false, error: "Already joined" };
    }

    // CRITICAL FIX: Use deterministic player ID based on username + roundNumber + lobby
    // This ensures the same user in the same round always has the same ID
    const playerId = `${lobbyId}_${currentState.roundNumber}_${username}`;

    const userPlayer: SpinPlayer = {
      id: playerId,
      username,
      avatar: "",
      animalName: "",
      betAmount,
      color: "",
      segmentStart: 0,
      segmentEnd: 0,
      segmentIndex: currentState.players.length,
      isUser: true,
    };

    currentState.players.push(userPlayer);
    
    this.assignPlayerAttributes(currentState);
    this.calculateSegments(currentState);
    currentState.totalPool = currentState.players.reduce((sum, p) => sum + p.betAmount, 0);

    if (currentState.players.length >= 2 && currentState.state === "waiting") {
      currentState.state = "countdown";
      currentState.spinStartTime = Date.now();
      currentState.timeRemaining = this.COUNTDOWN_DURATION;
    }

    const pendingBets = JSON.parse(localStorage.getItem(`spinBattle_${lobbyId}_pendingBets`) || "[]");
    pendingBets.push({
      roundNumber: currentState.roundNumber,
      username,
      amount: betAmount,
      playerId,
    });
    localStorage.setItem(`spinBattle_${lobbyId}_pendingBets`, JSON.stringify(pendingBets));

    this.persistLobbyState(lobbyId); // CRITICAL: Persist after user joins
    this.broadcast(lobbyId);
    return { success: true, playerId };
  }

  getCurrentState(lobbyId: LobbyId): SpinBattleState | null {
    const state = this.lobbyStates.get(lobbyId);
    return state ? { ...state } : null;
  }

  destroy() {
    this.lobbyTimers.forEach(timer => clearInterval(timer));
    this.lobbyPlayerJoinTimers.forEach(timer => clearInterval(timer));
    this.lobbyTimers.clear();
    this.lobbyPlayerJoinTimers.clear();
    this.lobbyListeners.clear();
    this.lobbyStates.clear();
  }
}

export const spinBattleService = new SpinBattleService();