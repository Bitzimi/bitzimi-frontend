import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const between = (source, startMarker, endMarker, replacement) => {
  const a = source.indexOf(startMarker);
  const b = source.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error(`Coin Flip block not found: ${startMarker}`);
  return source.slice(0, a) + replacement + source.slice(b);
};

const flow = `  // Coin Flip truth lives on the backend. These refs only manage presentation timers.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const searchInFlight = useRef(false);
  const presentedMatchId = useRef<string | null>(null);

  const clearTimers = () => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  };
  const clearPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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

  const applySettledResult = async (md: any) => {
    const result = md?.result?.coinFlip as CoinSide | undefined;
    if (!result || md?.status !== "settled") return false;
    const won = Boolean(md.youWon);
    const gameOpponentName = md.opponent?.username ?? "Player";
    const gameOpponentAvatar = md.opponent?.avatar ?? gameOpponentName.charAt(0).toUpperCase();
    const winnings = Number(md.payout ?? 0);
    setPlatformFee(Number(md.platformFee ?? 0));
    setCoinResult(result);
    setIsWinner(won);
    setWinAmount(won ? winnings : 0);
    setWinnerAvatar(won ? playerAvatar : gameOpponentAvatar);
    setWinnerName(won ? myUsername : gameOpponentName);
    setShowWinner(false);
    setGameState("showing_result");
    if (!transactionRecorded.current) {
      transactionRecorded.current = true;
      await refreshWalletsFromBackend().catch(() => {});
      await loadHistory();
      addGameResult({
        gameType: "pvp_coinflip", betAmount: stakeAmount,
        winAmount: won ? winnings : 0,
        profit: won ? winnings - stakeAmount : -stakeAmount,
        won, opponent: gameOpponentName, outcome: result,
      });
    }
    const winnerTimer = setTimeout(() => {
      setShowWinner(true);
      timersRef.current.push(setTimeout(() => setShowResultPopup(true), 2000));
    }, 0);
    timersRef.current.push(winnerTimer);
    return true;
  };

  const waitForSettlement = (id: string, initialMatch: any) => {
    clearPolling();
    const startedAt = Date.parse(initialMatch?.createdAt ?? "");
    const duration = Number(initialMatch?.animationDurationMs ?? 8000);
    const tick = async () => {
      try {
        const md = await gameMatchmakingService.getMatch(id);
        setMatchData(md);
        const serverNow = Date.parse(md.serverNow ?? "");
        const now = Number.isFinite(serverNow) ? serverNow : Date.now();
        const elapsed = Number.isFinite(startedAt) ? Math.max(0, now - startedAt) : 0;
        if (md.status === "settled" && md.result?.coinFlip && elapsed >= duration) {
          clearPolling();
          setAnimationElapsedMs(duration);
          await applySettledResult(md);
        } else if (elapsed >= duration) {
          setAnimationElapsedMs(duration);
        } else {
          setAnimationElapsedMs(elapsed);
        }
      } catch {}
    };
    tick();
    pollRef.current = setInterval(tick, 500);
  };

  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {
    if (!md?.result) return;
    clearTimers();
    const startedAt = Date.parse(md.createdAt ?? "");
    const serverNow = Date.parse(md.serverNow ?? "");
    const authoritativeNow = Number.isFinite(serverNow) ? serverNow : Date.now();
    const duration = Number(md.animationDurationMs ?? 8000);
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, authoritativeNow - startedAt) : 0;
    setAnimationDurationMs(duration);
    setAnimationElapsedMs(Math.min(duration, elapsed));
    if (md.status === "settled" && elapsed >= duration) {
      applySettledResult(md);
      return;
    }
    setCoinResult(md.result.coinFlip as CoinSide);
    setGameState("flipping");
    waitForSettlement(md.matchId, md);
  };

  const assignSides = (md?: any) => {
    const data = md ?? matchData;
    if (!data?.result) return;
    const startedAt = Date.parse(data.createdAt ?? "");
    const serverNow = Date.parse(data.serverNow ?? "");
    const authoritativeNow = Number.isFinite(serverNow) ? serverNow : Date.now();
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, authoritativeNow - startedAt) : 0;
    const assignedPlayerSide: CoinSide = data.isPlayer1 ? data.result.p1Side : data.result.p2Side;
    const assignedOpponentSide: CoinSide = data.isPlayer1 ? data.result.p2Side : data.result.p1Side;
    setPlayerSide(assignedPlayerSide);
    setOpponentSide(assignedOpponentSide);
    if (elapsed >= 8000) { startGame(data, assignedPlayerSide); return; }
    if (elapsed >= 3000) { startGame(data, assignedPlayerSide); return; }
    setGameState("side_assignment");
    const timer = setTimeout(() => startGame(data, assignedPlayerSide), 3000 - elapsed);
    timersRef.current.push(timer);
  };

  const loadMatch = async (id: string) => {
    clearPolling();
    try {
      const match = await gameMatchmakingService.getMatch(id);
      setMatchId(id);
      setMatchData(match);
      setOpponentName(match.opponent.username);
      setOpponentAvatar(match.opponent.avatar ?? match.opponent.username.charAt(0).toUpperCase());
      if (match.status === "settled" && match.result?.coinFlip && Date.now() - Date.parse(match.createdAt) >= Number(match.animationDurationMs ?? 8000)) {
        await applySettledResult(match);
      } else {
        setGameState("matched");
        assignSides(match);
      }
    } catch {
      setGameState("ready");
    }
  };

  const startSearch = async () => {
    if (searchInFlight.current || gameState !== "ready") return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
    searchInFlight.current = true;
    clearPolling(); clearTimers();
    transactionRecorded.current = false;
    setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setAnimationElapsedMs(0); setGameState("searching");
    try {
      if (privateMatchId) { await loadMatch(privateMatchId); return; }
      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);
      if (result.status === "matched" && result.matchId) { await loadMatch(result.matchId); return; }
      if (result.queueId) {
        setQueueId(result.queueId);
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(result.queueId!);
            if (status.status === "matched" && status.matchId) {
              clearPolling();
              await loadMatch(status.matchId);
            } else if (status.status === "cancelled") {
              clearPolling(); searchInFlight.current = false; setGameState("ready");
            }
          } catch {}
        }, 500);
      }
    } catch {
      searchInFlight.current = false;
      setGameState("ready");
      toast.error("Unable to start matchmaking");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (privateMatchId) { startSearch(); return () => { cancelled = true; clearPolling(); clearTimers(); }; }
    gameMatchmakingService.recoverCoinFlipQueue(stakeAmount).then(async (recovery) => {
      if (cancelled) return;
      if (recovery.status === "matched" && recovery.matchId) { searchInFlight.current = true; await loadMatch(recovery.matchId); }
      else if (recovery.status === "waiting" && recovery.queueId) {
        searchInFlight.current = true; setQueueId(recovery.queueId); setGameState("searching");
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(recovery.queueId!);
            if (status.status === "matched" && status.matchId) { clearPolling(); await loadMatch(status.matchId); }
            else if (status.status === "cancelled") { clearPolling(); searchInFlight.current = false; setGameState("ready"); }
          } catch {}
        }, 500);
      }
    }).catch(() => {});
    loadHistory();
    return () => { cancelled = true; clearPolling(); clearTimers(); };
  }, [privateMatchId, stakeAmount]);

  useEffect(() => {
    if (!matchId) return;
    fairnessService.getMatchFairness(matchId).then(setFairnessData).catch(() => {});
  }, [matchId]);

  const addToSessionHistory = (_record: Omit<SessionRecord, "id" | "timestamp">) => { loadHistory(); };

  const handleNewSearch = async () => {
    clearPolling(); clearTimers();
    setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setQueueId(null); setAnimationElapsedMs(0); setPlayerSide(null); setOpponentSide(null);
    presentedMatchId.current = null; searchInFlight.current = false; transactionRecorded.current = false; setGameState("ready");
    await startSearch();
  };

  const handleExit = () => {
    clearPolling(); clearTimers(); searchInFlight.current = false;
    if (roomCode) navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`);
    else navigate("/game/pvp-coinflip");
  };

  const totalPot = Number(matchData?.totalPool ?? stakeAmount);
  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));
  const feePercent = feeRate * 100;

`;
s = between(s, "  // Statistics tracker for debugging fairness", "  return (", flow + "  return (");

// The original result modal remains untouched; only its existing action is wired
// to the real backend search flow instead of merely changing React state.
s = s.replace(
  'onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}',
  'onClick={handleNewSearch}'
);

// Remove any remaining Coin Flip-specific localStorage truth from this page.
s = s.replace(/\n\s*const \[stats, setStats\] = useState\(\(\) => \{[\s\S]*?\n\s*\}\);/m, "");
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\]\);/m, "");

fs.writeFileSync(path, s);
console.log("Applied Coin Flip backend-authoritative frontend flow without changing UI markup.");
