/**
 * AI Patch Generator — Types, Sample Proposals & Service
 *
 * Phase 13.3: Patch proposal generation (read-only, no code execution).
 * - PatchProposal: full diff, risk assessment, explain fix, approval workflow
 * - No code is applied to project files at any point in this phase
 * - No builds, no tests, no verification
 * - Approval only changes the proposal status — Phase 13.4 (Fix Engine) reads it
 */

import type { IssueSeverity, IssueLayer } from "./developerService";

// ─── Risk ─────────────────────────────────────────────────────────────────────

export type PatchRiskLevel = "very_low" | "low" | "medium" | "high" | "critical";

export type PatchComplexity = "trivial" | "simple" | "moderate" | "complex" | "very_complex";

// ─── Approval ─────────────────────────────────────────────────────────────────

export type PatchApprovalStatus = "pending_review" | "approved" | "rejected";

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type PatchDiffLineType = "added" | "removed" | "unchanged" | "hunk";

export interface PatchDiffLine {
  type: PatchDiffLineType;
  lineNumBefore: number | null;
  lineNumAfter: number | null;
  content: string;
}

export interface PatchFile {
  filePath: string;
  language: string;
  diff: PatchDiffLine[];
  linesAdded: number;
  linesRemoved: number;
}

// ─── Risk assessment ──────────────────────────────────────────────────────────

export interface PatchRiskDimension {
  area: string;
  level: PatchRiskLevel;
  reason: string;
}

export interface PatchRiskAssessment {
  overall: PatchRiskLevel;
  overallReason: string;
  confidence: number;
  dimensions: PatchRiskDimension[];
}

// ─── Explain fix ──────────────────────────────────────────────────────────────

export interface ExplainFix {
  whyIssueExists: string;
  whyItHappens: string;
  whySolutionWorks: string;
  possibleSideEffects: string[];
  possibleAlternatives: string[];
  tradeoffs: string[];
  dependencies: string[];
  affectedSystems: string[];
  expectedOutcome: string;
}

// ─── Core proposal ────────────────────────────────────────────────────────────

/**
 * PatchProposal — a fully self-contained, read-only patch proposal.
 * Phase 13.4 (Fix Engine) reads `approvalStatus === "approved"` to know
 * it is safe to write `files[].afterLines` to the filesystem.
 */
export interface PatchProposal {
  // Identity
  id: string;                         // PAT-XXXX
  issueId: string;                    // DEV-XXXX

  // Context (mirrored from DevIssue for standalone display)
  title: string;
  severity: IssueSeverity;
  confidence: number;
  affectedLayer: IssueLayer;
  affectedModule: string;
  affectedFile: string | null;
  affectedFolder: string | null;
  affectedLine: number | null;

  // Analysis summary
  rootCause: string;
  summary: string;
  proposedSolution: string;
  expectedResult: string;

  // Complexity
  estimatedComplexity: PatchComplexity;
  totalFilesAffected: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;

  // Diff
  files: PatchFile[];

  // Risk
  riskAssessment: PatchRiskAssessment;

  // Explanation
  explainFix: ExplainFix;

  // Approval workflow
  approvalStatus: PatchApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;

  // Attribution
  generatedAt: string;
  generatedBy: string;
}

// ─── Sample patch proposals ────────────────────────────────────────────────────
// Representative proposals demonstrating patch engine capability.
// Phase 13.4+ will replace these with live engine output.

export const SAMPLE_PATCHES: PatchProposal[] = [

  // ── PAT-0001: DEV-0001 — deletedAt guard in refreshTokens (approved) ────────
  {
    id: "PAT-0001",
    issueId: "DEV-0001",
    title: "Add deletedAt guard in refreshTokens() to prevent deactivated users from refreshing tokens",
    severity: "critical",
    confidence: 98,
    affectedLayer: "backend",
    affectedModule: "auth",
    affectedFile: "backend/src/modules/auth/auth.service.ts",
    affectedFolder: "backend/src/modules/auth",
    affectedLine: 132,
    rootCause: "refreshTokens() checked suspendedAt but omitted the deletedAt guard that was added to loginUser() when soft-delete was introduced. The two code paths were developed independently.",
    summary: "Insert a two-line deletedAt guard immediately after the existing suspendedAt check in refreshTokens(), mirroring the pattern already used in loginUser().",
    proposedSolution: "After the `if (stored.user.suspendedAt)` block in refreshTokens(), insert: `if (stored.user.deletedAt) throw Object.assign(new Error(\"Account has been deactivated\"), { statusCode: 403, code: \"ACCOUNT_DELETED\" });`. This ensures deactivated users cannot obtain new access tokens via the refresh path. No schema changes, no new dependencies.",
    expectedResult: "POST /auth/refresh with a refresh token belonging to a deactivated account returns 403 ACCOUNT_DELETED. Active accounts continue to refresh normally. Existing token-revocation-on-deactivation logic remains as primary defense; this guard is defense-in-depth.",
    estimatedComplexity: "trivial",
    totalFilesAffected: 1,
    totalLinesAdded: 2,
    totalLinesRemoved: 0,
    files: [
      {
        filePath: "backend/src/modules/auth/auth.service.ts",
        language: "typescript",
        linesAdded: 2,
        linesRemoved: 0,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -130,6 +130,9 @@ export async function refreshTokens(rawToken: string) {" },
          { type: "unchanged", lineNumBefore: 130,  lineNumAfter: 130,   content: "  if (!stored || new Date() > stored.expiresAt)" },
          { type: "unchanged", lineNumBefore: 131,  lineNumAfter: 131,   content: "    throw Object.assign(new Error(\"Token not found or expired\"), { statusCode: 401, code: \"TOKEN_INVALID\" });" },
          { type: "unchanged", lineNumBefore: 132,  lineNumAfter: 132,   content: "  if (stored.user.suspendedAt)" },
          { type: "unchanged", lineNumBefore: 133,  lineNumAfter: 133,   content: "    throw Object.assign(new Error(\"Account suspended\"), { statusCode: 403, code: \"ACCOUNT_SUSPENDED\" });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 134,  content: "  if (stored.user.deletedAt)" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 135,  content: "    throw Object.assign(new Error(\"Account has been deactivated\"), { statusCode: 403, code: \"ACCOUNT_DELETED\" });" },
          { type: "unchanged", lineNumBefore: 134,  lineNumAfter: 136,   content: "" },
          { type: "unchanged", lineNumBefore: 135,  lineNumAfter: 137,   content: "  await db.authToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });" },
          { type: "unchanged", lineNumBefore: 136,  lineNumAfter: 138,   content: "  return issueTokenPair(stored.user.id, stored.user.email, stored.user.role);" },
        ],
      },
    ],
    riskAssessment: {
      overall: "very_low",
      overallReason: "Adds a guard that runs only for deleted accounts. The happy path (active account) is structurally unchanged. The error code mirrors the existing loginUser pattern — no new concepts introduced.",
      confidence: 98,
      dimensions: [
        { area: "Business Logic",  level: "very_low", reason: "Guard is unreachable for active accounts. Deleted-account refresh was previously broken behavior — now it is explicitly rejected." },
        { area: "Database",        level: "very_low", reason: "No schema change. No queries added — deletedAt is already included in the Prisma include from the AuthToken findFirst." },
        { area: "API",             level: "very_low", reason: "POST /auth/refresh returns 403 for deleted accounts instead of issuing new tokens. Frontend already handles ACCOUNT_SUSPENDED 403 — same handling applies." },
        { area: "Frontend",        level: "very_low", reason: "Frontend already handles 403 responses from /auth/refresh. The error code ACCOUNT_DELETED is handled identically to ACCOUNT_SUSPENDED." },
        { area: "Backend",         level: "very_low", reason: "Two-line addition inside a guarded conditional. No control flow changes for the non-deleted path." },
        { area: "Security",        level: "very_low", reason: "This patch increases security posture by closing a token refresh bypass. Risk is negative — it improves the security surface." },
        { area: "Performance",     level: "very_low", reason: "deletedAt is already loaded via the Prisma include. No additional database query." },
        { area: "Integration",     level: "very_low", reason: "No third-party integrations involved. Internal auth module only." },
      ],
    },
    explainFix: {
      whyIssueExists: "When the account soft-delete feature was introduced, the loginUser() path was correctly guarded but refreshTokens() was not updated to match. The two functions were modified in separate development sessions, and the guard was missed in refreshTokens() during code review.",
      whyItHappens: "refreshTokens() validates the JWT signature and checks whether the token record is revoked, but it only guards against suspended accounts — not deleted ones. A user who deactivates their account retains any non-expired refresh tokens in their browser, which can still call /auth/refresh and receive a new 15-minute access token.",
      whySolutionWorks: "Inserting the deletedAt check after the suspendedAt check closes the bypass. The check runs before the token rotation (revoke-old, issue-new), so no new token is ever created for a deleted account. The guard mirrors the loginUser() pattern exactly, making the two code paths consistent.",
      possibleSideEffects: [
        "None for active accounts — the guard is short-circuited before it is reached.",
        "Deleted accounts will receive 403 ACCOUNT_DELETED on next refresh attempt, rather than silently getting a new token. This is the intended behavior.",
      ],
      possibleAlternatives: [
        "Extract a shared validateUserAccount(user) helper that checks both suspendedAt and deletedAt, and call it from both loginUser() and refreshTokens(). Eliminates future drift between code paths.",
        "Add a database trigger or Prisma middleware that revokes all AuthToken records atomically when deletedAt is set. This makes the guard redundant but adds defense-in-depth.",
      ],
      tradeoffs: [
        "Minimal change (2 lines) vs. refactor to shared helper: the 2-line fix is lower risk and immediately deployable. The shared-helper refactor is better long-term but requires more testing surface.",
        "Defense-in-depth: existing deactivation already revokes tokens. This patch handles edge cases where a token survives (e.g., race condition during deactivation).",
      ],
      dependencies: [
        "backend/src/modules/auth/auth.service.ts — only file modified",
        "backend/prisma/schema.prisma — User.deletedAt already present, no change",
        "backend/src/modules/auth/auth.routes.ts — no change, routes unchanged",
      ],
      affectedSystems: ["Backend auth module", "JWT refresh endpoint"],
      expectedOutcome: "POST /auth/refresh for deactivated users returns 403 { code: 'ACCOUNT_DELETED' }. Active user refresh flow is unchanged. Behavior is now consistent between loginUser() and refreshTokens().",
    },
    approvalStatus: "approved",
    approvedBy: "system",
    approvedAt: "2026-07-16T06:10:00.000Z",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    generatedAt: "2026-07-16T06:00:00.000Z",
    generatedBy: "ai",
  },

  // ── PAT-0002: DEV-0002 — PIN brute-force protection (pending review) ─────────
  {
    id: "PAT-0002",
    issueId: "DEV-0002",
    title: "Apply financial rate-limit and LoginAttempt lockout to PIN verification endpoint",
    severity: "critical",
    confidence: 95,
    affectedLayer: "backend",
    affectedModule: "auth",
    affectedFile: "backend/src/modules/users/users.routes.ts",
    affectedFolder: "backend/src/modules/users",
    affectedLine: null,
    rootCause: "PIN verification was added as a user-module endpoint without inheriting the brute-force protections that were implemented exclusively on /auth/* routes.",
    summary: "Add the financial rate-limit group (10/min) to the PIN verification route, and extend the LoginAttempt brute-force system to record PIN attempts keyed by userId.",
    proposedSolution: "Two-part change: (1) Register the financial rate-limit plugin (fastifyRateLimit, 10 req/min) on the PIN verification route group in users.routes.ts. (2) Add checkPinLockout(userId) and recordPinAttempt(userId, success) calls in pin.service.ts that write to a new PinAttempt model or reuse LoginAttempt with a discriminator field. Consider 3-failure lockout for 30 minutes given the financial implications.",
    expectedResult: "An attacker attempting to enumerate 4-digit PINs hits the 10/min rate limit immediately. After 3 failed attempts, the userId is locked out for 30 minutes regardless of rate limit resets. Legitimate users with correct PINs are unaffected.",
    estimatedComplexity: "moderate",
    totalFilesAffected: 3,
    totalLinesAdded: 28,
    totalLinesRemoved: 4,
    files: [
      {
        filePath: "backend/src/modules/users/users.routes.ts",
        language: "typescript",
        linesAdded: 8,
        linesRemoved: 1,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -1,6 +1,7 @@ import { FastifyInstance } from \"fastify\";" },
          { type: "unchanged", lineNumBefore: 1,    lineNumAfter: 1,    content: "import { FastifyInstance } from \"fastify\";" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 2,   content: "import fastifyRateLimit from \"@fastify/rate-limit\";" },
          { type: "unchanged", lineNumBefore: 2,    lineNumAfter: 3,    content: "import { authenticate } from \"../../middleware/authenticate\";" },
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -42,6 +43,13 @@ export async function usersRoutes(app: FastifyInstance) {" },
          { type: "unchanged", lineNumBefore: 42,   lineNumAfter: 43,   content: "  // PIN routes" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 44,  content: "  await pinRouteGroup.register(fastifyRateLimit, {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 45,  content: "    max: 10," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 46,  content: "    timeWindow: \"1 minute\"," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 47,  content: "    keyGenerator: (req) => req.user?.sub ?? req.ip," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 48,  content: "  });" },
          { type: "unchanged", lineNumBefore: 43,   lineNumAfter: 49,   content: "  pinRouteGroup.post(\"/pin/verify\", verifyPinHandler);" },
        ],
      },
      {
        filePath: "backend/src/modules/users/pin.service.ts",
        language: "typescript",
        linesAdded: 18,
        linesRemoved: 3,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -1,5 +1,6 @@ import { db } from \"../../db\";" },
          { type: "unchanged", lineNumBefore: 1,    lineNumAfter: 1,    content: "import { db } from \"../../db\";" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 2,   content: "import { checkPinLockout, recordPinAttempt } from \"../auth/authAttempts\";" },
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -28,8 +29,22 @@ export async function verifySecurityPin(" },
          { type: "unchanged", lineNumBefore: 28,   lineNumAfter: 29,   content: "  userId: string," },
          { type: "unchanged", lineNumBefore: 29,   lineNumAfter: 30,   content: "  pin: string," },
          { type: "unchanged", lineNumBefore: 30,   lineNumAfter: 31,   content: ") {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 32,  content: "  await checkPinLockout(userId);" },
          { type: "unchanged", lineNumBefore: 31,   lineNumAfter: 33,   content: "  const user = await db.user.findUnique({ where: { id: userId } });" },
          { type: "unchanged", lineNumBefore: 32,   lineNumAfter: 34,   content: "  if (!user?.securityPinHash)" },
          { type: "unchanged", lineNumBefore: 33,   lineNumAfter: 35,   content: "    throw Object.assign(new Error(\"PIN not set\"), { statusCode: 400 });" },
          { type: "unchanged", lineNumBefore: 34,   lineNumAfter: 36,   content: "  const valid = await verifyPin(pin, user.securityPinHash);" },
          { type: "removed",   lineNumBefore: 35,   lineNumAfter: null,  content: "  if (!valid) throw Object.assign(new Error(\"Invalid PIN\"), { statusCode: 401 });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 37,  content: "  if (!valid) {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 38,  content: "    await recordPinAttempt(userId, false);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 39,  content: "    throw Object.assign(new Error(\"Invalid PIN\"), { statusCode: 401, code: \"INVALID_PIN\" });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 40,  content: "  }" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 41,  content: "  await recordPinAttempt(userId, true);" },
          { type: "unchanged", lineNumBefore: 36,   lineNumAfter: 42,   content: "  return issuePinToken(userId);" },
          { type: "unchanged", lineNumBefore: 37,   lineNumAfter: 43,   content: "}" },
        ],
      },
      {
        filePath: "backend/src/modules/auth/authAttempts.ts",
        language: "typescript",
        linesAdded: 22,
        linesRemoved: 0,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -52,3 +52,24 @@ export async function recordSuccess(email: string) {" },
          { type: "unchanged", lineNumBefore: 52,   lineNumAfter: 52,   content: "  await db.loginAttempt.updateMany({ where: { identifier: email }, data: { count: 0 } });" },
          { type: "unchanged", lineNumBefore: 53,   lineNumAfter: 53,   content: "}" },
          { type: "unchanged", lineNumBefore: 54,   lineNumAfter: 54,   content: "" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 55,  content: "const PIN_MAX_ATTEMPTS = 3;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 56,  content: "const PIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 57,  content: "" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 58,  content: "export async function checkPinLockout(userId: string) {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 59,  content: "  const key = `pin:${userId}`;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 60,  content: "  const rec = await db.loginAttempt.findUnique({ where: { identifier: key } });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 61,  content: "  if (!rec || rec.count < PIN_MAX_ATTEMPTS) return;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 62,  content: "  const elapsed = Date.now() - rec.updatedAt.getTime();" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 63,  content: "  if (elapsed < PIN_LOCKOUT_MS)" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 64,  content: "    throw Object.assign(new Error(\"PIN locked — too many failed attempts\"), { statusCode: 429, code: \"PIN_LOCKED\" });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 65,  content: "}" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 66,  content: "" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 67,  content: "export async function recordPinAttempt(userId: string, success: boolean) {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 68,  content: "  const key = `pin:${userId}`;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 69,  content: "  if (success) {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 70,  content: "    await db.loginAttempt.updateMany({ where: { identifier: key }, data: { count: 0 } });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 71,  content: "  } else {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 72,  content: "    await db.loginAttempt.upsert({ where: { identifier: key }," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 73,  content: "      update: { count: { increment: 1 }, updatedAt: new Date() }," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 74,  content: "      create: { identifier: key, count: 1, windowStart: new Date() }," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 75,  content: "    });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 76,  content: "  }" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 77,  content: "}" },
        ],
      },
    ],
    riskAssessment: {
      overall: "low",
      overallReason: "The change adds safety rails that were previously absent. Active users with correct PINs are unaffected. The only users who see new behavior are those making 3+ incorrect PIN attempts — which is the intended scenario to protect against.",
      confidence: 90,
      dimensions: [
        { area: "Business Logic",  level: "low",      reason: "PIN verification logic is unchanged for valid PINs. Incorrect-PIN behavior adds a lockout that improves security." },
        { area: "Database",        level: "low",      reason: "Reuses the existing LoginAttempt table with a prefixed key (pin:userId) to avoid schema migration. Upsert pattern is already proven in the email login path." },
        { area: "API",             level: "low",      reason: "Rate-limit header format is unchanged (same @fastify/rate-limit plugin). New 429 PIN_LOCKED response code should be handled by the frontend." },
        { area: "Frontend",        level: "medium",   reason: "Frontend must handle the new PIN_LOCKED 429 error code and display a user-friendly lockout message with remaining time. Currently it may show a generic error." },
        { area: "Backend",         level: "low",      reason: "authAttempts.ts extension follows existing patterns. No new dependencies — reuses db and existing model." },
        { area: "Security",        level: "very_low", reason: "This patch significantly improves security by closing the PIN enumeration vector." },
        { area: "Performance",     level: "very_low", reason: "One additional DB read per PIN attempt (upsert). Negligible impact — PIN verification is infrequent." },
        { area: "Integration",     level: "low",      reason: "Financial operations guarded by PIN are temporarily blocked for locked-out users. Lockout is 30 minutes — acceptable given the security trade-off." },
      ],
    },
    explainFix: {
      whyIssueExists: "The brute-force protection system (LoginAttempt + authAttempts.ts) was designed and implemented specifically for the email/password login flow. When the PIN verification feature was added to the user module, it was treated as a simple password-check endpoint and did not inherit the brute-force protections.",
      whyItHappens: "The global rate limiter allows 200 requests per minute per IP. With 10,000 possible 4-digit combinations and no lockout, a motivated attacker with multiple IPs could enumerate all PIN combinations within a realistic time window. The endpoint returns a 401 on failure, confirming the PIN was wrong — enough feedback for an attacker.",
      whySolutionWorks: "Two layers of protection: (1) The financial rate-limit (10/min) throttles attempt speed significantly. (2) The checkPinLockout guard locks the userId for 30 minutes after 3 failures, making enumeration practically infeasible regardless of IP rotation.",
      possibleSideEffects: [
        "A legitimate user who misremembers their PIN will be locked out for 30 minutes after 3 attempts. A clear UI message with the lockout duration mitigates frustration.",
        "The LoginAttempt table will accumulate records with 'pin:userId' keys. These should be included in any periodic cleanup job.",
      ],
      possibleAlternatives: [
        "Create a dedicated PinAttempt model instead of reusing LoginAttempt with a prefixed key. Cleaner schema but requires a migration.",
        "Use Redis/in-memory counter with TTL instead of database — faster reads but loses persistence across restarts.",
        "Implement exponential backoff (1s, 5s, 30s delays) instead of hard lockout — more user-friendly but more complex.",
      ],
      tradeoffs: [
        "30-minute lockout vs. shorter duration: longer lockout provides stronger security guarantee but worse UX for mistyped PINs. A 15-minute lockout may be a reasonable middle ground.",
        "Reusing LoginAttempt table vs. dedicated model: avoids migration but mixes concerns. Acceptable for now; migrate in Phase 13.5+ if needed.",
      ],
      dependencies: [
        "backend/src/modules/auth/authAttempts.ts — extended with PIN-specific functions",
        "backend/src/modules/users/pin.service.ts — calls new lockout functions",
        "backend/src/modules/users/users.routes.ts — adds rate-limit to PIN routes",
        "backend/prisma/schema.prisma — no change; LoginAttempt.identifier is a generic key column",
      ],
      affectedSystems: ["Backend PIN verification", "Financial transaction PIN gate", "Frontend PIN entry UI"],
      expectedOutcome: "PIN verification is protected by both a per-user rate limit and a 3-failure lockout. Brute-force enumeration of all 10,000 PIN combinations is no longer feasible within any practical time window.",
    },
    approvalStatus: "pending_review",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    generatedAt: "2026-07-16T07:15:00.000Z",
    generatedBy: "ai",
  },

  // ── PAT-0003: DEV-0005 — TOTP window tolerance (pending review) ────────────
  {
    id: "PAT-0003",
    issueId: "DEV-0005",
    title: "Add window: 1 tolerance to all TOTP verifySync() calls to handle clock skew",
    severity: "high",
    confidence: 92,
    affectedLayer: "backend",
    affectedModule: "settings",
    affectedFile: "backend/src/modules/users/settings.service.ts",
    affectedFolder: "backend/src/modules/users",
    affectedLine: 169,
    rootCause: "otplib verifySync() was called without the window option, defaulting to 0 (exact 30-second step only). RFC 6238 recommends window:1 to tolerate minor clock drift.",
    summary: "Pass { window: 1 } to every verifySync() call in settings.service.ts so that TOTP codes from the adjacent 30-second step are also accepted.",
    proposedSolution: "Locate all calls to authenticator.check() or totp.verify() / verifySync() in settings.service.ts and add the window option. Update both the enable2FA validation and the verify2FAToken function. One-line change per call site.",
    expectedResult: "Users whose authenticator app has up to ±30 seconds of clock drift (one TOTP window) no longer experience spurious 2FA failures. Users with severe clock drift (>30s) still fail — they need to sync their device clock.",
    estimatedComplexity: "trivial",
    totalFilesAffected: 1,
    totalLinesAdded: 4,
    totalLinesRemoved: 4,
    files: [
      {
        filePath: "backend/src/modules/users/settings.service.ts",
        language: "typescript",
        linesAdded: 4,
        linesRemoved: 4,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -166,14 +166,14 @@ export async function verify2FAToken(userId: string, token: string) {" },
          { type: "unchanged", lineNumBefore: 166,  lineNumAfter: 166,   content: "  const user = await db.user.findUnique({ where: { id: userId } });" },
          { type: "unchanged", lineNumBefore: 167,  lineNumAfter: 167,   content: "  if (!user?.totpSecret) throw Object.assign(new Error(\"2FA not enabled\"), { statusCode: 400 });" },
          { type: "removed",   lineNumBefore: 168,  lineNumAfter: null,   content: "  const valid = authenticator.verify({ token, secret: user.totpSecret });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 168,  content: "  const valid = authenticator.verify({ token, secret: user.totpSecret, window: 1 });" },
          { type: "unchanged", lineNumBefore: 169,  lineNumAfter: 169,   content: "  if (!valid) throw Object.assign(new Error(\"Invalid 2FA code\"), { statusCode: 401, code: \"INVALID_2FA_CODE\" });" },
          { type: "unchanged", lineNumBefore: 170,  lineNumAfter: 170,   content: "}" },
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -185,7 +185,7 @@ export async function enable2FA(userId: string, token: string) {" },
          { type: "unchanged", lineNumBefore: 185,  lineNumAfter: 185,   content: "  const { secret, uri } = generate2FASecret(user.email);" },
          { type: "unchanged", lineNumBefore: 186,  lineNumAfter: 186,   content: "  const isValid = authenticator.verify({" },
          { type: "unchanged", lineNumBefore: 187,  lineNumAfter: 187,   content: "    token," },
          { type: "unchanged", lineNumBefore: 188,  lineNumAfter: 188,   content: "    secret: pendingSecret," },
          { type: "removed",   lineNumBefore: 189,  lineNumAfter: null,   content: "  });" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 189,  content: "    window: 1," },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 190,  content: "  });" },
          { type: "unchanged", lineNumBefore: 190,  lineNumAfter: 191,   content: "  if (!isValid) throw Object.assign(new Error(\"Invalid verification code\"), { statusCode: 400 });" },
        ],
      },
    ],
    riskAssessment: {
      overall: "very_low",
      overallReason: "A window of 1 means the server accepts codes from 30 seconds before and after the current window. This is the RFC 6238 recommendation and is universally implemented by major TOTP providers (Google Authenticator, Authy). Security reduction is negligible.",
      confidence: 95,
      dimensions: [
        { area: "Business Logic",  level: "very_low", reason: "TOTP validation behavior is unchanged for users with synchronized clocks. Only users with minor clock drift benefit." },
        { area: "Database",        level: "very_low", reason: "No database changes. totpSecret storage is unaffected." },
        { area: "API",             level: "very_low", reason: "API contract unchanged. Same endpoint, same response codes." },
        { area: "Frontend",        level: "very_low", reason: "No frontend changes required. UX improves for users who previously experienced intermittent 2FA failures." },
        { area: "Backend",         level: "very_low", reason: "One-line change per call site. otplib's window option is well-documented and tested." },
        { area: "Security",        level: "very_low", reason: "window:1 increases the valid TOTP window from 30s to 90s. This is the universally accepted tolerance. Does not meaningfully increase brute-force surface — codes are still one-time-use." },
        { area: "Performance",     level: "very_low", reason: "No performance impact. verifySync is a pure CPU computation." },
        { area: "Integration",     level: "very_low", reason: "No external integrations affected." },
      ],
    },
    explainFix: {
      whyIssueExists: "The otplib library defaults to window:0 (exact 30-second step). This was not overridden during the 2FA implementation, leaving zero tolerance for clock drift.",
      whyItHappens: "TOTP codes are time-based — they change every 30 seconds. If a user's device clock is 20 seconds behind the server, the code they generate is from the previous step. With window:0, that previous-step code is rejected. With window:1, codes from one step before and after are also accepted.",
      whySolutionWorks: "Adding window:1 to authenticator.verify() tells otplib to also accept codes from the adjacent time windows (T-1 and T+1). This is RFC 6238 compliant and matches the behavior of all major 2FA providers.",
      possibleSideEffects: [
        "The valid window for a TOTP code increases from 30 seconds to 90 seconds. This is an acceptable trade-off per RFC 6238.",
        "Users with clocks more than 30 seconds off will still fail — they need to sync their device time.",
      ],
      possibleAlternatives: [
        "window:2 provides 150-second tolerance at the cost of a slightly wider valid window. Not recommended without user research showing clock drift severity.",
        "Detect and communicate clock-skew to the user: if window:0 fails but window:1 passes, return a 200 with a `clockDriftWarning: true` field so the client can display a 'sync your clock' message.",
      ],
      tradeoffs: [
        "window:1 vs. window:0: marginally wider attack surface (90s vs 30s) in exchange for eliminating legitimate user failures due to minor drift. Industry standard practice.",
      ],
      dependencies: [
        "backend/src/modules/users/settings.service.ts — only file modified",
        "otplib — already installed, window option already supported",
      ],
      affectedSystems: ["Backend 2FA verification", "2FA enable flow"],
      expectedOutcome: "Users with authenticator apps running up to ±30 seconds off server time successfully complete 2FA. Spurious 2FA rejection rate drops to near zero for well-functioning devices.",
    },
    approvalStatus: "pending_review",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    generatedAt: "2026-07-16T07:20:00.000Z",
    generatedBy: "ai",
  },

  // ── PAT-0004: DEV-0007 — identity polling overhead (pending review) ──────────
  {
    id: "PAT-0004",
    issueId: "DEV-0007",
    title: "Add shallow equality check to identity polling to prevent unnecessary re-renders",
    severity: "medium",
    confidence: 91,
    affectedLayer: "frontend",
    affectedModule: "IdentityContext",
    affectedFile: "src/app/contexts/IdentityContext.tsx",
    affectedFolder: "src/app/contexts",
    affectedLine: 120,
    rootCause: "The 2-second interval always calls setIdentity() even when the computed Identity object is identical to the previous value, triggering a full React reconciliation every tick.",
    summary: "Add a JSON.stringify-based shallow equality check before calling setIdentity(). Increase the polling interval from 2 seconds to 15 seconds since the storage event listener handles real-time updates.",
    proposedSolution: "Before calling setIdentity(newIdentity), compare JSON.stringify(newIdentity) === JSON.stringify(prevIdentity) using useRef to hold the last-known serialized value. Skip setIdentity if the string matches. Simultaneously increase the interval from 2000ms to 15000ms — the storage event listener already handles cross-tab sync in real-time.",
    expectedResult: "Identity polling triggers React re-renders only when the identity actually changes. Normal page sessions with no identity mutations produce zero interval-triggered re-renders. Pages with heavy component trees stop experiencing 30+ unnecessary reconciliations per minute.",
    estimatedComplexity: "simple",
    totalFilesAffected: 1,
    totalLinesAdded: 7,
    totalLinesRemoved: 3,
    files: [
      {
        filePath: "src/app/contexts/IdentityContext.tsx",
        language: "typescript",
        linesAdded: 7,
        linesRemoved: 3,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -88,7 +88,8 @@ export function IdentityProvider({ children }: { children: React.ReactNode }) {" },
          { type: "unchanged", lineNumBefore: 88,   lineNumAfter: 88,   content: "  const [identity, setIdentity] = useState<Identity>(() => buildIdentity());" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 89,  content: "  const lastIdentityRef = useRef<string>(JSON.stringify(buildIdentity()));" },
          { type: "unchanged", lineNumBefore: 89,   lineNumAfter: 90,   content: "" },
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -115,10 +116,12 @@ export function IdentityProvider({ children }: { children: React.ReactNode }) {" },
          { type: "unchanged", lineNumBefore: 115,  lineNumAfter: 116,   content: "  useEffect(() => {" },
          { type: "removed",   lineNumBefore: 116,  lineNumAfter: null,   content: "    const interval = setInterval(() => {" },
          { type: "removed",   lineNumBefore: 117,  lineNumAfter: null,   content: "      setIdentity(buildIdentity());" },
          { type: "removed",   lineNumBefore: 118,  lineNumAfter: null,   content: "    }, 2000);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 117,  content: "    const interval = setInterval(() => {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 118,  content: "      const next = buildIdentity();" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 119,  content: "      const nextStr = JSON.stringify(next);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 120,  content: "      if (nextStr === lastIdentityRef.current) return;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 121,  content: "      lastIdentityRef.current = nextStr;" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 122,  content: "      setIdentity(next);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 123,  content: "    }, 15000);" },
          { type: "unchanged", lineNumBefore: 119,  lineNumAfter: 124,   content: "    return () => clearInterval(interval);" },
          { type: "unchanged", lineNumBefore: 120,  lineNumAfter: 125,   content: "  }, []);" },
        ],
      },
    ],
    riskAssessment: {
      overall: "low",
      overallReason: "The storage event listener and identity-updated custom event handle real-time sync — the polling interval is purely a reliability fallback. Increasing it from 2s to 15s with an equality guard is a well-understood React optimization.",
      confidence: 91,
      dimensions: [
        { area: "Business Logic",  level: "very_low", reason: "No business logic is in the polling loop. It only reads and computes identity from localStorage." },
        { area: "Database",        level: "very_low", reason: "No database interaction. localStorage reads only." },
        { area: "API",             level: "very_low", reason: "No API calls in the polling loop." },
        { area: "Frontend",        level: "low",      reason: "If any component relies on the 2-second interval for a refresh it doesn't otherwise trigger, it may experience a delay. The storage event listener covers the normal cases." },
        { area: "Backend",         level: "very_low", reason: "No backend changes." },
        { area: "Security",        level: "very_low", reason: "No security implications. Identity polling is read-only." },
        { area: "Performance",     level: "very_low", reason: "This patch improves performance. Re-render frequency drops from 30/min to at most 4/min (and typically 0 if identity is stable)." },
        { area: "Integration",     level: "low",      reason: "Cross-tab identity sync continues to work via the storage event listener. The interval is now a secondary fallback for edge cases." },
      ],
    },
    explainFix: {
      whyIssueExists: "The polling interval was added as a defensive fallback for cross-tab synchronization. No equality check was added at the time — simplicity was prioritized over performance.",
      whyItHappens: "setInterval fires every 2000ms. Each tick calls buildIdentity() (reads localStorage, constructs an object) and setIdentity(result). React sees a new object reference every time even if the content is identical, scheduling a re-render of every component that consumes IdentityContext.",
      whySolutionWorks: "The equality check (JSON.stringify comparison via ref) prevents setIdentity() from being called when the serialized identity is identical to the last-known value. The interval increase from 2s to 15s reduces the fallback poll frequency without affecting real-time sync (which uses the storage event listener).",
      possibleSideEffects: [
        "If a component relies on identity state being refreshed every 2 seconds for something other than real data, it will now refresh every 15 seconds. Audit: no components were found with such a dependency.",
        "The useRef adds a small memory cost (one string holding the serialized identity). This is negligible.",
      ],
      possibleAlternatives: [
        "Remove the interval entirely and rely solely on the storage event listener + identity-updated custom event. Cleanest solution but requires verifying all identity mutation paths dispatch the event.",
        "Use useMemo with a deep-equal selector so components re-render only when specific identity fields they depend on change.",
        "Switch to a reactive localStorage library (e.g., use-local-storage-state) that handles all of this natively.",
      ],
      tradeoffs: [
        "JSON.stringify comparison is O(n) in the size of the identity object. For a small identity object this is negligible, but a structural equality library (fast-deep-equal) would be more correct for objects with non-deterministic key ordering.",
        "15s polling interval vs. 2s: cross-tab sync that isn't triggered by an event will take up to 15 seconds to propagate. Acceptable given that all known mutation paths dispatch the storage/identity-updated event.",
      ],
      dependencies: [
        "src/app/contexts/IdentityContext.tsx — only file modified",
        "React useRef — already imported in this file",
      ],
      affectedSystems: ["Frontend identity context", "All components consuming IdentityContext"],
      expectedOutcome: "Re-render frequency due to identity polling drops from 30/min to near-zero in typical sessions. Pages with complex component trees are no longer stressed by a fixed-interval re-render loop.",
    },
    approvalStatus: "pending_review",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    generatedAt: "2026-07-16T07:25:00.000Z",
    generatedBy: "ai",
  },

  // ── PAT-0005: DEV-0012 — dev console.log guard (approved) ───────────────────
  {
    id: "PAT-0005",
    issueId: "DEV-0012",
    title: "Gate password-reset and verification token console.log behind environment check",
    severity: "informational",
    confidence: 99,
    affectedLayer: "backend",
    affectedModule: "auth",
    affectedFile: "backend/src/modules/auth/auth.service.ts",
    affectedFolder: "backend/src/modules/auth",
    affectedLine: 184,
    rootCause: "console.log stubs for dev SMTP were added without an environment guard, allowing them to execute in any NODE_ENV including staging.",
    summary: "Wrap each console.log block in a config.env === 'development' guard to ensure tokens are never logged outside local development.",
    proposedSolution: "Import config at the top of auth.service.ts (already imported). Wrap the console.log block in forgotPassword() and sendVerificationEmail() with `if (config.env === 'development') { ... }`. No other changes required.",
    expectedResult: "In production and staging environments, the console.log calls are skipped entirely. Raw token values and recovery URLs are never written to stdout outside of local development. In development, behavior is unchanged.",
    estimatedComplexity: "trivial",
    totalFilesAffected: 1,
    totalLinesAdded: 4,
    totalLinesRemoved: 4,
    files: [
      {
        filePath: "backend/src/modules/auth/auth.service.ts",
        language: "typescript",
        linesAdded: 4,
        linesRemoved: 4,
        diff: [
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -182,9 +182,9 @@ export async function forgotPassword(email: string) {" },
          { type: "unchanged", lineNumBefore: 182,  lineNumAfter: 182,   content: "  });" },
          { type: "unchanged", lineNumBefore: 183,  lineNumAfter: 183,   content: "" },
          { type: "removed",   lineNumBefore: 184,  lineNumAfter: null,   content: "  // In production: send email with reset link containing rawToken" },
          { type: "removed",   lineNumBefore: 185,  lineNumAfter: null,   content: "  // In development: log to console (no SMTP configured)" },
          { type: "removed",   lineNumBefore: 186,  lineNumAfter: null,   content: "  console.log(`[Auth] Password reset token for ${email}: ${rawToken}`);" },
          { type: "removed",   lineNumBefore: 187,  lineNumAfter: null,   content: "  console.log(`[Auth] Reset link: ${process.env.FRONTEND_URL ?? \"http://localhost:5173\"}/reset-password?token=${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 184,  content: "  if (config.env === 'development') {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 185,  content: "    console.log(`[Auth] Password reset token for ${email}: ${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 186,  content: "    console.log(`[Auth] Reset link: ${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 187,  content: "  }" },
          { type: "hunk",      lineNumBefore: null, lineNumAfter: null,  content: "@@ -229,8 +229,9 @@ export async function sendVerificationEmail(email: string) {" },
          { type: "unchanged", lineNumBefore: 229,  lineNumAfter: 229,   content: "  });" },
          { type: "unchanged", lineNumBefore: 230,  lineNumAfter: 230,   content: "" },
          { type: "removed",   lineNumBefore: 231,  lineNumAfter: null,   content: "  // In production: send email with verification link" },
          { type: "removed",   lineNumBefore: 232,  lineNumAfter: null,   content: "  // In development: log to console" },
          { type: "removed",   lineNumBefore: 233,  lineNumAfter: null,   content: "  console.log(`[Auth] Email verification token for ${email}: ${rawToken}`);" },
          { type: "removed",   lineNumBefore: 234,  lineNumAfter: null,   content: "  console.log(`[Auth] Verify link: ${process.env.FRONTEND_URL ?? \"http://localhost:5173\"}/verify-email?token=${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 231,  content: "  if (config.env === 'development') {" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 232,  content: "    console.log(`[Auth] Email verification token for ${email}: ${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 233,  content: "    console.log(`[Auth] Verify link: ${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify-email?token=${rawToken}`);" },
          { type: "added",     lineNumBefore: null,  lineNumAfter: 234,  content: "  }" },
        ],
      },
    ],
    riskAssessment: {
      overall: "very_low",
      overallReason: "Wrapping existing console.log calls in an environment guard cannot break any functionality. Development behavior is unchanged. Production/staging security posture improves.",
      confidence: 99,
      dimensions: [
        { area: "Business Logic",  level: "very_low", reason: "No business logic changes. The guard only controls log output." },
        { area: "Database",        level: "very_low", reason: "No database changes." },
        { area: "API",             level: "very_low", reason: "API responses are unchanged." },
        { area: "Frontend",        level: "very_low", reason: "No frontend changes." },
        { area: "Backend",         level: "very_low", reason: "Additive change only — adds one if-guard around existing statements." },
        { area: "Security",        level: "very_low", reason: "This patch improves security by preventing token leakage to stdout in non-development environments." },
        { area: "Performance",     level: "very_low", reason: "Negligible — one boolean comparison per password reset / email verification call." },
        { area: "Integration",     level: "very_low", reason: "No integration changes." },
      ],
    },
    explainFix: {
      whyIssueExists: "The console.log stubs were added as temporary development aids when SMTP integration was deferred. No environment check was added because the file was initially only tested locally where NODE_ENV is always 'development'.",
      whyItHappens: "config.env is derived from process.env.NODE_ENV. In staging environments where NODE_ENV may be 'staging' or omitted (defaulting to development), the logs execute unconditionally and write sensitive raw tokens to stdout, which may be captured by log aggregation tools.",
      whySolutionWorks: "The config.env check ensures the console.log calls only execute in NODE_ENV=development environments. config is already imported in auth.service.ts, so no new import is required. The guard is a pure additive wrapper.",
      possibleSideEffects: [
        "Developers in non-development environments (e.g., running the server with NODE_ENV=staging locally) will not see the token in the console. They can either set NODE_ENV=development or check the database directly.",
      ],
      possibleAlternatives: [
        "Implement a real email provider abstraction that no-ops in development — fully solves the problem but requires more work.",
        "Use a SMTP_ENABLED flag: only log when SMTP_ENABLED=false AND NODE_ENV=development. More explicit but adds another config variable.",
      ],
      tradeoffs: [
        "Quick fix (environment guard) vs. full SMTP abstraction: the guard is deployable immediately with zero risk. SMTP abstraction is the correct long-term solution and should be tracked separately.",
      ],
      dependencies: [
        "backend/src/modules/auth/auth.service.ts — only file modified",
        "backend/src/config.ts — config.env already available, no change",
      ],
      affectedSystems: ["Backend auth service — forgotPassword and sendVerificationEmail"],
      expectedOutcome: "Raw password-reset and email-verification tokens are no longer logged to stdout in any environment except local development. The change is immediately deployable.",
    },
    approvalStatus: "approved",
    approvedBy: "system",
    approvedAt: "2026-07-16T07:30:00.000Z",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    generatedAt: "2026-07-16T07:28:00.000Z",
    generatedBy: "ai",
  },
];

// ─── Service ─────────────────────────────────────────────────────────────────

const SIMULATED_GENERATION_MS = 1800;

// In-memory store for approval state mutations (resets on page reload).
const patchStore = new Map<string, PatchProposal>(
  SAMPLE_PATCHES.map(p => [p.id, { ...p }])
);

// Phase 14.3: tracks which patch IDs originated from the backend scan engine.
// These patches route approve/reject/fetch to the backend API instead of local store.
const backendPatchIds = new Set<string>();

// ─── API helpers (Phase 14.3) ────────────────────────────────────────────────

const _API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";

function _getToken(): string | null {
  return localStorage.getItem("bitzimi_access_token");
}

async function _apiFetch<T>(apiPath: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${_API_BASE}${apiPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(_getToken() ? { Authorization: `Bearer ${_getToken()}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json() as { data?: T; error?: { code: string; message: string } };
  if (!res.ok) {
    throw Object.assign(
      new Error((json as { error?: { message?: string } }).error?.message ?? "Patch API error"),
      { status: res.status },
    );
  }
  return (json as { data: T }).data;
}

// ─── Local store helpers ──────────────────────────────────────────────────────

function findByIssueId(issueId: string): PatchProposal | null {
  for (const patch of patchStore.values()) {
    if (patch.issueId === issueId) return { ...patch };
  }
  return null;
}

function findById(id: string): PatchProposal | null {
  const p = patchStore.get(id);
  return p ? { ...p } : null;
}

export const patchService = {
  /**
   * Fetch an existing patch proposal for an issue (if generated).
   * Checks local store first (SAMPLE_PATCHES + previously generated).
   * Falls back to backend for real scanned issues (Phase 14.3).
   */
  async fetchPatchByIssueId(issueId: string): Promise<PatchProposal | null> {
    // Local store first (covers SAMPLE_PATCHES and cached backend patches)
    const local = findByIssueId(issueId);
    if (local) return local;

    // Phase 14.3: try backend for real scanned issues
    try {
      const patch = await _apiFetch<PatchProposal>(
        `/api/v1/admin/developer/patches/by-issue/${issueId}`,
      );
      // Cache in local store and mark as backend-originated
      patchStore.set(patch.id, { ...patch });
      backendPatchIds.add(patch.id);
      return { ...patch };
    } catch {
      return null;
    }
  },

  /**
   * Generate a patch for the given issueId.
   * For SAMPLE_PATCHES issues: returns existing or simulates delay (returns null).
   * For real scanned issues (Phase 14.3): calls the backend patch engine.
   * NO code is applied. NO files are written.
   */
  async generatePatch(issueId: string): Promise<PatchProposal | null> {
    // If a patch already exists in local store, return it immediately
    const existing = findByIssueId(issueId);
    if (existing) return existing;

    // Phase 14.3: try the real backend patch engine for scanned issues
    try {
      const patch = await _apiFetch<PatchProposal>(
        "/api/v1/admin/developer/patches/generate",
        { method: "POST", body: JSON.stringify({ issueId }) },
      );
      // Cache in local store and mark as backend-originated
      patchStore.set(patch.id, { ...patch });
      backendPatchIds.add(patch.id);
      return { ...patch };
    } catch {
      // Backend returned 404 (unsupported detector or issue not found) —
      // fall through to the simulated delay + null path for sample issues
    }

    // SAMPLE_PATCHES fallback: simulate generation delay then return null
    // (only reached for issues that are neither in the local store nor patchable by backend)
    await new Promise(resolve => setTimeout(resolve, SIMULATED_GENERATION_MS));
    return null;
  },

  /**
   * Approve a patch proposal.
   * Routes to backend API for backend-originated patches; local store for SAMPLE_PATCHES.
   * Approval ONLY changes the workflow status — NO code applied, NO files written.
   * Phase 13.4 (Fix Engine) reads approvalStatus === "approved" to execute.
   */
  async approvePatch(
    patchId: string,
    approvedBy: string,
  ): Promise<PatchProposal | null> {
    if (backendPatchIds.has(patchId)) {
      try {
        const updated = await _apiFetch<PatchProposal>(
          `/api/v1/admin/developer/patches/${patchId}/approve`,
          { method: "POST", body: JSON.stringify({}) },
        );
        patchStore.set(patchId, { ...updated });
        return { ...updated };
      } catch {
        return null;
      }
    }

    // Local SAMPLE_PATCHES path
    const patch = patchStore.get(patchId);
    if (!patch) return null;
    const updated: PatchProposal = {
      ...patch,
      approvalStatus: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    };
    patchStore.set(patchId, updated);
    return { ...updated };
  },

  /**
   * Reject a patch proposal.
   * Routes to backend API for backend-originated patches; local store for SAMPLE_PATCHES.
   * NO code execution. NO file changes.
   */
  async rejectPatch(
    patchId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<PatchProposal | null> {
    if (backendPatchIds.has(patchId)) {
      try {
        const updated = await _apiFetch<PatchProposal>(
          `/api/v1/admin/developer/patches/${patchId}/reject`,
          { method: "POST", body: JSON.stringify({ reason }) },
        );
        patchStore.set(patchId, { ...updated });
        return { ...updated };
      } catch {
        return null;
      }
    }

    // Local SAMPLE_PATCHES path
    const patch = patchStore.get(patchId);
    if (!patch) return null;
    const updated: PatchProposal = {
      ...patch,
      approvalStatus: "rejected",
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      approvedBy: null,
      approvedAt: null,
    };
    patchStore.set(patchId, updated);
    return { ...updated };
  },

  /**
   * Fetch a single patch proposal by ID.
   */
  async fetchPatchById(id: string): Promise<PatchProposal | null> {
    return findById(id);
  },
};
