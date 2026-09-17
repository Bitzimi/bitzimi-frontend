import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);

// This final build-stage pass removes frontend route redirects that were treating
// transient/backend-authoritative matchmaking failures as a reason to leave the game.
// It also wires Dice Clash into the same recovery lifecycle used by Coin Flip and Reaction Tap.

{
  const p = "src/app/pages/PvPCoinFlipGame.tsx";
  let s = read(p);

  const balanceGate = `    if (balances.game < stakeAmount) {
      toast.error("Insufficient balance in Game Wallet");
      navigate("/game/pvp-coinflip");
      return;
    }`;
  s = s.replaceAll(balanceGate, "    // Backend is authoritative for stake availability and match creation; do not redirect on local balance state.");

  s = s.replace(
    '      } catch {\n        if (!cancelled) navigate("/game/pvp-coinflip");\n      }',
    '      } catch {\n        if (!cancelled) {\n          setGameState("idle");\n          toast.error("Unable to reconnect to this match. Please try Search again.");\n        }\n      }'
  );

  write(p, s);
}

{
  const p = "src/app/pages/ReactionTapGameRoom.tsx";
  let s = read(p);

  // Shorter header keeps Rules visible on mobile without changing the game identity.
  s = s.replaceAll("Reaction Arena", "Tap Arena");

  const transformedBalanceGate = `    if (!privateMatchId && !recoverySearch && balances.game < stakeAmount) {
      toast.error("Insufficient balance in Game Wallet");
      navigate("/game/reaction-tap");
      return;
    }`;
  const sourceBalanceGate = `    if (balances.game < stakeAmount) {
      toast.error("Insufficient balance in Game Wallet");
      navigate("/game/reaction-tap");
      return;
    }`;
  s = s.replaceAll(transformedBalanceGate, "    // Backend is authoritative for stake availability and match creation; do not redirect on local balance state.");
  s = s.replaceAll(sourceBalanceGate, "    // Backend is authoritative for stake availability and match creation; do not redirect on local balance state.");

  // A transient queue/auth/network failure must not throw the player back to the stake-selection route.
  s = s.replace(
    '    } catch { navigate("/game/reaction-tap"); }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);',
    '    } catch {\n      setGameState("idle");\n      setQueueId(null);\n      toast.error("Unable to start matchmaking. Please try Search again.");\n    }\n  }, [stakeAmount, navigate, startCountdown, privateMatchId, recoverActiveMatch, recoverySearch]);'
  );

  // The transformed recovery path can hit the same private-match branch after the
  // recovery coordinator supplies matchId. Keep that failure on the game route.
  s = s.replace(
    '      } catch { navigate("/game/reaction-tap"); }',
    '      } catch {\n        setGameState("idle");\n        toast.error("Unable to reconnect to this match. Please try Search again.");\n      }'
  );

  // Preserve the requested centered Balance -> Search stack in the room entry card.
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

  // Recovery uses the existing backend queue/match identity; it never creates a second search.
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

  // Recovery reads the existing backend session instead of POSTing a new queue.
  const normalJoin = '      const result = await gameMatchmakingService.joinQueue("dice_clash", stake);';
  if (s.includes(normalJoin) && !s.includes('const result = recoverySearch')) {
    s = s.replace(
      normalJoin,
      '      const result = recoverySearch\n        ? await gameMatchmakingService.getActiveMatchmaking("dice_clash", stake)\n        : await gameMatchmakingService.joinQueue("dice_clash", stake);'
    );
  }

  // If a recovery session has expired, stay in the Dice Clash room and let the user
  // explicitly press Search to create a fresh backend queue identity.
  if (!s.includes('if (recoverySearch && result.status === "none")')) {
    s = s.replace(
      '      if (result.status === "matched" && result.matchId)',
      '      if (recoverySearch && result.status === "none") {\n        setGameState("ready");\n        return;\n      }\n      if (result.status === "matched" && result.matchId)'
    );
  }

  // Never navigate away because match data was temporarily unavailable.
  s = s.replace(
    '    if (!matchData?.result) { navigate("/dice-duel/clash"); return; }',
    '    if (!matchData?.result) { setGameState("ready"); toast.error("Match data is not ready yet. Please try Search again."); return; }'
  );

  write(p, s);
}
