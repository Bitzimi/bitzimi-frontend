type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
}

export function ProfessionalGoldCoin({ side, isAnimating = false }: ProfessionalGoldCoinProps) {
  return (
    <div
      className={`relative w-44 h-44 md:w-56 md:h-56 ${isAnimating ? "inline-block" : ""}`}
      style={{ perspective: "900px" }}
    >
      <div
        className="relative w-full h-full rounded-full"
        style={{
          transformStyle: "preserve-3d",
          ...(isAnimating
            ? { animation: "flipCoin 0.7s cubic-bezier(.4,.05,.2,1) infinite" }
            : {}),
        }}
      >
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            background: "radial-gradient(circle at 32% 24%, #fffdf0 0%, #ffe98a 14%, #e8bd36 42%, #a87808 76%, #6b4700 100%)",
            border: "7px solid #d4a72c",
            boxShadow: "0 18px 40px rgba(0,0,0,.42), 0 0 28px rgba(244,190,55,.28), inset 0 3px 8px rgba(255,255,255,.75), inset 0 -10px 16px rgba(83,51,0,.4)",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            className="absolute inset-[9px] rounded-full"
            style={{
              border: "2px solid rgba(255,248,190,.72)",
              boxShadow: "inset 0 0 0 3px rgba(121,78,0,.25), inset 0 0 18px rgba(255,255,255,.22)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "repeating-conic-gradient(from 0deg, rgba(92,58,0,.28) 0deg 1.2deg, transparent 1.2deg 4deg)",
              opacity: 0.65,
            }}
          />
          <div
            className="absolute left-[18%] top-[13%] w-[35%] h-[24%] rounded-full"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,0))", transform: "rotate(-18deg)" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative z-10 px-3 text-center font-black tracking-[0.14em]"
              style={{
                fontSize: "clamp(1.65rem, 4.5vw, 2.8rem)",
                color: "#684500",
                textShadow: "0 2px 0 rgba(255,244,170,.65), 0 4px 7px rgba(0,0,0,.35)",
                WebkitTextStroke: "1px rgba(79,49,0,.65)",
              }}
            >
              {side === "heads" ? "HEADS" : "TAILS"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
