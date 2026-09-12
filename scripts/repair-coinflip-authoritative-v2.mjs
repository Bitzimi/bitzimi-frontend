import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const logicStart = s.indexOf('  // Statistics tracker for debugging fairness');
const logicEnd = s.indexOf('  const totalPot =', logicStart);
if (logicStart < 0 || logicEnd < 0) throw new Error("Coin Flip logic markers not found");

const logic = String.raw`  // Coin Flip is a backend-authoritative state machine.
  // The frontend only renders the backend phase/result and never decides matchmaking,
  // Home/Away, Heads/Tails, winner, payout, settlement, or timing.
  const transactionRecorded = useRef(false);
  const lastPhaseRef = useRef<string | null>(null);
  const timelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimelineTimer = () => {
    if (timelineTimerRef.current) clearTimeout(timelineTimerRef.current);
    timelineTimerRef.current = null;
  };

  const setOpponentFromMatch = (match: any) => {
    setOpponentName(match?.opponent?.username ?? "Player");
    setOpponentAvatar(match?.opponent?.avatar ?? match?.opponent?.username?.charAt(0).toUpperCase() ?? "P");
  };

  const resetActiveRound = () => {
    clearTimelineTimer();
    setShowResultPopup(false);
    setShowWinner(false);
    setCoinResult(null);
    setIsWinner(false);
    setWinAmount(0);
    setPlatformFee(0);
    setMatchId(null);
    setMatchData(null);
    setQueueId(null);
    setOpponentName("");
    setOpponentAvatar("P");
    setPlayerSide(null);
    setOpponentSide(null);
    lastPhaseRef.current = null;
    transactionRecorded.current = false;
    setGameState("ready");
  };

  const loadHistory = async () => {
    try {
      const rows = await gameMatchmakingService.getCoinFlipHistory(stakeAmount);
      setSessionHistory(rows.map((r) => ({
        id: r.matchId,
        opponent: r.opponent.username,
        opponentAvatar: r.opponent.avatar ?? null,
        result: r.youWon ? "win" : "loss",
        outcome: r.result ?? "heads",
        amount: r.youWon ? r.payout - r.stake : r.stake,
        stake: r.stake,
        timestamp: r.settledAt ?? r.createdAt,
      })));
    } catch {}
  };

  const applyCoinFlipResult = async (md: any) => {
    const result = md?.result?.coinFlip as CoinSide | undefined;
    if (!result || md?.status !== "settled") return;

    const won = Boolean(md.youWon);
    const gameOpponentName = md.opponent?.username ?? opponentName ?? "Player";
    const gameOpponentAvatar = md.opponent?.avatar ?? md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;
    const winnings = Number(md.payout ?? 0);

    setPlatformFee(Number(md.platformFee ?? 0));
    setCoinResult(result);
    setIsWinner(won);
    setWinAmount(won ? winnings : 0);
    setWinnerAvatar(won ? playerAvatar : gameOpponentAvatar);
    setWinnerName(won ? myUsername : gameOpponentName);

    if (!transactionRecorded.current) {
      transactionRecorded.current = true;
      await refreshWalletsFromBackend().catch(() => {});
      await loadHistory();
      await refreshFromBackend().catch(() => {});
      addGameResult({
        gameType: "pvp_coinflip",
        betAmount: stakeAmount,
        winAmount: won ? winnings : 0,
        profit: won ? winnings - stakeAmount : -stakeAmount,
        won,
        opponent: gameOpponentName,
        outcome: result,
      });
      if (won) liveActivityService.addActivity("game_win", myUsername, "won in Coin Flip", winnings - stakeAmount);
    }
  };

  const scheduleCoinFlipTimeline = async (initialMatch: any) => {
    if (!initialMatch?.matchId) return;
    clearTimelineTimer();
    setMatchData(initialMatch);
    setOpponentFromMatch(initialMatch);

    const applyPhase = async (md: any) => {
      const phase = md?.phase;
      if (!phase) return;
      setMatchData(md);
      setOpponentFromMatch(md);
      setPlayerSide(md.isPlayer1 ? md.result?.p1Side : md.result?.p2Side);
      setOpponentSide(md.isPlayer1 ? md.result?.p2Side : md.result?.p1Side);

      if (phase === "matched") {
        setCoinResult(null);
        setShowWinner(false);
        setShowResultPopup(false);
        setGameState("matched");
        return;
      }

      if (phase === "side_assignment") {
        setCoinResult(null);
        setShowWinner(false);
        setShowResultPopup(false);
        setGameState("side_assignment");
        return;
      }

      if (phase === "flipping") {
        setCoinResult(null);
        setShowWinner(false);
        setShowResultPopup(false);
        setGameState("flipping");
        return;
      }

      if (phase === "result_popup") {
        await applyCoinFlipResult(md);
        setGameState("result_popup");
        setShowWinner(true);
        setShowResultPopup(true);
        return;
      }

      if (phase === "finished") {
        await loadHistory();
        resetActiveRound();
      }
    };

    const syncFromBackend = async () => {
      try {
        const fresh = await gameMatchmakingService.getMatch(initialMatch.matchId);
        const phase = fresh?.phase;
        if (!phase) {
          timelineTimerRef.current = setTimeout(syncFromBackend, 500);
          return;
        }

        if (phase !== lastPhaseRef.current) {
          lastPhaseRef.current = phase;
          await applyPhase(fresh);
        } else if (phase === "result_popup") {
          await applyCoinFlipResult(fresh);
        }

        if (phase !== "finished") timelineTimerRef.current = setTimeout(syncFromBackend, 500);
      } catch {
        timelineTimerRef.current = setTimeout(syncFromBackend, 500);
      }
    };

    lastPhaseRef.current = null;
    await syncFromBackend();
  };

  const startSearch = async () => {
    if (gameState !== "ready") return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
    clearTimelineTimer();
    lastPhaseRef.current = null;
    transactionRecorded.current = false;
    setShowResultPopup(false);
    setShowWinner(false);
    setCoinResult(null);
    setGameState("searching");

    try {
      if (privateMatchId) {
        const match = await gameMatchmakingService.getMatch(privateMatchId);
        setMatchId(privateMatchId);
        setMatchData(match);
        setOpponentFromMatch(match);
        await scheduleCoinFlipTimeline(match);
        return;
      }

      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);
      if (result.status === "matched" && result.matchId) {
        const match = await gameMatchmakingService.getMatch(result.matchId);
        setMatchId(result.matchId);
        setMatchData(match);
        setOpponentFromMatch(match);
        await scheduleCoinFlipTimeline(match);
        return;
      }

      if (result.queueId) {
        setQueueId(result.queueId);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(result.queueId);
            if (status.status === "matched" && status.matchId) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              const match = await gameMatchmakingService.getMatch(status.matchId);
              setMatchId(status.matchId);
              setMatchData(match);
              setOpponentFromMatch(match);
              await scheduleCoinFlipTimeline(match);
            } else if (status.status === "cancelled") {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setGameState("ready");
            }
          } catch {}
        }, 500);
      }
    } catch {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setGameState("ready");
      toast.error("Unable to start matchmaking");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (privateMatchId) {
      startSearch();
      loadHistory();
      return () => {
        cancelled = true;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        clearTimelineTimer();
      };
    }

    gameMatchmakingService.recoverCoinFlipQueue(stakeAmount).then(async (recovery) => {
      if (cancelled) return;
      if (recovery.status === "matched" && recovery.matchId) {
        const match = await gameMatchmakingService.getMatch(recovery.matchId);
        setMatchId(recovery.matchId);
        setMatchData(match);
        setOpponentFromMatch(match);
        await scheduleCoinFlipTimeline(match);
      } else if (recovery.status === "waiting" && recovery.queueId) {
        setQueueId(recovery.queueId);
        setGameState("searching");
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(recovery.queueId!);
            if (status.status === "matched" && status.matchId) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              const match = await gameMatchmakingService.getMatch(status.matchId);
              setMatchId(status.matchId);
              setMatchData(match);
              setOpponentFromMatch(match);
              await scheduleCoinFlipTimeline(match);
            } else if (status.status === "cancelled") {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setGameState("ready");
            }
          } catch {}
        }, 500);
      }
    }).catch(() => {});

    loadHistory();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      clearTimelineTimer();
    };
  }, [privateMatchId, stakeAmount]);

  useEffect(() => {
    if (!matchId) return;
    fairnessService.getMatchFairness(matchId).then(setFairnessData).catch(() => {});
  }, [matchId]);

  const handleNewSearch = async () => {
    resetActiveRound();
    await startSearch();
  };

  const handleExit = () => {
    clearTimelineTimer();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    if (roomCode) navigate("/game/pvp-coinflip/private?roomCode=" + roomCode + "&stake=" + stakeAmount);
    else navigate("/game/pvp-coinflip");
  };

`;

s = s.slice(0, logicStart) + logic + s.slice(logicEnd);

// Coin Flip must not persist game state/history/result/authority in browser storage.
s = s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode[\s\S]*?\n\s*const hasStarted = useRef\(false\);/m, "");
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m, "");
s = s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\);/m, "");
s = s.replace(/localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g, "");

s = s.replace('const { addNotification } = useNotifications();', 'const { refreshFromBackend } = useNotifications();');
s = s.replace('<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />', '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={gameState === "flipping"} />');

// Backend match state controls the active pool/payout. Before a match exists both are zero.
s = s.replace('  const totalPot = Number(matchData?.totalPool ?? stakeAmount);\n  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));', '  const totalPot = matchData ? Number(matchData.totalPool ?? 0) : 0;\n  const winnerGets = matchData ? Number(matchData.payout ?? 0) : 0;\n  const playerIsHome = matchData?.isPlayer1 !== false;\n  const homeName = playerIsHome ? myUsername : opponentName;\n  const homeAvatar = playerIsHome ? playerAvatar : opponentAvatar;\n  const homeSide = playerIsHome ? playerSide : opponentSide;\n  const awayName = playerIsHome ? opponentName : myUsername;\n  const awayAvatar = playerIsHome ? opponentAvatar : playerAvatar;\n  const awaySide = playerIsHome ? opponentSide : playerSide;');

// Both top player displays and the central assignment must follow backend P1(Home)/P2(Away).
const playersStart = s.indexOf('          {/* Players */}');
const gameAreaStart = s.indexOf('          {/* Game Area */}', playersStart);
if (playersStart >= 0 && gameAreaStart > playersStart) {
  const players = `          {/* Players: backend P1 is Home/left and P2 is Away/right. */}\n          <div className="flex items-center justify-between mb-6">\n            <div className="flex flex-col items-center">\n              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">\n                <PlayerAvatar avatar={homeAvatar} />\n              </div>\n              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{homeName}</div>\n            </div>\n            <div className="flex-1 mx-4 text-center">\n              <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">\n                Balance: {formatCurrencyNoDecimals(balances.game)}\n              </div>\n            </div>\n            <div className="flex flex-col items-center">\n              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">\n                <PlayerAvatar avatar={awayAvatar} />\n              </div>\n              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{awayName}</div>\n            </div>\n          </div>\n\n`;
  s = s.slice(0, playersStart) + players + s.slice(gameAreaStart);
}

const sideStart = s.indexOf('            {/* Side Assignment State - Shows which side each player has */}');
const flipStart = s.indexOf('            {/* Flipping State */}', sideStart);
if (sideStart >= 0 && flipStart > sideStart) {
  const sideBlock = `            {/* Side Assignment State - backend Home/Away order with backend Heads/Tails. */}\n            {gameState === "side_assignment" && (\n              <div className="text-center">\n                <div className="text-xl font-bold text-amber-400 mb-6">Sides Assigned!</div>\n                <div className="flex justify-center items-center gap-6 md:gap-10 mb-6">\n                  <div className="flex flex-col items-center">\n                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl md:text-4xl mb-3 shadow-xl shadow-blue-500/50 ring-4 ring-blue-400/30 overflow-hidden">\n                      <PlayerAvatar avatar={homeAvatar} />\n                    </div>\n                    <div className="text-sm font-semibold text-blue-400 mb-2">{homeName}</div>\n                    <div className="text-2xl md:text-3xl font-bold text-white dark:text-white bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 rounded-xl shadow-lg border-2 border-blue-400">\n                      {homeSide?.toUpperCase()}\n                    </div>\n                  </div>\n                  <div className="text-3xl md:text-4xl font-bold text-gray-400">VS</div>\n                  <div className="flex flex-col items-center">\n                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-3xl md:text-4xl mb-3 shadow-xl shadow-red-500/50 ring-4 ring-red-400/30 overflow-hidden">\n                      <PlayerAvatar avatar={awayAvatar} />\n                    </div>\n                    <div className="text-sm font-semibold text-red-400 mb-2">{awayName}</div>\n                    <div className="text-2xl md:text-3xl font-bold text-white dark:text-white bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 rounded-xl shadow-lg border-2 border-red-400">\n                      {awaySide?.toUpperCase()}\n                    </div>\n                  </div>\n                </div>\n                <div className="text-sm text-gray-400 mt-4 animate-pulse">Preparing to flip...</div>\n              </div>\n            )}\n\n`;
  s = s.slice(0, sideStart) + sideBlock + s.slice(flipStart);
}

// Result popup buttons use the single reset/search coordinator instead of duplicating reset logic.
s = s.replace('onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}', 'onClick={handleNewSearch}');

fs.writeFileSync(path, s);
console.log("Coin Flip consolidated: backend phases 10s/8s/5s/12s, backend Home/Away + Heads/Tails, backend history/notifications, zero pre-match pool/winner, clean round reset, no Coin Flip localStorage.");
