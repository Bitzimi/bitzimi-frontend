/**
 * Dynamic Hidden Room Instance System
 *
 * Users ONLY see public lobbies (Lobby A, B, C, D)
 * Hidden rooms (A1-A7, B1-B7, etc.) work completely in background
 * System auto-scales beyond minimum 7 rooms based on traffic
 */

export interface HiddenRoom {
  id: string; // e.g., "color-A-1", "spin-B-3"
  lobbyId: string; // e.g., "A", "B", "C", "D"
  gameType: 'color' | 'spin' | 'dice-royale' | 'dice-arena';
  currentPlayers: number;
  maxPlayers: number;
  isActive: boolean;
  roundStartTime: number | null;
  state: any; // Game-specific state
}

export interface PublicLobby {
  id: string; // "A", "B", "C", "D"
  name: string; // "Lobby A", "Lobby B", etc.
  betRange: { min: number; max: number };
  gameType: 'color' | 'spin' | 'dice-royale' | 'dice-arena';
  maxPlayersPerRoom?: number; // For Spin Battle
}

// Minimum hidden rooms per lobby
const MIN_ROOMS_PER_LOBBY = 7;

// Auto-scaling thresholds
const ROOM_CAPACITY_THRESHOLD = 0.7; // 70% full triggers new room creation
const ROOM_CLEANUP_IDLE_TIME = 300000; // 5 minutes idle cleanup

// In-memory hidden room storage (in production, use Redis/database)
const hiddenRooms: Map<string, HiddenRoom[]> = new Map();

/**
 * Initialize hidden rooms for a lobby
 * Creates minimum 7 rooms per lobby
 */
export function initializeHiddenRooms(
  lobby: PublicLobby,
  count: number = MIN_ROOMS_PER_LOBBY
): void {
  const lobbyKey = `${lobby.gameType}-${lobby.id}`;

  if (!hiddenRooms.has(lobbyKey)) {
    hiddenRooms.set(lobbyKey, []);
  }

  const rooms = hiddenRooms.get(lobbyKey)!;
  const currentCount = rooms.length;

  // Create additional rooms if needed
  for (let i = currentCount; i < count; i++) {
    const roomNumber = i + 1;
    const newRoom: HiddenRoom = {
      id: `${lobby.gameType}-${lobby.id}-${roomNumber}`,
      lobbyId: lobby.id,
      gameType: lobby.gameType,
      currentPlayers: 0,
      maxPlayers: lobby.maxPlayersPerRoom || Infinity,
      isActive: true,
      roundStartTime: null,
      state: createInitialRoomState(lobby.gameType),
    };
    rooms.push(newRoom);
  }
}

/**
 * Create initial state for a room based on game type
 */
function createInitialRoomState(gameType: string): any {
  switch (gameType) {
    case 'color':
      return {
        redBets: [],
        blueBets: [],
        redTotal: 0,
        blueTotal: 0,
        result: null,
        history: [],
        timer: 30,
      };
    case 'spin':
      return {
        players: [], // Max 12 players per room
        spinResult: null,
        timer: 30,
        history: [],
        isRoundActive: false,
      };
    case 'dice-royale':
      return {
        players: [],
        diceResults: {},
        winner: null, // ONLY 1 winner per room
        timer: 30,
        history: [],
        isRoundActive: false,
      };
    case 'dice-arena':
      return {
        players: [],
        diceResults: {},
        rankings: [],
        winners: [], // EXACTLY 2 winners per room (top 2 players)
        maxWinners: 2,
        timer: 30,
        history: [],
        isRoundActive: false,
      };
    default:
      return {};
  }
}

/**
 * Automatic matchmaking - Find best available room for player
 * Distributes players intelligently across hidden rooms
 */
export function findAvailableRoom(
  lobby: PublicLobby,
  playerId: string
): HiddenRoom | null {
  const lobbyKey = `${lobby.gameType}-${lobby.id}`;

  // Initialize rooms if not exist
  if (!hiddenRooms.has(lobbyKey)) {
    initializeHiddenRooms(lobby);
  }

  const rooms = hiddenRooms.get(lobbyKey)!;

  // Find room with available space, prefer rooms with some players (better for multiplayer feel)
  const availableRooms = rooms
    .filter(room =>
      room.isActive &&
      room.currentPlayers < room.maxPlayers
    )
    .sort((a, b) => {
      // Prefer rooms that are 30-70% full for better player distribution
      const aFillRate = a.currentPlayers / a.maxPlayers;
      const bFillRate = b.currentPlayers / b.maxPlayers;

      const aScore = Math.abs(aFillRate - 0.5);
      const bScore = Math.abs(bFillRate - 0.5);

      return aScore - bScore;
    });

  if (availableRooms.length === 0) {
    // All rooms full - trigger auto-scaling
    scaleUpRooms(lobby);
    return findAvailableRoom(lobby, playerId); // Retry after scaling
  }

  return availableRooms[0];
}

/**
 * Dynamic auto-scaling - Create additional rooms when needed
 */
export function scaleUpRooms(lobby: PublicLobby): void {
  const lobbyKey = `${lobby.gameType}-${lobby.id}`;
  const rooms = hiddenRooms.get(lobbyKey) || [];

  // Check if scaling is needed
  const activeRooms = rooms.filter(r => r.isActive);
  const totalCapacity = activeRooms.reduce((sum, r) => sum + r.maxPlayers, 0);
  const totalPlayers = activeRooms.reduce((sum, r) => sum + r.currentPlayers, 0);

  const utilizationRate = totalPlayers / totalCapacity;

  if (utilizationRate >= ROOM_CAPACITY_THRESHOLD) {
    // Scale up by 3 rooms at a time
    const additionalRooms = 3;
    console.log(`[Auto-Scale] Creating ${additionalRooms} additional rooms for ${lobbyKey}`);
    initializeHiddenRooms(lobby, rooms.length + additionalRooms);
  }
}

/**
 * Join a player to a room
 */
export function joinRoom(room: HiddenRoom, playerId: string, betAmount?: number): boolean {
  if (room.currentPlayers >= room.maxPlayers) {
    return false;
  }

  room.currentPlayers++;

  // Add player to game-specific state
  switch (room.gameType) {
    case 'spin':
      if (!room.state.players.find((p: any) => p.id === playerId)) {
        room.state.players.push({
          id: playerId,
          betAmount: betAmount || 0,
          position: room.currentPlayers
        });
      }
      break;
    case 'dice-royale':
    case 'dice-arena':
      if (!room.state.players.find((p: any) => p.id === playerId)) {
        room.state.players.push({
          id: playerId,
          betAmount: betAmount || 0
        });
      }
      break;
  }

  return true;
}

/**
 * Leave a room
 */
export function leaveRoom(room: HiddenRoom, playerId: string): void {
  if (room.currentPlayers > 0) {
    room.currentPlayers--;
  }

  // Remove from game-specific state
  if (room.state.players) {
    room.state.players = room.state.players.filter((p: any) => p.id !== playerId);
  }
}

/**
 * Get all hidden rooms for a lobby (for backend processing only)
 */
export function getHiddenRooms(lobby: PublicLobby): HiddenRoom[] {
  const lobbyKey = `${lobby.gameType}-${lobby.id}`;
  return hiddenRooms.get(lobbyKey) || [];
}

/**
 * Get a specific hidden room by ID
 */
export function getHiddenRoom(roomId: string): HiddenRoom | undefined {
  for (const rooms of hiddenRooms.values()) {
    const room = rooms.find(r => r.id === roomId);
    if (room) return room;
  }
  return undefined;
}

/**
 * Update room state
 */
export function updateRoomState(roomId: string, newState: any): void {
  const room = getHiddenRoom(roomId);
  if (room) {
    room.state = { ...room.state, ...newState };
  }
}

/**
 * Cleanup idle rooms (scale down when traffic decreases)
 */
export function cleanupIdleRooms(lobby: PublicLobby): void {
  const lobbyKey = `${lobby.gameType}-${lobby.id}`;
  const rooms = hiddenRooms.get(lobbyKey) || [];

  // Keep minimum rooms always, remove extras that are empty and idle
  if (rooms.length > MIN_ROOMS_PER_LOBBY) {
    const now = Date.now();
    const activeRooms = rooms.filter((room, index) => {
      // Always keep first 7 rooms
      if (index < MIN_ROOMS_PER_LOBBY) return true;

      // Remove extra rooms that are empty
      return room.currentPlayers > 0;
    });

    if (activeRooms.length < rooms.length) {
      hiddenRooms.set(lobbyKey, activeRooms);
      console.log(`[Scale Down] Removed ${rooms.length - activeRooms.length} idle rooms from ${lobbyKey}`);
    }
  }
}

/**
 * Get lobby statistics (for monitoring, not shown to users)
 */
export function getLobbyStats(lobby: PublicLobby): {
  totalRooms: number;
  activeRooms: number;
  totalPlayers: number;
  averageOccupancy: number;
} {
  const rooms = getHiddenRooms(lobby);
  const activeRooms = rooms.filter(r => r.isActive);
  const totalPlayers = activeRooms.reduce((sum, r) => sum + r.currentPlayers, 0);
  const totalCapacity = activeRooms.reduce((sum, r) => sum + r.maxPlayers, 0);

  return {
    totalRooms: rooms.length,
    activeRooms: activeRooms.length,
    totalPlayers,
    averageOccupancy: totalCapacity > 0 ? totalPlayers / totalCapacity : 0,
  };
}

/**
 * Reset room after round completes
 */
export function resetRoom(roomId: string, gameType: string): void {
  const room = getHiddenRoom(roomId);
  if (room) {
    room.state = createInitialRoomState(gameType);
    room.currentPlayers = 0;
    room.roundStartTime = null;
  }
}
