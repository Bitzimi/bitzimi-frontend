import { PublicLobby } from "../utils/roomManager";

/**
 * Public lobby configurations - ONLY these are visible to users
 * Hidden room instances are managed automatically in the background
 */

// COLOR PREDICTION LOBBIES
export const COLOR_PREDICTION_LOBBIES: PublicLobby[] = [
  {
    id: "A",
    name: "Lobby A",
    gameType: "color",
    betRange: { min: 1, max: 20 },
  },
  {
    id: "B",
    name: "Lobby B",
    gameType: "color",
    betRange: { min: 21, max: 100 },
  },
  {
    id: "C",
    name: "Lobby C",
    gameType: "color",
    betRange: { min: 101, max: 1000 },
  },
  {
    id: "D",
    name: "Lobby D",
    gameType: "color",
    betRange: { min: 1001, max: 5000 },
  },
];

// SPIN BATTLE LOBBIES
export const SPIN_BATTLE_LOBBIES: PublicLobby[] = [
  {
    id: "A",
    name: "Lobby A",
    gameType: "spin",
    betRange: { min: 1, max: 20 },
    maxPlayersPerRoom: 12,
  },
  {
    id: "B",
    name: "Lobby B",
    gameType: "spin",
    betRange: { min: 21, max: 50 },
    maxPlayersPerRoom: 12,
  },
  {
    id: "C",
    name: "Lobby C",
    gameType: "spin",
    betRange: { min: 51, max: 120 },
    maxPlayersPerRoom: 12,
  },
  {
    id: "D",
    name: "Lobby D",
    gameType: "spin",
    betRange: { min: 121, max: 500 },
    maxPlayersPerRoom: 12,
  },
];

// DICE ROYALE LOBBIES (6 players max - dice has 6 sides)
export const DICE_ROYALE_LOBBIES: PublicLobby[] = [
  {
    id: "A",
    name: "Lobby A",
    gameType: "dice-royale",
    betRange: { min: 1, max: 20 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "B",
    name: "Lobby B",
    gameType: "dice-royale",
    betRange: { min: 21, max: 50 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "C",
    name: "Lobby C",
    gameType: "dice-royale",
    betRange: { min: 51, max: 120 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "D",
    name: "Lobby D",
    gameType: "dice-royale",
    betRange: { min: 121, max: 500 },
    maxPlayersPerRoom: 6,
  },
];

// DICE ARENA LOBBIES (6 players max - dice has 6 sides)
export const DICE_ARENA_LOBBIES: PublicLobby[] = [
  {
    id: "A",
    name: "Lobby A",
    gameType: "dice-arena",
    betRange: { min: 1, max: 20 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "B",
    name: "Lobby B",
    gameType: "dice-arena",
    betRange: { min: 21, max: 50 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "C",
    name: "Lobby C",
    gameType: "dice-arena",
    betRange: { min: 51, max: 120 },
    maxPlayersPerRoom: 6,
  },
  {
    id: "D",
    name: "Lobby D",
    gameType: "dice-arena",
    betRange: { min: 121, max: 500 },
    maxPlayersPerRoom: 6,
  },
];

/**
 * Get lobby by ID and game type
 */
export function getLobby(
  gameType: 'color' | 'spin' | 'dice-royale' | 'dice-arena',
  lobbyId: string
): PublicLobby | undefined {
  let lobbies: PublicLobby[];

  switch (gameType) {
    case 'color':
      lobbies = COLOR_PREDICTION_LOBBIES;
      break;
    case 'spin':
      lobbies = SPIN_BATTLE_LOBBIES;
      break;
    case 'dice-royale':
      lobbies = DICE_ROYALE_LOBBIES;
      break;
    case 'dice-arena':
      lobbies = DICE_ARENA_LOBBIES;
      break;
    default:
      return undefined;
  }

  return lobbies.find(lobby => lobby.id === lobbyId);
}
