import fs from "node:fs";
const p="src/app/pages/PvPCoinFlipGame.tsx"; let s=fs.readFileSync(p,"utf8");
s=s.replace(/setTimeout\(\(\) => assignSides\(match\), 3000\);/g,"assignSides(match);");
const a=s.indexOf("const finalScheduleCoinFlipTimeline=(md:any)=>{"); const b=s.indexOf("\n\nconst assignSides",a); if(a<0||b<0)throw new Error("timeline markers not found");
const fn=[
'const finalScheduleCoinFlipTimeline=(md:any)=>{',
' if(!md?.matchId)return;',
' const phase=md.phase;',
' setMatchData(md);',
' setPlayerSide(md.isPlayer1?md.result?.p1Side:md.result?.p2Side); setOpponentSide(md.isPlayer1?md.result?.p2Side:md.result?.p1Side);',
' setAnimationDurationMs(Number(md.animationDurationMs??18000)); setAnimationElapsedMs(Number(md.animationElapsedMs??0));',
' const now=Date.parse(md.serverNow??""); const end=phase==="side_assignment"?Date.parse(md.sideAssignmentEndsAt??""):phase==="flipping"?Date.parse(md.flipEndsAt??""):Date.parse(md.resultPopupEndsAt??"");',
' const delay=Number.isFinite(now)&&Number.isFinite(end)?Math.max(50,end-now):500;',
' clearTimers();',
' if(phase==="side_assignment"){setCoinResult(null);setGameState("side_assignment");timersRef.current.push(setTimeout(async()=>{try{finalScheduleCoinFlipTimeline(await gameMatchmakingService.getMatch(md.matchId));}catch{}},delay));return;}',
' if(phase==="flipping"){setCoinResult(null);setGameState("flipping");timersRef.current.push(setTimeout(async()=>{try{finalScheduleCoinFlipTimeline(await gameMatchmakingService.getMatch(md.matchId));}catch{}},delay));return;}',
' if(phase==="result_popup"){await finalApplyCoinFlipResult(md);setGameState("result_popup");timersRef.current.push(setTimeout(()=>{setShowResultPopup(false);setShowWinner(false);setCoinResult(null);setMatchId(null);setMatchData(null);setQueueId(null);setPlayerSide(null);setOpponentSide(null);setAnimationElapsedMs(0);setGameState("ready");transactionRecorded.current=false;},delay));return;}',
' if(phase==="finished"){setShowResultPopup(false);setShowWinner(false);setGameState("ready");}',
'}'
].join("\n");
s=s.slice(0,a)+fn+s.slice(b); fs.writeFileSync(p,s); console.log("Coin Flip frontend phase synchronization patched");
