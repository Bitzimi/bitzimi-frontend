import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Info, Search, Shield } from "lucide-react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useIdentity } from "../contexts/IdentityContext";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { FairnessModal } from "../components/FairnessModal";
import { ProfessionalGoldCoin } from "../components/ProfessionalGoldCoin";
import { gameMatchmakingService, fairnessService, type CoinFlipHistoryItem, type FairnessData, type MatchResult } from "../services/gameMatchmakingService";
import { toast } from "sonner";

type GameState = "ready" | "searching" | "matched" | "side_assignment" | "flipping" | "showing_result";
type CoinSide = "heads" | "tails";

/** Backend-authoritative Coin Flip. Browser storage is deliberately not used for game state. */
export default function PvPCoinFlipGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedStake = Number(searchParams.get("stake") || 1);
  const stakeAmount = Number.isFinite(requestedStake) && requestedStake > 0 ? requestedStake : 1;
  const privateMatchId = searchParams.get("matchId");
  const roomCode = searchParams.get("roomCode");
  const { formatCurrencyNoDecimals } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { identity } = useIdentity();

  const [config, setConfig] = useState({ feeRate: 0, stakes: [] as number[] });
  const [gameState, setGameState] = useState<GameState>("ready");
  const [matchData, setMatchData] = useState<MatchResult | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const [coinResult, setCoinResult] = useState<CoinSide | null>(null);
  const [playerSide, setPlayerSide] = useState<CoinSide | null>(null);
  const [opponentSide, setOpponentSide] = useState<CoinSide | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showFairness, setShowFairness] = useState(false);
  const [fairnessData, setFairnessData] = useState<FairnessData | null>(null);
  const [history, setHistory] = useState<CoinFlipHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const searchInFlight = useRef(false);
  const presentedMatchId = useRef<string | null>(null);

  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);
  const clearPolling = useCallback(() => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try { setHistory(await gameMatchmakingService.getCoinFlipHistory(stakeAmount)); } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, [stakeAmount]);

  const loadMatch = useCallback(async (id: string, animate: boolean) => {
    const match = await gameMatchmakingService.getMatch(id);
    setMatchData(match);
    setCoinResult((match.result?.coinFlip as CoinSide) ?? null);
    const mine = match.isPlayer1 ? match.result?.p1Side : match.result?.p2Side;
    const opponent = match.isPlayer1 ? match.result?.p2Side : match.result?.p1Side;
    setPlayerSide(mine ?? null);
    setOpponentSide(opponent ?? null);

    // A recovered settled match is rendered as an immutable result. It is never
    // replayed as a new game and never creates a frontend transaction/history row.
    if (match.status === "settled" && match.result?.coinFlip && !animate) {
      setGameState("showing_result");
      setShowWinner(true);
      return;
    }
    if (!match.result?.coinFlip) { setGameState("matched"); return; }

    const animationStart = Date.parse(match.animationStartAt ?? "");
    const duration = Number(match.animationDurationMs ?? 2500);
    const wait = Number.isFinite(animationStart) ? Math.max(0, animationStart - Date.now()) : 0;
    setGameState("side_assignment");
    timersRef.current.push(setTimeout(() => {
      if (presentedMatchId.current === match.matchId) return;
      presentedMatchId.current = match.matchId;
      const elapsed = Number.isFinite(animationStart) ? Math.max(0, Date.now() - animationStart) : 0;
      if (elapsed >= duration) { setGameState("showing_result"); setShowWinner(true); return; }
      setGameState("flipping");
      timersRef.current.push(setTimeout(() => { setGameState("showing_result"); setShowWinner(true); }, duration - elapsed));
    }, wait));
  }, []);

  const startSearch = useCallback(async () => {
    if (searchInFlight.current) return;
    searchInFlight.current = true;
    clearPolling(); clearTimers();
    setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchData(null); setQueueId(null); setGameState("searching");
    try {
      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);
      if (result.status === "matched" && result.matchId) { await loadMatch(result.matchId, true); return; }
      if (result.status === "waiting" && result.queueId) {
        setQueueId(result.queueId);
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(result.queueId!);
            if (status.status === "matched" && status.matchId) { clearPolling(); await loadMatch(status.matchId, true); }
            else if (status.status === "cancelled") { clearPolling(); searchInFlight.current = false; setQueueId(null); setGameState("ready"); toast.info("Matchmaking search expired and your stake was returned."); }
          } catch {}
        }, 750);
      }
    } catch (error: any) {
      searchInFlight.current = false; setGameState("ready"); toast.error(error?.message || "Unable to start matchmaking");
    }
  }, [clearPolling, clearTimers, loadMatch, stakeAmount]);

  useEffect(() => {
    let disposed = false;
    const recover = async () => {
      if (privateMatchId) {
        try { await gameMatchmakingService.getMatch(privateMatchId); if (!disposed) { searchInFlight.current = true; await loadMatch(privateMatchId, false); } }
        catch { if (!disposed) navigate(roomCode ? `/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}` : "/game/pvp-coinflip"); }
        return;
      }
      try {
        const recovered = await gameMatchmakingService.recoverQueue("pvp_coinflip", stakeAmount);
        if (disposed || !recovered) return;
        searchInFlight.current = true;
        if (recovered.status === "matched" && recovered.matchId) { await loadMatch(recovered.matchId, false); return; }
        if (recovered.status === "waiting" && recovered.queueId) {
          setQueueId(recovered.queueId); setGameState("searching");
          pollRef.current = setInterval(async () => {
            try {
              const status = await gameMatchmakingService.pollQueue(recovered.queueId!);
              if (status.status === "matched" && status.matchId) { clearPolling(); await loadMatch(status.matchId, true); }
              else if (status.status === "cancelled") { clearPolling(); searchInFlight.current = false; setQueueId(null); setGameState("ready"); }
            } catch {}
          }, 750);
        }
      } catch { if (!disposed) setGameState("ready"); }
    };
    recover();
    return () => { disposed = true; clearPolling(); clearTimers(); };
  }, [privateMatchId, roomCode, stakeAmount, navigate, clearPolling, clearTimers, loadMatch]);

  useEffect(() => {
    gameMatchmakingService.getGameConfig("pvp_coinflip").then(c => setConfig({ feeRate: Number(c.feeRate) || 0, stakes: c.stakes || [] })).catch(() => {});
    loadHistory();
    return () => { clearPolling(); clearTimers(); };
  }, [loadHistory, clearPolling, clearTimers]);

  useEffect(() => {
    if (matchData?.matchId) fairnessService.getMatchFairness(matchData.matchId).then(setFairnessData).catch(() => {});
  }, [matchData?.matchId]);

  useEffect(() => {
    if (gameState !== "showing_result" || matchData?.status !== "settled") return;
    refreshWalletsFromBackend().catch(() => {}); loadHistory();
    const timer = setTimeout(() => setShowResultPopup(true), 1500); timersRef.current.push(timer);
    return () => clearTimeout(timer);
  }, [gameState, matchData?.status, refreshWalletsFromBackend, loadHistory]);

  const handleExit = () => { clearPolling(); clearTimers(); searchInFlight.current = false; navigate(roomCode ? `/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}` : "/game/pvp-coinflip"); };
  const handleNewSearch = async () => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchData(null); presentedMatchId.current = null; searchInFlight.current = false; setGameState("ready"); await startSearch(); };

  const opponent = matchData?.opponent;
  const totalPool = Number(matchData?.totalPool ?? stakeAmount * 2);
  const platformFee = Number(matchData?.platformFee ?? totalPool * config.feeRate);
  const winnerPayout = Number(matchData?.payout ?? Math.max(0, totalPool - platformFee));
  const netChange = matchData?.youWon ? winnerPayout - stakeAmount : -stakeAmount;
  const feePercent = totalPool > 0 ? (platformFee / totalPool) * 100 : config.feeRate * 100;

  return <ResponsiveLayout>
    <div className="space-y-3 mb-6">
      <div className="flex items-center"><Button variant="ghost" size="sm" onClick={handleExit} className="px-3 -ml-3"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center"><div className="min-w-0 flex items-center gap-1.5"><h1 className="text-xl font-bold text-gray-900 dark:text-white">Coin Flip</h1><span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span></div><Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)}><Info className="h-4 w-4 mr-2" />Rules</Button><Button variant="outline" size="sm" onClick={() => setShowFairness(true)} className="justify-self-start"><Shield className="h-3.5 w-3.5 mr-1.5" />Verify Fairness</Button></div>
      {showRules && <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"><div className="p-4"><h3 className="font-semibold mb-2">How to Play</h3><ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-disc list-inside"><li>The backend assigns HEADS or TAILS.</li><li>The backend determines the coin result and winner.</li><li>The backend calculates the payout and platform fee.</li><li>Wallet movement and completed history are backend records.</li></ul></div></Card>}
      <Card className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700"><div className="p-3 sm:p-4"><div className="grid grid-cols-3 gap-2 divide-x divide-gray-200 dark:divide-gray-700"><div className="text-center"><div className="text-[10px] text-gray-500 uppercase mb-1">Bet</div><div className="font-bold">{formatCurrencyNoDecimals(stakeAmount)}</div></div><div className="text-center"><div className="text-[10px] text-gray-500 uppercase mb-1">Pool</div><div className="font-bold">{formatCurrencyNoDecimals(totalPool)}</div></div><div className="text-center"><div className="text-[10px] text-gray-500 uppercase mb-1">Winner</div><div className="font-bold">{formatCurrencyNoDecimals(winnerPayout)}</div></div></div></div></Card>
    </div>

    <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0a0f] dark:to-[#1a1a1a] border border-gray-200 dark:border-gray-800 overflow-hidden"><div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6"><div className="flex flex-col items-center"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden mb-2"><PlayerAvatar avatar={identity.avatar} /></div><div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{identity.username}</div></div><div className="flex-1 mx-4 text-center"><div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">Balance: {formatCurrencyNoDecimals(balances.game)}</div></div><div className="flex flex-col items-center"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden mb-2"><PlayerAvatar avatar={opponent?.avatar ?? opponent?.username?.charAt(0).toUpperCase() ?? "P"} /></div><div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{opponent?.username ?? "Opponent"}</div></div></div>
      <div className="min-h-[280px] flex flex-col items-center justify-center">
        {gameState === "ready" && <div className="text-center"><Button onClick={startSearch} className="h-12 min-w-[190px] px-7 rounded-lg"><Search className="h-4 w-4 mr-2" />Search for Opponent</Button><div className="text-xs text-gray-500 mt-3">Matchmaking and stake handling are controlled by the backend.</div></div>}
        {gameState === "searching" && <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" /><div className="text-base text-gray-300">Searching for opponent...</div></div>}
        {gameState === "matched" && <div className="text-center"><div className="text-4xl mb-3">✓</div><div className="text-lg text-green-400 font-semibold">Opponent Found!</div><div className="text-sm text-gray-400 mt-2">vs {opponent?.username ?? "Opponent"}</div></div>}
        {gameState === "side_assignment" && <div className="text-center"><div className="text-xl font-bold text-amber-400 mb-6">Sides Assigned!</div><div className="flex justify-center items-center gap-6 md:gap-10 mb-6"><div className="flex flex-col items-center"><div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-3"><PlayerAvatar avatar={identity.avatar} /></div><div className="text-sm font-semibold text-blue-400 mb-2">{identity.username}</div><div className="text-2xl font-bold bg-blue-700 px-5 py-2.5 rounded-xl border-2 border-blue-400">{playerSide?.toUpperCase()}</div></div><div className="text-3xl font-bold text-gray-400">VS</div><div className="flex flex-col items-center"><div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-3"><PlayerAvatar avatar={opponent?.avatar ?? "P"} /></div><div className="text-sm font-semibold text-red-400 mb-2">{opponent?.username ?? "Opponent"}</div><div className="text-2xl font-bold bg-red-700 px-5 py-2.5 rounded-xl border-2 border-red-400">{opponentSide?.toUpperCase()}</div></div></div><div className="text-sm text-gray-400 animate-pulse">Preparing to flip...</div></div>}
        {gameState === "flipping" && <div className="text-center"><ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} /><div className="text-base text-gray-300 mt-4">Flipping...</div></div>}
        {gameState === "showing_result" && <div className="text-center"><ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={false} /><div className="text-2xl font-bold text-amber-400 mt-4 mb-6">{coinResult?.toUpperCase()}</div>{showWinner && <div><div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mx-auto mb-3"><PlayerAvatar avatar={matchData?.youWon ? identity.avatar : opponent?.avatar ?? "P"} /></div><div className={`text-xl md:text-2xl font-bold ${matchData?.youWon ? "text-blue-400" : "text-red-400"}`}>{matchData?.youWon ? identity.username : opponent?.username}</div><div className="text-sm text-gray-400 mt-1">WINS</div></div>}</div>}
      </div>
    </div></Card>

    <Card className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800"><div className="p-3"><div className="text-xs text-gray-600 dark:text-gray-400 text-center">Platform fee: {feePercent.toFixed(2)}% • Winner receives: {formatCurrencyNoDecimals(winnerPayout)}</div></div></Card>
    <Card className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800"><div className="p-4"><h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Your History ({formatCurrencyNoDecimals(stakeAmount)} Stake)</h3>{historyLoading ? <div className="text-xs text-gray-500 text-center py-4">Loading history...</div> : history.length === 0 ? <div className="text-xs text-gray-500 text-center py-4">No completed Coin Flip matches yet.</div> : <div className="space-y-2">{history.map(item => <div key={item.matchId} className="flex items-center justify-between p-2.5 rounded bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50"><div className="flex items-center gap-2 min-w-0"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${item.youWon ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"}`}>{item.youWon ? "WIN" : "LOSS"}</span><span className="text-xs text-gray-500">vs</span><span className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.opponent.username}</span><span className="text-xs text-gray-500">• {(item.result ?? "").toUpperCase()}</span></div><div className={`text-sm font-bold ml-2 shrink-0 ${item.youWon ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{item.youWon ? "+" : "-"}{formatCurrencyNoDecimals(Math.abs(item.youWon ? item.payout - item.stake : item.stake))}</div></div>)}</div>}</div></Card>

    <FairnessModal isOpen={showFairness} onClose={() => setShowFairness(false)} gameType="pvp_coinflip" serverSeedHash={fairnessData?.serverSeedHash ?? ""} serverSeed={fairnessData?.serverSeed ?? null} clientSeed={fairnessData?.clientSeed ?? null} nonce={fairnessData?.nonce ?? null} result={coinResult ? { coinFlip: coinResult, won: Boolean(matchData?.youWon) } : undefined} />
    <Dialog open={showResultPopup} onOpenChange={setShowResultPopup}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="text-center"><div className="text-5xl mb-3">{matchData?.youWon ? "🎉" : "😔"}</div><div className={`text-3xl font-bold ${matchData?.youWon ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{matchData?.youWon ? `${identity.username} Wins!` : `${identity.username} Lost`}</div></DialogTitle><DialogDescription className="text-center">{matchData?.youWon ? "Congratulations!" : "Better luck next time!"}</DialogDescription></DialogHeader><div className="text-center space-y-4"><div><div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Change</div><div className={`text-3xl font-bold ${netChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{netChange >= 0 ? "+" : ""}{formatCurrencyNoDecimals(netChange)}</div></div><div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded p-3"><div className="flex justify-between"><span>Current Balance:</span><span className="font-semibold">{formatCurrencyNoDecimals(balances.game)}</span></div></div><Button onClick={handleNewSearch} className="w-full h-12"><Search className="h-4 w-4 mr-2" />Search for New Opponent</Button><Button variant="outline" onClick={handleExit} className="w-full">Back to Stake Selection</Button></div></DialogContent></Dialog>
  </ResponsiveLayout>;
}
