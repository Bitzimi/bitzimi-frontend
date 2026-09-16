import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

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

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);
  if (!s.includes('const recoverySearch = searchParams.get("recovery") === "search";')) {
    s = s.replace(
      '  const privateMatchId = searchParams.get("matchId");\n',
      '  const privateMatchId = searchParams.get("matchId");\n  const recoverySearch = searchParams.get("recovery") === "search";\n'
    );
  }
  s = s.replace(
    '    if (balances.game < stakeAmount) {\n      toast.error("Insufficient balance in Game Wallet");\n      navigate("/game/pvp-coinflip");\n      return;\n    }',
    '    if (!privateMatchId && balances.game < stakeAmount) {\n      toast.error("Insufficient balance in Game Wallet");\n      navigate("/game/pvp-coinflip");\n      return;\n    }'
  );
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
    const beat = () => { void gameMatchmakingService.heartbeatQueue(queueId).catch(() => {}); };
    beat();
    const heartbeat = setInterval(beat, 5000);
    return () => clearInterval(heartbeat);
  }, [queueId, gameState]);
`;
    if (!s.includes(marker)) throw new Error("Coin Flip recovery insertion marker not found");
    s = s.replace(marker, `${recoveryBlock}${marker}`);
  }
  write(p, s);
}

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
    '    if (balances.game < stakeAmount) {\n      toast.error("Insufficient balance in Game Wallet");\n      navigate("/game/reaction-tap");\n      return;\n    }',
    '    if (!privateMatchId && !recoverySearch && balances.game < stakeAmount) {\n      toast.error("Insufficient balance in Game Wallet");\n      navigate("/game/reaction-tap");\n      return;\n    }'
  );
  s = s.replace(
    '    if (privateMatchId) enterQueue(sid);',
    '    if (privateMatchId || recoverySearch) enterQueue(sid);'
  );

  if (!s.includes('const recoverActiveMatch = useCallback')) {
    const marker = '\n  // ── Enter matchmaking queue ────────────────────────────────────────────────────';
    const recoveryFunction = `
  // Re-enter an already-created Reaction Tap match at its backend-authoritative phase.
  const recoverActiveMatch = useCallback((sid: string, match: MatchResult) => {
    if (sessionId.current !== sid) return;
    setMatchId(match.matchId);
    matchIdRef.current = match.matchId;
    isPlayer1Ref.current = Boolean(match.isPlayer1);
    setOpponentName(match.opponent.username);
    setOpponentAvatar(match.opponent.avatar || match.opponent.username.charAt(0).toUpperCase());

    if (match.signalSentAt) {
      const signalAt = new Date(match.signalSentAt).getTime();
      signalSentAtRef.current = signalAt;
      if (signalAt <= Date.now()) {
        setGameState("signal_shown");
        liveTimerRef.current = setInterval(() => {
          if (sessionId.current !== sid) { clearInterval(liveTimerRef.current!); return; }
          if (signalSentAtRef.current) setLiveReactionTime(Date.now() - signalSentAtRef.current);
        }, 10);
      } else {
        startWaitingPhase(sid, signalAt);
      }
      return;
    }

    setGameState("matched");
    const elapsed = Math.max(0, Date.now() - match.lifecycleStartedAt);
    const remainingCountdown = Math.max(0, 5000 - elapsed);
    if (match.yourReady || match.opponentReady || remainingCountdown === 0) {
      void startSignalingPhase(sid, match.matchId);
    } else {
      setTimeout(() => {
        if (sessionId.current === sid) void startSignalingPhase(sid, match.matchId);
      }, remainingCountdown);
    }
  }, [startSignalingPhase, startWaitingPhase]);
`;
    if (!s.includes(marker)) throw new Error("Reaction Tap recovery insertion marker not found");
    s = s.replace(marker, `${recoveryFunction}${marker}`);
  }

  const privateBlockWithData = '        setMatchId(privateMatchId);\n        setMatchData(match);\n        setOpponentName(match.opponent.username);\n        setOpponentAvatar(match.opponent.avatar || match.opponent.username.charAt(0).toUpperCase());\n        setGameState("matched");\n        setTimeout(() => startCountdown(sid, privateMatchId, match.isPlayer1 ?? true), 2000);\n        return;';
  s = s.replace(privateBlockWithData, '        recoverActiveMatch(sid, match);\n        return;');
  s = s.replace(
    '  }, [stakeAmount, navigate, startCountdown, privateMatchId]);',
    '  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);'
  );

  if (!s.includes('Reaction Tap active-search lease heartbeat')) {
    const marker = '\n  // ── Handle tap ─────────────────────────────────────────────────────────────────';
    const heartbeatBlock = `
  // Reaction Tap active-search lease heartbeat. A lost page/network stops renewing the backend queue.
  useEffect(() => {
    if (!queueId || gameState !== "searching") return;
    const beat = () => { void gameMatchmakingService.heartbeatQueue(queueId).catch(() => {}); };
    beat();
    const heartbeat = setInterval(beat, 5000);
    return () => clearInterval(heartbeat);
  }, [queueId, gameState]);
`;
    if (!s.includes(marker)) throw new Error("Reaction Tap heartbeat insertion marker not found");
    s = s.replace(marker, `${heartbeatBlock}${marker}`);
  }
  write(p, s);
}
