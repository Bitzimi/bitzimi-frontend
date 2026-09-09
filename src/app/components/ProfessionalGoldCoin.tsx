type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
  animationElapsedMs?: number;
  animationDurationMs?: number;
}

export function ProfessionalGoldCoin({ side, isAnimating = false, animationElapsedMs = 0, animationDurationMs = 2500 }: ProfessionalGoldCoinProps) {
  const label = side === "heads" ? "HEADS" : "TAILS";
  const mark = side === "heads" ? "B" : "Z";

  return (
    <div className={`relative w-52 h-52 md:w-64 md:h-64 ${isAnimating ? "inline-block" : ""}`} style={{ perspective: "1400px" }} aria-label={`Coin showing ${label}`}>
      <div className="absolute left-1/2 top-[56%] w-[76%] h-[20%] -translate-x-1/2 rounded-full" style={{ background: "rgba(0,0,0,.62)", filter: "blur(15px)" }} />
      <div className="absolute left-1/2 top-1/2 w-[92%] h-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,211,73,.30), rgba(255,211,73,0) 68%)", filter: "blur(20px)" }} />

      <div className="relative w-full h-full rounded-full" style={{ transformStyle: "preserve-3d", ...(isAnimating ? { animation: `flipCoin ${animationDurationMs}ms cubic-bezier(.22,.61,.36,1) 1 both`, animationDelay: `-${Math.max(0, animationElapsedMs)}ms`, animationFillMode: "both" } : { transform: "rotateX(0deg) rotateY(0deg)" }) }}>
        <div className="absolute inset-[2%] rounded-full" style={{ background: "linear-gradient(180deg, #6f4300 0%, #3c2200 22%, #1f1200 52%, #6b4100 78%, #c18a1a 100%)", boxShadow: "0 24px 38px rgba(0,0,0,.60), inset 0 -5px 8px rgba(0,0,0,.65)", transform: "translate3d(0, 8px, -8px)" }} />

        <div className="absolute inset-[1%] rounded-full" style={{ background: "linear-gradient(180deg, #fff8c5 0%, #f4cf58 8%, #c58a13 20%, #6e4300 42%, #3e2500 53%, #a76d08 75%, #e7b93d 91%, #fff2a5 100%)", boxShadow: "0 28px 46px rgba(0,0,0,.55), inset 0 2px 3px rgba(255,255,255,.9), inset 0 -10px 15px rgba(45,25,0,.70), 0 0 42px rgba(245,193,55,.20)", transform: "translateZ(0)" }}>
          <div className="absolute inset-[1.5%] rounded-full" style={{ background: "repeating-conic-gradient(from 0deg, rgba(67,39,0,.70) 0deg 1.1deg, rgba(255,236,143,.62) 1.1deg 2.2deg, transparent 2.2deg 3.8deg)", WebkitMaskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)", maskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)" }} />

          <div className="absolute inset-[5%] rounded-full" style={{ background: "radial-gradient(circle at 30% 18%, #fff8bf 0%, #f8d66b 14%, #e0aa2b 42%, #ad710b 69%, #663d00 100%)", border: "2px solid rgba(255,245,179,.88)", boxShadow: "inset 0 2px 6px rgba(255,255,255,.82), inset 0 -10px 18px rgba(60,33,0,.62), 0 2px 3px rgba(48,27,0,.65)", transform: "translateZ(7px)" }}>
            <div className="absolute inset-[4%] rounded-full" style={{ border: "2px solid rgba(90,53,0,.36)", boxShadow: "inset 0 0 0 2px rgba(255,235,139,.42), inset 0 0 22px rgba(255,255,255,.16)" }} />
            <div className="absolute inset-[9%] rounded-full" style={{ border: "1px dashed rgba(255,239,153,.62)" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <svg viewBox="0 0 100 100" className="w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] mb-1" aria-hidden="true">
                <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,247,190,.88)" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(92,54,0,.50)" strokeWidth="1.5" />
                <path d="M36 66V34h16c9 0 14 4 14 10 0 4-2 7-7 9 5 1 8 5 8 9 0 7-6 11-16 11H36Zm8-19h7c5 0 7-2 7-4 0-3-2-4-7-4h-7v8Zm0 14h9c4 0 7-2 7-5 0-3-3-5-7-5h-9v10Z" fill="rgba(91,53,0,.82)" />
                <path d="M20 50h9M71 50h9M50 20v9M50 71v9" stroke="rgba(255,246,181,.82)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <div className="font-black tracking-[0.16em]" style={{ fontSize: "clamp(1.35rem, 4.2vw, 2.25rem)", color: "#684100", textShadow: "0 1px 0 rgba(255,250,201,.98), 0 3px 4px rgba(55,31,0,.52)", WebkitTextStroke: "1px rgba(75,42,0,.48)" }}>{label}</div>
              <div className="mt-1 text-[8px] md:text-[9px] font-bold tracking-[0.42em] text-[#704b08]/80">BITZIMI • {mark}</div>
            </div>
            <div className="absolute left-[14%] top-[8%] w-[44%] h-[18%] rounded-full" style={{ background: "linear-gradient(125deg, rgba(255,255,255,.92), rgba(255,255,255,0))", transform: "rotate(-18deg)", filter: "blur(.2px)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
