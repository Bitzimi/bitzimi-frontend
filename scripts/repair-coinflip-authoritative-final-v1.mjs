import fs from "node:fs";
const path="src/app/pages/PvPCoinFlipGame.tsx";
let s=fs.readFileSync(path,"utf8");

// Coin Flip must not persist game/session/stat state in browser storage.
s=s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode/m,"\n\n  // Prevent double execution in React Strict Mode");
s=s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m,"");
s=s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\]\);/m,"");
s=s.replace(/\n\s*localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g,"");

if(!/const timersRef = useRef/.test(s)){
  s=s.replace(/  \/\/ Prevent double execution in React Strict Mode/,'  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);\n  const clearTimers = () => { for(const t of timersRef.current) clearTimeout(t); timersRef.current=[]; };\n\n  // Prevent double execution in React Strict Mode');
}

// Use uniquely named helpers because earlier Coin Flip repair scripts may already
// have generated helpers with similar names.
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
if(historyStart>=0){const exitStart=s.indexOf('const handleExit =',historyStart);if(exitStart>=0)s=s.slice(0,historyStart)+'const addToSessionHistory=(_record:Omit<SessionRecord,"id"|"timestamp">)=>{};\n\n'+s.slice(exitStart);}

// Generic Home/Player1 vs Away/Player2 mapping.
const playersStart=s.indexOf('          {/* Players */}');
const gameAreaStart=playersStart>=0?s.indexOf('          {/* Game Area */}',playersStart):-1;
if(playersStart>=0&&gameAreaStart>=0){const players=`          {/* Players: left = backend Home/Player1, right = backend Away/Player2 */}\n          <div className="flex items-center justify-between mb-6">\n            {(() => {\n              const home=matchData?.isPlayer1?{name:myUsername,avatar:playerAvatar}:{name:opponentName,avatar:opponentAvatar};\n              const away=matchData?.isPlayer1?{name:opponentName,avatar:opponentAvatar}:{name:myUsername,avatar:playerAvatar};\n              return <>\n                <div className="flex flex-col items-center"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden"><PlayerAvatar avatar={home.avatar}/></div><div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{home.name}</div></div>\n                <div className="flex-1 mx-4 text-center"><div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div>\n                <div className="flex flex-col items-center"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden"><PlayerAvatar avatar={away.avatar}/></div><div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{away.name}</div></div>\n              </>;\n            })()}\n          </div>\n\n`;s=s.slice(0,playersStart)+players+s.slice(gameAreaStart);}

fs.writeFileSync(path,s);console.log("Applied final Coin Flip authoritative 12s/5s timeline, generic Home/Away avatar mapping, and local-storage cleanup.");
