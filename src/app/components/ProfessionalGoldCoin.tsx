type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
}

export function ProfessionalGoldCoin({ side, isAnimating = false }: ProfessionalGoldCoinProps) {
  const label = side === "heads" ? "HEADS" : "TAILS";
  const mark = side === "heads" ? "B" : "Z";

  return (
    <div
      className={`relative w-52 h-52 md:w-64 md:h-64 ${isAnimating ? "inline-block" : ""}`}
      style={{ perspective: "1400px" }}
      aria-label={`Coin showing ${label}`}
    >
      <div
        className="absolute left-1/2 top-[54%] w-[76%] h-[20%] -translate-x-1/2 rounded-full"
        style={{ background: "rgba(0,0,0,.58)", filter: "blur(14px)" }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-[88%] h-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,208,65,.25), rgba(255,208,65,0) 67%)", filter: "blur(18px)" }}
      />

      <div
        className="relative w-full h-full rounded-full"
        style={{
          transformStyle: "preserve-3d",
          ...(isAnimating
            ? { animation: "flipCoin 0.7s cubic-bezier(.4,.05,.2,1) infinite" }
            : { transform: "rotateX(0deg) rotateY(0deg)" }),
        }}
      >
        {/* Metallic outer rim / edge */}
        <div
          className="absolute inset-[1%] rounded-full"
          style={{
            background: "linear-gradient(180deg, #fff4b0 0%, #dca82a 11%, #805000 38%, #4e2e00 52%, #a96f08 72%, #f3c94b 92%, #fff0a0 100%)",
            boxShadow: "0 28px 46px rgba(0,0,0,.55), inset 0 2px 3px rgba(255,255,255,.8), inset 0 -9px 14px rgba(45,25,0,.65), 0 0 38px rgba(245,193,55,.18)",
            transform: "translateZ(0)",
          }}
        >
          {/* Fine milled edge */}
          <div
            className="absolute inset-[1.5%] rounded-full"
            style={{
              background: "repeating-conic-gradient(from 0deg, rgba(67,39,0,.65) 0deg 1.2deg, rgba(255,236,143,.5) 1.2deg 2.4deg, transparent 2.4deg 4deg)",
              WebkitMaskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)",
              maskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)",
            }}
          />

          {/* Raised coin face */}
          <div
            className="absolute inset-[5%] rounded-full"
            style={{
              background: "radial-gradient(circle at 31% 20%, #fff4ad 0%, #f6ce55 17%, #d69b1b 46%, #9a6207 72%, #5f3800 100%)",
              border: "2px solid rgba(255,241,163,.82)",
              boxShadow: "inset 0 2px 5px rgba(255,255,255,.78), inset 0 -9px 16px rgba(68,38,0,.55), 0 2px 2px rgba(48,27,0,.55)",
              transform: "translateZ(2px)",
            }}
          >
            <div
              className="absolute inset-[4%] rounded-full"
              style={{
                border: "2px solid rgba(90,53,0,.35)",
                boxShadow: "inset 0 0 0 2px rgba(255,235,139,.38), inset 0 0 22px rgba(255,255,255,.14)",
              }}
            />
            <div
              className="absolute inset-[9%] rounded-full"
              style={{ border: "1px dashed rgba(255,239,153,.58)" }}
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <svg viewBox="0 0 100 100" className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] mb-1" aria-hidden="true">
                <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,243,175,.82)" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(92,54,0,.48)" strokeWidth="1.5" />
                <path d="M36 66V34h16c9 0 14 4 14 10 0 4-2 7-7 9 5 1 8 5 8 9 0 7-6 11-16 11H36Zm8-19h7c5 0 7-2 7-4 0-3-2-4-7-4h-7v8Zm0 14h9c4 0 7-2 7-5 0-3-3-5-7-5h-9v10Z" fill="rgba(91,53,0,.78)" />
                <path d="M20 50h9M71 50h9M50 20v9M50 71v9" stroke="rgba(255,242,168,.78)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div
                className="font-black tracking-[0.16em]"
                style={{
                  fontSize: "clamp(1.35rem, 4.2vw, 2.25rem)",
                  color: "#704800",
                  textShadow: "0 1px 0 rgba(255,250,201,.95), 0 3px 4px rgba(55,31,0,.48)",
                  WebkitTextStroke: "1px rgba(75,42,0,.45)",
                }}
              >
                {label}
              </div>
              <div className="mt-1 text-[8px] md:text-[9px] font-bold tracking-[0.42em] text-[#704b08]/80">
                BITZIMI • {mark}
              </div>
            </div>

            <div
              className="absolute left-[15%] top-[9%] w-[42%] h-[17%] rounded-full"
              style={{
                background: "linear-gradient(125deg, rgba(255,255,255,.82), rgba(255,255,255,0))",
                transform: "rotate(-18deg)",
                filter: "blur(.2px)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
