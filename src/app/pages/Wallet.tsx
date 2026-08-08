import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  ArrowRightLeft,
  ArrowUpFromLine,
  ArrowDownToLine,
  Wallet as WalletIcon,
  Gamepad2,
  ClipboardList,
  Users,
  History,
  Copy,
  DollarSign,
  Crown,
  Gift,
  Flame,
  Star,
  CheckCircle2,
  Rocket,
  Eye,
  EyeOff,
  TrendingUp,
  Shield,
  Zap,
  Headphones,
  BarChart3,
  Lock,
  Check,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useSettings, CURRENCIES } from "../contexts/SettingsContext";
import { useGeoLocation } from "../hooks/useGeoLocation";
import { useWallet } from "../contexts/WalletContext";
import { useTransactions } from "../contexts/TransactionContext";
import { useVerification } from "../contexts/VerificationContext";
import { useNotifications } from "../contexts/NotificationContext";
import { liveActivityService } from "../services/liveActivityService";
import { PremiumVIPCard } from "../components/PremiumVIPCard";
import { userProfileService } from "../services/userProfileService";
import { useIdentity } from "../contexts/IdentityContext";
import { CryptoDepositDialog } from "../components/CryptoDepositDialog";
import { FeaturedPromotionCard } from "../components/FeaturedPromotionCard";
import { BankDepositDialog } from "../components/BankDepositDialog";
import { depositMonitoringService } from "../services/depositMonitoringService";
import { WithdrawalWizard } from "../components/WithdrawalWizard";
import { getExplorerLink, maskTransactionHash } from "../utils/formatUtils";
import { withdrawalLimitService } from "../services/withdrawalLimitService";

type WalletType = "main" | "game" | "task" | "referral" | "affiliate" | "ambassador";
type ActionType = "deposit" | "withdraw" | "transfer" | null;
type DepositMethod = "bank" | "crypto" | null;
type WithdrawMethod = "bank" | "crypto" | null;

const _WALLET_API = (import.meta as any).env?.VITE_API_URL as string | undefined;
function _walletToken() { return localStorage.getItem("bitzimi_access_token"); }
async function _wFetch(path: string, opts?: RequestInit) {
  const token = _walletToken();
  if (!_WALLET_API || !token) return null;
  const res = await fetch(`${_WALLET_API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `API error ${res.status}`);
  }
  return res.json();
}

export function Wallet() {
  const navigate = useNavigate();
  const { formatCurrency, convertFromUSD, currency, t } = useSettings();
  const geo = useGeoLocation();
  const { balances, transfer, getTotalBalance, getTotalBalanceExcludingMain, refreshWalletsFromBackend } = useWallet();
  const { transactions, addTransaction, updateTransaction, getTransactionByDepositId, getTransactionByWithdrawalId } = useTransactions();
  const { isVerified, canWithdraw, recordWithdrawal, getWithdrawalLimits } = useVerification();
  const { addNotification } = useNotifications();
  const { identity } = useIdentity();

  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showWithdrawalWizard, setShowWithdrawalWizard] = useState(false);
  const [balancesHidden, setBalancesHidden] = useState(false);

  // Returns masked display value when balances are hidden
  const displayAmount = (amount: number) => balancesHidden ? "••••••" : formatCurrency(amount);
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 20;
  
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<WalletType>("game");
  const [transferTo, setTransferTo] = useState<WalletType>("task");
  const [transferAmount, setTransferAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>(null);
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawMethod>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankDetails, setBankDetails] = useState({
    accountNumber: "",
    accountName: "",
    bankName: ""
  });
  const [cryptoAddress, setCryptoAddress] = useState("");

  // VIP and Daily Streak states
  const [hasVIP, setHasVIP] = useState(false);
  const [showVIPDialog, setShowVIPDialog] = useState(false);
  const [showStreakDialog, setShowStreakDialog] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [streakStatus, setStreakStatus] = useState({
    currentStreak: 0,
    canClaimToday: false,
    nextRewardUSD: 0.05,
    rewards: [] as Array<{ day: number; amountUSD: number; claimed: boolean }>,
  });
  
  // Operation status states for animations
  const [transferStatus, setTransferStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [depositStatus, setDepositStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");

  // Deposit dialog states
  const [showCryptoDepositDialog, setShowCryptoDepositDialog] = useState(false);
  const [showBankDepositDialog, setShowBankDepositDialog] = useState(false);

  // Platform config — controls feature availability (banking, crypto)
  const [platformConfig, setPlatformConfig] = useState<{
    cryptoDepositsAvailable: boolean;
    bankDepositsEnabled: boolean;
    bankWithdrawalsEnabled: boolean;
  } | null>(null);

  // Get NGN exchange rate from CURRENCIES (for bank transfer display purposes)
  const NGN_RATE = CURRENCIES.find(c => c.code === "NGN")?.rate || 1347;

  // Nigerian detection — IP geolocation only. Currency NEVER determines region.
  const checkIsNigerian = (): boolean => {
    // Priority 1: Live IP geolocation (reflects current location/VPN)
    if (!geo.loading && geo.countryCode === "NG") return true;
    // Priority 2: Verified phone country ISO
    const profile = userProfileService.getProfile();
    if (profile?.phoneVerified && profile.phoneCountryIso === "NG") return true;
    // Fallback: legacy +234 phone code
    if (profile?.phoneVerified && profile.phoneCountryCode === "+234") return true;
    return false;
  };

  const isNigerian = checkIsNigerian();

  // User tier for withdrawal limits
  const userTier = hasVIP ? "vip" : (isVerified ? "verified" : "free") as "free" | "verified" | "vip";

  // Start deposit/withdrawal monitoring service
  useEffect(() => {
    const userId = identity.userId;

    if (!userId) {
      console.warn("No user ID found, skipping monitoring service");
      return;
    }

    // Callback for when deposit is confirmed
    const handleDepositConfirmed = (depositId: string, amount: number) => {
      console.log("💰 Deposit confirmed:", depositId, amount);

      // Backend has already credited the game wallet — refresh display balance
      refreshWalletsFromBackend().catch(() => {});

      // IMPORTANT: UPDATE existing transaction (do NOT create duplicate)
      const existingTx = getTransactionByDepositId(depositId);
      if (existingTx) {
        updateTransaction(existingTx.id, {
          status: "completed",
          description: "Deposit Confirmed",
        });
        console.log("♻️ Updated existing transaction:", existingTx.id, "→ completed");
      } else {
        console.warn("⚠️ No existing transaction found for depositId:", depositId);
      }

      // Add notification
      addNotification(
        "deposit",
        "💰 Deposit Confirmed!",
        `${formatCurrency(amount)} has been added to your Game Wallet`,
        { amount, depositId }
      );

      // Show toast
      toast.success(`Deposit confirmed! ${formatCurrency(amount)} added to Game Wallet`);

      // Add to live activity
      liveActivityService.addActivity(
        "deposit",
        identity.username,
        `deposited to wallet`,
        amount
      );
    };

    // Callback for when withdrawal is completed
    const handleWithdrawalCompleted = (withdrawalId: string, amount: number) => {
      console.log("✅ Withdrawal completed:", withdrawalId, amount);

      // IMPORTANT: UPDATE existing transaction (do NOT create duplicate)
      const existingTx = getTransactionByWithdrawalId(withdrawalId);
      if (existingTx) {
        updateTransaction(existingTx.id, {
          status: "completed",
          description: existingTx.description.replace("Submitted", "Completed").replace("Processing", "Completed"),
        });
        console.log("♻️ Updated existing transaction:", existingTx.id, "→ completed");
      } else {
        console.warn("⚠️ No existing transaction found for withdrawalId:", withdrawalId);
      }

      // Add notification
      addNotification(
        "withdrawal",
        "✅ Withdrawal Completed!",
        `${formatCurrency(amount)} has been sent to your account`,
        { amount, withdrawalId }
      );

      // Show toast
      toast.success(`Withdrawal completed! ${formatCurrency(amount)} sent successfully`);
    };

    // Subscribe to deposit state changes
    const unsubscribeDepositState = depositMonitoringService.onDepositStateChange((depositId, status) => {
      console.log("🔄 Deposit state changed:", depositId, "→", status);
      const existingTx = getTransactionByDepositId(depositId);
      if (existingTx && status !== "completed") {
        // Update transaction status (completed is handled by handleDepositConfirmed)
        updateTransaction(existingTx.id, {
          status: status as any,
        });
      }
    });

    // Subscribe to withdrawal state changes
    const unsubscribeWithdrawalState = depositMonitoringService.onWithdrawalStateChange((withdrawalId, status) => {
      console.log("🔄 Withdrawal state changed:", withdrawalId, "→", status);
      const existingTx = getTransactionByWithdrawalId(withdrawalId);
      if (existingTx && status !== "completed") {
        // Update transaction status (completed is handled by handleWithdrawalCompleted)
        const statusMap: Record<string, string> = {
          submitted: "pending",
          processing: "pending",
          reviewing: "pending",
        };
        updateTransaction(existingTx.id, {
          status: (statusMap[status] || status) as any,
          description: existingTx.description.includes("Crypto")
            ? `Crypto Withdrawal (${status})`
            : `Bank Withdrawal (${status})`,
        });
      }
    });

    // Start monitoring
    depositMonitoringService.startMonitoring(
      handleDepositConfirmed,
      handleWithdrawalCompleted
    );

    // Cleanup on unmount
    return () => {
      depositMonitoringService.stopMonitoring();
      unsubscribeDepositState();
      unsubscribeWithdrawalState();
    };
  }, [refreshWalletsFromBackend, addTransaction, updateTransaction, getTransactionByDepositId, getTransactionByWithdrawalId, addNotification, formatCurrency]);

  // Load VIP status and subscription data — backend authoritative, local service fallback
  useEffect(() => {
    const load = async () => {
      if (_WALLET_API && _walletToken()) {
        try {
          const json = await _wFetch("/api/v1/vip");
          if (json?.data) {
            const d = json.data;
            const streak = d.streak ?? {};
            setHasVIP(!!d.isActive);
            setSubscription(d.isActive ? d : null);
            const backendRewards: Array<{ day: number; amountUSD: number }> = Array.isArray(streak.rewards) && streak.rewards.length > 0
              ? streak.rewards
              : [0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50].map((amt, i) => ({ day: i + 1, amountUSD: amt }));
            setStreakStatus({
              currentStreak: streak.current ?? 0,
              canClaimToday: !!streak.canClaimToday,
              nextRewardUSD: streak.nextRewardUSD ?? (backendRewards[streak.current ?? 0]?.amountUSD ?? 0.05),
              rewards: backendRewards.map((r, i) => ({
                day: r.day,
                amountUSD: r.amountUSD,
                claimed: i < (streak.current ?? 0),
              })),
            });
            return;
          }
        } catch {}
      }
    };
    load();
  }, []);

  // Load platform config (banking/crypto feature flags) — backend authoritative
  useEffect(() => {
    if (!_WALLET_API || !_walletToken()) return;
    _wFetch("/api/v1/platform/config")
      .then((json) => { if (json?.data) setPlatformConfig(json.data); })
      .catch(() => {});
  }, []);

  const monthlyPriceUSD = 4;

  const handleSubscribe = async () => {
    const username = identity.username;

    // VIP requires KYC verification
    if (!isVerified) {
      toast.error("Identity verification is required before upgrading to VIP membership.");
      setShowVIPDialog(false);
      navigate("/identity-verification");
      return;
    }

    // Pre-check: backend deducts from game wallet
    if (balances.game < monthlyPriceUSD) {
      toast.error(`Insufficient balance in Game Wallet. VIP monthly subscription costs ${formatCurrency(monthlyPriceUSD)}`);
      return;
    }

    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    const token = localStorage.getItem("bitzimi_access_token");

    if (apiBase && token) {
      // Backend authoritative path — deducts game wallet, creates VIP record, fires affiliate commissions
      try {
        const res = await fetch(`${apiBase}/api/v1/vip/subscribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.message ?? "Failed to activate VIP");
          return;
        }
        // Sync display balances from backend (game wallet was deducted)
        await refreshWalletsFromBackend().catch(() => {});
        setHasVIP(true);
      } catch {
        toast.error("Could not reach server. Please try again.");
        return;
      }
    } else {
      toast.error("Could not reach server. Please try again.");
      return;
    }

    liveActivityService.addActivity("vip_subscribe", username, `subscribed to VIP monthly`, monthlyPriceUSD);
    addNotification(
      "vip_activation",
      "🎉 VIP Activated!",
      `Your VIP monthly subscription is now active. Enjoy all premium benefits!`,
      { plan: "monthly", amount: monthlyPriceUSD }
    );
    toast.success(`🎉 VIP monthly subscription activated! Welcome to VIP!`);
    setShowVIPDialog(false);
  };

  const handleClaimStreak = async () => {
    const username = identity.username;
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    const token = localStorage.getItem("bitzimi_access_token");

    let amountUSD = 0;
    let newStreak = 0;

    if (apiBase && token) {
      // Backend authoritative path — credits game wallet, advances streak
      try {
        const res = await fetch(`${apiBase}/api/v1/vip/streak/claim`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err?.message ?? "Failed to claim streak");
          return;
        }
        const json = await res.json();
        amountUSD = json.data?.amountUSD ?? 0;
        newStreak  = json.data?.newStreak  ?? 0;
        // Sync display balances from backend (game wallet was credited)
        await refreshWalletsFromBackend().catch(() => {});
      } catch {
        toast.error("Could not reach server. Please try again.");
        return;
      }
    } else {
      toast.error("Could not reach server. Please try again.");
      return;
    }

    liveActivityService.addActivity("daily_streak", username, `claimed Day ${newStreak} streak reward`, amountUSD);
    addNotification(
      "daily_streak",
      "🔥 Streak Reward Claimed!",
      `Day ${newStreak} streak reward: ${formatCurrency(amountUSD)} added to your Game Wallet`,
      { streakDay: newStreak, amount: amountUSD }
    );
    toast.success(`🔥 Day ${newStreak} claimed! ${formatCurrency(amountUSD)} added to Game Wallet!`);
    setShowStreakDialog(false);
  };

  const handleWithdrawClick = () => {
    setShowWithdrawalWizard(true);
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    if (amount > balances[transferFrom]) { toast.error("Insufficient balance"); return; }
    if (transferFrom === transferTo) { toast.error("Cannot transfer to the same wallet"); return; }

    setTransferStatus("processing");
    try {
      if (_WALLET_API && _walletToken()) {
        // Backend-authoritative: atomic debit + credit in one DB transaction
        await _wFetch("/api/v1/wallets/transfer", {
          method: "POST",
          body: JSON.stringify({ from: transferFrom, to: transferTo, amount }),
        });
        await refreshWalletsFromBackend().catch(() => {});
      } else {
        // Offline fallback
        transfer(transferFrom, transferTo, amount);
      }

      addTransaction({
        type: "transfer",
        amount,
        status: "completed",
        description: `Transfer: ${transferFrom.charAt(0).toUpperCase() + transferFrom.slice(1)} → ${transferTo.charAt(0).toUpperCase() + transferTo.slice(1)} Wallet`,
        metadata: { fromWallet: transferFrom, toWallet: transferTo },
      });
      addNotification("transfer", "Funds Sent",
        `${formatCurrency(amount)} transferred from ${transferFrom.charAt(0).toUpperCase() + transferFrom.slice(1)} Wallet`,
        { fromWallet: transferFrom, toWallet: transferTo, amount });
      addNotification("transfer", "Funds Received",
        `${formatCurrency(amount)} received in ${transferTo.charAt(0).toUpperCase() + transferTo.slice(1)} Wallet`,
        { fromWallet: transferFrom, toWallet: transferTo, amount });

      setTransferStatus("completed");
      setTimeout(() => {
        toast.success(`Successfully transferred ${formatCurrency(amount)}`);
        setShowTransferModal(false);
        setTransferAmount("");
        setTransferStatus("idle");
      }, 800);
    } catch (err: any) {
      setTransferStatus("idle");
      toast.error(err?.message ?? "Transfer failed. Please try again.");
    }
  };

  const getWalletName = (wallet: WalletType) => {
    const names: Record<WalletType, string> = {
      main: t("wallet.title", "Main Wallet"),
      game: t("wallet.game_wallet", "Game Wallet"),
      task: t("wallet.task_wallet", "Task Wallet"),
      referral: t("wallet.referral_wallet", "Referral Wallet"),
      affiliate: t("wallet.affiliate_wallet", "Affiliate Wallet"),
      ambassador: t("wallet.ambassador_wallet", "Ambassador Wallet"),
    };
    return names[wallet];
  };

  const getWalletIcon = (wallet: WalletType) => {
    const icons: Record<WalletType, any> = {
      main: WalletIcon,
      game: Gamepad2,
      task: ClipboardList,
      referral: Users,
      affiliate: Rocket,
      ambassador: Star,
    };
    const Icon = icons[wallet];
    return <Icon className="h-5 w-5" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; label: string }> = {
      completed: {
        className: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30",
        label: "Completed"
      },
      pending: {
        className: "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30",
        label: "Pending"
      },
      confirming: {
        className: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
        label: "Confirming"
      },
      failed: {
        className: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",
        label: "Failed"
      },
      expired: {
        className: "bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-500/30",
        label: "Expired"
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit:              "Deposit",
      withdrawal:           "Withdrawal",
      transfer:             "Transfer",
      game_win:             "Game Win",
      game_bet:             "Game Bet",
      task_reward:          "Task Reward",
      referral_bonus:       "Referral Bonus",
      vip_purchase:         "VIP Subscription",
      affiliate_commission: "Affiliate Commission",
      streak_reward:        "Daily Streak Reward",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <ResponsiveLayout>
      <div className="mb-6">
        <h2 className="text-lg md:text-2xl font-semibold mb-2">Wallet</h2>
        <p className="text-sm md:text-base text-gray-600">
          Manage your funds across different wallets
        </p>
      </div>

      {/* Main Balance Card */}
      <Card className="mb-6 relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 dark:from-blue-600/20 dark:via-blue-700/15 dark:to-indigo-800/20 border-0 dark:border dark:border-blue-500/20 text-white shadow-xl shadow-blue-500/20 dark:shadow-lg dark:shadow-blue-900/30">
        {/* Ambient lighting effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-white/12 dark:bg-blue-400/10 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-indigo-300/10 dark:bg-indigo-500/8 blur-2xl" />
        </div>

        {/* Subtle edge glow */}
        <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10 dark:ring-blue-400/20" />

        <CardHeader className="relative">
          <div className="flex items-center justify-between md:justify-center gap-3">
            <CardTitle className="text-white/90 dark:text-white/80 text-xs font-medium uppercase tracking-widest">Total Balance</CardTitle>
            <button
              onClick={() => setBalancesHidden(h => !h)}
              className="text-white/60 hover:text-white/90 transition-colors"
              aria-label={balancesHidden ? "Show balances" : "Hide balances"}
            >
              {balancesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-4xl md:text-5xl font-bold mb-6 text-left md:text-center tracking-tight text-white drop-shadow-sm">
            {balancesHidden ? <span className="tracking-widest text-white/70">••••••</span> : formatCurrency(getTotalBalanceExcludingMain())}
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="ghost"
              size="lg"
              className="w-full h-12 flex-col gap-1 bg-white/15 hover:bg-white/25 dark:bg-white/10 dark:hover:bg-white/16 text-white border border-white/25 dark:border-white/15 backdrop-blur-sm rounded-xl transition-all duration-200 shadow-sm"
              onClick={() => setActiveAction("deposit")}
            >
              <ArrowDownToLine className="h-4 w-4" />
              <span className="text-xs font-medium">Deposit</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full h-12 flex-col gap-1 bg-white/15 hover:bg-white/25 dark:bg-white/10 dark:hover:bg-white/16 text-white border border-white/25 dark:border-white/15 backdrop-blur-sm rounded-xl transition-all duration-200 shadow-sm"
              onClick={handleWithdrawClick}
            >
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="text-xs font-medium">Withdraw</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full h-12 flex-col gap-1 bg-white/15 hover:bg-white/25 dark:bg-white/10 dark:hover:bg-white/16 text-white border border-white/25 dark:border-white/15 backdrop-blur-sm rounded-xl transition-all duration-200 shadow-sm"
              onClick={() => setShowTransferModal(true)}
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Transfer</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <FeaturedPromotionCard location="wallet" />

      {/* VIP / Streak compact row */}
      {!hasVIP ? (
        <div className="mb-4">
          <PremiumVIPCard onUpgrade={() => setShowVIPDialog(true)} />
        </div>
      ) : (
        <>
          {/* Compact VIP + streak status bar */}
          <div className="flex items-center gap-2 mb-4">
            {/* VIP pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/30">
              <Crown className="h-3 w-3 text-yellow-500" />
              <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">VIP</span>
              <span className="text-xs text-yellow-600/70 dark:text-yellow-400/70">·</span>
              <span className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                {subscription?.endsAt ? `${Math.max(0, Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / 86400000))}d left` : "Active"}
              </span>
            </div>
            {/* Streak pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25">
              <Flame className="h-3 w-3 text-orange-500" />
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                Day {streakStatus.currentStreak}/7
              </span>
            </div>
            {/* Claim button — compact */}
            {streakStatus.canClaimToday && (
              <button
                onClick={() => setShowStreakDialog(true)}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold transition-all hover:opacity-90"
              >
                <Gift className="h-3 w-3" />
                Claim {formatCurrency(streakStatus.nextRewardUSD)}
              </button>
            )}
            {!streakStatus.canClaimToday && streakStatus.currentStreak > 0 && (
              <button
                onClick={() => setShowStreakDialog(true)}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-medium"
                disabled
              >
                <CheckCircle2 className="h-3 w-3" />
                Claimed
              </button>
            )}
          </div>

        </>
      )}

      {/* Wallet Types Section */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Your Wallets</h3>
        <div className="space-y-2.5">
          {/* Game Wallet */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 border-purple-200/70 dark:border-purple-500/25 bg-gradient-to-r from-purple-50/90 to-white dark:from-purple-500/[0.08] dark:to-[#0a0a0b]/40 shadow-sm dark:shadow-purple-900/10">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-purple-400/10 dark:ring-purple-400/15" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center ring-1 ring-purple-200/80 dark:ring-purple-400/30 shrink-0 shadow-sm">
                    <Gamepad2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Game Wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Used for betting only</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                    {displayAmount(balances.game)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs mt-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/15 px-2"
                    onClick={() => {
                      setTransferFrom("game");
                      setTransferTo("task");
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Wallet */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 border-emerald-200/70 dark:border-emerald-500/25 bg-gradient-to-r from-emerald-50/90 to-white dark:from-emerald-500/[0.08] dark:to-[#0a0a0b]/40 shadow-sm dark:shadow-emerald-900/10">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-emerald-400/10 dark:ring-emerald-400/15" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center ring-1 ring-emerald-200/80 dark:ring-emerald-400/30 shrink-0 shadow-sm">
                    <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Task Wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Task earnings & rewards</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {displayAmount(balances.task)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs mt-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 px-2"
                    onClick={() => {
                      setTransferFrom("task");
                      setTransferTo("game");
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referral Wallet */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 border-orange-200/70 dark:border-orange-500/25 bg-gradient-to-r from-orange-50/90 to-white dark:from-orange-500/[0.08] dark:to-[#0a0a0b]/40 shadow-sm dark:shadow-orange-900/10">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-orange-400/10 dark:ring-orange-400/15" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center ring-1 ring-orange-200/80 dark:ring-orange-400/30 shrink-0 shadow-sm">
                    <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Referral Wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Referral commissions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-300 tabular-nums">
                    {displayAmount(balances.referral)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs mt-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/15 px-2"
                    onClick={() => {
                      setTransferFrom("referral");
                      setTransferTo("game");
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Affiliate Wallet */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 border-indigo-200/70 dark:border-indigo-500/25 bg-gradient-to-r from-indigo-50/90 to-white dark:from-indigo-500/[0.08] dark:to-[#0a0a0b]/40 shadow-sm dark:shadow-indigo-900/10">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-indigo-400/10 dark:ring-indigo-400/15" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center ring-1 ring-indigo-200/80 dark:ring-indigo-400/30 shrink-0 shadow-sm">
                    <Rocket className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Affiliate Wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Affiliate earnings</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                    {displayAmount(balances.affiliate)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs mt-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 px-2"
                    onClick={() => {
                      setTransferFrom("affiliate");
                      setTransferTo("game");
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ambassador Wallet */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-200 border-yellow-200/70 dark:border-yellow-500/25 bg-gradient-to-r from-yellow-50/90 to-white dark:from-yellow-500/[0.08] dark:to-[#0a0a0b]/40 shadow-sm dark:shadow-yellow-900/10">
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-yellow-400/10 dark:ring-yellow-400/15" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center ring-1 ring-yellow-200/80 dark:ring-yellow-400/30 shrink-0 shadow-sm">
                    <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Ambassador Wallet</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ambassador commissions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300 tabular-nums">
                    {displayAmount(balances.ambassador)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs mt-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-500/15 px-2"
                    onClick={() => {
                      setTransferFrom("ambassador");
                      setTransferTo("game");
                      setShowTransferModal(true);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              {t("wallet.history", "Transaction History")}
            </CardTitle>
            {transactions.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setTxPage(1); setShowAllTransactions(true); }}
              >
                View All ({transactions.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <History className="h-8 w-8 mb-3 opacity-30" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10).map((tx) => {
                const isDebit = tx.type === "withdrawal" || tx.type === "game_bet" || tx.type === "vip_purchase";
                const isExpanded = expandedTransaction === tx.id;
                const txDate = new Date(tx.createdAt);
                return (
                  <div key={tx.id}>
                    {/* Main Row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 dark:hover:bg-white/[0.03] cursor-pointer transition-colors duration-150 select-none"
                      onClick={() => setExpandedTransaction(isExpanded ? null : tx.id)}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isDebit
                          ? "bg-red-100 dark:bg-red-500/12"
                          : "bg-emerald-100 dark:bg-emerald-500/12"
                      }`}>
                        {isDebit ? (
                          <ArrowUpFromLine className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm leading-snug">
                          {tx.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {txDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {" · "}
                          {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`font-semibold text-sm tabular-nums ${
                          isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isDebit ? "−" : "+"}{formatCurrency(tx.amount)}
                        </p>
                        <div className="flex justify-end mt-1">
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-3 bg-muted/30 dark:bg-white/[0.02] border-t border-border">
                        <div className="space-y-2">
                          {[
                            { label: "Platform Reference", value: <span className="font-mono text-xs">{tx.id}</span> },
                            { label: "Type", value: getTransactionTypeLabel(tx.type) },
                            { label: "Amount", value: <span className="font-semibold">{formatCurrency(tx.amount)}</span> },
                            { label: "Status", value: getStatusBadge(tx.status) },
                            tx.metadata?.fromWallet ? { label: "From", value: `${tx.metadata.fromWallet} Wallet` } : null,
                            tx.metadata?.toWallet ? { label: "To", value: `${tx.metadata.toWallet} Wallet` } : null,
                            tx.metadata?.gameType ? { label: "Game", value: tx.metadata.gameType.replace(/_/g, " ") } : null,
                            tx.metadata?.lobby ? { label: "Lobby", value: `Lobby ${tx.metadata.lobby}` } : null,
                            tx.metadata?.stake ? { label: "Room", value: formatCurrency(tx.metadata.stake) } : null,
                            tx.metadata?.subscriptionType ? { label: "Subscription", value: tx.metadata.subscriptionType } : null,
                            tx.metadata?.subscriptionPlan ? { label: "Plan", value: tx.metadata.subscriptionPlan } : null,
                            tx.metadata?.rewardType ? { label: "Reward Type", value: tx.metadata.rewardType.replace(/_/g, " ") } : null,
                            tx.metadata?.streakDay ? { label: "Streak Day", value: `Day ${tx.metadata.streakDay}` } : null,
                            tx.metadata?.method ? { label: "Method", value: tx.metadata.method } : null,
                            tx.metadata?.network ? { label: "Network", value: tx.metadata.network } : null,
                            tx.metadata?.bankName ? { label: "Bank", value: tx.metadata.bankName } : null,
                            tx.metadata?.txHash ? {
                              label: "Transaction Hash",
                              value: (() => {
                                const chain = (tx.metadata?.network || "bsc").toLowerCase().includes("bsc") || (tx.metadata?.network || "").toLowerCase().includes("bep") ? "bsc" : tx.metadata?.network?.toLowerCase() || "bsc";
                                const link = getExplorerLink(chain, tx.metadata.txHash);
                                return link ? (
                                  <a href={link} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline break-all">
                                    {maskTransactionHash(tx.metadata.txHash)}
                                  </a>
                                ) : <span className="font-mono">{maskTransactionHash(tx.metadata.txHash)}</span>;
                              })()
                            } : null,
                            { label: "Date & Time", value: txDate.toLocaleString() },
                          ]
                            .filter(Boolean)
                            .map((row: any, i) => (
                              <div key={i} className="flex justify-between items-start gap-4 text-xs">
                                <span className="text-muted-foreground shrink-0">{row.label}</span>
                                <span className="font-medium text-right capitalize">{row.value}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-md">
          {transferStatus === "processing" || transferStatus === "completed" ? (
            <div className="py-14 text-center">
              {transferStatus === "processing" && (
                <>
                  <div className="w-14 h-14 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-5" />
                  <h3 className="text-lg font-semibold mb-1.5">Processing Transfer</h3>
                  <p className="text-sm text-muted-foreground">Please wait a moment…</p>
                </>
              )}
              {transferStatus === "completed" && (
                <>
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1.5">Transfer Successful</h3>
                  <p className="text-sm text-muted-foreground">Your funds have been moved</p>
                </>
              )}
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  Transfer Between Wallets
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Move funds between your wallets instantly
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                {/* From Wallet */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</Label>
                  <Select value={transferFrom} onValueChange={(v) => setTransferFrom(v as WalletType)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="game">
                        <div className="flex items-center gap-2">
                          {getWalletIcon("game")}
                          <div>
                            <p className="font-medium text-sm">Game Wallet</p>
                            <p className="text-xs text-muted-foreground">{displayAmount(balances.game)} available</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="task">
                        <div className="flex items-center gap-2">
                          {getWalletIcon("task")}
                          <div>
                            <p className="font-medium text-sm">Task Wallet</p>
                            <p className="text-xs text-muted-foreground">{displayAmount(balances.task)} available</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="referral">
                        <div className="flex items-center gap-2">
                          {getWalletIcon("referral")}
                          <div>
                            <p className="font-medium text-sm">Referral Wallet</p>
                            <p className="text-xs text-muted-foreground">{displayAmount(balances.referral)} available</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="affiliate">
                        <div className="flex items-center gap-2">
                          {getWalletIcon("affiliate")}
                          <div>
                            <p className="font-medium text-sm">Affiliate Wallet</p>
                            <p className="text-xs text-muted-foreground">{displayAmount(balances.affiliate)} available</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="ambassador">
                        <div className="flex items-center gap-2">
                          {getWalletIcon("ambassador")}
                          <div>
                            <p className="font-medium text-sm">Ambassador Wallet</p>
                            <p className="text-xs text-muted-foreground">{displayAmount(balances.ambassador)} available</p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* To Wallet */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</Label>
                  <Select value={transferTo} onValueChange={(v) => setTransferTo(v as WalletType)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transferFrom !== "game" && (
                        <SelectItem value="game">
                          <div className="flex items-center gap-2">
                            {getWalletIcon("game")}
                            <span className="font-medium text-sm">Game Wallet</span>
                          </div>
                        </SelectItem>
                      )}
                      {transferFrom !== "task" && (
                        <SelectItem value="task">
                          <div className="flex items-center gap-2">
                            {getWalletIcon("task")}
                            <span className="font-medium text-sm">Task Wallet</span>
                          </div>
                        </SelectItem>
                      )}
                      {transferFrom !== "referral" && (
                        <SelectItem value="referral">
                          <div className="flex items-center gap-2">
                            {getWalletIcon("referral")}
                            <span className="font-medium text-sm">Referral Wallet</span>
                          </div>
                        </SelectItem>
                      )}
                      {transferFrom !== "affiliate" && (
                        <SelectItem value="affiliate">
                          <div className="flex items-center gap-2">
                            {getWalletIcon("affiliate")}
                            <span className="font-medium text-sm">Affiliate Wallet</span>
                          </div>
                        </SelectItem>
                      )}
                      {transferFrom !== "ambassador" && (
                        <SelectItem value="ambassador">
                          <div className="flex items-center gap-2">
                            {getWalletIcon("ambassador")}
                            <span className="font-medium text-sm">Ambassador Wallet</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="h-11 text-base tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: <span className="font-medium text-foreground">{formatCurrency(balances[transferFrom])}</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferAmount("");
                    }}
                    className="h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleTransfer}
                    className="h-11"
                    disabled={transferStatus === "processing"}
                  >
                    {transferStatus === "processing" ? "Processing…" : "Confirm Transfer"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Deposit Modal - Method Selection */}
      {activeAction === "deposit" && (
        <Dialog open={true} onOpenChange={() => setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
              <DialogDescription className="text-xs">
                Choose your preferred deposit method
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 pt-4">
              {/* Bank Deposit — gated by platform config (bankDepositsEnabled) AND geolocation */}
              {geo.loading || platformConfig === null ? (
                <div className="w-full h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ) : platformConfig?.bankDepositsEnabled && isNigerian ? (
                <Button variant="outline" className="w-full h-14 justify-start gap-3 hover:bg-muted/50 transition-colors"
                  onClick={() => { setActiveAction(null); setShowBankDepositDialog(true); }}>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Bank Transfer</p>
                    <p className="text-xs text-muted-foreground">Instant — for Nigerian accounts</p>
                  </div>
                </Button>
              ) : geo.error && !geo.countryCode ? (
                <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-xs text-gray-500 dark:text-gray-400">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-0.5">Bank Transfer</p>
                  Unable to determine your location. Please refresh or select your country manually.
                </div>
              ) : (
                <div className="w-full h-14 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-3 px-4 opacity-70">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Bank Transfer</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">Unavailable in your region</p>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full h-14 justify-start gap-3 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setActiveAction(null);
                  setShowCryptoDepositDialog(true);
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <span className="text-orange-600 dark:text-orange-400 font-bold text-lg leading-none">₮</span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">Crypto Deposit</p>
                  <p className="text-xs text-muted-foreground">USDT BEP-20 — global</p>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* VIP Subscription Dialog */}
      <Dialog open={showVIPDialog} onOpenChange={setShowVIPDialog}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] p-0 overflow-hidden gap-0
                                  rounded-[24px] border border-white/[0.07]
                                  shadow-[0_32px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.06)]">
          <DialogTitle className="sr-only">VIP Premium Subscription</DialogTitle>

          {/* ── Header ── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#1c0e00] via-[#2a1400] to-[#1c0e00]
                          px-5 pt-4 pb-4">
            {/* Ambient glow */}
            <div className="absolute -top-5 -right-5 w-28 h-28 bg-amber-500/[0.13] rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/18 to-transparent" />

            <div className="relative flex items-center justify-between gap-3">

              {/* LEFT — small crown + "VIP Premium" + "From Game Wallet" */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-amber-400 to-amber-600
                                flex items-center justify-center shrink-0
                                shadow-[0_0_14px_rgba(251,191,36,0.45)]">
                  <Crown className="h-[15px] w-[15px] text-white" strokeWidth={2} />
                </div>
                <div className="leading-none min-w-0">
                  <p className="text-[15px] font-bold text-white tracking-[-0.01em] leading-tight">VIP Premium</p>
                  <p className="text-[10px] text-white/40 mt-[3px] leading-none">From Game Wallet</p>
                </div>
              </div>

              {/* RIGHT — badge above price, stacked */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {/* Premium badge */}
                <span className="text-[8px] font-bold tracking-[0.15em] uppercase
                                 px-2 py-[3px] rounded-full leading-none
                                 bg-amber-400/[0.13] text-amber-400 border border-amber-400/20">
                  Premium
                </span>
                {/* Price — inline */}
                <div className="leading-none text-right">
                  <span className="text-[22px] font-black text-white tabular-nums tracking-tight leading-none">
                    {formatCurrency(monthlyPriceUSD)}
                  </span>
                  <span className="text-[10px] text-white/35 ml-0.5">/mo</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto bg-background" style={{ maxHeight: "calc(100svh - 290px)" }}>

            {/* ── Benefits comparison table ── */}
            <div className="px-6 pt-5 pb-1">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-3">
                Earnings &amp; Rewards
              </p>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_44px_60px_68px] items-center mb-1">
                <span />
                <span className="text-[10px] font-semibold text-muted-foreground/50 text-center uppercase tracking-wider">Free</span>
                <span className="text-[10px] font-semibold text-blue-500 text-right uppercase tracking-wider">Verified</span>
                <span className="text-[10px] font-bold text-amber-500 text-right uppercase tracking-wider">VIP</span>
              </div>

              {/* Rows */}
              {[
                { label: "Task Rewards",   free: "35%",      verified: "45%",      vip: "65%"        },
                { label: "Daily Streak",   free: "None",     verified: "None",     vip: `${formatCurrency(0.05)}–${formatCurrency(0.50)}/day` },
                { label: "Affiliate Bonus",free: "Standard", verified: "Standard", vip: "+28%"       },
                { label: "AI Predictions", free: "Basic",    verified: "Basic",    vip: "Full Access" },
              ].map((row, i, arr) => (
                <div key={row.label}
                  className={`grid grid-cols-[1fr_44px_60px_68px] items-center py-2.5
                              ${i < arr.length - 1 ? "border-b border-border/40" : ""}`}>
                  <span className="text-[13px] text-foreground/70 pr-2">{row.label}</span>
                  <span className="text-[12px] text-muted-foreground/40 text-center tabular-nums">{row.free}</span>
                  <span className="text-[12px] text-blue-500 text-right tabular-nums">{row.verified}</span>
                  <span className="text-[13px] font-semibold text-amber-500 text-right tabular-nums">{row.vip}</span>
                </div>
              ))}
            </div>

            {/* ── Withdrawal Limits ── */}
            <div className="px-6 pt-4 pb-1">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-3">
                Withdrawal Limits
              </p>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_44px_60px_68px] items-center mb-1">
                <span />
                <span className="text-[10px] font-semibold text-muted-foreground/50 text-center uppercase tracking-wider">Free</span>
                <span className="text-[10px] font-semibold text-blue-500 text-right uppercase tracking-wider">Verified</span>
                <span className="text-[10px] font-bold text-amber-500 text-right uppercase tracking-wider">VIP</span>
              </div>

              {[
                { label: "Daily Limit",      free: "$100",     verified: "$1,000",   vip: "$10,000"  },
                { label: "Monthly Limit",    free: "$1,000",   verified: "$10,000",  vip: "$100,000" },
                { label: "Processing Speed", free: "Standard", verified: "Standard", vip: "Priority" },
              ].map((row, i, arr) => (
                <div key={row.label}
                  className={`grid grid-cols-[1fr_44px_60px_68px] items-center py-2.5
                              ${i < arr.length - 1 ? "border-b border-border/40" : ""}`}>
                  <span className="text-[13px] text-foreground/70 pr-2">{row.label}</span>
                  <span className="text-[12px] text-muted-foreground/40 text-center tabular-nums">{row.free}</span>
                  <span className="text-[12px] text-blue-500 text-right tabular-nums">{row.verified}</span>
                  <span className="text-[13px] font-semibold text-amber-500 text-right tabular-nums">{row.vip}</span>
                </div>
              ))}
            </div>

            {/* ── VIP Privileges ── */}
            <div className="px-6 pt-4 pb-5">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-3">
                VIP Privileges
              </p>
              <div className="space-y-3">
                {[
                  { icon: TrendingUp, label: "2× Rewards on all earnings"         },
                  { icon: Star,       label: "Exclusive VIP bonuses"              },
                  { icon: Flame,      label: "7-day daily streak rewards"         },
                  { icon: BarChart3,  label: "Full AI football predictions"       },
                  { icon: Headphones, label: "Priority customer support"          },
                  { icon: Zap,        label: "Early access to new features"       },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/[0.1] border border-amber-500/15
                                    flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.8} />
                    </div>
                    <span className="text-[13px] text-foreground/75">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Verification notice — premium panel ── */}
            {!isVerified && (
              <div className="mx-6 mb-5 flex items-start gap-3.5
                              rounded-2xl border border-amber-500/20
                              bg-amber-500/[0.06] px-4 py-4">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 mt-px">
                  <Lock className="h-4 w-4 text-amber-500" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground mb-0.5">Verification Required</p>
                  <p className="text-[12px] text-muted-foreground leading-snug">
                    Identity verification is required before upgrading to VIP Membership.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 pt-4 pb-6 border-t border-border/50">
            {/* Expiry note + balance */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] text-muted-foreground/50 leading-snug max-w-[200px]">
                VIP access remains active until your subscription expires.
              </p>
              <span className="text-[13px] font-semibold text-foreground tabular-nums shrink-0 ml-3">
                {displayAmount(balances.game)}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl text-sm font-medium"
                onClick={() => setShowVIPDialog(false)}
              >
                Not Now
              </Button>

              {!isVerified ? (
                <Button
                  className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                             text-gray-950 font-semibold text-sm border-0
                             shadow-[0_4px_14px_rgba(251,191,36,0.3)]"
                  onClick={() => { setShowVIPDialog(false); navigate("/identity-verification"); }}
                >
                  <Lock className="mr-1.5 h-4 w-4" strokeWidth={2} />
                  Verify First
                </Button>
              ) : (
                <Button
                  className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                             text-gray-950 font-bold text-sm border-0
                             shadow-[0_4px_18px_rgba(251,191,36,0.35)]"
                  onClick={handleSubscribe}
                >
                  <Crown className="mr-1.5 h-4 w-4" strokeWidth={2} />
                  Activate VIP
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Streak Claim Dialog */}
      <Dialog open={showStreakDialog} onOpenChange={setShowStreakDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-500" />
              Daily Streak Rewards
            </DialogTitle>
            <DialogDescription>
              Claim your daily reward to maintain your streak
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 p-6 rounded-lg border-2 border-orange-200 dark:border-orange-800 text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 mb-3">
                  <Gift className="h-10 w-10 text-white" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Day {streakStatus.currentStreak + 1} Reward</div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(streakStatus.nextRewardUSD)}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>Current Streak: {streakStatus.currentStreak}/7 days</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {streakStatus.rewards.map((reward, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-semibold ${
                    reward.claimed
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : index === streakStatus.currentStreak
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {reward.claimed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                <strong>Tip:</strong> Claim your reward daily to build your streak! Miss more than 48 hours and your streak resets to Day 1. Rewards are credited to your Game Wallet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setShowStreakDialog(false)}
                className="h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleClaimStreak}
                disabled={!streakStatus.canClaimToday}
                className="h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Gift className="mr-2 h-4 w-4" />
                Claim Reward
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Professional Deposit/Withdrawal Dialogs */}
      <CryptoDepositDialog
        open={showCryptoDepositDialog}
        onClose={() => setShowCryptoDepositDialog(false)}
        userId={identity.userId}
        formatCurrency={formatCurrency}
        onDepositInitiated={(depositId: string, amount: number, uniqueAmount: number) => {
          addTransaction({
            type: "deposit",
            amount,
            status: "pending",
            description: "Crypto Deposit (USDT BEP-20)",
            metadata: {
              depositId, method: "crypto", cryptocurrency: "USDT",
              network: "BEP-20", uniqueAmount, expiresIn: "30 minutes",
            },
          });
        }}
        onDepositConfirmed={() => {
          // Backend confirmed — refresh balances and transaction history
          refreshWalletsFromBackend().catch(() => {});
        }}
      />

      <BankDepositDialog
        open={showBankDepositDialog}
        onClose={() => setShowBankDepositDialog(false)}
        userId={identity.userId}
        formatCurrency={formatCurrency}
        onDepositInitiated={(depositId: string, amountUSD: number, amountNGN: number, reference: string, bankName: string, rate: number) => {
          addTransaction({
            type: "deposit",
            amount: amountUSD,
            status: "pending",
            description: "Bank Deposit",
            metadata: {
              depositId, method: "bank", amountNGN, amountUSD,
              paymentReference: reference, exchangeRate: rate,
              expiresIn: "30 minutes", bankName,
            },
          });
        }}
        onDepositConfirmed={() => {
          refreshWalletsFromBackend().catch(() => {});
        }}
      />

      {/* Unified Withdrawal Wizard */}
      <WithdrawalWizard
        open={showWithdrawalWizard}
        onClose={() => setShowWithdrawalWizard(false)}
        userId={identity.userId}
        userBalance={getTotalBalanceExcludingMain()}
        isNigerian={isNigerian && (platformConfig?.bankWithdrawalsEnabled ?? false)}
        userTier={userTier}
        formatCurrency={formatCurrency}
        onBalanceDeduct={() => {
          // Backend deducts wallet balances when processing withdrawal —
          // refresh display from backend instead of mutating locally.
          refreshWalletsFromBackend().catch(() => {});
        }}
        onCompleted={({ withdrawalId, method, amountUSD, bankDetails, walletAddress }) => {
          const username = identity.username;
          if (method === "bank") {
            const rate = platformConfig ? (platformConfig as any).ngnToUsdRate ?? NGN_RATE : NGN_RATE;
            const amountNGN = amountUSD * rate;
            const feeNGN = 1500;
            addTransaction({
              type: "withdrawal",
              amount: amountUSD,
              status: "pending",
              description: `Bank Withdrawal to ${bankDetails?.bankName}`,
              metadata: {
                withdrawalId, method: "bank",
                bankName: bankDetails?.bankName,
                accountNumber: bankDetails?.accountNumber,
                accountName: bankDetails?.accountName,
                amountUSD, amountNGN, feeNGN,
                netAmountNGN: amountNGN - feeNGN,
                exchangeRate: rate,
                processingTime: "Usually within 1 hour",
              },
            });
          } else {
            const fee = 0.5;
            addTransaction({
              type: "withdrawal",
              amount: amountUSD,
              status: "pending",
              description: "Crypto Withdrawal (USDT BEP-20)",
              metadata: {
                withdrawalId, method: "crypto",
                cryptocurrency: "USDT", network: "BEP-20",
                walletAddress, networkFee: fee,
                netAmount: amountUSD - fee,
                processingTime: "5-30 minutes",
              },
            });
          }
          liveActivityService.addActivity("withdrawal", username, "submitted a withdrawal", amountUSD);
          // Notify in bell (limit recording happens inside WithdrawalWizard.handleConfirmPin)
          addNotification("withdrawal", "Withdrawal Initiated",
            `${formatCurrency(amountUSD)} withdrawal has been submitted and is being processed.`,
            { method, amount: amountUSD }
          );
        }}
      />

      {/* All Transactions Modal */}
      <Dialog open={showAllTransactions} onOpenChange={setShowAllTransactions}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-muted-foreground" />
                Transaction History
              </DialogTitle>
              <DialogDescription className="text-xs">
                {transactions.length} total transaction{transactions.length !== 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <History className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...transactions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE)
                  .map((tx) => {
                    const isDebit = tx.type === "withdrawal" || tx.type === "game_bet" || tx.type === "vip_purchase";
                    const isExpanded = expandedTransaction === `all-${tx.id}`;
                    const txDate = new Date(tx.createdAt);
                    return (
                      <div key={tx.id}>
                        <div
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => setExpandedTransaction(isExpanded ? null : `all-${tx.id}`)}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isDebit ? "bg-red-100 dark:bg-red-500/12" : "bg-emerald-100 dark:bg-emerald-500/12"
                          }`}>
                            {isDebit
                              ? <ArrowUpFromLine className="h-4 w-4 text-red-600 dark:text-red-400" />
                              : <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{tx.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {txDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              {" · "}
                              {txDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className={`font-semibold text-sm tabular-nums ${
                              isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                            }`}>
                              {isDebit ? "−" : "+"}{formatCurrency(tx.amount)}
                            </p>
                            <div className="flex justify-end mt-1">{getStatusBadge(tx.status)}</div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 bg-muted/30 dark:bg-white/[0.02] border-t border-border">
                            <div className="space-y-2">
                              {[
                                { label: "Platform Reference", value: <span className="font-mono text-xs">{tx.id}</span> },
                                { label: "Type", value: getTransactionTypeLabel(tx.type) },
                                { label: "Amount", value: <span className="font-semibold">{formatCurrency(tx.amount)}</span> },
                                { label: "Status", value: getStatusBadge(tx.status) },
                                tx.metadata?.method ? { label: "Method", value: tx.metadata.method } : null,
                                tx.metadata?.network ? { label: "Network", value: tx.metadata.network } : null,
                                tx.metadata?.bankName ? { label: "Bank", value: tx.metadata.bankName } : null,
                                tx.metadata?.txHash ? {
                                  label: "Tx Hash",
                                  value: (
                                    <a href={`https://bscscan.com/tx/${tx.metadata.txHash}`} target="_blank" rel="noopener noreferrer"
                                      className="font-mono text-primary hover:underline text-xs">
                                      {`${tx.metadata.txHash.slice(0, 10)}…${tx.metadata.txHash.slice(-8)}`}
                                    </a>
                                  )
                                } : null,
                                { label: "Date & Time", value: txDate.toLocaleString() },
                              ].filter(Boolean).map((row: any, i) => (
                                <div key={i} className="flex justify-between items-start gap-4 text-xs">
                                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                                  <span className="font-medium text-right capitalize">{row.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          {/* Pagination */}
          {transactions.length > TX_PAGE_SIZE && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <span>Page {txPage} of {Math.ceil(transactions.length / TX_PAGE_SIZE)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={txPage === 1}
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}>Prev</Button>
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs"
                  disabled={txPage >= Math.ceil(transactions.length / TX_PAGE_SIZE)}
                  onClick={() => setTxPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}

export default Wallet;