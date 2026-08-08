import { useState, useEffect, useRef } from "react";
import {
  findAvailableRoom,
  joinRoom,
  leaveRoom,
  getHiddenRoom,
  updateRoomState,
  initializeHiddenRooms,
  getLobbyStats,
  cleanupIdleRooms,
  HiddenRoom,
} from "../utils/roomManager";
import { PublicLobby } from "../utils/roomManager";

/**
 * Hook for automatic hidden room assignment and management
 * Handles matchmaking, room allocation, and cleanup automatically
 * UI remains unchanged - users never see hidden room IDs
 */
export function useHiddenRoom(lobby: PublicLobby | null, playerId: string) {
  const [assignedRoom, setAssignedRoom] = useState<HiddenRoom | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const roomRef = useRef<HiddenRoom | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize hidden rooms for this lobby
  useEffect(() => {
    if (lobby) {
      initializeHiddenRooms(lobby);

      // Periodic cleanup of idle rooms (scale down)
      cleanupIntervalRef.current = setInterval(() => {
        cleanupIdleRooms(lobby);
      }, 60000); // Every minute

      return () => {
        if (cleanupIntervalRef.current) {
          clearInterval(cleanupIntervalRef.current);
        }
      };
    }
  }, [lobby]);

  // Automatic matchmaking - assign player to best available room
  useEffect(() => {
    if (!lobby || assignedRoom || isJoining) return;

    setIsJoining(true);

    // Find and join best available room
    const room = findAvailableRoom(lobby, playerId);

    if (room) {
      const joined = joinRoom(room, playerId);
      if (joined) {
        setAssignedRoom(room);
        roomRef.current = room;
        console.log(`[Hidden Room] Player ${playerId} joined room ${room.id}`);
      }
    }

    setIsJoining(false);
  }, [lobby, playerId, assignedRoom, isJoining]);

  // Cleanup on unmount - leave room
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        leaveRoom(roomRef.current, playerId);
        console.log(`[Hidden Room] Player ${playerId} left room ${roomRef.current.id}`);
      }
    };
  }, [playerId]);

  // Get current room state
  const getRoomState = () => {
    if (!assignedRoom) return null;
    const room = getHiddenRoom(assignedRoom.id);
    return room?.state || null;
  };

  // Update room state
  const setRoomState = (newState: any) => {
    if (assignedRoom) {
      updateRoomState(assignedRoom.id, newState);
    }
  };

  // Get lobby statistics (for debugging/monitoring)
  const getStats = () => {
    if (!lobby) return null;
    return getLobbyStats(lobby);
  };

  return {
    assignedRoom,
    roomId: assignedRoom?.id,
    isJoining,
    getRoomState,
    setRoomState,
    getStats,
  };
}
