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
// diceGameService removed — round numbers come from backend (diceRoyaleService)
// affiliateCommissionService removed — backend handles all commission logic (Phase 3F Section D)
import { DiceRoyaleGameHistory, addDiceRoyaleGameToHistory } from "../components/DiceRoyaleGameHistory";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { ArrowLeft, Users, Trophy, RefreshCw, Info, Shield } from "lucide-react";
import { Button } from "../components/ui/button";
import { useIdentity } from "../contexts/IdentityContext";
import { FairnessModal } from "../components/FairnessModal";
import { toast } from "sonner";

type GameState = "joining" | "countdown" | "locked" | "rolling" | "showing_result" | "result_popup";

interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  diceValue: number;
  isYou: boolean;
}

import { diceRoyaleService, fairnessService, type FairnessData } from "../services/gameMatchmakingService";
// Bot name pools removed — real players only via matchmaking API

// Color pool - distinct colors (no similar shades)
const COLORS = [
  { bg: "from-blue-500 to-blue-600", ring: "ring-blue-400/30", shadow: "shadow-blue-500/50", name: "blue" },
  { bg: "from-green-500 to-green-600", ring: "ring-green-400/30", shadow: "shadow-green-500/50", name: "green" },
  { bg: "from-purple-500 to-purple-600", ring: "ring-purple-400/30", shadow: "shadow-purple-500/50", name: "purple" },
  { bg: "from-cyan-500 to-cyan-600", ring: "ring-cyan-400/30", shadow: "shadow-cyan-500/50", name: "cyan" },
  { bg: "from-pink-500 to-pink-600", ring: "ring-pink-400/30", shadow: "shadow-pink-500/50", name: "pink" },
  { bg: "from-yellow-500 to-yellow-600", ring: "ring-yellow-400/30", shadow: "shadow-yellow-500/50", name: "yellow" },
];

// generateMockPlayer removed — real players only via diceRoyaleService

export default function DiceRoyaleGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStake = parseInt(searchParams.get("stake") || "10");

  const { formatCurrencyNoDecimals } = useSettings();
  const { balances, refreshWalletsFromBackend } = useWallet();
  const { addGameResult } = useGameStats();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();
  const myUsername = identity.username;
  const myUserId = identity.userId;

  const [stake, setStake] = useState(initialStake);
  const [gameState, setGameState] = useState<GameState>("joining");
  const [players, setPlayers] = useState<Player[]>([]);
  const [countdown, setCountdown] = useState(30);
  const [isWinner, setIsWinner] = useState(false);
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1); // updated from backend when round is fetched
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showFairness,  setShowFairness]  = useState(false);
  const [fairnessData,  setFairnessData]  = useState<FairnessData | null>(null);

  // identity.avatar is always set (uploaded image or first letter of username)
  const playerAvatar = identity.avatar;
  const transactionRecorded = useRef(false);
  const stakeDeducted = useRef(false);
  const usedAvatars = useRef<Set<string>>(new Set());
  const usedColorIndices = useRef<Set<number>>(new Set());
  const finalPlayerCount = useRef<number>(0); // Random final count for this round (2-6)
  const stopAddingPlayers = useRef(false);

  // Platform fee and payout calculations (DYNAMIC based on current players)
  const PLATFORM_FEE_PERCENT = 0.1;
  const maxPlayers = 6; // Always show /6

  const totalPool = stake * players.length; // Dynamic based on actual players
  const platformFee = totalPool * PLATFORM_FEE_PERCENT;
  const winnerPayout = totalPool - platformFee;

  // Polling ref for round state updates
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  // Build a Player object for display — real players shown as "Player N"
  // until Phase 3H wires full profile lookup
  const buildPlayerEntry = (id: string, index: number, isYou: boolean): Player => ({
    id,
    name: isYou ? myUsername : `Player ${index + 1}`,
    avatar: isYou ? playerAvatar : String.fromCharCode(65 + (index % 26)), // A, B, C...
    color: COLORS[index % COLORS.length].bg,
    diceValue: 0,
    isYou,
  });

  // Initialize game — fetch current round from backend, show JOIN ROUND button.
  // No auto-join, no bots. Section F: user manually clicks JOIN ROUND.
  const initializeGame = async () => {
    if (balances.game < stake) {
      toast.error("Insufficient Game Wallet balance");
      navigate("/dice-duel/royale");
      return;
    }

    setShowResultPopup(false);
    setWinnerPlayer(null);
    transactionRecorded.current = false;
    stakeDeducted.current = false;
    stopAddingPlayers.current = false;

    try {
      const round = await diceRoyaleService.getRound(stake);
      setRoundId(round.roundId);
      setRoundNumber(round.roundNumber);
      setServerSeedHash((round as any).serverSeedHash ?? "");
      setCountdown(round.timeRemaining ?? 30);
      setGameState(["open"].includes(round.status) ? "joining" : "countdown");
      setPlayers([]); // real players populated via polling
      startPolling(round.roundId);
    } catch {
      // Backend unavailable — show empty joining state
      setGameState("joining");
      setPlayers([]);
    }
  };

  const startPolling = (rid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const round = await diceRoyaleService.pollRound(rid);
        setRoundNumber(round.roundNumber);
        setCountdown(round.timeRemaining ?? 0);

        if (round.status === "countdown" && gameState !== "countdown" && gameState !== "locked" && gameState !== "rolling" && gameState !== "showing_result" && gameState !== "result_popup") {
          setGameState("countdown");
        } else if (round.status === "locked") {
          setGameState("locked");
        } else if (round.status === "rolling") {
          setGameState("rolling");
        } else if ((round.status === "result" || round.status === "completed") && round.resultData) {
          clearInterval(pollRef.current!);
          processBackendResult(round.resultData);
          fairnessService.getDiceRoundFairness(rid).then(setFairnessData).catch(() => {});
        }
      } catch { /* keep polling */ }
    }, 1000);
  };

  const processBackendResult = (resultData: Record<string, any>) => {
    if (!resultData?.rolls || !resultData?.winnerId) return;
    const allIds = Object.keys(resultData.rolls);
    const newPlayers: Player[] = allIds.map((id, i) => buildPlayerEntry(id, i, id === identity.userId));
    newPlayers.forEach(p => { p.diceValue = resultData.rolls[p.id] ?? 0; });
    setPlayers(newPlayers);

    const iAmWinner = resultData.winnerId === identity.userId;
    setIsWinner(iAmWinner);
    const winner = newPlayers.find(p => p.id === resultData.winnerId) ?? null;
    setWinnerPlayer(winner);
    setGameState("showing_result");

    if (!transactionRecorded.current) {
      transactionRecorded.current = true;
      // Backend already applied wallet changes — refresh display balance
      refreshWalletsFromBackend().catch(() => {});
      const yourRoll = newPlayers.find(p => p.isYou)?.diceValue ?? 0;
      const payout   = resultData.payout ?? 0;
      addGameResult({
        gameType: "dice_duel", betAmount: stake,
        winAmount: iAmWinner ? payout : 0, profit: iAmWinner ? payout - stake : -stake,
        won: iAmWinner, opponent: `${newPlayers.length - 1} players`,
        outcome: `Royale ${newPlayers.length}P - Roll ${yourRoll}`,
      });
      addDiceRoyaleGameToHistory({
        playerCount: newPlayers.length, result: iAmWinner ? "win" : "loss",
        playerRoll: yourRoll, winningRoll: winner?.diceValue ?? 0,
        stake, winnings: iAmWinner ? payout : 0,
      });
      addNotification(
        iAmWinner ? "game_win" : "game_loss",
        iAmWinner ? "🎉 Dice Royale Victory!" : "Dice Royale",
        iAmWinner
          ? `Won ${formatCurrencyNoDecimals(payout - stake)} in ${newPlayers.length}-player battle (Roll: ${yourRoll})`
          : `Lost ${formatCurrencyNoDecimals(stake)} in ${newPlayers.length}-player battle (Roll: ${yourRoll})`,
        { game: "dice_royale", stake, payout: iAmWinner ? payout : 0, playerCount: newPlayers.length }
      );
      if (iAmWinner) liveActivityService.addActivity("game_win", myUsername, `won in Dice Royale`, payout - stake);
    }
    setTimeout(() => setShowResultPopup(true), 2000);
  };

  useEffect(() => {
    initializeGame();
    // Round number is now sourced from backend response, not diceGameService
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // JOIN ROUND handler — called when user clicks the JOIN ROUND button
  const handleJoinRound = async () => {
    if (!roundId || stakeDeducted.current) return;
    try {
      const result = await diceRoyaleService.joinRound(roundId, stake);
      stakeDeducted.current = true;
      // Backend deducted stake — refresh display balance
      refreshWalletsFromBackend().catch(() => {});
      setRoundNumber(result.roundNumber ?? roundNumber);
      if (result.status === "countdown") setGameState("countdown");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to join round");
    }
  };


  // Countdown timer — drives display only; backend polling drives state transitions
  useEffect(() => {
    if (gameState === "countdown" || gameState === "locked") {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown((prev) => prev - 1);
          if (countdown === 5 && gameState === "countdown") {
            setGameState("locked");
            stopAddingPlayers.current = true;
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
      // countdown === 0: backend polling detects "rolling"/"result" and calls processBackendResult
    }
  }, [countdown, gameState]);

  // Section I: Play Again → return to stake selection, user manually joins a round
  const handlePlayAgain = () => {
    navigate("/dice-duel/royale");
  };

  // Change Stake button removed per Section F

  const handleExit = () => {
    navigate("/dice-duel");
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
              onClick={handleExit}
              className="hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 -ml-3"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Exit</span>
            </Button>
          </div>

          {/* [Title Row] - Title + LIVE indicator + Rules Button */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title + LIVE + Round */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Dice Royale</h1>
              <div className="flex items-center gap-2">
                {/* LIVE indicator — same as Spin Battle */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10">
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <div className="absolute inset-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping opacity-75" />
                  </div>
                  <span className="text-xs font-semibold text-red-500">LIVE</span>
                </div>
                {/* Round number comes from backend via startPolling */}
                <span className="text-xs text-gray-500 dark:text-gray-400">Round #{roundNumber}</span>
              </div>
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
                  <li>Battle royale with 2-6 players</li>
                  <li>Each player rolls one dice (1-6)</li>
                  <li>Highest roll wins the entire pot</li>
                  <li>Winner gets 90% of total pool (10% platform fee)</li>
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
                    {players.length}/6
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Game Area */}
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 md:p-6 mb-6 shadow-sm">

          {/* Countdown */}
          {(gameState === "countdown" || gameState === "locked") && (
            <div className="text-center mb-4 py-4 border-y border-gray-200 dark:border-gray-800">
              <div
                className={`text-5xl md:text-6xl font-bold mb-2 ${
                  countdown <= 5 ? "text-red-500 animate-pulse" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {countdown}
              </div>
              <div className={`text-sm font-semibold ${gameState === "locked" ? "text-red-500 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>
                {gameState === "locked" ? "🔒 NO MORE BETS" : "Game starting soon..."}
              </div>
            </div>
          )}

          {/* Status Messages */}
          {gameState === "joining" && players.length === 1 && (
            <div className="text-center py-12">
              <div className="animate-pulse text-xl font-bold text-amber-600 dark:text-amber-400 mb-4">
                Searching for players...
              </div>
              <div className="flex justify-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {gameState === "joining" && players.length > 1 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Waiting for more players...
            </div>
          )}

          {/* Players Grid - 3 columns × 2 rows layout */}
          {players.length > 1 && (
            <div className="grid grid-cols-3 gap-3">
              {players.map((player) => {
                const colorData = COLORS.find((c) => c.bg === player.color) || COLORS[0];
                const isHighlight = gameState === "showing_result" && player.id === winnerPlayer?.id;

                return (
                  <div
                    key={player.id}
                    className={`bg-gray-50 dark:bg-gray-800/50 border rounded-lg p-3 text-center transition-all ${
                      isHighlight
                        ? "border-amber-500 dark:border-amber-400 ring-2 ring-amber-400/30 scale-105 shadow-lg shadow-amber-500/20"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br ${player.color} flex items-center justify-center text-2xl shadow-md ${colorData.shadow} ring-2 ${colorData.ring} overflow-hidden`}
                    >
                      <PlayerAvatar avatar={player.avatar} />
                    </div>

                    {/* Name */}
                    <div className={`text-xs font-semibold mb-2 truncate ${player.isYou ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {player.name}
                    </div>

                    {/* Dice */}
                    {(gameState === "rolling" || gameState === "showing_result" || gameState === "result_popup") && (
                      <div className="flex justify-center">
                        <div className="scale-[0.65]">
                          <PremiumDice
                            value={player.diceValue}
                            isRolling={gameState === "rolling"}
                            playerColor={player.isYou ? "blue" : "red"}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Winner Display */}
          {gameState === "showing_result" && winnerPlayer && (
            <div className="text-center py-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-amber-600 dark:text-amber-400 animate-pulse" />
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                {winnerPlayer.name} Wins!
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Roll: <span className="font-bold text-amber-600 dark:text-amber-400">{winnerPlayer.diceValue}</span> • Prize: {formatCurrencyNoDecimals(winnerPayout)}
              </div>
            </div>
          )}

          {/* Balance */}
          <div className="text-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="text-xs text-gray-600 dark:text-gray-500 mb-1">Game Wallet Balance</div>
            <div className="text-base font-bold text-green-600 dark:text-green-400">
              {formatCurrencyNoDecimals(balances.game)}
            </div>
          </div>
        </div>

        {/* Game History */}
        <DiceRoyaleGameHistory stake={stake} />

        {/* Fairness Modal */}
        <FairnessModal
          isOpen={showFairness}
          onClose={() => setShowFairness(false)}
          gameType="dice_royale"
          roundNumber={roundNumber}
          serverSeedHash={serverSeedHash}
          serverSeed={fairnessData?.serverSeed ?? null}
          clientSeed={fairnessData?.clientSeed ?? null}
          nonce={fairnessData?.nonce ?? null}
          result={winnerPlayer ? { winnerId: winnerPlayer.id, winnerName: winnerPlayer.name, rolls: players.reduce((acc, p) => ({ ...acc, [p.id]: p.diceValue }), {}) } : undefined}
        />

        {/* Result Popup */}
        {showResultPopup && winnerPlayer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-2 border-gray-300 dark:border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                {/* Icon */}
                <div
                  className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    isWinner ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
                  }`}
                >
                  {isWinner ? <Trophy className="w-12 h-12" /> : <span className="text-5xl">💔</span>}
                </div>

                {/* Result */}
                <div className={`text-3xl font-bold mb-2 ${isWinner ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {isWinner ? "YOU WIN!" : "YOU LOSE"}
                </div>

                {/* Details */}
                <div className="text-gray-700 dark:text-gray-300 mb-4 space-y-1">
                  <div>
                    Your roll: <span className="font-bold text-blue-600 dark:text-blue-400">{players.find((p) => p.isYou)?.diceValue}</span>
                  </div>
                  <div>
                    Winner: <span className="font-bold text-amber-600 dark:text-amber-400">{winnerPlayer.name}</span> ({winnerPlayer.diceValue})
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-500">{players.length} players competed</div>
                </div>

                {/* Amount */}
                <div className={`text-4xl font-bold mb-6 ${isWinner ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {isWinner ? "+" : "-"}
                  {formatCurrencyNoDecimals(isWinner ? winnerPayout - stake : stake)}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                  <Button onClick={handlePlayAgain} className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6">
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Play Again
                  </Button>
                  <Button onClick={handleExit} variant="outline" className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                    Exit
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
