import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Search } from "lucide-react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSettings } from "../contexts/SettingsContext";
import OriginalReactionTapGameRoom from "../../../app/pages/ReactionTapGameRoom";

/**
 * Reaction Tap entry gate.
 *
 * Quick Match intentionally does not mount the gameplay component until the user
 * presses Search. This mirrors Coin Flip's explicit matchmaking trigger while
 * leaving the existing Reaction Tap gameplay implementation untouched after search.
 * Private matches continue directly into the existing room flow via matchId.
 */
export default function ReactionTapGameRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchStarted, setSearchStarted] = useState(false);
  const { formatCurrencyNoDecimals } = useSettings();
  const stakeAmount = parseInt(searchParams.get("stake") || "1");
  const privateMatchId = searchParams.get("matchId");

  if (privateMatchId || searchStarted) {
    return <OriginalReactionTapGameRoom />;
  }

  const handleExit = () => navigate("/game/reaction-tap");

  return (
    <ResponsiveLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="mb-3 sm:mb-4 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit Room
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                Reaction Arena
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                {formatCurrencyNoDecimals(stakeAmount)} Stake • First to tap wins
              </p>
            </div>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-800">
          <div className="relative min-h-[360px] sm:min-h-[420px] flex items-center justify-center p-8 sm:p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
            <div className="relative flex flex-col items-center">
              <Button
                variant="outline"
                onClick={() => setSearchStarted(true)}
                className="rounded-full px-8 py-3 text-base font-semibold border-gray-600 dark:border-gray-500 bg-transparent text-gray-900 dark:text-white hover:bg-gray-800/50 dark:hover:bg-gray-800/70 flex items-center gap-3"
              >
                <Search className="h-6 w-6" />
                Search
              </Button>
              <p className="text-base text-gray-600 dark:text-gray-300 mt-6">
                Matching you with a skilled competitor...
              </p>
            </div>
          </div>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
