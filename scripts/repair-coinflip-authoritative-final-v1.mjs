import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");

// Coin Flip must not persist game/session/stat state in browser storage.
s=s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode/m,"\n\n  // Prevent double execution in React Strict Mode");
s=s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m,"");
s=s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\);/m,"");
s=s.replace(/\n\s*localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g,"");

if(!/const timersRef = useRef/.test(s)){
  s=s.replace(/  \/\/ Prevent double execution in React Strict Mode/,'  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);\n  const clearTimers = () => { for(const t of timersRef.current) clearTimeout(t); timersRef.current=[]; };\n\n  // Prevent double execution in React Strict Mode');
}

const helpers=`  const finalCoinFlipElapsedMs=(md:any)=>{const startedAt=Date.parse(md?.createdAt??"");const serverNow=Date.parse(md?.serverNow??"");const now=Number.isFinite(serverNow)?serverNow:Date.now();return Number.isFinite(startedAt)?Math.max(0,now-startedAt):0;};
  const finalApplyCoinFlipResult=async(md:any)=>{const result=md?.result?.coinFlip as CoinSide|undefined;if(!result)return;const won=Boolean(md.youWon);const name=md.opponent?.username??opponentName??"Player";const avatar=md.opponent?.avatar??name.charAt(0).toUpperCase();const winnings=Number(md.payout??0);setPlatformFee(Number(md.platformFee??0));setCoinResult(result);setIsWinner(won);setWinAmount(won?winnings:0);setWinnerAvatar(won?playerAvatar:avatar);setWinnerName(won?myUsername:name);setGameState("showing_result");if(!transactionRecorded.current){transactionRecorded.current=true;await refreshWalletsFromBackend().catch(()=>{});addGameResult({gameType:"pvp_coinflip",betAmount:stakeAmount,winAmount:won?winnings:0,profit:won?winnings-stakeAmount:-stakeAmount,won,opponent:name,outcome:result});}setShowWinner(true);setShowResultPopup(true);};
  const finalScheduleCoinFlipTimeline=(md:any)=>{const elapsed=finalCoinFlipElapsedMs(md);const SIDE_MS=12000;const FLIP_MS=5000;const TOTAL_MS=SIDE_MS+FLIP_MS;setAnimationDurationMs(TOTAL_MS);setAnimationElapsedMs(Math.min(TOTAL_MS,elapsed));setPlayerSide(md.isPlayer1?md.result?.p1Side:md.result?.p2Side);setOpponentSide(md.isPlayer1?md.result?.p2Side:md.result?.p1Side);clearTimers();if(elapsed<SIDE_MS){setGameState("side_assignment");timersRef.current.push(setTimeout(()=>finalScheduleCoinFlipTimeline(md),SIDE_MS-elapsed));return;}if(elapsed<TOTAL_MS){setGameState("flipping");setCoinResult(md.result?.coinFlip??null);timersRef.current.push(setTimeout(()=>finalScheduleCoinFlipTimeline(md),TOTAL_MS-elapsed));return;}finalApplyCoinFlipResult(md);};

`;

const assignMatch=s.match(/const assignSides = \(md\?:any\)\s*=>/);
if(!assignMatch) throw new Error("Coin Flip assignSides marker not found after previous build repairs");
const assignStart=assignMatch.index;
const assignEnd=s.indexOf('useEffect(() => {',assignStart);
if(assignEnd<0) throw new Error("Coin Flip assignSides end marker not found after previous build repairs");
s=s.slice(0,assignStart)+helpers+'const assignSides = (md?:any) => { const data=md??matchData; if(!data?.result)return; finalScheduleCoinFlipTimeline(data); };\n\n'+s.slice(assignEnd);

const startMatch=s.match(/const startGame = \(md: any, _assignedPlayerSide: CoinSide\)\s*=>/);
if(startMatch){const start=startMatch.index;const end=s.indexOf('const addToSessionHistory =',start);if(end>=0)s=s.slice(0,start)+'const startGame=(md:any,_assignedPlayerSide:CoinSide)=>{if(!md?.result)return;finalScheduleCoinFlipTimeline(md);};\n\n'+s.slice(end);}

// Backend-only history: never write Coin Flip history to browser storage.
const historyStart=s.indexOf('const addToSessionHistory =');
if(historyStart>=0){
  const exitStart=s.search(/const handleExit\s*=\s*\(\)\s*=>/);
  if(exitStart>historyStart) s=s.slice(0,historyStart)+'const addToSessionHistory=(_record:Omit<SessionRecord,"id"|"timestamp">)=>{};\n\n'+s.slice(exitStart);
}

// Preserve the existing Coin Flip player UI exactly. Only correct its data bindings.
const playersStart=s.indexOf('          {/* Players */}');
const gameAreaStart=playersStart>=0?s.indexOf('          {/* Game Area */}',playersStart):-1;
if(playersStart>=0&&gameAreaStart>playersStart){
  let playersBlock=s.slice(playersStart,gameAreaStart);
  playersBlock=playersBlock.replace('avatar={identity.avatar}','avatar={homeAvatar}');
  playersBlock=playersBlock.replace('avatar={opponentAvatar}','avatar={awayAvatar}');
  playersBlock=playersBlock.replace('{myUsername}','{homeName}');
  playersBlock=playersBlock.replace('{opponentName}','{awayName}');
  s=s.slice(0,playersStart)+playersBlock+s.slice(gameAreaStart);
}

// Keep exactly one safe result-popup search handler. Only use refs guaranteed by the component.
const handlers=`  const closeFinishedMatch = () => { clearPolling(); clearTimers(); setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setPlayerSide(null); setOpponentSide(null); setAnimationElapsedMs(0); searchInFlight.current=false; transactionRecorded.current=false; setGameState("ready"); };
  const handleNewSearch = () => { closeFinishedMatch(); setTimeout(() => startSearch(), 0); };

`;
s=s.replace(/\s*const closeFinishedMatch\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};\s*/g,'\n');
s=s.replace(/\s*const handleNewSearch\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};\s*/g,'\n');
const exitMatch=s.match(/const handleExit\s*=\s*\(\)\s*=>/);
if(exitMatch) s=s.slice(0,exitMatch.index)+handlers+s.slice(exitMatch.index);
else {
  const totalPotMarker=s.search(/const totalPot\s*=/);
  if(totalPotMarker>=0) s=s.slice(0,totalPotMarker)+handlers+s.slice(totalPotMarker);
  else s=s.replace(/\n\s*return\s*\(/,'\n'+handlers+'\n  return (');
}

fs.writeFileSync(path,s);console.log("Applied authoritative Coin Flip timeline and backend player mapping without replacing the existing UI design.");
