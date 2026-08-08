import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";

const STAKES = [1, 5, 10, 20, 50, 100, 200, 500];
const LIVE_PLAYERS: Record<number, number | null> = {
  1: null,
  5: 2238,
  10: null,
  20: null,
  50: null,
  100: null,
  200: null,
  500: null,
};

export default function DiceArenaLobbySelection() {
  const navigate = useNavigate();
  const { formatCurrencyNoDecimals, needsSmallFont } = useSettings();
  const { balances } = useWallet();

  const handleStakeSelect = (stake: number) => {
    if (balances.game < stake) {
      toast.error("Insufficient balance in Game Wallet");
      return;
    }
    navigate(`/dice-duel/arena/game?stake=${stake}`);
  };

  return (
    <ResponsiveLayout>
      <div className="min-h-full -m-4 md:-m-8 bg-[#0d0f14] text-white p-4">
        <div className="max-w-2xl mx-auto pt-2">
          <button
            onClick={() => navigate("/dice-duel")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-base font-bold text-purple-400">Dice Arena</h1>
              <p className="text-xs text-gray-500">Select your stake — Top 2 players win</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Balance</div>
              <div className="text-sm font-bold text-green-400">{formatCurrencyNoDecimals(balances.game)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {STAKES.map((stake) => {
              const canAfford = balances.game >= stake;
              const prizePool = stake * 6 * 0.9;
              const firstPlace = prizePool * 0.6;
              const secondPlace = prizePool * 0.4;
              const liveCount = LIVE_PLAYERS[stake];

              return (
                <div
                  key={stake}
                  className="relative bg-[#1a1d2e] border border-[#2a2d3e] rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => canAfford && handleStakeSelect(stake)}
                >
                  {liveCount && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-green-500/20 border border-green-500/40 rounded-full px-2 py-0.5">
                      <Users className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] font-semibold text-green-400">{liveCount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="p-4 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>3-6 Players</span>
                    </div>

                    <div className={`font-bold text-white leading-none ${needsSmallFont() ? "text-2xl" : "text-3xl"}`}>
                      {formatCurrencyNoDecimals(stake)}
                    </div>

                    <div className="text-xs text-gray-400 space-y-0.5 text-center leading-tight">
                      <div className="flex items-center justify-center gap-1">
                        <span>🥇</span>
                        <span>Up to {formatCurrencyNoDecimals(firstPlace)}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span>🥈</span>
                        <span>Up to {formatCurrencyNoDecimals(secondPlace)}</span>
                      </div>
                    </div>

                    <button
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        canAfford
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-gray-700 text-gray-500 cursor-not-allowed"
                      }`}
                      disabled={!canAfford}
                      onClick={(e) => { e.stopPropagation(); canAfford && handleStakeSelect(stake); }}
                    >
                      Join Room
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-[#1a1d2e] border border-[#2a2d3e] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">How Dice Arena Works</h2>
            <ul className="space-y-2 text-gray-400 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">1.</span>
                <span>Select a stake and join a room (3-6 players per round)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">2.</span>
                <span>30-second countdown starts when 3rd player joins</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">3.</span>
                <span>Each player gets a unique dice roll — top 2 share the pot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">4.</span>
                <span><span className="text-yellow-400 font-semibold">🥇 1st gets 60%</span> · <span className="text-gray-300 font-semibold">🥈 2nd gets 40%</span> (after 10% fee)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
