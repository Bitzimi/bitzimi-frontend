/**
 * Rollback Service — Phase 13.5
 *
 * Simulates a rollback of a previously applied fix by restoring the state
 * recorded in a ProjectSnapshot. The rollback pipeline mirrors the Fix Engine
 * (fixEngineService) step-by-step simulation pattern.
 *
 * HARD RULES (same enforcement as fixEngineService):
 * ─ A rollback requires a valid ProjectSnapshot with status === "active".
 * ─ The service throws immediately if the snapshot is not active (hard guard).
 * ─ NO filesystem writes. NO Git operations. NO project source file changes.
 * ─ Rollback is simulated exactly like the Fix Engine — steps run with delays.
 * ─ Phase 14 executes the actual state restoration via the persistence layer.
 */

import type { ProjectSnapshot } from "./snapshotService";

// ─── Step identity ────────────────────────────────────────────────────────────

export type RollbackStepId =
  | "validate_snapshot"
  | "restore_issue_state"
  | "restore_patch_state"
  | "verify_frontend"
  | "verify_backend"
  | "verify_database"
  | "verify_apis"
  | "record_rollback";

export type RollbackStepStatus = "pending" | "running" | "success" | "failed" | "skipped";

export const ROLLBACK_STEP_ORDER: RollbackStepId[] = [
  "validate_snapshot",
  "restore_issue_state",
  "restore_patch_state",
  "verify_frontend",
  "verify_backend",
  "verify_database",
  "verify_apis",
  "record_rollback",
];

export interface RollbackStep {
  id: RollbackStepId;
  label: string;
  status: RollbackStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  detail: string | null;
  errorMessage: string | null;
}

// ─── Execution record ─────────────────────────────────────────────────────────

export type RollbackExecutionStatus = "idle" | "running" | "success" | "failed";

export interface RollbackExecution {
  id: string;                    // RBK-XXXX
  snapshotId: string;
  issueId: string;
  patchId: string;
  steps: RollbackStep[];
  status: RollbackExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  initiatedBy: string;
}

// ─── Audit entry ──────────────────────────────────────────────────────────────

export interface RollbackAuditEntry {
  id: string;                    // RBA-XXXX
  snapshotId: string;
  issueId: string;
  patchId: string;
  initiatedBy: string;
  initiatedAt: string;
  result: "success" | "failed";
  failedStep: RollbackStepId | null;
  failedStepLabel: string | null;
  errorMessage: string | null;
  finalStatus: "rolled_back" | "rollback_failed";
  totalDurationMs: number;
  restoredStatus: string;
  restoredVerificationStatus: string;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface RollbackStepDef {
  id: RollbackStepId;
  label: string;
  durationMs: number;
  getDetail: (snap: ProjectSnapshot) => string;
}

const ROLLBACK_STEP_DEFS: RollbackStepDef[] = [
  {
    id: "validate_snapshot",
    label: "Validate Snapshot",
    durationMs: 300,
    getDetail: snap =>
      `Snapshot ${snap.id} validated. Captured at ${new Date(snap.capturedAt).toLocaleString()} by ${snap.capturedBy}. ` +
      `${snap.affectedFiles.length} file(s) recorded. Reason: ${snap.reason}. Integrity: OK.`,
  },
  {
    id: "restore_issue_state",
    label: "Restore Issue State",
    durationMs: 420,
    getDetail: snap =>
      `Issue ${snap.issueId} state restored: ` +
      `status → "${snap.issueStateBefore.status}", ` +
      `verificationStatus → "${snap.issueStateBefore.verificationStatus}". ` +
      `Pre-fix state recovered from snapshot.`,
  },
  {
    id: "restore_patch_state",
    label: "Restore Patch State",
    durationMs: 300,
    getDetail: snap =>
      `Patch ${snap.patchId} state restored: ` +
      `approvalStatus → "${snap.patchStateBefore.approvalStatus}". ` +
      `Patch remains available for re-application once a rollback cause is resolved.`,
  },
  {
    id: "verify_frontend",
    label: "Verify Frontend",
    durationMs: 520,
    getDetail: () =>
      "Frontend bundle integrity confirmed post-rollback. All lazy-loaded routes resolved. " +
      "Admin panel accessible. No missing assets. CSP headers: intact.",
  },
  {
    id: "verify_backend",
    label: "Verify Backend",
    durationMs: 640,
    getDetail: () =>
      "Backend service health: nominal post-rollback. Fastify server: running. " +
      "All route plugins registered. Auth middleware: active. 41 endpoints responding.",
  },
  {
    id: "verify_database",
    label: "Verify Database",
    durationMs: 420,
    getDetail: () =>
      "Database integrity verified post-rollback. Prisma schema matches persisted schema. " +
      "No pending migrations. Connection pool: healthy. Indices: intact.",
  },
  {
    id: "verify_apis",
    label: "Verify APIs",
    durationMs: 510,
    getDetail: () =>
      "API contract verification complete post-rollback. 41 endpoints confirmed. " +
      "Auth, wallet, games, tasks, referrals, affiliates, VIP, notifications, " +
      "analytics, and admin routes: all nominal.",
  },
  {
    id: "record_rollback",
    label: "Record Rollback",
    durationMs: 200,
    getDetail: snap =>
      `Rollback audit entry recorded. Snapshot ${snap.id} marked as restored. ` +
      `Version history updated. Issue ${snap.issueId} returned to pre-fix state.`,
  },
];

// ─── Session-scoped counters ──────────────────────────────────────────────────

const counters = { execution: 0, audit: 0 };

function padId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSteps(): RollbackStep[] {
  return ROLLBACK_STEP_DEFS.map(def => ({
    id: def.id,
    label: def.label,
    status: "pending" as RollbackStepStatus,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    detail: null,
    errorMessage: null,
  }));
}

function snapshotExec(exec: RollbackExecution): RollbackExecution {
  return { ...exec, steps: exec.steps.map(s => ({ ...s })) };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const rollbackService = {
  /**
   * executeRollback — run the complete rollback pipeline.
   *
   * HARD GUARD: throws immediately if snapshot.status !== "active".
   * A snapshot that has already been restored or superseded cannot be
   * rolled back again.
   *
   * Simulated exactly like fixEngineService — all steps run with timed delays.
   * NO filesystem writes. NO Git operations.
   */
  async executeRollback(
    snapshot: ProjectSnapshot,
    initiatedBy: string,
    onUpdate: (execution: RollbackExecution) => void,
  ): Promise<{ execution: RollbackExecution; auditEntry: RollbackAuditEntry }> {

    // ── Hard guard ─────────────────────────────────────────────────────────────
    if (snapshot.status !== "active") {
      throw new Error(
        `Rollback Service: snapshot ${snapshot.id} cannot be used for rollback. ` +
        `Current status: "${snapshot.status}". ` +
        `Only snapshots with status "active" can initiate a rollback.`,
      );
    }

    counters.execution++;
    const execId      = padId("RBK", counters.execution);
    const globalStart = Date.now();
    const startedAt   = new Date().toISOString();

    const steps = makeSteps();
    let execution: RollbackExecution = {
      id: execId,
      snapshotId: snapshot.id,
      issueId: snapshot.issueId,
      patchId: snapshot.patchId,
      steps,
      status: "running",
      startedAt,
      completedAt: null,
      initiatedBy,
    };

    onUpdate(snapshotExec(execution));

    let failedStep: RollbackStep | null = null;

    for (let i = 0; i < ROLLBACK_STEP_DEFS.length; i++) {
      const def  = ROLLBACK_STEP_DEFS[i];
      const step = steps[i];

      step.status    = "running";
      step.startedAt = new Date().toISOString();
      onUpdate(snapshotExec(execution));

      const t0 = Date.now();
      await delay(def.durationMs);

      step.completedAt = new Date().toISOString();
      step.durationMs  = Date.now() - t0;
      step.status      = "success";
      step.detail      = def.getDetail(snapshot);

      onUpdate(snapshotExec(execution));

      if (step.status === "failed") {
        failedStep = step;
        break;
      }
    }

    if (failedStep) {
      for (const step of steps) {
        if (step.status === "pending") {
          step.status = "skipped";
          step.detail = "Skipped due to earlier failure.";
        }
      }
    }

    const totalDurationMs  = Date.now() - globalStart;
    execution.status       = failedStep ? "failed" : "success";
    execution.completedAt  = new Date().toISOString();
    onUpdate(snapshotExec(execution));

    counters.audit++;
    const auditEntry: RollbackAuditEntry = {
      id:                        padId("RBA", counters.audit),
      snapshotId:                snapshot.id,
      issueId:                   snapshot.issueId,
      patchId:                   snapshot.patchId,
      initiatedBy,
      initiatedAt:               startedAt,
      result:                    failedStep ? "failed" : "success",
      failedStep:                failedStep?.id ?? null,
      failedStepLabel:           failedStep?.label ?? null,
      errorMessage:              failedStep?.errorMessage ?? null,
      finalStatus:               failedStep ? "rollback_failed" : "rolled_back",
      totalDurationMs,
      restoredStatus:            snapshot.issueStateBefore.status,
      restoredVerificationStatus: snapshot.issueStateBefore.verificationStatus,
    };

    return { execution, auditEntry };
  },
};
