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
      className={`relative w-48 h-48 md:w-60 md:h-60 ${isAnimating ? "inline-block" : ""}`}
      style={{ perspective: "1200px" }}
      aria-label={`Coin showing ${label}`}
    >
      <div
        className="absolute left-1/2 top-1/2 w-[82%] h-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(245,185,35,.24), rgba(245,185,35,0) 68%)",
          filter: "blur(16px)",
        }}
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
        <div
          className="absolute inset-[2%] rounded-full"
          style={{
            background: "linear-gradient(145deg, #fff2a8 0%, #f7ca43 18%, #b97c09 52%, #6c4300 78%, #e0a91f 100%)",
            boxShadow: "0 24px 45px rgba(0,0,0,.48), 0 0 34px rgba(244,190,55,.22), inset 0 3px 4px rgba(255,255,255,.72), inset 0 -7px 11px rgba(60,35,0,.5)",
            transform: "translateZ(0px)",
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "repeating-conic-gradient(from 0deg, rgba(73,43,0,.55) 0deg 1deg, rgba(255,230,120,.35) 1deg 2deg, transparent 2deg 4deg)",
              WebkitMaskImage: "radial-gradient(circle, transparent 0 79%, #000 80% 100%)",
              maskImage: "radial-gradient(circle, transparent 0 79%, #000 80% 100%)",
              opacity: .9,
            }}
          />

          <div
            className="absolute inset-[5%] rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,.7), rgba(255,255,255,0) 28%, rgba(73,43,0,.18) 72%, rgba(255,230,120,.35))",
              border: "2px solid rgba(255,239,158,.75)",
              boxShadow: "inset 0 0 0 2px rgba(91,54,0,.28), inset 0 0 22px rgba(255,255,255,.16)",
            }}
          />

          <div className="absolute inset-[10%] rounded-full overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle at 32% 20%, rgba(255,255,255,.62), transparent 20%), radial-gradient(circle at 68% 80%, rgba(70,38,0,.28), transparent 48%)",
              }}
            />
            <div
              className="absolute inset-[7%] rounded-full"
              style={{ border: "1px solid rgba(105,63,0,.45)" }}
            />
            <div
              className="absolute inset-[12%] rounded-full"
              style={{ border: "1px dashed rgba(255,235,145,.62)" }}
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <svg viewBox="0 0 80 80" className="w-14 h-14 md:w-16 md:h-16 mb-1" aria-hidden="true">
                <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,240,166,.78)" strokeWidth="2" />
                <circle cx="40" cy="40" r="24" fill="none" stroke="rgba(101,60,0,.45)" strokeWidth="1.5" />
                <path d="M29 51V28h12c7 0 11 3 11 8 0 3-2 5-5 6 4 1 6 4 6 7 0 5-4 8-12 8H29Zm7-14h5c3 0 5-1 5-3s-2-3-5-3h-5v6Zm0 11h6c3 0 5-1 5-3s-2-3-5-3h-6v6Z" fill="rgba(102,61,0,.72)" />
                <path d="M17 40h8M55 40h8M40 17v8M40 55v8" stroke="rgba(255,239,158,.7)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div
                className="font-black tracking-[0.18em]"
                style={{
                  fontSize: "clamp(1.35rem, 4vw, 2.2rem)",
                  color: "#704900",
                  textShadow: "0 1px 0 rgba(255,247,188,.85), 0 3px 4px rgba(57,33,0,.4)",
                  WebkitTextStroke: "1px rgba(86,50,0,.5)",
                }}
              >
                {label}
              </div>
              <div className="mt-1 text-[8px] md:text-[9px] font-bold tracking-[0.42em] text-[#76500b]/75">
                BITZIMI • {mark}
              </div>
            </div>
          </div>

          <div
            className="absolute left-[17%] top-[11%] w-[38%] h-[18%] rounded-full"
            style={{
              background: "linear-gradient(125deg, rgba(255,255,255,.8), rgba(255,255,255,0))",
              transform: "rotate(-18deg)",
              filter: "blur(.2px)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
