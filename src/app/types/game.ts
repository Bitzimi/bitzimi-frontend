export interface GameRound {
  id: string;
  roundNumber: number;
  redTeam: {
    players: number;
    totalAmount: number;
  };
  blueTeam: {
    players: number;
    totalAmount: number;
  };
  status: "betting" | "spinning" | "completed";
  winner: "red" | "blue" | null;
  endTime: Date;
  startTime: Date;
}

export interface UserBet {
  id: string;
  roundId: string;
  amount: number;
  team: "red" | "blue";
  result: "pending" | "win" | "loss";
  payout?: number;
  createdAt: Date;
}

export interface GameResult {
  roundNumber: number;
  winner: "red" | "blue";
  timestamp: Date;
}
