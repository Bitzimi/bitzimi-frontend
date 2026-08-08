import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Zap, Lock } from "lucide-react";
import { useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";

type StakeOption = {
  amount: number;
  color: string;
  gradient: string;
};

const stakeOptions: StakeOption[] = [
  { amount: 1, color: "from-yellow-500/10 to-yellow-600/10", gradient: "border-yellow-500/40 hover:border-yellow-500/70" },
  { amount: 5, color: "from-amber-500/10 to-amber-600/10", gradient: "border-amber-500/40 hover:border-amber-500/70" },
  { amount: 10, color: "from-orange-500/10 to-orange-600/10", gradient: "border-orange-500/40 hover:border-orange-500/70" },
  { amount: 20, color: "from-red-500/10 to-red-600/10", gradient: "border-red-500/40 hover:border-red-500/70" },
  { amount: 50, color: "from-purple-500/10 to-purple-600/10", gradient: "border-purple-500/40 hover:border-purple-500/70" },
  { amount: 100, color: "from-blue-500/10 to-blue-600/10", gradient: "border-blue-500/40 hover:border-blue-500/70" },
  { amount: 200, color: "from-teal-500/10 to-teal-600/10", gradient: "border-teal-500/40 hover:border-teal-500/70" },
  { amount: 500, color: "from-green-500/10 to-green-600/10", gradient: "border-green-500/40 hover:border-green-500/70" },
];

export default function ReactionTapStakeSelection() {
  const navigate = useNavigate();
  const { formatCurrencyNoDecimals } = useSettings();

  const handlePlayNow = (stakeAmount: number) => {
    navigate(`/game/reaction-tap/play?stake=${stakeAmount}`);
  };

  const handlePrivateMatch = (stakeAmount: number) => {
    navigate(`/game/reaction-tap/private?stake=${stakeAmount}`);
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/games")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Games
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold">Reaction Tap</h2>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              1v1 • Fastest tap wins • Select your stake
            </p>
          </div>
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
                <div className="text-xs text-green-600 dark:text-green-400 mt-1 font-semibold">
                  Win: {formatCurrencyNoDecimals(stake.amount * 2 * 0.9)}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-4" />

              {/* Play Button */}
              <Button
                className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold shadow-sm"
                onClick={() => handlePlayNow(stake.amount)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Match
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                onClick={() => handlePrivateMatch(stake.amount)}
              >
                <Lock className="h-3 w-3 mr-1" />
                Private Match
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
        <div className="p-6">
          <div className="flex gap-3">
            <div className="text-4xl">⚡</div>
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                How to Play
              </h3>
              <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                <li>• Get matched instantly with an opponent</li>
                <li>• Wait for countdown and "WAIT..." signal</li>
                <li>• Tap as fast as possible when "TAP NOW!" appears</li>
                <li>• Fastest tap wins 90% of the pool</li>
                <li>• <strong className="text-red-600 dark:text-red-400">WARNING:</strong> Tapping too early = instant loss!</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </ResponsiveLayout>
  );
}
