import { useState } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";

type StakeOption = {
  amount: number;
  color: string;
  gradient: string;
};

const stakeOptions: StakeOption[] = [
  { amount: 1, color: "from-blue-500/10 to-blue-600/10", gradient: "border-blue-500/40 hover:border-blue-500/70" },
  { amount: 5, color: "from-indigo-500/10 to-indigo-600/10", gradient: "border-indigo-500/40 hover:border-indigo-500/70" },
  { amount: 10, color: "from-purple-500/10 to-purple-600/10", gradient: "border-purple-500/40 hover:border-purple-500/70" },
  { amount: 20, color: "from-pink-500/10 to-pink-600/10", gradient: "border-pink-500/40 hover:border-pink-500/70" },
  { amount: 50, color: "from-teal-500/10 to-teal-600/10", gradient: "border-teal-500/40 hover:border-teal-500/70" },
  { amount: 100, color: "from-orange-500/10 to-orange-600/10", gradient: "border-orange-500/40 hover:border-orange-500/70" },
  { amount: 200, color: "from-amber-500/10 to-amber-600/10", gradient: "border-amber-500/40 hover:border-amber-500/70" },
  { amount: 500, color: "from-yellow-500/10 to-yellow-600/10", gradient: "border-yellow-500/40 hover:border-yellow-500/70" },
];

export default function PvPCoinFlip() {
  const navigate = useNavigate();
  const { formatCurrencyNoDecimals, convertFromUSD } = useSettings();

  const handlePlayNow = (stakeAmount: number) => {
    navigate(`/game/pvp-coinflip/play?stake=${stakeAmount}`);
  };

  const handlePrivateMatch = (stakeAmount: number) => {
    navigate(`/game/pvp-coinflip/private?stake=${stakeAmount}`);
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/games")}
          className="mb-3 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Games
        </Button>

        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
            Coin Flip <span className="text-gray-400 dark:text-gray-500 font-normal">·</span> Select Stake
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Choose your stake. Get matched instantly.
          </p>
        </div>
      </div>

      {/* Stake Selection Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
        {stakeOptions.map((stake) => (
          <Card
            key={stake.amount}
            className={`bg-gradient-to-br ${stake.color} border-2 ${stake.gradient} backdrop-blur-sm overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="p-4 md:p-6">
              {/* Stake Amount */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Stake Amount
                </div>
                <div className="text-2xl md:text-3xl font-bold">
                  {formatCurrencyNoDecimals(stake.amount)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Win up to {formatCurrencyNoDecimals(stake.amount * 2)}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-4" />

              {/* Buttons */}
              <div className="space-y-2">
                <Button
                  className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold shadow-sm"
                  onClick={() => handlePlayNow(stake.amount)}
                >
                  Play Now
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-xs border-gray-300 dark:border-gray-600"
                  onClick={() => handlePrivateMatch(stake.amount)}
                >
                  Private Match
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="text-2xl">🪙</div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                How PvP Coin Flip Works
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Select your stake and get instantly matched</li>
                <li>• Coin flips automatically, winner takes all</li>
                <li>• Winner receives pot minus 10% platform fee</li>
                <li>• Fast, fair, and fully transparent</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </ResponsiveLayout>
  );
}
