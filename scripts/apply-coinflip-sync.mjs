import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

{
 const p='src/app/components/ProfessionalGoldCoin.tsx'; let s=read(p);
 s=s.replace('  isAnimating?: boolean;\n}', '  isAnimating?: boolean;\n  animationElapsedMs?: number;\n  animationDurationMs?: number;\n}');
 s=s.replace('export function ProfessionalGoldCoin({ side, isAnimating = false }: ProfessionalGoldCoinProps) {', 'export function ProfessionalGoldCoin({ side, isAnimating = false, animationElapsedMs = 0, animationDurationMs = 2500 }: ProfessionalGoldCoinProps) {');
 s=s.replace('            ? { animation: "flipCoin 0.7s cubic-bezier(.4,.05,.2,1) infinite" }', '            ? { animation: `flipCoin ${animationDurationMs}ms cubic-bezier(.22,.61,.36,1) 1 both`, animationDelay: `-${Math.max(0, animationElapsedMs)}ms`, animationFillMode: "both" }');
 write(p,s);
}

{
 const p='src/app/pages/PvPCoinFlipGame.tsx'; let s=read(p);
 if(!s.includes('flipElapsedMs')) s=s.replace('  const [matchData, setMatchData] = useState<any>(null);', '  const [matchData, setMatchData] = useState<any>(null);\n  const [flipElapsedMs, setFlipElapsedMs] = useState(0);');
 s=s.replace('    setGameState("searching");\n    try {', '    try {');
 s=s.replace('      if (result.queueId) {\n        setQueueId(result.queueId);', '      if (result.queueId) {\n        setGameState("searching");\n        setQueueId(result.queueId);');
 const oldAssign=`  const assignSides = (md?: any) => {
    const data = md ?? matchData;
    if (!data?.result) { navigate("/game/pvp-coinflip"); return; }
    const isP1 = data.isPlayer1;
    const assignedPlayerSide: CoinSide   = isP1 ? data.result.p1Side : data.result.p2Side;
    const assignedOpponentSide: CoinSide = isP1 ? data.result.p2Side : data.result.p1Side;
    setPlayerSide(assignedPlayerSide);
    setOpponentSide(assignedOpponentSide);
    setGameState("side_assignment");
    setTimeout(() => { startGame(data, assignedPlayerSide); }, 3000);
  };`;
 const newAssign=`  const assignSides = (md?: any) => {
    const data = md ?? matchData;
    if (!data?.result) { navigate("/game/pvp-coinflip"); return; }
    const isP1 = data.isPlayer1;
    const assignedPlayerSide: CoinSide = isP1 ? data.result.p1Side : data.result.p2Side;
    const assignedOpponentSide: CoinSide = isP1 ? data.result.p2Side : data.result.p1Side;
    setPlayerSide(assignedPlayerSide);
    setOpponentSide(assignedOpponentSide);
    const startAt = Date.parse(data.animationStartAt ?? "");
    const delay = Number.isFinite(startAt) ? Math.max(0, startAt - Date.now()) : 0;
    setGameState("side_assignment");
    setTimeout(() => startGame(data, assignedPlayerSide), delay);
  };`;
 s=s.replace(oldAssign,newAssign);
 const marker=`    setGameState("flipping");

    setTimeout(() => {`;
 const replacement=`    const animationStartAt = Date.parse(md.animationStartAt ?? "");
    const animationDurationMs = Number(md.animationDurationMs ?? 2500);
    const elapsed = Number.isFinite(animationStartAt) ? Math.max(0, Date.now() - animationStartAt) : 0;
    setFlipElapsedMs(Math.min(elapsed, animationDurationMs));
    setGameState("flipping");

    const revealResult = () => {`;
 s=s.replace(marker,replacement);
 const endMarkers=[`      }, 500);
    }, 2500);
  };`,`      }, 2000);
    }, 2500);
  };`];
 const endReplacement=`      }, 500);
    };

    if (elapsed >= animationDurationMs) revealResult();
    else setTimeout(revealResult, animationDurationMs - elapsed);
  };`;
 for(const endMarker of endMarkers){ if(s.includes(endMarker)){ s=s.replace(endMarker,endReplacement); break; } }
 s=s.replace('<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />', '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} animationElapsedMs={flipElapsedMs} animationDurationMs={Number(matchData?.animationDurationMs ?? 2500)} />');
 write(p,s);
}

console.log('Applied Coin Flip server-synchronized animation and debit-aware display.');
