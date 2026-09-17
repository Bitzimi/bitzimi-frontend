import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

// Final build-stage pass: remove frontend decisions that turn transient/backend
// matchmaking failures into route exits. Backend remains authoritative.

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);

  s = s.replace(/\s*if \((?:!privateMatchId && )?balances\.game < stakeAmount\) \{\s*toast\.error\("Insufficient balance in Game Wallet"\);\s*navigate\("\/game\/pvp-coinflip"\);\s*return;\s*\}/g,
    "\n    // Backend is authoritative for stake availability and match creation; do not redirect on local balance state.");

  s = s.replace(
    '      } catch {\n        if (!cancelled) navigate("/game/pvp-coinflip");\n      }',
    '      } catch {\n        if (!cancelled) {\n          setGameState("idle");\n          toast.error("Unable to reconnect to this match. Please try Search again.");\n        }\n      }'
  );

  // An expired/failed search stays on the game room so the next Search is explicit and new.
  s = s.replaceAll(
    'r.status === "cancelled" && (g.current && clearInterval(g.current), navigate("/game/pvp-coinflip"))',
    'r.status === "cancelled" && (g.current && clearInterval(g.current), setGameState("idle"), toast.error("Search expired. Press Search to try again."))'
  );

  // Missing result data is transient; never route the player out of an existing match.
  s = s.replace(
    '    if (!s?.result) {\n      navigate("/game/pvp-coinflip");\n      return;\n    }',
    '    if (!s?.result) {\n      setGameState("idle");\n      toast.error("Match data is not ready yet. Please try Search again.");\n      return;\n    }'
  );

  write(p, s);
}

{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  s = s.replaceAll("Reaction Arena", "Tap Arena");

  s = s.replace(/\s*if \((?:!privateMatchId && !recoverySearch && )?balances\.game < stakeAmount\) \{\s*toast\.error\("Insufficient balance in Game Wallet"\);\s*navigate\("\/game\/reaction-tap"\);\s*return;\s*\}/g,
    "\n    // Backend is authoritative for stake availability and match creation; do not redirect on local balance state.");

  s = s.replace(
    '    } catch { navigate("/game/reaction-tap"); }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);',
    '    } catch {\n      setGameState("idle");\n      setQueueId(null);\n      toast.error("Unable to start matchmaking. Please try Search again.");\n    }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);'
  );

  s = s.replace(
    '      } catch { navigate("/game/reaction-tap"); }',
    '      } catch {\n        setGameState("idle");\n        toast.error("Unable to reconnect to this match. Please try Search again.");\n      }'
  );

  s = s.replaceAll(
    's.status === "cancelled" && (clearInterval(m.current), c("/game/reaction-tap"))',
    's.status === "cancelled" && (clearInterval(m.current), h("idle"), ce(null), H.error("Search expired. Press Search to try again."))'
  );

  // Preserve the requested centered Balance -> Search stack.
  s = s.replace(
    'className="text-center flex flex-col items-center"',
    'className="text-center flex flex-col items-center justify-center"'
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

  // Dice Clash must also rely on the backend for stake availability. A stale frontend
  // balance must never send the player back to the stake-selection route.
  s = s.replace(/\s*if \(balances\.game < stake\) \{\s*toast\.error\("Insufficient balance in Game Wallet"\);\s*return;\s*\}/g,
    "\n        // Backend is authoritative for stake availability and match creation.");

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
