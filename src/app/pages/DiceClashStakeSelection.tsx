import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { ArrowLeft, Lock } from "lucide-react";

const STAKES = [1, 5, 10, 20, 50, 100, 200, 500];

export default function DiceClashStakeSelection() {
  const navigate = useNavigate();
  const { formatCurrencyNoDecimals, needsSmallFont } = useSettings();
  const { balances } = useWallet();

  const handleStakeSelect = (stake: number) => {
    navigate(`/dice-duel/clash/game?stake=${stake}`);
  };

  const handlePrivateMatch = (stake: number) => {
    navigate(`/dice-duel/clash/private?stake=${stake}`);
  };

  return (
    <ResponsiveLayout>
      <div className="bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-white p-4 md:p-6 -m-4 md:-m-8 min-h-full">
        {/* Header */}
        <div className="max-w-6xl mx-auto pt-4 md:pt-6">
          <button
            onClick={() => navigate("/dice-duel")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-sm font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
              Dice Clash (1v1)
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Select your stake and find an opponent</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Balance</div>
            <div className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrencyNoDecimals(balances.game)}</div>
          </div>
        </div>

        {/* Stake Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {STAKES.map((stake) => {
            const canAfford = balances.game >= stake;
            const totalPool = stake * 2;
            const platformFee = totalPool * 0.1;
            const winnerPayout = totalPool - platformFee;

            return (
              <Card
                key={stake}
                className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 shadow-sm"
              >
                <div className="p-3 text-center space-y-2">
                  <div className={`font-bold text-gray-900 dark:text-white ${needsSmallFont() ? "text-lg" : "text-2xl"}`}>
                    {formatCurrencyNoDecimals(stake)}
                  </div>

                  <div className="text-xs text-gray-600 dark:text-gray-500 leading-tight">
                    Win {formatCurrencyNoDecimals(winnerPayout)}
                  </div>

                  <button
                    onClick={() => canAfford && handleStakeSelect(stake)}
                    className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition-colors ${
                      canAfford
                        ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                        : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                    }`}
                    disabled={!canAfford}
                  >
                    {canAfford ? "Quick Match" : "Insufficient"}
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => canAfford && handlePrivateMatch(stake)}
                    disabled={!canAfford}
                    className="w-full text-xs border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-40"
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Private
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Game Info */}
        <div className="mt-8 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">How to Play</h2>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-bold">1.</span>
              <span>Select a stake amount from the options above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-bold">2.</span>
              <span>System will match you with an opponent at the same stake level</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-bold">3.</span>
              <span>Both players roll a dice (1-6)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-bold">4.</span>
              <span className="font-bold text-green-600 dark:text-green-400">Higher roll wins</span> - Winner takes the pot minus 10% platform fee
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-bold">5.</span>
              <span>In case of a tie, automatic re-roll</span>
            </li>
          </ul>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Example ({formatCurrencyNoDecimals(10)} stake):</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <div>• Total Pool: {formatCurrencyNoDecimals(20)} ({formatCurrencyNoDecimals(10)} × 2 players)</div>
              <div>• Platform Fee (10%): {formatCurrencyNoDecimals(2)}</div>
              <div>• Winner Receives: <span className="text-green-600 dark:text-green-400 font-bold">{formatCurrencyNoDecimals(18)}</span></div>
              <div>• Loser Receives: <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrencyNoDecimals(0)}</span></div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
