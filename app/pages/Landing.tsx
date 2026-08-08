import { useState, useEffect, useRef } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import { useSettings } from "../contexts/SettingsContext";

const _LND_API = (import.meta as any).env?.VITE_API_URL as string | undefined;

const _WIN_COLORS = [
  "from-blue-500 to-cyan-500", "from-red-500 to-orange-500",
  "from-purple-500 to-pink-500", "from-green-500 to-emerald-500",
  "from-yellow-500 to-amber-500",
];

function _timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
import { TASK_CATEGORIES } from "../constants/taskCategories";
import { useNavigate } from "react-router";
import {
  Wallet,
  Gamepad2,
  Zap,
  Users,
  Crown,
  Shield,
  Globe,
  Bell,
  TrendingUp,
  Lock,
  Check,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Target,
  Trophy,
  Coins,
  Sparkles,
  CircleDollarSign,
  ChevronRight,
  Activity,
  BarChart3,
  UserCheck,
  FileCheck,
  ShieldCheck,
  Smartphone,
  Award,
  DollarSign,
  Timer,
  Eye,
  Radio,
  Flame,
  Fingerprint,
  ServerCrash,
  Wifi,
} from "lucide-react";
import { motion } from "motion/react";
import logo from "../../imports/1000109381-1.png";
import ssWallet from "../../imports/1000109535.jpg";
import ssDice from "../../imports/1000109545.jpg";
import ssSpin from "../../imports/1000109542.jpg";
import ssColor from "../../imports/1000109540.jpg";
import ssAffiliate from "../../imports/1000109523.jpg";
import ssTasks from "../../imports/1000109531.jpg";

export function Landing() {
  const navigate = useNavigate();
  const { branding } = usePlatform();
  const { t } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled,        setScrolled]       = useState(false);
  const [livePlayerCount, setLivePlayerCount] = useState(0);
  const [activeBattles,   setActiveBattles]   = useState(0);
  const [recentWinners,   setRecentWinners]   = useState<
    Array<{ name: string; amount: string; game: string; time: string; color: string }>
  >([]);

  // Live ticker activities — from backend
  const [tickerActivities, setTickerActivities] = useState<
    Array<{ type: string; icon: string; label: string; username: string; amount: number; timestamp: string }>
  >([]);

  // Marketplace stats — from backend
  const [marketStats, setMarketStats] = useState<{
    activeCampaigns: number; tasksAvailable: number;
    completedToday: number; rewardsPaidUSD: number;
  } | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load all public backend data
  useEffect(() => {
    if (!_LND_API) return;

    const loadStats = async () => {
      try {
        const res = await fetch(`${_LND_API}/api/v1/public/stats`);
        if (!res.ok) return;
        const json = await res.json();
        const { totalUsers, activeBattles: ab, recentWins } = json.data ?? {};
        if (typeof totalUsers === "number") setLivePlayerCount(totalUsers);
        if (typeof ab        === "number") setActiveBattles(ab);
        if (Array.isArray(recentWins) && recentWins.length > 0) {
          setRecentWinners(recentWins.map((w: any, i: number) => ({
            name:   w.username ?? "Player",
            amount: `$${Number(w.amount ?? 0).toFixed(2)}`,
            game:   w.gameLabel ?? w.gameType ?? "Game",
            time:   _timeAgo(w.timestamp),
            color:  _WIN_COLORS[i % _WIN_COLORS.length],
          })));
        }
      } catch {}
    };

    const loadActivity = async () => {
      try {
        const res = await fetch(`${_LND_API}/api/v1/public/activity`);
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.data?.activities)) setTickerActivities(json.data.activities);
      } catch {}
    };

    const loadMarketplace = async () => {
      try {
        const res = await fetch(`${_LND_API}/api/v1/public/marketplace`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) setMarketStats(json.data);
      } catch {}
    };

    loadStats();
    loadActivity();
    loadMarketplace();

    const id1 = setInterval(loadStats, 60_000);
    const id2 = setInterval(loadActivity, 30_000);   // ticker refreshes every 30s
    const id3 = setInterval(loadMarketplace, 60_000);
    return () => { clearInterval(id1); clearInterval(id2); clearInterval(id3); };
  }, []);

  const features = [
    { icon: Wallet,     title: t("landing.feature.wallet.title",    "Secure Multi-Wallet System"),   description: t("landing.feature.wallet.desc",    "Four specialized wallets (Main, Game, Task, Referral) with real-time balance tracking"), gradient: "from-blue-500 to-cyan-500" },
    { icon: Gamepad2,   title: t("landing.feature.games.title",     "5 Competitive Games"),           description: t("landing.feature.games.desc",     "Color Prediction, Coin Flip, Dice Duel, Reaction Tap, and Spin Battle"), gradient: "from-purple-500 to-pink-500" },
    { icon: Zap,        title: t("landing.feature.payments.title",  "Lightning Fast Payments"),       description: t("landing.feature.payments.desc",  "Instant USDT BEP-20 withdrawals and direct bank transfers for Nigerian users"), gradient: "from-orange-500 to-red-500" },
    { icon: Users,      title: t("landing.feature.affiliate.title", "Affiliate Rewards System"),      description: t("landing.feature.affiliate.desc", "3-tier referral program with commission from platform fees on VIP winners"), gradient: "from-green-500 to-emerald-500" },
    { icon: Crown,      title: t("landing.feature.vip.title",       "VIP Membership Benefits"),       description: t("landing.feature.vip.desc",       "Up to 65% task rewards, priority support, and exclusive features"), gradient: "from-yellow-500 to-amber-500" },
    { icon: Shield,     title: t("landing.feature.kyc.title",       "KYC Verification"),              description: t("landing.feature.kyc.desc",       "Advanced identity verification with face matching for secure compliance"), gradient: "from-indigo-500 to-blue-500" },
    { icon: Globe,      title: t("landing.feature.currencies.title","10 Display Currencies"),         description: t("landing.feature.currencies.desc","View your USD balance in NGN, EUR, GBP, CNY, INR, ZAR, KES, RUB, TRY"), gradient: "from-teal-500 to-cyan-500" },
    { icon: Bell,       title: t("landing.feature.notifs.title",    "Real-Time Notifications"),       description: t("landing.feature.notifs.desc",    "Live alerts for games, wins, transactions, and affiliate earnings"), gradient: "from-rose-500 to-pink-500" },
    { icon: TrendingUp, title: t("landing.feature.tasks.title",     "Task Marketplace"),              description: t("landing.feature.tasks.desc",     "Complete tasks and earn: Free 35%, Verified 45%, VIP 65% rewards"), gradient: "from-violet-500 to-purple-500" },
    { icon: Lock,       title: t("landing.feature.security.title",  "Blockchain Security"),           description: t("landing.feature.security.desc",  "Bank-grade encryption with transparent on-chain verification"), gradient: "from-slate-400 to-slate-500" },
  ];

  const steps = [
    { step: "1", title: t("landing.step1.title", "Create Account"),  description: t("landing.step1.desc", "Sign up in seconds with email or referral code") },
    { step: "2", title: t("landing.step2.title", "Verify Identity"), description: t("landing.step2.desc", "Complete KYC verification for enhanced limits") },
    { step: "3", title: t("landing.step3.title", "Fund Wallet"),     description: t("landing.step3.desc", "Deposit via crypto (USDT BEP-20) or bank transfer") },
    { step: "4", title: t("landing.step4.title", "Join Games"),      description: t("landing.step4.desc", "Choose from 5 competitive PvP games") },
    { step: "5", title: t("landing.step5.title", "Earn Rewards"),    description: t("landing.step5.desc", "Win games, complete tasks, and earn affiliate commissions") },
    { step: "6", title: t("landing.step6.title", "Withdraw Funds"),  description: t("landing.step6.desc", "Cash out anytime with fast processing") },
  ];

  const currencies = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$", note: "Base" },
    { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€", note: "Display" },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£", note: "Display" },
    { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦", note: "Display" },
    { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", symbol: "¥", note: "Display" },
    { code: "INR", name: "Indian Rupee", flag: "🇮🇳", symbol: "₹", note: "Display" },
    { code: "ZAR", name: "South African Rand", flag: "🇿🇦", symbol: "R", note: "Display" },
    { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh", note: "Display" },
    { code: "RUB", name: "Russian Ruble", flag: "🇷🇺", symbol: "₽", note: "Display" },
    { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", symbol: "₺", note: "Display" },
  ];

  const vipBenefits = [
    { icon: Award,       text: t("landing.vip.benefit1", "Up to 65% task completion rewards") },
    { icon: Users,       text: t("landing.vip.benefit2", "3-Tier Affiliate Rewards System") },
    { icon: Zap,         text: t("landing.vip.benefit3", "Priority 24/7 customer support") },
    { icon: Crown,       text: t("landing.vip.benefit4", "Exclusive game rooms and tournaments") },
    { icon: DollarSign,  text: t("landing.vip.benefit5", "Higher withdrawal limits") },
    { icon: Sparkles,    text: t("landing.vip.benefit6", "Early access to new features") },
  ];

  const complianceFeatures = [
    { icon: UserCheck,       title: t("landing.compliance.age.title",      "18+ Only"),               description: t("landing.compliance.age.desc",      "Strict age verification required for all users"), color: "from-blue-500 to-blue-600" },
    { icon: FileCheck,       title: t("landing.compliance.kyc.title",      "KYC Compliance"),         description: t("landing.compliance.kyc.desc",      "Advanced identity verification with face matching"), color: "from-indigo-500 to-indigo-600" },
    { icon: ShieldCheck,     title: t("landing.compliance.aml.title",      "AML Protection"),         description: t("landing.compliance.aml.desc",      "Anti-money laundering monitoring and compliance"), color: "from-violet-500 to-violet-600" },
    { icon: Fingerprint,     title: t("landing.compliance.encrypt.title",  "Secure Encryption"),      description: t("landing.compliance.encrypt.desc",  "256-bit AES bank-grade wallet encryption"), color: "from-purple-500 to-purple-600" },
    { icon: Shield,          title: t("landing.compliance.gaming.title",   "Responsible Gaming"),     description: t("landing.compliance.gaming.desc",   "Fair play policies and player protection standards"), color: "from-cyan-500 to-cyan-600" },
    { icon: CircleDollarSign,title: t("landing.compliance.txn.title",      "Protected Transactions"), description: t("landing.compliance.txn.desc",      "Blockchain-verified and immutably secured payments"), color: "from-teal-500 to-teal-600" },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white" style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#07070f]/96 backdrop-blur-xl border-b border-white/[0.06]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <img src={branding.logoUrl || logo} alt={branding.name} className="h-7 md:h-9 w-auto" />
            <div className="hidden md:flex items-center space-x-1">
              {["#features", "#games", "#how-it-works"].map((href, i) => (
                <a key={i} href={href} className="text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium">
                  {[t("landing.nav.features","Features"), t("landing.nav.games","Games"), t("landing.nav.how_it_works","How It Works")][i]}
                </a>
              ))}
              <button onClick={() => navigate("/login")} className="text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium">{t("landing.cta.login","Sign In")}</button>
              <button onClick={() => navigate("/register")} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-violet-500/20 text-sm ml-1">
                {t("landing.cta.signup","Get Started Free")}
              </button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#07070f]/98 backdrop-blur-xl border-t border-white/[0.06]">
            <div className="px-4 py-3 space-y-1">
              {[
                [t("landing.nav.features","Features"), "#features"],
                [t("landing.nav.games","Games"), "#games"],
                [t("landing.nav.how_it_works","How It Works"), "#how-it-works"],
              ].map(([label, href], i) => (
                <a key={i} href={href}
                  className="block text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium"
                  onClick={() => setMobileMenuOpen(false)}>{label}</a>
              ))}
              <button onClick={() => navigate("/login")} className="w-full text-left text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-colors font-medium">{t("landing.cta.login","Sign In")}</button>
              <button onClick={() => navigate("/register")} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2.5 rounded-lg font-semibold">{t("landing.cta.signup","Get Started Free")}</button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ── Live Ticker — backend-driven activity feed ── */}
      <div className="fixed top-14 md:top-16 left-0 right-0 z-40 bg-[#0a0a15]/95 backdrop-blur-md border-b border-white/[0.05] py-1.5 overflow-hidden">
        {tickerActivities.length === 0 ? (
          /* Empty state while backend loads */
          <div className="flex items-center justify-center space-x-3 text-xs py-0.5">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /><span className="text-green-400 font-semibold">LIVE</span></span>
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300 font-medium">{livePlayerCount > 0 ? `${livePlayerCount.toLocaleString()} users` : "Platform"} · {activeBattles > 0 ? `${activeBattles} active battles` : "Loading activity…"}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-8 animate-scroll whitespace-nowrap">
            {/* Static platform counters */}
            <div className="flex items-center space-x-2 text-xs shrink-0">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /><span className="text-green-400 font-semibold">LIVE</span></span>
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-300 font-medium">{livePlayerCount.toLocaleString()} users</span>
            </div>
            {activeBattles > 0 && (
              <div className="flex items-center space-x-2 text-xs shrink-0">
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300"><span className="text-blue-400 font-semibold">{activeBattles}</span> active battles</span>
              </div>
            )}
            {/* Real platform activity events from backend */}
            {[...tickerActivities, ...tickerActivities].map((act, i) => (
              <div key={i} className="flex items-center space-x-2 text-xs shrink-0">
                <span className="text-base leading-none">{act.icon}</span>
                <span className="text-slate-400">
                  <span className="text-slate-300 font-medium">{act.username}</span>
                  {" "}{act.label}
                  {act.amount > 0 && <span className="text-green-400 font-semibold"> · ${act.amount.toFixed(2)}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Hero Section ── */}
      <section className="relative pt-[6.5rem] md:pt-[8rem] pb-12 md:pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-700/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center">

            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 mb-5 md:mb-7 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs md:text-sm text-violet-300 font-medium tracking-wide">{t("landing.hero.badge","Next-Gen Fintech Gaming Platform")}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-black mb-4 md:mb-6 leading-[1.05] tracking-tight">
              <span className="text-white">{t("landing.hero.title_1","Play, Earn & Compete")}</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">{t("landing.hero.title_2","in Real Time")}</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 mb-7 md:mb-10 max-w-2xl mx-auto leading-relaxed font-normal">
              {t("landing.hero.subtitle","Experience real-time competitive gaming with integrated fintech rewards. Play skill-based games, complete tasks, earn affiliate commissions, and manage everything from one powerful ecosystem.")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-10 md:mb-14">
              <button onClick={() => navigate("/register")}
                className="group bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-7 md:px-9 py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base transition-all duration-200 shadow-[0_8px_30px_rgba(124,58,237,0.35)] hover:shadow-[0_8px_40px_rgba(124,58,237,0.5)] hover:scale-[1.02] flex items-center gap-2">
                {t("landing.hero.cta_primary","Start Earning Now")}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={() => navigate("/login")}
                className="bg-white/[0.06] hover:bg-white/[0.1] text-white px-7 md:px-9 py-3 md:py-3.5 rounded-xl font-semibold text-sm md:text-base transition-all duration-200 border border-white/[0.08] hover:border-white/[0.15]">
                {t("landing.cta.login","Sign In")}
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
              {[
                { val: "5",    label: t("landing.stats.games",      "Core Games"),        color: "text-violet-400", icon: Gamepad2 },
                { val: "65%",  label: t("landing.stats.vip_rewards","VIP Task Rewards"),  color: "text-green-400",  icon: Trophy },
                { val: "10",   label: t("landing.stats.currencies", "Display Currencies"),color: "text-blue-400",   icon: Globe },
                { val: "24/7", label: t("landing.stats.support",    "Support"),           color: "text-orange-400", icon: Shield },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 md:p-5 backdrop-blur-sm hover:bg-white/[0.05] transition-all hover:border-white/[0.1] group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
                  <s.icon className={`w-4 h-4 ${s.color} mb-2 opacity-60 group-hover:opacity-100 transition-opacity`} />
                  <div className={`text-2xl md:text-3xl font-black ${s.color} mb-1 tracking-tight`}>{s.val}</div>
                  <div className="text-slate-500 text-xs md:text-sm font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Recent Winners Strip ── */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-y border-white/[0.04] bg-white/[0.015] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/[0.02] via-transparent to-green-500/[0.02]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Live Wins</span>
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">Real-time</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-green-400" />{livePlayerCount.toLocaleString()} online</span>
              <span className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-blue-400" />{activeBattles} battles</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentWinners.map((w, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${w.color} flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform relative z-10`}>
                  {w.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="text-xs text-slate-400 truncate">{w.name} · <span className="text-slate-500">{w.game}</span></div>
                  <div className="text-base font-black text-green-400 leading-tight">{w.amount}</div>
                </div>
                <div className="text-xs text-slate-600 flex-shrink-0 relative z-10">{w.time}</div>
                <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0 relative z-10" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">{t("landing.sections.features","Platform Features")}</h2>
            <p className="text-slate-400 max-w-xl mx-auto font-normal text-base">{t("landing.sections.features_sub","Everything you need to earn, compete, and grow")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] hover:bg-[#0f0f1e] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform duration-300 relative z-10`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold mb-1.5 text-white relative z-10">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed relative z-10">{f.description}</p>
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <CheckCircle2 className="w-3 h-3 text-green-500/70" />
                    <span>Active</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Games Section ── */}
      <section id="games" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-5">
              <Gamepad2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-violet-300 font-medium">Real-Money PvP</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">{t("landing.sections.games","5 Competitive Games")}</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-base">{t("landing.sections.games_sub","Skill-based PvP games with live rooms and instant payouts")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Color Prediction */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:scale-[1.02]">
              <div className="relative h-28 bg-[#0a0a14]">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-red-500/15 flex flex-col items-center justify-center border-r border-white/[0.04]">
                    <span className="text-red-400 font-black text-xs tracking-wider">RED</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">17 players</span>
                    <span className="text-xs text-red-300 font-bold mt-0.5">$174.25</span>
                  </div>
                  <div className="flex-1 bg-blue-500/15 flex flex-col items-center justify-center">
                    <span className="text-blue-400 font-black text-xs tracking-wider">BLUE</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">23 players</span>
                    <span className="text-xs text-blue-300 font-bold mt-0.5">$262.88</span>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-[#0d0d1a] border border-white/[0.1] flex items-center justify-center text-xs font-mono font-bold text-white shadow-xl">00:47</div>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[10px] text-red-300 font-semibold">LIVE</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-black text-white">Color Prediction</h3>
                  <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2 py-0.5 text-slate-400">40 players</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Predict RED or BLUE, watch the pool grow, and win the round. Fast-paced and thrilling.</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Pool</span>
                  <span className="text-green-400 font-bold">$437.13</span>
                </div>
              </div>
            </motion.div>

            {/* Coin Flip */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 }}
              className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:scale-[1.02]">
              <div className="relative h-28 bg-[#0a0a14] flex items-center justify-center">
                <div className="flex items-center gap-5">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center justify-center text-xl font-black text-white">H</div>
                    <span className="text-[10px] text-slate-500 font-medium tracking-wider">HEADS</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-slate-600 font-black text-sm">VS</span>
                    <div className="w-px h-6 bg-white/[0.05] mt-1" />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_0_20px_rgba(100,116,139,0.3)] flex items-center justify-center text-xl font-black text-white">T</div>
                    <span className="text-[10px] text-slate-500 font-medium tracking-wider">TAILS</span>
                  </div>
                </div>
                <div className="absolute top-2 left-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 font-semibold">50/50</div>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/30 rounded-full px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-300 font-semibold">LIVE</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-black text-white">Coin Flip</h3>
                  <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2 py-0.5 text-slate-400">1v1 Instant</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Classic heads or tails PvP duels. Matched instantly, winner takes the pot minus platform fee.</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Avg. Match</span>
                  <span className="text-green-400 font-bold">~$89 pot</span>
                </div>
              </div>
            </motion.div>

            {/* Dice Duel */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-blue-500/20 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)] hover:scale-[1.02]">
              <div className="relative h-28 bg-[#0a0a14] flex items-center justify-center gap-4">
                {/* Die 1 */}
                <div className="w-14 h-14 bg-white rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.25)] p-2 grid grid-cols-3 gap-0.5 group-hover:rotate-[-8deg] transition-transform duration-300">
                  {[1,1,1,1,1,1].map((_, i) => <div key={i} className="rounded-full bg-slate-800 w-full h-full aspect-square" />)}
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-600 font-black text-xs">VS</span>
                  <span className="text-[10px] text-green-400 font-bold mt-1">6 • 5</span>
                </div>
                {/* Die 2 */}
                <div className="w-14 h-14 bg-white rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.2)] p-2 grid grid-cols-3 gap-0.5 group-hover:rotate-[8deg] transition-transform duration-300">
                  {[true,false,false,false,false,true].map((dot, i) => (
                    <div key={i} className={`rounded-full w-full h-full aspect-square ${dot ? "bg-red-500" : "bg-transparent"}`} />
                  ))}
                </div>
                <div className="absolute top-2 right-2 text-[10px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5 font-semibold">3 Modes</div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-black text-white">Dice Duel</h3>
                  <div className="flex gap-1">
                    {["Clash", "Royale", "Arena"].map(m => (
                      <span key={m} className="text-[10px] bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/15 font-medium">{m}</span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Roll the dice in competitive 1v1, Royale, and Arena modes. Higher roll wins the pot.</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Avg. Win</span>
                  <span className="text-green-400 font-bold">~$215</span>
                </div>
              </div>
            </motion.div>

            {/* Reaction Tap */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-rose-500/20 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(244,63,94,0.15)] hover:scale-[1.02]">
              <div className="relative h-28 bg-[#0a0a14] flex items-center justify-center overflow-hidden">
                <div className="absolute w-20 h-20 rounded-full border border-rose-500/[0.12]" />
                <div className="absolute w-14 h-14 rounded-full border border-rose-500/20" />
                <div className="absolute w-8 h-8 rounded-full border border-rose-500/30 group-hover:scale-150 transition-all duration-700" />
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-[0_0_24px_rgba(244,63,94,0.5)] flex items-center justify-center z-10 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="absolute bottom-2 right-3 bg-[#0d0d1a]/90 rounded-lg px-2 py-1 text-xs font-mono text-rose-300 border border-rose-500/15">0.847s</div>
                <div className="absolute top-2 left-2 text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5 font-semibold">REFLEXES</div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-black text-white">Reaction Tap</h3>
                  <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2 py-0.5 text-slate-400">Speed</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Pure reflex PvP. A signal fires — first to tap wins the pot. Milliseconds decide fortunes.</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Avg. Win</span>
                  <span className="text-green-400 font-bold">~$156</span>
                </div>
              </div>
            </motion.div>

            {/* Spin Battle */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-purple-500/20 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(168,85,247,0.15)] hover:scale-[1.02]">
              <div className="relative h-28 bg-[#0a0a14] flex items-center justify-center">
                <div className="relative w-20 h-20 group-hover:rotate-[30deg] transition-transform duration-700">
                  <div className="w-full h-full rounded-full shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                    style={{ background: "conic-gradient(#7c3aed 0deg 130deg, #ef4444 130deg 200deg, #3b82f6 200deg 290deg, #22c55e 290deg 325deg, #f59e0b 325deg 360deg)" }} />
                  <div className="absolute inset-[6px] rounded-full bg-[#0a0a14] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                    <div className="w-0 h-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "10px solid white" }} />
                  </div>
                </div>
                <div className="absolute bottom-2 left-3 text-[10px] text-slate-400">
                  6 players · <span className="text-purple-300 font-semibold">$47 pool</span>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 rounded-full px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                  <span className="text-[10px] text-purple-300 font-semibold">LIVE</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-base font-black text-white">Spin Battle</h3>
                  <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded-full px-2 py-0.5 text-slate-400">Multiplayer</span>
                </div>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">Pick your animal, bet your stake, and spin the wheel. Larger bet = bigger wheel slice = higher chance.</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Winner Gets</span>
                  <span className="text-green-400 font-bold">~$42</span>
                </div>
              </div>
            </motion.div>

            {/* CTA card */}
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }}
              className="bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-pink-600/20 border border-violet-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.2)] transition-all duration-300 min-h-[200px]">
              <Trophy className="w-10 h-10 text-yellow-400 mb-3" />
              <h3 className="text-lg font-black text-white mb-2">Ready to Compete?</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">Join thousands of players earning real money daily across all game modes.</p>
              <button onClick={() => navigate("/register")}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                Play Now <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── App Showcase (Screenshot Mockups) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 mb-5">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300 font-medium">Live Platform Preview</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight">See It in Action</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Real screenshots from the live {branding.name} platform — wallet, games, and affiliate dashboard</p>
          </div>

          {/* Three phone mockups */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4 lg:gap-8">

            {/* Phone 1 — Wallet */}
            <motion.div initial={{ opacity: 0, y: 30, rotate: -3 }} whileInView={{ opacity: 1, y: 0, rotate: -3 }} viewport={{ once: true }}
              className="relative w-[200px] sm:w-[220px] flex-shrink-0 md:mt-8">
              <div className="rounded-[2.5rem] bg-gradient-to-b from-slate-700 to-slate-800 p-[3px] shadow-[0_40px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="relative rounded-[2.3rem] overflow-hidden bg-slate-900">
                  <div className="absolute top-0 left-0 right-0 h-5 bg-slate-900 z-10 flex items-center justify-center">
                    <div className="w-16 h-3 bg-slate-800 rounded-full" />
                  </div>
                  <img src={ssWallet} alt={`${branding.name} Wallet`} className="w-full object-cover object-top" style={{ aspectRatio: "9/19.5" }} />
                  <div className="absolute bottom-0 left-0 right-0 h-5 bg-slate-900 flex items-center justify-center">
                    <div className="w-16 h-1 bg-white/20 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-slate-500 font-medium">Wallet Dashboard</span>
              </div>
            </motion.div>

            {/* Phone 2 — Dice Duel (center, elevated) */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="relative w-[220px] sm:w-[240px] flex-shrink-0 z-10">
              <div className="rounded-[2.5rem] bg-gradient-to-b from-violet-700/60 to-slate-800 p-[3px] shadow-[0_50px_100px_rgba(0,0,0,0.7),0_0_0_1px_rgba(139,92,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]">
                <div className="relative rounded-[2.3rem] overflow-hidden bg-slate-900">
                  <div className="absolute top-0 left-0 right-0 h-5 bg-slate-900 z-10 flex items-center justify-center">
                    <div className="w-16 h-3 bg-slate-800 rounded-full" />
                  </div>
                  <img src={ssDice} alt={`${branding.name} Dice Duel`} className="w-full object-cover object-top" style={{ aspectRatio: "9/19.5" }} />
                  <div className="absolute bottom-0 left-0 right-0 h-5 bg-slate-900 flex items-center justify-center">
                    <div className="w-16 h-1 bg-white/20 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-1 text-xs text-violet-300 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> Live Game
                </span>
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-slate-500 font-medium">Dice Duel · You Win!</span>
              </div>
            </motion.div>

            {/* Phone 3 — Spin Battle */}
            <motion.div initial={{ opacity: 0, y: 30, rotate: 3 }} whileInView={{ opacity: 1, y: 0, rotate: 3 }} viewport={{ once: true }}
              className="relative w-[200px] sm:w-[220px] flex-shrink-0 md:mt-8">
              <div className="rounded-[2.5rem] bg-gradient-to-b from-slate-700 to-slate-800 p-[3px] shadow-[0_40px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="relative rounded-[2.3rem] overflow-hidden bg-slate-900">
                  <div className="absolute top-0 left-0 right-0 h-5 bg-slate-900 z-10 flex items-center justify-center">
                    <div className="w-16 h-3 bg-slate-800 rounded-full" />
                  </div>
                  <img src={ssSpin} alt={`${branding.name} Spin Battle`} className="w-full object-cover object-top" style={{ aspectRatio: "9/19.5" }} />
                  <div className="absolute bottom-0 left-0 right-0 h-5 bg-slate-900 flex items-center justify-center">
                    <div className="w-16 h-1 bg-white/20 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-slate-500 font-medium">Spin Battle</span>
              </div>
            </motion.div>
          </div>

          {/* Feature bullets below mockups */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20">
            {[
              { icon: Wallet, label: "4-Wallet System", desc: "Main · Game · Task · Referral wallets", color: "text-blue-400" },
              { icon: Trophy, label: "Live Game Rooms", desc: "Real-time PvP with instant results", color: "text-yellow-400" },
              { icon: TrendingUp, label: "Affiliate Dashboard", desc: "Track commissions across 3 tiers", color: "text-green-400" },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <b.icon className={`w-5 h-5 ${b.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <div className="text-sm font-bold text-white mb-0.5">{b.label}</div>
                  <div className="text-xs text-slate-500">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">{t("landing.sections.how_it_works","How It Works")}</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-base">{t("landing.sections.how_it_works_sub","Start earning in minutes, not days")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="relative bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] group overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-500/[0.03] to-transparent rounded-bl-full" />
                <div className="flex items-start gap-4 relative z-10">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg group-hover:scale-110 transition-transform">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{s.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
                  </div>
                </div>
                {i < steps.length - 1 && i % 3 !== 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                    <ChevronRight className="w-4 h-4 text-violet-500/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Task Marketplace ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-5">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Beyond Gaming</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">Task Marketplace & Creator Platform</h2>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {branding.name} is not just a gaming platform. Companies, creators, startups, crypto projects,
              influencers, and businesses create promotional campaigns while users complete tasks and earn rewards.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* For Businesses */}
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/[0.05] to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">For Businesses & Creators</h3>
                  <p className="text-xs text-slate-500">Launch promotional campaigns</p>
                </div>
              </div>
              <div className="space-y-2.5 mb-5">
                {[
                  { icon: Target, color: "text-blue-400", title: "Reach Your Audience", sub: "Connect with thousands of active users" },
                  { icon: DollarSign, color: "text-green-400", title: "Flexible Budgeting", sub: "Set your own budget and reward per user" },
                  { icon: Activity, color: "text-purple-400", title: "Real-Time Analytics", sub: "Track campaign performance live" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <item.icon className={`w-4 h-4 ${item.color} mt-0.5 flex-shrink-0`} />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-500/[0.07] border border-blue-500/15 rounded-xl p-3.5">
                <p className="text-[11px] text-blue-400 font-semibold mb-2">Campaign Flow</p>
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                  {["Create", "Set Budget", "Publish", "Users Complete", "Rewards Out"].map((step, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      <span>{step}</span>
                      {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-blue-500/40" />}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* For Earners */}
            <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-500/[0.05] to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">For Users & Earners</h3>
                  <p className="text-xs text-slate-500">Complete tasks & earn rewards</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { pct: "35%", label: "Free Users", border: "border-white/[0.07]", textColor: "text-slate-300" },
                  { pct: "45%", label: "Verified", border: "border-purple-500/20", textColor: "text-purple-300" },
                  { pct: "65%", label: "VIP", border: "border-yellow-500/30", textColor: "text-yellow-400", vip: true },
                ].map((tier, i) => (
                  <div key={i} className={`bg-white/[0.03] rounded-xl p-3 border ${tier.border} text-center`}>
                    <div className={`flex items-center justify-center gap-1 mb-0.5`}>
                      {tier.vip && <Crown className="w-3 h-3 text-yellow-400" />}
                      <span className={`text-xl font-black ${tier.textColor}`}>{tier.pct}</span>
                    </div>
                    <div className={`text-[11px] ${tier.vip ? "text-yellow-400/70" : "text-slate-500"} font-medium`}>{tier.label}</div>
                  </div>
                ))}
              </div>
              {/* Task marketplace screenshot */}
              <div className="rounded-xl overflow-hidden border border-white/[0.06] shadow-lg">
                <img src={ssTasks} alt="Task Marketplace" className="w-full object-cover object-top" style={{ maxHeight: 160 }} />
              </div>
            </motion.div>
          </div>

          {/* Task Types Grid — 20 canonical categories with real brand icons */}
          <div className="mb-10">
            <h3 className="text-lg font-black mb-5 text-center">Available Task Types</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2">
              {TASK_CATEGORIES.map((cat, idx) => (
                <motion.div key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-[#0d0d1a] border border-white/[0.07] rounded-xl p-3 hover:border-white/[0.14] hover:bg-[#0f0f1e] transition-all text-center group hover:scale-105 shadow-[0_2px_10px_rgba(0,0,0,0.3)] cursor-default"
                >
                  <div className="flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill={cat.iconColor}
                      dangerouslySetInnerHTML={{ __html: cat.svgIcon }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors font-medium leading-tight">{cat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Live Marketplace Stats */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-gradient-to-br from-violet-500/[0.08] to-pink-500/[0.05] rounded-2xl p-6 border border-violet-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-white">Live Marketplace Activity</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-slate-400 font-medium">Real-time</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Activity, color: "text-blue-400",   label: "Active Campaigns", val: marketStats ? marketStats.activeCampaigns.toLocaleString()              : "—" },
                { icon: Timer,    color: "text-green-400",  label: "Tasks Available",  val: marketStats ? marketStats.tasksAvailable.toLocaleString()               : "—" },
                { icon: CheckCircle2, color: "text-purple-400", label: "Completed Today",  val: marketStats ? marketStats.completedToday.toLocaleString()          : "—" },
                { icon: DollarSign,   color: "text-yellow-400", label: "Rewards Paid",     val: marketStats ? `$${marketStats.rewardsPaidUSD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—", valColor: "text-green-400" },
              ].map((stat, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                  </div>
                  <p className={`text-xl font-black ${(stat as any).valColor || "text-white"}`}>{stat.val}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-violet-500/10 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-slate-500 font-medium">Trending:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Social Media", "Crypto Projects", "App Downloads"].map((tag, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full border font-medium"
                    style={{ background: ["rgba(124,58,237,0.08)", "rgba(59,130,246,0.08)", "rgba(34,197,94,0.08)"][i], borderColor: ["rgba(124,58,237,0.2)", "rgba(59,130,246,0.2)", "rgba(34,197,94,0.2)"][i], color: ["#c4b5fd", "#93c5fd", "#86efac"][i] }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm mb-4">Whether you're a business looking to grow or a user ready to earn — the marketplace is live.</p>
            <button onClick={() => navigate("/register")}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-7 py-3 rounded-xl font-bold text-sm transition-all shadow-[0_8px_24px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_32px_rgba(124,58,237,0.45)] hover:scale-[1.02]">
              Start Earning from Tasks <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── VIP & Affiliate ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* VIP */}
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-gradient-to-br from-yellow-500/[0.07] to-orange-500/[0.04] rounded-2xl p-7 border border-yellow-500/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-yellow-500/[0.05] to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{t("vip.title","VIP Membership")}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] text-yellow-400/80 font-semibold uppercase tracking-wider">Premium Tier</span>
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed relative z-10">Unlock premium benefits and maximize your earning potential across every platform feature.</p>
              
              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                <div className="bg-yellow-500/[0.06] border border-yellow-500/15 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-yellow-400 font-black">24/7</div>
                  <div className="text-[9px] text-yellow-400/60 font-medium">Support</div>
                </div>
                <div className="bg-yellow-500/[0.06] border border-yellow-500/15 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-yellow-400 font-black">3-Tier</div>
                  <div className="text-[9px] text-yellow-400/60 font-medium">Rewards</div>
                </div>
                <div className="bg-yellow-500/[0.06] border border-yellow-500/15 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-yellow-400 font-black">Exclusive</div>
                  <div className="text-[9px] text-yellow-400/60 font-medium">Rooms</div>
                </div>
              </div>

              <div className="bg-yellow-500/[0.08] border border-yellow-500/20 rounded-xl p-3 mb-5 relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-yellow-300 font-semibold">Task Reward Multiplier</span>
                  <span className="text-lg font-black text-yellow-400">65%</span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-yellow-500 to-amber-400 h-1.5 rounded-full w-[65%] shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                {vipBenefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-white/[0.03] border border-yellow-500/10 rounded-xl p-3 hover:border-yellow-500/20 transition-colors group">
                    <b.icon className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-slate-300 font-medium leading-relaxed">{b.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Affiliate */}
            <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-gradient-to-br from-green-500/[0.07] to-emerald-500/[0.04] rounded-2xl p-7 border border-green-500/15 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-green-500/[0.05] to-transparent rounded-bl-full" />
              <div className="flex items-center gap-3 mb-2 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Affiliate Rewards</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] text-green-400/80 font-semibold uppercase tracking-wider">3-Tier System</span>
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed relative z-10">Earn commissions through our 3-tier referral program. Passive income on every activity your network generates.</p>

              {/* Mini commission preview */}
              <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                <div className="bg-green-500/[0.08] border border-green-500/20 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-green-400 font-black">20%</div>
                  <div className="text-[9px] text-green-400/60 font-medium">Tier 1</div>
                </div>
                <div className="bg-green-500/[0.06] border border-green-500/15 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-green-400 font-black">5%</div>
                  <div className="text-[9px] text-green-400/60 font-medium">Tier 2</div>
                </div>
                <div className="bg-green-500/[0.04] border border-green-500/10 rounded-lg px-2 py-1.5 text-center">
                  <div className="text-xs text-green-400 font-black">3%</div>
                  <div className="text-[9px] text-green-400/60 font-medium">Tier 3</div>
                </div>
              </div>

              {/* Affiliate screenshot */}
              <div className="rounded-xl overflow-hidden border border-white/[0.06] mb-5 shadow-lg relative z-10">
                <img src={ssAffiliate} alt="Affiliate Dashboard" className="w-full object-cover object-top" style={{ maxHeight: 140 }} />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Single Winner Games</p>
                  <div className="space-y-2">
                    <div className="bg-white/[0.03] border border-green-500/10 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Tier 1 — Direct Referrals</span>
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-slate-800/60 rounded-full h-1"><div className="bg-gradient-to-r from-green-500 to-emerald-400 h-1 rounded-full w-[20%] shadow-[0_0_6px_rgba(34,197,94,0.5)]" /></div>
                        <span className="text-sm font-black text-green-400">20%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ tier: "Tier 2", pct: "5%", w: "5%" }, { tier: "Tier 3", pct: "3%", w: "3%" }].map(t => (
                        <div key={t.tier} className="bg-white/[0.03] border border-green-500/10 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">{t.tier}</span>
                          <span className="text-sm font-black text-green-400">{t.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Multi Winner Games</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ tier: "T1", pct: "10%" }, { tier: "T2", pct: "3%" }, { tier: "T3", pct: "2%" }].map(t => (
                      <div key={t.tier} className="bg-white/[0.03] border border-green-500/10 rounded-xl p-2.5 text-center">
                        <div className="text-[11px] text-slate-500 mb-0.5">{t.tier}</div>
                        <div className="text-sm font-black text-green-400">{t.pct}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 italic">* Commissions from platform fees on VIP winner games only</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Security & Trust (Banking-Grade) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">Enterprise-Grade Infrastructure</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">{t("landing.sections.security","Banking-Grade Security")}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Institutional-level security protecting your funds with military-grade encryption,
              multi-layer authentication, and comprehensive regulatory compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {complianceFeatures.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="group bg-[#0d0d1a] border border-white/[0.07] rounded-2xl p-5 hover:border-blue-500/20 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(59,130,246,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/[0.03] to-transparent rounded-bl-full" />
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3.5 shadow-lg group-hover:scale-105 transition-transform relative z-10`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2 relative z-10">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 relative z-10">{f.description}</p>
                <div className="pt-3 border-t border-white/[0.04] relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-blue-400/70" />
                      <span className="text-[10px] text-blue-400/70 font-semibold uppercase tracking-wider">Verified</span>
                    </div>
                    <div className="text-[9px] text-slate-600 font-medium">Active</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Security metrics bar */}
          <div className="bg-gradient-to-r from-blue-500/[0.06] via-indigo-500/[0.04] to-violet-500/[0.06] border border-blue-500/10 rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Live Security Metrics</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { val: "256-bit", label: "AES Encryption", icon: Lock, color: "text-blue-400" },
                { val: "99.9%", label: "Uptime SLA", icon: ServerCrash, color: "text-green-400" },
                { val: "2FA", label: "Authentication", icon: Fingerprint, color: "text-purple-400" },
                { val: "24/7", label: "Fraud Monitoring", icon: Eye, color: "text-orange-400" },
              ].map((m, i) => (
                <div key={i} className="text-center">
                  <m.icon className={`w-6 h-6 ${m.color} mx-auto mb-2`} />
                  <div className={`text-2xl font-black ${m.color} mb-1`}>{m.val}</div>
                  <div className="text-xs text-slate-600 font-medium">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Multi-Currency (View Balance) ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015] border-y border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 mb-5">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300 font-medium">Localized Display</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">Global Balance Viewing</h2>
            <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed mb-4">
              Your {branding.name} balance is held and processed in USD. View the equivalent amount in your local currency for convenience — this is localized display only, not a currency exchange platform.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 bg-blue-500/[0.08] border border-blue-500/15 rounded-lg px-4 py-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-300 font-semibold">International accessibility</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-green-500/[0.08] border border-green-500/15 rounded-lg px-4 py-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-300 font-semibold">USD is the platform's base currency</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-purple-500/[0.08] border border-purple-500/15 rounded-lg px-4 py-2">
                <Eye className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-300 font-semibold">Multi-region wallet display</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {currencies.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.92, y: 10 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}
                className={`bg-[#0d0d1a] border rounded-2xl p-4 text-center hover:scale-105 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden ${i === 0 ? "border-green-500/25 bg-gradient-to-br from-green-500/[0.06] to-transparent" : "border-white/[0.07] hover:border-white/[0.12]"}`}>
                {i !== 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/[0.02] to-transparent rounded-bl-full" />}
                <div className="text-4xl mb-2.5 relative z-10 filter drop-shadow-lg">{c.flag}</div>
                <div className="text-base font-black text-white mb-0.5 relative z-10">{c.code}</div>
                <div className="text-[11px] text-slate-600 mb-1.5 font-medium relative z-10">{c.name}</div>
                <div className="text-lg font-black text-slate-300 relative z-10">{c.symbol}</div>
                <div className="mt-2 pt-2 border-t border-white/[0.04] relative z-10">
                  <div className="text-[10px] rounded-full px-2 py-0.5 font-semibold inline-block" style={{
                    background: i === 0 ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.1)",
                    color: i === 0 ? "#4ade80" : "#64748b"
                  }}>
                    {i === 0 ? "Base Currency" : "Display Only"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Preview ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 tracking-tight bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">Professional Platform Interface</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Premium fintech-grade experience — seamlessly optimized across all devices</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mobile */}
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-violet-500/20 transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden">
                <img src={ssColor} alt="Color Prediction Live" className="w-full h-full object-cover object-top opacity-60 group-hover:opacity-70 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/40 to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 rounded-full px-2.5 py-1 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-red-300 font-bold">LIVE GAME</span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1 backdrop-blur-md">
                  <Smartphone className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-slate-300 font-semibold">Mobile</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-black text-white mb-2">Mobile Optimized</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">Responsive design works perfectly on all devices. Play games, manage wallets, and track earnings on the go.</p>
                <div className="space-y-2">
                  {["Touch-optimized game controls", "Real-time push notifications", "Seamless responsive navigation"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Desktop */}
            <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="bg-[#0d0d1a] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-blue-500/20 transition-all duration-300 group">
              <div className="relative h-48 overflow-hidden">
                <img src={ssTasks} alt="Task Marketplace" className="w-full h-full object-cover object-top opacity-60 group-hover:opacity-70 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/40 to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full px-2.5 py-1 backdrop-blur-sm">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-300 font-bold">MARKETPLACE</span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1 backdrop-blur-md">
                  <BarChart3 className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-slate-300 font-semibold">Full Dashboard</span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-black text-white mb-2">Full Platform Power</h3>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">Complete dashboard with advanced analytics, detailed transaction history, and comprehensive game statistics.</p>
                <div className="space-y-2">
                  {["Advanced statistics & game history", "Full task creation & management", "Complete affiliate tracking dashboard"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />{item}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/[0.015] border-t border-white/[0.04] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-700/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-violet-300 font-medium">{livePlayerCount.toLocaleString()} players online right now</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight">
              {t("landing.cta.final_title","Ready to Start Earning?")}
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto leading-relaxed font-normal">
              {t("landing.cta.final_sub","Join {name} and unlock unlimited earning potential through competitive gaming, task completion, and affiliate rewards.").replace("{name}", branding.name)}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => navigate("/register")}
                className="group bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-10 py-4 rounded-xl font-black text-base transition-all duration-200 shadow-[0_12px_40px_rgba(124,58,237,0.4)] hover:shadow-[0_16px_50px_rgba(124,58,237,0.55)] hover:scale-[1.03] flex items-center gap-2">
                {t("landing.cta.create_account","Create Free Account")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={() => navigate("/login")}
                className="bg-white/[0.06] hover:bg-white/[0.1] text-white px-10 py-4 rounded-xl font-bold text-base transition-all duration-200 border border-white/[0.1] hover:border-white/[0.2]">
                {t("landing.cta.login","Sign In")}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#04040b] border-t border-white/[0.05] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent shadow-[0_0_20px_rgba(139,92,246,0.15)]" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <img src={branding.logoUrl || logo} alt={branding.name} className="h-8 w-auto mb-4" />
              <p className="text-slate-500 text-sm leading-relaxed mb-5">Next-generation gaming and fintech platform for competitive earners worldwide.</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span className="font-medium">Bank-Grade Security</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                  <Globe className="w-4 h-4 text-green-400" />
                  <span className="font-medium">10 Display Currencies</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-violet-400" />
                  <span className="font-medium">24/7 Support</span>
                </div>
              </div>
            </div>
            {[
              { label: "Platform", links: [{ name: "Features", href: "#features" }, { name: "Games", href: "#games" }, { name: "How It Works", href: "#how-it-works" }, { name: "Affiliate Program", href: "#" }] },
              { label: "Legal", links: [{ name: "Privacy Policy", href: "#" }, { name: "Terms & Conditions", href: "#" }, { name: "AML/KYC Policy", href: "#" }, { name: "Responsible Gaming", href: "#" }] },
              { label: "Support", links: [{ name: "Help Center", href: "#" }, { name: "Contact Us", href: "#" }, { name: "FAQ", href: "#" }, { name: "About Us", href: "#" }] },
            ].map((col, i) => (
              <div key={i}>
                <h3 className="font-bold text-sm text-white mb-4">{col.label}</h3>
                <ul className="space-y-2.5">
                  {col.links.map((l, j) => (
                    <li key={j}><a href={l.href} className="text-sm text-slate-500 hover:text-white transition-colors">{l.name}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent shadow-[0_0_15px_rgba(255,255,255,0.08)]" />
            <div className="border-t border-white/[0.05] pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col items-center md:items-start gap-2">
                <p className="text-xs text-slate-600">© {branding.copyrightYear || new Date().getFullYear()} {branding.name}. All rights reserved.</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-700">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400/50" />18+ Only</span>
                  <span className="text-slate-800">•</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-400/50" />Play Responsibly</span>
                  <span className="text-slate-800">•</span>
                  <span className="flex items-center gap-1"><FileCheck className="w-3 h-3 text-violet-400/50" />KYC Verified</span>
                </div>
              </div>
            <div className="flex items-center gap-4">
              {[
                { label: "X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                { label: "Telegram", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.098.155.23.171.324.016.094.036.306.02.472z" },
              ].map((social, i) => (
                <a key={i} href="#" className="text-slate-600 hover:text-white transition-colors" aria-label={social.label}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={social.path} /></svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      </footer>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 75s linear infinite;
          display: inline-flex;
        }
        @media (max-width: 768px) {
          .animate-scroll {
            animation: scroll 90s linear infinite;
          }
        }
      `}</style>
    </div>
  );
}
