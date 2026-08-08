/**
 * AI Developer Center — Data Types, Analysis Models & Service
 *
 * Phase 13.1: Foundation types + stub service
 * Phase 13.2: Full analysis engine types, sample data, client-side filtering,
 *             status management stubs — ready for future backend wiring.
 *
 * NO AI provider connections.
 * NO internet/documentation search.
 * NO code modification of any kind.
 * Analysis and understanding only.
 */

// ─── Severity ─────────────────────────────────────────────────────────────────

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "informational";

// ─── Category ─────────────────────────────────────────────────────────────────

export type IssueCategory =
  | "authentication"
  | "authorization"
  | "data_validation"
  | "error_handling"
  | "performance"
  | "security"
  | "async_flow"
  | "state_management"
  | "null_safety"
  | "memory_leak"
  | "race_condition"
  | "api_integration"
  | "database"
  | "build"
  | "dependency"
  | "ui_ux"
  | "type_safety"
  | "configuration";

// ─── Layer ────────────────────────────────────────────────────────────────────

export type IssueLayer =
  | "frontend"
  | "backend"
  | "database"
  | "api"
  | "infrastructure"
  | "security"
  | "performance";

// ─── Status ───────────────────────────────────────────────────────────────────

export type IssueStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "wont_fix"
  | "verified";

// ─── Verification status ──────────────────────────────────────────────────────

export type IssueVerificationStatus =
  | "unverified"
  | "under_review"
  | "verified"
  | "false_positive"
  | "closed";

// ─── Impact areas ─────────────────────────────────────────────────────────────

export type ImpactArea =
  | "performance"
  | "security"
  | "data_integrity"
  | "user_experience"
  | "build"
  | "compilation"
  | "runtime"
  | "financial"
  | "gameplay"
  | "authentication"
  | "admin"
  | "api"
  | "database";

// ─── Phase 14.2 analysis types ───────────────────────────────────────────────

export type ComplexityLevel    = "trivial" | "simple" | "moderate" | "complex" | "very_complex";
export type RiskClassification = "low_risk" | "medium_risk" | "high_risk" | "critical_risk";

// ─── System health ────────────────────────────────────────────────────────────

export type SystemHealthStatus = "healthy" | "warning" | "critical" | "unknown";

// ─── Scan type ────────────────────────────────────────────────────────────────

export type ScanType =
  | "full"
  | "deep"
  | "frontend"
  | "backend"
  | "database"
  | "api"
  | "integrations";

// ─── Core interfaces ──────────────────────────────────────────────────────────

export interface SystemHealthCard {
  id: string;
  name: string;
  status: SystemHealthStatus;
  lastChecked: string | null;
  detail?: string;
}

/**
 * DevIssue — the central analysis record.
 * Every field is populated by the analysis engine; future phases
 * will write these via backend API. For now, sample data fills them.
 */
export interface DevIssue {
  // ── Identity ──
  id: string;

  // ── Analysis ──
  severity: IssueSeverity;
  confidence: number;             // 0–100
  category: IssueCategory;
  layer: IssueLayer;

  // ── Location ──
  module: string;
  component: string;
  file: string | null;
  folder: string | null;
  line: number | null;

  // ── Status ──
  status: IssueStatus;
  verificationStatus: IssueVerificationStatus;

  // ── Description ──
  title: string;
  description: string;

  // ── Root Cause Analysis ──
  rootCause: string;

  // ── Impact Analysis ──
  impact: ImpactArea[];

  // ── Dependency Analysis ──
  dependencies: string[];           // affected file paths / module names
  affectedComponents: string[];     // component/function names

  // ── Suggested Approaches (read-only guidance — no fixes, no patches) ──
  suggestedApproaches: string[];

  // ── Timeline ──
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;

  // ── Attribution ──
  reportedBy: string;               // "ai" | "manual" | userId
  verifiedBy: string | null;

  // ── Phase 14.2 — Analysis Intelligence Engine (all optional) ──
  evidenceFiles?:               string[];
  evidenceRefs?:                string[];
  relatedIssueIds?:             string[];
  estimatedComplexity?:         ComplexityLevel;
  estimatedInvestigationHours?: number;
  riskClassification?:          RiskClassification;
  businessImpact?:              string;
  technicalDescription?:        string;
  affectedRoutes?:              string[];
  dependencyPaths?:             string[];
  directImporterCount?:         number;
  transitiveImporterCount?:     number;
  analysisId?:                  string;
}

export interface IssueSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
}

export interface ScanRecord {
  id: string;
  scanType: ScanType;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  issuesFound: number;
  status: "running" | "completed" | "failed" | "cancelled";
  triggeredBy: string;
}

// ─── Initial system health config (foundation) ────────────────────────────────

export const SYSTEM_HEALTH_CARDS: Omit<SystemHealthCard, "lastChecked">[] = [
  { id: "frontend",   name: "Frontend",   status: "unknown" },
  { id: "backend",    name: "Backend",    status: "unknown" },
  { id: "database",   name: "Database",   status: "unknown" },
  { id: "apis",       name: "APIs",       status: "unknown" },
  { id: "websocket",  name: "WebSocket",  status: "unknown" },
  { id: "cache",      name: "Cache",      status: "unknown" },
  { id: "build",      name: "Build",      status: "unknown" },
];

// ─── Sample issue dataset ─────────────────────────────────────────────────────
// Representative analysis records demonstrating engine capability.
// Phase 13.3+ will replace these with real backend-sourced records.

export const SAMPLE_ISSUES: DevIssue[] = [
  // ── RESOLVED CRITICAL — fixed in Phase 12.4 ──────────────────────────────
  {
    id: "DEV-0001",
    severity: "critical",
    confidence: 98,
    category: "authentication",
    layer: "backend",
    module: "auth",
    component: "refreshTokens",
    file: "backend/src/modules/auth/auth.service.ts",
    folder: "backend/src/modules/auth",
    line: 121,
    status: "resolved",
    verificationStatus: "verified",
    title: "Soft-deleted users can obtain new access tokens via token refresh",
    description: "The refreshTokens() function checks suspendedAt but omits a deletedAt guard. A user who deactivated their account retains the ability to call POST /auth/refresh with a non-expired refresh token and receive a new access token, bypassing account deactivation entirely.",
    rootCause: "The loginUser() function correctly checks deletedAt, but the refreshTokens() code path was not updated when account deactivation (soft delete) was introduced. The two flows share the same User record but were developed independently across phases, causing the guard to be present in one path and absent in the other.",
    impact: ["security", "authentication", "data_integrity"],
    dependencies: [
      "backend/src/modules/auth/auth.service.ts",
      "backend/src/modules/users/account.service.ts",
      "backend/src/middleware/authenticate.ts",
      "backend/prisma/schema.prisma",
    ],
    affectedComponents: ["refreshTokens", "loginUser", "deactivateAccount", "issueTokenPair"],
    suggestedApproaches: [
      "Add a deletedAt null check immediately after the existing suspendedAt check in refreshTokens()",
      "Throw 403 ACCOUNT_DELETED if stored.user.deletedAt is set, mirroring the loginUser pattern",
      "Add integration test: deactivate user → retain refresh token → verify refresh endpoint rejects with 403",
      "Consider a shared guard helper that consolidates suspendedAt and deletedAt checks across all auth code paths",
    ],
    createdAt: "2026-07-16T05:40:00.000Z",
    updatedAt: "2026-07-16T06:10:00.000Z",
    resolvedAt: "2026-07-16T06:10:00.000Z",
    reportedBy: "ai",
    verifiedBy: "system",
  },

  // ── OPEN CRITICAL — rate limiting gap ────────────────────────────────────
  {
    id: "DEV-0002",
    severity: "critical",
    confidence: 95,
    category: "security",
    layer: "backend",
    module: "auth",
    component: "PIN verification",
    file: "backend/src/modules/users/users.routes.ts",
    folder: "backend/src/modules/users",
    line: null,
    status: "open",
    verificationStatus: "unverified",
    title: "PIN verification endpoint lacks brute-force protection",
    description: "The POST /users/me/pin/verify endpoint is protected by the global rate limiter (200/min) but not by the stricter auth-path limiter (5/min) or the database-backed LoginAttempt system. A motivated attacker can enumerate all 10,000 possible 4-digit PIN combinations within the global rate limit window.",
    rootCause: "The database-backed brute-force lockout system (LoginAttempt model, authAttempts.ts) was implemented specifically for email/password login. The PIN verification endpoint was created independently and was not included in the scope of the brute-force implementation. The auth rate-limit group (5/min) is registered only on /auth/* routes.",
    impact: ["security", "financial", "authentication"],
    dependencies: [
      "backend/src/modules/users/users.routes.ts",
      "backend/src/modules/users/pin.service.ts",
      "backend/src/modules/auth/authAttempts.ts",
      "backend/src/index.ts",
    ],
    affectedComponents: ["verifySecurityPin", "issuePinToken", "checkLockout", "recordFailure"],
    suggestedApproaches: [
      "Apply the financial rate-limit group (10/min) to the PIN verification route at minimum",
      "Extend the LoginAttempt brute-force system to support PIN attempts keyed by userId rather than email",
      "Consider a stricter lockout policy for PIN (3 failures → 30-min lock) given financial implications",
      "Review whether pinToken TTL (5 min) is sufficient or should be shortened for high-value actions",
    ],
    createdAt: "2026-07-16T06:30:00.000Z",
    updatedAt: "2026-07-16T06:30:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN CRITICAL — JWT secret in dev mode ──────────────────────────────
  {
    id: "DEV-0003",
    severity: "critical",
    confidence: 90,
    category: "security",
    layer: "backend",
    module: "config",
    component: "JWT secrets",
    file: "backend/src/config.ts",
    folder: "backend/src",
    line: 14,
    status: "open",
    verificationStatus: "unverified",
    title: "Backend logs plaintext password-reset and email-verification tokens to stdout",
    description: "The forgotPassword() and sendVerificationEmail() functions emit raw cryptographic tokens to console.log in development mode. If stdout is captured by a log aggregator in a staging environment that shares log access with non-privileged developers, these tokens represent valid one-time-use credential recovery links.",
    rootCause: "The console.log calls are development-mode stubs placed intentionally to demonstrate token generation without a real SMTP provider. No environment guard prevents these logs in staging environments where NODE_ENV may not be 'production' but log pipelines may be monitored by multiple parties.",
    impact: ["security", "authentication", "data_integrity"],
    dependencies: [
      "backend/src/modules/auth/auth.service.ts",
      "backend/src/config.ts",
    ],
    affectedComponents: ["forgotPassword", "sendVerificationEmail", "resetPassword", "verifyEmail"],
    suggestedApproaches: [
      "Replace console.log with a dedicated mail abstraction that no-ops in development by default",
      "If keeping console output for dev, gate it strictly on config.env === 'development' rather than the absence of 'production'",
      "Add a SMTP_ENABLED flag to config; when false, log to a separate dev-only channel (not stdout)",
      "Review log retention policies for any deployed non-production environment",
    ],
    createdAt: "2026-07-16T06:31:00.000Z",
    updatedAt: "2026-07-16T06:31:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN HIGH — race condition in wallet ─────────────────────────────────
  {
    id: "DEV-0004",
    severity: "high",
    confidence: 88,
    category: "race_condition",
    layer: "backend",
    module: "wallets",
    component: "balance update",
    file: "backend/src/modules/wallets/wallets.service.ts",
    folder: "backend/src/modules/wallets",
    line: null,
    status: "open",
    verificationStatus: "unverified",
    title: "Concurrent wallet operations may produce incorrect balance under high concurrency",
    description: "Wallet balance updates that read-modify-write without a database-level lock or optimistic concurrency check are susceptible to lost-update anomalies. Two concurrent requests that both read the same balance before either writes can produce a final state equal to only one of the two changes rather than both.",
    rootCause: "SQLite (development) serializes writes at the connection level, masking this issue locally. In production with PostgreSQL and a connection pool, concurrent transactions operating on the same walletId without SELECT FOR UPDATE or equivalent isolation can interleave at the read step. The issue surfaces specifically when balance reads and writes are not wrapped in a single serializable transaction.",
    impact: ["financial", "data_integrity", "database"],
    dependencies: [
      "backend/src/modules/wallets/wallets.service.ts",
      "backend/prisma/schema.prisma",
      "backend/src/modules/withdrawals/withdrawals.service.ts",
      "backend/src/modules/deposits/deposits.service.ts",
    ],
    affectedComponents: ["updateBalance", "debitWallet", "creditWallet", "processWithdrawal", "confirmDeposit"],
    suggestedApproaches: [
      "Wrap all balance read-modify-write sequences in a serializable Prisma transaction with row-level locking",
      "Consider using Prisma's atomic increment/decrement operations ($executeRaw UPDATE ... SET balance = balance + ?) instead of read-modify-write",
      "Add optimistic concurrency with a version column on Wallet; reject updates where version does not match",
      "Review all wallet mutation paths to ensure none operate outside a transaction boundary",
    ],
    createdAt: "2026-07-16T06:32:00.000Z",
    updatedAt: "2026-07-16T06:32:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN HIGH — missing TOTP window tolerance ─────────────────────────────
  {
    id: "DEV-0005",
    severity: "high",
    confidence: 85,
    category: "authentication",
    layer: "backend",
    module: "settings",
    component: "verify2FAToken",
    file: "backend/src/modules/users/settings.service.ts",
    folder: "backend/src/modules/users",
    line: 169,
    status: "open",
    verificationStatus: "unverified",
    title: "TOTP verification does not configure time-window tolerance for clock skew",
    description: "The verify2FAToken() and enable2FA() functions call verifySync() with only token and secret. The otplib default window is 0 (exact 30-second step only). Users whose authenticator apps have even minor clock drift (common on Android devices) will experience intermittent 2FA failures with no clear error message.",
    rootCause: "The otplib functional API's verifySync accepts an options object including window (number of adjacent 30-second steps to accept). This was not specified during initial 2FA implementation, leaving the default of 0. RFC 6238 recommends a window of 1 (one step behind and one step ahead) to account for reasonable clock drift.",
    impact: ["user_experience", "authentication"],
    dependencies: [
      "backend/src/modules/users/settings.service.ts",
      "backend/src/modules/auth/auth.service.ts",
    ],
    affectedComponents: ["verify2FAToken", "enable2FA", "loginUser"],
    suggestedApproaches: [
      "Add window: 1 to all verifySync() calls to tolerate one 30-second step of clock drift in each direction",
      "Review otplib documentation for the full options surface to ensure other defaults are acceptable",
      "Add a clear error message distinguishing 'invalid code' from a likely clock-skew scenario",
    ],
    createdAt: "2026-07-16T06:33:00.000Z",
    updatedAt: "2026-07-16T06:33:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN HIGH — frontend token refresh not auto-triggered ─────────────────
  {
    id: "DEV-0006",
    severity: "high",
    confidence: 82,
    category: "async_flow",
    layer: "frontend",
    module: "backendAuthService",
    component: "refreshBackendToken",
    file: "src/app/services/backendAuthService.ts",
    folder: "src/app/services",
    line: 203,
    status: "under_review",
    verificationStatus: "under_review",
    title: "No automatic access token refresh interceptor — 401 responses silently fail",
    description: "When an access token expires (15-minute TTL), API calls to authenticated endpoints return 401. The frontend has a refreshBackendToken() function but no interceptor that automatically triggers it on 401 responses. Silent failures result in stale UI state or broken actions without any user feedback or retry logic.",
    rootCause: "The authentication service was built as a bridge layer without a centralized HTTP client. Each feature component calls fetch() directly with the stored access token. There is no shared request interceptor layer where expired-token retry logic can be injected. The refreshBackendToken() function exists but is only called during explicit logout checks.",
    impact: ["user_experience", "authentication", "api"],
    dependencies: [
      "src/app/services/backendAuthService.ts",
      "src/app/contexts/IdentityContext.tsx",
      "src/app/pages/Login.tsx",
    ],
    affectedComponents: [
      "refreshBackendToken", "loginWithBackend", "syncIdentityFromBackend",
      "check2FAStatus", "verify2FACode",
    ],
    suggestedApproaches: [
      "Create a shared apiFetch() wrapper that checks token expiry before each request and calls refreshBackendToken() proactively",
      "Add a 401 response interceptor inside apiFetch() that attempts one silent refresh then retries the original request",
      "Decode the access token's exp claim on storage to compute proactive refresh timing (e.g., refresh if < 2 min remaining)",
      "Dispatch a session-expired event if refresh fails, redirecting the user to the login page with appropriate messaging",
    ],
    createdAt: "2026-07-16T06:34:00.000Z",
    updatedAt: "2026-07-16T07:00:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN MEDIUM — identity polling overhead ────────────────────────────────
  {
    id: "DEV-0007",
    severity: "medium",
    confidence: 91,
    category: "performance",
    layer: "frontend",
    module: "IdentityContext",
    component: "IdentityProvider",
    file: "src/app/contexts/IdentityContext.tsx",
    folder: "src/app/contexts",
    line: 120,
    status: "open",
    verificationStatus: "unverified",
    title: "Identity context polls localStorage every 2 seconds unconditionally",
    description: "The IdentityProvider sets a 2-second interval that calls buildIdentity() on every tick regardless of whether localStorage has changed. On pages with complex components, this triggers unnecessary re-renders across the entire component tree every 2 seconds. The interval also prevents React's automatic batching optimization from applying to the interval-triggered update.",
    rootCause: "The polling was implemented as a reliability fallback for cross-tab identity synchronization. The storage event listener handles same-origin cross-tab changes correctly, but the interval was added defensively. The interval does not diff against previous state before calling setIdentity(), meaning it always triggers a re-render even when nothing changed.",
    impact: ["performance", "user_experience"],
    dependencies: [
      "src/app/contexts/IdentityContext.tsx",
      "src/app/services/userProfileService.ts",
    ],
    affectedComponents: ["IdentityProvider", "buildIdentity", "refreshIdentity"],
    suggestedApproaches: [
      "Add a shallow equality check before calling setIdentity() — skip the update if the derived Identity object is unchanged",
      "Increase the polling interval to 10–30 seconds now that the storage event listener handles real-time sync",
      "Use useMemo to memoize buildIdentity() result and compare against previous value before setting state",
      "Consider removing the interval entirely and relying solely on the storage event + identity-updated custom event",
    ],
    createdAt: "2026-07-16T06:35:00.000Z",
    updatedAt: "2026-07-16T06:35:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN MEDIUM — error swallowing in auth bridge ──────────────────────────
  {
    id: "DEV-0008",
    severity: "medium",
    confidence: 87,
    category: "error_handling",
    layer: "frontend",
    module: "backendAuthService",
    component: "syncIdentityFromBackend",
    file: "src/app/services/backendAuthService.ts",
    folder: "src/app/services",
    line: 58,
    status: "open",
    verificationStatus: "unverified",
    title: "syncIdentityFromBackend silently swallows all errors including 401/403 responses",
    description: "The syncIdentityFromBackend() function catches all exceptions with an empty catch block. If /users/me returns 401 (expired token), 403 (suspended/deleted), or 500 (server error), the failure is ignored entirely. The stored identity in localStorage is neither updated nor invalidated, leaving the UI showing stale or incorrect user data.",
    rootCause: "The function was designed as a best-effort sync with a defensive catch block to prevent registration/login flows from failing due to a secondary sync failure. However, the catch block is too broad — it suppresses actionable errors (401, 403) that should trigger logout or token refresh, treating them identically to transient network failures.",
    impact: ["authentication", "user_experience", "security"],
    dependencies: [
      "src/app/services/backendAuthService.ts",
      "src/app/contexts/IdentityContext.tsx",
    ],
    affectedComponents: ["syncIdentityFromBackend", "loginWithBackend", "registerWithBackend"],
    suggestedApproaches: [
      "Differentiate error types: propagate 401/403 responses rather than swallowing them",
      "On 401, trigger a token refresh attempt before concluding the session is invalid",
      "On 403 (ACCOUNT_DELETED, ACCOUNT_SUSPENDED), clear all stored tokens and redirect to login with appropriate message",
      "Log non-network errors at warn level for observability even if the call itself does not fail",
    ],
    createdAt: "2026-07-16T06:36:00.000Z",
    updatedAt: "2026-07-16T06:36:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN MEDIUM — missing audit log for auth events ───────────────────────
  {
    id: "DEV-0009",
    severity: "medium",
    confidence: 80,
    category: "security",
    layer: "backend",
    module: "auth",
    component: "auditLogHook",
    file: "backend/src/middleware/auditLog.ts",
    folder: "backend/src/middleware",
    line: 15,
    status: "open",
    verificationStatus: "unverified",
    title: "Audit log only captures admin mutations — auth events (login, logout, password reset) are not recorded",
    description: "The auditLogHook middleware is registered exclusively on admin route plugins. User-facing security events such as login, failed login attempts, password resets, email verifications, and account deactivations are not logged to the AuditLog table. This creates a gap in the security event trail required for incident response.",
    rootCause: "The audit log was implemented as an admin-action observer and was scoped to admin routes by design. Security-relevant user auth events were not included in scope. The LoginAttempt table captures failed login counts but does not produce queryable audit records with IP address, user agent, or outcome metadata.",
    impact: ["security", "admin", "data_integrity"],
    dependencies: [
      "backend/src/middleware/auditLog.ts",
      "backend/src/modules/auth/auth.routes.ts",
      "backend/src/modules/auth/auth.service.ts",
    ],
    affectedComponents: ["auditLogHook", "loginUser", "logoutUser", "forgotPassword", "resetPassword", "deactivateAccount"],
    suggestedApproaches: [
      "Create a separate security event logger (e.g., logSecurityEvent()) that writes to AuditLog with a dedicated actorType of 'user_auth'",
      "Log: login success/failure, logout, password reset request/completion, email verify, account deactivate, 2FA enable/disable",
      "Include IP address, user agent, and outcome in each security event record",
      "Review GDPR/data retention implications before logging any PII in audit records",
    ],
    createdAt: "2026-07-16T06:37:00.000Z",
    updatedAt: "2026-07-16T06:37:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN LOW — dev CORS wildcard risk ─────────────────────────────────────
  {
    id: "DEV-0010",
    severity: "low",
    confidence: 75,
    category: "configuration",
    layer: "backend",
    module: "config",
    component: "CORS",
    file: "backend/src/index.ts",
    folder: "backend/src",
    line: null,
    status: "open",
    verificationStatus: "unverified",
    title: "CORS origin defaults to localhost — no warning if staging environment inherits dev config",
    description: "The CORS_ORIGINS environment variable defaults to http://localhost:5173 when unset. If a staging deployment omits this variable, the server will silently accept cross-origin requests only from localhost. This is unlikely to cause functional issues but represents a configuration footgun where a misconfigured staging environment produces confusing CORS errors that look like application bugs.",
    rootCause: "The default value was chosen for local development convenience and is technically safe (restrictive). However, there is no validation that CORS_ORIGINS is explicitly set in non-local environments. The productionCheck validator only enforces CORS restrictions for NODE_ENV=production, not staging.",
    impact: ["api", "user_experience"],
    dependencies: [
      "backend/src/index.ts",
      "backend/src/config.ts",
      "backend/src/security/productionCheck.ts",
    ],
    affectedComponents: ["validateProductionConfig", "corsPlugin"],
    suggestedApproaches: [
      "Add CORS_ORIGINS to the list of variables explicitly required in non-development environments",
      "Log a warning at startup whenever CORS_ORIGINS is using the localhost default and NODE_ENV is not 'development'",
      "Document CORS_ORIGINS in a deployment checklist or .env.example file",
    ],
    createdAt: "2026-07-16T06:38:00.000Z",
    updatedAt: "2026-07-16T06:38:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── OPEN LOW — large bundle chunk ─────────────────────────────────────────
  {
    id: "DEV-0011",
    severity: "low",
    confidence: 99,
    category: "performance",
    layer: "frontend",
    module: "analytics",
    component: "AnalyticsPage",
    file: "src/app/admin/pages/analytics/AnalyticsPage.tsx",
    folder: "src/app/admin/pages/analytics",
    line: null,
    status: "open",
    verificationStatus: "unverified",
    title: "AnalyticsPage bundle chunk exceeds 500 kB — charting library not code-split",
    description: "The production build emits AnalyticsPage as a 467 kB JavaScript chunk (125 kB gzipped). This is caused by the entire charting library (Recharts or equivalent) being bundled into a single chunk with the AnalyticsPage component. Users who never visit /admin/analytics still pay the parse cost on navigation to any admin route due to Vite's chunking strategy.",
    rootCause: "The charting library is imported at the top of AnalyticsPage.tsx with a static import. Vite does lazy-load the page module itself, but the charting library is large enough to prevent further automatic splitting. The library is not shared with any other page, making it a prime candidate for per-page chunking.",
    impact: ["performance", "user_experience", "build"],
    dependencies: [
      "src/app/admin/pages/analytics/AnalyticsPage.tsx",
      "src/app/routes.tsx",
      "vite.config.ts",
    ],
    affectedComponents: ["AnalyticsPage", "AdminLayout"],
    suggestedApproaches: [
      "Use dynamic import() for the charting library inside AnalyticsPage to force Vite to split it into a separate chunk",
      "Wrap chart components in React.lazy() with a Suspense fallback inside AnalyticsPage",
      "Consider configuring manualChunks in vite.config.ts to group heavy charting libraries into a named vendor chunk",
      "Evaluate switching to a lighter charting alternative for the specific chart types used",
    ],
    createdAt: "2026-07-16T06:39:00.000Z",
    updatedAt: "2026-07-16T06:39:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },

  // ── INFORMATIONAL — dev console.log in production path ───────────────────
  {
    id: "DEV-0012",
    severity: "informational",
    confidence: 99,
    category: "configuration",
    layer: "backend",
    module: "auth",
    component: "issueTokenPair",
    file: "backend/src/modules/auth/auth.service.ts",
    folder: "backend/src/modules/auth",
    line: 182,
    status: "open",
    verificationStatus: "unverified",
    title: "Development console.log for password-reset and verification tokens present in source",
    description: "The forgotPassword() and sendVerificationEmail() functions contain console.log statements that emit full raw token values and recovery URLs to stdout. These are intentional development stubs (noted in comments) but are not gated by an environment check — they execute whenever the function is called, including in staging environments.",
    rootCause: "SMTP integration was deferred to a later phase. Placeholder console.log statements were added to allow developer testing without an email provider. No guard on config.env prevents these logs from running in non-development environments.",
    impact: ["security"],
    dependencies: [
      "backend/src/modules/auth/auth.service.ts",
    ],
    affectedComponents: ["forgotPassword", "sendVerificationEmail"],
    suggestedApproaches: [
      "Wrap console.log calls in if (config.env === 'development') guards as an immediate low-effort mitigation",
      "Track SMTP integration as a planned task to replace stubs with real email delivery",
      "Add a SMTP_DSN environment variable that the email stub checks; log only when it is explicitly absent and NODE_ENV is development",
    ],
    createdAt: "2026-07-16T06:40:00.000Z",
    updatedAt: "2026-07-16T06:40:00.000Z",
    resolvedAt: null,
    reportedBy: "ai",
    verifiedBy: null,
  },
];

// ─── Sample scan history ──────────────────────────────────────────────────────

export const SAMPLE_SCANS: ScanRecord[] = [
  {
    id: "SCN-0001",
    scanType: "full",
    startedAt: "2026-07-16T05:38:00.000Z",
    completedAt: "2026-07-16T05:40:32.000Z",
    durationMs: 152000,
    issuesFound: 12,
    status: "completed",
    triggeredBy: "ai",
  },
  {
    id: "SCN-0002",
    scanType: "backend",
    startedAt: "2026-07-16T06:29:00.000Z",
    completedAt: "2026-07-16T06:31:04.000Z",
    durationMs: 64000,
    issuesFound: 8,
    status: "completed",
    triggeredBy: "ai",
  },
  {
    id: "SCN-0003",
    scanType: "frontend",
    startedAt: "2026-07-16T06:33:00.000Z",
    completedAt: "2026-07-16T06:34:22.000Z",
    durationMs: 82000,
    issuesFound: 4,
    status: "completed",
    triggeredBy: "ai",
  },
];

// ─── Service ─────────────────────────────────────────────────────────────────

export interface FetchIssuesParams {
  severity?:            IssueSeverity;
  category?:            IssueCategory;
  layer?:               IssueLayer;
  status?:              IssueStatus;
  verificationStatus?:  IssueVerificationStatus;
  module?:              string;
  search?:              string;
  dateFrom?:            string;
  dateTo?:              string;
  minConfidence?:       number;
  cursor?:              string;
  limit?:               number;
}

export interface FetchIssuesResult {
  items: DevIssue[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FetchScansResult {
  items: ScanRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const developerService = {
  async fetchIssueSummary(): Promise<IssueSummary> {
    const counts = SAMPLE_ISSUES.reduce(
      (acc, i) => { acc[i.severity] = (acc[i.severity] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );
    return {
      critical:      counts.critical      ?? 0,
      high:          counts.high          ?? 0,
      medium:        counts.medium        ?? 0,
      low:           counts.low           ?? 0,
      informational: counts.informational ?? 0,
      total:         SAMPLE_ISSUES.length,
    };
  },

  async fetchIssues(params?: FetchIssuesParams): Promise<FetchIssuesResult> {
    let items = [...SAMPLE_ISSUES];

    if (params?.severity)           items = items.filter(i => i.severity           === params.severity);
    if (params?.category)           items = items.filter(i => i.category           === params.category);
    if (params?.layer)              items = items.filter(i => i.layer              === params.layer);
    if (params?.status)             items = items.filter(i => i.status             === params.status);
    if (params?.verificationStatus) items = items.filter(i => i.verificationStatus === params.verificationStatus);
    if (params?.minConfidence != null)
      items = items.filter(i => i.confidence >= params.minConfidence!);
    if (params?.module)
      items = items.filter(i => i.module.toLowerCase().includes(params.module!.toLowerCase()));
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(i =>
        i.id.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.module.toLowerCase().includes(q) ||
        i.component.toLowerCase().includes(q) ||
        (i.file ?? "").toLowerCase().includes(q) ||
        (i.folder ?? "").toLowerCase().includes(q)
      );
    }
    if (params?.dateFrom) items = items.filter(i => i.createdAt >= params.dateFrom!);
    if (params?.dateTo)   items = items.filter(i => i.createdAt <= params.dateTo!);

    return { items, total: items.length, nextCursor: null, hasMore: false };
  },

  async fetchScanHistory(): Promise<FetchScansResult> {
    return { items: SAMPLE_SCANS, nextCursor: null, hasMore: false };
  },

  async fetchSystemHealth(): Promise<SystemHealthCard[]> {
    return SYSTEM_HEALTH_CARDS.map(c => ({ ...c, lastChecked: null }));
  },

  async fetchIssueById(id: string): Promise<DevIssue | null> {
    return SAMPLE_ISSUES.find(i => i.id === id) ?? null;
  },

  async updateIssueStatus(
    id: string,
    _status: IssueStatus,
    _verificationStatus?: IssueVerificationStatus,
  ): Promise<void> {
    // Phase 13.3+: PATCH /api/v1/admin/developer/issues/:id
    void id;
  },

  async triggerScan(_type: ScanType): Promise<void> {
    // Phase 13.3+: POST /api/v1/admin/developer/scan
  },
};
