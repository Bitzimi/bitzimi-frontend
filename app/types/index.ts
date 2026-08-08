export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  referralCode: string;
  uplineId: string | null;
  createdAt: string;
  currentLevel: number;
  isActivated: boolean;
}

export interface Level {
  level: number;
  cost: number;
  positions: number;
  completed: boolean;
  positionsFilled: number;
  earnings: number;
}

export interface MatrixPosition {
  id: string;
  userId: string | null;
  level: number;
  position: number; // 0-based position in the matrix
  username?: string;
  isActive: boolean;
}

export interface Wallet {
  mainBalance: number;
  referralBonusBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
}

export interface Transaction {
  id: string;
  type: "activation" | "upgrade" | "referral_bonus" | "tier_reward" | "withdrawal" | "transfer";
  amount: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  description: string;
}

export interface Referral {
  id: string;
  username: string;
  email: string;
  isActivated: boolean;
  currentLevel: number;
  joinedAt: string;
  earnings: number;
}

export interface TierReward {
  tier: number;
  requiredReferrals: number;
  reward: number;
  achieved: boolean;
}

export const LEVEL_COSTS = [
  { level: 1, cost: 20, fee: 5, positions: 2 },
  { level: 2, cost: 30, feePercent: 10, positions: 4 },
  { level: 3, cost: 50, feePercent: 10, positions: 8 },
  { level: 4, cost: 100, feePercent: 10, positions: 16 },
];

export const TIER_REWARDS = [
  { tier: 1, requiredReferrals: 15, reward: 7.5 },
  { tier: 2, requiredReferrals: 30, reward: 15 },
  { tier: 3, requiredReferrals: 60, reward: 30 },
  { tier: 4, requiredReferrals: 120, reward: 60 },
  { tier: 5, requiredReferrals: 240, reward: 120 },
];

export const REFERRAL_BONUS_RATE = 0.1; // 10% of Level 1 cost
export const MIN_REFERRAL_WITHDRAWAL = 20;