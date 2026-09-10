type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
}

export function ProfessionalGoldCoin({ side, isAnimating = false }: ProfessionalGoldCoinProps) {
  return (
    <div
      className={`relative w-44 h-44 md:w-56 md:h-56 ${isAnimating ? 'inline-block' : ''}`}
      style={{
        ...(isAnimating && {
          animation: 'flipCoin 0.7s ease-in-out infinite',
          transformStyle: 'preserve-3d' as const
        })
      }}
    >
      {isAnimating ? (
        /* Show gold blur while flipping */
        <div className="w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #FFFEF7, #FFE66D 20%, #F4E87C 40%, #E6D67A 60%, #D4AF37 85%)',
            boxShadow: '0 10px 25px rgba(212, 175, 55, 0.3), 0 5px 15px rgba(0, 0, 0, 0.3)',
          }}
        />
      ) : (
        /* Show CSS-based coin with HEADS/TAILS */
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #FFFEF7, #FFE66D 20%, #F4E87C 40%, #E6D67A 60%, #D4AF37 85%)',
            boxShadow: '0 10px 25px rgba(212, 175, 55, 0.4), 0 5px 15px rgba(0, 0, 0, 0.4), inset 0 2px 10px rgba(255, 255, 255, 0.3), inset 0 -2px 10px rgba(0, 0, 0, 0.2)',
            border: '6px solid #D4AF37',
          }}
        >
          {/* Inner circle decoration */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
            }}
          />

          {/* Text */}
          <div className="relative z-10 text-center">
            <div
              className="font-bold tracking-wider"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                color: '#8B6F47',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3), 0 0 10px rgba(255, 255, 255, 0.5)',
                WebkitTextStroke: '1px #6B5635',
              }}
            >
              {side === "heads" ? "HEADS" : "TAILS"}
            </div>
          </div>

          {/* Edge notches for realistic coin look */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `repeating-conic-gradient(
              from 0deg,
              #B8960F 0deg 2deg,
              #D4AF37 2deg 4deg
            )`,
            clipPath: 'circle(50% at center)',
            opacity: 0.3,
          }} />
        </div>
      )}
    </div>
  );
}
