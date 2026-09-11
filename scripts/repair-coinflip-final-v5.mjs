import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const between=(a,start,end,repl)=>{const i=a.indexOf(start),j=a.indexOf(end,i+start.length);if(i<0||j<0)throw new Error("Coin Flip marker missing: "+start);return a.slice(0,i)+repl+a.slice(j)};
// Backend phase polling replaces frontend-only timers.
let a=s.indexOf("  const assignSides ="),b=s.indexOf("  useEffect(() => {",a);if(a>=0&&b>a)s=s.slice(0,a)+`  const assignSides = (md?:any) => {if(md?.matchId){setMatchData(md);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);syncActiveMatch(md.matchId)}};\n\n`+s.slice(b);
a=s.indexOf("  const startGame = (md:any,_assignedPlayerSide");b=s.indexOf("  const addToSessionHistory =",a);if(a>=0&&b>a)s=s.slice(0,a)+`  const startGame = (md:any,_assignedPlayerSide:CoinSide|null) => {if(md?.matchId){setGameState("flipping");waitForSettlement(md.matchId)}};\n\n`+s.slice(b);
// Idempotent settlement/result presentation.
if(!s.includes("const settledMatchHandled = useRef"))s=s.replace("const searchInFlight = useRef(false);","const searchInFlight = useRef(false);\n  const settledMatchHandled = useRef<string|null>(null);");
a=s.indexOf("  const applySettledResult = async (md:any) => {");b=s.indexOf("  const syncActiveMatch =",a);if(a>=0&&b>a)s=s.slice(0,a)+`  const applySettledResult = async (md:any) => {if(!md?.matchId||md.status!=="settled"||!md.result?.coinFlip||settledMatchHandled.current===md.matchId)return;settledMatchHandled.current=md.matchId;clearPolling();const won=Boolean(md.youWon),result=md.result.coinFlip as CoinSide,name=md.opponent?.username??"Player",avatar=md.opponent?.avatar??name.charAt(0).toUpperCase(),payout=Number(md.payout??0);setMatchData(md);setOpponentName(name);setOpponentAvatar(avatar);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);setPlatformFee(Number(md.platformFee??0));setCoinResult(result);setIsWinner(won);setWinAmount(won?payout:0);setWinnerAvatar(won?playerAvatar:avatar);setWinnerName(won?myUsername:name);setGameState("showing_result");setShowWinner(true);await refreshWalletsFromBackend().catch(()=>{});await loadHistory().catch(()=>{});if(!transactionRecorded.current){transactionRecorded.current=true;addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?payout:0,profit:won?payout-stakeAmount:-stakeAmount,won,opponent:name,outcome:result});if(won)liveActivityService.addActivity("game_win",myUsername,"won in Coin Flip",payout-stakeAmount)}setShowResultPopup(true)};\n  `+s.slice(b);
// Force Search for New Opponent through the same startSearch() path.
if(!s.includes("const forceSearchRef"))s=s.replace("const searchInFlight = useRef(false);","const searchInFlight = useRef(false);\n  const forceSearchRef = useRef(false);");
s=s.replace('if (searchInFlight.current || (gameState !== "ready" && gameState !== "idle")) return;','if (searchInFlight.current || (!forceSearchRef.current && gameState !== "ready" && gameState !== "idle")) return;');
s=s.replace('searchInFlight.current=true; clearPolling(); clearTimers();','searchInFlight.current=true; forceSearchRef.current=false; clearPolling(); clearTimers();');
// Existing live-sync v1 handler is replaced; otherwise add one alongside the exit handler.
const oldHandler=/const handleNewSearch = async \(\) => \{[^}]*await startSearch\(\); \};/;
if(oldHandler.test(s))s=s.replace(oldHandler,'const handleNewSearch = () => {forceSearchRef.current=true;clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);settledMatchHandled.current=null;transactionRecorded.current=false;startSearch();};');
if(!s.includes("const handleNewSearch ="))s=s.replace("  const handleExit = () => {","  const handleNewSearch = () => {forceSearchRef.current=true;startSearch();};\n\n  const handleExit = () => {");
// Keep original player-summary styling; only make its data follow Home/Away.
if(!s.includes("const homeName ="))s=s.replace("  return (","  const homeName = matchData?.isHome ? myUsername : opponentName;\n  const awayName = matchData?.isHome ? opponentName : myUsername;\n  const homeAvatar = matchData?.isHome ? playerAvatar : opponentAvatar;\n  const awayAvatar = matchData?.isHome ? opponentAvatar : playerAvatar;\n\n  return (");
a=s.indexOf("          {/* Players */}"),b=s.indexOf("          {/* Game Area */}",a);if(a>=0&&b>a){let block=s.slice(a,b);block=block.replaceAll("{myUsername}","{homeName}").replaceAll("{opponentName}","{awayName}").replaceAll("avatar={playerAvatar}","avatar={homeAvatar}").replaceAll("avatar={opponentAvatar}","avatar={awayAvatar}");s=s.slice(0,a)+block+s.slice(b)}
// Pool/winner cards remain zero before match and become backend values after match.
s=s.replace(/const totalPot\s*=\s*Number\(matchData\?\.totalPool\s*\?\?\s*stakeAmount\);/g,"const totalPot = Number(matchData?.totalPool ?? 0);");s=s.replace(/const totalPot=Number\(matchData\?\.totalPool\?\?stakeAmount\);/g,"const totalPot=Number(matchData?.totalPool??0);");s=s.replace(/const winnerGets\s*=\s*Number\(matchData\?\.payout\s*\?\?\s*\(feeRate[^;]+;/g,"const winnerGets = Number(matchData?.winnerPayout ?? matchData?.payout ?? 0);");s=s.replace(/const winnerGets=Number\(matchData\?\.payout[^;]+;/g,"const winnerGets=Number(matchData?.winnerPayout??matchData?.payout??0);");
s=s.replace('const { formatCurrencyNoDecimals } = useSettings();','const { formatCurrency, formatCurrencyNoDecimals } = useSettings();');
// Only the result modal UI is changed: winner at top, actual coin result at bottom.
a=s.indexOf("      {/* Result Popup */}"),b=s.indexOf("      <FairnessModal",a);if(a>=0&&b>a){const modal=`      {/* Result Popup */}
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

`;s=s.slice(0,a)+modal+s.slice(b)}
// Close/clear a finished match, and naturally close the modal after 5 seconds without starting another match.
if(!s.includes("const closeFinishedMatch =")){const marker="  const handleExit = () => {";const helper="  const closeFinishedMatch = () => {clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);searchInFlight.current=false;forceSearchRef.current=false;settledMatchHandled.current=null;transactionRecorded.current=false;setGameState(\"ready\");};\n  const handleNewSearch = () => {forceSearchRef.current=true;startSearch();};\n\n";if(s.includes(marker))s=s.replace(marker,helper+marker);}
if(!s.includes("Coin Flip result modal auto-close"))s=s.replace("  return (","  // Coin Flip result modal auto-close\n  useEffect(()=>{if(!showResultPopup)return;const t=window.setTimeout(()=>closeFinishedMatch(),5000);return()=>window.clearTimeout(t)},[showResultPopup]);\n\n  return (");
fs.writeFileSync(path,s);console.log("Coin Flip final v5 repair applied");
