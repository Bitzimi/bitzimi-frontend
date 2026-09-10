type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
  animationElapsedMs?: number;
  animationDurationMs?: number;
}

/**
 * Presentation-only coin. The displayed side is supplied by the backend-authoritative
 * match result; this component never chooses an outcome.
 */
export function ProfessionalGoldCoin({
  side,
  isAnimating = false,
  animationElapsedMs = 0,
  animationDurationMs = 8000,
}: ProfessionalGoldCoinProps) {
  const label = side === "heads" ? "HEADS" : "TAILS";
  const mark = side === "heads" ? "B" : "Z";

  const animationStyle = isAnimating
    ? {
        animation: `flipCoin ${animationDurationMs}ms cubic-bezier(.12,.72,.18,1) 1 both`,
        animationDelay: `-${Math.max(0, animationElapsedMs)}ms`,
        animationFillMode: "both" as const,
      }
    : { transform: "rotateX(0deg) rotateY(0deg)" };

  return (
    <div
      className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72"
      style={{ perspective: "1800px" }}
      aria-label={`Coin showing ${label}`}
    >
      {/* Ambient glow and grounded shadow */}
      <div
        className="absolute left-1/2 top-[57%] w-[72%] h-[17%] -translate-x-1/2 rounded-full"
        style={{ background: "rgba(0,0,0,.72)", filter: "blur(18px)" }}
      />
      <div
        className="absolute inset-[3%] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255,214,86,.34), rgba(255,184,0,.08) 42%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d", ...animationStyle }}>
        {/* Dark-gold edge behind the face creates real thickness */}
        <div
          className="absolute inset-[1.5%] rounded-full"
          style={{
            background: "linear-gradient(180deg,#fff1a3 0%,#b87808 9%,#5b3400 26%,#2a1700 51%,#6b3e00 76%,#d39b24 94%,#fff0a0 100%)",
            boxShadow: "0 30px 50px rgba(0,0,0,.68), inset 0 -7px 11px rgba(0,0,0,.72), inset 0 3px 4px rgba(255,255,255,.8)",
            transform: "translate3d(0,10px,-10px)",
          }}
        />

        {/* Outer milled rim */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(145deg,#fff8c8 0%,#f1c94e 7%,#9d6508 20%,#4c2a00 42%,#7e4d03 58%,#d79f24 84%,#fff2a7 100%)",
            boxShadow: "0 25px 45px rgba(0,0,0,.58), inset 0 2px 5px rgba(255,255,255,.95), inset 0 -12px 18px rgba(38,20,0,.75)",
            transform: "translateZ(0)",
          }}
        >
          <div
            className="absolute inset-[1.8%] rounded-full"
            style={{
              background: "repeating-conic-gradient(from 0deg, rgba(53,29,0,.75) 0deg 1deg, rgba(255,238,150,.7) 1deg 2deg, rgba(112,65,0,.45) 2deg 3deg)",
              WebkitMaskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)",
              maskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)",
            }}
          />

          {/* Face */}
          <div
            className="absolute inset-[6%] rounded-full overflow-hidden"
            style={{
              background: "radial-gradient(circle at 29% 17%,#fffbd7 0%,#f9db70 12%,#d9a52d 34%,#a66a08 64%,#4d2c00 100%)",
              border: "2px solid rgba(255,247,190,.94)",
              boxShadow: "inset 0 3px 7px rgba(255,255,255,.9), inset 0 -15px 23px rgba(55,29,0,.7), 0 2px 4px rgba(42,22,0,.75)",
              transform: "translateZ(9px)",
            }}
          >
            <div
              className="absolute inset-[4%] rounded-full"
              style={{
                border: "2px solid rgba(86,48,0,.42)",
                boxShadow: "inset 0 0 0 2px rgba(255,239,145,.45), inset 0 0 26px rgba(255,255,255,.18)",
              }}
            />
            <div className="absolute inset-[9%] rounded-full border border-dashed border-yellow-100/60" />

            {/* Engraved emblem */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div
                className="relative flex items-center justify-center w-[43%] aspect-square rounded-full"
                style={{
                  background: "linear-gradient(145deg,rgba(255,247,183,.86),rgba(142,86,5,.28))",
                  border: "2px solid rgba(255,246,185,.86)",
                  boxShadow: "inset 0 2px 5px rgba(255,255,255,.72), inset 0 -5px 9px rgba(65,34,0,.55), 0 2px 3px rgba(56,30,0,.5)",
                }}
              >
                <svg viewBox="0 0 100 100" className="w-[66%] h-[66%]" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(91,52,0,.55)" strokeWidth="2" />
                  <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,248,191,.72)" strokeWidth="1.5" />
                  <path d="M35 68V32h17c10 0 16 5 16 12 0 5-3 9-8 11 6 2 10 6 10 12 0 8-7 13-18 13H35Zm8-22h8c5 0 8-2 8-5s-3-5-8-5h-8v10Zm0 16h10c5 0 8-2 8-6s-3-6-8-6H43v12Z" fill="rgba(75,42,0,.84)" />
                  <path d="M17 50h10M73 50h10M50 17v10M50 73v10" stroke="rgba(255,247,185,.9)" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </div>

              <div
                className="mt-2 font-black tracking-[0.14em]"
                style={{
                  fontSize: "clamp(1.35rem,4.5vw,2.4rem)",
                  color: "#603900",
                  textShadow: "0 1px 0 rgba(255,252,210,.98), 0 3px 5px rgba(54,29,0,.6)",
                  WebkitTextStroke: "1px rgba(72,39,0,.46)",
                }}
              >
                {label}
              </div>
              <div className="mt-1 text-[8px] md:text-[9px] font-bold tracking-[0.46em] text-[#704b08]/80">
                BITZIMI • {mark}
              </div>
            </div>

            {/* Specular highlight */}
            <div
              className="absolute left-[12%] top-[7%] w-[48%] h-[21%] rounded-full"
              style={{
                background: "linear-gradient(125deg,rgba(255,255,255,.96),rgba(255,255,255,.28) 42%,transparent 75%)",
                transform: "rotate(-18deg)",
                filter: "blur(.25px)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}