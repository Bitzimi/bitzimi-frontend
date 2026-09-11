import fs from 'node:fs';

const path='src/app/pages/PvPCoinFlipGame.tsx';
let s=fs.readFileSync(path,'utf8');

const between=(source,start,end,replacement)=>{
  const a=source.indexOf(start);
  const b=source.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`Coin Flip live-sync marker not found: ${start}`);
  return source.slice(0,a)+replacement+source.slice(b);
};

s=s.replace(/const \[animationElapsedMs, setAnimationElapsedMs\] = useState\(0\);\s*const \[animationDurationMs, setAnimationDurationMs\] = useState\(12000\);/,'const [animationElapsedMs, setAnimationElapsedMs] = useState(0);\n  const [animationDurationMs, setAnimationDurationMs] = useState(17000);');

const helperStart='  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);';
const helperEnd='  // Prevent double execution in React Strict Mode';
const helpers=`  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const searchInFlight = useRef(false);
  const clearTimers = () => { for (const timer of timersRef.current) clearTimeout(timer); timersRef.current = []; };
  const clearPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const loadHistory = async () => { try { const rows = await gameMatchmakingService.getCoinFlipHistory(stakeAmount); setSessionHistory(rows.map((r) => ({ id:r.matchId, opponent:r.opponent.username, opponentAvatar:r.opponent.avatar ?? null, result:r.youWon ? "win" : "loss", outcome:r.result ?? "heads", amount:r.youWon ? r.payout-r.stake : r.stake, stake:r.stake, timestamp:r.settledAt ?? r.createdAt }))); } catch {} };
  const applySettledResult = async (md:any) => { const result=md?.result?.coinFlip as CoinSide|undefined; if(!result||md?.status!=="settled")return; const won=Boolean(md.youWon); const name=md.opponent?.username??"Player"; const avatar=md.opponent?.avatar??name.charAt(0).toUpperCase(); const winnings=Number(md.payout??0); setMatchData(md); setPlatformFee(Number(md.platformFee??0)); setCoinResult(result); setIsWinner(won); setWinAmount(won?winnings:0); setWinnerAvatar(won?playerAvatar:avatar); setWinnerName(won?myUsername:name); setShowWinner(true); setGameState("showing_result"); await refreshWalletsFromBackend().catch(()=>{}); await loadHistory(); if(!transactionRecorded.current){transactionRecorded.current=true; addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?winnings:0,profit:won?winnings-stakeAmount:-stakeAmount,won,opponent:name,outcome:result}); if(won)liveActivityService.addActivity("game_win",myUsername,`won in Coin Flip`,winnings-stakeAmount);} setShowResultPopup(true); };
  const syncActiveMatch = async (id:string) => { try { const md=await gameMatchmakingService.getMatch(id); setMatchData(md); setOpponentName(md.opponent?.username??"Player"); setOpponentAvatar(md.opponent?.avatar??md.opponent?.username?.charAt(0).toUpperCase()??"P"); setPlayerSide(md.playerSide??(md.isPlayer1?md.result?.p1Side:md.result?.p2Side)??null); setOpponentSide(md.opponentSide??(md.isPlayer1?md.result?.p2Side:md.result?.p1Side)??null); setAnimationDurationMs(Number(md.animationDurationMs??17000)); setAnimationElapsedMs(Number(md.animationElapsedMs??0)); if(md.status==="settled"){clearPolling();await applySettledResult(md);return true;} if(md.phase==="flipping"){setGameState("flipping");}else{setGameState("side_assignment");} return false; } catch { return false; } };
  const waitForSettlement = (id:string) => { clearPolling(); pollRef.current=setInterval(async()=>{await syncActiveMatch(id);},250); syncActiveMatch(id); };

`;
s=between(s,helperStart,helperEnd,helpers+helperEnd);

const searchStart='  const startSearch = async () => {';
const searchEnd='  useEffect(() => {';
const startSearch=`  const startSearch = async () => {
    if (searchInFlight.current || (gameState !== "ready" && gameState !== "idle")) return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
    searchInFlight.current=true; clearPolling(); clearTimers(); transactionRecorded.current=false; setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setPlayerSide(null); setOpponentSide(null); setAnimationElapsedMs(0); setAnimationDurationMs(17000); setGameState("searching");
    try {
      if(privateMatchId){const match=await gameMatchmakingService.getMatch(privateMatchId);setMatchId(privateMatchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());await refreshWalletsFromBackend().catch(()=>{});await syncActiveMatch(privateMatchId);return;}
      const result=await gameMatchmakingService.joinQueue("pvp_coinflip",stakeAmount);
      if(result.status==="matched"&&result.matchId){const match=await gameMatchmakingService.getMatch(result.matchId);setMatchId(result.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());await refreshWalletsFromBackend().catch(()=>{});await syncActiveMatch(result.matchId);return;}
      if(result.queueId){setQueueId(result.queueId);pollRef.current=setInterval(async()=>{try{const status=await gameMatchmakingService.pollQueue(result.queueId!);if(status.status==="matched"&&status.matchId){clearPolling();setMatchId(status.matchId);const match=await gameMatchmakingService.getMatch(status.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());await refreshWalletsFromBackend().catch(()=>{});await syncActiveMatch(status.matchId);}else if(status.status==="cancelled"){clearPolling();searchInFlight.current=false;setGameState("ready");}}catch{}},250);}
    } catch { searchInFlight.current=false; setGameState("ready"); toast.error("Unable to start matchmaking"); }
  };

`;
s=between(s,searchStart,searchEnd,startSearch);

const recoveryStart='  useEffect(() => {';
const recoveryEnd='  const assignSides = (md?:any) => {';
const recovery=`  useEffect(() => {
    let cancelled=false;
    let historyTimer:ReturnType<typeof setInterval>|null=null;
    let walletTimer:ReturnType<typeof setInterval>|null=null;
    const recover=async()=>{if(privateMatchId){searchInFlight.current=true;setGameState("searching");await startSearch();return;}try{const recovery=await gameMatchmakingService.recoverCoinFlipQueue(stakeAmount);if(cancelled)return;if(recovery.status==="matched"&&recovery.matchId){searchInFlight.current=true;setMatchId(recovery.matchId);const match=await gameMatchmakingService.getMatch(recovery.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());await refreshWalletsFromBackend().catch(()=>{});await syncActiveMatch(recovery.matchId);}else if(recovery.status==="waiting"&&recovery.queueId){searchInFlight.current=true;setQueueId(recovery.queueId);setGameState("searching");pollRef.current=setInterval(async()=>{try{const status=await gameMatchmakingService.pollQueue(recovery.queueId!);if(status.status==="matched"&&status.matchId){clearPolling();setMatchId(status.matchId);const match=await gameMatchmakingService.getMatch(status.matchId);setMatchData(match);setOpponentName(match.opponent.username);setOpponentAvatar(match.opponent.avatar??match.opponent.username.charAt(0).toUpperCase());await refreshWalletsFromBackend().catch(()=>{});await syncActiveMatch(status.matchId);}}catch{}},250);}}catch{} };
    recover(); loadHistory(); historyTimer=setInterval(loadHistory,2000); walletTimer=setInterval(()=>{refreshWalletsFromBackend().catch(()=>{});},2000);
    return()=>{cancelled=true;clearPolling();clearTimers();if(historyTimer)clearInterval(historyTimer);if(walletTimer)clearInterval(walletTimer);};
  }, [privateMatchId, stakeAmount]);

`;
s=between(s,recoveryStart,recoveryEnd,recovery+recoveryEnd);

const assignStart='  const assignSides = (md?:any) => {';
const assignEnd='  useEffect(() => {';
const assign=`  const assignSides = (md?:any) => { const data=md??matchData;if(!data)return;setPlayerSide(data.playerSide??(data.isPlayer1?data.result?.p1Side:data.result?.p2Side)??null);setOpponentSide(data.opponentSide??(data.isPlayer1?data.result?.p2Side:data.result?.p1Side)??null);setAnimationDurationMs(Number(data.animationDurationMs??17000));setAnimationElapsedMs(Number(data.animationElapsedMs??0));if(data.status==="settled"){applySettledResult(data);return;}if(data.phase==="flipping"){startGame(data,null);}else{setGameState("side_assignment");}};\n\n`;
s=between(s,assignStart,assignEnd,assign+assignEnd);

const gameStart='  const startGame = (md:any,_assignedPlayerSide:CoinSide) => {';
const gameEnd='  const addToSessionHistory =';
const game=`  const startGame = (md:any,_assignedPlayerSide:CoinSide|null) => { if(!md?.matchId)return;setAnimationDurationMs(Number(md.animationDurationMs??17000));setAnimationElapsedMs(Number(md.animationElapsedMs??0));setCoinResult(null);setGameState("flipping");waitForSettlement(md.matchId); };\n\n`;
s=between(s,gameStart,gameEnd,game);

const homeAliases=`  const homeName = matchData?.isHome ? myUsername : opponentName;\n  const awayName = matchData?.isHome ? opponentName : myUsername;\n  const homeAvatar = matchData?.isHome ? playerAvatar : opponentAvatar;\n  const awayAvatar = matchData?.isHome ? opponentAvatar : playerAvatar;\n  const homeSide = matchData?.isHome ? playerSide : opponentSide;\n  const awaySide = matchData?.isHome ? opponentSide : playerSide;\n`;
s=s.replace('  return (',homeAliases+'  return (');

const uiStart=s.indexOf('              <div className="text-lg text-green-400 font-semibold">Opponent Found!</div>');
const uiEndMarker='                <div className="text-sm text-gray-400 mt-4 animate-pulse">Preparing to flip...</div>';
const uiEnd=s.indexOf(uiEndMarker,uiStart);
if(uiStart>=0&&uiEnd>=0){
  let block=s.slice(uiStart,uiEnd+uiEndMarker.length);
  block=block.replaceAll('myUsername','homeName').replaceAll('identity.avatar','homeAvatar').replaceAll('playerSide','homeSide').replaceAll('opponentName','awayName').replaceAll('opponentAvatar','awayAvatar').replaceAll('opponentSide','awaySide');
  s=s.slice(0,uiStart)+block+s.slice(uiEnd+uiEndMarker.length);
}

s=s.replace(/const totalPot=Number\(matchData\?\.totalPool\?\?stakeAmount\); const winnerGets=Number\(matchData\?\.payout\?\?\(feeRate>0\?totalPot\*\(1-feeRate\):0\)\);/,'const totalPot=Number(matchData?.totalPool??stakeAmount); const winnerGets=Number(matchData?.winnerPayout??(feeRate>0?totalPot*(1-feeRate):0));');

const modalMarker='          <DialogHeader>\n            <DialogTitle className="text-center">\n              <div className="text-5xl mb-3">';
const modalInsert='          <DialogHeader>\n            <DialogTitle className="text-center">\n              <div className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">{myUsername} — {playerSide?.toUpperCase() ?? ""} &nbsp; vs &nbsp; {opponentName} — {opponentSide?.toUpperCase() ?? ""}</div>\n              <div className="text-5xl mb-3">';
if(!s.includes('myUsername} — {playerSide?.toUpperCase()')){
  if(!s.includes(modalMarker))throw new Error('Coin Flip result modal marker not found');
  s=s.replace(modalMarker,modalInsert);
}

fs.writeFileSync(path,s);
console.log('Coin Flip live synchronization and 12s/5s phase repair applied');
