/**
 * adminDataService — backend-authoritative data access layer for the admin panel.
 *
 * All methods call backend APIs. No localStorage for financial data.
 */

import type { Task } from "../../pages/Tasks";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function adminApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "Admin API error"), { status: res.status });
  return json.data as T;
}

// ─── User snapshot ────────────────────────────────────────────────────────────

export interface AdminUserSnapshot {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
  referralCode: string;
  affiliateCode?: string;
  role?: string;
  createdAt: string;
  suspendedAt?: string | null;
  verificationStatus: string;
  isVerified: boolean;
  vipStatus: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  tier?: string;
  walletBalances?: Record<string, number>;
  dailyWithdrawalUsed?: number;
  monthlyWithdrawalUsed?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface AdminUserDetailSnapshot extends AdminUserSnapshot {
  suspendedBy?: string | null;
  kycDetail: {
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    rejectionReason: string | null;
    countryCode: string | null;
    idType: string | null;
    fullName: string | null;
    dateOfBirth: string | null;
    address: string | null;
  } | null;
  vipDetail: {
    plan: string;
    startedAt: string;
    endsAt: string;
    isActive: boolean;
    streak: { currentStreak: number; totalEarned: number } | null;
  } | null;
  gameStats: Array<{
    gameType: string;
    totalGames: number;
    wins: number;
    losses: number;
    totalWagered: number;
    totalWon: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    netAmount: number;
    status: string;
    description: string | null;
    createdAt: string;
  }>;
  taskSummary: {
    totalProofs: number;
    approvedProofs: number;
    totalRewardsEarned: number;
  };
  referralSummary: {
    totalReferrals: number;
    activeReferrals: number;
    rewardedReferrals: number;
  };
  // Security & payment details (Phase 23.2)
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  pinStatus: "set" | "not_set";
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  usdtAddress: string | null;
}

export interface AdminKycSubmission {
  id: string;
  userId: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  countryCode: string | null;
  idType: string | null;
  fullName: string | null;
  user: { id: string; email: string; username: string };
}

export interface AdminKycSubmissionDetail extends AdminKycSubmission {
  dateOfBirth: string | null;
  address: string | null;
  documentUrls: {
    front: string | null;
    back: string | null;
    selfie: string | null;
    poa: string | null;
  };
}

// ─── Financial interfaces ──────────────────────────────────────────────────

export interface AdminWithdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  destination: string;
  paymentMethod: string;
  status: string;
  pinVerified: boolean;
  txHash: string | null;
  rejectionReason: string | null;
  processedBy: string | null;
  submittedAt: string;
  processedAt: string | null;
  user: { email: string; username: string } | null;
}

export interface AdminDeposit {
  id: string;
  userId: string;
  requestedAmount: number;
  memoAmount: number;
  paymentMethod: string;
  paymentAddress: string | null;
  status: string;
  txHash: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  user: { email: string; username: string } | null;
}

export interface AdminTransaction {
  id: string;
  userId: string;
  type: string;
  fromWallet: string | null;
  toWallet: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  description: string | null;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
  user: { email: string; username: string } | null;
}

// ─── Task proof & review queue interfaces ─────────────────────────────────

export interface AdminReviewItem {
  reviewId:            string;
  proofId:             string;
  taskId:              string;
  username:            string;
  aiConfidence:        number;
  aiAnalysis:          string;
  decision:            string | null;
  decisionNote:        string | null;
  reviewedAt:          string | null;
  createdAt:           string;
  proof:               Record<string, any>;
  task: {
    title:                   string;
    proofInstructions:       string | null;
    referenceScreenshotUrls: string[];
  };
  proofScreenshotUrls: string[];
}

export interface AdminTaskProofItem {
  id:             string;
  taskId:         string;
  userId:         string;
  username:       string;
  status:         string;
  aiConfidence:   number | null;
  aiAnalysis:     string | null;
  rewardAmount:   number | null;
  rewardPaid:     boolean;
  submittedAt:    string;
  processedAt:    string | null;
  screenshotUrls: string[];
}

export interface AdminTaskDetail extends Task {
  expiresAt:               string | null;
  budgetSpent:             number;
  budgetRemaining:         number;
  approvedBy:              string | null;
  approvedAt:              string | null;
  rejectedBy:              string | null;
  rejectedAt:              string | null;
  rejectionReason:         string | null;
  proofInstructions:       string | null;
  referenceScreenshotUrls: string[];
  proofs:                  AdminTaskProofItem[];
}

// ─── Tasks — backend-authoritative ────────────────────────────────────────

export const adminTaskService = {
  async getAllTasks(): Promise<Task[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const data = await adminApiFetch<{ items: any[] }>("/api/v1/admin/tasks?limit=100");
      return (data.items ?? []).map(mapBackendTask);
    } catch { return []; }
  },

  async getPendingTasks(): Promise<Task[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const data = await adminApiFetch<{ items: any[] }>("/api/v1/admin/tasks?status=pending_review&limit=100");
      return (data.items ?? []).map(mapBackendTask);
    } catch { return []; }
  },

  async getTaskDetail(taskId: string): Promise<AdminTaskDetail | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      const t = await adminApiFetch<any>(`/api/v1/admin/tasks/${taskId}`);
      return {
        ...mapBackendTask(t),
        expiresAt:               t.expiresAt               ?? null,
        budgetSpent:             t.budgetSpent             ?? 0,
        budgetRemaining:         t.budgetRemaining         ?? 0,
        approvedBy:              t.approvedBy              ?? null,
        approvedAt:              t.approvedAt              ?? null,
        rejectedBy:              t.rejectedBy              ?? null,
        rejectedAt:              t.rejectedAt              ?? null,
        rejectionReason:         t.rejectionReason         ?? null,
        proofInstructions:       t.proofInstructions       ?? null,
        referenceScreenshotUrls: t.referenceScreenshotUrls ?? [],
        proofs: (t.proofs ?? []).map((p: any): AdminTaskProofItem => ({
          id:             p.id,
          taskId:         p.taskId,
          userId:         p.userId,
          username:       p.username ?? "",
          status:         p.status,
          aiConfidence:   p.aiConfidence  ?? null,
          aiAnalysis:     p.aiAnalysis    ?? null,
          rewardAmount:   p.rewardAmount  ?? null,
          rewardPaid:     p.rewardPaid    ?? false,
          submittedAt:    p.submittedAt,
          processedAt:    p.processedAt   ?? null,
          screenshotUrls: p.screenshotUrls ?? [],
        })),
      };
    } catch { return null; }
  },

  async approveTask(taskId: string): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await adminApiFetch(`/api/v1/admin/tasks/${taskId}/approve`, { method: "POST", body: "{}" });
      return true;
    } catch { return false; }
  },

  async rejectTask(taskId: string, reason = "Did not meet requirements"): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await adminApiFetch(`/api/v1/admin/tasks/${taskId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return true;
    } catch { return false; }
  },
};

function mapBackendTask(t: any): Task {
  return {
    id:                  t.id,
    title:               t.title,
    type:                t.type,
    link:                t.link ?? "",
    instructions:        t.description ?? "",
    totalReward:         t.rewardPerSlot,
    freeUserReward:      +(t.rewardPerSlot * 0.35).toFixed(4),
    verifiedUserReward:  +(t.rewardPerSlot * 0.45).toFixed(4),
    vipUserReward:       +(t.rewardPerSlot * 0.65).toFixed(4),
    totalBudget:         t.totalBudget,
    totalSlots:          t.totalSlots,
    completedSlots:      t.completedSlots,
    remainingSlots:      t.totalSlots - t.completedSlots,
    status:              t.status,
    createdAt:           t.createdAt,
    advertiserId:        t.advertiserId,
    advertiserName:      t.advertiserName,
    campaignImageUrl:    t.campaignImageUrl ?? undefined,
  };
}

// ─── Task Proofs & Admin Review Queue — backend-authoritative ──────────────

export const adminProofService = {
  async getReviewQueue(): Promise<AdminReviewItem[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const items = await adminApiFetch<any[]>("/api/v1/admin/proofs/queue");
      return (items ?? []).map(mapBackendReviewItem);
    } catch { return []; }
  },

  async getAllReviewItems(): Promise<AdminReviewItem[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const items = await adminApiFetch<any[]>("/api/v1/admin/proofs/queue?all=true");
      return (items ?? []).map(mapBackendReviewItem);
    } catch { return []; }
  },

  async decide(reviewId: string, decision: "approved" | "rejected", note?: string): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await adminApiFetch(`/api/v1/admin/proofs/${reviewId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      });
      return true;
    } catch { return false; }
  },
};

function mapBackendReviewItem(r: any): AdminReviewItem {
  return {
    reviewId:            r.reviewId,
    proofId:             r.proofId     ?? "",
    taskId:              r.taskId      ?? "",
    username:            r.username    ?? "",
    aiConfidence:        r.aiConfidence ?? 0,
    aiAnalysis:          r.aiAnalysis  ?? "",
    decision:            r.decision    ?? null,
    decisionNote:        r.decisionNote ?? null,
    reviewedAt:          r.reviewedAt  ?? null,
    createdAt:           r.createdAt   ?? new Date().toISOString(),
    proof:               r.proof       ?? {},
    task: {
      title:                   r.task?.title            ?? "",
      proofInstructions:       r.task?.proofInstructions ?? null,
      referenceScreenshotUrls: r.task?.referenceScreenshotUrls ?? [],
    },
    proofScreenshotUrls: r.proofScreenshotUrls ?? [],
  };
}

// ─── Financial — backend-authoritative ─────────────────────────────────────

type PaginatedResult<T> = { items: T[]; nextCursor: string | null; hasMore: boolean };

export const adminWithdrawalService = {
  async fetchWithdrawals(opts: { status?: string; cursor?: string; limit?: number } = {}): Promise<PaginatedResult<AdminWithdrawal>> {
    if (!API_BASE || !getToken()) return { items: [], nextCursor: null, hasMore: false };
    try {
      const p = new URLSearchParams();
      if (opts.status) p.set("status", opts.status);
      if (opts.cursor) p.set("cursor", opts.cursor);
      if (opts.limit)  p.set("limit", String(opts.limit));
      return await adminApiFetch<PaginatedResult<AdminWithdrawal>>(`/api/v1/admin/withdrawals?${p.toString()}`);
    } catch { return { items: [], nextCursor: null, hasMore: false }; }
  },

  async processWithdrawal(id: string): Promise<AdminWithdrawal | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminWithdrawal>(`/api/v1/admin/withdrawals/${id}/process`, { method: "POST", body: "{}" });
    } catch { return null; }
  },

  async completeWithdrawal(id: string, txHash?: string): Promise<AdminWithdrawal | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminWithdrawal>(`/api/v1/admin/withdrawals/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ txHash: txHash || undefined }),
      });
    } catch { return null; }
  },

  async rejectWithdrawal(id: string, reason: string): Promise<AdminWithdrawal | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminWithdrawal>(`/api/v1/admin/withdrawals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    } catch { return null; }
  },
};

export const adminDepositService = {
  async fetchDeposits(opts: { status?: string; cursor?: string; limit?: number } = {}): Promise<PaginatedResult<AdminDeposit>> {
    if (!API_BASE || !getToken()) return { items: [], nextCursor: null, hasMore: false };
    try {
      const p = new URLSearchParams();
      if (opts.status) p.set("status", opts.status);
      if (opts.cursor) p.set("cursor", opts.cursor);
      if (opts.limit)  p.set("limit", String(opts.limit));
      return await adminApiFetch<PaginatedResult<AdminDeposit>>(`/api/v1/admin/deposits?${p.toString()}`);
    } catch { return { items: [], nextCursor: null, hasMore: false }; }
  },

  async confirmDeposit(id: string, txHash?: string): Promise<AdminDeposit | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminDeposit>(`/api/v1/admin/deposits/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ txHash: txHash || undefined }),
      });
    } catch { return null; }
  },
};

export const adminTransactionService = {
  async fetchTransactions(opts: { type?: string; userId?: string; cursor?: string; limit?: number } = {}): Promise<PaginatedResult<AdminTransaction>> {
    if (!API_BASE || !getToken()) return { items: [], nextCursor: null, hasMore: false };
    try {
      const p = new URLSearchParams();
      if (opts.type)   p.set("type", opts.type);
      if (opts.userId) p.set("userId", opts.userId);
      if (opts.cursor) p.set("cursor", opts.cursor);
      if (opts.limit)  p.set("limit", String(opts.limit));
      return await adminApiFetch<PaginatedResult<AdminTransaction>>(`/api/v1/admin/transactions?${p.toString()}`);
    } catch { return { items: [], nextCursor: null, hasMore: false }; }
  },
};

export const adminFinancialService = {
  getSummary: () => ({ pendingWithdrawals: 0, pendingDeposits: 0, totalWithdrawalVolume: 0, totalTransactions: 0 }),
};

// ─── Users — backend-authoritative ────────────────────────────────────────

export const adminUserService = {
  async fetchUsers(opts: { cursor?: string; limit?: number; search?: string } = {}): Promise<{
    items: AdminUserSnapshot[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!API_BASE || !getToken()) return { items: [], nextCursor: null, hasMore: false };
    try {
      const params = new URLSearchParams();
      if (opts.cursor) params.set("cursor", opts.cursor);
      if (opts.limit)  params.set("limit", String(opts.limit));
      if (opts.search) params.set("search", opts.search);
      return await adminApiFetch<{ items: AdminUserSnapshot[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/v1/admin/users?${params.toString()}`
      );
    } catch { return { items: [], nextCursor: null, hasMore: false }; }
  },

  async fetchUserById(userId: string): Promise<AdminUserDetailSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserDetailSnapshot>(`/api/v1/admin/users/${userId}`);
    } catch { return null; }
  },

  async suspendUser(userId: string): Promise<AdminUserSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserSnapshot>(`/api/v1/admin/users/${userId}/suspend`, { method: "POST", body: "{}" });
    } catch { return null; }
  },

  async unsuspendUser(userId: string): Promise<AdminUserSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserSnapshot>(`/api/v1/admin/users/${userId}/unsuspend`, { method: "POST", body: "{}" });
    } catch { return null; }
  },

  async editUser(userId: string, body: { role?: string; username?: string; fullName?: string }): Promise<AdminUserSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserSnapshot>(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch { return null; }
  },

  async setVerification(userId: string, status: string): Promise<AdminUserSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserSnapshot>(`/api/v1/admin/users/${userId}/verification`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch { return null; }
  },

  async overrideLimits(userId: string, dailyUsed: number, monthlyUsed: number): Promise<AdminUserSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminUserSnapshot>(`/api/v1/admin/users/${userId}/limits`, {
        method: "PATCH",
        body: JSON.stringify({ dailyUsed, monthlyUsed }),
      });
    } catch { return null; }
  },

  async forceVerifyEmail(userId: string): Promise<AdminUserDetailSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    return await adminApiFetch<AdminUserDetailSnapshot>(`/api/v1/admin/users/${userId}/force-verify-email`, { method: "POST", body: "{}" });
  },

  async disable2FA(userId: string): Promise<AdminUserDetailSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    return await adminApiFetch<AdminUserDetailSnapshot>(`/api/v1/admin/users/${userId}/disable-2fa`, { method: "POST", body: "{}" });
  },

  async clearPin(userId: string): Promise<AdminUserDetailSnapshot | null> {
    if (!API_BASE || !getToken()) return null;
    return await adminApiFetch<AdminUserDetailSnapshot>(`/api/v1/admin/users/${userId}/clear-pin`, { method: "POST", body: "{}" });
  },
};

// ─── KYC — backend-authoritative ──────────────────────────────────────────

export const adminKycService = {
  async fetchQueue(status?: string): Promise<AdminKycSubmission[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const params = status ? `?status=${encodeURIComponent(status)}` : "";
      return await adminApiFetch<AdminKycSubmission[]>(`/api/v1/admin/kyc${params}`);
    } catch { return []; }
  },

  async fetchDetail(submissionId: string): Promise<AdminKycSubmissionDetail | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<AdminKycSubmissionDetail>(`/api/v1/admin/kyc/${submissionId}`);
    } catch { return null; }
  },

  async approve(submissionId: string): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await adminApiFetch(`/api/v1/admin/kyc/${submissionId}/approve`, { method: "POST", body: "{}" });
      return true;
    } catch { return false; }
  },

  async reject(submissionId: string, reason: string): Promise<boolean> {
    if (!API_BASE || !getToken()) return false;
    try {
      await adminApiFetch(`/api/v1/admin/kyc/${submissionId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return true;
    } catch { return false; }
  },
};

// ─── Platform stats ────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers:            number;
  verifiedUsers:         number;
  vipUsers:              number;
  suspendedUsers:        number;
  newUsersThisWeek:      number;
  pendingKyc:            number;
  pendingTasks:          number;
  activeTasks:           number;
  completedTasks:        number;
  proofReviewQueue:      number;
  totalProofsApproved:   number;
  taskRewardsPaidUSD:    number;
  pendingWithdrawals:    number;
  pendingDeposits:       number;
  totalWithdrawalVolume: number;
  totalDepositVolume:    number;
  totalTransactions:     number;
  newWithdrawalsThisWeek: number;
  newDepositsThisWeek:   number;
  activeGameRounds:      number;
  totalBets:             number;
  totalWagered:          number;
  totalPaidOut:          number;
  gameFeeRevenue:        number;
  gameTypeBreakdown:     Array<{ gameType: string; rounds: number }>;
  revenueGameFees:       number;
  revenueAffiliateComms: number;
  revenueVipSubs:        number;
  netGameRevenue:        number;
  totalReferrals:        number;
  rewardedReferrals:     number;
  affiliateCommsCount:   number;
  affiliateCommsTotal:   number;
}

export const EMPTY_STATS: AdminStats = {
  totalUsers: 0, verifiedUsers: 0, vipUsers: 0, suspendedUsers: 0, newUsersThisWeek: 0,
  pendingKyc: 0,
  pendingTasks: 0, activeTasks: 0, completedTasks: 0, proofReviewQueue: 0,
  totalProofsApproved: 0, taskRewardsPaidUSD: 0,
  pendingWithdrawals: 0, pendingDeposits: 0,
  totalWithdrawalVolume: 0, totalDepositVolume: 0, totalTransactions: 0,
  newWithdrawalsThisWeek: 0, newDepositsThisWeek: 0,
  activeGameRounds: 0, totalBets: 0, totalWagered: 0, totalPaidOut: 0, gameFeeRevenue: 0,
  gameTypeBreakdown: [],
  revenueGameFees: 0, revenueAffiliateComms: 0, revenueVipSubs: 0, netGameRevenue: 0,
  totalReferrals: 0, rewardedReferrals: 0, affiliateCommsCount: 0, affiliateCommsTotal: 0,
};

export interface ActivityItem {
  id:        string;
  type:      string;
  icon:      string;
  username:  string;
  amount:    number;
  createdAt: string;
}

export interface HealthStatus {
  database:       { status: string; latencyMs: number };
  queues:         { pendingWithdrawals: number; pendingDeposits: number; pendingKyc: number; pendingProofs: number; pendingTasks: number; activeGameRounds: number };
  backgroundJobs: Array<{ name: string; description: string; status: string }>;
  timestamp:      string;
}

export const adminStatsService = {
  async fetchSummary(): Promise<AdminStats> {
    if (!API_BASE || !getToken()) return { ...EMPTY_STATS };
    try {
      const data = await adminApiFetch<any>("/api/v1/admin/stats");
      return {
        totalUsers:             data.users?.total              ?? 0,
        verifiedUsers:          data.users?.verified           ?? 0,
        vipUsers:               data.users?.vip                ?? 0,
        suspendedUsers:         data.users?.suspended          ?? 0,
        newUsersThisWeek:       data.users?.newThisWeek        ?? 0,
        pendingKyc:             data.kyc?.pendingReview        ?? 0,
        pendingTasks:           data.tasks?.pendingApproval    ?? 0,
        activeTasks:            data.tasks?.active             ?? 0,
        completedTasks:         data.tasks?.completed          ?? 0,
        proofReviewQueue:       data.tasks?.proofQueue         ?? 0,
        totalProofsApproved:    data.tasks?.totalProofsApproved ?? 0,
        taskRewardsPaidUSD:     data.tasks?.rewardsPaidUSD     ?? 0,
        pendingWithdrawals:     data.financial?.pendingWithdrawals     ?? 0,
        pendingDeposits:        data.financial?.pendingDeposits        ?? 0,
        totalWithdrawalVolume:  data.financial?.totalWithdrawalVolume  ?? 0,
        totalDepositVolume:     data.financial?.totalDepositVolume     ?? 0,
        totalTransactions:      data.financial?.totalTransactions      ?? 0,
        newWithdrawalsThisWeek: data.financial?.newWithdrawalsThisWeek ?? 0,
        newDepositsThisWeek:    data.financial?.newDepositsThisWeek    ?? 0,
        activeGameRounds:       data.games?.activeRounds       ?? 0,
        totalBets:              data.games?.totalBets           ?? 0,
        totalWagered:           data.games?.totalWagered        ?? 0,
        totalPaidOut:           data.games?.totalPaidOut        ?? 0,
        gameFeeRevenue:         data.games?.gameFeeRevenue      ?? 0,
        gameTypeBreakdown:      data.games?.gameTypeBreakdown   ?? [],
        revenueGameFees:        data.revenue?.gameFees          ?? 0,
        revenueAffiliateComms:  data.revenue?.affiliateCommissions ?? 0,
        revenueVipSubs:         data.revenue?.vipSubscriptions  ?? 0,
        netGameRevenue:         data.revenue?.netGameRevenue    ?? 0,
        totalReferrals:         data.referrals?.total           ?? 0,
        rewardedReferrals:      data.referrals?.rewarded        ?? 0,
        affiliateCommsCount:    data.referrals?.affiliateCommissionsCount ?? 0,
        affiliateCommsTotal:    data.referrals?.affiliateCommissionsTotal ?? 0,
      };
    } catch {
      return { ...EMPTY_STATS };
    }
  },

  async fetchRecentActivity(limit = 8): Promise<ActivityItem[]> {
    if (!API_BASE || !getToken()) return [];
    try {
      const items = await adminApiFetch<ActivityItem[]>(`/api/v1/admin/stats/activity?limit=${limit}`);
      return items ?? [];
    } catch { return []; }
  },

  async fetchHealth(): Promise<HealthStatus | null> {
    if (!API_BASE || !getToken()) return null;
    try {
      return await adminApiFetch<HealthStatus>("/api/v1/admin/stats/health");
    } catch { return null; }
  },
};

// ── Referral admin types ──────────────────────────────────────────────────────

export interface AdminReferralItem {
  id:               string;
  referrerId:       string;
  referrerUsername: string;
  referrerIsVIP:    boolean;
  referredId:       string;
  referredUsername: string;
  referredIsVIP:    boolean;
  isActive:         boolean;
  referralRewarded: boolean;
  activatedAt:      string | null;
  rewardedAt:       string | null;
  joinedAt:         string;
}

export interface AdminReferralStats {
  total:         number;
  rewarded:      number;
  pending:       number;
  active:        number;
  bonusUSD:      number;
  totalPaidUSD:  number;
  paymentCount:  number;
  last7Days: { newReferrals: number; newRewarded: number };
}

export interface AdminReferralTransaction {
  id:          string;
  userId:      string;
  username:    string;
  amount:      number;
  toWallet:    string;
  description: string | null;
  referenceId: string | null;
  createdAt:   string;
}

// ── Affiliate admin types ─────────────────────────────────────────────────────

export interface AdminAffiliateApplication {
  id:              string;
  userId:          string;
  username:        string;
  status:          "pending" | "approved" | "rejected";
  fullName:        string;
  socialPlatform:  string;
  socialLink:      string;
  socialUsername:  string;
  totalMembers:    number;
  screenshotUrl:   string | null;
  rejectionReason: string | null;
  submittedAt:     string;
  reviewedAt:      string | null;
}

export interface AdminAffiliateCommission {
  id:                  string;
  beneficiaryId:       string;
  beneficiaryUsername: string;
  sourceUserId:        string;
  sourceUsername:      string;
  tier:                number;
  eventType:           string;
  eventRefId:          string | null;
  grossAmount:         number;
  rate:                number;
  commission:          number;
  status:              string;
  createdAt:           string;
}

export interface AdminAffiliateStats {
  applications: { total: number; pending: number; approved: number; rejected: number };
  commissions: {
    total: number;
    totalEarnedUSD: number;
    byEventType: Array<{ eventType: string; count: number; totalUSD: number }>;
    byTier: Array<{ tier: number; count: number; totalUSD: number }>;
  };
  jobQueue: Record<string, number>;
  last7Days: { newApplications: number; newCommissions: number; earnedUSD: number };
}

export interface AdminTopEarner {
  userId:      string;
  username:    string;
  totalEarned: number;
  commissions: number;
}

export interface AdminCommissionJob {
  id:           string;
  jobType:      string;
  status:       string;
  attempts:     number;
  maxAttempts:  number;
  eventType:    string | null;
  sourceUserId: string | null;
  grossAmount:  number | null;
  errorMessage: string | null;
  createdAt:    string;
  processedAt:  string | null;
}

export interface AdminCommissionAnalytics {
  daily:  Array<{ day: string; total: number; count: number }>;
  weekly: Array<{ week: string; total: number; count: number }>;
}

// ── Referral admin service ────────────────────────────────────────────────────

export const adminReferralService = {
  async fetchReferrals(opts: {
    search?: string; rewarded?: boolean; cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminReferralItem[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.search)            params.set("search", opts.search);
    if (opts.rewarded !== undefined) params.set("rewarded", String(opts.rewarded));
    if (opts.cursor)            params.set("cursor", opts.cursor);
    if (opts.limit)             params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/referrals?${params}`);
  },

  async fetchStats(): Promise<AdminReferralStats> {
    return adminApiFetch("/api/v1/admin/referrals/stats");
  },

  async fetchTransactions(opts: { cursor?: string; limit?: number } = {}): Promise<{
    items: AdminReferralTransaction[]; nextCursor: string | null; hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.limit)  params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/referrals/transactions?${params}`);
  },
};

// ── Affiliate admin service ───────────────────────────────────────────────────

// ── VIP admin types ───────────────────────────────────────────────────────────

export interface AdminVipStats {
  subscriptions: {
    total:             number;
    active:            number;
    expired:           number;
    cancelled:         number;
    newThisWeek:       number;
    expiringNext7Days: number;
  };
  revenue: {
    totalUSD: number;
  };
  streaks: {
    totalClaimers:         number;
    activeClaimers:        number;
    totalEarnedUSD:        number;
    avgCurrentStreak:      number;
    payoutsLast30DaysUSD:  number;
    payoutsLast30DaysCount: number;
  };
}

export interface AdminVipMember {
  userId:      string;
  email:       string;
  username:    string;
  fullName:    string | null;
  plan:        string;
  price:       number;
  isActive:    boolean;
  startedAt:   string;
  endsAt:      string;
  cancelledAt: string | null;
  streak: {
    current:     number;
    totalEarned: number;
    lastClaim:   string | null;
  } | null;
}

export interface AdminVipMemberDetail {
  userId:   string;
  email:    string;
  username: string;
  fullName: string | null;
  joinedAt: string | null;
  subscription: {
    plan:        string;
    price:       number;
    isActive:    boolean;
    startedAt:   string;
    endsAt:      string;
    cancelledAt: string | null;
  };
  streak: {
    current:     number;
    totalEarned: number;
    lastClaim:   string | null;
  } | null;
  streakHistory: Array<{
    id:          string;
    amount:      number;
    description: string | null;
    day:         number | null;
    claimedAt:   string;
  }>;
}

// ── VIP admin service ─────────────────────────────────────────────────────────

export type FeatureAccessLevel = "all" | "vip" | "staff" | "admin" | "disabled";

export interface AdminPlatformFeatures {
  access: Record<string, boolean>;
  flags:  Record<string, boolean>;
}

export interface AdminFeatureAccessEntry {
  key:         string;
  featureName: string;
  level:       FeatureAccessLevel;
  description: string | null;
  updatedAt:   string;
}

export const adminVipService = {
  async fetchStats(): Promise<AdminVipStats> {
    return adminApiFetch("/api/v1/admin/vip/stats");
  },

  async fetchMembers(opts: {
    search?: string; status?: "active" | "expired" | "all"; cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminVipMember[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.search) params.set("search", opts.search);
    if (opts.status) params.set("status", opts.status);
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.limit)  params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/vip/members?${params}`);
  },

  async fetchMemberDetail(userId: string): Promise<AdminVipMemberDetail> {
    return adminApiFetch(`/api/v1/admin/vip/members/${userId}`);
  },

  async cancelSubscription(userId: string): Promise<{ userId: string; isActive: boolean; cancelledAt: string }> {
    return adminApiFetch(`/api/v1/admin/vip/members/${userId}/cancel`, { method: "POST" });
  },

  async resetStreak(userId: string): Promise<{ userId: string; previousStreak: number; newStreak: number }> {
    return adminApiFetch(`/api/v1/admin/vip/members/${userId}/reset-streak`, { method: "POST" });
  },

  async fetchFeatureAccessEntries(): Promise<AdminFeatureAccessEntry[]> {
    const all = await adminApiFetch<{ items?: any[] } | any[]>("/api/v1/admin/config");
    const entries: any[] = Array.isArray(all) ? all : ((all as any).items ?? []);
    return entries
      .filter((c: any) => c.key?.startsWith("feature.access."))
      .map((c: any): AdminFeatureAccessEntry => ({
        key:         c.key,
        featureName: c.key.replace("feature.access.", ""),
        level:       (c.value ?? "all") as FeatureAccessLevel,
        description: c.description ?? null,
        updatedAt:   c.updatedAt,
      }));
  },

  async fetchBooleanFeatureFlags(): Promise<Array<{ key: string; flagName: string; enabled: boolean; description: string | null; updatedAt: string }>> {
    const all = await adminApiFetch<{ items?: any[] } | any[]>("/api/v1/admin/config");
    const entries: any[] = Array.isArray(all) ? all : ((all as any).items ?? []);
    return entries
      .filter((c: any) => c.key?.startsWith("feature.") && !c.key.startsWith("feature.access."))
      .map((c: any) => ({
        key:         c.key,
        flagName:    c.key.replace("feature.", ""),
        enabled:     !!c.value,
        description: c.description ?? null,
        updatedAt:   c.updatedAt,
      }));
  },
};

export const adminAffiliateService = {
  async fetchApplications(opts: {
    status?: string; cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminAffiliateApplication[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.limit)  params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/affiliates/applications?${params}`);
  },

  async approveApplication(id: string): Promise<AdminAffiliateApplication> {
    return adminApiFetch(`/api/v1/admin/affiliates/applications/${id}/approve`, { method: "POST" });
  },

  async rejectApplication(id: string, reason: string): Promise<AdminAffiliateApplication> {
    return adminApiFetch(`/api/v1/admin/affiliates/applications/${id}/reject`, {
      method: "POST",
      body:   JSON.stringify({ reason }),
    });
  },

  async fetchStats(): Promise<AdminAffiliateStats> {
    return adminApiFetch("/api/v1/admin/affiliates/stats");
  },

  async fetchCommissions(opts: {
    eventType?: string; tier?: number; beneficiaryId?: string; sourceUserId?: string;
    cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminAffiliateCommission[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.eventType)     params.set("eventType", opts.eventType);
    if (opts.tier)          params.set("tier", String(opts.tier));
    if (opts.beneficiaryId) params.set("beneficiaryId", opts.beneficiaryId);
    if (opts.sourceUserId)  params.set("sourceUserId", opts.sourceUserId);
    if (opts.cursor)        params.set("cursor", opts.cursor);
    if (opts.limit)         params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/affiliates/commissions?${params}`);
  },

  async fetchTopEarners(limit = 20): Promise<AdminTopEarner[]> {
    return adminApiFetch(`/api/v1/admin/affiliates/top-earners?limit=${limit}`);
  },

  async fetchAnalytics(): Promise<AdminCommissionAnalytics> {
    return adminApiFetch("/api/v1/admin/affiliates/analytics");
  },

  async fetchJobs(opts: { status?: string; cursor?: string; limit?: number } = {}): Promise<{
    items: AdminCommissionJob[]; nextCursor: string | null; hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.cursor) params.set("cursor", opts.cursor);
    if (opts.limit)  params.set("limit", String(opts.limit));
    return adminApiFetch(`/api/v1/admin/affiliates/jobs?${params}`);
  },
};

// ── Phase 9: Notification Management ─────────────────────────────────────────

export interface AdminNotificationItem {
  id:        string;
  userId:    string;
  username:  string | null;
  email:     string;
  type:      string;
  title:     string;
  message:   string;
  read:      boolean;
  createdAt: string;
}

export interface AdminNotificationStats {
  total:   number;
  unread:  number;
  read:    number;
  last7d:  number;
  last30d: number;
  byType:  Array<{ type: string; count: number }>;
}

export const adminNotificationService = {
  async fetchStats(): Promise<AdminNotificationStats> {
    return adminApiFetch("/api/v1/admin/notifications/stats");
  },

  async fetchTypes(): Promise<Array<{ type: string; count: number }>> {
    return adminApiFetch("/api/v1/admin/notifications/types");
  },

  async fetchAll(opts: {
    userId?: string; type?: string; read?: boolean; cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminNotificationItem[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.userId !== undefined) params.set("userId", opts.userId);
    if (opts.type   !== undefined) params.set("type",   opts.type);
    if (opts.read   !== undefined) params.set("read",   String(opts.read));
    if (opts.cursor !== undefined) params.set("cursor", opts.cursor);
    if (opts.limit  !== undefined) params.set("limit",  String(opts.limit));
    return adminApiFetch(`/api/v1/admin/notifications?${params}`);
  },

  async deleteNotification(id: string): Promise<{ deleted: boolean }> {
    return adminApiFetch(`/api/v1/admin/notifications/${id}`, { method: "DELETE" });
  },

  async deleteUserNotifications(userId: string): Promise<{ deleted: number }> {
    return adminApiFetch(`/api/v1/admin/notifications/user/${userId}`, { method: "DELETE" });
  },

  async broadcast(data: {
    type: string; title: string; message: string; segment: "all" | "vip" | "verified";
    metadata?: Record<string, unknown>;
  }): Promise<{ sent: number }> {
    return adminApiFetch("/api/v1/admin/notifications/broadcast", {
      method: "POST",
      body:   JSON.stringify(data),
    });
  },
};

// ── Phase 9: Content Management ──────────────────────────────────────────────

export type ContentCategory = "faq" | "help" | "blog" | "announcement";
export type ContentStatus   = "draft" | "published";

export interface AdminContentItem {
  id:          string;
  slug:        string;
  category:    ContentCategory;
  title:       string;
  excerpt:     string | null;
  status:      ContentStatus;
  publishedAt: string | null;
  createdBy:   string;
  updatedBy:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface AdminContentDetail extends AdminContentItem {
  body: string;
}

export const adminContentService = {
  async fetchList(opts: {
    category?: ContentCategory; status?: ContentStatus;
    search?: string; cursor?: string; limit?: number;
  } = {}): Promise<{ items: AdminContentItem[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.category) params.set("category", opts.category);
    if (opts.status)   params.set("status",   opts.status);
    if (opts.search)   params.set("search",   opts.search);
    if (opts.cursor)   params.set("cursor",   opts.cursor);
    if (opts.limit)    params.set("limit",    String(opts.limit));
    return adminApiFetch(`/api/v1/admin/content?${params}`);
  },

  async fetchOne(id: string): Promise<AdminContentDetail> {
    return adminApiFetch(`/api/v1/admin/content/${id}`);
  },

  async create(data: {
    category: ContentCategory; title: string; body: string; excerpt?: string; slug?: string;
  }): Promise<AdminContentDetail> {
    return adminApiFetch("/api/v1/admin/content", { method: "POST", body: JSON.stringify(data) });
  },

  async update(id: string, data: {
    title?: string; body?: string; excerpt?: string | null; slug?: string;
  }): Promise<AdminContentDetail> {
    return adminApiFetch(`/api/v1/admin/content/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  async publish(id: string): Promise<AdminContentDetail> {
    return adminApiFetch(`/api/v1/admin/content/${id}/publish`, { method: "POST" });
  },

  async unpublish(id: string): Promise<AdminContentDetail> {
    return adminApiFetch(`/api/v1/admin/content/${id}/unpublish`, { method: "POST" });
  },

  async delete(id: string): Promise<{ deleted: boolean }> {
    return adminApiFetch(`/api/v1/admin/content/${id}`, { method: "DELETE" });
  },
};

// ── Phase 9: Static Pages ─────────────────────────────────────────────────────

export interface AdminStaticPageItem {
  id:        string;
  slug:      string;
  title:     string;
  status:    "draft" | "published";
  isSystem:  boolean;
  sortOrder: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStaticPageDetail extends AdminStaticPageItem {
  body: string;
}

export const adminStaticPagesService = {
  async fetchList(opts: {
    status?: "draft" | "published"; search?: string;
  } = {}): Promise<AdminStaticPageItem[]> {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.search) params.set("search", opts.search);
    return adminApiFetch(`/api/v1/admin/pages?${params}`);
  },

  async fetchOne(id: string): Promise<AdminStaticPageDetail> {
    return adminApiFetch(`/api/v1/admin/pages/${id}`);
  },

  async create(data: {
    slug: string; title: string; body: string; sortOrder?: number;
  }): Promise<AdminStaticPageDetail> {
    return adminApiFetch("/api/v1/admin/pages", { method: "POST", body: JSON.stringify(data) });
  },

  async update(id: string, data: {
    title?: string; body?: string; slug?: string; sortOrder?: number;
  }): Promise<AdminStaticPageDetail> {
    return adminApiFetch(`/api/v1/admin/pages/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  async publish(id: string): Promise<AdminStaticPageDetail> {
    return adminApiFetch(`/api/v1/admin/pages/${id}/publish`, { method: "POST" });
  },

  async unpublish(id: string): Promise<AdminStaticPageDetail> {
    return adminApiFetch(`/api/v1/admin/pages/${id}/unpublish`, { method: "POST" });
  },

  async delete(id: string): Promise<{ deleted: boolean }> {
    return adminApiFetch(`/api/v1/admin/pages/${id}`, { method: "DELETE" });
  },

  async seed(): Promise<AdminStaticPageItem[]> {
    return adminApiFetch("/api/v1/admin/pages/seed", { method: "POST" });
  },
};

// ── Phase 9: Platform Text ────────────────────────────────────────────────────

export interface AdminTextEntry {
  key:          string;
  page:         string;
  field:        string;
  value:        string;
  defaultValue: string;
  description:  string | null;
  updatedAt:    string;
  updatedBy:    string | null;
  isCustomised: boolean;
}

export const adminTextService = {
  async fetchPages(): Promise<string[]> {
    return adminApiFetch("/api/v1/admin/text/pages");
  },

  async fetchAll(opts: {
    page?: string; search?: string;
  } = {}): Promise<AdminTextEntry[]> {
    const params = new URLSearchParams();
    if (opts.page)   params.set("page",   opts.page);
    if (opts.search) params.set("search", opts.search);
    return adminApiFetch(`/api/v1/admin/text?${params}`);
  },

  async update(key: string, value: string): Promise<{ key: string; value: string }> {
    return adminApiFetch(`/api/v1/admin/text/${encodeURIComponent(key)}`, {
      method: "PUT",
      body:   JSON.stringify({ value }),
    });
  },

  async reset(key: string): Promise<{ key: string; value: string }> {
    return adminApiFetch(`/api/v1/admin/text/${encodeURIComponent(key)}/reset`, { method: "POST" });
  },
};

// ── Phase 10 — Analytics & Reports ───────────────────────────────────────────

export type AnalyticsPreset =
  | "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month";

export interface AnalyticsDayStat {
  day: string;   // "YYYY-MM-DD"
  value: number;
  count: number;
}

function buildAnalyticsParams(opts: {
  preset?: AnalyticsPreset;
  from?: string;
  to?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.preset) p.set("preset", opts.preset);
  if (opts.from)   p.set("from",   opts.from);
  if (opts.to)     p.set("to",     opts.to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const adminAnalyticsService = {
  async fetchOverview(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/overview${buildAnalyticsParams(opts)}`);
  },

  async fetchUsers(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/users${buildAnalyticsParams(opts)}`);
  },

  async fetchFinancial(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/financial${buildAnalyticsParams(opts)}`);
  },

  async fetchRevenue(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/revenue${buildAnalyticsParams(opts)}`);
  },

  async fetchGames(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/games${buildAnalyticsParams(opts)}`);
  },

  async fetchTasks(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/tasks${buildAnalyticsParams(opts)}`);
  },

  async fetchKyc(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/kyc${buildAnalyticsParams(opts)}`);
  },

  async fetchNotifications(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/notifications${buildAnalyticsParams(opts)}`);
  },

  async fetchReferrals(opts: { preset?: AnalyticsPreset; from?: string; to?: string } = {}) {
    return adminApiFetch(`/api/v1/admin/analytics/referrals${buildAnalyticsParams(opts)}`);
  },
};


// ── Phase 28 — Admin Wallet Management ───────────────────────────────────────

export type WalletType = "main" | "game" | "task" | "referral" | "affiliate" | "task_vault" | "ambassador";

export interface AdminWalletStats {
  grandTotalBalance: number;
  totalFrozenWallets: number;
  totalActiveWallets: number;
  totalUsers: number;
  byType: Record<string, { totalBalance: number; walletCount: number; frozenCount: number }>;
}

export interface AdminWalletUserRow {
  userId: string;
  email: string;
  username: string | null;
  fullName: string | null;
  createdAt: string;
  totalBalance: number;
  balances: Record<string, number>;
  hasFrozenWallet: boolean;
  lastActivity: string | null;
}

export interface AdminWalletDetail {
  walletType: string;
  balance: number;
  lockedAmount: number;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  frozenReason: string | null;
  updatedAt: string | null;
}

export interface AdminUserWallets {
  userId: string;
  email: string;
  username: string | null;
  fullName: string | null;
  wallets: AdminWalletDetail[];
}

export interface AdminWalletLedgerEntry {
  id: string;
  userId: string;
  email: string;
  username: string | null;
  type: string;
  fromWallet: string | null;
  toWallet: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

export interface AdminWalletAuditEntry {
  id: string;
  userId: string;
  userEmail: string;
  username: string | null;
  type: string;
  walletType: string;
  amount: number;
  description: string;
  adminId: string | null;
  reason: string | null;
  balanceBefore: number | null;
  createdAt: string;
}

export interface AdminWalletDiagnosticIssue {
  severity: "critical" | "warning";
  type: string;
  userId: string;
  walletType: string;
  balance: number;
  detail: string;
}

export interface AdminWalletDiagnostics {
  checkedAt: string;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  issues: AdminWalletDiagnosticIssue[];
}

export const adminWalletService = {
  async getStats(): Promise<AdminWalletStats> {
    return adminApiFetch("/api/v1/admin/wallets/stats");
  },

  async searchUsers(opts: { search?: string; cursor?: string; limit?: number } = {}): Promise<{ users: AdminWalletUserRow[]; nextCursor: string | null }> {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.cursor) p.set("cursor", opts.cursor);
    if (opts.limit)  p.set("limit",  String(opts.limit));
    return adminApiFetch(`/api/v1/admin/wallets/users?${p}`);
  },

  async getUserWallets(userId: string): Promise<AdminUserWallets> {
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}`);
  },

  async getLedger(opts: {
    userId?: string; walletType?: string; type?: string;
    cursor?: string; limit?: number; from?: string; to?: string;
  } = {}): Promise<{ entries: AdminWalletLedgerEntry[]; nextCursor: string | null }> {
    const p = new URLSearchParams();
    if (opts.userId)     p.set("userId",     opts.userId);
    if (opts.walletType) p.set("walletType", opts.walletType);
    if (opts.type)       p.set("type",       opts.type);
    if (opts.cursor)     p.set("cursor",     opts.cursor);
    if (opts.limit)      p.set("limit",      String(opts.limit));
    if (opts.from)       p.set("from",       opts.from);
    if (opts.to)         p.set("to",         opts.to);
    return adminApiFetch(`/api/v1/admin/wallets/ledger?${p}`);
  },

  async getUserLedger(userId: string, opts: {
    walletType?: string; cursor?: string; limit?: number;
  } = {}): Promise<{ entries: AdminWalletLedgerEntry[]; nextCursor: string | null }> {
    const p = new URLSearchParams();
    if (opts.walletType) p.set("walletType", opts.walletType);
    if (opts.cursor)     p.set("cursor",     opts.cursor);
    if (opts.limit)      p.set("limit",      String(opts.limit));
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}/ledger?${p}`);
  },

  async credit(userId: string, body: { walletType: WalletType; amount: number; reason: string }) {
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}/credit`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async debit(userId: string, body: { walletType: WalletType; amount: number; reason: string }) {
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}/debit`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async freeze(userId: string, body: { walletType: WalletType; reason: string }) {
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}/freeze`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async unfreeze(userId: string, body: { walletType: WalletType }) {
    return adminApiFetch(`/api/v1/admin/wallets/users/${userId}/unfreeze`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getDiagnostics(): Promise<AdminWalletDiagnostics> {
    return adminApiFetch("/api/v1/admin/wallets/diagnostics");
  },

  async getAuditLog(opts: { adminId?: string; cursor?: string; limit?: number } = {}): Promise<{ entries: AdminWalletAuditEntry[]; nextCursor: string | null }> {
    const p = new URLSearchParams();
    if (opts.adminId) p.set("adminId", opts.adminId);
    if (opts.cursor)  p.set("cursor",  opts.cursor);
    if (opts.limit)   p.set("limit",   String(opts.limit));
    return adminApiFetch(`/api/v1/admin/wallets/audit?${p}`);
  },
};
