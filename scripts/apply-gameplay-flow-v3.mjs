import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

{
  const p = "src/app/pages/DiceDuelGame.tsx";
  let s = read(p);
  s = s.replace('useState<GameState>("idle")', 'useState<GameState>("ready")');
  const idle = '          {gameState === "idle" && (\n              <div className="text-center"><Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button></div>\n            )}\n\n';
  s = s.replace(idle, '');
  write(p, s);
}

// Reaction Tap keeps its original UI/markup and gameplay. Build-time changes only
// align its room entry and surrounding chrome with the established Coin Flip pattern.
{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  s = s.replace(
    'import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp } from "lucide-react";',
    'import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, Search, Info } from "lucide-react";'
  );

  s = s.replace(
    'type GameState =\n  | "searching"',
    'type GameState =\n  | "idle"            // room opened, waiting for the user to start matchmaking\n  | "searching"'
  );

  s = s.replace(
    'const [gameState,        setGameState]        = useState<GameState>("searching");',
    'const [gameState,        setGameState]        = useState<GameState>(privateMatchId ? "searching" : "idle");'
  );

  if (!s.includes('const [matchData,        setMatchData]')) {
    s = s.replace(
      'const [matchId,          setMatchId]          = useState<string | null>(null);',
      'const [matchId,          setMatchId]          = useState<string | null>(null);\n  const [matchData,        setMatchData]        = useState<MatchResult | null>(null);'
    );
  }

  if (!s.includes('const [showRules,       setShowRules]')) {
    s = s.replace(
      'const [walletAnimation,  setWalletAnimation]  = useState(false);',
      'const [walletAnimation,  setWalletAnimation]  = useState(false);\n  const [showRules,       setShowRules]       = useState(false);'
    );
  }

  const handleSearchBlock = `
  // ── Explicit matchmaking trigger ─────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (gameState !== "idle") return;
    setGameState("searching");
    void enterQueue(sessionId.current);
  }, [gameState, enterQueue]);
`;

  s = s.replace(
    '\n  // ── Mount: balance check + enter queue ────────────────────────────────────────\n',
    `${handleSearchBlock}\n  // ── Mount: balance check + enter queue ────────────────────────────────────────\n`
  );

  s = s.replace(
    '    const sid = sessionId.current;\n    enterQueue(sid);\n    return () => stopAllTimers();',
    '    const sid = sessionId.current;\n    // Private matches enter their pre-created room immediately. Quick Match waits\n    // for the user to press Search in the already-open game room.\n    if (privateMatchId) enterQueue(sid);\n    return () => stopAllTimers();'
  );

  s = s.replaceAll(
    'setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());',
    'setOpponentAvatar(match.opponent.avatar || match.opponent.username.charAt(0).toUpperCase());'
  );

  s = s.replaceAll(
    'setMatchId(privateMatchId);\n        setOpponentName(match.opponent.username);',
    'setMatchId(privateMatchId);\n        setMatchData(match);\n        setOpponentName(match.opponent.username);'
  );
  s = s.replaceAll(
    'setMatchId(res.matchId);\n        setOpponentName(match.opponent.username);',
    'setMatchId(res.matchId);\n        setMatchData(match);\n        setOpponentName(match.opponent.username);'
  );
  s = s.replaceAll(
    'setMatchId(status.matchId);\n              setOpponentName(match.opponent.username);',
    'setMatchId(status.matchId);\n              setMatchData(match);\n              setOpponentName(match.opponent.username);'
  );
  s = s.replace(
    '    const voided     = match.status === "cancelled";\n',
    '    setMatchData(match);\n\n    const voided     = match.status === "cancelled";\n'
  );

  // Use the same three-column card semantics as Coin Flip: Bet | Pool | Winner.
  // Before a match exists, Pool and Winner remain $0. Once a match exists, values
  // come from the backend match response; no pool/payout arithmetic is performed here.
  const oldStatsPattern = /            \{\/\* Stats bar \*\/\}\n            <Card className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">[\s\S]*?            <\/Card>\n\n            \{\/\* Searching \*\/\}/;
  const newStatsBlock = `            {/* Stats bar — same structure and state semantics as Coin Flip */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-2 divide-x divide-gray-200 dark:divide-gray-700">
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Bet</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(matchData?.stake ?? stakeAmount)}</div>
                  </div>
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Pool</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals(matchData?.totalPool ?? 0)}</div>
                  </div>
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Winner</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">{formatCurrencyNoDecimals((matchData as any)?.winnerPayout ?? matchData?.payout ?? 0)}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Searching */}`;
  s = s.replace(oldStatsPattern, newStatsBlock);

  // Replace only the surrounding Reaction Tap header chrome. The game title/stake
  // identity remains intact; unlike Coin Flip, Reaction Tap has no fairness action.
  const oldHeaderPattern = /        \{\/\* Header \*\/\}[\s\S]*?        <\/div>\n\n        \{\/\* Main \*\/\}/;
  const newHeaderBlock = `        {/* Header — clean Coin Flip-style chrome, without fairness verification */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleExit}
              className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Back to stake room</span>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-[6px]">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Tap Arena</h1>
              <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowRules(!showRules)}
              className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 rounded-lg transition-all shrink-0">
              <Info className="h-4 w-4 mr-2" />Rules
            </Button>
          </div>
          {showRules && (
            <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Play</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                  <li>Wait for the match to be created and both players to be ready.</li>
                  <li>Do not tap before the signal appears — an early tap is recorded as an early loss.</li>
                  <li>When <strong>TAP NOW</strong> appears, tap as quickly as you can.</li>
                  <li>The backend compares both submitted reaction times and determines the winner.</li>
                  <li>The winner receives the backend-calculated payout after the platform fee.</li>
                  <li>If the round is voided because both players tap early, the stakes are refunded.</li>
                </ul>
              </div>
            </Card>
          )}
        </div>

        {/* Main */}`;
  s = s.replace(oldHeaderPattern, newHeaderBlock);

  // Room Activity stays functional; only the decorative icon and second-line stake
  // label are removed so the title and stake room share one clean line.
  const oldActivityHeader = /              <div className="p-4 border-b border-gray-200 dark:border-gray-800">\n                <div className="flex items-center gap-2">\n                  <TrendingUp className="h-5 w-5 text-gray-600 dark:text-gray-400" \/>\n                  <h3 className="font-bold text-gray-900 dark:text-white">Room Activity<\/h3>\n                <\/div>\n                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">\{formatCurrencyNoDecimals\(stakeAmount\)\} Stake Room<\/p>\n              <\/div>/;
  const newActivityHeader = `              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">Room Activity</h3>
                  <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatCurrencyNoDecimals(stakeAmount)} Stake Room</span>
                </div>
              </div>`;
  s = s.replace(oldActivityHeader, newActivityHeader);

  const idleMarkup = `            {/* Idle — same Reaction Tap room, matchmaking starts only after Search */}
            {gameState === "idle" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-12 sm:p-16 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                  <div className="relative">
                    <div className="text-center flex flex-col items-center">
                      <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block mb-6">Balance: {formatCurrencyNoDecimals(balances.game)}</div>
                      <Button
                        variant="outline"
                        onClick={handleSearch}
                        className="rounded-full px-8 py-3 text-base font-semibold border-gray-600 dark:border-gray-500 bg-transparent text-gray-900 dark:text-white hover:bg-gray-800/50 dark:hover:bg-gray-800/70 flex items-center gap-3"
                      >
                        <Search className="h-6 w-6" />Search
                      </Button>
                      <p className="text-base text-gray-600 dark:text-gray-300 mt-6">Matching you with a skilled competitor...</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

`;

  s = s.replace(
    '            {/* Searching */}\n',
    idleMarkup + '            {/* Searching */}\n'
  );

  // Keep the live Game Wallet balance inside the actual gameplay card, matching the
  // Coin Flip placement between the two players. No header balance card is used.
  s = s.replace(
    '                    <div className="text-center bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl py-3 px-4">',
    '                    <div className="text-center mb-4"><div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div>\n                    <div className="text-center bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-xl py-3 px-4">'
  );
  s = s.replace(
    '                  <div className="text-center py-8 sm:py-12">\n                    <p className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-6 uppercase tracking-widest">Get Ready</p>',
    '                  <div className="text-center mb-4"><div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div>\n                  <div className="text-center py-8 sm:py-12">\n                    <p className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-6 uppercase tracking-widest">Get Ready</p>'
  );
  s = s.replace(
    '                  <div className="text-center py-8 sm:py-12">\n                    <p className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white mb-8">WAIT...</p>',
    '                  <div className="text-center mb-4"><div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div>\n                  <div className="text-center py-8 sm:py-12">\n                    <p className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white mb-8">WAIT...</p>'
  );
  s = s.replace(
    '                  <div className="py-4 sm:py-6">\n                    <Button onClick={handleTap}',
    '                  <div className="text-center mb-4"><div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div>\n                  <div className="py-4 sm:py-6">\n                    <Button onClick={handleTap}'
  );

  // Searching card gets the same compact in-game balance treatment as Coin Flip.
  s = s.replace(
    '                  <div className="relative flex flex-col items-center">\n                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20',
    '                  <div className="relative">\n                    <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block mb-6">Balance: {formatCurrencyNoDecimals(balances.game)}</div>\n                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20'
  );

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

for (const p of ["src/app/pages/DiceDuelGame.tsx", "src/app/pages/ReactionTapGameRoom.tsx"]) {
  let s = read(p).replace(/\}, 2000\);/g, '}, 500);');
  write(p, s);
}

console.log("Applied gameplay flow v3.");
