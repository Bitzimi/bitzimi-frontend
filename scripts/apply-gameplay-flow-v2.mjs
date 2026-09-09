import fs from "node:fs";

const replaceBetween = (file, start, end, replacement) => {
  let s = fs.readFileSync(file, "utf8");
  const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`${file}: flow markers not found`);
  fs.writeFileSync(file, s.slice(0, a) + replacement + s.slice(b));
};

// Coin Flip: entering the page is idle; Search is the public matchmaking action.
{
  const f = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = fs.readFileSync(f, "utf8");
  s = s.replace('type GameState = "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('const [gameState, setGameState] = useState<GameState>("searching");', 'const [gameState, setGameState] = useState<GameState>("ready");');
  const start = s.indexOf("  // Real-player matchmaking — enter queue, wait for real opponent");
  const end = s.indexOf("  const assignSides =", start);
  if (start < 0 || end < 0) throw new Error("Coin Flip matchmaking block not found");
  const block = `  // Public matchmaking starts only after the user presses Search.\n  const startSearch = async () => {\n    if (gameState !== "ready") return;\n    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }\n    setGameState("searching");\n    try {\n      if (privateMatchId) {\n        const match = await gameMatchmakingService.getMatch(privateMatchId);\n        setMatchId(privateMatchId); setMatchData(match); setOpponentName(match.opponent.username);\n        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");\n        setTimeout(() => assignSides(match), 3000); return;\n      }\n      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);\n      if (result.status === "matched" && result.matchId) {\n        const match = await gameMatchmakingService.getMatch(result.matchId);\n        setMatchId(result.matchId); setMatchData(match); setOpponentName(match.opponent.username);\n        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");\n        setTimeout(() => assignSides(match), 3000); return;\n      }\n      if (result.queueId) {\n        setQueueId(result.queueId);\n        pollRef.current = setInterval(async () => {\n          try {\n            const status = await gameMatchmakingService.pollQueue(result.queueId);\n            if (status.status === "matched" && status.matchId) {\n              clearInterval(pollRef.current!);\n              const match = await gameMatchmakingService.getMatch(status.matchId);\n              setMatchId(status.matchId); setMatchData(match); setOpponentName(match.opponent.username);\n              setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");\n              setTimeout(() => assignSides(match), 3000);\n            } else if (status.status === "cancelled") { clearInterval(pollRef.current!); setGameState("ready"); }\n          } catch {}\n        }, 500);\n      }\n    } catch { setGameState("ready"); toast.error("Unable to start matchmaking"); }\n  };\n\n  useEffect(() => {\n    if (privateMatchId) startSearch();\n    return () => { if (pollRef.current) clearInterval(pollRef.current); };\n  }, [privateMatchId]);\n\n`;
  s = s.slice(0, start) + block + s.slice(end);
  s = s.replace(/        \/\* Searching State \*\/[\s\S]*?\{gameState === "matched"/, '        {/* Ready/Search State */}\n        {gameState === "ready" && (\n          <div className="text-center">\n            <Button onClick={startSearch} className="px-8 py-3 text-base font-semibold">Search for Opponent</Button>\n            <div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div>\n          </div>\n        )}\n\n        {/* Searching State */}\n        {gameState === "searching" && (\n          <div className="text-center"><div className="mb-4"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div></div><div className="text-base text-gray-300">Searching for opponent...</div></div>\n        )}\n\n        {gameState === "matched"');
  s = s.replace("Session History (${stakeAmount} Stake)", "Your History");
  s = s.replace('          <div className="p-4">\n            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Your History</h3>', '          <div className="p-4">\n            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Your History</h3>');
  s = s.replace('                  <div className="flex items-center gap-2 flex-1">', '                  <div className="flex items-center gap-2 flex-1">\n                    <PlayerAvatar avatar={identity.avatar} />');
  s = s.replace('                      {/* Win → current user avatar from identity; Loss → opponent initial derived from name */}\n                      <PlayerAvatar avatar={record.result === "win" ? identity.avatar : record.opponent.charAt(0).toUpperCase()} />', '                      <PlayerAvatar avatar={record.result === "win" ? identity.avatar : record.opponent.charAt(0).toUpperCase()} />');
  const infoOld = 'Platform fee: {PLATFORM_FEE_PERCENT}% • Winner receives: {formatCurrencyNoDecimals(totalPot - Math.floor(totalPot * (PLATFORM_FEE_PERCENT / 100)))}';
  s = s.replace(infoOld, 'Platform fee: {PLATFORM_FEE_PERCENT}% • Winner receives: {formatCurrencyNoDecimals(winnerGets)}');
  const buttonMarker = '              <Button\n                variant="outline"\n                onClick={handleExit}';
  const p = s.indexOf(buttonMarker);
  if (p >= 0) {
    const q = s.indexOf('              </Button>', p) + '              </Button>'.length;
    const old = s.slice(p, q);
    const extra = old + '\n              <Button onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}>Search for New Opponent</Button>';
    s = s.slice(0, p) + extra + s.slice(q);
  }
  // Only backend creates the completed-game notification for public 1v1 games.
  const n = s.indexOf('        addNotification(\n          won ? "game_win" : "game_loss"');
  if (n >= 0) { const e = s.indexOf('        if (won) liveActivityService', n); s = s.slice(0, n) + s.slice(e); }
  fs.writeFileSync(f, s);
}

// Dice Clash: same Search gate; backend remains authoritative.
{
  const f = "src/app/pages/DiceDuelGame.tsx";
  let s = fs.readFileSync(f, "utf8");
  s = s.replace('type GameState = "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('const [gameState, setGameState] = useState<GameState>("searching");', 'const [gameState, setGameState] = useState<GameState>("ready");');
  const a = s.indexOf('  // Real-player matchmaking — no bots, no fake opponents');
  const b = s.indexOf('  useEffect(() => {\n    // Auto-start game after match found', a);
  if (a < 0 || b < 0) throw new Error("Dice Clash matchmaking block not found");
  const block = `  const startSearch = async () => {\n    if (gameState !== "ready") return;\n    if (balances.game < stake) { toast.error("Insufficient balance in Game Wallet"); return; }\n    setGameState("searching");\n    try {\n      if (privateMatchId) { const match = await gameMatchmakingService.getMatch(privateMatchId); setMatchId(privateMatchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched"); return; }\n      const result = await gameMatchmakingService.joinQueue("dice_clash", stake);\n      if (result.status === "matched" && result.matchId) { const match = await gameMatchmakingService.getMatch(result.matchId); setMatchId(result.matchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched"); return; }\n      if (result.queueId) { setQueueId(result.queueId); pollIntervalRef.current = setInterval(async () => { try { const status = await gameMatchmakingService.pollQueue(result.queueId); if (status.status === "matched" && status.matchId) { clearInterval(pollIntervalRef.current!); const match = await gameMatchmakingService.getMatch(status.matchId); setMatchId(status.matchId); setMatchData(match); setOpponentName(match.opponent.username); setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched"); } else if (status.status === "cancelled") { clearInterval(pollIntervalRef.current!); setGameState("ready"); } } catch {} }, 500); }\n    } catch { setGameState("ready"); toast.error("Unable to start matchmaking"); }\n  };\n\n  useEffect(() => { if (privateMatchId) startSearch(); return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }; }, [privateMatchId]);\n\n`;
  s = s.slice(0, a) + block + s.slice(b);
  const marker = '{gameState === "searching" && (';
  s = s.replace(marker, '{gameState === "ready" && (\n            <div className="text-center py-8"><Button onClick={startSearch} className="px-8 py-3">Search for Opponent</Button><div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div></div>\n          )}\n\n          {gameState === "searching" && (');
  const n = s.indexOf('        addNotification(\n          won ? "game_win" : "game_loss"');
  if (n >= 0) { const e = s.indexOf('        if (won) liveActivityService', n); s = s.slice(0, n) + s.slice(e); }
  fs.writeFileSync(f, s);
}

// Reaction Tap: use its existing enterQueue function, but only call it after Search.
{
  const f = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = fs.readFileSync(f, "utf8");
  s = s.replace('type GameState =\n  | "searching"', 'type GameState =\n  | "ready"\n  | "searching"');
  s = s.replace('const [gameState,        setGameState]        = useState<GameState>("searching");', 'const [gameState,        setGameState]        = useState<GameState>("ready");');
  const a = s.indexOf('  // ── Enter matchmaking queue');
  const b = s.indexOf('  // ── Handle tap', a);
  if (a < 0 || b < 0) throw new Error("Reaction Tap queue markers not found");
  const queueEnd = s.lastIndexOf('  // ── Handle tap', b);
  // Keep enterQueue itself; replace only the auto-start effect immediately before Handle tap.
  const effect = s.lastIndexOf('  useEffect(() => {', b);
  const effectEnd = s.indexOf('  // ── Handle tap', effect);
  if (effect >= 0 && effectEnd > effect) {
    const old = s.slice(effect, effectEnd);
    if (old.includes('enterQueue(sid)')) {
      const replacement = '  const startSearch = () => { if (gameState !== "ready") return; enterQueue(sessionId.current); };\n\n  useEffect(() => { if (privateMatchId) enterQueue(sessionId.current); return () => stopAllTimers(); }, [privateMatchId]);\n\n';
      s = s.slice(0, effect) + replacement + s.slice(effectEnd);
    }
  }
  s = s.replace('{gameState === "searching" && (', '{gameState === "ready" && (\n            <div className="text-center py-8"><Button onClick={startSearch} className="px-8 py-3">Search for Opponent</Button><div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div></div>\n          )}\n\n          {gameState === "searching" && (');
  const n = s.indexOf('      addNotification(');
  if (n >= 0) { const e = s.indexOf('      liveActivityService', n); if (e >= 0) s = s.slice(0, n) + s.slice(e); }
  fs.writeFileSync(f, s);
}

console.log("Applied gameplay flow fixes.");
