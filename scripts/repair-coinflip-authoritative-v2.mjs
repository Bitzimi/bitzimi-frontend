import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const logicStart = s.indexOf('  // Statistics tracker for debugging fairness');
const logicEnd = s.indexOf('  const totalPot =', logicStart);
if (logicStart < 0 || logicEnd < 0) throw new Error("Coin Flip logic markers not found");

const logic = String.raw`  // Coin Flip presentation is driven only by the backend match phase.
  // The frontend never decides the opponent, sides, coin result, winner, payout, or settlement.
  const transactionRecorded = useRef(false);
  const lastPhaseRef = useRef<string | null>(null);
  const [animationElapsedMs, setAnimationElapsedMs] = useState(0);
  const [animationDurationMs, setAnimationDurationMs] = useState(5000);
  const timelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimelineTimer = () => {
    if (timelineTimerRef.current) clearTimeout(timelineTimerRef.current);
    timelineTimerRef.current = null;
  };

  const setOpponentFromMatch = (match: any) => {
    setOpponentName(match?.opponent?.username ?? "Player");
    setOpponentAvatar(match?.opponent?.avatar ?? match?.opponent?.username?.charAt(0).toUpperCase() ?? "P");
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

    const flipDurationMs = Number(initialMatch.animationDurationMs ?? 5000);
    setAnimationDurationMs(flipDurationMs);
    setPlayerSide(initialMatch.isPlayer1 ? initialMatch.result?.p1Side : initialMatch.result?.p2Side);
    setOpponentSide(initialMatch.isPlayer1 ? initialMatch.result?.p2Side : initialMatch.result?.p1Side);

    const applyPhase = async (md: any) => {
      const phase = md?.phase;
      if (!phase) return;
      setMatchData(md);
      setOpponentFromMatch(md);

      const mdFlipDuration = Number(md.animationDurationMs ?? 5000);
      setAnimationDurationMs(mdFlipDuration);
      setPlayerSide(md.isPlayer1 ? md.result?.p1Side : md.result?.p2Side);
      setOpponentSide(md.isPlayer1 ? md.result?.p2Side : md.result?.p1Side);

      if (phase === "side_assignment") {
        setCoinResult(null);
        setAnimationElapsedMs(0);
        setShowWinner(false);
        setShowResultPopup(false);
        setGameState("side_assignment");
        return;
      }

      if (phase === "flipping") {
        setCoinResult(null);
        const flipStartedAt = Date.parse(md.animationStartAt ?? "");
        const serverNow = Date.parse(md.serverNow ?? "");
        const elapsed = Number.isFinite(flipStartedAt) && Number.isFinite(serverNow)
          ? Math.max(0, Math.min(mdFlipDuration, serverNow - flipStartedAt - Number(md.sideAssignmentDurationMs ?? 8000)))
          : 0;
        setAnimationElapsedMs(elapsed);
        setShowWinner(false);
        setShowResultPopup(false);
        setGameState("flipping");
        return;
      }

      if (phase === "result_popup") {
        setAnimationElapsedMs(mdFlipDuration);
        await applyCoinFlipResult(md);
        setGameState("result_popup");
        setShowWinner(true);
        setShowResultPopup(true);
        return;
      }

      if (phase === "finished") {
        setAnimationElapsedMs(mdFlipDuration);
        setShowResultPopup(false);
        setShowWinner(false);
        setGameState("ready");
        clearTimelineTimer();
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
          // Keep the popup/result data refreshed from the backend without replaying settlement.
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
    setAnimationElapsedMs(0);
    setGameState("searching");

    try {
      if (privateMatchId) {
        const match = await gameMatchmakingService.getMatch(privateMatchId);
        setMatchId(privateMatchId);
        setMatchData(match);
        setOpponentFromMatch(match);
        setGameState("matched");
        await scheduleCoinFlipTimeline(match);
        return;
      }

      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);
      if (result.status === "matched" && result.matchId) {
        const match = await gameMatchmakingService.getMatch(result.matchId);
        setMatchId(result.matchId);
        setMatchData(match);
        setOpponentFromMatch(match);
        setGameState("matched");
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
              setGameState("matched");
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
        await (async () => {
          const match = await gameMatchmakingService.getMatch(recovery.matchId!);
          setMatchId(recovery.matchId!);
          setMatchData(match);
          setOpponentFromMatch(match);
          setGameState("matched");
          await scheduleCoinFlipTimeline(match);
        })();
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
              setGameState("matched");
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

  const addToSessionHistory = (_record: Omit<SessionRecord, "id" | "timestamp">) => {
    void loadHistory();
  };

  const handleNewSearch = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    clearTimelineTimer();
    setShowResultPopup(false);
    setShowWinner(false);
    setCoinResult(null);
    setMatchId(null);
    setMatchData(null);
    setQueueId(null);
    setAnimationElapsedMs(0);
    setPlayerSide(null);
    setOpponentSide(null);
    lastPhaseRef.current = null;
    transactionRecorded.current = false;
    setGameState("ready");
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

// Coin Flip must never use browser storage for game state, history, result, or authority.
s = s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode[\s\S]*?\n\s*const hasStarted = useRef\(false\);/m, "");
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m, "");
s = s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\]\);/m, "");
s = s.replace(/localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g, "");

// Restore the original Home/Player1 and Away/Player2 UI mapping. Do not transform it here.
// The backend's isPlayer1 and result p1Side/p2Side remain the source of truth.

s = s.replace('const { addNotification } = useNotifications();', 'const { refreshFromBackend } = useNotifications();');
s = s.replace('<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />', '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={gameState === "flipping"} />');

fs.writeFileSync(path, s);
console.log("Coin Flip consolidated: original player mapping preserved, one backend phase synchronizer, 8s/5s/5s backend timeline, backend history, backend notifications, no Coin Flip localStorage.");
