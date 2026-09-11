import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const between=(a,start,end,repl)=>{const i=a.indexOf(start),j=a.indexOf(end,i+start.length);if(i<0||j<0)throw new Error("Coin Flip marker missing: "+start);return a.slice(0,i)+repl+a.slice(j)};
// Search button is allowed to be invoked from the result modal through an explicit one-shot ref.
if(!s.includes("const forceSearchRef"))s=s.replace("const searchInFlight = useRef(false);","const searchInFlight = useRef(false);\n  const forceSearchRef = useRef(false);\n  const settledMatchHandled = useRef<string|null>(null);");
s=s.replace('if (searchInFlight.current || (gameState !== "ready" && gameState !== "idle")) return;','if (searchInFlight.current || (!forceSearchRef.current && gameState !== "ready" && gameState !== "idle")) return;');
s=s.replace('searchInFlight.current=true; clearPolling(); clearTimers();','searchInFlight.current=true; forceSearchRef.current=false; clearPolling(); clearTimers();');
// Replace frontend-only side/game timers. Backend phase drives 12s side assignment then 5s flipping.
const as=s.indexOf("  const assignSides =");const ae=s.indexOf("  useEffect(() => {",as);if(as>=0&&ae>as)s=s.slice(0,as)+`  const assignSides = (md?:any) => { if(md?.matchId){setMatchData(md);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);syncActiveMatch(md.matchId)} };

`+s.slice(ae);
const gs=s.indexOf("  const startGame = (md:any,_assignedPlayerSide");const ge=s.indexOf("  const addToSessionHistory =",gs);if(gs>=0&&ge>gs)s=s.slice(0,gs)+`  const startGame = (md:any,_assignedPlayerSide:CoinSide|null) => { if(md?.matchId){setGameState("flipping");waitForSettlement(md.matchId)} };

`+s.slice(ge);
// Dynamic Home/Away values: before match the current user remains in the original Home position; once assigned, the backend decides.
if(!s.includes("const homeName = matchData ?"))s=s.replace("  return (",`  const homeName = matchData ? (matchData.isHome ? myUsername : opponentName) : myUsername;
  const awayName = matchData ? (matchData.isHome ? opponentName : myUsername) : opponentName;
  const homeAvatar = matchData ? (matchData.isHome ? playerAvatar : opponentAvatar) : playerAvatar;
  const awayAvatar = matchData ? (matchData.isHome ? opponentAvatar : playerAvatar) : opponentAvatar;

  return (`);
const ps=s.indexOf("          {/* Players */}"),pe=s.indexOf("          {/* Game Area */}",ps);if(ps>=0&&pe>ps){let b=s.slice(ps,pe);b=b.replaceAll("{myUsername}","{homeName}").replaceAll("{opponentName}","{awayName}").replaceAll("avatar={playerAvatar}","avatar={homeAvatar}").replaceAll("avatar={opponentAvatar}","avatar={awayAvatar}");s=s.slice(0,ps)+b+s.slice(pe)}
// Pool remains $0 before an actual match; once matched the backend supplies the full pool and possible winner payout.
s=s.replace(/const totalPot\s*=\s*Number\(matchData\?\.totalPool\s*\?\?\s*stakeAmount\);/g,"const totalPot = Number(matchData?.totalPool ?? 0);");
s=s.replace(/const totalPot=Number\(matchData\?\.totalPool\?\?stakeAmount\);/g,"const totalPot=Number(matchData?.totalPool??0);");
s=s.replace(/const winnerGets\s*=\s*Number\(matchData\?\.payout\s*\?\?\s*\(feeRate[^;]+;/g,"const winnerGets = Number(matchData?.winnerPayout ?? matchData?.payout ?? 0);");
s=s.replace(/const winnerGets=Number\(matchData\?\.payout[^;]+;/g,"const winnerGets=Number(matchData?.winnerPayout??matchData?.payout??0);");
// Use decimal formatter in the result modal so a $0.80 profit is not rounded to $1.
s=s.replace('const { formatCurrencyNoDecimals } = useSettings();','const { formatCurrency, formatCurrencyNoDecimals } = useSettings();');
// Idempotent result handling: one settled match can open the modal only once.
const app=s.indexOf("  const applySettledResult = async (md:any) => {");const sy=s.indexOf("  const syncActiveMatch =",app);if(app>=0&&sy>app)s=s.slice(0,app)+`  const applySettledResult = async (md:any) => { if(!md?.matchId||md.status!=="settled"||!md.result?.coinFlip||settledMatchHandled.current===md.matchId)return;settledMatchHandled.current=md.matchId;clearPolling();const won=Boolean(md.youWon),result=md.result.coinFlip as CoinSide,name=md.opponent?.username??"Player",avatar=md.opponent?.avatar??name.charAt(0).toUpperCase(),payout=Number(md.payout??0);setMatchData(md);setOpponentName(name);setOpponentAvatar(avatar);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);setPlatformFee(Number(md.platformFee??0));setCoinResult(result);setIsWinner(won);setWinAmount(won?payout:0);setWinnerAvatar(won?playerAvatar:avatar);setWinnerName(won?myUsername:name);setGameState("showing_result");setShowWinner(true);await refreshWalletsFromBackend().catch(()=>{});await loadHistory().catch(()=>{});if(!transactionRecorded.current){transactionRecorded.current=true;addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?payout:0,profit:won?payout-stakeAmount:-stakeAmount,won,opponent:name,outcome:result});if(won)liveActivityService.addActivity("game_win",myUsername,"won in Coin Flip",payout-stakeAmount)}setShowResultPopup(true);};
  `+s.slice(sy);
// Remove any prior modal side summary and replace the permitted result-modal UI only.
const ms=s.indexOf("      {/* Result Popup */}"),mf=s.indexOf("      <FairnessModal",ms);if(ms>=0&&mf>ms){const modal=`      {/* Result Popup */}
      <Dialog open={showResultPopup} onOpenChange={(open)=>{if(!open)closeFinishedMatch();else setShowResultPopup(true)}}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-300 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-center"><div className={isWinner ? "text-2xl font-bold text-green-500" : "text-2xl font-bold text-red-500"}>{myUsername} {isWinner ? "Wins!" : "Lost!"}</div></DialogTitle>
            <DialogDescription className="text-center text-gray-700 dark:text-gray-300">{isWinner ? "Congratulations " + myUsername + "!" : "Better luck next time!"}</DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div><div className="text-sm text-gray-500 dark:text-gray-400">Amount</div><div className={isWinner ? "text-3xl font-bold text-green-600 dark:text-green-400" : "text-3xl font-bold text-red-600 dark:text-red-400"}>{isWinner ? "+" : "-"}{formatCurrency(isWinner ? winAmount-stakeAmount : stakeAmount)}</div></div>
            <div><div className="text-sm text-gray-500 dark:text-gray-400">Winnings: {formatCurrency(isWinner ? winAmount : 0)} (after {Math.round(totalPot>0 ? (platformFee/totalPot)*100 : 10)}% fee)</div></div>
            <div className="pt-2 flex flex-col items-center gap-2"><div className="text-sm font-semibold text-gray-500 dark:text-gray-400">{coinResult?.toUpperCase() ?? ""}</div></div>
            <div className="flex flex-col gap-2"><Button onClick={handleNewSearch} className="w-full">Search for New Opponent</Button><Button variant="outline" onClick={closeFinishedMatch} className="w-full">Back to Stake Room</Button></div>
          </div>
        </DialogContent>
      </Dialog>

`;s=s.slice(0,ms)+modal+s.slice(mf)}
// Finished match cleanup. Reload cannot resurrect it because backend recovery only returns active matches.
if(!s.includes("const closeFinishedMatch =")){s=s.replace("  const handleExit = () => {",`  const closeFinishedMatch = () => {clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);searchInFlight.current=false;forceSearchRef.current=false;settledMatchHandled.current=null;transactionRecorded.current=false;setGameState("ready");};
  const handleNewSearch = () => {forceSearchRef.current=true;closeFinishedMatch();forceSearchRef.current=true;startSearch();};

  const handleExit = () => {`)}
else if(!s.includes("const handleNewSearch ="))s=s.replace("  const handleExit = () => {","  const handleNewSearch = () => {forceSearchRef.current=true;closeFinishedMatch();forceSearchRef.current=true;startSearch();};\n\n  const handleExit = () => {");
// Five-second natural modal close. It does not start a new match automatically.
if(!s.includes("Coin Flip result modal auto-close"))s=s.replace("  return (","  // Coin Flip result modal auto-close\n  useEffect(()=>{if(!showResultPopup)return;const t=window.setTimeout(()=>closeFinishedMatch(),5000);return()=>window.clearTimeout(t)},[showResultPopup]);\n\n  return (");
// Existing build pass may have wired the old reset handler; force it through the same matchmaking function.
s=s.replace(/onClick=\{\(\) => \{ setShowResultPopup\(false\); setShowWinner\(false\); setCoinResult\(null\); setMatchId\(null\); setMatchData\(null\); setGameState\("ready"\); \}\}/g,"onClick={handleNewSearch}");
fs.writeFileSync(path,s);
console.log("Coin Flip final v3 lifecycle and synchronization repair applied");
