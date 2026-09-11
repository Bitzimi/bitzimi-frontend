import fs from "node:fs";

const path = "src/app/pages/PvPCoinFlipGame.tsx";
let s = fs.readFileSync(path, "utf8");

const logicStart = s.indexOf('  // Statistics tracker for debugging fairness');
const logicEnd = s.indexOf('  const totalPot =', logicStart);
if (logicStart < 0 || logicEnd < 0) throw new Error("Coin Flip logic markers not found");

const logic = String.raw`  // Coin Flip presentation timing is backend-authoritative.
  // No Coin Flip timing, result, winner, side, or settlement is generated locally.
  const transactionRecorded = useRef(false);
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

  const startSearch = async () => {
    if (gameState !== "ready") return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
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
    if (privateMatchId) startSearch();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      clearTimelineTimer();
    };
  }, [privateMatchId]);

  useEffect(() => {
    if (!matchId) return;
    fairnessService.getMatchFairness(matchId).then(setFairnessData).catch(() => {});
  }, [matchId]);

  const applyCoinFlipResult = async (md: any) => {
    const result = md?.result?.coinFlip as CoinSide | undefined;
    if (!result) return;
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
      addToSessionHistory({ opponent: gameOpponentName, opponentAvatar: gameOpponentAvatar, result: won ? "win" : "loss", outcome: result, amount: won ? winnings - stakeAmount : stakeAmount, stake: stakeAmount });
      addGameResult({ gameType: "pvp_coinflip", betAmount: stakeAmount, winAmount: won ? winnings : 0, profit: won ? winnings - stakeAmount : -stakeAmount, won, opponent: gameOpponentName, outcome: result });
      if (won) liveActivityService.addActivity("game_win", myUsername, "won in Coin Flip", winnings - stakeAmount);
    }
  };

  const scheduleCoinFlipTimeline = async (initialMatch: any) => {
    if (!initialMatch?.matchId) return;
    clearTimelineTimer();

    const serverNowMs = Date.parse(initialMatch.serverNow ?? "");
    const clientNowMs = Date.now();
    const clockOffsetMs = Number.isFinite(serverNowMs) ? serverNowMs - clientNowMs : 0;
    const nowMs = Date.now() + clockOffsetMs;
    const sideEndMs = Date.parse(initialMatch.sideAssignmentEndsAt ?? "");
    const flipEndMs = Date.parse(initialMatch.flipEndsAt ?? "");
    const popupEndMs = Date.parse(initialMatch.resultPopupEndsAt ?? "");
    const createdMs = Date.parse(initialMatch.animationStartAt ?? initialMatch.createdAt ?? "");
    const sideDurationMs = Number(initialMatch.sideAssignmentDurationMs ?? 8000);
    const flipDurationMs = Number(initialMatch.animationDurationMs ?? 5000);
    const popupDurationMs = Number(initialMatch.resultPopupDurationMs ?? 5000);
    const effectiveSideEnd = Number.isFinite(sideEndMs) ? sideEndMs : createdMs + sideDurationMs;
    const effectiveFlipEnd = Number.isFinite(flipEndMs) ? flipEndMs : effectiveSideEnd + flipDurationMs;
    const effectivePopupEnd = Number.isFinite(popupEndMs) ? popupEndMs : effectiveFlipEnd + popupDurationMs;

    setMatchData(initialMatch);
    setOpponentFromMatch(initialMatch);
    setPlayerSide(initialMatch.isPlayer1 ? initialMatch.result?.p1Side : initialMatch.result?.p2Side);
    setOpponentSide(initialMatch.isPlayer1 ? initialMatch.result?.p2Side : initialMatch.result?.p1Side);
    setAnimationDurationMs(flipDurationMs);

    const refreshAtBoundary = async () => {
      try {
        const fresh = await gameMatchmakingService.getMatch(initialMatch.matchId);
        await scheduleCoinFlipTimeline(fresh);
      } catch {
        timelineTimerRef.current = setTimeout(refreshAtBoundary, 250);
      }
    };

    const phase = initialMatch.phase ?? (nowMs < effectiveSideEnd ? "side_assignment" : nowMs < effectiveFlipEnd ? "flipping" : nowMs < effectivePopupEnd ? "result_popup" : "finished");

    if (phase === "side_assignment") {
      setCoinResult(null);
      setAnimationElapsedMs(0);
      setGameState("side_assignment");
      timelineTimerRef.current = setTimeout(refreshAtBoundary, Math.max(0, effectiveSideEnd - nowMs));
      return;
    }

    if (phase === "flipping") {
      setCoinResult(null);
      setAnimationElapsedMs(Math.max(0, Math.min(flipDurationMs, nowMs - effectiveSideEnd)));
      setGameState("flipping");
      timelineTimerRef.current = setTimeout(refreshAtBoundary, Math.max(0, effectiveFlipEnd - nowMs));
      return;
    }

    if (phase === "result_popup") {
      setAnimationElapsedMs(flipDurationMs);
      await applyCoinFlipResult(initialMatch);
      setGameState("result_popup");
      setShowWinner(true);
      setShowResultPopup(true);
      timelineTimerRef.current = setTimeout(refreshAtBoundary, Math.max(0, effectivePopupEnd - nowMs));
      return;
    }

    setAnimationElapsedMs(flipDurationMs);
    setShowResultPopup(false);
    setShowWinner(false);
    setGameState("ready");
    clearTimelineTimer();
  };

  const assignSides = (md?: any) => {
    const data = md ?? matchData;
    if (!data?.matchId) return;
    void scheduleCoinFlipTimeline(data);
  };

  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {
    if (!md?.matchId) return;
    void scheduleCoinFlipTimeline(md);
  };

  const addToSessionHistory = (record: Omit<SessionRecord, "id" | "timestamp">) => {
    const newRecord: SessionRecord = { ...record, id: "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString() };
    setSessionHistory((prev) => [newRecord, ...prev].slice(0, 10));
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

// Coin Flip is forbidden from using browser storage as an authority or cache.
s = s.replace(/\n\s*\/\/ Statistics tracker for debugging fairness[\s\S]*?\n\s*\/\/ Prevent double execution in React Strict Mode[\s\S]*?\n\s*const hasStarted = useRef\(false\);/m, "");
s = s.replace(/\n\s*\/\/ Load session history from localStorage on mount[\s\S]*?\n\s*\}, \[stakeAmount\]\);/m, "");
s = s.replace(/\n\s*\/\/ Save session history to localStorage whenever it changes[\s\S]*?\n\s*\}, \[sessionHistory, stakeAmount\);/m, "");
s = s.replace(/localStorage\.(?:getItem|setItem|removeItem)\([^\n]+\);?/g, "");

// Backend determines Home/Player1 and Away/Player2. Keep each username/avatar pair together.
const playerBlockStart = s.indexOf('          {/* Players */}');
const gameAreaStart = playerBlockStart >= 0 ? s.indexOf('          {/* Game Area */}', playerBlockStart) : -1;
if (playerBlockStart < 0 || gameAreaStart < 0) throw new Error("Coin Flip Players UI markers not found");
let playerBlock = s.slice(playerBlockStart, gameAreaStart);
playerBlock = playerBlock.replace('avatar={identity.avatar}', 'avatar={homeAvatar}');
playerBlock = playerBlock.replace('{myUsername}', '{homeName}');
playerBlock = playerBlock.replace('avatar={opponentAvatar}', 'avatar={awayAvatar}');
playerBlock = playerBlock.replace('{opponentName}', '{awayName}');
s = s.slice(0, playerBlockStart) + playerBlock + s.slice(gameAreaStart);

// The side-assignment panel must use the same backend Home/Away mapping as the player row.
const sideStart = s.indexOf('{gameState === "side_assignment" && (');
const flipStart = sideStart >= 0 ? s.indexOf('{gameState === "flipping" && (', sideStart) : -1;
if (sideStart >= 0 && flipStart > sideStart) {
  let sideBlock = s.slice(sideStart, flipStart);
  sideBlock = sideBlock.replace('avatar={identity.avatar}', 'avatar={homeAvatar}');
  sideBlock = sideBlock.replace('{myUsername}', '{homeName}');
  sideBlock = sideBlock.replace('avatar={opponentAvatar}', 'avatar={awayAvatar}');
  sideBlock = sideBlock.replace('{opponentName}', '{awayName}');
  sideBlock = sideBlock.replace('{playerSide?.toUpperCase()}', '{homeSide?.toUpperCase()}');
  sideBlock = sideBlock.replace('{opponentSide?.toUpperCase()}', '{awaySide?.toUpperCase()}');
  s = s.slice(0, sideStart) + sideBlock + s.slice(flipStart);
}

const derivedMarker = '  const totalPot =';
const derived = `  const isPlayer1 = Boolean(matchData?.isPlayer1);\n  const homeName = isPlayer1 ? myUsername : (matchData?.opponent?.username ?? opponentName);\n  const awayName = isPlayer1 ? (matchData?.opponent?.username ?? opponentName) : myUsername;\n  const homeAvatar = isPlayer1 ? playerAvatar : (matchData?.opponent?.avatar ?? opponentAvatar);\n  const awayAvatar = isPlayer1 ? (matchData?.opponent?.avatar ?? opponentAvatar) : playerAvatar;\n  const homeSide = isPlayer1 ? playerSide : opponentSide;\n  const awaySide = isPlayer1 ? opponentSide : playerSide;\n\n`;
s = s.replace(derivedMarker, derived + derivedMarker);

s = s.replace('<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />', '<ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={gameState === "flipping"} />');

fs.writeFileSync(path, s);
console.log("Coin Flip consolidated: one backend-driven timeline, one result handler, no browser storage authority, generic Home/Away mapping.");
