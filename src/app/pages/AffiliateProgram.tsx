/**
 * Affiliate Program page — fully backend-authoritative.
 *
 * All affiliate data comes from:
 *   GET /api/v1/affiliates/tree        — 3-tier downline network
 *   GET /api/v1/affiliates/stats       — commission totals by event type and tier
 *   GET /api/v1/affiliates/commissions — commission history
 *
 * Backend controls exclusively:
 *   • Affiliate network structure (3-tier MLM)
 *   • VIP verification per user
 *   • Commission eligibility (VIP-only)
 *   • Commission rates per tier and event type
 *   • Wallet settlement (creditWallet in atomic transaction)
 *   • Statistics and history
 *
 * Frontend: display-only. No wallet mutations. No local commission calculations.
 */
import { useState, useEffect, useCallback } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { FeaturedPromotionCard } from "../components/FeaturedPromotionCard";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Wallet,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  UserCheck,
  CheckCircle2,
  Network,
  Crown,
  Share2,
  Copy,
  XCircle,
  Target,
  Gamepad2,
  Loader2,
} from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { useWallet } from "../contexts/WalletContext";
import { useIdentity } from "../contexts/IdentityContext";
import { useNavigate } from "react-router";
import { getAmountTextSize } from "../utils/currencyHelpers";
import { toast } from "sonner";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

// ── Backend response types ─────────────────────────────────────────────────

interface Tier3User { userId: string; username: string; tier: 3; isVIP: boolean; isActive: boolean; }
interface Tier2User { userId: string; username: string; tier: 2; isVIP: boolean; isActive: boolean; tier3: Tier3User[]; }
interface Tier1User { userId: string; username: string; tier: 1; isVIP: boolean; isActive: boolean; tier2: Tier2User[]; }

interface AffiliateStats {
  totalCommissions: number;
  totalEarned: number;
  byEventType: Record<string, number>;
  byTier: Record<string, number>;
}

// ── Display commission rates (informational only — backend enforces actual rates) ──
const DISPLAY_RATES = {
  tier1: { vip: "28%", task: "10%", oneWin: "20%", multi: "10%" },
  tier2: { vip: "7%",  task: "3%",  oneWin: "5%",  multi: "3%"  },
  tier3: { vip: "4%",  task: "2%",  oneWin: "3%",  multi: "2%"  },
};

export default function AffiliateProgram() {
  const { formatCurrency, currency, t } = useSettings();
  const { balances, affiliateStatus, refreshWalletsFromBackend } = useWallet();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const { affiliateUrl } = usePlatform();
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);

  const walletAmountTextSize = getAmountTextSize(currency.rate, "4xl");

  // Redirect to referrals if not approved
  useEffect(() => {
    if (affiliateStatus !== "approved") navigate("/referrals");
  }, [affiliateStatus, navigate]);

  // Use the BZA-prefix affiliateCode (separate from referralCode) for affiliate links
  const affiliateCode = identity.affiliateCode || "";
  // Format: ?aff=BZA... so the backend can distinguish affiliate registrations from referral
  const affiliateLink = affiliateCode ? affiliateUrl(affiliateCode) : "";

  // ── Backend data ─────────────────────────────────────────────────────────
  const [tree, setTree] = useState<Tier1User[]>([]);
  const [stats, setStats] = useState<AffiliateStats>({
    totalCommissions: 0, totalEarned: 0, byEventType: {}, byTier: {},
  });

  const loadData = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const [treeRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/affiliates/tree`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_BASE}/api/v1/affiliates/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      if (treeRes.ok) setTree((await treeRes.json()).data ?? []);
      if (statsRes.ok) setStats((await statsRes.json()).data);
      // Sync wallet balance from backend
      refreshWalletsFromBackend().catch(() => {});
    } catch { /* network error */ }
    finally { setLoading(false); }
  }, [refreshWalletsFromBackend]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived display values (from backend data only) ──────────────────────
  const allUsers = [
    ...tree,
    ...tree.flatMap(t1 => t1.tier2),
    ...tree.flatMap(t1 => t1.tier2.flatMap(t2 => t2.tier3)),
  ];
  const totalUsers    = allUsers.length;
  const vipUserCount  = allUsers.filter(u => u.isVIP).length;
  const nonVipCount   = totalUsers - vipUserCount;

  const tier1Users    = tree;
  const tier1VIPCount = tier1Users.filter(u => u.isVIP).length;
  const tier2Users    = tree.flatMap(t => t.tier2);
  const tier2VIPCount = tier2Users.filter(u => u.isVIP).length;
  const tier3Users    = tier2Users.flatMap(t => t.tier3);
  const tier3VIPCount = tier3Users.filter(u => u.isVIP).length;

  // Earnings breakdown from backend stats (by event type)
  const vipEarnings    = stats.byEventType["vip_subscription"] ?? 0;
  const taskEarnings   = stats.byEventType["task_completion"] ?? 0;
  const gameEarnings   = (stats.byEventType["game_fee"] ?? 0) + (stats.byEventType["game_fee_multi"] ?? 0);
  const totalEarnings  = stats.totalEarned;

  const handleCopyLink = () => {
    if (!affiliateLink) { toast.error("Affiliate code not available yet"); return; }
    navigator.clipboard.writeText(affiliateLink);
    setCopiedLink(true);
    toast.success("Affiliate link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    if (!affiliateLink) { toast.error("Affiliate code not available yet"); return; }
    if (navigator.share) {
      try { await navigator.share({ title: "Join Bitzimi", text: "Start earning with Bitzimi!", url: affiliateLink }); }
      catch { handleCopyLink(); }
    } else { handleCopyLink(); }
  };

  const handleWithdraw = () => navigate("/wallet");

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t("affiliate.title","Affiliate Program")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("affiliate.subtitle","3-Tier MLM • VIP-Only Earnings")}</p>
      </div>

      <FeaturedPromotionCard location="affiliate" />

      {/* Affiliate Wallet — balance from backend via refreshWalletsFromBackend */}
      <Card className="mb-6 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-800 dark:to-slate-900 border-gray-300 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wider font-medium">{t("wallet.affiliate_wallet","Affiliate Wallet")}</p>
              </div>
              <p className={walletAmountTextSize}>{formatCurrency(balances.affiliate)}</p>
              <p className="text-xs text-gray-500">From {vipUserCount} VIP users • {totalUsers} total</p>
            </div>
            <Button onClick={handleWithdraw} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={balances.affiliate === 0}>
              <ArrowUpRight className="h-4 w-4 mr-2" />{t("wallet.withdraw","Withdraw")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* VIP-Only Notice */}
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">VIP-Only Commission</p>
            <p className="text-xs text-blue-800 dark:text-blue-200/80">
              Only VIP users generate commissions. Non-VIP users earn $0 until they upgrade. Backend enforces this rule.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Structure — display rates (backend enforces actual rates) */}
      <Card className="mb-6 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">3-Tier Structure</h3>
          </div>
          <div className="space-y-3">
            {([
              { tier: 1, label: "Tier 1 - Direct Referrals", sub: "People YOU refer", vipCount: tier1VIPCount, color: "blue", rates: DISPLAY_RATES.tier1 },
              { tier: 2, label: "Tier 2 - Sub-Referrals",    sub: "People THEY refer",         vipCount: tier2VIPCount, color: "purple", rates: DISPLAY_RATES.tier2 },
              { tier: 3, label: "Tier 3 - Sub-Sub-Referrals", sub: "People THOSE people refer", vipCount: tier3VIPCount, color: "amber",  rates: DISPLAY_RATES.tier3 },
            ] as const).map(({ tier, label, sub, vipCount, color, rates }) => (
              <div key={tier} className={`p-3 bg-${color}-500/10 border border-${color}-500/20 rounded-lg`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className={`text-sm font-semibold text-${color}-700 dark:text-${color}-300`}>{label}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{sub}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{vipCount}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-500">VIP</p>
                  </div>
                </div>
                <div className={`grid grid-cols-4 gap-2 pt-2 border-t border-${color}-500/10`}>
                  {[["VIP", rates.vip], ["Tasks", rates.task], ["1-Win", rates.oneWin], ["Multi", rates.multi]].map(([label, rate]) => (
                    <div key={label} className="text-center">
                      <p className={`text-xs text-${color}-700 dark:text-${color}-300 font-semibold`}>{rate}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats — from backend */}
      {loading ? (
        <div className="flex items-center justify-center py-8 mb-6"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{vipUserCount}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">VIP Users</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{nonVipCount}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Non-VIP (No Earnings)</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50 col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatCurrency(totalEarnings)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Earnings (VIP Only)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Earnings breakdown — from backend byEventType */}
      <Card className="mb-6 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Earnings Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">VIP Activations</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">T1: 28% • T2: 7% • T3: 4%</p>
                </div>
              </div>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(vipEarnings)}</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">Task Commissions</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">T1: 10% • T2: 3% • T3: 2%</p>
                </div>
              </div>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(taskEarnings)}</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Gamepad2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">Game Commissions</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">1-Win: 20%/5%/3% • Multi: 10%/3%/2%</p>
                </div>
              </div>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{formatCurrency(gameEarnings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affiliate link */}
      <Card className="mb-6 bg-gray-100 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Your Affiliate Link</p>
          </div>
          <div className="bg-gray-200 dark:bg-slate-900/50 border border-gray-300 dark:border-slate-700/50 rounded-lg p-3 mb-4">
            <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center">
              {affiliateLink || "Loading affiliate code..."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleCopyLink} variant="outline" className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">
              {copiedLink ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copiedLink ? "Copied!" : "Copy"}
            </Button>
            <Button onClick={handleShare} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Share2 className="h-4 w-4 mr-2" />Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network tree — from backend */}
      <Card className="bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Referral Network</p>
            <Badge variant="outline" className="ml-auto border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-400 text-xs">
              {totalUsers}
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
          ) : allUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No referrals in your network yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allUsers.map((user) => {
                const tierColor = user.tier === 1 ? "blue" : user.tier === 2 ? "purple" : "amber";
                return (
                  <div key={user.userId} className="p-3 bg-gray-100 dark:bg-slate-900/30 border border-gray-200 dark:border-slate-700/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full border flex items-center justify-center bg-${tierColor}-500/10 border-${tierColor}-500/30`}>
                          <span className="text-gray-900 dark:text-white font-semibold text-xs">
                            {(user.username || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`text-xs px-1.5 py-0 bg-${tierColor}-500/10 border-${tierColor}-500/20 text-${tierColor}-400`}>
                              Tier {user.tier}
                            </Badge>
                            {user.isVIP && (
                              <Badge className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs px-1.5 py-0">
                                <Crown className="h-2.5 w-2.5 mr-1" />VIP
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {user.isVIP ? (
                          <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Earning</p>
                        ) : (
                          <p className="text-xs text-gray-500">Pending VIP</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </ResponsiveLayout>
  );
}
