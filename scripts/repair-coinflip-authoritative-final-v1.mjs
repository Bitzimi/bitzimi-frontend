import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

// Coin Flip must not persist game/session/stat state in browser storage.
s = s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode/m, "\n\n  // Prevent double execution in React Strict Mode");
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m, "");
s = s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\]\);/m, "");
s = s.replace(/\n\s*localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g, "");

// Always use a single backend-timestamp-derived 17s presentation window:
// 0-12s = side assignment, 12-17s = coin flip, then reveal the already
// authoritative backend result. This also survives a page reload mid-match.
s = s.replace(/const \[animationDurationMs, setAnimationDurationMs\] = useState\([^;]+\);/, 'const [animationDurationMs, setAnimationDurationMs] = useState(17000);');

const marker = '  const assignSides = (md?: any) => {';
const assignStart = s.indexOf(marker);
if (assignStart < 0) throw new Error("Coin Flip assignSides marker not found");
const assignEnd = s.indexOf('  useEffect(() => {\n    if (!matchId) return;', assignStart);
if (assignEnd < 0) throw new Error("Coin Flip assignSides end marker not found");

const helpers = `  const getAuthoritativeElapsedMs = (md:any) => {\n    const startedAt = Date.parse(md?.createdAt ?? "");\n    const serverNow = Date.parse(md?.serverNow ?? "");\n    const now = Number.isFinite(serverNow) ? serverNow : Date.now();\n    return Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;\n  };\n\n  const applySettledResult = async (md:any) => {\n    const result = md?.result?.coinFlip as CoinSide | undefined;\n    if (!result) return;\n    const won = Boolean(md.youWon);\n    const name = md.opponent?.username ?? opponentName ?? "Player";\n    const avatar = md.opponent?.avatar ?? name.charAt(0).toUpperCase();\n    const winnings = Number(md.payout ?? 0);\n    setPlatformFee(Number(md.platformFee ?? 0));\n    setCoinResult(result);\n    setIsWinner(won);\n    setWinAmount(won ? winnings : 0);\n    setWinnerAvatar(won ? playerAvatar : avatar);\n    setWinnerName(won ? myUsername : name);\n    setGameState("showing_result");\n    if (!transactionRecorded.current) {\n      transactionRecorded.current = true;\n      await refreshWalletsFromBackend().catch(() => {});\n      addGameResult({ gameType:"pvp_coinflip", betAmount:stakeAmount, winAmount:won?winnings:0, profit:won?winnings-stakeAmount:-stakeAmount, won, opponent:name, outcome:result });\n    }\n    setShowWinner(true);\n    setShowResultPopup(true);\n  };\n\n  const scheduleCoinFlipTimeline = (md:any) => {\n    const elapsed = getAuthoritativeElapsedMs(md);\n    const SIDE_MS = 12000;\n    const FLIP_MS = 5000;\n    const TOTAL_MS = SIDE_MS + FLIP_MS;\n    setAnimationDurationMs(TOTAL_MS);\n    setAnimationElapsedMs(Math.min(TOTAL_MS, elapsed));\n    setPlayerSide(md.isPlayer1 ? md.result?.p1Side : md.result?.p2Side);\n    setOpponentSide(md.isPlayer1 ? md.result?.p2Side : md.result?.p1Side);\n    clearTimers();\n    if (elapsed < SIDE_MS) {\n      setGameState("side_assignment");\n      timersRef.current.push(setTimeout(() => scheduleCoinFlipTimeline(md), SIDE_MS - elapsed));\n      return;\n    }\n    if (elapsed < TOTAL_MS) {\n      setGameState("flipping");\n      setCoinResult(md.result?.coinFlip ?? null);\n      timersRef.current.push(setTimeout(() => scheduleCoinFlipTimeline(md), TOTAL_MS - elapsed));\n      return;\n    }\n    applySettledResult(md);\n  };\n\n`;

// Ensure timer helpers exist even when an earlier repair script changes their shape.
if (!/const timersRef = useRef/.test(s)) {
  s = s.replace(/  \/\/ Prevent double execution in React Strict Mode/, '  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);\n  const clearTimers = () => { for (const t of timersRef.current) clearTimeout(t); timersRef.current = []; };\n\n  // Prevent double execution in React Strict Mode');
}

const assignReplacement = `  const assignSides = (md?: any) => {\n    const data = md ?? matchData;\n    if (!data?.result) return;\n    scheduleCoinFlipTimeline(data);\n  };\n\n`;
s = s.slice(0, assignStart) + helpers + assignReplacement + s.slice(assignEnd);

const startMarker = '  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {';
const start = s.indexOf(startMarker);
if (start >= 0) {
  const end = s.indexOf('  const addToSessionHistory =', start);
  if (end < 0) throw new Error("Coin Flip startGame end marker not found");
  s = s.slice(0, start) + `  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {\n    if (!md?.result) return;\n    scheduleCoinFlipTimeline(md);\n  };\n\n` + s.slice(end);
}

// Session history is backend-only. Keep the existing state/UI contract but never write local state.
const historyStart = s.indexOf('  const addToSessionHistory =');
if (historyStart >= 0) {
  const exitStart = s.indexOf('  const handleExit =', historyStart);
  if (exitStart >= 0) {
    s = s.slice(0, historyStart) + `  const addToSessionHistory = (_record: Omit<SessionRecord, "id" | "timestamp">) => {\n    // History is loaded from the backend only.\n  };\n\n` + s.slice(exitStart);
  }
}

// Position the two top avatars by backend Home/Player1 vs Away/Player2, not by
// the logged-in user's identity. This makes the mapping generic for every player.
const playersStart = s.indexOf('          {/* Players */}');
const gameAreaStart = playersStart >= 0 ? s.indexOf('          {/* Game Area */}', playersStart) : -1;
if (playersStart >= 0 && gameAreaStart >= 0) {
  const players = `          {/* Players: left = backend Home/Player1, right = backend Away/Player2 */}\n          <div className="flex items-center justify-between mb-6">\n            {(() => {\n              const home = matchData?.isPlayer1 ? { name: myUsername, avatar: playerAvatar } : { name: opponentName, avatar: opponentAvatar };\n              const away = matchData?.isPlayer1 ? { name: opponentName, avatar: opponentAvatar } : { name: myUsername, avatar: playerAvatar };\n              return <>\n                <div className="flex flex-col items-center">\n                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">\n                    <PlayerAvatar avatar={home.avatar} />\n                  </div>\n                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{home.name}</div>\n                </div>\n                <div className="flex-1 mx-4 text-center">\n                  <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">\n                    Balance: {formatCurrencyNoDecimals(balances.game)}\n                  </div>\n                </div>\n                <div className="flex flex-col items-center">\n                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">\n                    <PlayerAvatar avatar={away.avatar} />\n                  </div>\n                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{away.name}</div>\n                </div>\n              </>;\n            })()}\n          </div>\n\n`;
  s = s.slice(0, playersStart) + players + s.slice(gameAreaStart);
}

fs.writeFileSync(path, s);
console.log("Applied final backend-result-authoritative Coin Flip timeline, avatar mapping, and storage cleanup.");
