import { useState, useEffect, useRef } from "react";

interface PremiumDiceProps {
  value: number; // 1-6 (the final result) or 0 (reset state)
  isRolling?: boolean;
  playerColor?: "blue" | "red";
}

export function PremiumDice({ value, isRolling = false, playerColor = "blue" }: PremiumDiceProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentRotation, setCurrentRotation] = useState("rotateX(0deg) rotateY(0deg)");
  const [isAnimating, setIsAnimating] = useState(false);
  const animationStarted = useRef(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Face rotations - each face of the cube shows a different number (1-6)
  // We rotate the entire cube to show the desired face
  const getFaceRotation = (faceValue: number): { x: number; y: number } => {
    const rotations: Record<number, { x: number; y: number }> = {
      1: { x: 0, y: 0 },         // Front face
      2: { x: 0, y: 180 },       // Back face
      3: { x: 0, y: 90 },        // Right face
      4: { x: 0, y: -90 },       // Left face
      5: { x: -90, y: 0 },       // Top face
      6: { x: 90, y: 0 },        // Bottom face
    };
    return rotations[faceValue] || rotations[1];
  };

  // Animation: spin through multiple rotations then land on final face
  const getAnimatedRotation = (targetValue: number): string => {
    const final = getFaceRotation(targetValue);
    // Add 720deg (2 full spins) before landing on final rotation
    return `rotateX(${720 + final.x}deg) rotateY(${720 + final.y}deg)`;
  };

  const getStaticRotation = (targetValue: number): string => {
    const final = getFaceRotation(targetValue);
    return `rotateX(${final.x}deg) rotateY(${final.y}deg)`;
  };

  // Handle animation
  useEffect(() => {
    // Reset to showing "?" (face 1, no animation)
    if (value === 0) {
      setCurrentRotation(getStaticRotation(1));
      setIsAnimating(false);
      animationStarted.current = false;
      console.log("🎲 Dice reset");
      return;
    }

    // Start rolling animation when isRolling becomes true
    if (isRolling && value >= 1 && value <= 6 && !animationStarted.current) {
      animationStarted.current = true;
      setIsAnimating(true);

      console.log(`🎲 Starting animation - will land on face: ${value}`);

      // Set the animated rotation (will tumble for 2.2s then land on correct face)
      setCurrentRotation(getAnimatedRotation(value));

      // After animation completes, set to static rotation for stability
      const timer = setTimeout(() => {
        setCurrentRotation(getStaticRotation(value));
        setIsAnimating(false);
        console.log(`🎲 Animation complete - locked on face: ${value}`);
      }, 2200);

      return () => clearTimeout(timer);
    }

    // Reset when rolling stops
    if (!isRolling && animationStarted.current) {
      animationStarted.current = false;
    }
  }, [value, isRolling]);

  // Dot positions for each face (1-6)
  const getDotPositions = (num: number): { x: number; y: number }[] => {
    const positions: Record<number, { x: number; y: number }[]> = {
      1: [{ x: 50, y: 50 }],
      2: [
        { x: 30, y: 30 },
        { x: 70, y: 70 },
      ],
      3: [
        { x: 30, y: 30 },
        { x: 50, y: 50 },
        { x: 70, y: 70 },
      ],
      4: [
        { x: 30, y: 30 },
        { x: 70, y: 30 },
        { x: 30, y: 70 },
        { x: 70, y: 70 },
      ],
      5: [
        { x: 30, y: 30 },
        { x: 70, y: 30 },
        { x: 50, y: 50 },
        { x: 30, y: 70 },
        { x: 70, y: 70 },
      ],
      6: [
        { x: 30, y: 30 },
        { x: 70, y: 30 },
        { x: 30, y: 50 },
        { x: 70, y: 50 },
        { x: 30, y: 70 },
        { x: 70, y: 70 },
      ],
    };
    return positions[num] || positions[1];
  };

  const renderDiceFace = (faceNumber: number, faceTransform: string) => {
    const dots = getDotPositions(faceNumber);
    const faceColor = playerColor === "blue" ? "#f8fafc" : "#fef9f3";
    const dotColor = playerColor === "blue" ? "#1e293b" : "#7f1d1d";

    const isPlaceholder = value === 0 && faceNumber === 1;

    return (
      <div
        className="absolute w-full h-full rounded-lg"
        style={{
          transform: faceTransform,
          background: faceColor,
          backfaceVisibility: "hidden",
          border: `2px solid ${playerColor === "blue" ? "#cbd5e1" : "#fecaca"}`,
          boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Show "?" on face 1 when value is 0 */}
        {isPlaceholder ? (
          <div className="absolute inset-0 flex items-center justify-center text-3xl md:text-4xl font-bold text-gray-400">
            ?
          </div>
        ) : (
          /* Show dots for this face's number */
          dots.map((dot, index) => (
            <div
              key={index}
              className="absolute rounded-full"
              style={{
                width: "18%",
                height: "18%",
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                transform: "translate(-50%, -50%)",
                background: dotColor,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
              }}
            />
          ))
        )}
      </div>
    );
  };

  // Mobile dice size reduced by 60%
  const diceSize = isMobile ? "w-[38px] h-[38px]" : "w-20 h-20 md:w-24 md:h-24";
  const translateZ = isMobile ? "19px" : "2.5rem";

  return (
    <div
      className={`relative inline-block ${diceSize}`}
      style={{
        perspective: "1200px",
      }}
    >
      {/* 3D Dice Cube - Each face shows a DIFFERENT number (1-6) */}
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transform: currentRotation,
          transition: isAnimating
            ? "transform 2.2s cubic-bezier(0.2, 0.8, 0.3, 1)"
            : "transform 0.3s ease-out",
        }}
      >
        {/* Front face = 1 */}
        {renderDiceFace(1, `translateZ(${translateZ})`)}

        {/* Back face = 2 */}
        {renderDiceFace(2, `rotateY(180deg) translateZ(${translateZ})`)}

        {/* Right face = 4 (SWAPPED with 3) */}
        {renderDiceFace(4, `rotateY(90deg) translateZ(${translateZ})`)}

        {/* Left face = 3 (SWAPPED with 4) */}
        {renderDiceFace(3, `rotateY(-90deg) translateZ(${translateZ})`)}

        {/* Top face = 5 */}
        {renderDiceFace(5, `rotateX(90deg) translateZ(${translateZ})`)}

        {/* Bottom face = 6 */}
        {renderDiceFace(6, `rotateX(-90deg) translateZ(${translateZ})`)}
      </div>

      {/* Shadow */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: isMobile ? "-1.5rem" : "-3rem",
          width: isAnimating ? (isMobile ? "32px" : "60px") : (isMobile ? "26px" : "50px"),
          height: isMobile ? "6px" : "10px",
          background: "radial-gradient(ellipse, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.1) 40%, transparent 70%)",
          filter: "blur(6px)",
          transition: "width 1s ease",
        }}
      />
    </div>
  );
}
