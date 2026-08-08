import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface WheelSpinnerProps {
  isSpinning: boolean;
  winner: "red" | "blue" | null;
  timeRemaining?: number;
  gameState?: "WAITING" | "SPINNING" | "RESULT";
  roundNumber?: number;
}

export function WheelSpinner({ isSpinning, winner, timeRemaining = 0, gameState = "WAITING", roundNumber }: WheelSpinnerProps) {
  const [rotation, setRotation] = useState(0);
  const [showWinner, setShowWinner] = useState(false);

  // Reset wheel when new round starts (timer at 90 seconds)
  useEffect(() => {
    if (gameState === "WAITING" && timeRemaining === 90) {
      setRotation(0);
      setShowWinner(false);
    }
  }, [gameState, timeRemaining, roundNumber]);

  // Calculate rotation based on winner from server
  // Wheel layout: Left half (0-180°) = BLUE, Right half (180-360°) = RED
  const getTargetRotation = () => {
    if (!winner) return 0;
    
    const baseRotation = 1800; // 5 full spins
    
    // Generate random angle within the correct segment
    let winnerOffset;
    if (winner === "red") {
      // RED segment: 180° to 360° (right half)
      // Random angle between 180 and 360
      winnerOffset = 180 + Math.random() * 180;
    } else {
      // BLUE segment: 0° to 180° (left half)  
      // Random angle between 0 and 180
      winnerOffset = Math.random() * 180;
    }
    
    return baseRotation + winnerOffset;
  };

  // Update rotation when spinning starts
  useEffect(() => {
    if (isSpinning && winner) {
      const targetRotation = getTargetRotation();
      setRotation(targetRotation);
      setShowWinner(false);
    }
  }, [isSpinning, winner]);

  // Show winner overlay only when in RESULT state with a winner
  useEffect(() => {
    if (gameState === "RESULT" && winner) {
      setShowWinner(true);
    }
  }, [gameState, winner]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Fixed Arrow Pointer at Top Center - POINTING DOWN */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30" style={{ marginTop: '-12px' }}>
        <div className="relative">
          {/* Arrow pointing DOWN */}
          <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-2xl">
            <path
              d="M20 25 L30 10 L10 10 Z"
              fill="#1f2937"
              stroke="#ffffff"
              strokeWidth="3"
            />
          </svg>
        </div>
      </div>

      {/* Rotating Wheel */}
      <motion.div
        className="w-full h-full relative"
        animate={{
          rotate: rotation,
        }}
        transition={{
          duration: isSpinning ? 6 : 0, // Fixed 6 seconds for sync
          ease: isSpinning ? [0.33, 1, 0.68, 1] : "linear",
        }}
      >
        {/* Main Wheel Circle */}
        <div className="absolute inset-0 rounded-full overflow-hidden border-8 border-gray-800 shadow-2xl">
          
          {/* Blue Half (Left Side) */}
          <div 
            className="absolute inset-0 bg-blue-500"
            style={{
              clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)",
            }}
          >
            {/* Blue Label */}
            <div className="absolute left-[25%] top-1/2 -translate-x-1/2 -translate-y-1/2">
              <p className="text-white font-bold text-2xl md:text-3xl drop-shadow-lg transform rotate-0">
                BLUE
              </p>
            </div>
          </div>

          {/* Red Half (Right Side) */}
          <div 
            className="absolute inset-0 bg-red-500"
            style={{
              clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)",
            }}
          >
            {/* Red Label */}
            <div className="absolute right-[25%] top-1/2 translate-x-1/2 -translate-y-1/2">
              <p className="text-white font-bold text-2xl md:text-3xl drop-shadow-lg transform rotate-0">
                RED
              </p>
            </div>
          </div>

          {/* White Dividing Line */}
          <div className="absolute top-0 left-1/2 w-1 h-full bg-white -translate-x-1/2 z-10" />

          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white border-4 border-gray-800 shadow-xl z-20" />
        </div>

        {/* Inner shadow for 3D effect */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] pointer-events-none" />
      </motion.div>

      {/* Countdown Timer in Center of Wheel - FIXED (doesn't rotate) - SMALLER SIZE */}
      {gameState === "WAITING" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          <motion.div
            animate={{ scale: timeRemaining <= 10 ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.5, repeat: timeRemaining <= 10 ? Infinity : 0 }}
            className={`text-xl font-semibold ${
              timeRemaining <= 10 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {formatTime(timeRemaining)}
          </motion.div>
        </div>
      )}

      {/* Winner Highlight Glow - Only show when RESULT state with winner */}
      {showWinner && gameState === "RESULT" && winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 pointer-events-none"
        >
          <div
            className={`absolute inset-0 rounded-full blur-2xl ${
              winner === "red" ? "bg-red-500" : "bg-blue-500"
            } opacity-30`}
          />
        </motion.div>
      )}
    </div>
  );
}