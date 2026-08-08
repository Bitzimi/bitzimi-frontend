import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { PremiumDice } from "../components/PremiumDice";
import { Card } from "../components/ui/card";
import { CardContent } from "../components/ui/card";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useGameStats } from "../contexts/GameStatsContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
// affiliateCommissionService removed — commissions handled server-side
import { ArrowLeft, Trophy, Info, Loader2, Shield } from "lucide-react";
import { useIdentity } from "../contexts/IdentityContext";
import { Button } from "../components/ui/button";
import { DiceDuelGameHistory, addDiceDuelGameToHistory } from "../components/DiceDuelGameHistory";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { gameMatchmakingService, fairnessService, type FairnessData } from "../services/gameMatchmakingService";
import { FairnessModal } from "../components/FairnessModal";
import { toast } from "sonner";

type GameState = "searching" | "matched" | "rolling" | "showing_result" | "result_popup";

export default function DiceDuelGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stake = parseInt(searchParams.get("stake") || "10");
  const privateMatchId = searchParams.get("matchId");
  const roomCode = searchParams.get("roomCode");

  const { formatCurrencyNoDecimals } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult } = useGameStats();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const myUsername = identity.username;

  const [gameState, setGameState] = useState<GameState>("searching");
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");

  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ SINGLE SOURCE OF TRUTH - Dice Results State
  // These values are generated ONCE and used EVERYWHERE:
  // - Dice animation (PremiumDice component)
  // - Winner calculation
  // - Result popup display
  // - Transaction records
  // - Game history
  // - Wallet updates
  // NOTE: 0 = waiting/reset state (dice shows "?"), 1-6 = actual dice values
  // ═══════════════════════════════════════════════════════════════════════════
  const [playerDice, setPlayerDice] = useState(0);
  const [opponentDice, setOpponentDice] = useState(0);
  const [isWinner, setIsWinner] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showFairness,  setShowFairness]  = useState(false);
  const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);
  // Real matchmaking state
  const [queueId, setQueueId]   = useState<string | null>(null);
  const [matchId, setMatchId]   = useState<string | null>(null);
  const [matchData, setMatchData] = useState<any>(null);

  const playerAvatar = identity.avatar;
  const transactionRecorded = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Platform fee calculations
  const PLATFORM_FEE_PERCENT = 0.1; // 10%
  const totalPool = stake * 2;
  const platformFee = totalPool * PLATFORM_FEE_PERCENT;
  const winnerPayout = totalPool - platformFee;

  // Real-player matchmaking — no bots, no fake opponents
  useEffect(() => {
    if (gameState !== "searching") return;
    let cancelled = false;

    const enterQueue = async () => {
      try {
        // Private match: skip queue, load pre-created match directly
        if (privateMatchId) {
          const match = await gameMatchmakingService.getMatch(privateMatchId);
          if (cancelled) return;
          setMatchId(privateMatchId);
          setMatchData(match);
          setOpponentName(match.opponent.username);
          setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
          setGameState("matched");
          return;
        }

        const result = await gameMatchmakingService.joinQueue("dice_clash", stake);
        if (cancelled) return;
        if (result.status === "matched" && result.matchId) {
          const match = await gameMatchmakingService.getMatch(result.matchId);
          if (cancelled) return;
          setMatchId(result.matchId);
          setMatchData(match);
          setOpponentName(match.opponent.username);
          setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
          setGameState("matched");
          return;
        }
        if (result.queueId) {
          setQueueId(result.queueId);
          pollIntervalRef.current = setInterval(async () => {
            if (cancelled) return;
            try {
              const status = await gameMatchmakingService.pollQueue(result.queueId!);
              if (status.status === "matched" && status.matchId) {
                clearInterval(pollIntervalRef.current!);
                const match = await gameMatchmakingService.getMatch(status.matchId);
                if (cancelled) return;
                setMatchId(status.matchId);
                setMatchData(match);
                setOpponentName(match.opponent.username);
                setOpponentAvatar(match.opponent.username.charAt(0).toUpperCase());
                setGameState("matched");
              } else if (status.status === "cancelled") {
                clearInterval(pollIntervalRef.current!);
                if (!cancelled) navigate("/dice-duel/clash");
              }
            } catch { /* keep polling */ }
          }, 2000);
        }
      } catch {
        if (!cancelled) navigate("/dice-duel/clash");
      }
    };

    enterQueue();
    return () => {
      cancelled = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [gameState]);

  useEffect(() => {
    // Auto-start game after match found
    if (gameState === "matched") {
      const timer = setTimeout(() => {
        startGame();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  useEffect(() => {
    if (!matchId) return;
    fairnessService.getMatchFairness(matchId).then(setFairnessData).catch(() => {});
  }, [matchId]);

  const startGame = () => {
    if (!matchData?.result) { navigate("/dice-duel/clash"); return; }
    transactionRecorded.current = false;

    // Backend already settled — read authoritative dice rolls and outcome
    const isP1: boolean      = matchData.isPlayer1;
    const playerRoll: number  = isP1 ? matchData.result.p1Roll : matchData.result.p2Roll;
    const opponentRoll: number = isP1 ? matchData.result.p2Roll : matchData.result.p1Roll;
    const won: boolean        = matchData.youWon;

    setPlayerDice(playerRoll);
    setOpponentDice(opponentRoll);
    setIsWinner(won);
    setGameState("rolling");

    setTimeout(() => {
      setGameState("showing_result");
      if (!transactionRecorded.current) {
        transactionRecorded.current = true;
        refreshWalletsFromBackend().catch(() => {});
        addGameResult({
          gameType: "dice_duel", betAmount: stake,
          winAmount: won ? winnerPayout : 0, profit: won ? winnerPayout - stake : -stake,
          won, opponent: opponentName, outcome: `Clash 1v1 - Roll ${playerRoll}`,
        });
        addDiceDuelGameToHistory({
          opponent: opponentName, result: won ? "win" : "loss",
          playerRoll, opponentRoll, stake, winnings: won ? winnerPayout : 0,
        });
        addNotification(
          won ? "game_win" : "game_loss",
          won ? "🎉 Dice Clash Victory!" : "Dice Clash",
          won
            ? `Won ${formatCurrencyNoDecimals(winnerPayout - stake)} vs ${opponentAvatar} ${opponentName} (${playerRoll} vs ${opponentRoll})`
            : `Lost ${formatCurrencyNoDecimals(stake)} vs ${opponentAvatar} ${opponentName} (${playerRoll} vs ${opponentRoll})`,
          { game: "dice_clash", stake, payout: won ? winnerPayout : 0, opponent: opponentName }
        );
        if (won) liveActivityService.addActivity("game_win", myUsername, `won in Dice Clash`, winnerPayout - stake);
      }
      setTimeout(() => { setShowResultPopup(true); }, 1500);
    }, 2200);
  };

  const handleExit = () => {
    if (roomCode) navigate(`/dice-duel/clash/private?roomCode=${roomCode}&stake=${stake}`);
    else navigate("/dice-duel/clash");
  };

  return (
    <ResponsiveLayout>
      <div className="bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-white p-4 md:p-6 -m-4 md:-m-8 min-h-full">
        <div className="max-w-6xl mx-auto pt-4 md:pt-6">
          {/* CLEAN HEADER - VERTICAL AUTO LAYOUT (Match Spin Battle) */}
          <div className="space-y-3 mb-6">
            {/* [Top Row] - Back Navigation */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dice-duel/clash")}
                className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Back</span>
              </Button>
            </div>

            {/* [Title Row] - Title + Stake Room + Rules Button (Same Line) */}
            <div className="flex items-center justify-between gap-4">
              {/* Left: Title + Stake Room */}
              <div className="flex items-baseline gap-[6px]">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Dice Clash</h1>
                <span className="text-sm text-gray-500 whitespace-nowrap">- Stake Room {formatCurrencyNoDecimals(stake)}</span>
              </div>

              {/* Right: Fairness + Rules Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFairness(true)} className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Verify Fairness</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRules(!showRules)}
                  className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 rounded-lg transition-all shrink-0"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Rules
                </Button>
              </div>
            </div>

            {/* Game Rules Panel */}
            {showRules && (
              <Card className="border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Play</h3>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 list-disc list-inside">
                    <li>1v1 dice battle - highest roll wins</li>
                    <li>Each player rolls one dice (1-6)</li>
                    <li>Winner takes 90% of the total pot (10% platform fee)</li>
                    <li>Fair random outcome for every game</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Premium Info Stats - Single Card */}
            <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700">
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-4 gap-2 divide-x divide-gray-200 dark:divide-gray-700">
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Bet</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(stake)}
                    </div>
                  </div>
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Pool</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(totalPool)}
                    </div>
                  </div>
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Winner</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                      {formatCurrencyNoDecimals(winnerPayout)}
                    </div>
                  </div>
                  <div className="text-center px-1">
                    <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Players</div>
                    <div className="text-sm md:text-base font-bold text-gray-900 dark:text-white">
                      1/1
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

        {/* Game Area */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 mb-6 shadow-sm">

          {/* Players */}
          {gameState !== "searching" && (
            <div className="flex justify-between items-center mb-8">
              {/* Player */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl md:text-4xl mb-2 shadow-xl shadow-blue-500/50 ring-4 ring-blue-400/30 overflow-hidden">
                  <PlayerAvatar avatar={identity.avatar} />
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{myUsername}</div>
                <div className="text-xs text-gray-600 dark:text-gray-500">{formatCurrencyNoDecimals(stake)}</div>
              </div>

              {/* VS */}
              <div className="text-2xl md:text-3xl font-bold text-gray-600 dark:text-gray-500">VS</div>

              {/* Opponent */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-3xl md:text-4xl mb-2 shadow-xl shadow-red-500/50 ring-4 ring-red-400/30 overflow-hidden">
                  <PlayerAvatar avatar={opponentAvatar} />
                </div>
                <div className="text-sm font-semibold text-red-500 dark:text-red-400">{opponentName}</div>
                <div className="text-xs text-gray-600 dark:text-gray-500">{formatCurrencyNoDecimals(stake)}</div>
              </div>
            </div>
          )}

          {/* Game States */}
          {gameState === "searching" && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
              <div className="animate-pulse text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                Finding a real opponent...
              </div>
              <div className="text-sm text-zinc-500">
                {queueId ? "Waiting for another player with the same stake" : "Joining matchmaking queue..."}
              </div>
              <div className="flex justify-center gap-2 mt-4">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {gameState === "matched" && (
            <div className="text-center py-12">
              <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                Match Found!
              </div>
              <div className="text-gray-600 dark:text-gray-400">Preparing to roll...</div>
            </div>
          )}

          {(gameState === "rolling" || gameState === "showing_result" || gameState === "result_popup") && (
            <div className="text-center py-8">
              {/* ✅ Dice Display - Uses state values (playerDice, opponentDice) */}
              <div className="flex justify-center items-center gap-8 md:gap-16 mb-8">
                <div className="flex flex-col items-center">
                  <PremiumDice
                    value={playerDice}
                    isRolling={gameState === "rolling"}
                    playerColor="blue"
                  />
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">{myUsername}</div>
                </div>

                <div className="flex flex-col items-center">
                  <PremiumDice
                    value={opponentDice}
                    isRolling={gameState === "rolling"}
                    playerColor="red"
                  />
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-3">{opponentName}</div>
                </div>
              </div>

              {/* Status */}
              {gameState === "rolling" && (
                <div className="text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                  Rolling...
                </div>
              )}

              {gameState === "showing_result" && !showResultPopup && (
                <div className="space-y-2">
                  {/* ✅ Result uses state value (isWinner) */}
                  <div className={`text-2xl md:text-3xl font-bold ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {isWinner ? `${myUsername} Wins!` : `${myUsername} Lost`}
                  </div>
                  {/* ✅ Dice values use state (playerDice, opponentDice) */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {myUsername}: {playerDice} | {opponentName}: {opponentDice}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Game History */}
        <DiceDuelGameHistory stake={stake} />

        {/* Fairness Modal */}
        <FairnessModal
          isOpen={showFairness}
          onClose={() => setShowFairness(false)}
          gameType="dice_clash"
          serverSeedHash={(matchData as any)?.serverSeedHash ?? ""}
          serverSeed={fairnessData?.serverSeed ?? null}
          clientSeed={fairnessData?.clientSeed ?? null}
          nonce={fairnessData?.nonce ?? null}
          result={matchData?.result ? { playerRoll: playerDice, opponentRoll: opponentDice, won: isWinner } : undefined}
        />

        {/* ✅ Result Popup - Uses state values (isWinner, playerDice, opponentDice) */}
        {showResultPopup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                {/* Trophy/Icon */}
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isWinner ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
                }`}>
                  {isWinner ? <Trophy className="w-12 h-12" /> : <span className="text-5xl">💔</span>}
                </div>

                {/* Result */}
                <div className={`text-3xl font-bold mb-2 ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {isWinner ? "YOU WIN!" : "YOU LOSE"}
                </div>

                {/* Dice Results - Log what we're showing */}
                {console.log(`📊 POPUP showing - You: ${playerDice}, Opponent: ${opponentDice}`)}
                <div className="text-gray-700 dark:text-gray-300 mb-4">
                  You rolled: <span className="font-bold text-blue-600 dark:text-blue-400">{playerDice}</span>
                  <br />
                  {opponentName} rolled: <span className="font-bold text-red-600 dark:text-red-400">{opponentDice}</span>
                </div>

                {/* Amount */}
                <div className={`text-4xl font-bold mb-6 ${isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {isWinner ? "+" : "-"}{formatCurrencyNoDecimals(isWinner ? winnerPayout - stake : stake)}
                </div>

                {isWinner && (
                  <div className="text-xs text-gray-600 dark:text-gray-500 mb-6">
                    Stake: {formatCurrencyNoDecimals(stake)} | Winnings: {formatCurrencyNoDecimals(winnerPayout)} | Net: +{formatCurrencyNoDecimals(winnerPayout - stake)}
                  </div>
                )}

                {/* Buttons */}
                <div>
                  <Button
                    onClick={handleExit}
                    variant="outline"
                    className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
                  >
                    Back to Stake Selection
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </ResponsiveLayout>
  );
}
