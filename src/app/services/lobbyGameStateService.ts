export type GameState = "WAITING" | "SPINNING" | "RESULT";

export interface RoundResult {
  roundNumber: number;
  winner: "red" | "blue";
  timestamp: number;
}

export interface PlayerBet {
  id: string;
  username: string;
  amount: number;
  team: "red" | "blue";
  timestamp: number;
}

export interface ServerGameState {
  state: GameState;
  roundNumber: number;
  timeRemaining: number; // seconds
  winner: "red" | "blue" | null;
  redTeam: {
    players: number;
    totalAmount: number;
  };
  blueTeam: {
    players: number;
    totalAmount: number;
  };
  spinStartTime?: number;
  resultShownAt?: number;
  history: RoundResult[];
  currentRoundBets: PlayerBet[]; // Live bets for current round
}

// Unique username pool for randomized simulation
const USERNAME_POOL = [
  "Phoenix_Rider", "Storm_Chaser", "Night_Wolf", "Sky_Walker", "Thunder_Strike",
  "Shadow_Hunter", "Frost_Byte", "Blaze_Runner", "Ocean_Wave", "Eagle_Eye",
  "Iron_Fist", "Silver_Arrow", "Golden_Tiger", "Crimson_Blade", "Jade_Dragon",
  "Neon_Flash", "Crystal_Mind", "Viper_Strike", "Cobra_King", "Falcon_Dive",
  "Rocket_Star", "Nova_Blast", "Zero_Gravity", "Cyber_Ninja", "Turbo_Boost",
  "Alpha_Wolf", "Beta_Ray", "Gamma_Force", "Delta_Strike", "Omega_Prime",
  "Quantum_Leap", "Sonic_Boom", "Flash_Point", "Thunder_Bolt", "Lightning_Fast",
  "Mystic_Sage", "Warrior_Soul", "Battle_Axe", "Royal_Guard", "Knight_Rider",
  "Stealth_Mode", "Sniper_Elite", "Ranger_Scout", "Ghost_Recon", "Phantom_Squad",
  "Titan_Clash", "Atlas_Power", "Zeus_Fury", "Hades_Flame", "Poseidon_Wave",
  "Maverick_Ace", "Renegade_X", "Outlaw_Joe", "Bandit_King", "Rebel_Force",
  "Ice_Breaker", "Fire_Storm", "Wind_Rider", "Earth_Shaker", "Bolt_Action",
  "Laser_Focus", "Pixel_Perfect", "Matrix_Code", "Binary_Star", "Quantum_Bit",
  "Crypto_King", "Token_Master", "Chain_Reactor", "Block_Builder", "Hash_Hero"
];

import { appLifecycleService } from './appLifecycleService';

// Lobby-specific game state manager
class LobbyGameStateService {
  private listeners: Map<string, Array<(state: ServerGameState) => void>> = new Map();
  private currentStates: Map<string, ServerGameState> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private usedUsernamesPerLobby: Map<string, Set<string>> = new Map();
  private stateTimestamps: Map<string, number> = new Map(); // Track when each lobby's current state started
  private globalGameStartTime: number = Date.now(); // GLOBAL anchor - when the entire game system started

  private readonly WAITING_DURATION = 90; // 1 minute 30 seconds
  private readonly SPIN_DURATION = 6; // 6 seconds
  private readonly RESULT_DISPLAY_DURATION = 5; // 5 seconds

  constructor() {
    // Register lifecycle handlers
    appLifecycleService.onResume(() => this.handleAppResume());
    appLifecycleService.onBackground(() => this.handleAppBackground());

    // Try to load global game start time from localStorage
    try {
      const stored = localStorage.getItem('colorGame_globalStartTime');
      if (stored) {
        this.globalGameStartTime = parseInt(stored, 10);
        console.log('🌍 Loaded global game start time:', new Date(this.globalGameStartTime).toISOString());
      } else {
        // First time - save it
        localStorage.setItem('colorGame_globalStartTime', this.globalGameStartTime.toString());
        console.log('🌍 Initialized global game start time:', new Date(this.globalGameStartTime).toISOString());
      }
    } catch (e) {
      console.error('Failed to load global start time:', e);
    }
  }

  /**
   * Get deterministic result for a specific round in a lobby.
   * CRITICAL: This uses a seeded algorithm so results NEVER change.
   * Same lobby + same round = same result, forever.
   *
   * TODO(backend): This entire method must be replaced by a server-generated result.
   *
   * Current problem: The seeding algorithm (Math.sin(lobbyCode * 1000000 + roundNumber))
   * is in the public JavaScript bundle. Any user can read the source, calculate the
   * winner for any future round before placing their bet, and exploit it.
   *
   * Backend workflow to implement:
   *   1. Backend generates round result using a cryptographically secure RNG at round start
   *   2. Result is committed to DB but sealed (not exposed via API until spin phase begins)
   *   3. At spin time, backend broadcasts result via WebSocket to all lobby subscribers
   *   4. Frontend receives result and renders it — never calculates it locally
   *   5. The `colorGame_result_*` localStorage keys are eliminated entirely
   *
   * Until the backend is live: client-side determinism is used (current behaviour).
   */
  private getDeterministicResult(lobbyId: string, roundNumber: number): "red" | "blue" {
    // TODO(backend): Remove this method and replace call sites with WebSocket-delivered results.
    const storageKey = `colorGame_result_${lobbyId}_${roundNumber}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return stored as "red" | "blue";
    }

    const lobbyCode = lobbyId.charCodeAt(0); // A=65, B=66, C=67, D=68
    const seed = (lobbyCode * 1000000) + roundNumber;

    const x = Math.sin(seed) * 10000;
    const pseudoRandom = x - Math.floor(x);

    const result: "red" | "blue" = pseudoRandom >= 0.5 ? "red" : "blue";

    try {
      localStorage.setItem(storageKey, result);
    } catch (e) {
      console.error('Failed to store result:', e);
    }

    return result;
  }

  /**
   * Handle app resuming from background
   * Recalculate all lobby states based on elapsed time
   */
  private handleAppResume() {
    console.log('🎮 Lobby game service: App resumed, syncing all lobbies');

    // Restore state for each active lobby
    for (const [lobbyId, state] of this.currentStates.entries()) {
      this.syncLobbyStateAfterResume(lobbyId, state);
    }
  }

  /**
   * Handle app going to background
   * Persist critical state to localStorage
   */
  private handleAppBackground() {
    console.log('🎮 Lobby game service: App backgrounding, persisting state');

    // Save each lobby's state to localStorage
    for (const [lobbyId, state] of this.currentStates.entries()) {
      this.persistLobbyState(lobbyId, state);
    }
  }

  /**
   * Persist lobby state to localStorage
   */
  private persistLobbyState(lobbyId: string, state: ServerGameState) {
    try {
      const stateWithTimestamp = {
        ...state,
        _persistedAt: Date.now(),
        _stateStartedAt: this.stateTimestamps.get(lobbyId) || Date.now(),
      };

      localStorage.setItem(`colorGame_lobby_state_${lobbyId}`, JSON.stringify(stateWithTimestamp));
      console.log(`💾 Persisted state for lobby ${lobbyId}:`, state.state, 'Round:', state.roundNumber);
    } catch (error) {
      console.error(`Failed to persist lobby ${lobbyId} state:`, error);
    }
  }

  /**
   * Restore and sync lobby state after app resume.
   * CRITICAL: Uses GLOBAL game time to calculate current round deterministically.
   * Results are PERMANENT and never regenerated - based on lobby + round seed.
   */
  private syncLobbyStateAfterResume(lobbyId: string, _currentState: ServerGameState) {
    try {
      const stored = localStorage.getItem(`colorGame_lobby_state_${lobbyId}`);
      if (!stored) {
        console.log(`No persisted state for lobby ${lobbyId}, continuing with current state`);
        return;
      }

      const persisted = JSON.parse(stored) as ServerGameState & { _persistedAt?: number };
      const now = Date.now();
      const cycleDuration = this.getTotalCycleDuration(); // 101s

      // CRITICAL: Calculate current round from GLOBAL game start time (ground truth)
      // This ensures ALL users see the same round at the same time
      const elapsedSinceGameStart = (now - this.globalGameStartTime) / 1000;
      const currentGlobalRound = Math.floor(elapsedSinceGameStart / cycleDuration) + 1; // Round 1, 2, 3...
      const positionInCurrentCycle = (elapsedSinceGameStart % cycleDuration);

      // VALIDATION: Prevent impossible jumps
      // If persisted round is way ahead of global round, something is corrupted
      if (persisted.roundNumber > currentGlobalRound + 5) {
        console.error(`⚠️ Persisted round ${persisted.roundNumber} is ahead of global round ${currentGlobalRound} - using global`);
        persisted.roundNumber = currentGlobalRound;
      }

      // Calculate when current round's WAITING phase started
      const currentRoundStartedAt = this.globalGameStartTime + (currentGlobalRound - 1) * cycleDuration * 1000;

      // Determine current state from position in cycle
      let newState: GameState;
      let newTimeRemaining: number;
      let spinStartTime: number | undefined;
      let resultShownAt: number | undefined;

      if (positionInCurrentCycle < this.WAITING_DURATION) {
        newState = "WAITING";
        newTimeRemaining = Math.max(0, Math.floor(this.WAITING_DURATION - positionInCurrentCycle));
      } else if (positionInCurrentCycle < this.WAITING_DURATION + this.SPIN_DURATION) {
        newState = "SPINNING";
        newTimeRemaining = 0;
        spinStartTime = currentRoundStartedAt + this.WAITING_DURATION * 1000;
      } else {
        newState = "RESULT";
        newTimeRemaining = 0;
        spinStartTime = currentRoundStartedAt + this.WAITING_DURATION * 1000;
        resultShownAt = currentRoundStartedAt + (this.WAITING_DURATION + this.SPIN_DURATION) * 1000;
      }

      // Build history from persisted history PLUS any new completed rounds
      // Start with existing history
      const existingHistory = new Map<number, RoundResult>();
      (persisted.history || []).forEach(r => existingHistory.set(r.roundNumber, r));

      // Fill in any missing rounds between persisted and current
      const historyRounds: RoundResult[] = [];
      const startHistoryFrom = Math.max(1, currentGlobalRound - 8); // Last 9 rounds max

      for (let r = startHistoryFrom; r < currentGlobalRound; r++) {
        // Check if we already have this result
        if (existingHistory.has(r)) {
          historyRounds.push(existingHistory.get(r)!);
        } else {
          // Generate deterministic result (PERMANENT - never changes)
          const winner = this.getDeterministicResult(lobbyId, r);
          historyRounds.push({
            roundNumber: r,
            winner,
            timestamp: this.globalGameStartTime + r * cycleDuration * 1000,
          });
        }
      }

      // If current round is past WAITING, it's also decided
      if (positionInCurrentCycle >= this.WAITING_DURATION) {
        if (!existingHistory.has(currentGlobalRound)) {
          const winner = this.getDeterministicResult(lobbyId, currentGlobalRound);
          historyRounds.push({
            roundNumber: currentGlobalRound,
            winner,
            timestamp: currentRoundStartedAt + this.WAITING_DURATION * 1000,
          });
        } else {
          historyRounds.push(existingHistory.get(currentGlobalRound)!);
        }
      }

      // Sort by round number descending and keep last 9
      historyRounds.sort((a, b) => b.roundNumber - a.roundNumber);
      const trimmedHistory = historyRounds.slice(0, 9);

      // Determine winner for current state
      let currentWinner: "red" | "blue" | null = null;
      if (newState !== "WAITING") {
        currentWinner = this.getDeterministicResult(lobbyId, currentGlobalRound);
      }

      const updatedState: ServerGameState = {
        ...persisted,
        state: newState,
        timeRemaining: newTimeRemaining,
        roundNumber: currentGlobalRound,
        roundStartedAt: currentRoundStartedAt,
        winner: currentWinner,
        spinStartTime: spinStartTime ?? persisted.spinStartTime,
        resultShownAt: resultShownAt ?? persisted.resultShownAt,
        history: trimmedHistory,
      };

      this.currentStates.set(lobbyId, updatedState);
      this.stateTimestamps.set(lobbyId, currentRoundStartedAt);
      this.notifyListeners(lobbyId);

      console.log(`✅ Synced lobby ${lobbyId}: ${newState} Round #${currentGlobalRound} (global truth) timeRemaining=${newTimeRemaining}s, ${trimmedHistory.length} history entries`);
    } catch (error) {
      console.error(`Failed to restore lobby ${lobbyId} state:`, error);
    }
  }

  /**
   * Get total duration of one complete round cycle
   */
  private getTotalCycleDuration(): number {
    return this.WAITING_DURATION + this.SPIN_DURATION + this.RESULT_DISPLAY_DURATION;
  }

  // Initialize a lobby with tiered pool based on min/max bet range
  private initializeLobby(lobbyId: string, minBet: number, maxBet: number): ServerGameState {
    // CRITICAL: Calculate current round from global game time (not just round 1)
    // This ensures new lobbies join the live game at the correct round
    const now = Date.now();
    const cycleDuration = this.getTotalCycleDuration();
    const elapsedSinceGameStart = (now - this.globalGameStartTime) / 1000;
    const currentGlobalRound = Math.floor(elapsedSinceGameStart / cycleDuration) + 1;
    const positionInCycle = elapsedSinceGameStart % cycleDuration;
    const currentRoundStartedAt = this.globalGameStartTime + (currentGlobalRound - 1) * cycleDuration * 1000;
    const timeRemaining = Math.max(0, Math.floor(this.WAITING_DURATION - positionInCycle));

    // Build initial history (last completed rounds)
    const history: RoundResult[] = [];
    const historyStart = Math.max(1, currentGlobalRound - 8);
    for (let r = historyStart; r < currentGlobalRound; r++) {
      history.unshift({
        roundNumber: r,
        winner: this.getDeterministicResult(lobbyId, r),
        timestamp: this.globalGameStartTime + r * cycleDuration * 1000,
      });
    }

    return {
      state: "WAITING",
      roundNumber: currentGlobalRound,
      timeRemaining: timeRemaining,
      winner: null,
      redTeam: { players: 0, totalAmount: 0 },
      blueTeam: { players: 0, totalAmount: 0 },
      roundStartedAt: currentRoundStartedAt,
      history: history.slice(0, 9),
      currentRoundBets: [],
    };
  }

  private generateInitialHistory(): RoundResult[] {
    return []; // No initial history
  }

  subscribe(lobbyId: string, minBet: number, maxBet: number, listener: (state: ServerGameState) => void) {
    // Try to restore from localStorage first
    let shouldStartNewLoop = false;

    if (!this.currentStates.has(lobbyId)) {
      // Try to restore persisted state
      try {
        const stored = localStorage.getItem(`colorGame_lobby_state_${lobbyId}`);
        if (stored) {
          const persistedState = JSON.parse(stored);

          // CRITICAL: Ensure roundStartedAt exists (backfill for old saves)
          if (!persistedState.roundStartedAt || !isFinite(persistedState.roundStartedAt)) {
            persistedState.roundStartedAt = persistedState._persistedAt || Date.now();
            console.log(`⚠️ Backfilled missing roundStartedAt for lobby ${lobbyId}`);
          }

          this.currentStates.set(lobbyId, persistedState);
          this.stateTimestamps.set(lobbyId, persistedState.roundStartedAt);
          console.log(`♻️ Restored lobby ${lobbyId} from localStorage:`, persistedState.state, 'Round:', persistedState.roundNumber);

          // CRITICAL: Sync state after restoration (catches up elapsed rounds/time)
          this.syncLobbyStateAfterResume(lobbyId, persistedState);
        } else {
          // No persisted state, initialize fresh
          const initialState = this.initializeLobby(lobbyId, minBet, maxBet);
          this.currentStates.set(lobbyId, initialState);
          this.stateTimestamps.set(lobbyId, Date.now());
          console.log(`🆕 Initialized new lobby ${lobbyId}`);
        }
      } catch (error) {
        console.error(`Failed to restore lobby ${lobbyId}, initializing fresh:`, error);
        const initialState = this.initializeLobby(lobbyId, minBet, maxBet);
        this.currentStates.set(lobbyId, initialState);
        this.stateTimestamps.set(lobbyId, Date.now());
      }

      // Initialize username tracking
      this.usedUsernamesPerLobby.set(lobbyId, new Set());

      // Generate initial randomized players
      this.generateRandomizedPlayers(lobbyId);

      shouldStartNewLoop = true;
    }

    // Start game loop if needed
    if (shouldStartNewLoop) {
      this.startGameLoop(lobbyId);
    }

    // Add listener
    if (!this.listeners.has(lobbyId)) {
      this.listeners.set(lobbyId, []);
    }
    this.listeners.get(lobbyId)!.push(listener);
    
    // Send current state immediately
    const currentState = this.currentStates.get(lobbyId);
    if (currentState) {
      listener(currentState);
    }
    
    return () => {
      const lobbyListeners = this.listeners.get(lobbyId);
      if (lobbyListeners) {
        const index = lobbyListeners.indexOf(listener);
        if (index > -1) {
          lobbyListeners.splice(index, 1);
        }
      }
    };
  }

  private broadcast(lobbyId: string) {
    const state = this.currentStates.get(lobbyId);
    const listeners = this.listeners.get(lobbyId);
    if (state && listeners) {
      listeners.forEach(listener => listener({ ...state }));
    }
  }

  private notifyListeners(lobbyId: string) {
    this.broadcast(lobbyId);
  }

  private startGameLoop(lobbyId: string) {
    // Clear any existing timer
    if (this.timers.has(lobbyId)) {
      clearInterval(this.timers.get(lobbyId));
    }

    // Update every second — use wall-clock time so resume/throttle can't corrupt the timer
    const timer = setInterval(() => {
      const state = this.currentStates.get(lobbyId);
      if (!state) return;

      if (state.state === "WAITING") {
        // CRITICAL: Always compute from absolute timestamp — immune to background throttling
        // Defensive: validate roundStartedAt exists and is sane
        if (!state.roundStartedAt || !isFinite(state.roundStartedAt) || state.roundStartedAt <= 0) {
          console.error(`Invalid roundStartedAt for lobby ${lobbyId}:`, state.roundStartedAt, "- resetting to now");
          state.roundStartedAt = Date.now();
        }

        const elapsed = (Date.now() - state.roundStartedAt) / 1000;
        const newTimeRemaining = Math.max(0, Math.floor(this.WAITING_DURATION - elapsed));

        // Defensive: validate computed value
        if (!isFinite(newTimeRemaining) || newTimeRemaining < 0) {
          console.error(`Invalid timeRemaining computed for lobby ${lobbyId}:`, newTimeRemaining, "- resetting round");
          state.roundStartedAt = Date.now();
          state.timeRemaining = this.WAITING_DURATION;
        } else {
          state.timeRemaining = newTimeRemaining;
        }

        if (state.timeRemaining <= 0) {
          this.triggerSpin(lobbyId);
        } else {
          this.broadcast(lobbyId);
        }
      } else if (state.state === "SPINNING") {
        const elapsed = Date.now() - (state.spinStartTime || 0);
        if (elapsed >= this.SPIN_DURATION * 1000) {
          this.showResult(lobbyId);
        }
      } else if (state.state === "RESULT") {
        const elapsed = Date.now() - (state.resultShownAt || 0);
        if (elapsed >= this.RESULT_DISPLAY_DURATION * 1000) {
          this.startNewRound(lobbyId);
        }
      }
    }, 1000);

    this.timers.set(lobbyId, timer);
  }

  private triggerSpin(lobbyId: string) {
    const state = this.currentStates.get(lobbyId);
    if (!state) return;

    // CRITICAL: Use deterministic result for this lobby + round
    // This ensures ALL users see the same winner - it's a LIVE global game
    const winner = this.getDeterministicResult(lobbyId, state.roundNumber);

    console.log(`🎲 Lobby ${lobbyId} Round ${state.roundNumber} - DETERMINISTIC Winner: ${winner.toUpperCase()}`);

    // CRITICAL FIX: Store pool data for this round BEFORE moving to next round
    // This allows calculatePayout to work correctly even after the round has ended
    const poolDataKey = `colorGame_pool_${lobbyId}_${state.roundNumber}`;
    try {
      const poolData = {
        roundNumber: state.roundNumber,
        winner: winner,
        redTotal: state.redTeam.totalAmount,
        blueTotal: state.blueTeam.totalAmount,
        timestamp: Date.now()
      };
      localStorage.setItem(poolDataKey, JSON.stringify(poolData));
      console.log(`💾 Stored pool data for Round ${state.roundNumber} Lobby ${lobbyId}:`, poolData);
    } catch (e) {
      console.error('Failed to store pool data:', e);
    }

    state.state = "SPINNING";
    state.winner = winner;
    state.spinStartTime = Date.now();
    state.timeRemaining = 0;

    // Update state timestamp for lifecycle tracking
    this.stateTimestamps.set(lobbyId, Date.now());

    // Persist state change
    this.persistLobbyState(lobbyId, state);

    this.broadcast(lobbyId);
  }

  private showResult(lobbyId: string) {
    const state = this.currentStates.get(lobbyId);
    if (!state) return;

    state.state = "RESULT";
    state.resultShownAt = Date.now();

    // Update state timestamp for lifecycle tracking
    this.stateTimestamps.set(lobbyId, Date.now());

    // Persist state change
    this.persistLobbyState(lobbyId, state);

    this.broadcast(lobbyId);
  }

  private startNewRound(lobbyId: string) {
    const state = this.currentStates.get(lobbyId);
    if (!state) return;

    // Add to history - keep only last 9 completed rounds
    if (state.winner) {
      const completedRound: RoundResult = {
        roundNumber: state.roundNumber,
        winner: state.winner,
        timestamp: Date.now(),
      };
      state.history = [completedRound, ...state.history].slice(0, 9);
    }

    // IMPORTANT: Build new round state with random players BEFORE updating state
    // This prevents any race condition where UI sees 0 players/amounts

    // Clear used usernames for this lobby
    this.usedUsernamesPerLobby.set(lobbyId, new Set());

    // Prepare new team data with simulated players
    const newRedTeam = { players: 0, totalAmount: 0 };
    const newBlueTeam = { players: 0, totalAmount: 0 };
    const newCurrentRoundBets: PlayerBet[] = [];

    // Generate randomized players FIRST (15-40 players)
    this.generateRandomizedPlayersForTeams(lobbyId, newRedTeam, newBlueTeam, newCurrentRoundBets);

    // NOW update state atomically with all data ready
    state.state = "WAITING";
    state.roundNumber += 1;

    // CRITICAL: Align roundStartedAt with global game time for synchronization
    // Calculate exact time when this round should start based on global clock
    const cycleDuration = this.getTotalCycleDuration();
    state.roundStartedAt = this.globalGameStartTime + (state.roundNumber - 1) * cycleDuration * 1000;

    state.timeRemaining = this.WAITING_DURATION;
    state.winner = null;
    state.redTeam = newRedTeam;
    state.blueTeam = newBlueTeam;

    // Update state timestamp for lifecycle tracking (new round starting)
    this.stateTimestamps.set(lobbyId, Date.now());

    // Persist state change
    this.persistLobbyState(lobbyId, state);
    state.currentRoundBets = newCurrentRoundBets;

    console.log(`🎮 Lobby ${lobbyId} Round ${state.roundNumber} - RED: ${newRedTeam.players} players, ${newRedTeam.totalAmount.toFixed(2)} USD | BLUE: ${newBlueTeam.players} players, ${newBlueTeam.totalAmount.toFixed(2)} USD`);

    this.broadcast(lobbyId);
  }

  // Generate randomized player simulation into provided team objects (15-40 unique players)
  private generateRandomizedPlayersForTeams(
    lobbyId: string,
    redTeam: { players: number; totalAmount: number },
    blueTeam: { players: number; totalAmount: number },
    currentRoundBets: PlayerBet[]
  ) {
    // Get lobby config - ONLY 4 LOBBIES (A, B, C, D)
    const lobbyConfigs: Record<string, { minBet: number; maxBet: number }> = {
      'A': { minBet: 1, maxBet: 20 },
      'B': { minBet: 21, maxBet: 100 },
      'C': { minBet: 101, maxBet: 1000 },
      'D': { minBet: 1001, maxBet: 5000 },
    };

    const config = lobbyConfigs[lobbyId.toUpperCase()] || { minBet: 1, maxBet: 20 };

    // Random number of players between 15 and 40 (using crypto)
    const playerCountRandom = new Uint8Array(1);
    crypto.getRandomValues(playerCountRandom);
    const numPlayers = Math.floor((playerCountRandom[0] / 255) * 26) + 15; // 15-40

    // Shuffle usernames using crypto randomness (Fisher-Yates shuffle)
    const availableUsernames = [...USERNAME_POOL];
    for (let i = availableUsernames.length - 1; i > 0; i--) {
      const randomBytes = new Uint8Array(1);
      crypto.getRandomValues(randomBytes);
      const j = Math.floor((randomBytes[0] / 255) * (i + 1));
      [availableUsernames[i], availableUsernames[j]] = [availableUsernames[j], availableUsernames[i]];
    }

    // Generate unique players
    for (let i = 0; i < Math.min(numPlayers, availableUsernames.length); i++) {
      const username = availableUsernames[i];

      // Random team (50/50 split) - use crypto for true randomness
      const teamRandom = new Uint8Array(1);
      crypto.getRandomValues(teamRandom);
      const team: "red" | "blue" = teamRandom[0] >= 128 ? "red" : "blue";

      // Random bet amount within lobby range
      const betAmount = this.getRandomBetAmount(config.minBet, config.maxBet);

      // Defensive check
      if (!betAmount || betAmount <= 0 || !isFinite(betAmount)) {
        console.error(`Invalid betAmount generated: ${betAmount} for lobby ${lobbyId}`);
        continue; // Skip this player
      }

      // Add to teams
      if (team === "red") {
        redTeam.totalAmount += betAmount;
        redTeam.players += 1;
      } else {
        blueTeam.totalAmount += betAmount;
        blueTeam.players += 1;
      }

      // Add to current round bets
      const bet: PlayerBet = {
        id: `sim-${lobbyId}-${i}-${Date.now()}`,
        username: username,
        amount: betAmount,
        team: team,
        timestamp: Date.now() + i, // Slight offset to ensure unique timestamps
      };
      currentRoundBets.push(bet);
    }
  }

  // Legacy wrapper for initial lobby setup
  private generateRandomizedPlayers(lobbyId: string) {
    const state = this.currentStates.get(lobbyId)!;
    this.generateRandomizedPlayersForTeams(lobbyId, state.redTeam, state.blueTeam, state.currentRoundBets);
  }

  // Generate random bet amount within lobby range
  private getRandomBetAmount(minBet: number, maxBet: number): number {
    // Defensive checks
    if (!minBet || minBet <= 0) minBet = 1;
    if (!maxBet || maxBet < minBet) maxBet = minBet * 2;

    const range = maxBet - minBet;

    // Use crypto for randomness
    const randomBytes = new Uint8Array(2);
    crypto.getRandomValues(randomBytes);
    const randomValue1 = randomBytes[0] / 255;
    const randomValue2 = randomBytes[1] / 255;

    let amount: number;

    // 60% chance of round numbers, 40% chance of any value
    if (randomValue1 < 0.6) {
      // Round numbers
      const roundAmounts = [];
      let current = minBet;
      const step = Math.max(range / 10, 0.01); // Ensure step is not 0

      while (current <= maxBet && roundAmounts.length < 50) { // Safety limit
        roundAmounts.push(Math.round(current * 100) / 100);
        current += step;
      }

      if (roundAmounts.length === 0) {
        // Fallback to minBet
        amount = minBet;
      } else {
        const index = Math.floor(randomValue2 * roundAmounts.length);
        amount = roundAmounts[index] || minBet;
      }
    } else {
      // Any value in range
      amount = minBet + (randomValue2 * range);
      amount = Math.round(amount * 100) / 100; // Round to 2 decimals
    }

    // Final validation
    if (!amount || amount <= 0 || !isFinite(amount)) {
      console.error(`getRandomBetAmount: Generated invalid amount ${amount}, using minBet ${minBet}`);
      return minBet;
    }

    return amount;
  }

  addBetToPool(lobbyId: string, team: "red" | "blue", amount: number, playerId: string, username: string) {
    const state = this.currentStates.get(lobbyId);
    if (!state) {
      console.error(`addBetToPool: No state found for lobby ${lobbyId}`);
      return;
    }

    // Defensive check for amount
    if (!amount || amount <= 0 || !isFinite(amount)) {
      console.error(`addBetToPool: Invalid amount ${amount} for lobby ${lobbyId}`);
      return;
    }

    console.log(`💰 Adding bet to lobby ${lobbyId}: ${team} team, ${amount.toFixed(2)} USD by ${username}`);

    if (team === "red") {
      state.redTeam.totalAmount += amount;
      state.redTeam.players += 1;
    } else {
      state.blueTeam.totalAmount += amount;
      state.blueTeam.players += 1;
    }

    // Add bet to current round bets
    const newBet: PlayerBet = {
      id: playerId,
      username: username,
      amount: amount,
      team: team,
      timestamp: Date.now(),
    };
    state.currentRoundBets.push(newBet);

    console.log(`📊 Lobby ${lobbyId} pools after bet - RED: ${state.redTeam.totalAmount.toFixed(2)} (${state.redTeam.players} players) | BLUE: ${state.blueTeam.totalAmount.toFixed(2)} (${state.blueTeam.players} players)`);

    this.broadcast(lobbyId);
  }

  calculatePayout(lobbyId: string, betAmount: number, betTeam: "red" | "blue", roundNumber?: number): number {
    // Defensive checks: validate betAmount
    if (!isFinite(betAmount) || betAmount <= 0) {
      console.error(`calculatePayout: Invalid betAmount ${betAmount} for lobby ${lobbyId}`);
      return 0;
    }

    // CRITICAL FIX: If roundNumber is provided, use stored pool data for that round
    // This allows us to calculate payouts for past rounds even after the game has moved on
    if (roundNumber !== undefined) {
      const poolDataKey = `colorGame_pool_${lobbyId}_${roundNumber}`;
      const stored = localStorage.getItem(poolDataKey);

      if (stored) {
        try {
          const poolData = JSON.parse(stored);

          // Verify this team won
          if (poolData.winner !== betTeam) {
            return 0;
          }

          const winningTeamTotal = betTeam === "red" ? poolData.redTotal : poolData.blueTotal;
          const losingTeamTotal = betTeam === "red" ? poolData.blueTotal : poolData.redTotal;

          // Defensive checks: validate team totals
          if (!isFinite(winningTeamTotal) || winningTeamTotal <= 0) {
            console.error(`calculatePayout: Invalid stored winningTeamTotal ${winningTeamTotal} for round ${roundNumber} lobby ${lobbyId}`);
            return 0;
          }

          if (!isFinite(losingTeamTotal) || losingTeamTotal < 0) {
            console.error(`calculatePayout: Invalid stored losingTeamTotal ${losingTeamTotal} for round ${roundNumber} lobby ${lobbyId}`);
            return 0;
          }

          const platformFee = losingTeamTotal * 0.1;
          const distributedPool = losingTeamTotal - platformFee;
          const userProportion = betAmount / winningTeamTotal;
          const winnings = distributedPool * userProportion;

          const payout = betAmount + winnings;

          // Final validation
          if (!isFinite(payout)) {
            console.error(`calculatePayout: Calculated payout is NaN or Infinity for round ${roundNumber} lobby ${lobbyId}`);
            return 0;
          }

          console.log(`💰 Calculated payout from stored pool data - Round ${roundNumber} Lobby ${lobbyId}: Bet $${betAmount} → Payout $${payout.toFixed(2)}`);
          return payout;
        } catch (e) {
          console.error(`Failed to load pool data for round ${roundNumber} lobby ${lobbyId}:`, e);
          // Fall through to use current state
        }
      } else {
        console.warn(`⚠️ No stored pool data found for round ${roundNumber} lobby ${lobbyId} - falling back to current state`);
      }
    }

    // FALLBACK: Use current state (only works if we're still in the same round)
    const state = this.currentStates.get(lobbyId);
    if (!state || state.winner !== betTeam) {
      return 0;
    }

    const winningTeamTotal = betTeam === "red"
      ? state.redTeam.totalAmount
      : state.blueTeam.totalAmount;

    const losingTeamTotal = betTeam === "red"
      ? state.blueTeam.totalAmount
      : state.redTeam.totalAmount;

    // Defensive checks: validate team totals
    if (!isFinite(winningTeamTotal) || winningTeamTotal <= 0) {
      console.error(`calculatePayout: Invalid winningTeamTotal ${winningTeamTotal} for lobby ${lobbyId}`);
      return 0;
    }

    if (!isFinite(losingTeamTotal) || losingTeamTotal < 0) {
      console.error(`calculatePayout: Invalid losingTeamTotal ${losingTeamTotal} for lobby ${lobbyId}`);
      return 0;
    }

    const platformFee = losingTeamTotal * 0.1;
    const distributedPool = losingTeamTotal - platformFee;
    const userProportion = betAmount / winningTeamTotal;
    const winnings = distributedPool * userProportion;

    const payout = betAmount + winnings;

    // Final validation
    if (!isFinite(payout)) {
      console.error(`calculatePayout: Calculated payout is NaN or Infinity for lobby ${lobbyId}`);
      return 0;
    }

    return payout;
  }

  destroy(lobbyId?: string) {
    if (lobbyId) {
      const timer = this.timers.get(lobbyId);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(lobbyId);
      }
      this.listeners.delete(lobbyId);
      this.currentStates.delete(lobbyId);
      this.usedUsernamesPerLobby.delete(lobbyId);
    } else {
      // Destroy all
      this.timers.forEach(timer => clearInterval(timer));
      this.timers.clear();
      this.listeners.clear();
      this.currentStates.clear();
      this.usedUsernamesPerLobby.clear();
    }
  }
}

// Singleton instance
export const lobbyGameStateService = new LobbyGameStateService();