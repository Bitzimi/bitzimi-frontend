import { useState, useEffect } from "react";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, DollarSign, Lock, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { COLOR_PREDICTION_LOBBIES } from "../config/lobbies";
import { getLobbyStats, initializeHiddenRooms } from "../utils/roomManager";

export default function LobbySelection() {
  const navigate = useNavigate();
  const { formatCurrency } = useSettings();
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});

  // Initialize hidden rooms and get player counts
  useEffect(() => {
    // Initialize hidden rooms for all lobbies
    COLOR_PREDICTION_LOBBIES.forEach(lobby => {
      initializeHiddenRooms(lobby);
    });

    // Update player counts periodically
    const updateCounts = () => {
      const counts: Record<string, number> = {};
      COLOR_PREDICTION_LOBBIES.forEach(lobby => {
        const stats = getLobbyStats(lobby);
        counts[lobby.id] = stats.totalPlayers;
      });
      setPlayerCounts(counts);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handleJoinLobby = (lobbyId: string) => {
    // Navigate to lobby using URL parameter
    navigate(`/game/color/${lobbyId}`);
  };

  return (
    <ResponsiveLayout>
      <div className="mb-6">
        <Link to="/game">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>
        </Link>
        <h2 className="text-lg md:text-2xl font-semibold mb-1">Colour Prediction Lobbies</h2>
        <p className="text-sm md:text-base text-gray-600">
          Choose a lobby based on your betting range
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {COLOR_PREDICTION_LOBBIES.map((lobby) => {
          const playerCount = playerCounts[lobby.id] || 0;

          return (
            <Card
              key={lobby.id}
              className="border-blue-300 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleJoinLobby(lobby.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{lobby.name}</CardTitle>
                  <Badge className="bg-green-500">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>Bet Range:</span>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(lobby.betRange.min)} - {formatCurrency(lobby.betRange.max)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>Players:</span>
                  </div>
                  <span className="font-semibold">
                    {playerCount} online
                  </span>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={() => handleJoinLobby(lobby.id)}
                >
                  Join Lobby
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <div className="text-purple-600 dark:text-purple-400 text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Lobby Information</h3>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Each lobby has a specific betting range. Choose a lobby that matches your budget.
                Games are synchronized within each lobby, so all players in the same lobby play together.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </ResponsiveLayout>
  );
}