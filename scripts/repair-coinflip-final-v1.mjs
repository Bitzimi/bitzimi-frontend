import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const between = (source, start, end, replacement) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Coin Flip final repair marker not found: ${start}`);
  return source.slice(0, a) + replacement + source.slice(b);
};

// The authoritative lifecycle is 12s side assignment + 5s flipping = 17s total.
s = s.replaceAll("const [animationDurationMs, setAnimationDurationMs] = useState(17000);", "const [animationDurationMs, setAnimationDurationMs] = useState(17000);");
s = s.replaceAll("const [animationDurationMs,setAnimationDurationMs]=useState(17000);", "const [animationDurationMs,setAnimationDurationMs]=useState(17000);");

// Keep the live synchronization loop running from the moment a match is found.
const assignStart = "  const assignSides = (md?:any) => {";
const assignEnd = "  useEffect(() => {\n    if (!matchId) return;";
const assignReplacement = `  const assignSides = (md?:any) => {
    const data=md??matchData;
    if(!data?.matchId)return;
    const assignedPlayerSide:CoinSide=data.isPlayer1?data.result?.p1Side:data.result?.p2Side;
    const assignedOpponentSide:CoinSide=data.isPlayer1?data.result?.p2Side:data.result?.p1Side;
    setPlayerSide(assignedPlayerSide??null);
    setOpponentSide(assignedOpponentSide??null);
    setMatchData(data);
    setAnimationDurationMs(Number(data.animationDurationMs??17000));
    setAnimationElapsedMs(Number(data.animationElapsedMs??0));
    clearTimers();
    if(data.status==="settled"){applySettledResult(data);return;}
    setGameState("side_assignment");
    waitForSettlement(data.matchId,data);
  };

`;
if (s.includes(assignStart) && s.includes(assignEnd)) s = between(s, assignStart, assignEnd, assignReplacement);

// Use the backend phase continuously. Never depend on a frontend timeout to change phases.
const syncStart = "  const syncActiveMatch = async (id:string) => {";
const syncEnd = "  const waitForSettlement =";
if (s.includes(syncStart) && s.includes(syncEnd)) {
  const syncReplacement = `  const syncActiveMatch = async (id:string) => {
    try {
      const md=await gameMatchmakingService.getMatch(id);
      setMatchData(md);
      setOpponentName(md.opponent?.username??"Player");
      setOpponentAvatar(md.opponent?.avatar??md.opponent?.username?.charAt(0).toUpperCase()??"P");
      setPlayerSide(md.playerSide??(md.isPlayer1?md.result?.p1Side:md.result?.p2Side)??null);
      setOpponentSide(md.opponentSide??(md.isPlayer1?md.result?.p2Side:md.result?.p1Side)??null);
      setAnimationDurationMs(Number(md.animationDurationMs??17000));
      setAnimationElapsedMs(Number(md.animationElapsedMs??0));
      if(md.status==="settled"){clearPolling();await applySettledResult(md);return true;}
      if(md.phase==="flipping")setGameState("flipping");else setGameState("side_assignment");
      return false;
    }catch{return false;}
  };
  `;
  s = between(s, syncStart, syncEnd, syncReplacement);
}

// Ensure the polling loop actually drives the backend phase transition and settlement.
const waitStart = "  const waitForSettlement =";
const waitEnd = "  const startSearch =";
if (s.includes(waitStart) && s.includes(waitEnd)) {
  const waitReplacement = `  const waitForSettlement = (id:string, initialMatch:any) => {
    clearPolling();
    syncActiveMatch(id);
    pollRef.current=setInterval(()=>{syncActiveMatch(id);},250);
  };

`;
  s = between(s, waitStart, waitEnd, waitReplacement);
}

// Dynamic stats: before a real match exists Pool and Winner are zero.
s = s.replaceAll("matchData?.totalPool ?? stakeAmount", "matchData?.totalPool ?? 0");
s = s.replaceAll("matchData?.totalPool??stakeAmount", "matchData?.totalPool??0");
s = s.replace(/const totalPot=Number\(matchData\?\.totalPool\?\?0\); const winnerGets=Number\(matchData\?\.payout\?\?\(feeRate>0\?totalPot\*\(1-feeRate\):0\)\);/g, 'const totalPot=Number(matchData?.totalPool??0); const winnerGets=Number(matchData?.winnerPayout??(matchData?.payout??0));');
s = s.replace(/const totalPot = Number\(matchData\?\.totalPool \?\? 0\);\s*const winnerGets = Number\(matchData\?\.payout \?\? \(feeRate > 0 \? totalPot \* \(1 - feeRate \) : 0\)\);/g, 'const totalPot = Number(matchData?.totalPool ?? 0);\n  const winnerGets = Number(matchData?.winnerPayout ?? matchData?.payout ?? 0);');

// Once the finished modal is closed, explicitly clear the finished match from this page.
// The next reload therefore cannot render the old result from a URL/session state.
if (!s.includes("const closeFinishedMatch =")) {
  const marker = "  const handleExit = () => {";
  const helper = `  const closeFinishedMatch = () => {
    clearPolling(); clearTimers();
    setShowResultPopup(false); setShowWinner(false); setCoinResult(null);
    setMatchId(null); setMatchData(null); setQueueId(null); setPlayerSide(null); setOpponentSide(null);
    setAnimationElapsedMs(0); searchInFlight.current=false; transactionRecorded.current=false;
    setGameState("ready");
  };

`;
  if (s.includes(marker)) s = s.replace(marker, helper + marker);
}

// Top player summary follows the actual Home/Away assignment when a match exists.
const aliasMarker = "  return (";
if (!s.includes("const homeName = matchData?.isHome")) {
  const aliases = `  const homeName = matchData ? (matchData.isHome ? myUsername : opponentName) : myUsername;
  const awayName = matchData ? (matchData.isHome ? opponentName : myUsername) : opponentName;
  const homeAvatar = matchData ? (matchData.isHome ? playerAvatar : opponentAvatar) : playerAvatar;
  const awayAvatar = matchData ? (matchData.isHome ? opponentAvatar : playerAvatar) : opponentAvatar;
  `;
  if (s.includes(aliasMarker)) s = s.replace(aliasMarker, aliases + aliasMarker);
}

const topStart = "          {/* Players */}";
const topEnd = "          {/* Game Area */}";
if (s.includes(topStart) && s.includes(topEnd)) {
  const topBlock = `          {/* Players */}
          <div className="flex items-center justify-between mb-6">
            {/* Home player */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">
                <PlayerAvatar avatar={homeAvatar} />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{homeName}</div>
            </div>
            <div className="flex-1 mx-4 text-center">
              <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">
                Balance: {formatCurrencyNoDecimals(balances.game)}
              </div>
            </div>
            {/* Away player */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">
                <PlayerAvatar avatar={awayAvatar} />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{awayName}</div>
            </div>
          </div>

`;
  s = between(s, topStart, topEnd, topBlock + topEnd);
}

// Remove any previous side-assignment text that was inserted at the top of the modal.
s = s.replace(/\n\s*<div className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">\{myUsername\} — \{playerSide\?\.toUpperCase\(\) \?\? ""\} &nbsp; vs &nbsp; \{opponentName\} — \{opponentSide\?\.toUpperCase\(\) \?\? ""\}<\/div>/g, "");

// Only the result modal UI is changed: winner/loss remains at the top; actual sides/result are shown at the bottom.
const modalBottomMarker = `            <div className="pt-2 flex flex-col items-center gap-2">`;
if (s.includes(modalBottomMarker) && !s.includes("Actual Match Sides")) {
  const sideBlock = `            <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded p-3">
              <div className="font-semibold text-gray-900 dark:text-white mb-1">Actual Match Sides</div>
              <div>{myUsername} — {playerSide?.toUpperCase() ?? ""} &nbsp; vs &nbsp; {opponentName} — {opponentSide?.toUpperCase() ?? ""}</div>
              <div className="mt-1">Coin Result: <span className="font-bold text-gray-900 dark:text-white">{coinResult?.toUpperCase() ?? ""}</span></div>
            </div>

`;
  s = s.replace(modalBottomMarker, sideBlock + modalBottomMarker);
}

// Search for New Opponent must call backend matchmaking, not merely reset React state.
s = s.replace('onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}', 'onClick={handleNewSearch}');

// Result modal automatically returns to the ready/search screen after 5 seconds unless the user acts.
// This timer is cancelled automatically when the modal closes, so it can never interfere with a new search.
if (!s.includes("Coin Flip result modal auto-close")) {
  const finalReturn = s.lastIndexOf("\n  return (");
  if (finalReturn >= 0) {
    const effect = `
  // Coin Flip result modal auto-close: completed matches return to the ready/search state after 5 seconds.
  useEffect(() => {
    if (!showResultPopup) return;
    const timer = window.setTimeout(() => {
      clearPolling(); clearTimers();
      setShowResultPopup(false); setShowWinner(false); setCoinResult(null);
      setMatchId(null); setMatchData(null); setQueueId(null); setPlayerSide(null); setOpponentSide(null);
      setAnimationElapsedMs(0); searchInFlight.current=false; transactionRecorded.current=false;
      setGameState("ready");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [showResultPopup]);
`;
    s = s.slice(0, finalReturn) + effect + s.slice(finalReturn);
  }
}

// Make closing the dialog via X/overlay also clear the finished match.
s = s.replace('<Dialog open={showResultPopup} onOpenChange={setShowResultPopup}>', '<Dialog open={showResultPopup} onOpenChange={(open) => { if (!open) closeFinishedMatch(); else setShowResultPopup(true); }} >');

// This final pass intentionally changes no visual styling outside the permitted result modal content.
fs.writeFileSync(path, s);
console.log("Coin Flip final lifecycle/sync/modal repair applied");
