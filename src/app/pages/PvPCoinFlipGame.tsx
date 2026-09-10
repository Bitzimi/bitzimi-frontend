import { useState, useEffect, useRef } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Info, Shield } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
import { gameMatchmakingService, fairnessService, type FairnessData } from '../services/gameMatchmakingService';
import { FairnessModal } from "../components/FairnessModal";
// affiliateCommissionService removed — commissions handled server-side
import { useIdentity } from "../contexts/IdentityContext";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { ProfessionalGoldCoin } from "../components/ProfessionalGoldCoin";

type GameState = "idle" | "searching" | "matched" | "side_assignment" | "flipping" | "showing_result" | "result_popup";
type CoinSide = "heads" | "tails";

// Avatar is NOT stored in session history — resolved at render time from identity
interface SessionRecord {
  id: string;
  opponent: string;
  opponentAvatar?: string | null;
  result: "win" | "loss";
  outcome: CoinSide;
  amount: number;
  stake: number;
  timestamp: string;
}

export default function PvPCoinFlipGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stakeAmount = parseInt(searchParams.get("stake") || "1");
  const privateMatchId = searchParams.get("matchId");
  const roomCode = searchParams.get("roomCode");
  const { formatCurrencyNoDecimals } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult } = useGameStats();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const myUsername = identity.username;
  const [feeRate, setFeeRate] = useState<number>(0);

  const [gameState, setGameState] = useState<GameState>("idle");
  const [coinResult, setCoinResult] = useState<CoinSide | null>(null);
  const [isWinner, setIsWinner] = useState<boolean>(false);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);

  // Player avatar = identity.avatar (always set: uploaded image or username initial)
  const playerAvatar = identity.avatar;
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("P");
  const [queueId, setQueueId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [winnerAvatar, setWinnerAvatar] = useState<string>("");
  const [winnerName, setWinnerName] = useState<string>("");
  const [showWinner, setShowWinner] = useState<boolean>(false);
  const [playerSide, setPlayerSide] = useState<CoinSide | null>(null);
  const [opponentSide, setOpponentSide] = useState<CoinSide | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showFairness,  setShowFairness]  = useState(false);
  const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);

  // Statistics tracker for debugging fairness
  const [stats, setStats] = useState(() => {
    try {
      const stored = localStorage.getItem("pvpCoinFlipStats");
      return stored ? JSON.parse(stored) : { wins: 0, losses: 0, total: 0 };
    } catch {
      return { wins: 0, losses: 0, total: 0 };
    }
  });

  // Prevent double execution in React Strict Mode
  const hasStarted = useRef(false);

  // Track if transaction has been recorded for this game
  const transactionRecorded = useRef(false);

  // Load session history from localStorage on mount
  useEffect(() => {
    const loadSessionHistory = () => {
      try {
        const key = `bitzimiPvPSession_${stakeAmount}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          setSessionHistory(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Error loading session history:", e);
      }
    };

    loadSessionHistory();
  }, [stakeAmount]);

  // Save session history to localStorage whenever it changes
  useEffect(() => {
    if (sessionHistory.length > 0) {
      try {
        const key = `bitzimiPvPSession_${stakeAmount}`;
        localStorage.setItem(key, JSON.stringify(sessionHistory));
      } catch (e) {
        console.error("Error saving session history:", e);
      }
    }
  }, [sessionHistory, stakeAmount]);

  // Public matchmaking starts only after the user presses Search.
  const startSearch = async () => {
    if (gameState !== "ready") return;
    if (balances.game < stakeAmount) { toast.error("Insufficient balance in Game Wallet"); return; }
    setGameState("searching");
    try {
      if (privateMatchId) {
        const match = await gameMatchmakingService.getMatch(privateMatchId);
        setMatchId(privateMatchId); setMatchData(match); setOpponentName(match.opponent.username);
        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");
        setTimeout(() => assignSides(match), 3000); return;
      }
      const result = await gameMatchmakingService.joinQueue("pvp_coinflip", stakeAmount);
      if (result.status === "matched" && result.matchId) {
        const match = await gameMatchmakingService.getMatch(result.matchId);
        setMatchId(result.matchId); setMatchData(match); setOpponentName(match.opponent.username);
        setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");
        setTimeout(() => assignSides(match), 3000); return;
      }
      if (result.queueId) {
        setQueueId(result.queueId);
        pollRef.current = setInterval(async () => {
          try {
            const status = await gameMatchmakingService.pollQueue(result.queueId);
            if (status.status === "matched" && status.matchId) {
              clearInterval(pollRef.current!);
              const match = await gameMatchmakingService.getMatch(status.matchId);
              setMatchId(status.matchId); setMatchData(match); setOpponentName(match.opponent.username);
              setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase()); setGameState("matched");
              setTimeout(() => assignSides(match), 3000);
            } else if (status.status === "cancelled") { clearInterval(pollRef.current!); setGameState("ready"); }
          } catch {}
        }, 500);
      }
    } catch { setGameState("ready"); toast.error("Unable to start matchmaking"); }
  };

  useEffect(() => {
    if (privateMatchId) startSearch();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [privateMatchId]);

  const assignSides = (md?: any) => {
    const data = md ?? matchData;
    if (!data?.result) { navigate("/game/pvp-coinflip"); return; }
    const isP1 = data.isPlayer1;
    const assignedPlayerSide: CoinSide   = isP1 ? data.result.p1Side : data.result.p2Side;
    const assignedOpponentSide: CoinSide = isP1 ? data.result.p2Side : data.result.p1Side;
    setPlayerSide(assignedPlayerSide);
    setOpponentSide(assignedOpponentSide);
    setGameState("side_assignment");
    setTimeout(() => { startGame(data, assignedPlayerSide); }, 3000);
  };

  useEffect(() => {
    if (!matchId) return;
    fairnessService.getMatchFairness(matchId).then(setFairnessData).catch(() => {});
  }, [matchId]);

  const startGame = (md: any, _assignedPlayerSide: CoinSide) => {
    if (!md?.result) { navigate("/game/pvp-coinflip"); return; }
    transactionRecorded.current = false;

    // Backend already settled — read authoritative coin flip result
    const result: CoinSide = md.result.coinFlip as CoinSide;
    const won: boolean      = md.youWon;
    const gameOpponentName   = md.opponent?.username ?? opponentName;
    const gameOpponentAvatar = md.opponent?.username?.charAt(0).toUpperCase() ?? opponentAvatar;
    const totalPot   = Number(md.totalPool ?? stakeAmount * 2);
    const feeAmount  = Number(md.platformFee ?? 0);
    const winnings   = Number(md.payout ?? 0);

    setPlatformFee(feeAmount);
    setCoinResult(null);
    setIsWinner(won);
    setShowWinner(false);
    setGameState("flipping");

    setTimeout(() => {
      setCoinResult(result);
      if (won) {
        setWinAmount(winnings);
        setWinnerAvatar(playerAvatar);
        setWinnerName(myUsername);
      } else {
        setWinAmount(0);
        setWinnerAvatar(gameOpponentAvatar);
        setWinnerName(gameOpponentName);
      }
      if (!transactionRecorded.current) {
        transactionRecorded.current = true;
        refreshWalletsFromBackend().catch(() => {});
        addToSessionHistory({
          opponent: gameOpponentName, opponentAvatar: gameOpponentAvatar, result: won ? "win" : "loss",
          outcome: result, amount: won ? winnings - stakeAmount : stakeAmount, stake: stakeAmount,
        });
        addGameResult({
          gameType: "pvp_coinflip", betAmount: stakeAmount,
          winAmount: won ? winnings : 0, profit: won ? winnings - stakeAmount : -stakeAmount,
          won, opponent: gameOpponentName, outcome: result,
        });
        if (won) liveActivityService.addActivity("game_win", myUsername, `won in Coin Flip`, winnings - stakeAmount);
      }
      setGameState("showing_result");
      setTimeout(() => {
        setShowWinner(true);
        setTimeout(() => { setShowResultPopup(true); }, 2000);
      }, 2000);
    }, 2500);
  };

  const addToSessionHistory = (record: Omit<SessionRecord, "id" | "timestamp">) => {
    const newRecord: SessionRecord = {
      ...record,
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    setSessionHistory((prev) => [newRecord, ...prev].slice(0, 10));
  };

  const handleExit = () => {
    if (roomCode) navigate(`/game/pvp-coinflip/private?roomCode=${roomCode}&stake=${stakeAmount}`);
    else navigate("/game/pvp-coinflip");
  };

  const totalPot = Number(matchData?.totalPool ?? stakeAmount);
  const winnerGets = Number(matchData?.payout ?? (feeRate > 0 ? totalPot * (1 - feeRate) : 0));
  const feePercent = feeRate * 100;

  return (
    <ResponsiveLayout>
      {/* CLEAN HEADER - VERTICAL AUTO LAYOUT (Match Spin Battle) */}
      <div className="space-y-3 mb-6">
        {/* [Top Row] - Back Navigation */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/game/pvp-coinflip")}
            className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Back</span>
          </Button>
        </div>

        {/* [Title Row] - Spin Battle-style two-row header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
          <div className="min-w-0 flex items-center gap-[6px]">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Coin Flip</h1>
            <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stakeAmount)}</span>
          </div>
          <div className="flex items-center justify-end"><Button
  variant="outline"
  size="sm"
  onClick={() => setShowRules(!showRules)}
  className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 rounded-lg transition-all shrink-0"
>
  <Info className="h-4 w-4 mr-2" />
  Rules
</Button></div>
          <div className="col-start-1 flex items-center justify-start">
            <Button variant="outline" size="sm" onClick={() => setShowFairness(true)} className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Verify Fairness</Button>
          </div>
          <div></div>
        </div>

/* Game Rules Panel */}
        {showRules && (
          <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Play</h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Each player is randomly assigned HEADS or TAILS</li>
                <li>The coin is flipped automatically</li>
                <li>Winner takes 90% of the total pot (10% platform fee)</li>
                <li>Fair random outcome for every game</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Premium Info Stats - Single Card */}
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-3 gap-2 divide-x divide-gray-200 dark:divide-gray-700">
              <div className="text-center px-1">
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Bet</div>
                <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrencyNoDecimals(stakeAmount)}
                </div>
              </div>
              <div className="text-center px-1">
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Pool</div>
                <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrencyNoDecimals(totalPot)}
                </div>
              </div>
              <div className="text-center px-1">
                <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Winner</div>
                <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                  {formatCurrencyNoDecimals(winnerGets)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Game Card */}
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0a0f] dark:to-[#1a1a1a] border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8">
          {/* Players */}
          <div className="flex items-center justify-between mb-6">
            {/* Player (You) */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">
                <PlayerAvatar avatar={identity.avatar} />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{myUsername}</div>
            </div>

            {/* Center Info */}
            <div className="flex-1 mx-4 text-center">
              <div className="text-xs text-gray-700 dark:text-gray-400 bg-gray-200 dark:bg-gray-800/50 rounded px-3 py-1 inline-block">
                Balance: {formatCurrencyNoDecimals(balances.game)}
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl md:text-3xl mb-2 overflow-hidden">
                <PlayerAvatar avatar={opponentAvatar} />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{opponentName}</div>
            </div>
          </div>

          {/* Game Area */}
          <div className="min-h-[280px] flex flex-col items-center justify-center">
            {/* Idle State — no search or stake deduction until the user presses Search */}
            {gameState === "idle" && (
              <div className="text-center">
                <Button onClick={() => setGameState("searching")} className="px-10 py-5 text-lg">Search</Button>
              </div>
            )}

            {/* Searching State */}
            {gameState === "searching" && (
              <div className="text-center">
                <div className="mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
                <div className="text-base text-gray-300">Searching for opponent...</div>
              </div>
            )}

            {/* Matched State */}
            {gameState === "matched" && (
              <div className="text-center">
                <div className="text-4xl mb-3">✓</div>
                <div className="text-lg text-green-400 font-semibold">Opponent Found!</div>
                <div className="text-sm text-gray-400 mt-2">vs {opponentName}</div>
              </div>
            )}

            {/* Side Assignment State - Shows which side each player has */}
            {gameState === "side_assignment" && (
              <div className="text-center">
                <div className="text-xl font-bold text-amber-400 mb-6">Sides Assigned!</div>

                <div className="flex justify-center items-center gap-6 md:gap-10 mb-6">
                  {/* Your Side */}
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl md:text-4xl mb-3 shadow-xl shadow-blue-500/50 ring-4 ring-blue-400/30 overflow-hidden">
                      <PlayerAvatar avatar={identity.avatar} />
                    </div>
                    <div className="text-sm font-semibold text-blue-400 mb-2">{myUsername}</div>
                    <div className="text-2xl md:text-3xl font-bold text-white dark:text-white bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 rounded-xl shadow-lg border-2 border-blue-400">
                      {playerSide?.toUpperCase()}
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="text-3xl md:text-4xl font-bold text-gray-400">VS</div>

                  {/* Opponent Side */}
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-3xl md:text-4xl mb-3 shadow-xl shadow-red-500/50 ring-4 ring-red-400/30 overflow-hidden">
                      <PlayerAvatar avatar={opponentAvatar} />
                    </div>
                    <div className="text-sm font-semibold text-red-400 mb-2">{opponentName}</div>
                    <div className="text-2xl md:text-3xl font-bold text-white dark:text-white bg-gradient-to-r from-red-600 to-red-700 px-5 py-2.5 rounded-xl shadow-lg border-2 border-red-400">
                      {opponentSide?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-gray-400 mt-4 animate-pulse">Preparing to flip...</div>
              </div>
            )}

            {/* Flipping State */}
            {gameState === "flipping" && (
              <div className="text-center">
                <ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={true} />
                <div className="text-base text-gray-300 mt-4">Flipping...</div>
              </div>
            )}

            {/* Showing Result State */}
            {gameState === "showing_result" && (
              <div className="text-center">
                <div className="mx-auto mb-3">
                  <ProfessionalGoldCoin side={coinResult || "heads"} isAnimating={false} />
                </div>

                {/* Label showing result */}
                <div className="text-2xl font-bold text-amber-400 mb-6">
                  {coinResult?.toUpperCase()}
                </div>

                {/* Winner display - only show after delay */}
                {showWinner && (
                  <div className="mt-6">
                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-4xl md:text-5xl mx-auto mb-3 shadow-lg overflow-hidden ${
                      isWinner
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/50"
                        : "bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/50"
                    }`}>
                      <PlayerAvatar avatar={isWinner ? identity.avatar : winnerAvatar} />
                    </div>
                    <div className={`text-xl md:text-2xl font-bold ${isWinner ? "text-blue-400" : "text-red-400"}`}>
                      {winnerName}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">WINS</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Session History */}
      {sessionHistory.length > 0 && (
        <Card className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-300 mb-3">Your History (${stakeAmount} Stake)</h3>
            <div className="space-y-2">
              {sessionHistory.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2.5 rounded bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0"><PlayerAvatar avatar={identity.avatar} /></div>
                    <span className="text-[11px] text-gray-500 shrink-0">You</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${record.result === "win" ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"}`}>{record.result === "win" ? "WIN" : "LOSS"}</span>
                    <span className="text-xs text-gray-500 shrink-0">vs</span>
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0"><PlayerAvatar avatar={record.opponentAvatar ?? record.opponent.charAt(0).toUpperCase()} /></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{record.opponent}</span>
                    <span className="text-xs text-gray-500 shrink-0">• {record.outcome.toUpperCase()}</span>
                  </div>
                  <div className={`text-sm font-bold ml-2 shrink-0 ${record.result === "win" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {record.result === "win" ? "+" : "-"}{formatCurrencyNoDecimals(record.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Platform fee: {feePercent}% • Winner receives: {formatCurrencyNoDecimals(winnerGets)}
          </div>
        </div>
      </Card>

      {/* Fairness Modal */}
      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        gameType="pvp_coinflip"
        serverSeedHash={(matchData as any)?.serverSeedHash ?? ""}
        serverSeed={fairnessData?.serverSeed ?? null}
        clientSeed={fairnessData?.clientSeed ?? null}
        nonce={fairnessData?.nonce ?? null}
        result={coinResult ? { coinFlip: coinResult, won: isWinner } : undefined}
      />

      {/* Result Popup */}
      <Dialog open={showResultPopup} onOpenChange={setShowResultPopup}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-300 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className="text-5xl mb-3">
                {isWinner ? "🎉" : "😔"}
              </div>
              <div className={`text-3xl font-bold ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {isWinner ? `${myUsername} Wins!` : `${myUsername} Lost`}
              </div>
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 dark:text-gray-300">
              {isWinner ? `Congratulations ${myUsername}!` : "Better luck next time!"}
            </DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Amount</div>
              <div className={`text-3xl font-bold ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {isWinner ? "+" : "-"}{formatCurrencyNoDecimals(isWinner ? winAmount - stakeAmount : stakeAmount)}
              </div>
              {isWinner && (
                <div className="text-xs text-gray-600 dark:text-gray-500 mt-2">
                  Winnings: {formatCurrencyNoDecimals(winAmount)} (after {feePercent}% fee)
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 rounded p-3">
              <div className="flex justify-between mb-1">
                <span>New Balance:</span>
                <span className="text-gray-900 dark:text-white font-semibold">{formatCurrencyNoDecimals(balances.game)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setShowResultPopup(false); setShowWinner(false); setCoinResult(null); setMatchId(null); setMatchData(null); setGameState("ready"); }}
                className="w-auto bg-transparent hover:bg-white/5 dark:hover:bg-white/5 border-gray-400 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl px-4 py-2 text-sm font-medium"
              >
                <span className="mr-2" aria-hidden="true">⌕</span>
                Search for New Opponent
              </Button>
              <Button
                variant="outline"
                onClick={handleExit}
                className="w-auto bg-transparent hover:bg-white/5 dark:hover:bg-white/5 border-gray-400 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Back to Stake Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes flipCoin {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(1800deg);
          }
        }
      `}</style>
    </ResponsiveLayout>
  );
}