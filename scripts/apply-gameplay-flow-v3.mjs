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

// Reaction Tap keeps its original UI/markup. Only its matchmaking entry state is
// adjusted here so Quick Match opens the full room in an idle state, matching the
// existing Coin Flip interaction pattern without redesigning the game room.
{
  const p = "app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  s = s.replace(
    'import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp } from "lucide-react";',
    'import { ArrowLeft, Zap, Trophy, AlertCircle, Clock, TrendingUp, Search } from "lucide-react";'
  );

  s = s.replace(
    'type GameState =\n  | "searching"',
    'type GameState =\n  | "idle"            // room opened, waiting for the user to start matchmaking\n  | "searching"'
  );

  s = s.replace(
    'const [gameState,        setGameState]        = useState<GameState>("searching");',
    'const [gameState,        setGameState]        = useState<GameState>(privateMatchId ? "searching" : "idle");'
  );

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

  const idleMarkup = `            {/* Idle — same Reaction Tap room, matchmaking starts only after Search */}
            {gameState === "idle" && (
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
                <div className="relative p-12 sm:p-16 text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                  <div className="relative">
                    <div className="text-center flex flex-col items-center">
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
