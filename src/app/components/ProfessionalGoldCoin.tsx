type CoinSide = "heads" | "tails";

interface ProfessionalGoldCoinProps {
  side: CoinSide;
  isAnimating?: boolean;
  animationElapsedMs?: number;
  animationDurationMs?: number;
}

/** Presentation-only coin. The backend supplies the side and result. */
export function ProfessionalGoldCoin({ side, isAnimating = false, animationElapsedMs = 0, animationDurationMs = 8000 }: ProfessionalGoldCoinProps) {
  const label = side === "heads" ? "HEADS" : "TAILS";
  const mark = side === "heads" ? "B" : "Z";
  const animationStyle = isAnimating
    ? { animation: `bitzimiCoinFlip ${animationDurationMs}ms cubic-bezier(.12,.72,.18,1) 1 both`, animationDelay: `-${Math.max(0, animationElapsedMs)}ms`, animationFillMode: "both" as const }
    : { transform: "rotateY(0deg) rotateX(0deg)" };

  return (
    <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 select-none" style={{ perspective: "1800px" }} aria-label={`Coin showing ${label}`}>
      <style>{`@keyframes bitzimiCoinFlip { 0% { transform: rotateY(0deg) rotateX(0deg) translateY(0) scale(1); } 12% { transform: rotateY(280deg) rotateX(18deg) translateY(-8px) scale(1.02); } 42% { transform: rotateY(1120deg) rotateX(-12deg) translateY(-26px) scale(1.06); } 72% { transform: rotateY(1780deg) rotateX(9deg) translateY(-12px) scale(1.03); } 100% { transform: rotateY(2160deg) rotateX(0deg) translateY(0) scale(1); } }`}</style>
      <div className="absolute left-1/2 top-[58%] w-[68%] h-[15%] -translate-x-1/2 rounded-full" style={{ background: "rgba(0,0,0,.78)", filter: "blur(20px)" }} />
      <div className="absolute inset-[1%] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,231,112,.48), rgba(255,178,0,.12) 48%, transparent 72%)", filter: "blur(28px)" }} />
      <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d", ...animationStyle }}>
        <div className="absolute inset-[2%] rounded-full" style={{ background: "linear-gradient(180deg,#fff7b8 0%,#d59a22 7%,#7a4a03 19%,#2a1700 48%,#5a3200 70%,#d49b20 91%,#fff1a0 100%)", boxShadow: "0 34px 55px rgba(0,0,0,.72), inset 0 -10px 14px rgba(0,0,0,.76), inset 0 4px 6px rgba(255,255,255,.88)", transform: "translate3d(0,11px,-12px)" }} />
        <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(145deg,#fffde0 0%,#f7d65b 8%,#bd7c0b 19%,#5a3300 38%,#8f5b05 61%,#dba72e 86%,#fff5b0 100%)", boxShadow: "0 26px 48px rgba(0,0,0,.62), inset 0 3px 6px rgba(255,255,255,.98), inset 0 -14px 21px rgba(34,18,0,.78)" }}>
          <div className="absolute inset-[1.4%] rounded-full" style={{ border: "2px solid rgba(255,247,188,.9)", boxShadow: "inset 0 0 0 1px rgba(78,43,0,.7), 0 0 0 1px rgba(255,221,91,.4)" }} />
          <div className="absolute inset-[3.5%] rounded-full" style={{ background: "repeating-conic-gradient(from 0deg, rgba(54,28,0,.8) 0deg 1deg, rgba(255,240,158,.75) 1deg 2deg, rgba(111,63,0,.55) 2deg 3deg)", WebkitMaskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)", maskImage: "radial-gradient(circle, transparent 0 82%, #000 83% 100%)" }} />
          <div className="absolute inset-[7%] rounded-full overflow-hidden" style={{ background: "radial-gradient(circle at 28% 16%,#fffde4 0%,#fbe18a 12%,#e0ad36 31%,#a86b08 58%,#4a2900 100%)", border: "3px solid rgba(255,248,199,.94)", boxShadow: "inset 0 4px 8px rgba(255,255,255,.9), inset 0 -17px 26px rgba(49,25,0,.74), 0 3px 5px rgba(37,19,0,.82)", transform: "translateZ(10px)" }}>
            <div className="absolute inset-[4%] rounded-full" style={{ border: "2px solid rgba(80,43,0,.45)", boxShadow: "inset 0 0 0 2px rgba(255,239,145,.5), inset 0 0 30px rgba(255,255,255,.2)" }} />
            <div className="absolute inset-[9%] rounded-full" style={{ border: "1px dashed rgba(255,247,190,.68)" }} />
            <div className="absolute inset-[15%] rounded-full" style={{ border: "1px solid rgba(83,45,0,.35)", boxShadow: "inset 0 0 22px rgba(255,242,160,.18)" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="relative flex items-center justify-center w-[43%] aspect-square rounded-full" style={{ background: "linear-gradient(145deg,rgba(255,249,198,.92),rgba(151,91,5,.3))", border: "2px solid rgba(255,246,185,.92)", boxShadow: "inset 0 3px 6px rgba(255,255,255,.78), inset 0 -6px 10px rgba(61,31,0,.58), 0 3px 4px rgba(47,24,0,.55)" }}>
                <div className="absolute inset-[7%] rounded-full" style={{ border: "1px solid rgba(90,50,0,.35)" }} />
                <svg viewBox="0 0 100 100" className="w-[66%] h-[66%]" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(91,52,0,.58)" strokeWidth="2" /><circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,248,191,.76)" strokeWidth="1.5" /><path d="M35 68V32h17c10 0 16 5 16 12 0 5-3 9-8 11 6 2 10 6 10 12 0 8-7 13-18 13H35Zm8-22h8c5 0 8-2 8-5s-3-5-8-5h-8v10Zm0 16h10c5 0 8-2 8-6s-3-6-8-6H43v12Z" fill="rgba(70,38,0,.88)" /><path d="M17 50h10M73 50h10M50 17v10M50 73v10" stroke="rgba(255,247,185,.94)" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </div>
              <div className="mt-2 font-black tracking-[0.14em]" style={{ fontSize: "clamp(1.35rem,4.5vw,2.4rem)", color: "#5c3600", textShadow: "0 1px 0 rgba(255,252,210,.98), 0 3px 5px rgba(54,29,0,.65)", WebkitTextStroke: "1px rgba(72,39,0,.46)" }}>{label}</div>
              <div className="mt-1 text-[8px] md:text-[9px] font-bold tracking-[0.46em] text-[#704b08]/80">BITZIMI • {mark}</div>
            </div>
            <div className="absolute left-[10%] top-[6%] w-[52%] h-[22%] rounded-full" style={{ background: "linear-gradient(125deg,rgba(255,255,255,.98),rgba(255,255,255,.3) 42%,transparent 75%)", transform: "rotate(-18deg)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
