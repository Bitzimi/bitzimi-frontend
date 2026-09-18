import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

// Final build-stage pass: remove frontend decisions that turn transient/backend
// matchmaking failures into route exits. Backend remains authoritative.

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);

  // Disable every automatic local-balance route gate. The backend decides whether
  // the stake can be accepted and whether a match can be created.
  s = s.replaceAll("if (balances.game < stakeAmount)", "if (false && balances.game < stakeAmount)");
  s = s.replaceAll("if (!privateMatchId && balances.game < stakeAmount)", "if (false && balances.game < stakeAmount)");

  s = s.replace(
    '      } catch {\n        if (!cancelled) navigate("/game/pvp-coinflip");\n      }',
    '      } catch {\n        if (!cancelled) {\n          setGameState("idle");\n          toast.error("Unable to reconnect to this match. Please try Search again.");\n        }\n      }'
  );

  // Automatic queue/result failures stay in the current game room.
  s = s.replaceAll(
    'navigate("/game/pvp-coinflip");',
    'setGameState("idle");\n      toast.error("Matchmaking session ended. Press Search to try again.");'
  );

  // Restore the legitimate Back to Stake Room action after the automatic-route pass.
  s = s.replace(
    '  const handleExit = () => {\n    if (roomCode) navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`);\n    else setGameState("idle");\n      toast.error("Matchmaking session ended. Press Search to try again.");\n  };',
    '  const handleExit = () => {\n    if (roomCode) navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`);\n    else navigate("/game/pvp-coinflip");\n  };'
  );

  write(p, s);
}

{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  s = s.replaceAll("Reaction Arena", "Tap Arena");
  s = s.replaceAll("if (balances.game < stakeAmount)", "if (false && balances.game < stakeAmount)");
  s = s.replaceAll("if (!privateMatchId && !recoverySearch && balances.game < stakeAmount)", "if (false && balances.game < stakeAmount)");

  s = s.replace(
    '    } catch { navigate("/game/reaction-tap"); }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);',
    '    } catch {\n      setGameState("idle");\n      setQueueId(null);\n      toast.error("Unable to start matchmaking. Please try Search again.");\n    }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);'
  );

  s = s.replace(
    '      } catch { navigate("/game/reaction-tap"); }',
    '      } catch {\n        setGameState("idle");\n        toast.error("Unable to reconnect to this match. Please try Search again.");\n      }'
  );

  // Automatic queue/recovery failures stay in the room. The user's Back button
  // remains the only normal route back to stake selection.
  s = s.replaceAll(
    'c("/game/reaction-tap")',
    'h("idle"); ce(null); H.error("Matchmaking session ended. Press Search to try again.")'
  );

  // Restore the legitimate Back to Stake Room action after the automatic-route pass.
  s = s.replace(
    '  const handleExit = useCallback(() => {\n    stopAllTimers();\n    if (roomCode) navigate(`/game/reaction-tap/private?roomCode=${roomCode}&stake=${stakeAmount}`);\n    else h("idle"); ce(null); H.error("Matchmaking session ended. Press Search to try again.");',
    '  const handleExit = useCallback(() => {\n    stopAllTimers();\n    if (roomCode) navigate(`/game/reaction-tap/private?roomCode=${roomCode}&stake=${stakeAmount}`);\n    else navigate("/game/reaction-tap");'
  );

  s = s.replace(
    'className="text-center flex flex-col items-center"',
    'className="text-center flex flex-col items-center justify-center"'
  );

  // Keep the active searching card vertically stacked: balance first, then the
  // purple finding-opponent animation.
  s = s.replace(
    '                  <div className="relative">\\n                    <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block mb-6">',
    '                  <div className="relative flex flex-col items-center">\\n                    <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block mb-6">'
  );

  write(p, s);
}

{
  const p = "src/app/pages/DiceDuelGame.tsx";
  let s = read(p);

  if (!s.includes('const recoverySearch = searchParams.get("recovery") === "search";')) {
    s = s.replace(
      '  const privateMatchId = searchParams.get("matchId");\n',
      '  const privateMatchId = searchParams.get("matchId");\n  const recoverySearch = searchParams.get("recovery") === "search";\n'
    );
  }

  s = s.replaceAll("if (balances.game < stake)", "if (false && balances.game < stake)");

  if (!s.includes("Dice Clash recovery — resume the existing backend search")) {
    const marker = '\n  useEffect(() => { if (privateMatchId) startSearch(); return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }; }, [privateMatchId]);';
    const recoveryBlock = `

  // Dice Clash recovery — resume the existing backend search/match identity.
  useEffect(() => {
    if (!recoverySearch || gameState !== "ready") return;
    void startSearch();
  }, [recoverySearch, gameState]);

  // Active-search lease heartbeat. Losing the page/network stops renewing the queue.
  useEffect(() => {
    if (!queueId || gameState !== "searching") return;
    const beat = () => { void gameMatchmakingService.heartbeatQueue(queueId).catch(() => {}); };
    beat();
    const heartbeat = setInterval(beat, 5000);
    return () => clearInterval(heartbeat);
  }, [queueId, gameState]);
`;
    if (!s.includes(marker)) throw new Error("Dice Clash recovery insertion marker not found");
    s = s.replace(marker, `${marker}${recoveryBlock}`);
  }

  const normalJoin = '      const result = await gameMatchmakingService.joinQueue("dice_clash", stake);';
  if (s.includes(normalJoin) && !s.includes('const result = recoverySearch')) {
    s = s.replace(
      normalJoin,
      '      const result = recoverySearch\n        ? await gameMatchmakingService.getActiveMatchmaking("dice_clash", stake)\n        : await gameMatchmakingService.joinQueue("dice_clash", stake);'
    );
  }

  if (!s.includes('if (recoverySearch && result.status === "none")')) {
    s = s.replace(
      '      if (result.status === "matched" && result.matchId)',
      '      if (recoverySearch && result.status === "none") {\n        setGameState("ready");\n        return;\n      }\n      if (result.status === "matched" && result.matchId)'
    );
  }

  s = s.replace(
    '    if (!matchData?.result) { navigate("/dice-duel/clash"); return; }',
    '    if (!matchData?.result) { setGameState("ready"); toast.error("Match data is not ready yet. Please try Search again."); return; }'
  );

  write(p, s);
}
