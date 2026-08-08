import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Crown, ShieldCheck, Ban, Wallet, GamepadIcon, ClipboardList,
  Users, Edit2, AlertTriangle, CheckCircle2, RefreshCw, TrendingUp,
  KeyRound, Mail, Smartphone, Building2,
} from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { adminUserService, type AdminUserDetailSnapshot } from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const GAME_LABELS: Record<string, string> = {
  color_game:   "Color Game",
  spin_battle:  "Spin Battle",
  dice_duel:    "Dice Clash",
  dice_royale:  "Dice Royale",
  dice_arena:   "Dice Arena",
  reaction_tap: "Reaction Tap",
  pvp_coinflip: "Coin Flip",
};

const TXN_LABELS: Record<string, string> = {
  deposit:              "Deposit",
  withdrawal:           "Withdrawal",
  transfer:             "Transfer",
  game_win:             "Game Win",
  game_bet:             "Game Bet",
  task_reward:          "Task Reward",
  referral_bonus:       "Referral Bonus",
  vip_purchase:         "VIP Purchase",
  affiliate_commission: "Affiliate Comm.",
  streak_reward:        "Streak Reward",
};

const TXN_COLORS: Record<string, string> = {
  deposit: "text-emerald-400", game_win: "text-emerald-400", task_reward: "text-emerald-400",
  referral_bonus: "text-emerald-400", affiliate_commission: "text-emerald-400", streak_reward: "text-emerald-400",
  withdrawal: "text-red-400", game_bet: "text-zinc-400",
  transfer: "text-indigo-400", vip_purchase: "text-amber-400",
};

type DialogType = "suspend" | "unsuspend" | "edit_role" | "set_verification" | "override_limits" | "force_verify_email" | "disable_2fa" | "clear_pin" | null;

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();
  const { can }    = useAdminAccess();

  const [user, setUser]         = useState<AdminUserDetailSnapshot | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [dialog, setDialog]     = useState<DialogType>(null);
  const [busy, setBusy]         = useState(false);

  // Edit role form state
  const [editRole, setEditRole]         = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");

  // Verification override
  const [newVerification, setNewVerification] = useState("verified");

  // Limit override
  const [newDailyUsed, setNewDailyUsed]       = useState("0");
  const [newMonthlyUsed, setNewMonthlyUsed]   = useState("0");

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminUserService.fetchUserById(userId);
      if (!data) throw new Error("User not found");
      setUser(data);
      setEditRole(data.role ?? "user");
      setEditUsername(data.username);
      setEditFullName(data.fullName ?? "");
      setNewDailyUsed(String(data.dailyWithdrawalUsed ?? 0));
      setNewMonthlyUsed(String(data.monthlyWithdrawalUsed ?? 0));
    } catch (e: any) {
      setError(e.message ?? "Failed to load user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const handleAction = async () => {
    if (!user || !userId) return;
    setBusy(true);
    try {
      if (dialog === "suspend") {
        await adminUserService.suspendUser(userId);
      } else if (dialog === "unsuspend") {
        await adminUserService.unsuspendUser(userId);
      } else if (dialog === "edit_role") {
        await adminUserService.editUser(userId, {
          role: editRole,
          username: editUsername || undefined,
          fullName: editFullName || undefined,
        });
      } else if (dialog === "set_verification") {
        await adminUserService.setVerification(userId, newVerification);
      } else if (dialog === "override_limits") {
        await adminUserService.overrideLimits(userId, parseFloat(newDailyUsed) || 0, parseFloat(newMonthlyUsed) || 0);
      } else if (dialog === "force_verify_email") {
        await adminUserService.forceVerifyEmail(userId);
      } else if (dialog === "disable_2fa") {
        await adminUserService.disable2FA(userId);
      } else if (dialog === "clear_pin") {
        await adminUserService.clearPin(userId);
      }
      setDialog(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-10 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">User not found</p>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  const isSuspended   = !!user.suspendedAt;
  const totalBalance  = user.totalBalance ?? 0;
  const totalGames    = user.gameStats.reduce((s, g) => s + g.totalGames, 0);
  const totalWagered  = user.gameStats.reduce((s, g) => s + g.totalWagered, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => navigate("/admin/users")} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Users
      </button>

      {/* Header card */}
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-indigo-300">
              {(user.username || user.email || "?").charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-lg font-bold text-white">{user.username || "—"}</h2>
              {user.vipStatus && <Crown className="w-4 h-4 text-amber-400" />}
              {isSuspended && <Ban className="w-4 h-4 text-red-400" />}
              <StatusBadge status={isSuspended ? "rejected" : user.verificationStatus} label={isSuspended ? "Suspended" : undefined} size="md" />
            </div>
            <p className="text-sm text-zinc-400 mb-1">{user.email}</p>
            {user.fullName && <p className="text-xs text-zinc-500">{user.fullName}</p>}
            <div className="flex gap-4 mt-3 flex-wrap">
              <div className="text-xs text-zinc-500">Role: <span className="text-zinc-300 capitalize">{(user.role ?? "user").replace(/_/g, " ")}</span></div>
              <div className="text-xs text-zinc-500">ID: <span className="text-zinc-300 font-mono text-[10px]">{user.userId}</span></div>
              <div className="text-xs text-zinc-500">Joined: <span className="text-zinc-300">{new Date(user.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span></div>
              <div className="text-xs text-zinc-500">Ref: <span className="text-zinc-300 font-mono">{user.referralCode}</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {can("admin.users.edit") && (
              <button
                onClick={() => setDialog("edit_role")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-300 hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {can("admin.users.suspend") && (
              isSuspended ? (
                <button
                  onClick={() => setDialog("unsuspend")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Unsuspend
                </button>
              ) : (
                <button
                  onClick={() => setDialog("suspend")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-xs text-red-300 hover:bg-red-600/30 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" /> Suspend
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Wallet Overview */}
          <Section title="Wallet Overview" icon={<Wallet className="w-4 h-4 text-emerald-400" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {Object.entries(user.walletBalances ?? {}).map(([type, bal]) => (
                <div key={type} className="rounded-xl bg-zinc-900/60 border border-white/[0.05] p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{type}</p>
                  <p className="text-base font-bold text-white tabular-nums">${Number(bal).toFixed(2)}</p>
                </div>
              ))}
              <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total</p>
                <p className="text-base font-bold text-indigo-300 tabular-nums">${totalBalance.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-6 text-xs text-zinc-400 pt-3 border-t border-white/[0.04]">
              <span>Daily used: <strong className="text-zinc-300">${(user.dailyWithdrawalUsed ?? 0).toFixed(2)}</strong> / ${(user.dailyLimit ?? 0).toFixed(2)}</span>
              <span>Monthly used: <strong className="text-zinc-300">${(user.monthlyWithdrawalUsed ?? 0).toFixed(2)}</strong> / ${(user.monthlyLimit ?? 0).toFixed(2)}</span>
            </div>
            {can("admin.users.override_limits") && (
              <button
                onClick={() => setDialog("override_limits")}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Override withdrawal limits →
              </button>
            )}
          </Section>

          {/* Game Activity */}
          <Section title="Game Activity" icon={<GamepadIcon className="w-4 h-4 text-indigo-400" />}>
            {user.gameStats.length === 0 ? (
              <p className="text-sm text-zinc-500">No game activity yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricCell label="Total Games" value={totalGames.toString()} />
                  <MetricCell label="Total Wagered" value={`$${totalWagered.toFixed(2)}`} />
                  <MetricCell label="Total Won" value={`$${user.gameStats.reduce((s, g) => s + g.totalWon, 0).toFixed(2)}`} />
                </div>
                <div className="space-y-2">
                  {user.gameStats.map(g => {
                    const winRate = g.totalGames > 0 ? Math.round((g.wins / g.totalGames) * 100) : 0;
                    return (
                      <div key={g.gameType} className="flex items-center gap-3 py-2 border-t border-white/[0.04]">
                        <p className="text-sm text-zinc-300 w-32 flex-shrink-0">{GAME_LABELS[g.gameType] ?? g.gameType}</p>
                        <div className="flex gap-4 text-xs text-zinc-500 flex-1">
                          <span>{g.totalGames} games</span>
                          <span className="text-emerald-500">{g.wins}W</span>
                          <span className="text-red-500">{g.losses}L</span>
                          <span>{winRate}% WR</span>
                        </div>
                        <span className="text-xs text-zinc-400 tabular-nums">${g.totalWagered.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Section>

          {/* Recent Transactions */}
          <Section title="Recent Transactions" icon={<TrendingUp className="w-4 h-4 text-blue-400" />}>
            {user.recentTransactions.length === 0 ? (
              <p className="text-sm text-zinc-500">No transactions yet.</p>
            ) : (
              <div className="space-y-0 divide-y divide-white/[0.04]">
                {user.recentTransactions.map(t => {
                  const isCredit = ["deposit","game_win","task_reward","referral_bonus","affiliate_commission","streak_reward"].includes(t.type);
                  return (
                    <div key={t.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300">{TXN_LABELS[t.type] ?? t.type}</p>
                        {t.description && <p className="text-[11px] text-zinc-600 truncate">{t.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium tabular-nums ${isCredit ? "text-emerald-400" : TXN_COLORS[t.type] ?? "text-zinc-300"}`}>
                          {isCredit ? "+" : "−"}${Math.abs(t.amount).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-zinc-600">{new Date(t.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Account Summary */}
          <Section title="Account Summary" icon={<ShieldCheck className="w-4 h-4 text-zinc-400" />}>
            <dl className="space-y-3">
              <DetailRow label="Tier" value={<span className="capitalize">{user.tier ?? "free"}</span>} />
              <DetailRow label="VIP" value={user.vipStatus ? <span className="text-amber-400">Active</span> : <span className="text-zinc-500">Inactive</span>} />
              {user.vipDetail && (
                <>
                  <DetailRow label="VIP Plan" value={user.vipDetail.plan} />
                  <DetailRow label="VIP Expires" value={new Date(user.vipDetail.endsAt).toLocaleDateString()} />
                  {user.vipDetail.streak && (
                    <DetailRow label="Streak" value={`${user.vipDetail.streak.currentStreak} days / $${user.vipDetail.streak.totalEarned.toFixed(2)} earned`} />
                  )}
                </>
              )}
              <DetailRow label="Phone Verified" value={user.phoneVerified ? "Yes" : "No"} />
              {user.phoneNumber && <DetailRow label="Phone" value={user.phoneNumber} />}
              {isSuspended && user.suspendedAt && (
                <DetailRow label="Suspended" value={new Date(user.suspendedAt).toLocaleDateString()} accent="red" />
              )}
            </dl>
          </Section>

          {/* KYC */}
          <Section title="KYC Status" icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}>
            <div className="mb-3">
              <StatusBadge status={user.verificationStatus} size="md" />
            </div>
            {user.kycDetail ? (
              <dl className="space-y-2.5">
                {user.kycDetail.fullName && <DetailRow label="Name" value={user.kycDetail.fullName} />}
                {user.kycDetail.idType && <DetailRow label="ID Type" value={user.kycDetail.idType.replace(/_/g, " ")} />}
                {user.kycDetail.countryCode && <DetailRow label="Country" value={user.kycDetail.countryCode} />}
                {user.kycDetail.submittedAt && <DetailRow label="Submitted" value={new Date(user.kycDetail.submittedAt).toLocaleDateString()} />}
                {user.kycDetail.reviewedAt && <DetailRow label="Reviewed" value={new Date(user.kycDetail.reviewedAt).toLocaleDateString()} />}
                {user.kycDetail.rejectionReason && <DetailRow label="Reason" value={user.kycDetail.rejectionReason} accent="red" />}
              </dl>
            ) : (
              <p className="text-xs text-zinc-500">No KYC submission on record.</p>
            )}
            {can("admin.kyc.approve") && (
              <button
                onClick={() => setDialog("set_verification")}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Override verification status →
              </button>
            )}
          </Section>

          {/* Tasks & Referrals */}
          <Section title="Tasks & Referrals" icon={<ClipboardList className="w-4 h-4 text-purple-400" />}>
            <dl className="space-y-2.5">
              <DetailRow label="Total Proofs" value={user.taskSummary.totalProofs.toString()} />
              <DetailRow label="Approved Proofs" value={user.taskSummary.approvedProofs.toString()} />
              <DetailRow label="Rewards Earned" value={`$${user.taskSummary.totalRewardsEarned.toFixed(2)}`} />
            </dl>
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <p className="text-xs text-zinc-500 mb-2.5 uppercase tracking-wider">Referrals Sent</p>
              <dl className="space-y-2.5">
                <DetailRow label="Total" value={user.referralSummary.totalReferrals.toString()} />
                <DetailRow label="Active" value={user.referralSummary.activeReferrals.toString()} />
                <DetailRow label="Rewarded" value={user.referralSummary.rewardedReferrals.toString()} />
              </dl>
            </div>
          </Section>

          {/* Security Status */}
          <Section title="Security Status" icon={<KeyRound className="w-4 h-4 text-rose-400" />}>
            <dl className="space-y-2.5">
              <DetailRow
                label="Email Verified"
                value={user.emailVerified
                  ? <span className="text-emerald-400">Verified</span>
                  : <span className="text-red-400">Not Verified</span>}
              />
              <DetailRow
                label="2FA"
                value={user.twoFactorEnabled
                  ? <span className="text-emerald-400">Enabled</span>
                  : <span className="text-zinc-500">Disabled</span>}
              />
              <DetailRow
                label="Security PIN"
                value={user.pinStatus === "set"
                  ? <span className="text-emerald-400">Set</span>
                  : <span className="text-zinc-500">Not Set</span>}
              />
            </dl>
            {can("admin.users.edit") && (
              <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1.5">
                {!user.emailVerified && (
                  <button
                    onClick={() => setDialog("force_verify_email")}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Mail className="w-3 h-3" /> Force verify email →
                  </button>
                )}
                {user.twoFactorEnabled && (
                  <button
                    onClick={() => setDialog("disable_2fa")}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Smartphone className="w-3 h-3" /> Disable 2FA →
                  </button>
                )}
                {user.pinStatus === "set" && (
                  <button
                    onClick={() => setDialog("clear_pin")}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <KeyRound className="w-3 h-3" /> Clear Security PIN →
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* Banking & Wallet */}
          <Section title="Banking & Wallet" icon={<Building2 className="w-4 h-4 text-blue-400" />}>
            {(user.bankName || user.bankAccountName || user.bankAccountNumber || user.usdtAddress) ? (
              <dl className="space-y-2.5">
                {user.bankName && <DetailRow label="Bank Name" value={user.bankName} />}
                {user.bankAccountName && <DetailRow label="Account Name" value={user.bankAccountName} />}
                {user.bankAccountNumber && <DetailRow label="Account Number" value={<span className="font-mono">{user.bankAccountNumber}</span>} />}
                {user.usdtAddress && (
                  <>
                    <div className="pt-2 border-t border-white/[0.04]" />
                    <DetailRow label="USDT (BEP-20)" value={<span className="font-mono text-[10px] break-all">{user.usdtAddress}</span>} />
                  </>
                )}
              </dl>
            ) : (
              <p className="text-xs text-zinc-600">No payment details on record.</p>
            )}
          </Section>

          {/* Referrals / Affiliate codes */}
          <Section title="Platform Codes" icon={<Users className="w-4 h-4 text-zinc-400" />}>
            <dl className="space-y-2.5">
              <DetailRow label="Referral Code" value={<span className="font-mono">{user.referralCode}</span>} />
              {user.affiliateCode && <DetailRow label="Affiliate Code" value={<span className="font-mono">{user.affiliateCode}</span>} />}
            </dl>
          </Section>

        </div>
      </div>

      {/* ── Dialogs ── */}

      {/* Suspend */}
      <ConfirmDialog
        open={dialog === "suspend"}
        variant="danger"
        title="Suspend Account"
        message={`This will immediately suspend ${user.username}'s account. They will not be able to log in or perform any actions.`}
        confirmLabel={busy ? "Suspending…" : "Suspend Account"}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      {/* Unsuspend */}
      <ConfirmDialog
        open={dialog === "unsuspend"}
        variant="success"
        title="Unsuspend Account"
        message={`Restore full access for ${user.username}. They will be able to log in immediately.`}
        confirmLabel={busy ? "Unsuspending…" : "Restore Access"}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      {/* Edit Role / Profile */}
      {dialog === "edit_role" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="user">User</option>
                  <option value="moderator_admin">Moderator Admin</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="finance_admin">Finance Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
                <input
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                <input
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:text-white transition-all">Cancel</button>
              <button onClick={handleAction} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50">
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Verification */}
      {dialog === "set_verification" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Override Verification Status</h3>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">New Status</label>
              <select
                value={newVerification}
                onChange={e => setNewVerification(e.target.value)}
                className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                <option value="unverified">Unverified</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:text-white transition-all">Cancel</button>
              <button onClick={handleAction} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-all disabled:opacity-50">
                {busy ? "Updating…" : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Verify Email */}
      <ConfirmDialog
        open={dialog === "force_verify_email"}
        variant="success"
        title="Force Verify Email"
        message={`This will mark ${user.username}'s email address as verified, bypassing the normal email verification flow. Use only for support cases.`}
        confirmLabel={busy ? "Verifying…" : "Force Verify Email"}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      {/* Disable 2FA */}
      <ConfirmDialog
        open={dialog === "disable_2fa"}
        variant="danger"
        title="Disable Two-Factor Authentication"
        message={`This will disable 2FA for ${user.username} and remove their TOTP secret. They will need to set up 2FA again from their settings. Only use for account recovery.`}
        confirmLabel={busy ? "Disabling…" : "Disable 2FA"}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      {/* Clear Security PIN */}
      <ConfirmDialog
        open={dialog === "clear_pin"}
        variant="danger"
        title="Clear Security PIN"
        message={`This will delete ${user.username}'s Security PIN. They will need to create a new PIN before making withdrawals or saving payment details again.`}
        confirmLabel={busy ? "Clearing…" : "Clear PIN"}
        onConfirm={handleAction}
        onCancel={() => setDialog(null)}
      />

      {/* Override Limits */}
      {dialog === "override_limits" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDialog(null)} />
          <div className="relative w-full max-w-sm bg-[#1c1c22] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-1">Override Withdrawal Limits</h3>
            <p className="text-xs text-zinc-500 mb-4">Set how much of this period the user has already "used". Higher values reduce available limit.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Daily Used ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={newDailyUsed}
                  onChange={e => setNewDailyUsed(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Monthly Used ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={newMonthlyUsed}
                  onChange={e => setNewMonthlyUsed(e.target.value)}
                  className="w-full text-sm bg-zinc-900 border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDialog(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:text-white transition-all">Cancel</button>
              <button onClick={handleAction} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50">
                {busy ? "Saving…" : "Override Limits"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "red" | "green" }) {
  const colorClass = accent === "red" ? "text-red-400" : accent === "green" ? "text-emerald-400" : "text-zinc-300";
  return (
    <div className="flex justify-between items-start gap-4">
      <dt className="text-xs text-zinc-500 flex-shrink-0">{label}</dt>
      <dd className={`text-xs ${colorClass} text-right`}>{value}</dd>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/60 border border-white/[0.05] p-3 text-center">
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}
