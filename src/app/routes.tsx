import { createBrowserRouter, Navigate, redirect, Outlet } from "react-router";
import { lazy, Suspense } from "react";

// ─── Admin panel (lazy-loaded, self-contained under /admin) ──────────────────
const AdminLayout          = lazy(() => import("./admin/layouts/AdminLayout"));
const AdminDashboard       = lazy(() => import("./admin/pages/Dashboard"));
const AdminComingSoon      = lazy(() => import("./admin/pages/ComingSoon"));
// Phase B — operational modules
const AdminTasksPending    = lazy(() => import("./admin/pages/tasks/TasksPendingPage"));
const AdminTasksMarketplace= lazy(() => import("./admin/pages/tasks/TasksMarketplacePage"));
const AdminProofReview     = lazy(() => import("./admin/pages/tasks/ProofReviewPage"));
const AdminWithdrawals     = lazy(() => import("./admin/pages/financial/WithdrawalsPage"));
const AdminDeposits        = lazy(() => import("./admin/pages/financial/DepositsPage"));
const AdminTransactions    = lazy(() => import("./admin/pages/financial/TransactionsPage"));
const AdminWallets         = lazy(() => import("./admin/pages/wallets/WalletManagementPage"));
const AdminUsers           = lazy(() => import("./admin/pages/users/UsersPage"));
// Phase C — User Management
const AdminUserDetail      = lazy(() => import("./admin/pages/users/UserDetailPage"));
// Phase 5 — Game Management
const AdminGames           = lazy(() => import("./admin/pages/games/GamesPage"));
const AdminKYCQueue        = lazy(() => import("./admin/pages/kyc/KYCPage"));
const AdminKYCDetail       = lazy(() => import("./admin/pages/kyc/KYCDetailPage"));
// Phase 6 — Task Management
const AdminTasksDashboard  = lazy(() => import("./admin/pages/tasks/TasksDashboardPage"));
const AdminTaskDetail      = lazy(() => import("./admin/pages/tasks/TaskDetailPage"));
// Phase 7 — Referrals & Affiliates Admin
const AdminReferrals       = lazy(() => import("./admin/pages/referrals/ReferralsPage"));
// Phase 8 — VIP Admin
const AdminVIP             = lazy(() => import("./admin/pages/vip/VIPPage"));
// Phase 9 — Notifications, Content, Static Pages, Platform Text
const AdminNotifications   = lazy(() => import("./admin/pages/notifications/NotificationsPage"));
const AdminContent         = lazy(() => import("./admin/pages/content/ContentPage"));
const AdminStaticPages     = lazy(() => import("./admin/pages/pages/StaticPagesPage"));
const AdminPlatformText    = lazy(() => import("./admin/pages/text/PlatformTextPage"));
// Phase 10 — Analytics & Reports
const AdminAnalytics       = lazy(() => import("./admin/pages/analytics/AnalyticsPage"));
// Phase 23.2 — Admin Settings
const AdminSettings        = lazy(() => import("./admin/pages/settings/AdminSettingsPage"));
// Phase 23.3 — Currency Management
const AdminCurrency        = lazy(() => import("./admin/pages/currency/AdminCurrencyPage"));
// Phase 24.2 — Globalization & Platform Control Center
const AdminLanguages       = lazy(() => import("./admin/pages/languages/AdminLanguagesPage"));
const AdminTranslations    = lazy(() => import("./admin/pages/translations/AdminTranslationsPage"));
const AdminBranding        = lazy(() => import("./admin/pages/branding/AdminBrandingPage"));
const AdminFeatures        = lazy(() => import("./admin/pages/features/AdminFeaturesPage"));
// Phase 13 — AI Developer Center
const AdminAIDeveloper     = lazy(() => import("./admin/pages/developer/AIDeveloperPage"));
// Phase 15 — Security & Audit
const AdminSecurity        = lazy(() => import("./admin/pages/security/SecurityPage"));
const AdminAuditLog        = lazy(() => import("./admin/pages/security/AuditLogPage"));
const AdminSecurityEvents  = lazy(() => import("./admin/pages/security/SecurityEventsPage"));
const AdminLoginHistory    = lazy(() => import("./admin/pages/security/LoginHistoryPage"));
const AdminSessions        = lazy(() => import("./admin/pages/security/SessionsPage"));
const AdminIpControls      = lazy(() => import("./admin/pages/security/IpControlsPage"));
const AdminFraudAlerts     = lazy(() => import("./admin/pages/security/FraudAlertsPage"));
const AdminCompliance      = lazy(() => import("./admin/pages/security/CompliancePage"));

// Phase 20.4 — Growth Admin
const AdminAmbassadors = lazy(() => import("./admin/pages/ambassadors/AmbassadorsPage"));
const AdminChallenges  = lazy(() => import("./admin/pages/challenges/ChallengesPage"));
const AdminFootballPoints = lazy(() => import("./admin/pages/football/PointsPage"));
const AdminPromotions  = lazy(() => import("./admin/pages/promotions/PromotionsPage"));
const AdminAuctions    = lazy(() => import("./admin/pages/auctions/AuctionsPage"));

// Phase 16 — Football AI Hub Admin
const AdminFootball            = lazy(() => import("./admin/pages/football/FootballOverviewPage"));
const AdminFootballLeagues     = lazy(() => import("./admin/pages/football/LeaguesPage"));
const AdminFootballMatches     = lazy(() => import("./admin/pages/football/MatchesPage"));
const AdminFootballPredictions = lazy(() => import("./admin/pages/football/PredictionsPage"));
const AdminFootballResults     = lazy(() => import("./admin/pages/football/ResultsPage"));
// Phase 17.1/17.2 — AI Intelligence Admin
const AdminAIStatus         = lazy(() => import("./admin/pages/football/ai/AIStatusPage"));
const AdminAIConfig         = lazy(() => import("./admin/pages/football/ai/AIConfigPage"));
const AdminAIQueue          = lazy(() => import("./admin/pages/football/ai/AIQueuePage"));
const AdminAILearning       = lazy(() => import("./admin/pages/football/ai/AILearningPage"));
const AdminAIAnalysisDetail  = lazy(() => import("./admin/pages/football/ai/AIAnalysisDetailPage"));
const AdminAIPredictions     = lazy(() => import("./admin/pages/football/ai/AIPredictionsPage"));
const AdminAIProviders       = lazy(() => import("./admin/pages/football/ai/ProvidersPage"));
const AdminAIPublishConfig   = lazy(() => import("./admin/pages/football/ai/PublishConfigPage"));
const AdminAIDiagnostics     = lazy(() => import("./admin/pages/football/ai/DiagnosticsPage"));
const AdminAIMonitoring      = lazy(() => import("./admin/pages/football/ai/MonitoringPage"));

// Eagerly load critical pages (landing, auth)
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { VerifyEmail } from "./pages/VerifyEmail";

// Lazy load all other pages for better performance
const Wallet = lazy(() => import("./pages/Wallet").then(module => ({ default: module.default || module.Wallet })));
const Tasks = lazy(() => import("./pages/Tasks"));
const CreateTask = lazy(() => import("./pages/CreateTask"));
const MyTasks = lazy(() => import("./pages/MyTasks"));
const TaskManager = lazy(() => import("./pages/TaskManager"));
const GameLobby = lazy(() => import("./pages/GameLobby"));
const LobbySelection = lazy(() => import("./pages/LobbySelection"));
const ColorGame = lazy(() => import("./pages/ColorGame"));
const FootballHub = lazy(() => import("./football/FootballHub"));
const AuctionHub  = lazy(() => import("./auction/AuctionHub"));
const SpinBattle = lazy(() => import("./pages/SpinBattle"));
const PvPCoinFlip = lazy(() => import("./pages/PvPCoinFlip"));
const PvPCoinFlipGame = lazy(() => import("./pages/PvPCoinFlipGame"));
const PvPCoinFlipPrivate = lazy(() => import("./pages/PvPCoinFlipPrivate"));
const DiceClashPrivate   = lazy(() => import("./pages/DiceClashPrivate"));
const ReactionTapPrivate = lazy(() => import("./pages/ReactionTapPrivate"));
const DiceDuelModeSelection = lazy(() => import("./pages/DiceDuelModeSelection"));
const DiceClashStakeSelection = lazy(() => import("./pages/DiceClashStakeSelection"));
const DiceDuelGame = lazy(() => import("./pages/DiceDuelGame"));
const DiceRoyaleLobbySelection = lazy(() => import("./pages/DiceRoyaleLobbySelection"));
const DiceRoyaleStakeSelection = lazy(() => import("./pages/DiceRoyaleStakeSelection"));
const DiceRoyaleGame = lazy(() => import("./pages/DiceRoyaleGame"));
const DiceArenaLobbySelection = lazy(() => import("./pages/DiceArenaLobbySelection"));
const DiceArenaStakeSelection = lazy(() => import("./pages/DiceArenaStakeSelection"));
const DiceArenaGame = lazy(() => import("./pages/DiceArenaGame"));
const ReactionTapStakeSelection = lazy(() => import("./pages/ReactionTapStakeSelection"));
const ReactionTapGameRoom = lazy(() => import("./pages/ReactionTapGameRoom"));
const ProvablyFairPage    = lazy(() => import("./pages/ProvablyFairPage"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const IdentityVerification = lazy(() => import("./pages/IdentityVerification"));
const AffiliateProgram  = lazy(() => import("./pages/AffiliateProgram"));
const AmbassadorProgram = lazy(() => import("./pages/AmbassadorProgram"));
const ReferralChallenge = lazy(() => import("./pages/ReferralChallenge"));

// Loading component for lazy-loaded pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-white/60 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Hydration fallback component
function AppHydrateFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white font-semibold text-lg">Loading…</p>
      </div>
    </div>
  );
}

// Root layout component
function RootLayout() {
  return <Outlet />;
}

// Wrapper component for lazy-loaded routes
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// Auth check — guarded against sandboxed environments where localStorage throws
const checkAuth = () => {
  try {
    return localStorage.getItem("bitzimiUser") !== null;
  } catch {
    return false;
  }
};

// Auth loader for protected routes
const protectedLoader = () => {
  try {
    if (!checkAuth()) return redirect("/login");
  } catch {
    return redirect("/login");
  }
  return null;
};

// Home loader
const homeLoader = () => {
  try {
    if (checkAuth()) return redirect("/wallet");
  } catch {
    // stay on landing in restricted environments
  }
  return null;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    HydrateFallback: AppHydrateFallback,
    children: [
      {
        index: true,
        loader: homeLoader,
        element: <Landing />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register/:referralCode?",
        element: <Register />,
      },
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "verify-email",
        element: <VerifyEmail />,
      },
      {
        path: "tasks",
        loader: protectedLoader,
        element: <LazyRoute><Tasks /></LazyRoute>,
      },
      {
        path: "wallet",
        loader: protectedLoader,
        element: <LazyRoute><Wallet /></LazyRoute>,
      },
      {
        path: "game",
        loader: protectedLoader,
        element: <LazyRoute><GameLobby /></LazyRoute>,
      },
      {
        path: "games",
        loader: protectedLoader,
        element: <LazyRoute><GameLobby /></LazyRoute>,
      },
      {
        path: "game/lobby-selection",
        loader: protectedLoader,
        element: <LazyRoute><LobbySelection /></LazyRoute>,
      },
      {
        path: "game/color",
        loader: protectedLoader,
        element: <LazyRoute><ColorGame /></LazyRoute>,
      },
      {
        path: "game/color/:lobbyId",
        loader: protectedLoader,
        element: <LazyRoute><ColorGame /></LazyRoute>,
      },
      {
        path: "football/*",
        loader: protectedLoader,
        element: <LazyRoute><FootballHub /></LazyRoute>,
      },
      {
        path: "auction/*",
        loader: protectedLoader,
        element: <LazyRoute><AuctionHub /></LazyRoute>,
      },
      {
        path: "game/spin-battle",
        loader: protectedLoader,
        element: <LazyRoute><SpinBattle /></LazyRoute>,
      },
      {
        path: "game/pvp-coinflip",
        loader: protectedLoader,
        element: <LazyRoute><PvPCoinFlip /></LazyRoute>,
      },
      {
        path: "game/pvp-coinflip/play",
        loader: protectedLoader,
        element: <LazyRoute><PvPCoinFlipGame /></LazyRoute>,
      },
      {
        path: "game/pvp-coinflip/private",
        loader: protectedLoader,
        element: <LazyRoute><PvPCoinFlipPrivate /></LazyRoute>,
      },
      {
        path: "dice-duel",
        loader: protectedLoader,
        element: <LazyRoute><DiceDuelModeSelection /></LazyRoute>,
      },
      {
        path: "dice-duel/clash",
        loader: protectedLoader,
        element: <LazyRoute><DiceClashStakeSelection /></LazyRoute>,
      },
      {
        path: "dice-duel/clash/game",
        loader: protectedLoader,
        element: <LazyRoute><DiceDuelGame /></LazyRoute>,
      },
      {
        path: "dice-duel/clash/private",
        loader: protectedLoader,
        element: <LazyRoute><DiceClashPrivate /></LazyRoute>,
      },
      {
        path: "dice-duel/royale",
        loader: protectedLoader,
        element: <LazyRoute><DiceRoyaleLobbySelection /></LazyRoute>,
      },
      {
        path: "dice-duel/royale/lobby",
        loader: protectedLoader,
        element: <LazyRoute><DiceRoyaleLobbySelection /></LazyRoute>,
      },
      {
        path: "dice-duel/royale/stakes",
        loader: protectedLoader,
        element: <LazyRoute><DiceRoyaleStakeSelection /></LazyRoute>,
      },
      {
        path: "dice-duel/royale/game",
        loader: protectedLoader,
        element: <LazyRoute><DiceRoyaleGame /></LazyRoute>,
      },
      {
        path: "dice-duel/arena",
        loader: protectedLoader,
        element: <LazyRoute><DiceArenaLobbySelection /></LazyRoute>,
      },
      {
        path: "dice-duel/arena/lobby",
        loader: protectedLoader,
        element: <LazyRoute><DiceArenaLobbySelection /></LazyRoute>,
      },
      {
        path: "dice-duel/arena/stakes",
        loader: protectedLoader,
        element: <LazyRoute><DiceArenaStakeSelection /></LazyRoute>,
      },
      {
        path: "dice-duel/arena/game",
        loader: protectedLoader,
        element: <LazyRoute><DiceArenaGame /></LazyRoute>,
      },
      {
        path: "game/reaction-tap",
        loader: protectedLoader,
        element: <LazyRoute><ReactionTapStakeSelection /></LazyRoute>,
      },
      {
        path: "game/reaction-tap/play",
        loader: protectedLoader,
        element: <LazyRoute><ReactionTapGameRoom /></LazyRoute>,
      },
      {
        path: "game/reaction-tap/private",
        loader: protectedLoader,
        element: <LazyRoute><ReactionTapPrivate /></LazyRoute>,
      },
      {
        path: "provably-fair",
        element: <LazyRoute><ProvablyFairPage /></LazyRoute>,
      },
      {
        path: "create-task",
        loader: protectedLoader,
        element: <LazyRoute><CreateTask /></LazyRoute>,
      },
      {
        path: "my-tasks",
        loader: protectedLoader,
        element: <LazyRoute><MyTasks /></LazyRoute>,
      },
      {
        path: "task-manager",
        loader: protectedLoader,
        element: <LazyRoute><TaskManager /></LazyRoute>,
      },
      {
        path: "referrals",
        loader: protectedLoader,
        element: <LazyRoute><Referrals /></LazyRoute>,
      },
      {
        path: "settings",
        loader: protectedLoader,
        element: <LazyRoute><Settings /></LazyRoute>,
      },
      {
        path: "profile",
        loader: protectedLoader,
        element: <LazyRoute><Profile /></LazyRoute>,
      },
      {
        path: "identity-verification",
        loader: protectedLoader,
        element: <LazyRoute><IdentityVerification /></LazyRoute>,
      },
      {
        path: "affiliate-program",
        loader: protectedLoader,
        element: <LazyRoute><AffiliateProgram /></LazyRoute>,
      },
      {
        path: "ambassador",
        loader: protectedLoader,
        element: <LazyRoute><AmbassadorProgram /></LazyRoute>,
      },
      {
        path: "challenge",
        loader: protectedLoader,
        element: <LazyRoute><ReferralChallenge /></LazyRoute>,
      },
      // ── Admin Panel (/admin/*) ─────────────────────────────────────────────
      // Route guard (AdminRouteGuard) lives inside AdminLayout itself.
      // The protectedLoader here ensures the user is *authenticated* before
      // AdminLayout even renders — AdminLayout then checks the admin role.
      {
        path: "admin",
        loader: protectedLoader,
        element: (
          <LazyRoute>
            <AdminLayout />
          </LazyRoute>
        ),
        children: [
          {
            index: true,
            element: (
              <LazyRoute>
                <AdminDashboard />
              </LazyRoute>
            ),
          },
          // ── Users (Phase B) ───────────────────────────────────────────────
          {
            path: "users",
            element: <LazyRoute><AdminUsers /></LazyRoute>,
          },
          {
            path: "users/:userId",
            element: <LazyRoute><AdminUserDetail /></LazyRoute>,
          },
          // ── KYC ──────────────────────────────────────────────────────────
          {
            path: "kyc",
            element: <LazyRoute><AdminKYCQueue /></LazyRoute>,
          },
          {
            path: "kyc/:submissionId",
            element: <LazyRoute><AdminKYCDetail /></LazyRoute>,
          },
          // ── Financial (Phase B) ───────────────────────────────────────────
          {
            path: "financial",
            children: [
              {
                path: "withdrawals",
                element: <LazyRoute><AdminWithdrawals /></LazyRoute>,
              },
              {
                path: "deposits",
                element: <LazyRoute><AdminDeposits /></LazyRoute>,
              },
              {
                path: "transactions",
                element: <LazyRoute><AdminTransactions /></LazyRoute>,
              },
              {
                path: "wallets",
                element: <LazyRoute><AdminWallets /></LazyRoute>,
              },
            ],
          },
          // ── Tasks (Phase 6) ───────────────────────────────────────────────
          {
            path: "tasks",
            children: [
              {
                index: true,
                element: <LazyRoute><AdminTasksDashboard /></LazyRoute>,
              },
              {
                path: "pending",
                element: <LazyRoute><AdminTasksPending /></LazyRoute>,
              },
              {
                path: "marketplace",
                element: <LazyRoute><AdminTasksMarketplace /></LazyRoute>,
              },
              {
                path: "proofs",
                element: <LazyRoute><AdminProofReview /></LazyRoute>,
              },
              {
                path: ":taskId",
                element: <LazyRoute><AdminTaskDetail /></LazyRoute>,
              },
            ],
          },
          // ── Games ─────────────────────────────────────────────────────────
          {
            path: "games",
            element: <LazyRoute><AdminGames /></LazyRoute>,
          },
          // ── VIP ───────────────────────────────────────────────────────────
          {
            path: "vip",
            element: <LazyRoute><AdminVIP /></LazyRoute>,
          },
          // ── Referrals & Affiliates ─────────────────────────────────────
          {
            path: "referrals",
            element: <LazyRoute><AdminReferrals /></LazyRoute>,
          },
          // ── Analytics & Reports (Phase 10) ──────────────────────────
          {
            path: "analytics",
            element: <LazyRoute><AdminAnalytics /></LazyRoute>,
          },
          // ── Notifications (Phase 9) ───────────────────────────────────
          {
            path: "notifications",
            element: <LazyRoute><AdminNotifications /></LazyRoute>,
          },
          // ── Content (Phase 9) ─────────────────────────────────────────
          {
            path: "content",
            element: <LazyRoute><AdminContent /></LazyRoute>,
          },
          // ── Static Pages (Phase 9) ────────────────────────────────────
          {
            path: "pages",
            element: <LazyRoute><AdminStaticPages /></LazyRoute>,
          },
          // ── Platform Text (Phase 9) ───────────────────────────────────
          {
            path: "text",
            element: <LazyRoute><AdminPlatformText /></LazyRoute>,
          },
          // ── Security & Audit (Phase 15) ──────────────────────────────────
          {
            path: "security",
            element: <LazyRoute><AdminSecurity /></LazyRoute>,
          },
          {
            path: "audit-log",
            element: <LazyRoute><AdminAuditLog /></LazyRoute>,
          },
          {
            path: "security/events",
            element: <LazyRoute><AdminSecurityEvents /></LazyRoute>,
          },
          {
            path: "security/login-history",
            element: <LazyRoute><AdminLoginHistory /></LazyRoute>,
          },
          {
            path: "security/sessions",
            element: <LazyRoute><AdminSessions /></LazyRoute>,
          },
          {
            path: "security/ip-controls",
            element: <LazyRoute><AdminIpControls /></LazyRoute>,
          },
          {
            path: "security/fraud-alerts",
            element: <LazyRoute><AdminFraudAlerts /></LazyRoute>,
          },
          {
            path: "security/compliance",
            element: <LazyRoute><AdminCompliance /></LazyRoute>,
          },
          // ── Growth Admin (Phase 20.4) ─────────────────────────────────────
          {
            path: "ambassadors",
            element: <LazyRoute><AdminAmbassadors /></LazyRoute>,
          },
          {
            path: "challenges",
            element: <LazyRoute><AdminChallenges /></LazyRoute>,
          },
          {
            path: "football/points",
            element: <LazyRoute><AdminFootballPoints /></LazyRoute>,
          },
          {
            path: "promotions",
            element: <LazyRoute><AdminPromotions /></LazyRoute>,
          },
          {
            path: "auctions",
            element: <LazyRoute><AdminAuctions /></LazyRoute>,
          },
          // ── Football AI Hub Admin ─────────────────────────────────────────
          {
            path: "football",
            element: <LazyRoute><AdminFootball /></LazyRoute>,
          },
          {
            path: "football/leagues",
            element: <LazyRoute><AdminFootballLeagues /></LazyRoute>,
          },
          {
            path: "football/matches",
            element: <LazyRoute><AdminFootballMatches /></LazyRoute>,
          },
          {
            path: "football/predictions",
            element: <LazyRoute><AdminFootballPredictions /></LazyRoute>,
          },
          {
            path: "football/results",
            element: <LazyRoute><AdminFootballResults /></LazyRoute>,
          },
          // ── Football AI Intelligence Admin — Phase 17.1 ───────────────────
          {
            path: "football/ai",
            element: <LazyRoute><AdminAIStatus /></LazyRoute>,
          },
          {
            path: "football/ai/config",
            element: <LazyRoute><AdminAIConfig /></LazyRoute>,
          },
          {
            path: "football/ai/queue",
            element: <LazyRoute><AdminAIQueue /></LazyRoute>,
          },
          {
            path: "football/ai/learning",
            element: <LazyRoute><AdminAILearning /></LazyRoute>,
          },
          {
            path: "football/ai/analyses/:matchId",
            element: <LazyRoute><AdminAIAnalysisDetail /></LazyRoute>,
          },
          {
            path: "football/ai/predictions",
            element: <LazyRoute><AdminAIPredictions /></LazyRoute>,
          },
          {
            path: "football/ai/providers",
            element: <LazyRoute><AdminAIProviders /></LazyRoute>,
          },
          {
            path: "football/ai/publish-config",
            element: <LazyRoute><AdminAIPublishConfig /></LazyRoute>,
          },
          {
            path: "football/ai/diagnostics",
            element: <LazyRoute><AdminAIDiagnostics /></LazyRoute>,
          },
          {
            path: "football/ai/monitoring",
            element: <LazyRoute><AdminAIMonitoring /></LazyRoute>,
          },
          // ── Settings ─────────────────────────────────────────────────────
          {
            path: "settings",
            element: <LazyRoute><AdminSettings /></LazyRoute>,
          },
          // ── Currency Management (Phase 23.3) ─────────────────────────────
          {
            path: "currency",
            element: <LazyRoute><AdminCurrency /></LazyRoute>,
          },
          // ── Globalization & Platform Control Center (Phase 24.2) ──────────
          {
            path: "languages",
            element: <LazyRoute><AdminLanguages /></LazyRoute>,
          },
          {
            path: "translations",
            element: <LazyRoute><AdminTranslations /></LazyRoute>,
          },
          {
            path: "branding",
            element: <LazyRoute><AdminBranding /></LazyRoute>,
          },
          {
            path: "features",
            element: <LazyRoute><AdminFeatures /></LazyRoute>,
          },
          // ── AI Developer Center (Phase 13) ────────────────────────────────
          {
            path: "developer",
            element: <LazyRoute><AdminAIDeveloper /></LazyRoute>,
          },
        ],
      },

      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
