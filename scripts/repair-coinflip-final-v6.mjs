import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const duplicate='  const handleNewSearch = () => {forceSearchRef.current=true;startSearch();};\n';
s=s.replace(duplicate,"");
s=s.replace('const handleNewSearch = () => {forceSearchRef.current=true;clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);settledMatchHandled.current=null;transactionRecorded.current=false;startSearch();};','const handleNewSearch = () => {forceSearchRef.current=true;searchInFlight.current=false;clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);settledMatchHandled.current=null;transactionRecorded.current=false;startSearch();};');
fs.writeFileSync(path,s);
console.log("Coin Flip new-search matchmaking handoff repaired");
