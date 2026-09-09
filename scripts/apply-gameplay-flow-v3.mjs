import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);
  s = s.replace('import { ArrowLeft, Info, Shield } from "lucide-react";', 'import { ArrowLeft, Info, Shield, Search } from "lucide-react";');
  s = s.replace('type GameState = "idle" | "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  s = s.replace('if (gameState !== "ready") return;', 'if (gameState !== "ready" && gameState !== "result_popup" && gameState !== "showing_result") return;');
  s = s.replaceAll('setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());', 'setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());');
  s = s.replace('const gameOpponentAvatar = md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;', 'const gameOpponentAvatar = md.opponent?.avatar ?? md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;');
  if (!s.includes('getGameConfig("pvp_coinflip")')) {
    const marker = '  const myUsername = identity.username;';
    s = s.replace(marker, `${marker}\n\n  useEffect(() => { gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);`);
  }
  s = s.replace('const totalPot = Number(matchData?.totalPool ?? stakeAmount);\n  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));', 'const hasActiveStake = gameState !== "ready" && gameState !== "idle";\n  const totalPot = matchId ? Number(matchData?.totalPool ?? 0) : (hasActiveStake ? stakeAmount : 0);\n  const winnerGets = matchId ? Number(matchData?.payout ?? 0) : (hasActiveStake && feeRate > 0 ? stakeAmount * (1 - feeRate) : 0);');
  s = s.replace('{gameState === "idle" && (\n              <div className="text-center">\n                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}', '{gameState === "ready" && (\n              <div className="text-center">\n                <Button onClick={startSearch} className="px-10 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-white/10 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 transition-all">\n                  <Search className="h-5 w-5 mr-2" />Search\n                </Button>\n                <div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div>\n              </div>\n            )}');
  s = s.replaceAll('<PlayerAvatar avatar={opponentAvatar} />', '<PlayerAvatar avatar={matchData?.opponent?.avatar ?? opponentAvatar} />');
  const duplicateButtons = '              <Button onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}>Search for New Opponent</Button>\n              <Button\n                onClick={() => { setShowResultPopup(false); navigate(`/game/pvp-coinflip/play?stake=${stakeAmount}`); }}\n                className="w-full mt-2"\n              >\n                Search for New Opponent\n              </Button>';
  const singleButton = '              <Button\n                onClick={() => {\n                  setShowResultPopup(false);\n                  setShowWinner(false);\n                  setCoinResult(null);\n                  setMatchId(null);\n                  setMatchData(null);\n                  setQueueId(null);\n                  setGameState("result_popup");\n                  setTimeout(() => startSearch(), 0);\n                }}\n                className="w-full mt-3 h-12 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 border border-white/10 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-500 transition-all"\n              >\n                <Search className="h-4 w-4 mr-2" />Search for New Opponent\n              </Button>';
  s = s.replace(duplicateButtons, singleButton);
  write(p, s);
}

{
  const p = "src/app/pages/DiceDuelGame.tsx";
  let s = read(p);
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '          {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  write(p, s);
}

{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);
  s = s.replace('  | "idle"\n  | "searching"', '  | "ready"\n  | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '            {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  const headerDuplicate = '            <div className="min-w-0 flex items-center gap-[6px]">\n              <span className="text-sm text-gray-500 whitespace-nowrap">Reaction Tap - Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>\n            </div>\n';
  s = s.replace(headerDuplicate, '            <div></div>\n');
  if (!s.includes('const [feeRate, setFeeRate]')) {
    const marker = '  const myUsername   = identity.username;';
    s = s.replace(marker, '  const myUsername   = identity.username;\n  const [feeRate, setFeeRate] = useState(0);\n  useEffect(() => { gameMatchmakingService.getGameConfig("reaction_tap").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);');
  }
  s = s.replace('  const winnerPayout    = Number(winAmount || 0) || 0;', '  const totalPoolDisplay = matchId ? stakeAmount * 2 : stakeAmount;\n  const winnerPayout    = Number(winAmount || (feeRate > 0 ? stakeAmount * (1 - feeRate) : 0)) || 0;');
  s = s.replace('{formatCurrencyNoDecimals(stakeAmount * 2)}', '{formatCurrencyNoDecimals(totalPoolDisplay)}');
  write(p, s);
}

{
  const p = "src/app/hooks/useGlobalGameMonitor.tsx";
  let s = read(p);
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_win",[\s\S]*?\n\s*\);/g, "");
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_loss",[\s\S]*?\n\s*\);/g, "");
  write(p, s);
}

{
  const p = "src/app/components/SpinBattleGameplay.tsx";
  let s = read(p);
  s = s.replace('const potentialWin=Math.floor(lobbyState.totalPool*.9);', 'const potentialWin=lobbyState.totalPool*(1-(lobbyState.feeRate??0));');
  write(p, s);
}

for (const p of ["src/app/pages/PvPCoinFlipGame.tsx", "src/app/pages/DiceDuelGame.tsx", "src/app/pages/ReactionTapGameRoom.tsx"]) {
  let s = read(p).replace(/\}, 2000\);/g, '}, 500);');
  write(p, s);
}

console.log("Applied gameplay flow v3.");
