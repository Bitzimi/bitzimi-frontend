import { useState, useEffect } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Bot, Palette, Coins, CircleDot, Dices, Zap, Shield, Gavel, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { AgeVerificationModal } from "../components/AgeVerificationModal";
import { useFeature } from "../contexts/FeatureContext";
import { useSettings } from "../contexts/SettingsContext";

// featureKey maps to backend feature.access.* config.
// The backend decides who can access — frontend must NOT hardcode access rules.
type GameCard = {
  id: string;
  featureKey?: string; // optional backend feature gate key
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  buttonLink?: string;
  isActive: boolean;
  gradient: string;
};

const games: GameCard[] = [
  {
    id: "football",
    featureKey: "football_prediction",
    icon: <Bot className="h-8 w-8" />,
    title: "Football AI Prediction",
    description: "Analyze upcoming matches and make predictions",
    buttonText: "Enter AI Hub",
    buttonLink: "/football",
    isActive: true,
    gradient: "from-purple-500 to-purple-600",
  },
  {
    id: "auction",
    featureKey: "auction_marketplace",
    icon: <Gavel className="h-8 w-8" />,
    title: "Auction Marketplace",
    description: "Bid on exclusive prizes — last bidder wins",
    buttonText: "Enter Marketplace",
    buttonLink: "/auction",
    isActive: true,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "colour",
    icon: <Palette className="h-8 w-8" />,
    title: "Colour Prediction Game",
    description: "Predict colour, win rewards",
    buttonText: "Join Lobby",
    buttonLink: "/game/lobby-selection",
    isActive: true,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    id: "coinflip",
    icon: <Coins className="h-8 w-8" />,
    title: "PvP Coin Flip",
    description: "1v1 instant matchmaking coin flip",
    buttonText: "Play Now",
    buttonLink: "/game/pvp-coinflip",
    isActive: true,
    gradient: "from-green-500 to-green-600",
  },
  {
    id: "diceduel",
    icon: <Dices className="h-8 w-8" />,
    title: "Dice Duel",
    description: "1v1 PvP dice battle — higher roll wins",
    buttonText: "Play Now",
    buttonLink: "/dice-duel",
    isActive: true,
    gradient: "from-cyan-500 to-cyan-600",
  },
  {
    id: "spinbattle",
    icon: <CircleDot className="h-8 w-8" />,
    title: "Spin Battle",
    description: "Multiplayer spinning wheel betting game",
    buttonText: "Play Now",
    buttonLink: "/game/spin-battle",
    isActive: true,
    gradient: "from-orange-500 to-orange-600",
  },
  {
    id: "reactiontap",
    icon: <Zap className="h-8 w-8" />,
    title: "Reaction Tap",
    description: "1v1 PvP reaction speed challenge",
    buttonText: "Play Now",
    buttonLink: "/game/reaction-tap",
    isActive: true,
    gradient: "from-yellow-500 to-yellow-600",
  },
];

export default function GameLobby() {
  const navigate = useNavigate();
  const { hasFeature, loading: featuresLoading } = useFeature();
  const { t } = useSettings();
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [pendingGameLink, setPendingGameLink] = useState<string | null>(null);

  useEffect(() => {
    const ageVerified = localStorage.getItem("bitzimiAgeVerified");
    if (!ageVerified) setShowAgeVerification(true);
  }, []);

  const handleAgeConfirm = () => {
    localStorage.setItem("bitzimiAgeVerified", "true");
    setShowAgeVerification(false);
    if (pendingGameLink) navigate(pendingGameLink);
  };

  const handleAgeReject = () => {
    setShowAgeVerification(false);
    setPendingGameLink(null);
    navigate("/wallet");
  };

  const handleGameClick = (link: string) => {
    const ageVerified = localStorage.getItem("bitzimiAgeVerified");
    if (!ageVerified) {
      setPendingGameLink(link);
      setShowAgeVerification(true);
    } else {
      navigate(link);
    }
  };

  return (
    <ResponsiveLayout>
      <div className="mb-6">
        <h2 className="text-lg md:text-2xl font-semibold mb-1">
          {t("game.lobby.title", "Game Center")}
        </h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          {t("game.lobby.subtitle", "Choose a game to start earning rewards")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {games.map((game) => {
          // Access is determined purely by backend — no hardcoded rules here.
          // hasFeature() returns the backend-evaluated boolean (role + VIP + config).
          const isLocked = !featuresLoading && game.featureKey !== undefined && !hasFeature(game.featureKey);

          return (
            <Card
              key={game.id}
              className={`${
                game.isActive && !isLocked
                  ? "border-2 hover:shadow-lg transition-all cursor-pointer"
                  : "bg-gray-50 dark:bg-gray-900 opacity-75"
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                  <div
                    className={`w-16 h-16 rounded-xl bg-gradient-to-br ${game.gradient} flex items-center justify-center text-white ${isLocked ? "opacity-50" : ""}`}
                  >
                    {game.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-1">{game.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {game.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLocked ? (
                  <div className="space-y-1">
                    <Button className="w-full" size="lg" disabled>
                      <Lock className="h-4 w-4 mr-2" />
                      {t("game.feature_locked", "Access Restricted")}
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                      {t("game.feature_locked_hint", "This feature is not available in your current plan.")}
                    </p>
                  </div>
                ) : game.isActive ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => game.buttonLink && handleGameClick(game.buttonLink)}
                  >
                    {game.buttonText}
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    {game.buttonText}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provably Fair */}
      <Card className="mt-6 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="py-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-200 text-sm">
                  {t("game.provably_fair.title", "Provably Fair Gaming")}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {t("game.provably_fair.description", "All game outcomes are cryptographically verifiable. Independently verify any result.")}
                </p>
              </div>
            </div>
            <Link to="/provably-fair">
              <Button variant="outline" size="sm" className="border-green-400 text-green-700 hover:bg-green-100 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                {t("game.provably_fair.verify", "Verify a Round")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Age Verification Modal */}
      <AgeVerificationModal
        isOpen={showAgeVerification}
        onConfirm={handleAgeConfirm}
        onReject={handleAgeReject}
      />
    </ResponsiveLayout>
  );
}
