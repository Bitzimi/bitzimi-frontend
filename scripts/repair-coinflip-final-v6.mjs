import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");
const duplicate='  const handleNewSearch = () => {forceSearchRef.current=true;startSearch();};\n';
s=s.replace(duplicate,"");
s=s.replace('const handleNewSearch = () => {forceSearchRef.current=true;clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);settledMatchHandled.current=null;transactionRecorded.current=false;startSearch();};','const handleNewSearch = () => {forceSearchRef.current=true;searchInFlight.current=false;clearPolling();clearTimers();setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);settledMatchHandled.current=null;transactionRecorded.current=false;startSearch();};');
s=s.replace('const homeName = matchData?.isHome ? myUsername : opponentName;','const homeName = matchData ? (matchData.isHome ? myUsername : opponentName) : myUsername;');
s=s.replace('const awayName = matchData?.isHome ? opponentName : myUsername;','const awayName = matchData ? (matchData.isHome ? opponentName : myUsername) : opponentName;');
s=s.replace('const homeAvatar = matchData?.isHome ? playerAvatar : opponentAvatar;','const homeAvatar = matchData ? (matchData.isHome ? playerAvatar : opponentAvatar) : playerAvatar;');
s=s.replace('const awayAvatar = matchData?.isHome ? opponentAvatar : playerAvatar;','const awayAvatar = matchData ? (matchData.isHome ? opponentAvatar : playerAvatar) : opponentAvatar;');

// Fix the actual top Home/Away player row. The original source uses identity.avatar
// for the left player, so the backend-assigned Home opponent could still inherit
// the current user's avatar. Keep this change scoped to the player row only.
const playersStart=s.indexOf('          {/* Players */}');
const gameAreaStart=s.indexOf('          {/* Game Area */}',playersStart);
if(playersStart>=0&&gameAreaStart>playersStart){
  let playersBlock=s.slice(playersStart,gameAreaStart);
  playersBlock=playersBlock.replace('avatar={identity.avatar}','avatar={homeAvatar}');
  playersBlock=playersBlock.replace('avatar={opponentAvatar}','avatar={awayAvatar}');
  playersBlock=playersBlock.replace('{myUsername}','{homeName}');
  playersBlock=playersBlock.replace('{opponentName}','{awayName}');
  s=s.slice(0,playersStart)+playersBlock+s.slice(gameAreaStart);
}

// The backend is authoritative for the 12s side-assignment -> 5s flip lifecycle.
// Keep polling from the moment a match is assigned; the previous flow only called
// syncActiveMatch once while in side_assignment, so it could remain there forever.
const oldAssign='const assignSides = (md?:any) => { if(md?.matchId){setMatchData(md);setPlayerSide(md.playerSide??null);setOpponentSide(md.opponentSide??null);syncActiveMatch(md.matchId)} };';
const newAssign='const assignSides = (md?:any) => { if(!md?.matchId)return; setMatchData(md); setPlayerSide(md.playerSide??null); setOpponentSide(md.opponentSide??null); clearPolling(); pollRef.current=setInterval(()=>{syncActiveMatch(md.matchId);},250); syncActiveMatch(md.matchId); };';
s=s.replace(oldAssign,newAssign);

// Final guard: the result modal always references handleNewSearch. Ensure exactly one
// canonical handler exists after every preceding build-repair script has run.
const handlerBody='  const handleNewSearch = () => { forceSearchRef.current=true; searchInFlight.current=false; clearPolling(); clearTimers(); setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setPlayerSide(null); setOpponentSide(null); setAnimationElapsedMs(0); if (typeof settledMatchHandled !== "undefined") settledMatchHandled.current=null; transactionRecorded.current=false; startSearch(); };\n\n';
const handlerStart=s.indexOf('const handleNewSearch =');
if(handlerStart>=0){
  const handlerEnd=s.indexOf('const handleExit =',handlerStart);
  if(handlerEnd>handlerStart) s=s.slice(0,handlerStart)+handlerBody+s.slice(handlerEnd);
} else {
  const exitMarker=s.indexOf('  const handleExit = () => {');
  if(exitMarker>=0) s=s.slice(0,exitMarker)+handlerBody+s.slice(exitMarker);
}

fs.writeFileSync(path,s);
console.log("Coin Flip final Home/Away avatar mapping, backend phase polling, and Search handler repaired");
