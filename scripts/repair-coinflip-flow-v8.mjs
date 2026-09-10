import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const between = (source, start, end, replacement) => {
  const a = source.indexOf(start); const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Coin Flip repair marker not found: ${start}`);
  return source.slice(0, a) + replacement + source.slice(b);
};

s = s.replace('const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);', 'const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);\n  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);\n  const [animationDurationMs, setAnimationDurationMs] = useState(8000);');
s = s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode/m, '\n  // Prevent double execution in React Strict Mode');
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m, "");
s = s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\]\);/m, "");

const helpers = `  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const searchInFlight = useRef(false);
  const clearTimers = () => { for (const timer of timersRef.current) clearTimeout(timer); timersRef.current = []; };
  const clearPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const loadHistory = async () => { try { const rows = await gameMatchmakingService.getCoinFlipHistory(stakeAmount); setSessionHistory(rows.map((r) => ({ id:r.matchId, opponent:r.opponent.username, opponentAvatar:r.opponent.avatar ?? null, result:r.youWon ? "win" : "loss", outcome:r.result ?? "heads", amount:r.youWon ? r.payout-r.stake : r.stake, stake:r.stake, timestamp:r.settledAt ?? r.createdAt }))); } catch {} };
  const applySettledResult = async (md:any) => { const result=md?.result?.coinFlip as CoinSide|undefined; if(!result||md?.status!=="settled")return; const won=Boolean(md.youWon); const name=md.opponent?.username??"Player"; const avatar=md.opponent?.avatar??name.charAt(0).toUpperCase(); const winnings=Number(md.payout??0); setPlatformFee(Number(md.platformFee??0)); setCoinResult(result); setIsWinner(won); setWinAmount(won?winnings:0); setWinnerAvatar(won?playerAvatar:avatar); setWinnerName(won?myUsername:name); setShowWinner(true); setGameState("showing_result"); if(!transactionRecorded.current){transactionRecorded.current=true; await refreshWalletsFromBackend().catch(()=>{}); await loadHistory(); addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?winnings:0,profit:won?winnings-stakeAmount:-stakeAmount,won,opponent:name,outcome:result});} setShowResultPopup(true); };
  const waitForSettlement = (id:string, initialMatch:any) => { clearPolling(); const startedAt=Date.parse(initialMatch?.createdAt??""); const duration=Number(initialMatch?.animationDurationMs??8000); const tick=async()=>{try{const md=await gameMatchmakingService.getMatch(id); setMatchData(md); const serverNow=Date.parse(md.serverNow??""); const now=Number.isFinite(serverNow)?serverNow:Date.now(); const elapsed=Number.isFinite(startedAt)?Math.max(0,now-startedAt):0; setAnimationElapsedMs(Math.min(duration,elapsed)); if(md.status==="settled"&&md.result?.coinFlip&&elapsed>=duration){clearPolling(); await applySettledResult(md);}}catch{}}; tick(); pollRef.current=setInterval(tick,500); };

`;
s = s.replace('  // Prevent double execution in React Strict Mode', helpers + '  // Prevent double execution in React Strict Mode');

const startSearch = `  const startSearch = async () => {
    if (searchInFlight.current || gameState !== "ready") return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
    searchInFlight.current=true; clearPolling(); clearTimers(); transactionRecorded.current=false; setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setAnimationElapsedMs(0); setGameState("searching");
    try { if(privateMatchId){const match=await gameMatchmakingService.getMatch(privateMatchId); setMatchId(privateMatchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase()); assignSides(match); return;} const result=await gameMatchmakingService.joinQueue("pvp_coinflip",stakeAmount); if(result.status==="matched"&&result.matchId){const match=await gameMatchmakingService.getMatch(result.matchId); setMatchId(result.matchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase()); assignSides(match); return;} if(result.queueId){setQueueId(result.queueId); pollRef.current=setInterval(async()=>{try{const status=await gameMatchmakingService.pollQueue(result.queueId!); if(status.status==="matched"&&status.matchId){clearPolling(); const match=await gameMatchmakingService.getMatch(status.matchId); setMatchId(status.matchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase()); assignSides(match);}else if(status.status==="cancelled"){clearPolling();searchInFlight.current=false;setGameState("ready");}}catch{}},500);}} catch {searchInFlight.current=false;setGameState("ready");toast.error("Unable to start matchmaking");}
  };

`;
s = between(s, '  const startSearch = async () => {', '  useEffect(() => {\n    if (privateMatchId) startSearch();', startSearch);

const recoveryEffect = `  useEffect(() => {
    let cancelled=false;
    if(privateMatchId){startSearch();return()=>{cancelled=true;clearPolling();clearTimers();};}
    gameMatchmakingService.recoverCoinFlipQueue(stakeAmount).then(async(recovery)=>{if(cancelled)return;if(recovery.status==="matched"&&recovery.matchId){searchInFlight.current=true;const match=await gameMatchmakingService.getMatch(recovery.matchId);setMatchId(recovery.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());assignSides(match);}else if(recovery.status==="waiting"&&recovery.queueId){searchInFlight.current=true;setQueueId(recovery.queueId);setGameState("searching");pollRef.current=setInterval(async()=>{try{const status=await gameMatchmakingService.pollQueue(recovery.queueId!);if(status.status==="matched"&&status.matchId){clearPolling();const match=await gameMatchmakingService.getMatch(status.matchId);setMatchId(status.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());assignSides(match);}}catch{}},500);}}).catch(()=>{}); loadHistory(); return()=>{cancelled=true;clearPolling();clearTimers();};
  }, [privateMatchId, stakeAmount]);

`;
s = between(s, '  useEffect(() => {\n    if (privateMatchId) startSearch();', '  const assignSides = (md?: any) => {', recoveryEffect);

const assignSides = `  const assignSides = (md?:any) => { const data=md??matchData;if(!data?.result)return;const startedAt=Date.parse(data.createdAt??"");const serverNow=Date.parse(data.serverNow??"");const now=Number.isFinite(serverNow)?serverNow:Date.now();const elapsed=Number.isFinite(startedAt)?Math.max(0,now-startedAt):0;const assignedPlayerSide:CoinSide=data.isPlayer1?data.result.p1Side:data.result.p2Side;const assignedOpponentSide:CoinSide=data.isPlayer1?data.result.p2Side:data.result.p1Side;setPlayerSide(assignedPlayerSide);setOpponentSide(assignedOpponentSide);setAnimationDurationMs(Number(data.animationDurationMs??8000));if(data.status==="settled"&&elapsed>=Number(data.animationDurationMs??8000)){applySettledResult(data);return;}if(elapsed>=3000){startGame(data,assignedPlayerSide);return;}setGameState("side_assignment");timersRef.current.push(setTimeout(()=>startGame(data,assignedPlayerSide),3000-elapsed)); };

`;
s = between(s, '  const assignSides = (md?: any) => {', '  useEffect(() => {\n    if (!matchId) return;', assignSides);

const startGame = `  const startGame = (md:any,_assignedPlayerSide:CoinSide) => { if(!md?.result)return;clearTimers();const startedAt=Date.parse(md.createdAt??"");const serverNow=Date.parse(md.serverNow??"");const now=Number.isFinite(serverNow)?serverNow:Date.now();const duration=Number(md.animationDurationMs??8000);const elapsed=Number.isFinite(startedAt)?Math.max(0,now-startedAt):0;setAnimationDurationMs(duration);setAnimationElapsedMs(Math.min(duration,elapsed));setCoinResult(md.result.coinFlip as CoinSide);setGameState("flipping");if(md.status==="settled"&&elapsed>=duration){applySettledResult(md);return;}waitForSettlement(md.matchId,md); };

`;
s = between(s, '  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {', '  const addToSessionHistory =', startGame);

s = s.replace('onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}','onClick={handleNewSearch}');

const historyHandler = `  const addToSessionHistory = (_record: Omit<SessionRecord, "id" | "timestamp">) => { loadHistory(); };
  const handleNewSearch = async () => { clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);searchInFlight.current=false;transactionRecorded.current=false;setGameState("ready");await startSearch(); };
  const handleExit = () => { clearPolling();clearTimers();searchInFlight.current=false;if(roomCode) navigate("/game/pvp-coinflip/private?roomCode="+roomCode+"&stake="+stakeAmount);else navigate("/game/pvp-coinflip"); };
  const totalPot=Number(matchData?.totalPool??stakeAmount); const winnerGets=Number(matchData?.payout??(feeRate>0?totalPot*(1-feeRate):0)); const feePercent=feeRate*100;

`;
s = between(s, '  const addToSessionHistory =', '  return (', historyHandler);

fs.writeFileSync(path,s);
console.log("Applied targeted Coin Flip backend-authoritative flow repair without changing JSX markup.");
