import fs from "node:fs";

const p = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(p, "utf8");

// Remove the old frontend-only 3 second transition. The backend match timeline
// is the single source of truth for when each Coin Flip phase begins/ends.
s = s.replace(/setTimeout\(\(\) => assignSides\(match\), 3000\);/g, "assignSides(match);");

const a = s.indexOf("const finalScheduleCoinFlipTimeline=(md:any)=>{");
const b = s.indexOf("\n\nconst assignSides", a);
if (a < 0 || b < 0) throw new Error("Coin Flip timeline markers not found");

const fn = [
  "const finalScheduleCoinFlipTimeline=async(md:any)=>{",
  " if(!md?.matchId)return;",
  " const serverNowMs=Date.parse(md.serverNow??\"\");",
  " const clientNowMs=Date.now();",
  " const clockOffsetMs=Number.isFinite(serverNowMs)?serverNowMs-clientNowMs:0;",
  " const nowMs=Date.now()+clockOffsetMs;",
  " const sideEndMs=Date.parse(md.sideAssignmentEndsAt??\"\");",
  " const flipEndMs=Date.parse(md.flipEndsAt??\"\");",
  " const popupEndMs=Date.parse(md.resultPopupEndsAt??\"\");",
  " const sideStartMs=Date.parse(md.animationStartAt??md.createdAt??\"\");",
  " const sideDurationMs=Number(md.sideAssignmentDurationMs??8000);",
  " const flipDurationMs=Number(md.animationDurationMs??5000);",
  " const popupDurationMs=Number(md.resultPopupDurationMs??5000);",
  " const totalMs=Number(md.totalTimelineMs??(sideDurationMs+flipDurationMs+popupDurationMs));",
  " const effectiveSideEnd=Number.isFinite(sideEndMs)?sideEndMs:sideStartMs+sideDurationMs;",
  " const effectiveFlipEnd=Number.isFinite(flipEndMs)?flipEndMs:effectiveSideEnd+flipDurationMs;",
  " const effectivePopupEnd=Number.isFinite(popupEndMs)?popupEndMs:effectiveFlipEnd+popupDurationMs;",
  " const phase=md.phase??(nowMs<effectiveSideEnd?\"side_assignment\":nowMs<effectiveFlipEnd?\"flipping\":nowMs<effectivePopupEnd?\"result_popup\":\"finished\");",
  " setMatchData(md);",
  " setPlayerSide(md.isPlayer1?md.result?.p1Side:md.result?.p2Side);",
  " setOpponentSide(md.isPlayer1?md.result?.p2Side:md.result?.p1Side);",
  " setAnimationDurationMs(flipDurationMs);",
  " clearTimers();",
  " if(phase===\"side_assignment\"){setCoinResult(null);setAnimationElapsedMs(0);setGameState(\"side_assignment\");const delay=Math.max(0,effectiveSideEnd-nowMs);timersRef.current.push(setTimeout(()=>{finalScheduleCoinFlipTimeline(md);},delay));return;}",
  " if(phase===\"flipping\"){setCoinResult(null);setAnimationElapsedMs(Math.max(0,Math.min(flipDurationMs,nowMs-effectiveSideEnd)));setGameState(\"flipping\");const delay=Math.max(0,effectiveFlipEnd-nowMs);timersRef.current.push(setTimeout(()=>{finalScheduleCoinFlipTimeline(md);},delay));return;}",
  " if(phase===\"result_popup\"){setAnimationElapsedMs(flipDurationMs);await finalApplyCoinFlipResult(md);setGameState(\"result_popup\");const delay=Math.max(0,effectivePopupEnd-nowMs);timersRef.current.push(setTimeout(()=>{finalScheduleCoinFlipTimeline({...md,phase:\"finished\",serverNow:new Date().toISOString()});},delay));return;}",
  " if(phase===\"finished\"){setAnimationElapsedMs(totalMs);setShowResultPopup(false);setShowWinner(false);setGameState(\"ready\");clearTimers();}",
  "}",
].join("\n");

s = s.slice(0, a) + fn + s.slice(b);

// assignSides is only an entry point. It must never start its own independent timer.
const assignStart = s.indexOf("const assignSides =");
const assignEnd = s.indexOf("\n\nconst startGame", assignStart);
if (assignStart >= 0 && assignEnd >= 0) {
  s = s.slice(0, assignStart) +
    "const assignSides = (md?:any) => { const data=md??matchData; if(!data?.result)return; finalScheduleCoinFlipTimeline(data); };" +
    s.slice(assignEnd);
}

// startGame is retained only for compatibility with any existing JSX references;
// it cannot create a competing timer or determine the result.
const startMatch = s.match(/const startGame = \(md: any, _assignedPlayerSide: CoinSide\)\s*=>/);
if (startMatch) {
  const start = startMatch.index;
  const end = s.indexOf("const addToSessionHistory =", start);
  if (end >= 0) {
    s = s.slice(0, start) +
      "const startGame=(md:any,_assignedPlayerSide:CoinSide)=>{if(!md?.matchId)return;finalScheduleCoinFlipTimeline(md);};\n\n" +
      s.slice(end);
  }
}

fs.writeFileSync(p, s);
console.log("Coin Flip frontend phase synchronization aligned to backend 8s/5s/5s timeline");
