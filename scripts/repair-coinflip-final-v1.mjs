import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const between=(a,start,end,repl)=>{const i=a.indexOf(start),j=a.indexOf(end,i+start.length);if(i<0||j<0)throw new Error("Coin Flip final marker missing: "+start);return a.slice(0,i)+repl+a.slice(j)};
const start=s.indexOf("  const startSearch = async () =>");
const assign=s.indexOf("  const assignSides =",start);
if(start>=0&&assign>start){const block=`  const startSearch = async (force=false) => {
    if(searchInFlight.current||(!force&&!['ready','idle'].includes(gameState)))return;
    if(balances.game<stakeAmount){toast.error("Insufficient balance in Game Wallet");return;}
    searchInFlight.current=true;clearPolling();clearTimers();transactionRecorded.current=false;settledMatchHandled.current=null;setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);setAnimationDurationMs(17000);setGameState("searching");
    try{if(privateMatchId){await gameMatchmakingService.getMatch(privateMatchId);setMatchId(privateMatchId);await syncActiveMatch(privateMatchId);return}const r=await gameMatchmakingService.joinQueue("pvp_coinflip",stakeAmount);if(r.status==="matched"&&r.matchId){setMatchId(r.matchId);await syncActiveMatch(r.matchId);return}if(r.queueId){setQueueId(r.queueId);pollRef.current=setInterval(async()=>{try{const q=await gameMatchmakingService.pollQueue(r.queueId!);if(q.status==="matched"&&q.matchId){clearPolling();setMatchId(q.matchId);await syncActiveMatch(q.matchId)}else if(q.status==="cancelled"){clearPolling();searchInFlight.current=false;setGameState("ready")}}catch{}},250)}}catch{searchInFlight.current=false;setGameState("ready");toast.error("Unable to start matchmaking")}
  };

  const assignSides = (md?:any) => { if(md?.matchId){setMatchData(md);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);syncActiveMatch(md.matchId)} };

`;
s=s.slice(0,start)+block+s.slice(assign+s.slice(assign).indexOf("  useEffect(() => {"));}
const sync=s.indexOf("  const syncActiveMatch = async (id:string) => {");
const wait=s.indexOf("  const waitForSettlement =",sync);
const search2=s.indexOf("  const startSearch =",wait);
if(sync>=0&&wait>sync&&search2>wait){const helpers=`  const syncActiveMatch = async (id:string) => {
    try{const md=await gameMatchmakingService.getMatch(id);setMatchData(md);setOpponentName(md.opponent?.username??"Player");setOpponentAvatar(md.opponent?.avatar??md.opponent?.username?.charAt(0).toUpperCase()??"P");setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);setAnimationDurationMs(Number(md.animationDurationMs??17000));setAnimationElapsedMs(Number(md.animationElapsedMs??0));if(md.status==="settled"){await applySettledResult(md);return true}setGameState(md.phase==="flipping"?"flipping":"side_assignment");return false}catch{return false}
  };
  const waitForSettlement=(id:string)=>{clearPolling();pollRef.current=setInterval(()=>{syncActiveMatch(id)},250);syncActiveMatch(id)};

`;s=s.slice(0,sync)+helpers+s.slice(search2)}
if(!s.includes("const settledMatchHandled = useRef"))s=s.replace("  const transactionRecorded = useRef(false);","  const transactionRecorded = useRef(false);\n  const settledMatchHandled = useRef<string|null>(null);");
const app=s.indexOf("  const applySettledResult = async (md:any) => {");
const sync2=s.indexOf("  const syncActiveMatch =",app);
if(app>=0&&sync2>app){const fn=`  const applySettledResult = async (md:any) => {
    if(!md?.matchId||md.status!=="settled"||!md.result?.coinFlip)return;
    if(settledMatchHandled.current===md.matchId)return;
    settledMatchHandled.current=md.matchId;clearPolling();
    const won=Boolean(md.youWon),result=md.result.coinFlip as CoinSide,name=md.opponent?.username??"Player",avatar=md.opponent?.avatar??name.charAt(0).toUpperCase(),payout=Number(md.payout??0);
    setMatchData(md);setOpponentName(name);setOpponentAvatar(avatar);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);setPlatformFee(Number(md.platformFee??0));setCoinResult(result);setIsWinner(won);setWinAmount(won?payout:0);setWinnerAvatar(won?playerAvatar:avatar);setWinnerName(won?myUsername:name);setGameState("showing_result");setShowWinner(true);
    await refreshWalletsFromBackend().catch(()=>{});await loadHistory().catch(()=>{});
    if(!transactionRecorded.current){transactionRecorded.current=true;addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?payout:0,profit:won?payout-stakeAmount:-stakeAmount,won,opponent:name,outcome:result});if(won)liveActivityService.addActivity("game_win",myUsername,"won in Coin Flip",payout-stakeAmount)}
    setShowResultPopup(true);
  };

`;s=s.slice(0,app)+fn+s.slice(sync2)}
if(!s.includes("const homeName = matchData ?")){s=s.replace("  return (",`  const homeName = matchData ? (matchData.isHome ? myUsername : opponentName) : myUsername;
  const awayName = matchData ? (matchData.isHome ? opponentName : myUsername) : opponentName;
  const homeAvatar = matchData ? (matchData.isHome ? playerAvatar : opponentAvatar) : playerAvatar;
  const awayAvatar = matchData ? (matchData.isHome ? opponentAvatar : playerAvatar) : opponentAvatar;
`+"  return (")}
const ps=s.indexOf("          {/* Players */}"),pe=s.indexOf("          {/* Game Area */}",ps);if(ps>=0&&pe>ps){let b=s.slice(ps,pe);b=b.replaceAll("{myUsername}","{homeName}").replaceAll("{opponentName}","{awayName}").replaceAll("avatar={playerAvatar}","avatar={homeAvatar}").replaceAll("avatar={opponentAvatar}","avatar={awayAvatar}");s=s.slice(0,ps)+b+s.slice(pe)}
s=s.replace(/const totalPot\s*=\s*Number\(matchData\?\.totalPool\s*\?\?\s*stakeAmount\);/g,"const totalPot = Number(matchData?.totalPool ?? 0);");s=s.replace(/const totalPot=Number\(matchData\?\.totalPool\?\?stakeAmount\);/g,"const totalPot=Number(matchData?.totalPool??0);");s=s.replace(/const winnerGets\s*=\s*Number\(matchData\?\.payout\s*\?\?\s*\(feeRate[^;]+;/g,"const winnerGets = Number(matchData?.winnerPayout ?? matchData?.payout ?? 0);");s=s.replace(/const winnerGets=Number\(matchData\?\.payout[^;]+;/g,"const winnerGets=Number(matchData?.winnerPayout??matchData?.payout??0);");
if(!s.includes("const closeFinishedMatch ="))s=s.replace("  const handleExit = () => {",`  const closeFinishedMatch = () => {clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);searchInFlight.current=false;settledMatchHandled.current=null;transactionRecorded.current=false;setGameState("ready");};
  const handleNewSearch = () => { closeFinishedMatch(); setTimeout(()=>startSearch(true),0); };

  const handleExit = () => {`)}
else if(!s.includes("const handleNewSearch ="))s=s.replace("  const handleExit = () => {","  const handleNewSearch = () => { closeFinishedMatch(); setTimeout(()=>startSearch(true),0); };\n\n  const handleExit = () => {");
const ms=s.indexOf("      {/* Result Popup */}"),mf=s.indexOf("      <FairnessModal",ms);if(ms>=0&&mf>ms){const modal=`      {/* Result Popup */}
      <Dialog open={showResultPopup} onOpenChange={(open)=>{if(!open)closeFinishedMatch();else setShowResultPopup(true)}}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-300 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-center"><div className={isWinner ? "text-2xl font-bold text-green-500" : "text-2xl font-bold text-red-500"}>{myUsername} {isWinner ? "Wins!" : "Lost!"}</div></DialogTitle>
            <DialogDescription className="text-center text-gray-700 dark:text-gray-300">{isWinner ? "Congratulations " + myUsername + "!" : "Better luck next time!"}</DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div><div className="text-sm text-gray-500 dark:text-gray-400">Amount</div><div className={isWinner ? "text-3xl font-bold text-green-600 dark:text-green-400" : "text-3xl font-bold text-red-600 dark:text-red-400"}>{isWinner ? "+" : "-"}{formatCurrencyNoDecimals(isWinner ? winAmount-stakeAmount : stakeAmount)}</div></div>
            <div><div className="text-sm text-gray-500 dark:text-gray-400">Winnings: {formatCurrencyNoDecimals(isWinner ? winAmount : 0)} (after {Math.round(totalPot>0 ? (platformFee/totalPot)*100 : 10)}% fee)</div></div>
            <div className="pt-2 flex flex-col items-center gap-2"><div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{coinResult?.toUpperCase() ?? ""}</div></div>
            <div className="flex flex-col gap-2"><Button onClick={handleNewSearch} className="w-full">Search for New Opponent</Button><Button variant="outline" onClick={closeFinishedMatch} className="w-full">Back to Stake Room</Button></div>
          </div>
        </DialogContent>
      </Dialog>

`;s=s.slice(0,ms)+modal+s.slice(mf)}
if(!s.includes("Coin Flip result modal auto-close")){s=s.replace("  return (",`  // Coin Flip result modal auto-close
  useEffect(()=>{if(!showResultPopup)return;const t=window.setTimeout(()=>closeFinishedMatch(),5000);return()=>window.clearTimeout(t)},[showResultPopup]);

  return (`)}
fs.writeFileSync(path,s);console.log("Coin Flip final lifecycle, Home/Away sync, 12s/5s timing, result modal and matchmaking repair applied");
