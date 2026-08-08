import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent } from "../components/ui/card";
import { ArrowLeft, Swords, Trophy, Crown } from "lucide-react";
import { Button } from "../components/ui/button";

export default function DiceDuelModeSelection() {
  const navigate = useNavigate();

  const modes = [
    {
      id: "clash",
      title: "Dice Clash",
      subtitle: "1v1 Battle",
      description: "Face one opponent. Higher roll wins the pot.",
      icon: <Swords className="w-12 h-12" />,
      gradient: "from-blue-500 to-cyan-500",
      active: true,
      path: "/dice-duel/clash",
    },
    {
      id: "royale",
      title: "Dice Royale",
      subtitle: "6 Players - 1 Winner",
      description: "Compete against 5 players. Highest unique roll takes all.",
      icon: <Crown className="w-12 h-12" />,
      gradient: "from-amber-500 to-orange-500",
      active: true,
      path: "/dice-duel/royale",
    },
    {
      id: "arena",
      title: "Dice Arena",
      subtitle: "3-6 Players - 2 Winners",
      description: "Top 2 players win. 1st gets 60%, 2nd gets 40%.",
      icon: <Trophy className="w-12 h-12" />,
      gradient: "from-purple-500 to-pink-500",
      active: true,
      path: "/dice-duel/arena",
    },
  ];

  return (
    <ResponsiveLayout>
      <div className="bg-gradient-to-b from-gray-100 via-gray-200 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-gray-900 dark:text-white p-4 md:p-6 -m-4 md:-m-8 min-h-full">
        <div className="max-w-6xl mx-auto pt-4 md:pt-6">
          {/* Header */}
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Games</span>
          </button>

        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Dice Duel
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose your game mode</p>
        </div>

        {/* Game Modes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {modes.map((mode) => (
            <Card
              key={mode.id}
              className={`bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm ${
                mode.active
                  ? "cursor-pointer hover:scale-105 transition-transform hover:border-gray-400 dark:hover:border-gray-600"
                  : "opacity-60"
              }`}
              onClick={() => mode.active && navigate(mode.path)}
            >
              <CardContent className="p-6">
                <div className="text-center">
                  {/* Icon */}
                  <div
                    className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center text-white shadow-lg`}
                  >
                    {mode.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">{mode.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{mode.subtitle}</p>

                  {/* Description */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 min-h-[3rem]">
                    {mode.description}
                  </p>

                  {/* Button */}
                  <Button
                    className="w-full"
                    disabled={!mode.active}
                    variant={mode.active ? "default" : "outline"}
                  >
                    {mode.active ? "Play Now" : "Coming Soon"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <Card className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-blue-600 dark:text-blue-400 font-bold mb-2">Dice Clash (1v1)</div>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Face one opponent</li>
                  <li>• Both roll a dice (1-6)</li>
                  <li>• Higher roll wins</li>
                  <li>• Ties trigger re-roll</li>
                  <li>• Winner takes pot minus 10% fee</li>
                </ul>
              </div>

              <div>
                <div className="text-amber-600 dark:text-amber-400 font-bold mb-2">Dice Royale (6 Players)</div>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Up to 6 players per round</li>
                  <li>• Each gets unique number (1-6)</li>
                  <li>• Highest roll wins entire pot</li>
                  <li>• 30s countdown to join</li>
                  <li>• Winner takes all minus 10% fee</li>
                </ul>
              </div>

              <div>
                <div className="text-purple-600 dark:text-purple-400 font-bold mb-2">Dice Arena (2 Winners)</div>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• 3-6 players per round</li>
                  <li>• Roll 1-6 (unique, no duplicates)</li>
                  <li>• 🥇 Highest roll wins 60%</li>
                  <li>• 🥈 2nd highest wins 40%</li>
                  <li>• Countdown starts at 3rd player</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
