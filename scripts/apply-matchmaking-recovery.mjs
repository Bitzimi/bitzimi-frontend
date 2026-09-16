import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

// Recovery coordinator lives inside the existing router tree and renders nothing.
// It only redirects an already-active backend queue/match back into the existing game page.
{
  const p = "src/app/routes.tsx";
  let s = read(p);
  if (!s.includes('import { MatchmakingRecovery } from "./components/MatchmakingRecovery";')) {
    s = s.replace(
      'import { lazy, Suspense } from "react";\n',
      'import { lazy, Suspense } from "react";\nimport { MatchmakingRecovery } from "./components/MatchmakingRecovery";\n'
    );
  }
  s = s.replace(
    'function RootLayout() {\n  return <Outlet />;\n}',
    'function RootLayout() {\n  return <>\n    <MatchmakingRecovery />\n    <Outlet />\n  </>;\n}'
  );
  write(p, s);
}

// Coin Flip: preserve its current UI/game flow, adding only backend recovery and a lease heartbeat.
{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);

  if (!s.includes('const recoverySearch = searchParams.get("recovery") === "search";')) {
    s = s.replace(
      '  const privateMatchId = searchParams.get("matchId");\n',
      '  const privateMatchId = searchParams.get("matchId");\n  const recoverySearch = searchParams.get("recovery") === "search";\n'
    );
  }

  const marker = '\n  const handleSearchNewOpponent = () => {';
  if (!s.includes('Matchmaking recovery — resume the existing backend search')) {
    const recoveryBlock = `
  // Matchmaking recovery — resume the existing backend search without creating a new queue.
  useEffect(() => {
    if (!recoverySearch || gameState !== "idle") return;
    void handleSearch(true);
  }, [recoverySearch, gameState, handleSearch]);

  // Active-search lease heartbeat. If the browser/network disappears, the backend lease expires.
  useEffect(() => {
    if (!queueId || gameState !== "searching") return;
    let stopped = false;
    const beat = () => {
      void gameMatchmakingService.heartbeatQueue(queueId).then(result => {
        if (!stopped && result.status === "matched" && result.matchId && pollRef.current) {
          clearInterval(pollRef.current);
        }
      }).catch(() => {});
    };
    beat();
    const heartbeat = setInterval(beat, 5000);
    return () => { stopped = true; clearInterval(heartbeat); };
  }, [queueId, gameState]);
`;
    if (!s.includes(marker)) throw new Error("Coin Flip recovery insertion marker not found");
    s = s.replace(marker, `${recoveryBlock}${marker}`);
  }

  write(p, s);
}

// Reaction Tap: its existing build-time UI/flow transformation remains authoritative;
// this patch adds only recovery-search handling and the backend lease heartbeat.
{
  const p = "app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  if (!s.includes('const recoverySearch = searchParams.get("recovery") === "search";')) {
    s = s.replace(
      '  const roomCode = searchParams.get("roomCode");\n',
      '  const roomCode = searchParams.get("roomCode");\n  const recoverySearch = searchParams.get("recovery") === "search";\n'
    );
  }

  s = s.replace(
    '    if (privateMatchId) enterQueue(sid);',
    '    if (privateMatchId || recoverySearch) enterQueue(sid);'
  );

  if (!s.includes('Reaction Tap active-search lease heartbeat')) {
    const marker = '\n  // ── Handle tap ─────────────────────────────────────────────────────────────────';
    const heartbeatBlock = `
  // Reaction Tap active-search lease heartbeat. A lost page/network stops renewing the backend queue.
  useEffect(() => {
    if (!queueId || gameState !== "searching") return;
    let stopped = false;
    const beat = () => {
      void gameMatchmakingService.heartbeatQueue(queueId).catch(() => {});
    };
    beat();
    const heartbeat = setInterval(beat, 5000);
    return () => { stopped = true; clearInterval(heartbeat); };
  }, [queueId, gameState]);
`;
    if (!s.includes(marker)) throw new Error("Reaction Tap heartbeat insertion marker not found");
    s = s.replace(marker, `${heartbeatBlock}${marker}`);
  }

  write(p, s);
}
