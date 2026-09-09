import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

// Coin Flip: public gameplay starts in a ready state; Search is the only action
// that enters matchmaking. Load the authoritative fee before Search so the
// one-player pool/payout preview is correct without deducting anything.
{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);
  s = s.replace('type GameState = "idle" | "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  s = s.replace('setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());', 'setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());');
  s = s.replace('const gameOpponentAvatar = md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;', 'const gameOpponentAvatar = md.opponent?.avatar ?? md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;');
  if (!s.includes('getGameFeeConfig("pvp_coinflip")')) {
    const marker = '  const myUsername = identity.username;';
    s = s.replace(marker, `${marker}\n\n  useEffect(() => { gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);`);
  }
  s = s.replace('{gameState === "idle" && (\n              <div className="text-center">\n                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}', '{gameState === "ready" && (\n              <div className="text-center">\n                <Button onClick={startSearch} className="px-10 py-5 text-lg">Search</Button>\n                <div className="text-xs text-gray-500 mt-3">Your stake is deducted when you start searching.</div>\n              </div>\n            )}');
  write(p, s);
}

// Dice Clash: remove the duplicate idle/ready controls and make the explicit
// Search button call the real matchmaking function.
{
  const p = "src/app/pages/DiceDuelGame.tsx";
  let s = read(p);
  s = s.replace('type GameState = "ready" | "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '          {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  write(p, s);
}

// Reaction Tap: same explicit Search gate and exact Spin Battle-style header.
// Its pre-match pool is one stake; after a match is created the result payout is
// authoritative from the backend.
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

// Color Prediction's backend already creates the result notification. The global
// monitor may still be useful for balance/stats/toasts, but must not create a
// second notification record.
{
  const p = "src/app/hooks/useGlobalGameMonitor.tsx";
  let s = read(p);
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_win",[\s\S]*?\n\s*\);/g, "");
  s = s.replace(/\n\s*addNotifRef\.current\(\n\s*"game_loss",[\s\S]*?\n\s*\);/g, "");
  write(p, s);
}

// Spin Battle: never floor the real payout. Use the backend-provided fee rate
// for the pre-result estimate and keep the settled winnerPayout untouched.
{
  const p = "src/app/components/SpinBattleGameplay.tsx";
  let s = read(p);
  s = s.replace('const potentialWin=Math.floor(lobbyState.totalPool*.9);', 'const potentialWin=lobbyState.totalPool*(1-(lobbyState.feeRate??0));');
  write(p, s);
}

// Reaction/Dice/Coin 1v1 polling is deliberately fast once Search is pressed.
// The backend queue remains authoritative; this only reduces UI detection delay.
{
  for (const p of ["src/app/pages/PvPCoinFlipGame.tsx", "src/app/pages/DiceDuelGame.tsx", "src/app/pages/ReactionTapGameRoom.tsx"]) {
    let s = read(p).replace(/\}, 2000\);/g, '}, 500);');
    write(p, s);
  }
}

console.log("Applied gameplay flow v3.");
