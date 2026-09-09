import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, from, to, label = from.slice(0, 80)) {
  const s = read(path);
  if (!s.includes(from)) throw new Error(`${path}: target not found: ${label}`);
  write(path, s.replace(from, to));
}
function replaceRegex(path, re, to, label) {
  const s = read(path);
  const next = s.replace(re, to);
  if (next === s) throw new Error(`${path}: regex target not found: ${label}`);
  write(path, next);
}

// Shared game config endpoint: use the backend's authoritative admin fee for
// every UI payout estimate instead of hardcoding 10% in individual pages.
{
  const path = "src/app/services/gameMatchmakingService.ts";
  let s = read(path);
  s = s.replace(
    'export interface QueueResult{status:"waiting"|"matched"|"cancelled";queueId?:string;matchId?:string;}\n',
    'export interface QueueResult{status:"waiting"|"matched"|"cancelled";queueId?:string;matchId?:string;}\nexport interface GameConfig{gameType:string;feeRate:number;feePercent:number;stakes:number[];}\n'
  );
  s = s.replace(
    'export interface MatchResult{matchId:string;gameType:string;stake:number;totalPool:number;platformFee:number;status:"active"|"settled"|"cancelled";opponent:{username:string;userId:string};',
    'export interface MatchResult{matchId:string;gameType:string;stake:number;totalPool:number;platformFee:number;status:"active"|"settled"|"cancelled";opponent:{username:string;userId:string;avatar?:string|null};'
  );
  s = s.replace(
    ' async getMatch(matchId:string):Promise<MatchResult>{return apiFetch(`/api/v1/games/matches/${matchId}`);},',
    ' async getMatch(matchId:string):Promise<MatchResult>{return apiFetch(`/api/v1/games/matches/${matchId}`);},\n async getGameConfig(gameType:string):Promise<GameConfig>{return apiFetch(`/api/v1/games/config/${encodeURIComponent(gameType)}`);},'
  );
  write(path, s);
}

// Coin Flip: entering the page is idle. Only Search starts matchmaking.
// The config request still warms the backend and loads the real fee for the
// pre-match payout estimate without deducting any stake.
{
  const path = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(path);
  s = s.replace('type GameState = "searching" |', 'type GameState = "idle" | "searching" |');
  s = s.replace('  opponent: string;\n  result:', '  opponent: string;\n  opponentAvatar?: string | null;\n  result:');
  s = s.replace('const PLATFORM_FEE_PERCENT = 10; // 10% platform fee — display only; backend calculates the actual fee\n\n', '');
  s = s.replace('  const myUsername = identity.username;\n\n  const [gameState', '  const myUsername = identity.username;\n  const [feeRate, setFeeRate] = useState<number>(0);\n\n  const [gameState');
  s = s.replace('useState<GameState>("searching")', 'useState<GameState>("idle")');
  s = s.replace('  useEffect(() => {\n    if (hasStarted.current) return;', '  useEffect(() => {\n    if (privateMatchId) return;\n    gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {});\n  }, [privateMatchId]);\n\n  useEffect(() => {\n    if (hasStarted.current || gameState !== "searching") return;');
  s = s.replace('  }, []);\n\n  const assignSides', '  }, [gameState]);\n\n  const assignSides');
  s = s.replaceAll('setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());', 'setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());');
  s = s.replace('  const totalPot = stakeAmount * 2;\n  const winnerGets = Number(matchData?.payout ?? 0);', '  const totalPot = Number(matchData?.totalPool ?? stakeAmount);\n  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));\n  const feePercent = feeRate * 100;');
  s = s.replace('        addToSessionHistory({\n          opponent: gameOpponentName, result:', '        addToSessionHistory({\n          opponent: gameOpponentName, opponentAvatar: gameOpponentAvatar, result:');
  // Backend notification is authoritative for 1v1 games; do not create a second local notification.
  s = s.replace(/\n\s*addNotification\(\n\s*won \? "game_win"[\s\S]*?\n\s*\{ game: "coin_flip", stake: stakeAmount, payout: won \? winnings : 0, outcome: result \}\n\s*\);/, '');
  s = s.replace('            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Session History (${stakeAmount} Stake)</h3>', '            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Your History (${stakeAmount} Stake)</h3>');
  s = s.replace('                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center text-sm overflow-hidden">\n                      {/* Win → current user avatar from identity; Loss → opponent initial derived from name */}\n                      <PlayerAvatar avatar={record.result === "win" ? identity.avatar : record.opponent.charAt(0).toUpperCase()} />\n                    </div>\n                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${', '                    <div className="flex items-center gap-1.5">\n                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden"><PlayerAvatar avatar={identity.avatar} /></div>\n                      <span className="text-[11px] text-gray-500">You</span>\n                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${');
  s = s.replace('                    <span className="text-xs text-gray-600 dark:text-gray-400">{record.result === "win" ? myUsername : record.opponent}</span>\n                    <span className="text-xs text-gray-500">• {record.outcome.toUpperCase()}</span>', '                    <span className="text-xs text-gray-600 dark:text-gray-400">{myUsername}</span>\n                    <span className="text-xs text-gray-500">vs</span>\n                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden"><PlayerAvatar avatar={record.opponentAvatar ?? record.opponent.charAt(0).toUpperCase()} /></div>\n                    <span className="text-xs text-gray-600 dark:text-gray-400">{record.opponent}</span>\n                    <span className="text-xs text-gray-500">• {record.outcome.toUpperCase()}</span>');
  s = s.replace('                  {formatCurrencyNoDecimals(record.amount)}', '                  {record.result === "win" ? "+" : "-"}{formatCurrencyNoDecimals(record.amount)}');
  s = s.replace('Platform fee: {PLATFORM_FEE_PERCENT}% • Winner receives: {formatCurrencyNoDecimals(totalPot - Math.floor(totalPot * (PLATFORM_FEE_PERCENT / 100)))}', 'Platform fee: {feePercent}% • Winner receives: {formatCurrencyNoDecimals(winnerGets)}');
  s = s.replace('{isWinner && (\n                <div className="text-xs text-gray-600 dark:text-gray-500 mt-2">\n                  Winnings: {formatCurrencyNoDecimals(winAmount)} (after {PLATFORM_FEE_PERCENT}% fee)\n                </div>\n              )}', '{isWinner && (\n                <div className="text-xs text-gray-600 dark:text-gray-500 mt-2">\n                  Winnings: {formatCurrencyNoDecimals(winAmount)} (after {feePercent}% fee)\n                </div>\n              )}');
  // Search button is the only entry point into public matchmaking.
  s = s.replace('            {/* Searching State */}\n            {gameState === "searching" && (', '            {/* Idle State — no search or stake deduction until the user presses Search */}\n            {gameState === "idle" && (\n              <div className="text-center">\n                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>\n              </div>\n            )}\n\n            {/* Searching State */}\n            {gameState === "searching" && (');
  // Add Search for New Opponent beside Back to Stake Selection.
  s = s.replace('                Back to Stake Selection\n              </Button>\n            </div>', '                Back to Stake Selection\n              </Button>\n              <Button\n                onClick={() => { setShowResultPopup(false); navigate(`/game/pvp-coinflip/play?stake=${stakeAmount}`); }}\n                className="w-full mt-2"\n              >\n                Search for New Opponent\n              </Button>\n            </div>');
  write(path, s);
}

// Dice Clash + Reaction Tap: same idle -> Search flow; backend remains the only
// place that deducts the stake once a real match is created.
for (const [path, gameType, returnPath] of [
  ["src/app/pages/DiceDuelGame.tsx", "dice_clash", "/dice-duel/clash"],
  ["src/app/pages/ReactionTapGameRoom.tsx", "reaction_tap", "/game/reaction-tap"],
]) {
  let s = read(path);
  s = s.replace(/type GameState =\n\s*\| "searching"/, 'type GameState =\n  | "idle"\n  | "searching"');
  s = s.replace('useState<GameState>("searching")', 'useState<GameState>("idle")');
  // Make the existing mount/queue effect wait for explicit Search, while private matches still load immediately.
  s = s.replace(/const sid = sessionId\.current;\n\s*enterQueue\(sid\);/, 'const sid = sessionId.current;\n    if (privateMatchId || gameState === "searching") enterQueue(sid);');
  s = s.replace('  }, []); // eslint-disable-line react-hooks/exhaustive-deps', '  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps', 1);
  if (path.includes("ReactionTapGameRoom")) {
    s = s.replace('  const { identity } = useIdentity();', '  const { identity } = useIdentity();\n\n  useEffect(() => { gameMatchmakingService.getGameConfig("reaction_tap").catch(() => {}); }, []);');
    s = s.replace(/\n\s*addNotification\("system_alert", "Round Voided"[\s\S]*?\);/, '');
    s = s.replace(/\n\s*addNotification\("game_win"[\s\S]*?\{ game: "reaction_tap", stake: stakeAmount, payout, opponent: opponentName \}\);/, '');
    s = s.replace(/\n\s*addNotification\("game_loss"[\s\S]*?\{ game: "reaction_tap", stake: stakeAmount, opponent: opponentName \}\);/, '');
  } else {
    s = s.replace(/\n\s*addNotification\([\s\S]*?\{ game: "dice_clash"[\s\S]*?\}\);/, '');
    s = s.replace('  // Platform fee calculations\n  const PLATFORM_FEE_PERCENT = 0.1; // 10%\n  const totalPool = stake * 2;\n  const platformFee = totalPool * PLATFORM_FEE_PERCENT;\n  const winnerPayout = totalPool - platformFee;', '  const [feeRate, setFeeRate] = useState(0);\n  useEffect(() => { gameMatchmakingService.getGameConfig("dice_clash").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);\n  const totalPool = stake;\n  const platformFee = totalPool * feeRate;\n  const winnerPayout = totalPool * (1 - feeRate);');
  }
  // Search button inserted immediately before existing searching panel.
  const marker = '{gameState === "searching" && (';
  if (s.includes(marker)) {
    s = s.replace(marker, '{gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n            ' + marker);
  }
  // Prevent local pvp notification duplicates in Dice Clash if any remained.
  s = s.replace(/\n\s*const \{ addNotification \} = useNotifications\(\);/, '');
  write(path, s);
}

// Remove local Color-game notification generation: the backend transaction is
// already authoritative and creates the single result notification.
{
  const path = "src/app/hooks/useGlobalGameMonitor.tsx";
  let s = read(path);
  s = s.replace(/\n\s*addNotification\("game_win"[\s\S]*?\);/g, "");
  s = s.replace(/\n\s*addNotification\("game_loss"[\s\S]*?\);/g, "");
  write(path, s);
}

// Spin Battle: preserve the actual backend payout value and never floor it.
// The backend snapshot already exposes the authoritative fee rate after this fix.
for (const path of ["src/app/pages/SpinBattle.tsx", "src/app/components/SpinBattleGameplay.tsx"]) {
  let s = read(path);
  s = s.replace(/Math\.floor\(lobbyState\.totalPool \* 0\.9\)/g, '(lobbyState.totalPool * (1 - (lobbyState.feeRate ?? 0)))');
  s = s.replace(/Math\.floor\(parsedBet \* 2 \* 0\.9\)/g, '(parsedBet * 2 * (1 - (lobbyState.feeRate ?? 0)))');
  write(path, s);
}

// Dice Royale / Arena: remove hardcoded 10% display calculations. Their live
// round result remains authoritative; pre-result estimates use backend config.
for (const [path, gameType] of [
  ["src/app/pages/DiceRoyaleGame.tsx", "dice_royale"],
  ["src/app/pages/DiceArenaGame.tsx", "dice_arena"],
]) {
  let s = read(path);
  s = s.replace('  const PLATFORM_FEE_PERCENT = 0.1;', '  const [feeRate, setFeeRate] = useState(0);\n  useEffect(() => { gameMatchmakingService.getGameConfig("' + gameType + '").then(c => setFeeRate(Number(c.feeRate) || 0)).catch(() => {}); }, []);');
  s = s.replace(/totalPool \* PLATFORM_FEE_PERCENT/g, 'totalPool * feeRate');
  s = s.replace(/\(prizePool \* 0\.60\)/g, '(prizePool * 0.60)');
  s = s.replace(/PLATFORM_FEE_PERCENT/g, '(feeRate * 100)');
  // Do not auto-join. These pages already expose their Join button; keep the
  // round polling so the page can show the live round before the user joins.
  write(path, s);
}

// Header normalizer: keep the second row's right-side control, but remove only
// the duplicated game title/stake on the left for Coin Flip, Dice Clash and
// Reaction Tap. Everything else in those headers stays in place.
{
  const path = "scripts/normalize-game-play-headers.mjs";
  let s = read(path);
  s = s.replace(
    '${indent}  <div className="min-w-0 flex items-center gap-[6px]">\n${indent}    <span className="text-sm text-gray-500 whitespace-nowrap">${title} - Stake Room \\{formatCurrencyNoDecimals(${stake})\\}</span>\n${indent}  </div>\n${indent}  <div className="flex items-center justify-end">${fairness}</div>',
    '${indent}  <div></div>\n${indent}  <div className="flex items-center justify-end">${fairness}</div>'
  );
  s = s.replace(
    '            <div className="min-w-0 flex items-center gap-[6px]">\n              <span className="text-sm text-gray-500 whitespace-nowrap">Reaction Tap - Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>\n            </div>\n            <div className="flex items-center justify-end">\n              <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)} className="shrink-0">',
    '            <div></div>\n            <div className="flex items-center justify-end">\n              <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)} className="shrink-0">'
  );
  write(path, s);
}

console.log("Cross-gameplay fixes applied.");
