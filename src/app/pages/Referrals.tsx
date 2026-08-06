/**
 * Referral Program page — fully backend-authoritative.
 *
 * All referral data (list, stats, earnings) comes from:
 *   GET /api/v1/referrals       — tier-1 referral list
 *   GET /api/v1/referrals/stats — totals, active count, earned amount
 *
 * Backend controls:
 *   • Referral ownership and tracking
 *   • VIP verification for activation
 *   • Reward calculation ($0.50 per active referral)
 *   • Wallet settlement (creditWallet in atomic transaction)
 *   • Statistics
 *
 * Frontend: display-only. No wallet mutations. No local calculations.
 */
import { useState, useEffect, useCallback } from "react";
import { useIdentity } from "../contexts/IdentityContext";
import { usePlatform } from "../contexts/PlatformContext";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { FeaturedPromotionCard } from "../components/FeaturedPromotionCard";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Users,
  Copy,
  Share2,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  DollarSign,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useNavigate } from "react-router";
import { AffiliateApplicationModal } from "../components/AffiliateApplicationModal";
import { getAmountTextSize } from "../utils/currencyHelpers";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

interface BackendReferral {
  id:          string;
  referredId:  string;
  username:    string;
  isVIP:       boolean;
  isActive:    boolean;
  activatedAt: string | null;
  joinedAt:    string;
}

interface BackendReferralStats {
  totalReferrals:   number;
  activeReferrals:  number;
  pendingReferrals: number;
  totalEarned:      number;
  bonusPerReferral: number;
}

export default function Referrals() {
  const { formatCurrency, currency, t } = useSettings();
  const { balances, affiliateStatus, setAffiliateStatus, setAffiliateApplication } = useWallet();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const { referralUrl } = usePlatform();
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Referral data from backend
  const [referrals, setReferrals] = useState<BackendReferral[]>([]);
  const [stats, setStats] = useState<BackendReferralStats>({
    totalReferrals: 0, activeReferrals: 0, pendingReferrals: 0, totalEarned: 0, bonusPerReferral: 0.50,
  });

  const walletAmountTextSize = getAmountTextSize(currency.rate, "4xl");

  // Referral link — uses the user's unique referral code
  const referralCode = identity.referralCode || "";
  // Format: ?ref=BZR... so the backend can distinguish referral registrations from affiliate
  const referralLink = referralCode ? referralUrl(referralCode) : "";

  // Redirect to affiliate page if approved
  useEffect(() => {
    if (affiliateStatus === "approved") navigate("/affiliate-program");
  }, [affiliateStatus, navigate]);

  // Load referral data from backend
  const loadReferrals = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/referrals`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/v1/referrals/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (listRes.ok) {
        const json = await listRes.json();
        setReferrals(json.data ?? []);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data);
      }
    } catch { /* network error — keep showing cached state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  const copyReferralLink = () => {
    if (!referralLink) { toast.error("Referral code not available yet"); return; }
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  const shareReferralLink = async () => {
    if (!referralLink) { toast.error("Referral code not available yet"); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Join Bitzimi", text: "Start earning with Bitzimi! Use my referral link:", url: referralLink }); }
      catch { copyReferralLink(); }
    } else { copyReferralLink(); }
  };

  const handleWithdraw = () => navigate("/wallet");

  const handleJoinAffiliate = () => {
    if (affiliateStatus === "not_applied" || affiliateStatus === "rejected") setShowApplicationModal(true);
    else if (affiliateStatus === "pending") toast.info("Your application is under review. We will notify you within 24–48 hours.");
  };

  const handleApplicationSubmit = async (data: any) => {
    const apiBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
    const token = localStorage.getItem("bitzimi_access_token");
    if (!apiBase || !token) {
      toast.error("Could not reach server. Please try again.");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/v1/affiliates/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message ?? "Failed to submit application");
        return;
      }
      const json = await res.json();
      setAffiliateApplication(json.data);
      setAffiliateStatus("pending");
      setShowApplicationModal(false);
      toast.success("Application submitted! We'll review it within 24 hours.");
    } catch {
      toast.error("Could not reach server. Please try again.");
    }
  };

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t("referrals.title","Referral Program")}</h1>
          <p className="text-sm text-gray-400">
            Earn {formatCurrency(stats.bonusPerReferral)} per referral (reward unlocks when they purchase their first VIP membership)
          </p>
        </div>
        <Button
          onClick={handleJoinAffiliate}
          size="sm"
          className="h-8 px-3 text-xs bg-gradient-to-r from-purple-600/90 to-blue-600/90 hover:from-purple-600 hover:to-blue-600 text-white border-0 shadow-md flex-shrink-0 rounded-full"
          disabled={affiliateStatus === "pending"}
        >
          <ArrowUpRight className="h-3 w-3 mr-1" />
          {affiliateStatus === "pending" ? "Pending..." : affiliateStatus === "rejected" ? "Re-apply" : "Join Affiliate"}
        </Button>
      </div>

      {/* Referral Wallet Card — balance from backend via refreshWalletsFromBackend() */}
      <FeaturedPromotionCard location="referral" />

      <Card className="mb-6 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-800 dark:to-slate-900 border-gray-300 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{t("wallet.referral_wallet","Referral Wallet")}</p>
              </div>
              <p className={`${walletAmountTextSize} font-bold text-gray-900 dark:text-white mb-1`}>
                {formatCurrency(balances.referral)}
              </p>
              <p className="text-xs text-gray-500">
                Earned from {stats.activeReferrals} active referral{stats.activeReferrals !== 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={handleWithdraw} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={balances.referral === 0}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {t("wallet.withdraw","Withdraw")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid — all values from backend */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stats.totalReferrals}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t("referrals.total","Total Referrals")}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stats.activeReferrals}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t("referrals.active","Active Referrals")}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stats.pendingReferrals}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Pending Referrals</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatCurrency(stats.totalEarned)}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Share link */}
      <Card className="mb-6 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Share Your Referral Link</p>
          </div>
          <div className="bg-amber-50 dark:bg-slate-900/50 border border-amber-200 dark:border-slate-700/50 rounded-lg p-3 mb-4">
            <p className="font-mono text-xs text-gray-900 dark:text-white break-all text-center font-semibold">
              {referralLink || "Loading referral code..."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={copyReferralLink} variant="outline" className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">
              <Copy className="h-4 w-4 mr-2" />Copy
            </Button>
            <Button onClick={shareReferralLink} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Share2 className="h-4 w-4 mr-2" />Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral list — from backend */}
      <Card className="bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Your Referrals</p>
            <Badge variant="outline" className="ml-auto border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-400 text-xs">
              {stats.totalReferrals}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : referrals.length > 0 ? (
            <div className="space-y-2">
              {referrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-gray-300 dark:border-slate-600/50 flex items-center justify-center">
                      <span className="text-gray-900 dark:text-white font-semibold text-sm">
                        {(referral.username || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{referral.username}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {referral.isActive ? (
                          <Badge className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs px-2 py-0">Active</Badge>
                        ) : (
                          <Badge className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs px-2 py-0">Pending</Badge>
                        )}
                        <span className="text-xs text-gray-600 dark:text-gray-500">
                          {new Date(referral.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {referral.isActive ? (
                      <>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">+{formatCurrency(stats.bonusPerReferral)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-500">Earned</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-400">{formatCurrency(stats.bonusPerReferral)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-500">Potential</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700/30 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-gray-600 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">No referrals yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mt-6 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">How It Works</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">1</span>
              </div>
              <div>
                <p className="text-sm text-gray-900 dark:text-white font-medium">Share your link</p>
                <p className="text-xs text-gray-700 dark:text-gray-400 mt-0.5">Invite friends to join Bitzimi</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 dark:text-orange-400 font-semibold text-xs">2</span>
              </div>
              <div>
                <p className="text-sm text-gray-900 dark:text-white font-medium">They sign up (Pending)</p>
                <p className="text-xs text-gray-700 dark:text-gray-400 mt-0.5">
                  Pending until they purchase VIP • {formatCurrency(stats.bonusPerReferral)} potential
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-md bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-900 dark:text-white font-medium">They purchase their first VIP membership (Active)</p>
                <p className="text-xs text-gray-700 dark:text-gray-400 mt-0.5">
                  {formatCurrency(stats.bonusPerReferral)} credited to your Referral Wallet — only VIP purchases activate rewards
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AffiliateApplicationModal
        open={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        onSubmit={handleApplicationSubmit}
      />
    </ResponsiveLayout>
  );
}
