import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);
  s = s.replace('type GameState = "idle" | "searching"', 'type GameState = "ready" | "searching"');
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  s = s.replace('setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());', 'setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());');
  s = s.replace('const gameOpponentAvatar = md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;', 'const gameOpponentAvatar = md.opponent?.avatar ?? md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;');
  if (!s.includes('getGameConfig("pvp_coinflip")')) {
    const marker = '  const myUsername = identity.username;';
    s = s.replace(marker, `${marker}\n\n  useEffect(() => { gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);`);
  }
  if (!s.includes('Search as SearchIcon')) {
    s = s.replace('import { ArrowLeft, Info, Shield } from "lucide-react";', 'import { ArrowLeft, Info, Shield, Search as SearchIcon } from "lucide-react";');
  }
  const oldSearch = '{gameState === "idle" && (\n              <div className="text-center">\n                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}';
  const newSearch = '{gameState === "ready" && (\n              <div className="text-center">\n                <Button\n                  onClick={startSearch}\n                  variant="outline"\n                  className="h-8 px-3 rounded-full bg-transparent !bg-transparent border-gray-400/70 dark:border-gray-600/70 text-sm font-medium text-gray-700 dark:text-gray-300 hover:!bg-transparent"\n                >\n                  <SearchIcon className="h-3.5 w-3.5 mr-1.5" />\n                  Search\n                </Button>\n                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">Stake are deducted when opponent is found</div>\n              </div>\n            )}';
  s = s.replace(oldSearch, newSearch);
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
